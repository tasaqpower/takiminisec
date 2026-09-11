"use client";

import React, { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  RotateCw,
  Copy,
  Trash2,
  Plus,
  Download,
  CheckSquare,
  Square,
  ArrowLeft,
  ArrowRight,
  Check,
  FilePlus,
  RefreshCcw,
  Search,
  Undo2,
  Redo2
} from "lucide-react";
import { toast } from "sonner";
import type { PageItem } from "@/lib/documents";
import { PDFDocument, degrees } from "pdf-lib";
import { download } from "@/lib/documents";

export interface PageOrganizerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pages: PageItem[];
  pdfBytes?: Uint8Array;
  onApplyPages: (newPages: PageItem[], newPdfBytes?: Uint8Array) => void;
  fileName?: string;
}

/**
 * Parses user range strings such as "1-3, 5, 8-10" into 0-indexed page numbers
 */
export function parsePageRange(input: string, maxPages: number): number[] {
  if (!input.trim() || maxPages <= 0) return [];
  const parts = input.split(",").map((s) => s.trim()).filter(Boolean);
  const result = new Set<number>();

  for (const part of parts) {
    if (part.includes("-")) {
      const [startStr, endStr] = part.split("-").map((s) => s.trim());
      const s = parseInt(startStr, 10);
      const e = parseInt(endStr, 10);
      if (!isNaN(s) && !isNaN(e)) {
        const from = Math.max(1, Math.min(s, e));
        const to = Math.min(maxPages, Math.max(s, e));
        for (let i = from; i <= to; i++) {
          result.add(i - 1);
        }
      }
    } else {
      const n = parseInt(part, 10);
      if (!isNaN(n) && n >= 1 && n <= maxPages) {
        result.add(n - 1);
      }
    }
  }

  return Array.from(result).sort((a, b) => a - b);
}

