import { loadPdf } from "@/lib/documents";
import { editablePageText, type EditableText, type ImageRemoval } from "@/lib/pdf-text";
import { detectImagesOnPage } from "@/features/image-editor/imageDetector";
import type { WatermarkCandidate } from "./watermarkTypes";

const WATERMARK_KEYWORDS = [
  "DRAFT", "TASLAK", "GİZLİ", "GIZLI", "CONFIDENTIAL", "ÖRNEKTİR", "ORNEKTIR",
  "KOPYA", "COPY", "NUMUNE", "DENEME", "CAMSCANNER", "WATERMARK",
  "FILIGRAN", "FİLİGRAN", "İPTAL", "IPTAL", "VOID", "SAMPLE", "TEST",
  "SPECIMEN", "EVALUATION", "TRIAL", "PREVIEW", "ÖĞRENCİ", "OGRENCI",
  "KORUMALI", "UNOFFICIAL", "FOR REVIEW", "GİZLİDİR", "GIZLIDIR", "BELGE KOPYASI"
];

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

    // 2. Group text items by normalized text string
    const textGroups = new Map<string, {
      rawText: string;
      items: { page: number; item: EditableText }[];
      pages: Set<number>;
      angles: number[];
      fontSizes: number[];
      colors: Set<string>;
    }>();

    for (const { page, items } of allPageTexts) {
      for (const item of items) {
        const str = item.text?.trim();
        if (!str || str.length < 2) continue;
        const normKey = str.toLowerCase().replace(/\s+/g, " ");

        let group = textGroups.get(normKey);
        if (!group) {
          group = {
            rawText: str,
            items: [],
            pages: new Set(),
            angles: [],
            fontSizes: [],
            colors: new Set()
          };
          textGroups.set(normKey, group);
        }
        group.items.push({ page, item });
        group.pages.add(page);
        group.angles.push(item.angle || 0);
        group.fontSizes.push(item.size || 12);
        if (item.color) group.colors.add(item.color);
      }
    }

    // 3. Score and identify text watermark candidates
    let candidateIndex = 1;
    for (const [normKey, group] of textGroups.entries()) {
      const pageCount = group.pages.size;
      const upperText = group.rawText.toUpperCase();
      const avgFontSize = group.fontSizes.reduce((a, b) => a + b, 0) / group.fontSizes.length;
      const hasDiagonal = group.angles.some(a => {
        const absA = Math.abs(a % 180);
        return absA >= 15 && absA <= 75;
      });

      const keywordMatched = WATERMARK_KEYWORDS.some(kw => upperText.includes(kw));
      const repeatsOnMultiplePages = numPages > 1 && (pageCount >= 2 || pageCount / numPages >= 0.5);
      const isLargeFont = avgFontSize >= 28;
      const isRepeatedHeaderFooter = repeatsOnMultiplePages && (
        group.rawText.includes("www.") ||
        group.rawText.includes(".com") ||
        group.rawText.includes("http") ||
        group.rawText.includes("©") ||
        group.rawText.includes("Sayfa") ||
        group.rawText.includes("Taranmış")
      );

      let confidence = 0;
      const reasons: string[] = [];

      if (keywordMatched) {
        confidence += 55;
        reasons.push("Filigran anahtar kelimesi eşleşti");
      }
      if (hasDiagonal) {
        confidence += 35;
        reasons.push("Çapraz/açılı yerleşim");
      }
      if (repeatsOnMultiplePages) {
        confidence += 30;
        reasons.push(`${pageCount} sayfada tekrarlandı`);
      }
      if (isLargeFont) {
        confidence += 20;
        reasons.push(`Büyük yazı boyutu (${Math.round(avgFontSize)}pt)`);
      }
      if (isRepeatedHeaderFooter) {
        confidence += 25;
        reasons.push("Tekrarlayan alt/üst bilgi");
      }

      // If confidence >= 40 or single-page strong match (keyword + diagonal or keyword + large font)
      if (confidence >= 40 || (keywordMatched && (hasDiagonal || isLargeFont || numPages === 1))) {
        candidates.push({
          id: `wm-text-${candidateIndex++}`,
          type: "text",
          text: group.rawText,
          count: group.items.length,
          pages: Array.from(group.pages).sort((a, b) => a - b),
          fontSize: Math.round(avgFontSize),
          angle: Math.round(group.angles[0] || 0),
          color: Array.from(group.colors)[0] || "#222222",
          reason: reasons.join(" · "),
          confidence: Math.min(99, confidence),
          textRemovals: group.items.map(({ page, item }) => ({
            id: item.id,
            page,
            quad: item.quad
          }))
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

    // Sort by confidence descending
    candidates.sort((a, b) => b.confidence - a.confidence);

  } finally {
    if (!pdfDocInstance && doc?.loadingTask) {
      try { await doc.loadingTask.destroy(); } catch {}
    }
  }

  return candidates;
}
