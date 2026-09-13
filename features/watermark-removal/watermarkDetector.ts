import { loadPdf } from "@/lib/documents";
import { editablePageText, type EditableText, type ImageRemoval } from "@/lib/pdf-text";
import { detectImagesOnPage } from "@/features/image-editor/imageDetector";
import type { WatermarkCandidate } from "./watermarkTypes";

export function normalizeTurkish(text: string): string {
  if (!text) return "";
  return text
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const WATERMARK_KEYWORDS = [
  // Turkish invalidity & draft & sample indicators
  "gecersiz", "gecersizdir",
  "ornek", "ornektir", "ornek belge", "ornek belgedir",
  "taslak", "taslaktir",
  "gizli", "gizlidir",
  "kopya", "kopyadir", "belge kopyasi", "surettir",
  "iptal", "iptal edilmistir",
  "deneme", "numune",
  "ogrenci", "ogrenci belgesi",
  "resmi degildir", "bilgi icindir",
  "kontrolsuz", "kontrolsuz kopya",
  "onaylanmamis", "onaylanmamistir",
  "asli gibidir",
  "filigran", "korumali",
  // English & common indicators
  "draft", "confidential", "copy", "void", "sample", "test",
  "specimen", "evaluation", "trial", "preview", "unofficial",
  "for review", "do not copy", "watermark", "camscanner",
  "not for official use"
];

export interface ReconstructedLine {
  page: number;
  text: string;
  items: EditableText[];
  angle: number;
  size: number;
  color: string;
}

export function reconstructPageLines(items: EditableText[]): ReconstructedLine[] {
  if (!items || items.length === 0) return [];

  const lines: ReconstructedLine[] = [];
  const used = new Set<number>();

  for (let i = 0; i < items.length; i++) {
    if (used.has(i)) continue;
    const base = items[i];
    const angleRad = ((base.angle || 0) * Math.PI) / 180;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);

    const basePerp = -base.x * sin + base.y * cos;
    const baseProj = base.x * cos + base.y * sin;

    const lineItems: { item: EditableText; proj: number }[] = [{ item: base, proj: baseProj }];
    used.add(i);

    for (let j = i + 1; j < items.length; j++) {
      if (used.has(j)) continue;
      const other = items[j];
      if (other.page !== base.page) continue;

      const diff = Math.abs((base.angle || 0) - (other.angle || 0)) % 180;
      if (diff > 5 && diff < 175) continue;

      const otherPerp = -other.x * sin + other.y * cos;
      const otherProj = other.x * cos + other.y * sin;

      const maxFontSize = Math.max(base.size || 12, other.size || 12);
      if (Math.abs(basePerp - otherPerp) > maxFontSize * 0.6) continue;

      lineItems.push({ item: other, proj: otherProj });
      used.add(j);
    }

    lineItems.sort((a, b) => a.proj - b.proj);
    const sorted = lineItems.map((li) => li.item);

    let fullText = "";
    for (const it of sorted) {
      const t = it.text?.trim() || "";
      if (!t) continue;
      if (!fullText) fullText = t;
      else if (fullText.endsWith("/") || fullText.endsWith("-") || t.startsWith("/") || t.startsWith("-")) {
        fullText += " " + t;
      } else {
        fullText += " " + t;
      }
    }

    if (fullText.length > 0) {
      lines.push({
        page: base.page,
        text: fullText,
        items: sorted,
        angle: base.angle || 0,
        size: sorted.reduce((acc, it) => acc + (it.size || 12), 0) / sorted.length,
        color: base.color || "#222222"
      });
    }
  }

  return lines;
}

