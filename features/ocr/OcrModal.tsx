"use client";

import React, { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  ScanText,
  Sparkles,
  FileText,
  Download,
  Loader2,
  CheckCircle2,
  Sliders,
  X,
  FileCode,
  MousePointer2
} from "lucide-react";
import { toast } from "sonner";
import {
  performOcrOnCanvas,
  terminateOcrWorker,
  exportSearchablePdf,
  exportDocxFromOcr,
  exportTxtFromOcr,
  type OcrPageResult
} from "./ocrEngine";
import { applyImageFilters, type FilterOptions } from "./imageFilters";
import { download } from "@/lib/documents";

interface OcrModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalPages: number;
  currentPage: number;
  pdfBytes?: Uint8Array;
  fileName?: string;
  onInsertText?: (text: string) => void;
  onApplyOcr?: (results: OcrPageResult[]) => void;
}

export function OcrModal({
  open,
  onOpenChange,
  totalPages,
  currentPage,
  pdfBytes,
  fileName = "belge.pdf",
  onInsertText,
  onApplyOcr
}: OcrModalProps) {
  const [mode, setMode] = useState<"current" | "all">("current");
  const [cleaningEnabled, setCleaningEnabled] = useState(true);
  const [contrast, setContrast] = useState(1.4);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState("");
  const [results, setResults] = useState<OcrPageResult[] | null>(null);
  const [editableText, setEditableText] = useState("");

  const lowConfidenceWords = React.useMemo(() => {
    if (!results) return [];
    const list: { text: string; confidence: number }[] = [];
    for (const r of results) {
      for (const l of r.lines) {
        for (const w of l.words) {
          if (w.confidence < 80) {
            list.push({ text: w.text, confidence: w.confidence });
          }
        }
      }
    }
    return list;
  }, [results]);

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cancelRequested = useRef(false);

  // Update preview when filters change
  useEffect(() => {
    if (!open || !previewCanvasRef.current) return;
    const canvas = previewCanvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (cleaningEnabled) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(10, 10, canvas.width - 20, canvas.height - 20);
    } else {
      ctx.fillStyle = "#fef3c7";
      ctx.fillRect(10, 10, canvas.width - 20, canvas.height - 20);
    }

    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 13px sans-serif";
    ctx.fillText("Örnek Metin: Türkçe Karakterler (ç, ğ, ı, ö, ş, ü)", 24, 50);
    ctx.font = "11px sans-serif";
    ctx.fillStyle = "#475569";
    ctx.fillText("Arka plan temizleme filtresi sararma ve tarama gölgelerini silerek", 24, 80);
    ctx.fillText("karakter sınırlarını netleştirir ve doğruluğu artırır.", 24, 100);
  }, [open, cleaningEnabled, contrast]);

  const handleStartOcr = async () => {
    if (!pdfBytes) {
      toast.error("PDF verisi bulunamadı.");
      return;
    }

    setIsRunning(true);
    setProgress(5);
    setStatusMsg("PDF sayfaları hazırlanıyor…");
    cancelRequested.current = false;

    try {
      const pdfjsLib = await import("pdfjs-dist");
      if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      }

      const loadingTask = pdfjsLib.getDocument({ data: pdfBytes.slice(0) });
      const pdfDoc = await loadingTask.promise;

      const pageList = mode === "current" ? [currentPage] : Array.from({ length: totalPages }, (_, i) => i + 1);
      const resList: OcrPageResult[] = [];

      for (let i = 0; i < pageList.length; i++) {
        if (cancelRequested.current) {
          toast.info("OCR işlemi iptal edildi.");
          break;
        }

        const pNum = pageList[i];
        setStatusMsg(`Sayfa ${pNum} taranıyor (${i + 1}/${pageList.length})…`);

        const page = await pdfDoc.getPage(pNum);
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        const ctx = canvas.getContext("2d", { alpha: false });
        if (!ctx) throw new Error("Canvas context creation failed");

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        await page.render({ canvasContext: ctx as any, viewport, canvas: canvas as any }).promise;

        if (cancelRequested.current) break;

        const pageRes = await performOcrOnCanvas(
          canvas,
          pNum,
          {
            grayscale: cleaningEnabled,
            binarize: cleaningEnabled,
            contrast
          },
          (pct, status) => {
            if (!cancelRequested.current) {
              const base = (i / pageList.length) * 100;
              const step = (1 / pageList.length) * pct;
              setProgress(Math.round(base + step));
              setStatusMsg(status);
            }
          },
          "tur+eng"
        );

        resList.push(pageRes);
        setProgress(Math.round(((i + 1) / pageList.length) * 100));
      }

      if (!cancelRequested.current && resList.length > 0) {
        setResults(resList);
        setEditableText(resList.map(r => r.fullText).join("\n\n"));
        toast.success("OCR tamamlandı!");
      }
    } catch (err: any) {
      console.error("OCR error:", err);
      toast.error("OCR sırasında bir hata oluştu: " + (err.message || "Bilinmeyen hata"));
    } finally {
      setIsRunning(false);
    }
  };

  const handleDownloadSearchablePdf = async () => {
    if (!results || !pdfBytes) {
      toast.error("Orijinal PDF verisi bulunamadı.");
      return;
    }
    try {
      const bytes = await exportSearchablePdf(pdfBytes, results);
      download(new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" }), `${fileName.replace(/\.pdf$/i, "")}_aranabilir.pdf`);
      toast.success("Arama yapılabilir PDF indirildi.");
    } catch (e) {
      console.error(e);
      toast.error("PDF oluşturulamadı.");
    }
  };

  const handleDownloadDocx = async () => {
    if (!results) return;
    try {
      const blob = await exportDocxFromOcr(results);
      download(blob, `${fileName.replace(/\.pdf$/i, "")}_ocr.docx`);
      toast.success("Word (DOCX) belgesi indirildi.");
    } catch (e) {
      console.error(e);
      toast.error("DOCX oluşturulamadı.");
    }
  };

  const handleDownloadTxt = () => {
    if (!results) return;
    const txt = editableText || exportTxtFromOcr(results);
    download(new Blob([txt], { type: "text/plain;charset=utf-8" }), `${fileName.replace(/\.pdf$/i, "")}_ocr.txt`);
    toast.success("TXT dosyası indirildi.");
  };

  const handleInsertIntoDocument = () => {
    if (!results || !onInsertText) return;
    const textToInsert = editableText || results.map(r => r.fullText).join("\n\n");
    onInsertText(textToInsert);
    toast.success("Tanınan metin belgeye eklendi.");
    onOpenChange(false);
  };

  const handleApplyToCanvas = () => {
    if (!results || results.length === 0) {
      toast.error("Tanınmış metin bulunamadı.");
      return;
    }
    if (onApplyOcr) {
      onApplyOcr(results);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl bg-white rounded-xl shadow-2xl p-6 border border-slate-100 max-h-[90vh] overflow-y-auto">
        <DialogTitle className="text-xl font-semibold text-slate-900 flex items-center gap-2">
          <ScanText className="w-5 h-5 text-indigo-600" />
          Yerel OCR — Metin Tanıma
        </DialogTitle>
        <DialogDescription className="text-sm text-slate-500 mt-1">
          Taranmış belgeleri ve resimleri tamamen cihazınızda çalışan yapay zeka ile aranabilir metne dönüştürün.
        </DialogDescription>

        {!results ? (
          <div className="space-y-6 mt-4">
            {/* Options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-2">
                  Tanınacak Sayfalar
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setMode("current")}
                    className={`flex-1 py-2 text-xs font-medium rounded-md border transition-all ${
                      mode === "current"
                        ? "bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    Mevcut Sayfa ({currentPage})
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("all")}
                    className={`flex-1 py-2 text-xs font-medium rounded-md border transition-all ${
                      mode === "all"
                        ? "bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    Tüm Belge ({totalPages} Sayfa)
                  </button>
                </div>

                <div className="mt-4">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                    Dil Desteği
                  </label>
                  <div className="text-xs text-slate-700 font-medium bg-white px-3 py-2 rounded border border-slate-200">
                    🇹🇷 Türkçe + 🇬🇧 English (Tam Destek)
                  </div>
                </div>
              </div>

              {/* Background Clean preview */}
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                    Arka Plan Temizleme
                  </label>
                  <input
                    type="checkbox"
                    checked={cleaningEnabled}
                    onChange={e => setCleaningEnabled(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </div>
                <p className="text-xs text-slate-500 mb-3">
                  Gölgeleri, sararmış arka planı ve tarama noktalarını temizler.
                </p>

                <div className="border border-slate-200 rounded bg-white overflow-hidden flex-1 flex items-center justify-center p-2">
                  <canvas ref={previewCanvasRef} width={260} height={130} className="w-full h-auto" />
                </div>
              </div>
            </div>

            {/* Progress if running */}
            {isRunning && (
              <div className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-lg space-y-2">
                <div className="flex items-center justify-between text-xs font-medium text-indigo-900">
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                    {statusMsg}
                  </span>
                  <span>%{progress}</span>
                </div>
                <div className="w-full h-2 bg-indigo-200/60 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Footer buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Vazgeç
              </button>
              {isRunning ? (
                <button
                  type="button"
                  onClick={() => {
                    cancelRequested.current = true;
                    void terminateOcrWorker();
                    setIsRunning(false);
                    setStatusMsg("İşlem iptal edildi.");
                    toast.info("OCR işlemi iptal edildi.");
                  }}
                  className="px-4 py-2 text-sm font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg"
                >
                  İptal Et
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStartOcr}
                  className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm"
                >
                  <ScanText className="w-4 h-4" />
                  Metni Tanı ve Başlat
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Results view */
          <div className="space-y-4 mt-4">
            {/* Results Header & Sayfada Düzenle CTA */}
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div>
                <div className="flex items-center gap-2 text-emerald-900 text-sm font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{results.length} sayfa başarıyla tarandı</span>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-full">
                    %{Math.round(results.reduce((a, b) => a + b.averageConfidence, 0) / results.length)} Güven
                  </span>
                </div>
                <p className="text-xs text-emerald-700 mt-1">
                  Metinleri doğrudan PDF sayfası üzerinde tıklayarak, normal bir PDF gibi düzenleyin.
                </p>
              </div>
              {onApplyOcr && (
                <button
                  type="button"
                  onClick={handleApplyToCanvas}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-lg shadow-sm transition-all shrink-0 cursor-pointer"
                >
                  <MousePointer2 className="w-4 h-4" />
                  Sayfada Düzenlemeye Başla
                </button>
              )}
            </div>

            {/* Low-confidence words review chips */}
            {lowConfidenceWords.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-amber-800">
                  <span>Düşük Güvenli Kelimeler ({lowConfidenceWords.length})</span>
                  <span className="text-[11px] font-normal text-amber-700">Aşağıdaki metin kutusundan doğrudan düzeltebilirsiniz</span>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {lowConfidenceWords.slice(0, 30).map((w, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100/80 border border-amber-300 rounded text-xs text-amber-900 font-mono"
                      title={`Güven: %${w.confidence}`}
                    >
                      {w.text}
                      <span className="text-[10px] text-amber-600 font-sans">%{w.confidence}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Text preview & editor */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Tanınan Metin (Düzenlenebilir)
                </label>
                <span className="text-[11px] text-slate-400">İhtiyaç halinde metni buradan düzeltebilirsiniz</span>
              </div>
              <textarea
                rows={8}
                value={editableText}
                onChange={(e) => setEditableText(e.target.value)}
                className="w-full text-xs font-mono p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Export buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Kapat
                </button>
                <button
                  type="button"
                  onClick={() => setResults(null)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  ← Yeni Tarama
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {onApplyOcr && (
                  <button
                    type="button"
                    onClick={handleApplyToCanvas}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm cursor-pointer"
                  >
                    <MousePointer2 className="w-3.5 h-3.5" />
                    Sayfada Düzenle
                  </button>
                )}
                {onInsertText && (
                  <button
                    type="button"
                    onClick={handleInsertIntoDocument}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg border border-indigo-200 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Belgeye Ekle
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleDownloadTxt}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white text-slate-700 hover:bg-slate-50 rounded-lg border border-slate-200 cursor-pointer"
                >
                  <FileCode className="w-3.5 h-3.5" />
                  TXT İndir
                </button>
                <button
                  type="button"
                  onClick={handleDownloadDocx}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg border border-blue-200 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  DOCX İndir
                </button>
                <button
                  type="button"
                  onClick={handleDownloadSearchablePdf}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Arama Yapılabilir PDF
                </button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
