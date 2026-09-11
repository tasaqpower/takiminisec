"use client";

import React, { useState } from "react";
import {
  GitCompare,
  Upload,
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileCode,
  Sliders,
  Check,
} from "lucide-react";
import type { CompareMode, CompareOptions, CompareSummary } from "./compareTypes";
import { comparePdfs, exportCompareReport } from "./compareEngine";

interface PdfCompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPdfBytes?: Uint8Array | null;
  currentFileName?: string;
}

export function PdfCompareModal({
  isOpen,
  onClose,
  currentPdfBytes,
  currentFileName = "belge.pdf",
}: PdfCompareModalProps) {
  const [docABytes, setDocABytes] = useState<Uint8Array | null>(currentPdfBytes || null);
  const [docAName, setDocAName] = useState<string>(currentFileName);
  const [docBBytes, setDocBBytes] = useState<Uint8Array | null>(null);
  const [docBName, setDocBName] = useState<string>("");

  const [options, setOptions] = useState<CompareOptions>({
    mode: "text",
    ignoreWhitespace: true,
    caseSensitive: true,
    pixelThreshold: 35,
    dpi: 100,
  });

  const [summary, setSummary] = useState<CompareSummary | null>(null);
  const [isComparing, setIsComparing] = useState<boolean>(false);
  const [activeDiffIndex, setActiveDiffIndex] = useState<number>(0);
  const [onlyDiffPages, setOnlyDiffPages] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    target: "A" | "B"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const bytes = new Uint8Array(reader.result as ArrayBuffer);
      if (target === "A") {
        setDocABytes(bytes);
        setDocAName(file.name);
      } else {
        setDocBBytes(bytes);
        setDocBName(file.name);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleRunCompare = async () => {
    if (!docABytes || !docBBytes) {
      alert("Lütfen karşılaştırılacak her iki PDF belgesini de seçin.");
      return;
    }

    setIsComparing(true);
    try {
      const res = await comparePdfs(docABytes, docBBytes, options);
      setSummary(res);
      setActiveDiffIndex(0);
    } catch (err: unknown) {
      alert(`Karşılaştırma hatası: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsComparing(false);
    }
  };

  const handleExport = async (format: "json" | "html" | "summaryPdf") => {
    if (!summary) return;
    try {
      const report = await exportCompareReport(summary, format, docAName, docBName);
      if (format === "json" || format === "html") {
        const mime = format === "json" ? "application/json" : "text/html";
        const blob = new Blob([report as string], { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `karsilastirma_${docAName}_vs_${docBName}.${format}`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const blob = new Blob([report as unknown as BlobPart], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `karsilastirma_raporu_${Date.now()}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err: unknown) {
      alert(`Rapor indirme hatası: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const displayedPages = summary
    ? onlyDiffPages
      ? summary.pageDiffs.filter((p) => p.hasDifferences)
      : summary.pageDiffs
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative flex flex-col w-full max-w-5xl h-[85vh] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg">
              <GitCompare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                İki PDF Belgesini Karşılaştır
              </h2>
              <p className="text-xs text-slate-400">
                Eski ve yeni sürümler arasındaki metin ve piksel farklarını yerel olarak tespit edin.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Setup & Selector Bar */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/40 grid grid-cols-2 gap-4">
          {/* Doc A */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900 border border-slate-800">
            <div>
              <span className="text-[10px] font-semibold text-rose-400 uppercase tracking-wider block">
                Orijinal / Eski Belge (A)
              </span>
              <span className="text-xs text-slate-200 font-medium truncate max-w-[200px] block">
                {docAName || "Henüz dosya seçilmedi"}
              </span>
            </div>
            <label className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 cursor-pointer transition-colors">
              <Upload className="w-3.5 h-3.5" />
              Dosya Değiştir
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => handleFileUpload(e, "A")}
              />
            </label>
          </div>

          {/* Doc B */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900 border border-slate-800">
            <div>
              <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider block">
                Yeni / Revize Belge (B)
              </span>
              <span className="text-xs text-slate-200 font-medium truncate max-w-[200px] block">
                {docBName || "Karşılaştırılacak belgeyi seçin"}
              </span>
            </div>
            <label className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg cursor-pointer transition-colors shadow-sm">
              <Upload className="w-3.5 h-3.5" />
              PDF Seç (B)
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => handleFileUpload(e, "B")}
              />
            </label>
          </div>
        </div>

        {/* Options & Action Row */}
        <div className="px-6 py-2.5 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between text-xs">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Mod:</span>
              <select
                value={options.mode}
                onChange={(e) =>
                  setOptions((prev) => ({ ...prev, mode: e.target.value as CompareMode }))
                }
                className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200"
              >
                <option value="text">Metin Karşılaştırması</option>
                <option value="visual">Piksel / Görsel</option>
                <option value="combined">Birleşik</option>
              </select>
            </div>

            <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={options.ignoreWhitespace}
                onChange={(e) =>
                  setOptions((prev) => ({ ...prev, ignoreWhitespace: e.target.checked }))
                }
                className="rounded accent-indigo-500"
              >
              </input>
              Boşlukları Yoksay
            </label>
          </div>

          <button
            onClick={handleRunCompare}
            disabled={!docABytes || !docBBytes || isComparing}
            className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold rounded-lg shadow-sm transition-colors"
          >
            <GitCompare className="w-3.5 h-3.5" />
            {isComparing ? "Karşılaştırılıyor..." : "Şimdi Karşılaştır"}
          </button>
        </div>

        {/* Content Body / Results View */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-950/30">
          {!summary ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-slate-500 space-y-2">
              <GitCompare className="w-12 h-12 text-slate-700" />
              <p className="text-sm">Karşılaştırmayı başlatmak için her iki PDF belgesini seçin.</p>
              <p className="text-xs">Tüm farklar satır satır ve renk kodlarıyla incelenir.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Stats Bar */}
              <div className="grid grid-cols-4 gap-3">
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-center">
                  <div className="text-lg font-bold text-emerald-400">+{summary.addedCount}</div>
                  <div className="text-[11px] text-slate-400">Eklenen Satır / Öğe</div>
                </div>
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-center">
                  <div className="text-lg font-bold text-rose-400">-{summary.deletedCount}</div>
                  <div className="text-[11px] text-slate-400">Silinen Satır / Öğe</div>
                </div>
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-center">
                  <div className="text-lg font-bold text-amber-400">~{summary.modifiedCount}</div>
                  <div className="text-[11px] text-slate-400">Değiştirilen Satır</div>
                </div>
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-center">
                  <div className="text-lg font-bold text-indigo-400">{summary.totalDifferences}</div>
                  <div className="text-[11px] text-slate-400">Farklı Sayfa Sayısı</div>
                </div>
              </div>

              {/* View filter */}
              <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={onlyDiffPages}
                    onChange={(e) => setOnlyDiffPages(e.target.checked)}
                    className="rounded accent-indigo-500"
                  />
                  Yalnızca fark bulunan sayfaları göster ({summary.totalDifferences} sayfa)
                </label>
                <span>İşlem süresi: {summary.executionTimeMs} ms</span>
              </div>

              {/* Diff List */}
              <div className="space-y-3">
                {displayedPages.map((page) => (
                  <div
                    key={page.pageIndex}
                    className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden"
                  >
                    <div className="px-4 py-2 bg-slate-800/60 border-b border-slate-800 flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-200">
                        Sayfa {page.pageIndex + 1}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                          page.hasDifferences
                            ? "bg-amber-500/20 text-amber-300"
                            : "bg-slate-800 text-slate-500"
                        }`}
                      >
                        {page.hasDifferences ? "Fark Tespit Edildi" : "Aynı"}
                      </span>
                    </div>

                    <div className="p-3 space-y-1 font-mono text-xs">
                      {page.textDiffs.map((diff, didx) => (
                        <div
                          key={didx}
                          className={`px-2 py-1 rounded flex items-start gap-2 ${
                            diff.type === "added"
                              ? "bg-emerald-950/40 text-emerald-300 border-l-2 border-emerald-500"
                              : diff.type === "deleted"
                              ? "bg-rose-950/40 text-rose-300 border-l-2 border-rose-500"
                              : diff.type === "modified"
                              ? "bg-amber-950/40 text-amber-300 border-l-2 border-amber-500"
                              : "text-slate-500"
                          }`}
                        >
                          <span className="font-bold select-none w-4">
                            {diff.type === "added"
                              ? "+"
                              : diff.type === "deleted"
                              ? "-"
                              : diff.type === "modified"
                              ? "~"
                              : " "}
                          </span>
                          <span className="flex-1 whitespace-pre-wrap">{diff.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-900/90">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            Kapat
          </button>

          {summary && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleExport("json")}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg transition-colors"
              >
                <FileCode className="w-3.5 h-3.5 text-indigo-400" />
                JSON
              </button>
              <button
                onClick={() => handleExport("html")}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg transition-colors"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                HTML Rapor
              </button>
              <button
                onClick={() => handleExport("summaryPdf")}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow-sm transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Özet PDF İndir
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
