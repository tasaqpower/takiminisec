"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Eraser,
  ScanText,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Trash2,
  Sparkles,
  FileText,
  Image as ImageIcon,
  Type,
  Layers
} from "lucide-react";
import { toast } from "sonner";
import { detectWatermarks } from "./watermarkDetector";
import { removeWatermarks } from "./watermarkRemover";
import type { WatermarkCandidate, WatermarkRemovalOptions } from "./watermarkTypes";

interface WatermarkRemovalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pdfBytes?: Uint8Array | null;
  fileName?: string;
  currentPage: number;
  totalPages: number;
  onApplyRemoval: (modifiedBytes: Uint8Array, count: number) => void;
}

export function WatermarkRemovalModal({
  open,
  onOpenChange,
  pdfBytes,
  fileName = "belge.pdf",
  currentPage = 1,
  totalPages = 1,
  onApplyRemoval
}: WatermarkRemovalModalProps) {
  const [candidates, setCandidates] = useState<WatermarkCandidate[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [customText, setCustomText] = useState("");
  const [customCaseSensitive, setCustomCaseSensitive] = useState(false);
  const [pageScope, setPageScope] = useState<"all" | "current" | "custom">("all");
  const [customPagesStr, setCustomPagesStr] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [activeTab, setActiveTab] = useState<"auto" | "custom">("auto");

  // Run auto-detection when modal opens
  useEffect(() => {
    if (!open || !pdfBytes) {
      setCandidates([]);
      setSelectedIds(new Set());
      return;
    }

    let active = true;
    setIsScanning(true);

    detectWatermarks(pdfBytes)
      .then((detected) => {
        if (!active) return;
        setCandidates(detected);
        // Pre-select high confidence candidates (>50%)
        const highConf = new Set(detected.filter(c => c.confidence >= 50).map(c => c.id));
        if (highConf.size > 0) {
          setSelectedIds(highConf);
          setActiveTab("auto");
        } else if (detected.length > 0) {
          setSelectedIds(new Set([detected[0].id]));
          setActiveTab("auto");
        } else {
          setActiveTab("custom");
        }
      })
      .catch((err) => {
        console.error("Watermark detection error:", err);
      })
      .finally(() => {
        if (active) setIsScanning(false);
      });

    return () => {
      active = false;
    };
  }, [open, pdfBytes]);

  const toggleCandidate = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllCandidates = () => {
    setSelectedIds(new Set(candidates.map((c) => c.id)));
  };

  const deselectAllCandidates = () => {
    setSelectedIds(new Set());
  };

  const parseCustomPages = (str: string, maxPages: number): number[] => {
    const pages = new Set<number>();
    const parts = str.split(/[,;\s]+/);
    for (const part of parts) {
      if (!part) continue;
      if (part.includes("-")) {
        const [start, end] = part.split("-").map(Number);
        if (!isNaN(start) && !isNaN(end)) {
          for (let p = Math.min(start, end); p <= Math.max(start, end); p++) {
            if (p >= 1 && p <= maxPages) pages.add(p - 1);
          }
        }
      } else {
        const p = Number(part);
        if (!isNaN(p) && p >= 1 && p <= maxPages) {
          pages.add(p - 1);
        }
      }
    }
    return Array.from(pages).sort((a, b) => a - b);
  };

  const handleApply = async () => {
    if (!pdfBytes) return;

    const hasCandidates = selectedIds.size > 0;
    const hasCustomText = customText.trim().length > 0;

    if (!hasCandidates && !hasCustomText) {
      toast.error("Lütfen kaldırılacak en az bir filigran seçin veya özel bir metin girin.");
      return;
    }

    setIsApplying(true);
    try {
      const customPages = pageScope === "custom" ? parseCustomPages(customPagesStr, totalPages) : undefined;
      const options: WatermarkRemovalOptions = {
        candidateIds: Array.from(selectedIds),
        customText: customText.trim() || undefined,
        customCaseSensitive,
        pageScope,
        customPages,
        currentPage: currentPage - 1
      };

      const result = await removeWatermarks(pdfBytes, candidates, options);

      if (result.totalRemoved > 0) {
        onApplyRemoval(result.pdfBytes, result.totalRemoved);
        onOpenChange(false);
        toast.success(`Filigran başarıyla kaldırıldı! (${result.totalRemoved} öğe temizlendi)`);
      } else {
        toast.warning("Seçili kriterlerle eşleşen filigran bulunamadı veya kaldırılamadı.");
      }
    } catch (err) {
      console.error("Watermark removal failed:", err);
      toast.error("Filigran kaldırılırken bir hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      setIsApplying(false);
    }
  };

  const totalSelectedCount = selectedIds.size + (customText.trim().length > 0 ? 1 : 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl bg-white rounded-xl shadow-2xl p-6 border border-slate-100 max-h-[90vh] overflow-y-auto">
        <DialogTitle className="text-xl font-semibold text-slate-900 flex items-center gap-2">
          <Eraser className="w-5 h-5 text-indigo-600" />
          Filigran Temizleme Aracı
        </DialogTitle>
        <DialogDescription className="text-sm text-slate-500 mt-1">
          Belgenizdeki metin, logo, taslak damgaları veya tekrarlayan filigranları sayfa kalitesini bozmadan vektörel olarak temizleyin.
        </DialogDescription>

        {/* Tab switcher */}
        <div className="flex border-b border-slate-200 mt-4 gap-4">
          <button
            type="button"
            onClick={() => setActiveTab("auto")}
            className={`pb-2 text-xs font-semibold flex items-center gap-1.5 transition-colors border-b-2 cursor-pointer ${
              activeTab === "auto"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Otomatik Algılananlar
            {candidates.length > 0 && (
              <span className="px-1.5 py-0.2 bg-indigo-100 text-indigo-700 rounded-full text-[10px] font-bold">
                {candidates.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("custom")}
            className={`pb-2 text-xs font-semibold flex items-center gap-1.5 transition-colors border-b-2 cursor-pointer ${
              activeTab === "custom"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Type className="w-3.5 h-3.5" />
            Özel Metin Sil
          </button>
        </div>

        {/* Tab 1: Auto-detected candidates */}
        {activeTab === "auto" && (
          <div className="space-y-4 pt-4">
            {isScanning ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                <p className="text-xs">Belge taranıyor ve filigranlar analiz ediliyor...</p>
              </div>
            ) : candidates.length === 0 ? (
              <div className="py-8 px-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center space-y-2">
                <AlertCircle className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-xs font-medium text-slate-700">Otomatik filigran algılanamadı</p>
                <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                  Belgenizde belirgin bir taslak veya tekrarlayan filigran bulunamadı. Silmek istediğiniz özel bir ibare varsa <strong>Özel Metin Sil</strong> sekmesinden doğrudan kaldırabilirsiniz.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab("custom")}
                  className="mt-2 text-xs text-indigo-600 font-semibold hover:underline cursor-pointer"
                >
                  Özel metin girmek için tıkla →
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                  <span>Tespit edilen potansiyel filigranlar ({candidates.length})</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={selectAllCandidates}
                      className="text-indigo-600 hover:underline cursor-pointer"
                    >
                      Tümünü Seç
                    </button>
                    <span>·</span>
                    <button
                      type="button"
                      onClick={deselectAllCandidates}
                      className="text-slate-500 hover:underline cursor-pointer"
                    >
                      Temizle
                    </button>
                  </div>
                </div>

                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {candidates.map((cand) => {
                    const isSelected = selectedIds.has(cand.id);
                    return (
                      <div
                        key={cand.id}
                        onClick={() => toggleCandidate(cand.id)}
                        className={`p-3 rounded-lg border transition-all cursor-pointer flex items-start gap-3 ${
                          isSelected
                            ? "bg-indigo-50/60 border-indigo-300 ring-1 ring-indigo-400"
                            : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleCandidate(cand.id)}
                          className="mt-1 w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                        />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-slate-800 break-all">
                              &ldquo;{cand.text}&rdquo;
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                cand.confidence >= 70
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              %{cand.confidence} Güven
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px]">
                              {cand.type === "image" ? "Görsel / Damga" : "Metin Filigranı"}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-500 flex-wrap">
                            <span>{cand.reason}</span>
                            <span>·</span>
                            <span>
                              {cand.pages.length === totalPages
                                ? "Tüm sayfalarda"
                                : `${cand.pages.length} sayfada (${cand.pages.map(p => p + 1).slice(0, 5).join(", ")}${cand.pages.length > 5 ? "..." : ""})`}
                            </span>
                            {cand.fontSize && (
                              <>
                                <span>·</span>
                                <span>{cand.fontSize}pt</span>
                              </>
                            )}
                            {cand.angle ? (
                              <>
                                <span>·</span>
                                <span>{cand.angle}° açı</span>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Custom text removal */}
        {activeTab === "custom" && (
          <div className="space-y-4 pt-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">
                Kaldırılacak Metin veya İbare
              </label>
              <input
                type="text"
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="Örn: www.site.com, TASLAK, Gizli Belge, CamScanner..."
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <p className="text-[11px] text-slate-400">
                Girdiğiniz metin, sayfalardaki tüm metin blokları taranarak vektörel olarak temizlenir.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="caseSensitive"
                checked={customCaseSensitive}
                onChange={(e) => setCustomCaseSensitive(e.target.checked)}
                className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
              />
              <label htmlFor="caseSensitive" className="text-xs text-slate-600 cursor-pointer">
                Büyük / küçük harf duyarlı ara (Örn: &ldquo;TASLAK&rdquo; ile &ldquo;taslak&rdquo; ayrılsın)
              </label>
            </div>
          </div>
        )}

        {/* Page Scope Configuration */}
        <div className="pt-4 border-t border-slate-100 space-y-2 mt-4">
          <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-slate-500" />
            Sayfa Kapsamı
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: "all", label: `Tüm Sayfalar (${totalPages})` },
              { id: "current", label: `Yalnızca Bu Sayfa (${currentPage})` },
              { id: "custom", label: "Özel Sayfalar" }
            ].map((scope) => (
              <button
                key={scope.id}
                type="button"
                onClick={() => setPageScope(scope.id as any)}
                className={`py-2 px-2 text-xs font-medium rounded-lg border transition-all cursor-pointer ${
                  pageScope === scope.id
                    ? "bg-indigo-50 border-indigo-300 text-indigo-700 font-semibold"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {scope.label}
              </button>
            ))}
          </div>

          {pageScope === "custom" && (
            <div className="pt-1">
              <input
                type="text"
                value={customPagesStr}
                onChange={(e) => setCustomPagesStr(e.target.value)}
                placeholder="Örn: 1, 3, 5-10"
                className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Virgülle ayrılmış sayfa numaraları veya aralıklar girin (1 ile {totalPages} arasında).
              </p>
            </div>
          )}
        </div>

        {/* Action Footer */}
        <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-100 mt-4">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={isApplying}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            Vazgeç
          </button>

          <button
            type="button"
            onClick={handleApply}
            disabled={isApplying || isScanning || totalSelectedCount === 0}
            className={`inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white rounded-lg shadow-sm transition-all cursor-pointer ${
              totalSelectedCount > 0 && !isApplying
                ? "bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800"
                : "bg-slate-300 cursor-not-allowed text-slate-500"
            }`}
          >
            {isApplying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Filigran Temizleniyor...
              </>
            ) : (
              <>
                <Eraser className="w-4 h-4" />
                Filigranı Kaldır ve Uygula
                {totalSelectedCount > 0 && ` (${totalSelectedCount})`}
              </>
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
