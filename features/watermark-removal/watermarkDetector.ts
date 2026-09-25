import { loadPdf } from "../../lib/documents.ts";
import { editablePageText, type EditableText, type ImageRemoval } from "../../lib/pdf-text.ts";
import { detectImagesOnPage } from "../image-editor/imageDetector.ts";
import type { WatermarkCandidate } from "./watermarkTypes.ts";
import { PDFDocument } from "pdf-lib";
export { buildSafeAutoCleanCandidateIds } from "./watermarkRemover.ts";

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
  // Turkish invalidity, simulation, & void indicators
  "gecersiz", "gecersizdir", "gecersiz belge", "gecersiz belgedir", "gecersiz ornek belgedir", "gecersiz ornek", "gecersiz / ornek belgedir", "gecersiz/ornek",
  "belge simulasyonudur", "simulasyonudur", "simulasyon", "simulasyondur",
  "hukumsuz", "hukumsuzdur", "hukuksuz", "gecersiz kilinmistir", "hukuken gecersizdir",
  // Turkish sample & preview
  "ornek", "ornektir", "ornek belge", "ornek belgedir", "ornek dokuman", "ornek metin", "ornek sozlesme",
  // Turkish draft
  "taslak", "taslaktir", "taslak metin", "taslak belge", "on taslak", "calisma taslagi",
  // Turkish confidentiality & restricted (standalone 'gizli' removed to protect normal sentences)
  "gizlidir", "cok gizli", "ozeldir", "hizmete ozel", "ozel evrak", "mahrem", "mahremiyet", "ticari sir",
  // Turkish copy & reproduction (standalone 'kopya' kept only with copy indicators)
  "kopyadir", "belge kopyasi", "suret", "surettir", "onaysiz kopya", "kontrolsuz kopya", "fotokopi", "sureti",
  // Turkish cancellation & terminated
  "iptal", "iptal edilmistir", "feshedilmistir", "fesih", "ilga", "yururlukten kalkmistir",
  // Turkish trial & demo
  "test", "testtir", "test belgesi", "test filigrani", "deneme", "denemedir", "numune", "onizleme", "demo", "deneme surumu", "on izleme",
  // Turkish non-official & informational indicators ('ogrenci', 'ogrenci belgesi', 'belgedir' removed)
  "resmi degildir", "bilgi icindir", "bilgilendirme amacli", "bilgilendirmedir",
  "hukuki baglayiciligi yoktur", "gecerliligi yoktur", "baglayiciligi yoktur",
  "kontrolsuz kopya",
  "onaylanmamis", "onaylanmamistir", "onay bekliyor", "onaysiz", "taslak halindedir",
  "asli gibidir", "aslinin aynisidir",
  "filigran", "filigrandir", "korumali", "telif hakki", "izinsiz kullanilamaz", "izinsiz cogaltilamaz",
  // Mobile scanner watermarks (standalone 'scanner' removed)
  "camscanner", "camscanner ile tarandi", "scanned with camscanner", "scanned by camscanner",
  "adobe scan", "tapscanner", "fast scanner", "simple scanner",
  // English & international indicators (standalone 'secret', 'private', 'copy', 'test' removed)
  "draft", "preliminary draft", "working draft",
  "confidential", "strictly confidential", "top secret", "restricted", "private and confidential", "privileged",
  "do not copy", "duplicate", "replica", "reproduction",
  "void", "invalid", "cancelled", "canceled", "null and void", "expired",
  "sample", "specimen", "evaluation copy", "trial version", "preview", "demo",
  "unofficial", "not for official use", "for review only", "for review", "for internal use only", "internal use only",
  "watermark", "watermarked", "copyright", "all rights reserved",
  "wondershare", "pdfelement", "smallpdf", "ilovepdf", "foxit", "nitro",
  // Template & stock watermarks (standalone 'stock' removed)
  "se9nse", "sense", "template", "shutterstock", "getty", "istock", "envato", "freepik"
];