export async function detectWatermarks(
  pdfBytes: Uint8Array,
  pdfDocInstance?: any
): Promise<WatermarkCandidate[]> {
  const doc = pdfDocInstance || (await loadPdf(pdfBytes));
  const numPages = doc.numPages;
  const candidates: WatermarkCandidate[] = [];

  try {
    const allPageTexts: { page: number; items: EditableText[] }[] = [];
    const allPageImages: { page: number; images: any[] }[] = [];

    // 1. Collect all texts and images per page
    for (let pageIdx = 0; pageIdx < numPages; pageIdx++) {
      try {
        const page = await doc.getPage(pageIdx + 1);
        const [texts, imgs] = await Promise.all([
          editablePageText(page).catch(() => []),
          detectImagesOnPage(page, pageIdx).catch(() => [])
        ]);
        allPageTexts.push({ page: pageIdx, items: texts });
        allPageImages.push({ page: pageIdx, images: imgs });
      } catch {}
    }

    // 2. Reconstruct lines per page & group by normalized text
    const textGroups = new Map<
      string,
      {
        rawText: string;
        lines: ReconstructedLine[];
        pages: Set<number>;
        angles: number[];
        fontSizes: number[];
        colors: Set<string>;
        matchedKeywords: string[];
      }
    >();

    for (const { page, items } of allPageTexts) {
      const lines = reconstructPageLines(items);

      // Process both reconstructed lines and individual multichar items
      for (const line of lines) {
        const str = line.text?.trim();
        if (!str || str.length < 2) continue;
        const norm = normalizeTurkish(str);
        if (!norm) continue;

        const matched = WATERMARK_KEYWORDS.filter((kw) => norm.includes(kw));

        let group = textGroups.get(norm);
        if (!group) {
          group = {
            rawText: str,
            lines: [],
            pages: new Set(),
            angles: [],
            fontSizes: [],
            colors: new Set(),
            matchedKeywords: matched
          };
          textGroups.set(norm, group);
        }
        group.lines.push(line);
        group.pages.add(page);
        group.angles.push(line.angle || 0);
        group.fontSizes.push(line.size || 12);
        if (line.color) group.colors.add(line.color);
      }
    }

    // 3. Score and identify text watermark candidates
    let candidateIndex = 1;
    for (const [normKey, group] of textGroups.entries()) {
      const pageCount = group.pages.size;
      const avgFontSize = group.fontSizes.reduce((a, b) => a + b, 0) / group.fontSizes.length;
      const hasDiagonal = group.angles.some((a) => {
        const absA = Math.abs(a % 180);
        return (absA >= 15 && absA <= 75) || (absA >= 105 && absA <= 165);
      });

      const matchedKw = group.matchedKeywords;
      const keywordMatched = matchedKw.length > 0;
      const repeatsOnMultiplePages = numPages > 1 && (pageCount >= 2 || pageCount / numPages >= 0.5);
      const isLargeFont = avgFontSize >= 24;
      const isRepeatedHeaderFooter =
        repeatsOnMultiplePages &&
        (normKey.includes("www") ||
          normKey.includes("com") ||
          normKey.includes("http") ||
          normKey.includes("sayfa") ||
          normKey.includes("taranmis"));

      let confidence = 0;
      const reasons: string[] = [];

      if (keywordMatched) {
        confidence += 65 + (matchedKw.length - 1) * 15;
        reasons.push(`Filigran anahtar kelimesi: ${matchedKw.join(", ")}`);
      }
      if (hasDiagonal) {
        confidence += 30;
        reasons.push("Çapraz/açılı yerleşim");
      }
      if (repeatsOnMultiplePages) {
        confidence += 30;
        reasons.push(`${pageCount} sayfada tekrarlandı`);
      }
      if (isLargeFont) {
        confidence += avgFontSize >= 32 ? 25 : 15;
        reasons.push(`Büyük yazı boyutu (${Math.round(avgFontSize)}pt)`);
      }
      if (isRepeatedHeaderFooter) {
        confidence += 25;
        reasons.push("Tekrarlayan alt/üst bilgi");
      }

      // If confidence >= 40 or keyword match
      if (confidence >= 40 || keywordMatched) {
        // Collect all constituent text removals from lines
        const removals: { id: string; page: number; quad: number[] }[] = [];
        const seenRemoval = new Set<string>();

        for (const line of group.lines) {
          for (const it of line.items) {
            const key = `${it.page}_${it.id}`;
            if (!seenRemoval.has(key)) {
              seenRemoval.add(key);
              removals.push({
                id: it.id,
                page: it.page,
                quad: it.quad
              });
            }
          }
        }

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const line of group.lines) {
          for (const it of line.items) {
            if (it.x < minX) minX = it.x;
            if (it.x + it.w > maxX) maxX = it.x + it.w;
            if (it.y < minY) minY = it.y;
            if (it.y + it.h > maxY) maxY = it.y + it.h;
          }
        }
        const bounds = Number.isFinite(minX) && maxX > minX
          ? { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
          : undefined;

        candidates.push({
          id: `wm-text-${candidateIndex++}`,
          type: "text",
          text: group.rawText,
          count: removals.length,
          pages: Array.from(group.pages).sort((a, b) => a - b),
          fontSize: Math.round(avgFontSize),
          angle: Math.round(group.angles[0] || 0),
          color: Array.from(group.colors)[0] || "#222222",
          reason: reasons.join(" · "),
          confidence: Math.min(99, confidence),
          textRemovals: removals,
          imageBounds: bounds
        });
      }
    }

    // 4. Image / Logo Watermark Analysis
    const imageSignatures = new Map<string, {
      firstImg: any;
      removals: ImageRemoval[];
      pages: Set<number>;
    }>();

    for (const { page, images } of allPageImages) {
      for (const img of images) {
        // Form a signature based on aspect ratio, pixel size, or approximate bounding box
        const sig = `${Math.round(img.w)}x${Math.round(img.h)}_${Math.round(img.x)}_${Math.round(img.y)}`;
        let sigGroup = imageSignatures.get(sig);
        if (!sigGroup) {
          sigGroup = {
            firstImg: img,
            removals: [],
            pages: new Set()
          };
          imageSignatures.set(sig, sigGroup);
        }
        sigGroup.pages.add(page);
        sigGroup.removals.push({
          page,
          bounds: img.originalBounds,
          imageId: img.id,
          objectRef: img.objectRef,
          imageIndex: img.imageIndex,
          pixelWidth: img.pixelWidth,
          pixelHeight: img.pixelHeight,
          matrix: img.matrix
        });
      }
    }

    for (const [, group] of imageSignatures.entries()) {
      const pageCount = group.pages.size;
      // If image repeats across 2+ pages in the same position, or is non-fullpage recurring watermark
      const img = group.firstImg;
      const isFullPageScan = (img.w >= 500 && img.h >= 700); // Exclude full document page scans
      
      if (!isFullPageScan && (pageCount >= 2 || (pageCount === 1 && img.isWatermark))) {
        candidates.push({
          id: `wm-img-${candidateIndex++}`,
          type: "image",
          text: img.name || "Tekrarlayan Logo / Damga",
          count: group.removals.length,
          pages: Array.from(group.pages).sort((a, b) => a - b),
          imageBounds: { x: img.x, y: img.y, w: img.w, h: img.h },
          imagePreviewUrl: img.previewUrl || img.dataUrl,
          reason: `${pageCount} sayfada aynı konumda tekrarlanan görsel`,
          confidence: Math.min(90, 40 + pageCount * 15),
          imageRemovals: group.removals
        });
      }
    }

    // 4. If no vector text or image watermark candidates found, run local Visual OCR detector
    if (candidates.length === 0 && typeof window !== "undefined") {
      try {
        const { detectVisualWatermarks } = await import("./visualWatermarkDetector");
        const visualCands = await detectVisualWatermarks(pdfBytes, 0);
        if (visualCands && visualCands.length > 0) {
          candidates.push(...visualCands);
        }
      } catch (visErr) {
        console.warn("Visual watermark detection fallback error:", visErr);
      }
    }

    // Sort by confidence descending
    candidates.sort((a, b) => b.confidence - a.confidence);

  } finally {
    if (!pdfDocInstance && doc?.loadingTask) {
      try { await doc.loadingTask.destroy(); } catch {}
    }
  }

  return candidates;
}
