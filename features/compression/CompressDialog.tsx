"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Archive, ArrowDown, CheckCircle2, Download, FileText, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  compressPdfDocument,
  estimateCompressedSize,
  PRESET_CONFIGS,
  type CompressionPreset,
  type CompressionResult
} from "./compressPdf";
import { download } from "@/lib/documents";

interface CompressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pdfBytes?: Uint8Array;
  fileName?: string;
}

export function CompressDialog({
  open,
  onOpenChange,
  pdfBytes,
  fileName = "belge.pdf"
}: CompressDialogProps) {
  const [preset, setPreset] = useState<CompressionPreset>("balanced");
  const [customDpi, setCustomDpi] = useState(120);
  const [customQuality, setCustomQuality] = useState(0.65);
  const [isCompressing, setIsCompressing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<CompressionResult | null>(null);

  const originalSize = pdfBytes ? pdfBytes.byteLength : 1024 * 1024;
  const estimatedSize = estimateCompressedSize(originalSize, preset, customQuality);
  const estimatedSavings = Math.round(((originalSize - estimatedSize) / originalSize) * 100);

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleCompress = async () => {
    if (!pdfBytes) {
      toast.error("PDF verisi bulunamadı.");
      return;
    }

    setIsCompressing(true);
    setProgress(10);
    setResult(null);

    try {
      const res = await compressPdfDocument(
        pdfBytes,
        {
          preset,
          dpi: customDpi,
          quality: customQuality
        },
        (cur, total) => {
          setProgress(Math.round((cur / total) * 100));
        }
      );

      setResult(res);
      toast.success("PDF başarıyla sıkıştırıldı!");
    } catch (err: any) {
      console.error("Compression error:", err);
      toast.error("Sıkıştırma sırasında bir hata oluştu.");
    } finally {
      setIsCompressing(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const cleanName = fileName.replace(/\.pdf$/i, "");
    download(
      new Blob([result.compressedBytes.buffer as ArrayBuffer], { type: "application/pdf" }),
      `${cleanName}_sikistirilmis.pdf`
    );
    toast.success("Sıkıştırılmış PDF indirildi.");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-white rounded-xl shadow-2xl p-6 border border-slate-100">
        <DialogTitle className="text-xl font-semibold text-slate-900 flex items-center gap-2">
          <Archive className="w-5 h-5 text-indigo-600" />
          PDF Dosyasını Sıkıştır
        </DialogTitle>
        <DialogDescription className="text-sm text-slate-500 mt-1">
          Görüntü kalitesini optimize ederek dosya boyutunu küçültün. Tamamen tarayıcınızda işlenir.
        </DialogDescription>

        {!result ? (
          <div className="space-y-5 mt-4">
            {/* Presets */}
            <div className="space-y-2.5">
              {(Object.keys(PRESET_CONFIGS) as Array<Exclude<CompressionPreset, "custom">>).map((key) => {
                const cfg = PRESET_CONFIGS[key];
                const active = preset === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPreset(key)}
                    className={`w-full text-left p-3.5 rounded-lg border transition-all ${
                      active
                        ? "border-indigo-500 bg-indigo-50/60 ring-1 ring-indigo-500"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-900">{cfg.label}</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        ~%{key === "light" ? 30 : key === "balanced" ? 55 : 72} tasarruf
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{cfg.desc}</p>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => setPreset("custom")}
                className={`w-full text-left p-3.5 rounded-lg border transition-all ${
                  preset === "custom"
                    ? "border-indigo-500 bg-indigo-50/60 ring-1 ring-indigo-500"
                    : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-900">Özel Ayarlar</span>
                  <span className="text-xs text-slate-500">DPI ve Kaliteyi Kendin Belirle</span>
                </div>
              </button>
            </div>

            {/* Custom sliders if custom is chosen */}
            {preset === "custom" && (
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-4">
                <div>
                  <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                    <span>Çözünürlük (DPI)</span>
                    <span>{customDpi} DPI</span>
                  </div>
                  <input
                    type="range"
                    min="72"
                    max="200"
                    step="10"
                    value={customDpi}
                    onChange={(e) => setCustomDpi(Number(e.target.value))}
                    className="w-full accent-indigo-600"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                    <span>Görüntü Kalitesi</span>
                    <span>%{Math.round(customQuality * 100)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.3"
                    max="0.95"
                    step="0.05"
                    value={customQuality}
                    onChange={(e) => setCustomQuality(Number(e.target.value))}
                    className="w-full accent-indigo-600"
                  />
                </div>
              </div>
            )}

            {/* Rasterization Warning for Strong and Custom modes */}
            {(preset === "strong" || preset === "custom") && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2.5 text-xs text-amber-900">
                <span className="text-base leading-none">⚠️</span>
                <div>
                  <strong className="font-semibold block">Rasterizasyon Uyarısı:</strong>
                  <span>Bu mod sayfaları görsel katmanına dönüştürür. Metin seçilebilirliği, köprü bağlantıları ve interaktif form alanları düzleştirilip görsele gömülecektir.</span>
                </div>
              </div>
            )}

            {/* Estimated preview card */}
            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-lg flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 block">Orijinal Boyut</span>
                <span className="text-sm font-semibold text-slate-700">{formatBytes(originalSize)}</span>
              </div>
              <div className="text-indigo-500 font-bold text-sm">→</div>
              <div className="text-right">
                <span className="text-xs text-indigo-600 font-medium block">Tahmini Boyut (-%{estimatedSavings})</span>
                <span className="text-sm font-bold text-indigo-700">{formatBytes(estimatedSize)}</span>
              </div>
            </div>

            {/* Progress if compressing */}
            {isCompressing && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium text-indigo-900">
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                    Sayfalar optimize ediliyor…
                  </span>
                  <span>%{progress}</span>
                </div>
                <div className="w-full h-2 bg-indigo-100 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-600 transition-all duration-300" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Vazgeç
              </button>
              <button
                type="button"
                disabled={isCompressing}
                onClick={handleCompress}
                className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm disabled:opacity-60"
              >
                {isCompressing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
                Sıkıştırmayı Başlat
              </button>
            </div>
          </div>
        ) : (
          /* Result view */
          <div className="space-y-5 mt-4">
            {result.reductionPercentage === 0 ? (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-center space-y-2">
                <FileText className="w-8 h-8 text-slate-500 mx-auto" />
                <h4 className="font-semibold text-slate-900 text-base">Belge Zaten Optimum Düzeyde</h4>
                <p className="text-xs text-slate-600">
                  Bu belge zaten sıkıştırılmış nesne akışlarına sahip veya daha fazla kayıpsız küçültme yapılamıyor (%0 azalma).
                </p>
                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-200 text-center">
                  <div>
                    <span className="text-xs text-slate-500 block">Boyut</span>
                    <span className="text-sm font-semibold text-slate-800">{formatBytes(result.originalSize)}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">Durum</span>
                    <span className="text-sm font-medium text-indigo-600">%100 Orijinal Korundu</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                <h4 className="font-semibold text-emerald-900 text-base">Sıkıştırma Tamamlandı!</h4>
                <p className="text-xs text-emerald-700">Dosyanız başarıyla optimize edildi ve küçültüldü.</p>

                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-emerald-200/70 text-center">
                  <div>
                    <span className="text-xs text-emerald-600 block">Önceki</span>
                    <span className="text-sm font-semibold text-slate-800">{formatBytes(result.originalSize)}</span>
                  </div>
                  <div>
                    <span className="text-xs text-emerald-600 block">Sonraki</span>
                    <span className="text-sm font-bold text-emerald-700">{formatBytes(result.compressedSize)}</span>
                  </div>
                  <div>
                    <span className="text-xs text-emerald-600 block">Tasarruf</span>
                    <span className="text-sm font-extrabold text-emerald-600">-%{result.reductionPercentage}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => setResult(null)}
                className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Tekrar Dene
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm"
              >
                <Download className="w-4 h-4" />
                Sıkıştırılmış Belgeyi İndir
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