export function analyzeWatermarkColor(colorHex?: string): {
  isFaint: boolean;
  isRedStamp: boolean;
  isBlueStamp: boolean;
  isWatermarkColor: boolean;
  score: number;
  label?: string;
} {
  if (!colorHex || !colorHex.startsWith("#")) {
    return { isFaint: false, isRedStamp: false, isBlueStamp: false, isWatermarkColor: false, score: 0 };
  }

  const clean = colorHex.replace("#", "");
  const r = parseInt(clean.substring(0, 2) || "0", 16);
  const g = parseInt(clean.substring(2, 4) || "0", 16);
  const b = parseInt(clean.substring(4, 6) || "0", 16);

  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  const maxDiff = Math.max(Math.abs(r - g), Math.abs(r - b), Math.abs(g - b));
  const isNeutral = maxDiff < 35;

  // 1. Faint / Light Gray (Watermark tone: lum between 115 and 245)
  if (isNeutral && lum >= 115 && lum <= 245) {
    return {
      isFaint: true,
      isRedStamp: false,
      isBlueStamp: false,
      isWatermarkColor: true,
      score: lum >= 140 ? 55 : 40,
      label: `Açık gri filigran tonu (${colorHex})`
    };
  }

  // 2. Red / Pink / Orange Stamp / Watermark
  if (r > 135 && (r - g >= 30) && (r - b >= 30)) {
    return {
      isFaint: false,
      isRedStamp: true,
      isBlueStamp: false,
      isWatermarkColor: true,
      score: 50,
      label: `Kırmızı/pembe damga rengi (${colorHex})`
    };
  }

  // 3. Blue / Cyan Stamp
  if (b > 135 && (b - r >= 25)) {
    return {
      isFaint: false,
      isRedStamp: false,
      isBlueStamp: true,
      isWatermarkColor: true,
      score: 40,
      label: `Mavi mühür rengi (${colorHex})`
    };
  }

  return { isFaint: false, isRedStamp: false, isBlueStamp: false, isWatermarkColor: false, score: 0 };
}

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

export function matchesWatermarkKeyword(normText: string, normSpaceless: string, kw: string): boolean {
  const kwNorm = normalizeTurkish(kw);
  const kwSpaceless = kwNorm.replace(/\s+/g, "");

  // 1. Direct multi-word phrase match (e.g. "gecersiz belge", "belge simulasyonudur")
  if (kwNorm.includes(" ") && normText.includes(kwNorm)) {
    return true;
  }

  // 2. Word-boundary regex match for single words (e.g. "gizli" matches "gizli", but NOT "gizlilik")
  const wordBoundary = new RegExp(`(?:^|[^a-z0-9])${kwNorm}(?:[^a-z0-9]|$)`, "i");
  if (wordBoundary.test(normText)) {
    return true;
  }

  // 3. Spaced letters match: e.g. "G E C E R S I Z", "T A S L A K", "O R N E K"
  if (kwSpaceless.length >= 4) {
    const spacedPattern = kwSpaceless.split("").join("\\s+");
    const spacedRegex = new RegExp(`(?:^|[^a-z0-9])${spacedPattern}(?:[^a-z0-9]|$)`, "i");
    if (spacedRegex.test(normText)) {
      return true;
    }
    // Also if the text consists predominantly of the spaceless keyword
    if (normSpaceless === kwSpaceless || (normSpaceless.includes(kwSpaceless) && normSpaceless.length <= kwSpaceless.length + 4)) {
      return true;
    }
  }

  return false;
}

