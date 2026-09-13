import { removePdfText, removePdfImages, editablePageText, type TextRemoval, type ImageRemoval } from "@/lib/pdf-text";
import { loadPdf } from "@/lib/documents";
import { PDFDocument } from "pdf-lib";
import type { WatermarkCandidate, WatermarkRemovalOptions } from "./watermarkTypes";

export interface WatermarkRemovalResult {
  pdfBytes: Uint8Array;
  removedTextCount: number;
  removedImageCount: number;
  removedAnnotationCount: number;
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

  // 1. Collect candidate removals
  const textRemovals: TextRemoval[] = [];
  const imageRemovals: ImageRemoval[] = [];

  const selectedSet = new Set(options.candidateIds);
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
    const searchText = options.customCaseSensitive ? options.customText.trim() : options.customText.trim().toLowerCase();

    for (const pageIdx of targetPages) {
      if (pageIdx < 0 || pageIdx >= totalPages) continue;
      try {
        const page = await doc.getPage(pageIdx + 1);
        const pageTexts = await editablePageText(page);

        for (const item of pageTexts) {
          const itemText = options.customCaseSensitive ? item.text : item.text.toLowerCase();
          if (itemText.includes(searchText)) {
            textRemovals.push({
              id: item.id,
              page: pageIdx,
              quad: item.quad
            });
          }
        }
      } catch {}
    }
  }

  // Clean up PDF.js doc instance
  try { await doc.loadingTask.destroy(); } catch {}

  // 3. Apply Text Removals via PDFium WASM
  if (textRemovals.length > 0) {
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
        const contents = annotObj.get?.("Contents")?.toString()?.toLowerCase() || "";
        const name = annotObj.get?.("NM")?.toString()?.toLowerCase() || "";

        const isWatermarkAnnot =
          subtype === "/Watermark" ||
          subtype === "/Stamp" && (contents.includes("watermark") || contents.includes("draft") || contents.includes("taslak") || contents.includes("kopya")) ||
          name.includes("watermark");

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

  return {
    pdfBytes: currentBytes,
    removedTextCount,
    removedImageCount,
    removedAnnotationCount,
    totalRemoved: removedTextCount + removedImageCount + removedAnnotationCount
  };
}
