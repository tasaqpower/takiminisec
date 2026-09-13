import { removePdfText, removePdfTextObjects, removePdfImages, editablePageText, type TextRemoval, type ImageRemoval } from "@/lib/pdf-text";
import { loadPdf } from "@/lib/documents";
import { PDFDocument, rgb } from "pdf-lib";
import { normalizeTurkish, reconstructPageLines, WATERMARK_KEYWORDS } from "./watermarkDetector";
import { findVisualTextBounds } from "./visualWatermarkDetector";
import type { WatermarkCandidate, WatermarkRemovalOptions } from "./watermarkTypes";

export interface WatermarkRemovalResult {
  pdfBytes: Uint8Array;
  removedTextCount: number;
  removedImageCount: number;
  removedAnnotationCount: number;
  removedCoverCount?: number;
  totalRemoved: number;
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

  // 1a. Surgical Object-Level Watermark Removal via PDFium
  // Removes entire watermark text objects directly from the PDF stream without altering
  // or redacting any adjacent or overlapping legitimate contract text!
  const candidateTexts = allCandidates
    .filter(c => selectedSet.has(c.id) && c.type === "text" && c.text)
    .map(c => c.text as string);

  if (options.customText?.trim()) {
    candidateTexts.push(options.customText.trim());
  }

  let objectRemovalCount = 0;
  try {
    const objResult = await removePdfTextObjects(currentBytes, {
      candidateTexts,
      targetPages: Array.from(targetPages),
      keywords: WATERMARK_KEYWORDS
    });
    if (objResult.removedCount > 0) {
      currentBytes = objResult.bytes;
      objectRemovalCount = objResult.removedCount;
      removedTextCount += objResult.removedCount;
    }
  } catch (objErr) {
    console.warn("Object-level watermark removal warning:", objErr);
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

        // 2a. Line-level matching (catches multi-word watermarks assembled into lines)
        const lines = reconstructPageLines(pageTexts);
        for (const line of lines) {
          const lineRaw = line.text;
          const lineNorm = normalizeTurkish(lineRaw);

          const isMatch = options.customCaseSensitive
            ? lineRaw.includes(searchRaw)
            : (lineRaw.toLowerCase().includes(searchRaw.toLowerCase()) || lineNorm.includes(searchNorm));

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

        // 2b. Individual item matching
        for (const item of pageTexts) {
          if (matchedItemIds.has(item.id)) continue;
          const itemRaw = item.text || "";
          const itemNorm = normalizeTurkish(itemRaw);

          const isMatch = options.customCaseSensitive
            ? itemRaw.includes(searchRaw)
            : (itemRaw.toLowerCase().includes(searchRaw.toLowerCase()) || itemNorm.includes(searchNorm));

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
    } catch (err) {
      console.warn("Failed to remove some text watermarks via PDFium:", err);
    }
  }

  // 4. Apply Image Removals via PDFium WASM
  if (imageRemovals.length > 0) {
    try {
      currentBytes = await removePdfImages(currentBytes, imageRemovals);
      removedImageCount = imageRemovals.length;
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
        const normContents = normalizeTurkish(contents);
        const normName = normalizeTurkish(name);
        const searchNorm = options.customText ? normalizeTurkish(options.customText) : "";

        const isWatermarkAnnot =
          subtype === "/Watermark" ||
          (subtype === "/Stamp" && (
            normContents.includes("watermark") ||
            normContents.includes("draft") ||
            normContents.includes("taslak") ||
            normContents.includes("kopya") ||
            normContents.includes("gecersiz") ||
            normContents.includes("ornek") ||
            normContents.includes("belge") ||
            normContents.includes("iptal") ||
            normContents.includes("void") ||
            normContents.includes("sample") ||
            (searchNorm.length > 0 && normContents.includes(searchNorm))
          )) ||
          normName.includes("watermark") ||
          (searchNorm.length > 0 && normName.includes(searchNorm));

        if (isWatermarkAnnot) {
          removedAnnotationCount++;
          annotsChanged = true;
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

    // 6a. Detected candidate bounds - ONLY FOR RASTER CANDIDATES!
    // CRITICAL: NEVER draw solid rectangles for vector text!
    // removePdfText already surgically deleted vector glyphs without touching anything else.
    for (const cand of allCandidates) {
      if (!selectedSet.has(cand.id)) continue;

      if (cand.type === "text" || (cand.textRemovals && cand.textRemovals.length > 0)) {
        continue;
      }

      if (cand.imageBounds) {
        for (const pIdx of cand.pages) {
          if (targetPages.has(pIdx) && pIdx >= 0 && pIdx < pages.length) {
            const page = pages[pIdx];
            const pH = page.getHeight();

            // CRITICAL: Check overlap with protected legitimate contract text on this page!
            // Never allow an opaque rectangle to cover real document clauses!
            const protectedBoxes = pageProtectedTextBounds.get(pIdx) || [];
            const overlapsProtected = protectedBoxes.some(b => {
              const bBottom = pH - (b.y + b.h);
              const bTop = pH - b.y;
              const boxX1 = cand.imageBounds!.x;
              const boxX2 = cand.imageBounds!.x + cand.imageBounds!.w;
              const boxY1 = cand.imageBounds!.y;
              const boxY2 = cand.imageBounds!.y + cand.imageBounds!.h;

              return boxX1 < b.x + b.w && boxX2 > b.x && boxY1 < bTop && boxY2 > bBottom;
            });

            if (overlapsProtected) {
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

  return {
    pdfBytes: currentBytes,
    removedTextCount,
    removedImageCount,
    removedAnnotationCount,
    removedCoverCount,
    totalRemoved: removedTextCount + removedImageCount + removedAnnotationCount + removedCoverCount
  };
}