export async function detectWatermarks(
  pdfBytes: Uint8Array,
  pageScope: "all" | "current" = "all",
  currentPage = 0
): Promise<WatermarkCandidate[]> {
  const candidates: WatermarkCandidate[] = [];
  let doc: any = null;

  try {
    doc = await loadPdf(pdfBytes);
    const numPages = doc.numPages;

    const pagesToScan: number[] = [];
    if (pageScope === "current") {
      pagesToScan.push(currentPage);
    } else {
      for (let i = 0; i < numPages; i++) pagesToScan.push(i);
    }

    // 1. Extract all text and image items per page
    const allPageTexts: { page: number; items: EditableText[] }[] = [];
    const allPageImages: { page: number; images: any[] }[] = [];
    for (const pIdx of pagesToScan) {
      if (pIdx < 0 || pIdx >= numPages) continue;
      try {
        const page = await doc.getPage(pIdx + 1);
        const [items, imgs] = await Promise.all([
          editablePageText(page).catch(() => []),
          detectImagesOnPage(page, pIdx).catch(() => [])
        ]);
        allPageTexts.push({ page: pIdx, items });
        allPageImages.push({ page: pIdx, images: imgs });
      } catch (err) {
        console.warn(`Could not read page ${pIdx}:`, err);
      }
    }

    // 2. Group texts across pages
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

      // Track item IDs that belong to multi-item reconstructed lines to prevent duplicate single-word candidates
      const itemsInMultiItemLines = new Set<string>();
      for (const line of lines) {
        if (line.items && line.items.length > 1) {
          for (const it of line.items) {
            itemsInMultiItemLines.add(it.id);
          }
        }
      }

      // 1. Process reconstructed lines
      for (const line of lines) {
        const str = line.text?.trim();
        if (!str || str.length < 2) continue;
        const norm = normalizeTurkish(str);
        if (!norm) continue;

        const normSpaceless = norm.replace(/\s+/g, "");
        const matched = WATERMARK_KEYWORDS.filter((kw) => matchesWatermarkKeyword(norm, normSpaceless, kw));

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

      // 2. Also check individual items directly to ensure isolated words are never missed
      for (const item of items) {
        if (itemsInMultiItemLines.has(item.id)) continue;
        const str = item.text?.trim();
        if (!str || str.length < 3) continue;
        const norm = normalizeTurkish(str);
        if (!norm) continue;

        const normSpaceless = norm.replace(/\s+/g, "");
        const matched = WATERMARK_KEYWORDS.filter((kw) => matchesWatermarkKeyword(norm, normSpaceless, kw));

        if (matched.length > 0 && !textGroups.has(norm)) {
          textGroups.set(norm, {
            rawText: str,
            lines: [{
              page,
              text: str,
              items: [item],
              angle: item.angle || 0,
              size: item.size || 12,
              color: item.color || "#222222"
            }],
            pages: new Set([page]),
            angles: [item.angle || 0],
            fontSizes: [item.size || 12],
            colors: new Set([item.color || "#222222"]),
            matchedKeywords: matched
          });
        }
      }
    }

    // 3. Score and identify text watermark candidates
    let candidateIndex = 1;
    for (const [normKey, group] of textGroups.entries()) {
      const pageCount = group.pages.size;
      const avgFontSize = group.fontSizes.reduce((a, b) => a + b, 0) / group.fontSizes.length;
      const hasDiagonal = group.angles.some((a) => {
        const absA = Math.abs(a % 180);
        return (absA >= 10 && absA <= 80) || (absA >= 100 && absA <= 170);
      });

      // Analyze colors in the group
      let bestColor = { isWatermarkColor: false, score: 0, label: "" };
      for (const col of group.colors) {
        const a = analyzeWatermarkColor(col);
        if (a.score > bestColor.score) {
          bestColor = { isWatermarkColor: a.isWatermarkColor, score: a.score, label: a.label || "" };
        }
      }

      const matchedKw = group.matchedKeywords;
      const keywordMatched = matchedKw.length > 0;
      const repeatsOnMultiplePages = numPages > 1 && (pageCount >= 2 || pageCount / numPages >= 0.5);
      
      // Repeating lines on the SAME page (e.g. tile pattern watermark: 2+ lines on one page)
      const maxLinesOnOnePage = Math.max(...Array.from(group.pages).map(p => group.lines.filter(l => l.page === p).length), 0);
      const isTilePattern = maxLinesOnOnePage >= 2;

      const isLargeFont = avgFontSize >= 22;
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

      // Diagonal placement is an exceptionally strong watermark signal in documents
      if (hasDiagonal) {
        confidence += 60;
        reasons.push(`Çapraz/açılı yerleşim (${Math.round(group.angles[0] || 45)}°)`);
      }

      // Distinct watermark / stamp color (light gray, red stamp, blue stamp)
      if (bestColor.isWatermarkColor) {
        confidence += bestColor.score;
        if (bestColor.label) reasons.push(bestColor.label);
      }

      // Tile pattern on same page
      if (isTilePattern) {
        confidence += 40;
        reasons.push(`Sayfada tekrarlayan desen (${maxLinesOnOnePage} kez)`);
      }

      if (repeatsOnMultiplePages) {
        confidence += 40;
        reasons.push(`${pageCount} sayfada tekrarlandı`);
      }

      if (isLargeFont) {
        confidence += avgFontSize >= 32 ? 30 : 20;
        reasons.push(`Büyük yazı boyutu (${Math.round(avgFontSize)}pt)`);
      }

      if (isRepeatedHeaderFooter) {
        confidence += 25;
        reasons.push("Tekrarlayan alt/üst bilgi");
      }

      // CRITICAL CONTENT PROTECTION SAFEGUARDS:
      // Real contract clauses, articles, headers, and regular sentences must NEVER be flagged as watermarks!
      const isContractClause = /^(?:madde|article|fıkra|fikra|bent|bentler|bölüm|bolum|kısım|kisim|ek|taraflar|konu|amaç|amac|hükümler|hukumler|sozlesme|protokol)\s*\d*[:.]?/i.test(normKey);
      const wordCount = normKey.split(/\s+/).filter(Boolean).length;
      const isNormalHorizontalText = !hasDiagonal && avgFontSize <= 16;

      // 1. A contract clause (e.g. "Madde 1: ...", "Madde 4: Gizlilik...") is 100% immune from being flagged as a watermark!
      if (isContractClause && isNormalHorizontalText) {
        continue;
      }

      // 2. Regular horizontal sentences with 4+ words that are not explicitly a multi-word watermark phrase
      // (e.g. "BU BELGE GECERSIZDIR", "ORNEK BELGE SIMULASYONUDUR", "SCANNED WITH CAMSCANNER")
      if (wordCount >= 4 && isNormalHorizontalText) {
        const isExplicitWatermarkPhrase = WATERMARK_KEYWORDS.some(kw => {
          const kwWords = kw.split(/\s+/).length;
          return (kwWords >= 2 && normKey.includes(kw)) || normKey === kw;
        });
        if (!isExplicitWatermarkPhrase && !isRepeatedHeaderFooter) {
          continue;
        }
      }

      // SAFETY REQUIREMENT: At least TWO independent signals required for watermark candidate
      // 1. Repetition across multiple pages or tile pattern on same page
      // 2. Significant diagonal angle (>= 10 deg)
      // 3. Large font size (>= 22pt)
      // 4. Faint/light watermark tone or distinctive stamp color
      // 5. Strong multi-word watermark phrase or strong unambiguous watermark indicator
      let signalCount = 0;
      if (repeatsOnMultiplePages || isTilePattern) signalCount++;
      if (hasDiagonal) signalCount++;
      if (isLargeFont) signalCount++;
      if (bestColor.isWatermarkColor) signalCount++;
      const isStrongMultiWordPhrase = matchedKw.some(kw => kw.includes(" ") || ["gecersizdir", "hukumsuzdur", "taslaktir", "ornektir", "confidential", "filigran", "watermark"].includes(kw));
      if (isStrongMultiWordPhrase) signalCount++;

      // A single keyword alone without other physical watermark attributes CANNOT condemn text!
      if (signalCount < 2) {
        continue;
      }

      // Candidate accepted: collect all constituent text removals from lines
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
          confidence: Math.min(99, Math.max(confidence, keywordMatched ? 95 : 75)),
          textRemovals: removals,
          // CRITICAL: imageBounds is undefined for vector text candidates!
          // PDFium removePdfText removes glyphs at the byte level with ZERO opaque rectangles.
          imageBounds: undefined
        });
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
      const img = group.firstImg;
      const isFullPageScan = (img.w >= 500 && img.h >= 700); // Exclude full document page scans
      
      if (!isFullPageScan && (pageCount >= 2 || (pageCount === 1 && img.isWatermark))) {
        const nameLower = (img.name || "").toLowerCase();
        const hasWatermarkKeyword = /watermark|filigran|taslak|draft|sample|kopya|void|canc|geçersiz/i.test(nameLower);
        const isFaintOpacity = typeof img.opacity === "number" && img.opacity > 0 && img.opacity < 0.45;
        const isLargeCentered = img.w > 260 && img.h > 260 && img.x > 80 && img.y > 150;
        const isDefiniteWatermark = img.isWatermark || hasWatermarkKeyword || isFaintOpacity || isLargeCentered;

        // Position & size check for corporate logos, school crests, letterheads, or signatures
        const isHeaderOrFooter = (img.y <= 135 || (img.y + img.h) >= 680) && img.w <= 300 && img.h <= 150;
        const isLogoOrHeader = !isDefiniteWatermark && (isHeaderOrFooter || /logo|antet|crest|imza|sign|amblem|brand/i.test(nameLower) || pageCount >= 2);

        // Confidence must NOT be high purely based on page repetition!
        let confidence = 25;
        let candidateText = img.name || (isLogoOrHeader ? "Kurumsal Logo / Antet" : "Tekrarlayan Görsel");
        let candidateReason = `${pageCount} sayfada aynı konumda tekrarlanan görsel`;

        if (isDefiniteWatermark) {
          confidence = hasWatermarkKeyword ? 90 : isFaintOpacity ? 80 : 70;
          candidateText = img.name || "Görsel Filigran / Damga";
          candidateReason = hasWatermarkKeyword
            ? `Filigran anahtar kelimesi tespit edilen görsel (${img.name})`
            : isFaintOpacity
            ? `Saydam/soluk arka plan filigran görseli`
            : `Büyük boyutlu merkezi filigran görseli`;
        } else if (isLogoOrHeader) {
          confidence = 25; // Strict low confidence: Repetition alone must NOT generate high confidence!
          candidateReason = `${pageCount} sayfada tekrarlanan kurumsal logo/antet (Silinmesi önerilmez)`;
        }

        candidates.push({
          id: `wm-img-${candidateIndex++}`,
          type: "image",
          text: candidateText,
          count: group.removals.length,
          pages: Array.from(group.pages).sort((a, b) => a - b),
          imageBounds: { x: img.x, y: img.y, w: img.w, h: img.h },
          imagePreviewUrl: img.previewUrl || img.dataUrl,
          reason: candidateReason,
          confidence,
          isLogoOrHeader,
          strategy: isDefiniteWatermark && (isFaintOpacity || hasWatermarkKeyword) ? "pixel_clean" : "object_remove",
          imageRemovals: group.removals
        });
      }
    }

    // 4b. PDF /Watermark and exact watermark /Stamp annotation detection
    try {
      const pdfLibDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
      const pages = pdfLibDoc.getPages();
      for (let pIdx = 0; pIdx < pages.length; pIdx++) {
        const page = pages[pIdx];
        const annots = page.node.Annots();
        if (!annots) continue;
        const count = annots.size();
        for (let j = 0; j < count; j++) {
          const annotRef = annots.get(j);
          const annotObj = pdfLibDoc.context.lookup(annotRef) as any;
          if (!annotObj) continue;
          const subtype = annotObj.get?.("Subtype")?.toString();
          const contents = annotObj.get?.("Contents")?.toString() || "";
          const name = annotObj.get?.("NM")?.toString() || "";
          const normContents = normalizeTurkish(contents).trim().toLowerCase();
          const normName = normalizeTurkish(name).trim().toLowerCase();

          const isWatermarkSubtype = subtype === "/Watermark";
          const isExactWatermarkWord = ["draft", "taslak", "void", "watermark", "sample", "kopya"].includes(normContents) ||
            ["draft", "taslak", "void", "watermark", "sample", "kopya"].includes(normName);

          if (isWatermarkSubtype || (subtype === "/Stamp" && isExactWatermarkWord)) {
            candidates.push({
              id: `wm-annot-${candidateIndex++}`,
              type: "annotation",
              text: contents || name || "Filigran Ek Açıklaması",
              count: 1,
              pages: [pIdx],
              reason: isWatermarkSubtype ? "PDF /Watermark ek açıklaması" : "Filigran damgası (/Stamp)",
              confidence: 90
            });
          }
        }
      }
    } catch {}

    // 4. If no vector text or image watermark candidates found, run local Visual OCR detector
    if (candidates.length === 0 && (typeof window !== "undefined" || process.env.ENABLE_NODE_VISUAL_OCR === "1")) {
      try {
        const { detectVisualWatermarks } = await import("./visualWatermarkDetector");
        const scanPages = pagesToScan.slice(0, 3);
        for (const pageIdx of scanPages) {
          const visualCands = await detectVisualWatermarks(pdfBytes, pageIdx);
          if (visualCands && visualCands.length > 0) {
            candidates.push(...visualCands);
          }
        }
      } catch (visErr) {
        console.warn("Visual watermark detection fallback error:", visErr);
      }
    }

    // Sort by confidence descending
    candidates.sort((a, b) => b.confidence - a.confidence);

  } finally {
    if (doc?.loadingTask) {
      try { await doc.loadingTask.destroy(); } catch {}
    }
  }

  return candidates;
}
