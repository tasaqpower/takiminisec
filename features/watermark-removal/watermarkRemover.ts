import { removePdfText, removePdfTextObjects, removePdfRasterWatermarks, removePdfImages, editablePageText, type TextRemoval, type ImageRemoval } from "../../lib/pdf-text.ts";
import { loadPdf } from "../../lib/documents.ts";
import { PDFDocument, rgb } from "pdf-lib";
import { normalizeTurkish, reconstructPageLines } from "./watermarkDetector.ts";
import { findVisualTextBounds } from "./visualWatermarkDetector.ts";
import type {
  WatermarkCandidate,
  WatermarkRemovalOptions,
  CandidateRemovalResult
} from "./watermarkTypes.ts";

export interface WatermarkRemovalResult {
  pdfBytes: Uint8Array;
  removedTextCount: number;
  removedImageCount: number;
  removedAnnotationCount: number;
  removedCoverCount?: number;
  totalRemoved: number;
  strategyUsed?: string;
  candidateResults?: CandidateRemovalResult[];
}

/**
 * Safely filters watermark candidates for 1-click automatic clean.
 * STRICT SAFETY RULES (V7):
 *  1. ONLY processes type === "text" or safe type === "annotation".
 *  2. NEVER processes type === "image" automatically.
 *  3. NEVER processes isLogoOrHeader === true candidates.
 *  4. Only selects candidates meeting or exceeding confidence threshold (>= 45%).
 *  5. Any image, logo, header, crest, signature, or repeating corporate graphic
 *     strictly requires explicit manual user selection.
 */
export function buildSafeAutoCleanCandidateIds(candidates: WatermarkCandidate[]): string[] {
  if (!Array.isArray(candidates) || candidates.length === 0) return [];
  return candidates
    .filter((c) => {
      if (c.type === "image") return false;
      if (c.isLogoOrHeader) return false;
      if (c.type !== "text" && c.type !== "annotation") return false;
      const conf = typeof c.confidence === "number" ? c.confidence : 0;
      return conf >= 45;
    })
    .map((c) => c.id);
}

