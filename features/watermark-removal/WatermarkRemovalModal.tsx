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
  Layers,
  Bot,
  Zap,
  Key,
  ExternalLink,
  ShieldAlert
} from "lucide-react";
import { toast } from "sonner";
import { detectWatermarks } from "./watermarkDetector";
import { removeWatermarks } from "./watermarkRemover";
import {
  renderPdfPageToDataUrl,
  detectWatermarksWithGemini,
  convertAiDetectionToCandidate,
  type AiDetectedWatermark
} from "./aiWatermarkService";
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
  const [isAutoCleaning, setIsAutoCleaning] = useState(false);
  const [activeTab, setActiveTab] = useState<"auto" | "ai" | "custom">("auto");

  // Gemini API Key management (saved in localStorage)
  const [apiKey, setApiKey] = useState("");
  const [isAiScanning, setIsAiScanning] = useState(false);
  const [aiDetectedList, setAiDetectedList] = useState<AiDetectedWatermark[]>([]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedKey = localStorage.getItem("forma_gemini_api_key") || "";
      setApiKey(savedKey);
    }
  }, []);

  const handleSaveApiKey = (key: string) => {
    const trimmed = key.trim();
    setApiKey(trimmed);
    if (typeof window !== "undefined") {
      if (trimmed) {
        localStorage.setItem("forma_gemini_api_key", trimmed);
        toast.success("Gemini API Anahtarı kaydedildi!");
      } else {
        localStorage.removeItem("forma_gemini_api_key");
        toast.info("Gemini API Anahtarı kaldırıldı.");
      }
    }
  };

  // Run auto-detection when modal opens
  useEffect(() => {
    if (!open || !pdfBytes) {
      setCandidates([]);
      setSelectedIds(new Set());
      setAiDetectedList([]);
      return;
    }

    let active = true;
    setIsScanning(true);

    detectWatermarks(pdfBytes)
      .then((detected) => {
        if (!active) return;
        setCandidates(detected);
        // Pre-select high confidence candidates (>50%)
        const highConf = new Set(detected.filter((c) => c.confidence >= 50).map((c) => c.id));
        if (highConf.size > 0) {
          setSelectedIds(highConf);
          setActiveTab("auto");
        } else if (detected.length > 0) {
          setSelectedIds(new Set([detected[0].id]));
          setActiveTab("auto");
        } else {
          // If no local candidates, check if Gemini key is available
          const savedKey = typeof window !== "undefined" ? localStorage.getItem("forma_gemini_api_key") : "";
          if (savedKey) {
            setActiveTab("ai");
          } else {
            setActiveTab("auto");
          }
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

  // 1-Click Auto Clean: Automatically find and eradicate watermarks
  const handleOneClickAutoClean = async () => {
    if (!pdfBytes) return;

    setIsAutoCleaning(true);
    const toastId = toast.loading("Filigranlar taranıyor ve analiz ediliyor...");

    try {
      let activeCandidates: WatermarkCandidate[] = [...candidates];

      // 1. If Gemini API key is configured, use Gemini 2.5 Flash Vision first
      if (apiKey.trim()) {
        try {
          toast.loading("Yapay zeka görseli analiz ediyor (Gemini Vision)...", { id: toastId });
          const { dataUrl, width, height } = await renderPdfPageToDataUrl(pdfBytes, currentPage - 1);
          const aiResults = await detectWatermarksWithGemini(dataUrl, apiKey.trim());
          if (aiResults && aiResults.length > 0) {
            const aiCandidates = aiResults.map((item, idx) =>
              convertAiDetectionToCandidate(item, currentPage - 1, width, height, idx)
            );
            activeCandidates = [...aiCandidates, ...activeCandidates];
          }
        } catch (aiErr: any) {
          console.warn("Gemini Vision AI error during auto clean:", aiErr);
        }
      }

      // 2. If no candidates, run local detector
      if (activeCandidates.length === 0) {
        toast.loading("Belge katmanları taranıyor...", { id: toastId });
        activeCandidates = await detectWatermarks(pdfBytes);
      }

      // 3. If candidates found, remove them
      if (activeCandidates.length > 0) {
        toast.loading(`${activeCandidates.length} filigran temizleniyor...`, { id: toastId });
        const options: WatermarkRemovalOptions = {
          candidateIds: activeCandidates.map((c) => c.id),
          pageScope,
          customPages: pageScope === "custom" ? parseCustomPages(customPagesStr, totalPages) : undefined,
          currentPage: currentPage - 1
        };

        const result = await removeWatermarks(pdfBytes, activeCandidates, options);
        if (result.totalRemoved > 0) {
          onApplyRemoval(result.pdfBytes, result.totalRemoved);
          onOpenChange(false);
          toast.success(`⚡ Harika! ${result.totalRemoved} filigran başarıyla tespit edilip temizlendi.`, { id: toastId });
          return;
        }
      }

      // 4. If still 0 candidates, try removing known high-frequency watermark keywords
      toast.loading("Ortak taslak ve filigran kalıpları kontrol ediliyor...", { id: toastId });
      const fallbackKeywords = ["GEÇERSİZ", "ÖRNEK", "ÖRNEK BELGEDİR", "TASLAK", "DRAFT", "KOPYA", "VOID", "SAMPLE"];
      let removedAny = false;
      let workingBytes = pdfBytes;
      let totalRem = 0;

      for (const kw of fallbackKeywords) {
        try {
          const res = await removeWatermarks(workingBytes, [], {
            candidateIds: [],
            customText: kw,
            customCaseSensitive: false,
            pageScope,
            customPages: pageScope === "custom" ? parseCustomPages(customPagesStr, totalPages) : undefined,
            currentPage: currentPage - 1
          });
          if (res.totalRemoved > 0) {
            workingBytes = res.pdfBytes;
            totalRem += res.totalRemoved;
            removedAny = true;
          }
        } catch {}
      }

      if (removedAny && totalRem > 0) {
        onApplyRemoval(workingBytes, totalRem);
        onOpenChange(false);
        toast.success(`⚡ ${totalRem} adet taslak/filigran ibaresi temizlendi!`, { id: toastId });
        return;
      }

      // If nothing could be found automatically
      toast.dismiss(toastId);
      toast.info("Belirgin bir filigran otomatik bulunamadı. Lütfen 'Özel Metin Sil' sekmesinden metni girin veya 'Yapay Zeka (AI)' sekmesini kullanın.");
      setActiveTab(apiKey ? "ai" : "custom");
    } catch (err: any) {
      console.error("Auto clean failed:", err);
      toast.error("Otomatik temizleme sırasında bir hata oluştu.", { id: toastId });
    } finally {
      setIsAutoCleaning(false);
    }
  };

  // Run AI scan specifically on current page
  const handleRunAiScan = async () => {
    if (!pdfBytes) return;
    if (!apiKey.trim()) {
      toast.error("Lütfen önce bir Google Gemini API anahtarı girin.");
      return;
    }

    setIsAiScanning(true);
    const toastId = toast.loading("Mevcut sayfa Gemini Vision yapay zekasına gönderiliyor...");

    try {
      const { dataUrl, width, height } = await renderPdfPageToDataUrl(pdfBytes, currentPage - 1);
      const aiResults = await detectWatermarksWithGemini(dataUrl, apiKey.trim());
      setAiDetectedList(aiResults);

      if (aiResults.length === 0) {
        toast.info("Yapay zeka bu sayfada belirgin bir filigran tespit edemedi.", { id: toastId });
        return;
      }

      // Convert and append to candidates
      const newAiCandidates = aiResults.map((item, idx) =>
        convertAiDetectionToCandidate(item, currentPage - 1, width, height, idx)
      );

      setCandidates((prev) => {
        const nonAi = prev.filter((c) => !c.id.startsWith("wm-ai-"));
        return [...newAiCandidates, ...nonAi];
      });

      setSelectedIds((prev) => {
        const next = new Set(prev);
        newAiCandidates.forEach((c) => next.add(c.id));
        return next;
      });

      toast.success(`Yapay zeka ${aiResults.length} adet filigran/damga tespit etti!`, { id: toastId });
    } catch (err: any) {
      console.error("AI Scan error:", err);
      toast.error(err.message || "Yapay zeka analizi başarısız oldu.", { id: toastId });
    } finally {
      setIsAiScanning(false);
    }
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
          Belgenizdeki metin, logo, taslak damgaları veya tekrarlayan filigranları sayfa kalitesini bozmadan temizleyin.
        </DialogDescription>

        {/* 1-Click Instant Auto Clean Banner */}
        <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 p-[1px] rounded-xl mt-4">
          <div className="bg-white p-3.5 rounded-[11px] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100">
                <Zap className="w-5 h-5 fill-indigo-500 text-indigo-600" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <span>Tek Tıkla Otomatik Bul ve Sil</span>
                  <span className="bg-indigo-100 text-indigo-700 text-[10px] px-1.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5" />
                    AI Destekli
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  {apiKey.trim()
                    ? "Gemini Vision AI ve yerel motor ile tüm filigranları otomatik tespit edip yok eder."
                    : "Akıllı katman analizi ile filigran ve taslak damgalarını otomatik bulup anında temizler."}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleOneClickAutoClean}
              disabled={isApplying || isScanning || isAutoCleaning || isAiScanning}
              className="w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              {isAutoCleaning ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Otomatik Temizleniyor...</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5 fill-current" />
                  <span>Oto Bul ve Sil</span>
                </>
              )}
            </button>
          </div>
        </div>

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
            onClick={() => setActiveTab("ai")}
            className={`pb-2 text-xs font-semibold flex items-center gap-1.5 transition-colors border-b-2 cursor-pointer ${
              activeTab === "ai"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            Yapay Zeka (AI)
            {apiKey.trim() && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" title="Gemini API Bağlı" />
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
                  Belgenizde belirgin bir taslak veya tekrarlayan filigran bulunamadı. Taranmış veya karmaşık belgeler için <strong>Yapay Zeka (AI)</strong> sekmesini kullanabilir veya <strong>Özel Metin Sil</strong> sekmesinden doğrudan kaldırabilirsiniz.
                </p>
                <div className="flex justify-center gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab("ai")}
                    className="text-xs text-purple-600 font-semibold hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <Bot className="w-3.5 h-3.5" />
                    Yapay Zeka ile Tara →
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => setActiveTab("custom")}
                    className="text-xs text-indigo-600 font-semibold hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <Type className="w-3.5 h-3.5" />
                    Özel metin gir →
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                  <span>Tespit edilen filigranlar ({candidates.length})</span>
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

                <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
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
                            {cand.id.startsWith("wm-ai-") && (
                              <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 text-[10px] font-semibold">
                                AI Tespitli
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-500 flex-wrap">
                            <span>{cand.reason}</span>
                            <span>·</span>
                            <span>
                              {cand.pages.length === totalPages
                                ? "Tüm sayfalarda"
                                : `${cand.pages.length} sayfada (${cand.pages.map((p) => p + 1).slice(0, 5).join(", ")}${cand.pages.length > 5 ? "..." : ""})`}
                            </span>
                            {cand.fontSize ? (
                              <>
                                <span>·</span>
                                <span>{cand.fontSize}pt</span>
                              </>
                            ) : null}
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

        {/* Tab 2: AI / Gemini Vision */}
        {activeTab === "ai" && (
          <div className="space-y-4 pt-4">
            <div className="p-3.5 bg-purple-50/70 border border-purple-200 rounded-xl space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-purple-600" />
                  <span className="text-xs font-bold text-purple-900">
                    Google Gemini 2.5 Flash Vision Entegrasyonu
                  </span>
                </div>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-purple-700 hover:text-purple-900 font-semibold inline-flex items-center gap-1 hover:underline cursor-pointer"
                >
                  Ücretsiz API Anahtarı Al
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <p className="text-[11px] text-purple-800/80 leading-relaxed">
                Taranmış PDF&apos;lerde veya karmaşık tasarımlarda vektör metni bulunmayan filigranları yapay zeka görsel olarak tanır ve konumunu nokta atışı tespit ederek siler.
              </p>

              {/* API Key Input */}
              <div className="pt-2 flex gap-2">
                <div className="relative flex-1">
                  <Key className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="AIzaSy... (Gemini API Anahtarınızı yapıştırın)"
                    className="w-full text-xs pl-8 pr-3 py-2 bg-white border border-purple-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleSaveApiKey(apiKey)}
                  className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shrink-0"
                >
                  Kaydet
                </button>
              </div>
            </div>

            {/* AI Scan Trigger Button */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div>
                <div className="text-xs font-semibold text-slate-800">
                  {currentPage}. Sayfayı Yapay Zeka ile Tara
                </div>
                <div className="text-[11px] text-slate-500">
                  Mevcut sayfa görüntüsü analiz edilir ve filigran koordinatları belirlenir.
                </div>
              </div>

              <button
                type="button"
                onClick={handleRunAiScan}
                disabled={isAiScanning || !apiKey.trim()}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                {isAiScanning ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Taranıyor...
                  </>
                ) : (
                  <>
                    <Bot className="w-3.5 h-3.5" />
                    AI ile Tara
                  </>
                )}
              </button>
            </div>

            {/* AI Detection results */}
            {aiDetectedList.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Yapay Zeka Tarafından Tespit Edilenler ({aiDetectedList.length}):
                </div>
                <div className="space-y-1.5 max-h-[160px] overflow-y-auto">
                  {aiDetectedList.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-purple-50/50 border border-purple-200 flex items-center justify-between text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="font-bold text-purple-950">&ldquo;{item.text}&rdquo;</div>
                        <div className="text-[10px] text-purple-700">{item.reason || "Filigran / Damga"}</div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-purple-200 text-purple-800 text-[10px] font-bold">
                        %{item.confidence}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Custom text removal */}
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
                placeholder="Örn: GEÇERSİZ, ÖRNEK BELGEDİR, TASLAK, www.site.com, CamScanner..."
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <p className="text-[11px] text-slate-400">
                Girdiğiniz metin, sayfalardaki tüm metin blokları taranarak hem vektörel olarak temizlenir hem de üzeri akıllı arka planla maskelenir.
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
            disabled={isApplying || isAutoCleaning}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            Vazgeç
          </button>

          <button
            type="button"
            onClick={handleApply}
            disabled={isApplying || isScanning || isAutoCleaning || totalSelectedCount === 0}
            className={`inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white rounded-lg shadow-sm transition-all cursor-pointer ${
              totalSelectedCount > 0 && !isApplying && !isAutoCleaning
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
                Seçilenleri Sil ve Uygula
                {totalSelectedCount > 0 && ` (${totalSelectedCount})`}
              </>
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