function PageThumbnail({
  pdfBytes,
  pageIndex,
  rotation,
  sharedDoc
}: {
  pdfBytes?: Uint8Array;
  pageIndex: number;
  rotation: number;
  sharedDoc?: any;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [inView, setInView] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const obs = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting);
      },
      { rootMargin: "150px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!inView) return;
    let cancelled = false;

    (async () => {
      try {
        let doc = sharedDoc;
        if (!doc) {
          if (!pdfBytes) return;
          const pdfjsLib = await import("pdfjs-dist");
          pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
          doc = await pdfjsLib.getDocument({ data: pdfBytes.slice() }).promise;
        }
        if (cancelled) return;
        const pageNum = Math.min(Math.max(1, pageIndex + 1), doc.numPages);
        const page = await doc.getPage(pageNum);
        if (cancelled) return;

        const viewport = page.getViewport({ scale: 0.25 });
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        await page.render({
          canvasContext: ctx as any,
          viewport,
          canvas: canvas as any
        }).promise;
        if (!cancelled) setLoaded(true);
      } catch {
        // Fallback to skeleton card
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [inView, sharedDoc, pdfBytes, pageIndex]);

  return (
    <div
      ref={containerRef}
      style={{ transform: `rotate(${rotation}deg)` }}
      className="w-20 h-28 bg-white border border-slate-300 shadow-sm rounded flex items-center justify-center relative overflow-hidden transition-transform"
    >
      {inView ? (
        <canvas ref={canvasRef} className={`max-w-full max-h-full object-contain ${loaded ? "" : "hidden"}`} />
      ) : null}
      {(!inView || !loaded) && (
        <div className="w-full h-full flex flex-col p-1.5 space-y-1.5 justify-center">
          <div className="w-3/4 h-1.5 bg-slate-200 rounded animate-pulse" />
          <div className="w-full h-1 bg-slate-100 rounded" />
          <div className="w-5/6 h-1 bg-slate-100 rounded" />
          <div className="w-2/3 h-1 bg-slate-100 rounded" />
        </div>
      )}
    </div>
  );
}

export function PageOrganizerModal({
  open,
  onOpenChange,
  pages,
  pdfBytes,
  onApplyPages,
  fileName = "belge.pdf"
}: PageOrganizerModalProps) {
  const [localPages, setLocalPages] = useState<PageItem[]>([]);
  const [currentPdfBytes, setCurrentPdfBytes] = useState<Uint8Array | undefined>(pdfBytes);
  const [selectedSet, setSelectedSet] = useState<Set<number>>(new Set());
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [rangeInput, setRangeInput] = useState("");
  const importInputRef = useRef<HTMLInputElement>(null);
  const [sharedPdfDoc, setSharedPdfDoc] = useState<any>(null);
  const [history, setHistory] = useState<PageItem[][]>([]);
  const [future, setFuture] = useState<PageItem[][]>([]);

  useEffect(() => {
    const bytes = currentPdfBytes || pdfBytes;
    if (!open || !bytes) {
      setSharedPdfDoc(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
          pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        }
        const doc = await pdfjsLib.getDocument({ data: bytes.slice() }).promise;
        if (!cancelled) setSharedPdfDoc(doc);
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [open, currentPdfBytes, pdfBytes]);

  const mutatePages = (updater: (prev: PageItem[]) => PageItem[]) => {
    setHistory((h) => [...h.slice(-20), localPages]);
    setFuture([]);
    setLocalPages(updater(localPages));
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setFuture((f) => [localPages, ...f]);
    setHistory((h) => h.slice(0, -1));
    setLocalPages(prev);
    setSelectedSet(new Set());
  };

  const handleRedo = () => {
    if (future.length === 0) return;
    const next = future[0];
    setHistory((h) => [...h, localPages]);
    setFuture((f) => f.slice(1));
    setLocalPages(next);
    setSelectedSet(new Set());
  };

  // Synchronize when opened
  useEffect(() => {
    if (open) {
      setLocalPages([...pages]);
      setCurrentPdfBytes(pdfBytes);
      setSelectedSet(new Set());
      setRangeInput("");
      setHistory([]);
      setFuture([]);
    }
  }, [open, pages, pdfBytes]);

  const toggleSelect = (idx: number, e?: React.MouseEvent) => {
    const next = new Set(selectedSet);
    if (e?.shiftKey && selectedSet.size > 0) {
      const lastSelected = Array.from(selectedSet)[selectedSet.size - 1];
      const start = Math.min(lastSelected, idx);
      const end = Math.max(lastSelected, idx);
      for (let i = start; i <= end; i++) {
        next.add(i);
      }
    } else if (e?.ctrlKey || e?.metaKey) {
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
    } else {
      if (next.has(idx) && next.size === 1) {
        next.delete(idx);
      } else {
        next.clear();
        next.add(idx);
      }
    }
    setSelectedSet(next);
  };

  const handleSelectAll = () => {
    if (selectedSet.size === localPages.length) {
      setSelectedSet(new Set());
    } else {
      setSelectedSet(new Set(localPages.map((_, i) => i)));
    }
  };

  const handleInvertSelection = () => {
    const next = new Set<number>();
    localPages.forEach((_, i) => {
      if (!selectedSet.has(i)) next.add(i);
    });
    setSelectedSet(next);
    toast.info("Seçim tersine çevrildi.");
  };

  const handleApplyRangeInput = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!rangeInput.trim()) return;
    const indices = parsePageRange(rangeInput, localPages.length);
    if (indices.length === 0) {
      toast.error("Geçerli bir sayfa aralığı girin (Örn: 1-3, 5).");
      return;
    }
    setSelectedSet(new Set(indices));
    toast.success(`${indices.length} sayfa aralık ile seçildi.`);
  };

  const handleRotateSelected = (delta = 90) => {
    if (selectedSet.size === 0) {
      toast.info("Lütfen döndürmek için en az bir sayfa seçin.");
      return;
    }
    setLocalPages((prev) =>
      prev.map((p, i) => {
        if (selectedSet.has(i)) {
          return { ...p, rotation: (p.rotation + delta) % 360 };
        }
        return p;
      })
    );
    toast.success(`${selectedSet.size} sayfa döndürüldü.`);
  };

  const handleDuplicateSelected = () => {
    if (selectedSet.size === 0) {
      toast.info("Lütfen çoğaltmak için en az bir sayfa seçin.");
      return;
    }
    const newPages: PageItem[] = [];
    const newSelected = new Set<number>();

    localPages.forEach((p, i) => {
      newPages.push(p);
      if (selectedSet.has(i)) {
        newPages.push({ ...p });
        newSelected.add(newPages.length - 1);
      }
    });

    setLocalPages(newPages);
    setSelectedSet(newSelected);
    toast.success(`${selectedSet.size} sayfa çoğaltıldı.`);
  };

  const handleDeleteSelected = () => {
    if (selectedSet.size === 0) {
      toast.info("Lütfen silmek için en az bir sayfa seçin.");
      return;
    }
    if (selectedSet.size >= localPages.length) {
      toast.error("Tüm sayfaları silemezsiniz. Belgede en az bir sayfa kalmalıdır.");
      return;
    }

    const filtered = localPages.filter((_, i) => !selectedSet.has(i));
    setLocalPages(filtered);
    setSelectedSet(new Set());
    toast.success("Seçili sayfalar silindi.");
  };

  const handleAddBlankPage = () => {
    const newPage: PageItem = {
      index: localPages.length > 0 ? localPages[0].index : 0,
      rotation: 0
    };
    setLocalPages((prev) => [...prev, newPage]);
    toast.success("Yeni sayfa eklendi.");
  };

  const handleImportPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const extBytes = new Uint8Array(await file.arrayBuffer());
      const extDoc = await PDFDocument.load(extBytes);
      const extCount = extDoc.getPageCount();
      if (extCount === 0) throw Error("Seçilen PDF sayfası bulunamadı.");

      let currentDoc: PDFDocument;
      if (currentPdfBytes) {
        currentDoc = await PDFDocument.load(currentPdfBytes);
      } else {
        currentDoc = await PDFDocument.create();
      }

      const startIndex = currentDoc.getPageCount();
      const copied = await currentDoc.copyPages(extDoc, extDoc.getPageIndices());
      copied.forEach((p) => currentDoc.addPage(p));
      const mergedBytes = await currentDoc.save();
      setCurrentPdfBytes(mergedBytes);

      const newItems: PageItem[] = copied.map((_, i) => ({
        index: startIndex + i,
        rotation: 0
      }));

      setLocalPages((prev) => [...prev, ...newItems]);
      toast.success(`${file.name} dosyasından ${extCount} sayfa eklendi.`);
    } catch (err: any) {
      console.error(err);
      toast.error("Dışarıdan PDF eklenemedi: " + (err.message || "Bilinmeyen hata"));
    } finally {
      e.target.value = "";
    }
  };

  const handleMovePage = (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= localPages.length) return;
    const copy = [...localPages];
    const [moved] = copy.splice(fromIdx, 1);
    copy.splice(toIdx, 0, moved);
    setLocalPages(copy);
    setSelectedSet(new Set());
  };

  const handleExtractRange = async () => {
    const sourceBytes = currentPdfBytes || pdfBytes;
    if (!sourceBytes) {
      toast.error("PDF verisi bulunamadı.");
      return;
    }
    const targetIndices = selectedSet.size > 0 ? Array.from(selectedSet) : localPages.map((_, i) => i);
    if (targetIndices.length === 0) return;

    try {
      const srcDoc = await PDFDocument.load(sourceBytes);
      const outDoc = await PDFDocument.create();

      for (const i of targetIndices) {
        const item = localPages[i];
        if (item.index < srcDoc.getPageCount()) {
          const [page] = await outDoc.copyPages(srcDoc, [item.index]);
          page.setRotation(degrees((page.getRotation().angle + item.rotation) % 360));
          outDoc.addPage(page);
        }
      }

      const extractedBytes = await outDoc.save();
      const cleanName = fileName.replace(/\.pdf$/i, "");
      download(
        new Blob([extractedBytes.buffer as ArrayBuffer], { type: "application/pdf" }),
        `${cleanName}_ayrilan_${targetIndices.length}_sayfa.pdf`
      );
      toast.success(`${targetIndices.length} sayfa yeni PDF olarak indirildi.`);
    } catch (err) {
      console.error(err);
      toast.error("Sayfalar dışa aktarılamadı.");
    }
  };

  const handleApply = () => {
    onApplyPages(localPages, currentPdfBytes);
    toast.success("Sayfa düzeni uygulandı.");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl bg-white rounded-xl shadow-2xl p-6 border border-slate-100 max-h-[90vh] flex flex-col">
        <DialogTitle className="text-xl font-semibold text-slate-900 flex items-center justify-between">
          <span>Gelişmiş Sayfa Düzenleyici</span>
          <span className="text-xs font-normal text-slate-500">Toplam {localPages.length} Sayfa</span>
        </DialogTitle>
        <DialogDescription className="text-sm text-slate-500">
          Sayfaları sürükleyip sıralayın, çoklu seçip döndürün, çoğaltın, silin, dışarıdan PDF sayfaları ekleyin veya aralığı dışa aktarın.
        </DialogDescription>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 border border-slate-200/90 rounded-lg mt-3">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleSelectAll}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-md transition-colors"
            >
              {selectedSet.size === localPages.length ? (
                <>
                  <CheckSquare className="w-3.5 h-3.5 text-indigo-600" />
                  Seçimi Kaldır
                </>
              ) : (
                <>
                  <Square className="w-3.5 h-3.5" />
                  Tümünü Seç
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleInvertSelection}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-md transition-colors"
              title="Seçimi Tersine Çevir"
            >
              <RefreshCcw className="w-3.5 h-3.5" />
              Tersine Çevir
            </button>

            {/* Range selection input */}
            <form onSubmit={handleApplyRangeInput} className="flex items-center gap-1 ml-1">
              <input
                type="text"
                placeholder="Örn: 1-3, 5"
                value={rangeInput}
                onChange={(e) => setRangeInput(e.target.value)}
                className="w-24 px-2 py-1 text-xs border border-slate-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                type="submit"
                className="px-2 py-1 text-xs font-medium bg-slate-200 hover:bg-slate-300 text-slate-700 rounded transition-colors"
              >
                Aralık Seç
              </button>
            </form>

            {selectedSet.size > 0 && (
              <span className="text-xs font-medium text-indigo-700 bg-indigo-50 px-2 py-1 rounded">
                {selectedSet.size} seçildi
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              disabled={selectedSet.size === 0}
              onClick={() => handleRotateSelected(90)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-md disabled:opacity-40 transition-colors"
              title="Seçili sayfaları 90° döndür"
            >
              <RotateCw className="w-3.5 h-3.5" />
              Döndür
            </button>

            <button
              type="button"
              disabled={selectedSet.size === 0}
              onClick={handleDuplicateSelected}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-md disabled:opacity-40 transition-colors"
              title="Seçili sayfaları çoğalt"
            >
              <Copy className="w-3.5 h-3.5" />
              Çoğalt
            </button>

            <button
              type="button"
              disabled={selectedSet.size === 0}
              onClick={handleDeleteSelected}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-md disabled:opacity-40 transition-colors"
              title="Seçili sayfaları sil"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Sil
            </button>

            <div className="h-4 w-px bg-slate-300 mx-1" />

            <button
              type="button"
              onClick={handleAddBlankPage}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-md transition-colors"
              title="Yeni boş sayfa ekle"
            >
              <Plus className="w-3.5 h-3.5" />
              Boş Sayfa
            </button>

            {/* External PDF import */}
            <input
              ref={importInputRef}
              type="file"
              accept="application/pdf"
              className="sr-only"
              onChange={handleImportPdf}
            />
            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-md transition-colors"
              title="Dışarıdan bir PDF dosyasının sayfalarını ekle"
            >
              <FilePlus className="w-3.5 h-3.5 text-indigo-600" />
              PDF Ekle
            </button>

            <button
              type="button"
              onClick={handleExtractRange}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-md transition-colors"
              title="Seçili sayfaları yeni bir PDF olarak indir"
            >
              <Download className="w-3.5 h-3.5" />
              Aralığı Dışa Aktar
            </button>
          </div>
        </div>

        {/* Grid of Pages */}
        <div className="flex-1 overflow-y-auto mt-4 p-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 min-h-[300px]">
          {localPages.map((page, idx) => {
            const isSelected = selectedSet.has(idx);

            return (
              <div
                key={`${page.index}-${idx}`}
                draggable
                onDragStart={() => setDraggedIdx(idx)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (draggedIdx !== null && draggedIdx !== idx) {
                    handleMovePage(draggedIdx, idx);
                  }
                  setDraggedIdx(null);
                }}
                onClick={(e) => toggleSelect(idx, e)}
                className={`group relative rounded-xl border p-2 flex flex-col items-center justify-between cursor-pointer transition-all bg-white select-none ${
                  isSelected
                    ? "border-indigo-500 ring-2 ring-indigo-500 bg-indigo-50/20 shadow-md"
                    : "border-slate-200 hover:border-slate-300 hover:shadow-sm"
                }`}
              >
                {/* Checkbox indicator */}
                <div className="w-full flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                    Sayfa {idx + 1}
                  </span>
                  <div
                    className={`w-4 h-4 rounded flex items-center justify-center transition-colors ${
                      isSelected ? "bg-indigo-600 text-white" : "border border-slate-300 bg-white"
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3" />}
                  </div>
                </div>

                {/* Page real canvas thumbnail */}
                <div className="w-full h-36 bg-slate-50 border border-slate-200/80 rounded-lg flex flex-col items-center justify-center p-3 relative overflow-hidden">
                  <PageThumbnail
                    pdfBytes={currentPdfBytes || pdfBytes}
                    pageIndex={page.index}
                    rotation={page.rotation}
                    sharedDoc={sharedPdfDoc}
                  />

                  {page.rotation > 0 && (
                    <span className="absolute bottom-1 right-1 text-[10px] bg-slate-900/80 text-white font-mono px-1 rounded">
                      {page.rotation}°
                    </span>
                  )}
                </div>

                {/* Reorder controls on hover */}
                <div className="w-full flex items-center justify-between mt-2 pt-1.5 border-t border-slate-100">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMovePage(idx, idx - 1);
                    }}
                    className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20"
                    title="Sola taşı"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </button>

                  <span className="text-[10px] text-slate-400">#{page.index + 1}</span>

                  <button
                    type="button"
                    disabled={idx === localPages.length - 1}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMovePage(idx, idx + 1);
                    }}
                    className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20"
                    title="Sağa taşı"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm"
          >
            <Check className="w-4 h-4" />
            Değişiklikleri Uygula
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