export async function removeWatermarks(
  pdfBytes: Uint8Array,
  allCandidates: WatermarkCandidate[],
  options: WatermarkRemovalOptions
): Promise<WatermarkRemovalResult> {
  let currentBytes = pdfBytes;
  let removedTextCount = 0;
  let removedImageCount = 0;
  let removedAnnotationCount = 0;

  const targetPages = new Set<number>();
  const doc = await loadPdf(pdfBytes);
  const totalPages = doc.numPages;

  if (options.pageScope === "current") {
    targetPages.add(options.currentPage);
  } else if (options.pageScope === "custom" && options.customPages) {
    options.customPages.forEach(p => targetPages.add(p));
  } else {
    for (let i = 0; i < totalPages; i++) targetPages.add(i);
  }

  const selectedSet = new Set(options.candidateIds);
  const candidateResults: CandidateRemovalResult[] = [];

  // 1a. Surgical Object-Level Watermark Removal via PDFium
  // Removes entire watermark text objects directly from the PDF stream without altering
  // or redacting any adjacent or overlapping legitimate contract text!
  // ONLY targets selected candidate texts. WATERMARK_KEYWORDS is strictly NOT used during removal!
  const candidateItems = allCandidates
    .filter(c => selectedSet.has(c.id) && c.type === "text" && c.text)
    .map(c => ({ id: c.id, text: c.text as string }));
  const candidateTexts = candidateItems.map(c => c.text);

  if (options.customText?.trim()) {
    candidateTexts.push(options.customText.trim());
  }

  let objectRemovalCount = 0;
  if (candidateTexts.length > 0) {
    try {
      const objResult = await removePdfTextObjects(currentBytes, {
        candidateTexts,
        candidateItems,
        targetPages: Array.from(targetPages)
      });
      if (objResult.removedCount > 0) {
        currentBytes = objResult.bytes;
        objectRemovalCount = objResult.removedCount;
        removedTextCount += objResult.removedCount;
        if (objResult.removedCandidateIds && objResult.removedCandidateIds.length > 0) {
          for (const remId of objResult.removedCandidateIds) {
            candidateResults.push({
              candidateId: remId,
              status: "removed",
              strategy: "text_object_stream"
            });
          }
        } else {
          for (const item of candidateItems) {
            candidateResults.push({
              candidateId: item.id,
              status: "removed",
              strategy: "text_object_stream"
            });
          }
        }
      }
    } catch (objErr) {
      console.warn("Object-level watermark removal warning:", objErr);
    }
  }

  // 1a2. Surgical Raster / Scanned Image Watermark Eradication via PDFium
  // STRICT SINGLE-STRATEGY ENFORCEMENT:
  // An image watermark candidate is processed with EXACTLY ONE cleaning strategy.
  // 1) If candidate specifies "object_remove" or options.imageStrategy === "object_remove",
  //    pixel cleaning is SKIPPED and it is queued for removePdfImages.
  // 2) Otherwise, pixel inpainting (removePdfRasterWatermarks) is executed.
  //    If pixel inpainting succeeds, the candidate is marked as CLEANED and will NEVER be passed
  //    to removePdfImages, and will NEVER receive an opaque rectangle cover.
  const pixelCleanCandidates = allCandidates
    .filter(c => {
      if (!selectedSet.has(c.id) || c.type !== "image") return false;
      const isObjectRemove = options.imageStrategy === "object_remove" || c.strategy === "object_remove";
      const isManualCover = c.strategy === "manual_cover";
      return !isObjectRemove && !isManualCover;
    })
    .flatMap(c => {
      if (c.imageRemovals && c.imageRemovals.length > 0) {
        return c.imageRemovals.map(rem => ({
          id: c.id,
          page: rem.page,
          imageIndex: rem.imageIndex,
          bounds: c.imageBounds,
          pixelWidth: rem.pixelWidth,
          pixelHeight: rem.pixelHeight,
          matrix: rem.matrix
        }));
      }
      return c.pages.map(p => ({
        id: c.id,
        page: p,
        bounds: c.imageBounds
      }));
    });

  const cleanedImageCandidateIds = new Set<string>();
  let rasterRemovalCount = 0;
  if (pixelCleanCandidates.length > 0) {
    try {
      const rasterResult = await removePdfRasterWatermarks(currentBytes, {
        targetPages: Array.from(targetPages),
        fillColor: options.fillColor,
        candidates: pixelCleanCandidates
      });
      if (rasterResult.removedCount > 0) {
        currentBytes = rasterResult.bytes;
        rasterRemovalCount = rasterResult.removedCount;
        removedImageCount += rasterResult.removedCount;
      }
      if (rasterResult.successfulCandidateIds) {
        rasterResult.successfulCandidateIds.forEach((id) => cleanedImageCandidateIds.add(id));
      }
      if (rasterResult.candidateResults) {
        rasterResult.candidateResults.forEach((cr) => {
          if (cr.id) {
            candidateResults.push({
              candidateId: cr.id,
              status: cr.status,
              strategy: cr.status === "removed" ? "pixel_inpainting" : "none",
              modifiedPixels: cr.modifiedPixels,
              reason: cr.reason
            });
          }
        });
      }
    } catch (rasterErr) {
      console.warn("Raster watermark removal warning:", rasterErr);
    }
  }

  // 1b. Collect candidate removals
  const textRemovals: TextRemoval[] = [];
  const imageRemovals: ImageRemoval[] = [];

  for (const cand of allCandidates) {
    if (!selectedSet.has(cand.id)) continue;

    if (cand.type === "text" && cand.textRemovals) {
      for (const rem of cand.textRemovals) {
        if (targetPages.has(rem.page)) {
          textRemovals.push(rem);
        }
      }
    } else if (cand.type === "image" && cand.imageRemovals) {
      // CRITICAL SINGLE-STRATEGY:
      // If this image candidate was ALREADY cleaned via pixel inpainting, NEVER add it to imageRemovals!
      // Doing so would delete the entire image object that was just cleaned.
      if (cleanedImageCandidateIds.has(cand.id)) {
        continue;
      }
      for (const rem of cand.imageRemovals) {
        if (targetPages.has(rem.page)) {
          imageRemovals.push(rem);
        }
      }
    }
  }

  // 2. Custom text removal across targeted pages
  if (options.customText && options.customText.trim().length > 0) {
    const searchRaw = options.customText.trim();
    const searchNorm = normalizeTurkish(searchRaw);
    const searchWords = searchNorm.split(" ").filter(w => w.length > 0);

    for (const pageIdx of targetPages) {
      if (pageIdx < 0 || pageIdx >= totalPages) continue;
      try {
        const page = await doc.getPage(pageIdx + 1);
        const pageTexts = await editablePageText(page);
        const matchedItemIds = new Set<string>();

        // 2a. Line-level matching (only for multi-word phrases or exact full-line matches)
        const lines = reconstructPageLines(pageTexts);
        for (const line of lines) {
          const lineRaw = line.text.trim();
          const lineNorm = normalizeTurkish(lineRaw).trim();

          const isMatch = searchWords.length === 1
            ? (options.customCaseSensitive ? lineRaw === searchRaw.trim() : lineNorm === searchNorm)
            : (options.customCaseSensitive ? lineRaw.includes(searchRaw) : (lineRaw.toLowerCase().includes(searchRaw.toLowerCase()) || lineNorm.includes(searchNorm)));

          if (isMatch) {
            for (const it of line.items) {
              matchedItemIds.add(it.id);
              textRemovals.push({
                id: it.id,
                page: pageIdx,
                quad: it.quad
              });
            }
          }
        }

        // 2b. Individual item matching (single words require exact isolated token match to protect sentences)
        for (const item of pageTexts) {
          if (matchedItemIds.has(item.id)) continue;
          const itemRaw = (item.text || "").trim();
          const itemNorm = normalizeTurkish(itemRaw).trim();

          const isMatch = searchWords.length === 1
            ? (options.customCaseSensitive ? itemRaw === searchRaw.trim() : (itemNorm === searchNorm || itemRaw.toLowerCase() === searchRaw.toLowerCase().trim()))
            : (options.customCaseSensitive ? itemRaw.includes(searchRaw) : (itemRaw.toLowerCase().includes(searchRaw.toLowerCase()) || itemNorm.includes(searchNorm)));

          if (isMatch) {
            matchedItemIds.add(item.id);
            textRemovals.push({
              id: item.id,
              page: pageIdx,
              quad: item.quad
            });
          }
        }

        // 2c. Sliding window token matching (for multi-word phrases spanning disjoint items)
        if (searchWords.length > 1) {
          for (let i = 0; i < pageTexts.length; i++) {
            const windowItems: typeof pageTexts = [];
            for (let j = i; j < Math.min(pageTexts.length, i + 12); j++) {
              windowItems.push(pageTexts[j]);
              const combinedNorm = normalizeTurkish(windowItems.map(w => w.text).join(" "));
              if (combinedNorm.includes(searchNorm)) {
                for (const itm of windowItems) {
                  if (!matchedItemIds.has(itm.id)) {
                    matchedItemIds.add(itm.id);
                    textRemovals.push({
                      id: itm.id,
                      page: pageIdx,
                      quad: itm.quad
                    });
                  }
                }
                break;
              }
            }
          }
        }
      } catch {}
    }
  }

  // 2d. Check if manualBoxes enclose any vector text on the page
  if (options.manualBoxes && options.manualBoxes.length > 0) {
    for (const pageIdx of targetPages) {
      if (pageIdx < 0 || pageIdx >= totalPages) continue;
      try {
        const page = await doc.getPage(pageIdx + 1);
        const pageTexts = await editablePageText(page);
        for (const box of options.manualBoxes) {
          for (const item of pageTexts) {
            const cx = item.x + item.w / 2;
            const cy = item.y + item.h / 2;
            if (cx >= box.x && cx <= box.x + box.w && cy >= box.y && cy <= box.y + box.h) {
              textRemovals.push({
                id: item.id,
                page: pageIdx,
                quad: item.quad
              });
              (box as any).hasVectorText = true;
            }
          }
        }
      } catch {}
    }
  }

  // Visual text search fallback for scanned / image pages
  const visualCoverBounds: { page: number; x: number; y: number; w: number; h: number }[] = [];
  if (options.customText && options.customText.trim().length > 0 && textRemovals.length === 0 && typeof window !== "undefined") {
    try {
      for (const pageIdx of targetPages) {
        const vBounds = await findVisualTextBounds(currentBytes, pageIdx, options.customText);
        for (const b of vBounds) {
          visualCoverBounds.push({ page: pageIdx, ...b });
        }
      }
    } catch (visErr) {
      console.warn("Visual text search fallback error:", visErr);
    }
  }

  // 2e. Record bounding boxes of all protected (non-watermark) vector text to guarantee ZERO collateral damage
  const pageProtectedTextBounds = new Map<number, { x: number; y: number; w: number; h: number }[]>();
  for (const pageIdx of targetPages) {
    if (pageIdx < 0 || pageIdx >= totalPages) continue;
    try {
      const page = await doc.getPage(pageIdx + 1);
      const pageTexts = await editablePageText(page);
      const textRemovalIds = new Set(textRemovals.filter(r => r.page === pageIdx).map(r => r.id));
      const protectedList = pageTexts
        .filter(t => !textRemovalIds.has(t.id))
        .map(t => ({
          x: t.x,
          y: t.y,
          w: Math.max(t.w, (t.text?.length || 1) * (t.size || 12) * 0.5),
          h: Math.max(t.h, (t.size || 12) * 1.1)
        }));
      pageProtectedTextBounds.set(pageIdx, protectedList);
    } catch {}
  }

  // Clean up PDF.js doc instance
  try { await doc.loadingTask.destroy(); } catch {}

  // 3. Fallback Quad Text Removals (only if object-level removal did not find anything, or if explicit manualBoxes were drawn)
  if (textRemovals.length > 0 && (objectRemovalCount === 0 || (options.manualBoxes && options.manualBoxes.length > 0))) {
    // Deduplicate removals by page and quad
    const uniqueRemovals: TextRemoval[] = [];
    const seen = new Set<string>();

    for (const r of textRemovals) {
      const key = `${r.page}_${r.quad.map(q => Math.round(q)).join(",")}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueRemovals.push(r);
      }
    }

    try {
      currentBytes = await removePdfText(currentBytes, uniqueRemovals);
      removedTextCount = uniqueRemovals.length;
      for (const cand of allCandidates) {
        if (selectedSet.has(cand.id) && cand.type === "text" && cand.textRemovals && cand.textRemovals.length > 0) {
          const hadMatch = cand.textRemovals.some(r => targetPages.has(r.page));
          if (hadMatch) {
            candidateResults.push({
              candidateId: cand.id,
              status: "removed",
              strategy: "text_object_stream"
            });
          }
        }
      }
    } catch (err) {
      console.warn("Failed to remove some text watermarks via PDFium:", err);
    }
  }

  // 4. Apply Image Removals via PDFium WASM (ONLY for candidates designated for object_remove)
  if (imageRemovals.length > 0) {
    try {
      const res = await removePdfImages(currentBytes, imageRemovals);
      const actualCount = (res as any).removedCount !== undefined ? (res as any).removedCount : (res.length ? imageRemovals.length : 0);
      if (actualCount > 0) {
        currentBytes = (res as any).pdfBytes || (res as Uint8Array);
        removedImageCount += actualCount;
        for (const cand of allCandidates) {
          if (
            selectedSet.has(cand.id) &&
            cand.type === "image" &&
            !cleanedImageCandidateIds.has(cand.id)
          ) {
            candidateResults.push({
              candidateId: cand.id,
              status: "removed",
              strategy: "object_removal"
            });
          }
        }
      } else {
        for (const cand of allCandidates) {
          if (
            selectedSet.has(cand.id) &&
            cand.type === "image" &&
            !cleanedImageCandidateIds.has(cand.id) &&
            (cand.strategy === "object_remove" || options.imageStrategy === "object_remove")
          ) {
            candidateResults.push({
              candidateId: cand.id,
              status: "failed",
              strategy: "none",
              reason: "Görsel nesnesi PDFium tarafından silinemedi."
            });
          }
        }
      }
    } catch (err) {
      console.warn("Failed to remove some image watermarks via PDFium:", err);
    }
  }

  // 5. Check and remove PDF Annotation Watermarks via pdf-lib
  try {
    const pdfLibDoc = await PDFDocument.load(currentBytes, { ignoreEncryption: true });
    let annotsChanged = false;
    const pages = pdfLibDoc.getPages();

    for (let i = 0; i < pages.length; i++) {
      if (!targetPages.has(i)) continue;
      const page = pages[i];
      const annots = page.node.Annots();
      if (!annots) continue;

      const count = annots.size();
      const kept = [];
      for (let j = 0; j < count; j++) {
        const annotRef = annots.get(j);
        const annotObj = pdfLibDoc.context.lookup(annotRef) as any;
        if (!annotObj) continue;

        const subtype = annotObj.get?.("Subtype")?.toString();
        const contents = annotObj.get?.("Contents")?.toString() || "";
        const name = annotObj.get?.("NM")?.toString() || "";
        const normContents = normalizeTurkish(contents).trim().toLowerCase();
        const normName = normalizeTurkish(name).trim().toLowerCase();
        const searchNorm = options.customText ? normalizeTurkish(options.customText).trim().toLowerCase() : "";

        // STRICT: Only remove annotations tied to a confirmed, selected candidate ID or exact customText match!
        // NEVER use substring checks like includes("kopya") or includes("iptal") which wipe legitimate stamps!
        const selectedAnnotMatch = allCandidates.some(c => {
          if (!selectedSet.has(c.id) || c.type !== "annotation") return false;
          const cNorm = normalizeTurkish(c.text || "").trim().toLowerCase();
          return Boolean(cNorm && (normContents === cNorm || normName === cNorm));
        });

        const isExactCustomMatch = Boolean(searchNorm.length > 0 && (normContents === searchNorm || normName === searchNorm));

        const isWatermarkAnnot = selectedAnnotMatch || isExactCustomMatch;

        if (isWatermarkAnnot) {
          removedAnnotationCount++;
          annotsChanged = true;
          for (const c of allCandidates) {
            if (selectedSet.has(c.id) && c.type === "annotation") {
              const cNorm = normalizeTurkish(c.text || "").trim().toLowerCase();
              if (cNorm && (normContents === cNorm || normName === cNorm)) {
                candidateResults.push({
                  candidateId: c.id,
                  status: "removed",
                  strategy: "object_removal"
                });
              }
            }
          }
        } else {
          kept.push(annotRef);
        }
      }

      if (annotsChanged) {
        page.node.set(page.node.context.obj("Annots"), page.node.context.obj(kept));
      }
    }

    if (annotsChanged) {
      currentBytes = await pdfLibDoc.save();
    }
  } catch {}

  // 6. Apply Smart Background Covers for candidates with imageBounds, AI detections, manual boxes, brush masks, or custom text
  let removedCoverCount = 0;
  try {
    const pdfLibDoc = await PDFDocument.load(currentBytes, { ignoreEncryption: true });
    let coverDrawn = false;
    const pages = pdfLibDoc.getPages();

    // Determine fill color (custom sampled paper tone or pure white)
    const fillColor = options.fillColor
      ? rgb(options.fillColor.r, options.fillColor.g, options.fillColor.b)
      : rgb(1, 1, 1);

    // 6a. Detected candidate bounds - Strictly reject opaque covers for automated candidates or pages with vector text
    for (const cand of allCandidates) {
      if (!selectedSet.has(cand.id)) continue;
      const isAlreadyCleaned = cleanedImageCandidateIds.has(cand.id) || candidateResults.some(r => r.candidateId === cand.id && r.status === "removed");
      if (isAlreadyCleaned) continue;

      // Strict safety: Automated candidates (e.g. wm-vis-*) and non-manual candidates must NEVER receive opaque rectangle covers.
      // Opaque covers over document text cause catastrophic data loss.
      if (cand.id.startsWith("wm-vis-") || cand.strategy !== "manual_cover") {
        candidateResults.push({
          candidateId: cand.id,
          status: "failed",
          strategy: "none",
          reason: "Belge metinlerini ve düzenini korumak için otomatik örtüleme engellendi."
        });
        continue;
      }

      // Even for candidates explicitly marked manual_cover, strictly verify vector text absence and bounding box limits
      if (cand.imageBounds) {
        for (const pIdx of cand.pages) {
          if (targetPages.has(pIdx) && pIdx >= 0 && pIdx < pages.length) {
            const page = pages[pIdx];
            const pW = page.getWidth();
            const pH = page.getHeight();

            // Absolute ban if vector text exists on the page
            const protectedBoxes = pageProtectedTextBounds.get(pIdx) || [];
            if (protectedBoxes.length > 0) {
              candidateResults.push({
                candidateId: cand.id,
                status: "failed",
                strategy: "none",
                reason: "Sayfadaki vektörel metinleri korumak için örtüleme engellendi."
              });
              continue;
            }

            // Size safeguard: never cover more than 35% width or 25% height
            if (cand.imageBounds.w > pW * 0.35 || cand.imageBounds.h > pH * 0.25) {
              candidateResults.push({
                candidateId: cand.id,
                status: "failed",
                strategy: "none",
                reason: "Örtüleme alanı çok geniş olduğu için güvenlik gereği iptal edildi."
              });
              continue;
            }

            page.drawRectangle({
              x: Math.max(0, cand.imageBounds.x - 2),
              y: Math.max(0, cand.imageBounds.y - 2),
              width: cand.imageBounds.w + 4,
              height: cand.imageBounds.h + 4,
              color: fillColor,
              opacity: 1
            });
            coverDrawn = true;
            removedCoverCount++;
            candidateResults.push({
              candidateId: cand.id,
              status: "removed",
              strategy: "manual_cover"
            });
          }
        }
      }
    }

    // 6b. Multi-box manual selection areas
    // ONLY draw rectangle if the box did NOT match vector text (i.e. it is covering a raster image/stamp)
    if (options.manualBoxes && options.manualBoxes.length > 0) {
      for (const box of options.manualBoxes) {
        if ((box as any).hasVectorText) {
          // Vector text was already surgically removed by PDFium WASM! Do NOT draw opaque cover!
          continue;
        }
        for (const pIdx of targetPages) {
          if (pIdx >= 0 && pIdx < pages.length) {
            const page = pages[pIdx];
            page.drawRectangle({
              x: Math.max(0, box.x - 2),
              y: Math.max(0, box.y - 2),
              width: box.w + 4,
              height: box.h + 4,
              color: fillColor,
              opacity: 1
            });
            coverDrawn = true;
            removedCoverCount++;
          }
        }
      }
    }

    // 6c. Freehand Magic Brush mask
    if (options.brushMaskDataUrl) {
      try {
        const base64Data = options.brushMaskDataUrl.replace(/^data:image\/\w+;base64,/, "");
        const binaryStr = atob(base64Data);
        const maskBytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          maskBytes[i] = binaryStr.charCodeAt(i);
        }
        const embeddedMask = await pdfLibDoc.embedPng(maskBytes);
        for (const pIdx of targetPages) {
          if (pIdx >= 0 && pIdx < pages.length) {
            const page = pages[pIdx];
            const { width: pW, height: pH } = page.getSize();
            page.drawImage(embeddedMask, {
              x: 0,
              y: 0,
              width: pW,
              height: pH
            });
            coverDrawn = true;
            removedCoverCount++;
          }
        }
      } catch (brushErr) {
        console.warn("Brush mask embedding error:", brushErr);
      }
    }

    // 6e. Visual search bounds found via OCR
    for (const vb of visualCoverBounds) {
      if (targetPages.has(vb.page) && vb.page >= 0 && vb.page < pages.length) {
        const page = pages[vb.page];
        page.drawRectangle({
          x: Math.max(0, vb.x - 2),
          y: Math.max(0, vb.y - 2),
          width: vb.w + 4,
          height: vb.h + 4,
          color: fillColor,
          opacity: 1
        });
        coverDrawn = true;
        removedCoverCount++;
      }
    }

    if (coverDrawn) {
      currentBytes = await pdfLibDoc.save();
    }
  } catch (err) {
    console.warn("Cover application error:", err);
  }

  // 1. Candidate IDs requested in options that do not exist in allCandidates -> not-found
  const allCandidateIdSet = new Set(allCandidates.map(c => c.id));
  for (const id of options.candidateIds) {
    if (!allCandidateIdSet.has(id)) {
      candidateResults.push({
        candidateId: id,
        status: "not-found",
        strategy: "none",
        reason: "Aday belgede bulunamadı."
      });
    }
  }

  // 2. Protected logo/letterhead candidates without explicit user confirmation -> blocked
  for (const cand of allCandidates) {
    if (selectedSet.has(cand.id) && cand.isLogoOrHeader && !options.allowLogoRemoval) {
      candidateResults.push({
        candidateId: cand.id,
        status: "blocked",
        strategy: "none",
        reason: "Bu öğe logo, antet veya belge görseli olabilir. Onay verilmediği için işlem engellendi."
      });
    }
  }

  // 3. Fill missing results for any selected candidates that were evaluated but not removed
  const existingHandledIds = new Set(candidateResults.map(r => r.candidateId));
  for (const cand of allCandidates) {
    if (selectedSet.has(cand.id) && !existingHandledIds.has(cand.id)) {
      if (cand.type === "text") {
        candidateResults.push({
          candidateId: cand.id,
          status: "unchanged",
          strategy: "none",
          reason: "Belgede eşleşen metin nesnesi bulunamadı veya değiştirilmedi."
        });
      } else if (cand.type === "annotation") {
        candidateResults.push({
          candidateId: cand.id,
          status: "unchanged",
          strategy: "none",
          reason: "Anotasyon eşleşmesi bulunamadı veya değiştirilmedi."
        });
      } else if (cand.type === "image") {
        candidateResults.push({
          candidateId: cand.id,
          status: "unchanged",
          strategy: "none",
          reason: "Görsel nesnesi bulunamadı veya değiştirilmedi."
        });
      }
    }
  }

  // Deduplicate candidate results: keep the most definitive status per candidate
  // Rank: removed (6) > blocked (5) > failed (4) > not-found (3) > unchanged (2) > skipped (1)
  const statusRank: Record<string, number> = {
    removed: 6,
    blocked: 5,
    failed: 4,
    "not-found": 3,
    unchanged: 2,
    skipped: 1
  };

  const candidateResultMap = new Map<string, CandidateRemovalResult>();
  for (const cr of candidateResults) {
    const existing = candidateResultMap.get(cr.candidateId);
    if (!existing) {
      candidateResultMap.set(cr.candidateId, cr);
    } else {
      const existingRank = statusRank[existing.status] || 0;
      const currentRank = statusRank[cr.status] || 0;
      if (currentRank > existingRank) {
        candidateResultMap.set(cr.candidateId, cr);
      }
    }
  }
  const finalCandidateResults = Array.from(candidateResultMap.values());

  const removedCandidates = finalCandidateResults.filter(r => r.status === "removed");
  const actualObjectRemovalCount = removedTextCount + removedImageCount + removedAnnotationCount + (removedCoverCount || 0);
  const totalRemoved = Math.max(
    removedCandidates.length + (options.manualBoxes?.length || 0),
    actualObjectRemovalCount
  );

  if (totalRemoved === 0) {
    return {
      pdfBytes, // Return original input untouched (0 byte changes)
      removedTextCount: 0,
      removedImageCount: 0,
      removedAnnotationCount: 0,
      removedCoverCount: 0,
      totalRemoved: 0,
      strategyUsed: "none",
      candidateResults: finalCandidateResults
    };
  }

  const strategies: string[] = [];
  if (removedTextCount > 0) strategies.push("text_object_stream");
  if (rasterRemovalCount > 0) strategies.push("pixel_inpainting");
  if (removedImageCount > rasterRemovalCount) strategies.push("object_removal");
  if (removedAnnotationCount > 0) strategies.push("annotation_removal");
  if ((removedCoverCount || 0) > 0) strategies.push("smart_cover");

  return {
    pdfBytes: currentBytes,
    removedTextCount,
    removedImageCount,
    removedAnnotationCount,
    removedCoverCount,
    totalRemoved,
    strategyUsed: strategies.join(" + ") || "none",
    candidateResults: finalCandidateResults
  };
}
