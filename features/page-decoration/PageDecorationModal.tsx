"use client";

import React, { useState } from "react";
import {
  Stamp,
  Hash,
  PanelTop,
  X,
  Check,
  AlertTriangle,
  Download,
  FileText,
  Upload,
} from "lucide-react";
import type {
  PageDecorationConfig,
  WatermarkType,
  PageScope,
  PageNumberFormat,
  NinePosition,
} from "./decorationTypes";
import { applyPageDecorations } from "./applyDecoration";

interface PageDecorationModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfBytes?: Uint8Array | null;
  fileName?: string;
  onApplyToWorkspace?: (modifiedPdfBytes: Uint8Array) => void;
}

const NINE_POSITIONS: { id: NinePosition; label: string }[] = [
  { id: "top-left", label: "Sol Üst" },
  { id: "top-center", label: "Orta Üst" },
  { id: "top-right", label: "Sağ Üst" },
  { id: "middle-left", label: "Sol Orta" },
  { id: "middle-center", label: "Merkez" },
  { id: "middle-right", label: "Sağ Orta" },
  { id: "bottom-left", label: "Sol Alt" },
  { id: "bottom-center", label: "Orta Alt" },
  { id: "bottom-right", label: "Sağ Alt" },
];

export function PageDecorationModal({
  isOpen,
  onClose,
  pdfBytes,
  fileName = "belge.pdf",
  onApplyToWorkspace,
}: PageDecorationModalProps) {
  const [activeTab, setActiveTab] = useState<"watermark" | "pagenum" | "headerfooter">("watermark");
  const [isProcessing, setIsProcessing] = useState(false);

  const [config, setConfig] = useState<PageDecorationConfig>({
    watermark: {
      enabled: false,
      type: "text",
      text: "GİZLİ & ŞAHSİ",
      fontSize: 42,
      color: "#94a3b8",
      opacity: 0.25,
      rotation: 45,
      layer: "foreground",
      tile: false,
      position: { xPercent: 50, yPercent: 50 },
      scope: "all",
    },
    pageNumber: {
      enabled: false,
      format: "1",
      template: "Sayfa {n} / {total}",
      startNumber: 1,
      startFromPage: 1,
      excludeCover: false,
      position: "bottom-center",
      fontSize: 10,
      color: "#475569",
      margin: 24,
    },
    headerFooter: {
      enabled: false,
      headerLeft: "",
      headerCenter: "{dosya}",
      headerRight: "{tarih}",
      footerLeft: "Forma Düzenleyici",
      footerCenter: "",
      footerRight: "{sayfa} / {toplam}",
      fontSize: 9,
      color: "#475569",
      margin: 24,
      excludeCover: true,
    },
    fileName,
  });

  if (!isOpen) return null;

  const handleApply = async (importToWorkspace: boolean = false) => {
    if (!pdfBytes) {
      alert("Düzenlenecek PDF belgesi bulunamadı.");
      return;
    }

    setIsProcessing(true);
    try {
      const modifiedBytes = await applyPageDecorations(pdfBytes, config);

      if (importToWorkspace && onApplyToWorkspace) {
        onApplyToWorkspace(modifiedBytes);
        onClose();
      } else {
        const blob = new Blob([modifiedBytes as unknown as BlobPart], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `suslenmis_${fileName}`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err: unknown) {
      alert(`İşlem sırasında hata oluştu: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setConfig((prev) => ({
        ...prev,
        watermark: {
          ...prev.watermark,
          imageDataUrl: reader.result as string,
        },
      }));
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative flex flex-col w-full max-w-4xl h-[85vh] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg">
              <Stamp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                Filigran, Sayfa Numarası ve Üst/Alt Bilgi
              </h2>
              <p className="text-xs text-slate-400">
                PDF sayfalarına standart filigranlar, sayfa numaraları ve üst/alt bilgi şablonları ekleyin.
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

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-slate-800 bg-slate-950/40">
          <button
            onClick={() => setActiveTab("watermark")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
              activeTab === "watermark"
                ? "border-indigo-500 text-indigo-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Stamp className="w-4 h-4" />
            Filigran
            {config.watermark.enabled && (
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("pagenum")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
              activeTab === "pagenum"
                ? "border-indigo-500 text-indigo-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Hash className="w-4 h-4" />
            Sayfa Numarası
            {config.pageNumber.enabled && (
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("headerfooter")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
              activeTab === "headerfooter"
                ? "border-indigo-500 text-indigo-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <PanelTop className="w-4 h-4" />
            Üst ve Alt Bilgi
            {config.headerFooter.enabled && (
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            )}
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-950/30">
          {/* TAB 1: FILIGRAN */}
          {activeTab === "watermark" && (
            <div className="max-w-2xl mx-auto space-y-5">
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/40 border border-slate-700">
                <span className="text-sm font-medium">Filigranı Etkinleştir</span>
                <input
                  type="checkbox"
                  checked={config.watermark.enabled}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      watermark: { ...prev.watermark, enabled: e.target.checked },
                    }))
                  }
                  className="w-4 h-4 rounded accent-indigo-500 cursor-pointer"
                />
              </div>

              {config.watermark.enabled && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  {/* Type Selector */}
                  <div className="grid grid-cols-2 gap-2 bg-slate-900 p-1 rounded-lg border border-slate-800">
                    {(["text", "image"] as WatermarkType[]).map((t) => (
                      <button
                        key={t}
                        onClick={() =>
                          setConfig((prev) => ({
                            ...prev,
                            watermark: { ...prev.watermark, type: t },
                          }))
                        }
                        className={`py-1.5 text-xs font-medium rounded transition-colors ${
                          config.watermark.type === t
                            ? "bg-indigo-600 text-white"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        {t === "text" ? "Metin Filigranı" : "Logo / Görsel Filigranı"}
                      </button>
                    ))}
                  </div>

                  {config.watermark.type === "text" ? (
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Filigran Metni</label>
                      <input
                        type="text"
                        value={config.watermark.text}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            watermark: { ...prev.watermark, text: e.target.value },
                          }))
                        }
                        placeholder="Örn: GİZLİ, TASLAK, KOPYALANAMAZ"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Görsel / Logo Seç (PNG/JPG)</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="file"
                          accept="image/png,image/jpeg"
                          onChange={handleImageUpload}
                          className="text-xs text-slate-400 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700"
                        />
                        {config.watermark.imageDataUrl && (
                          <span className="text-xs text-emerald-400 flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> Görsel yüklendi
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Sliders */}
                  <div className="grid grid-cols-3 gap-4 pt-2">
                    <div>
                      <div className="flex justify-between text-xs text-slate-400 mb-1">
                        <span>Opaklık</span>
                        <span>%{Math.round(config.watermark.opacity * 100)}</span>
                      </div>
                      <input
                        type="range"
                        min="0.05"
                        max="1"
                        step="0.05"
                        value={config.watermark.opacity}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            watermark: {
                              ...prev.watermark,
                              opacity: parseFloat(e.target.value),
                            },
                          }))
                        }
                        className="w-full accent-indigo-500"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs text-slate-400 mb-1">
                        <span>Döndürme</span>
                        <span>{config.watermark.rotation}°</span>
                      </div>
                      <input
                        type="range"
                        min="-90"
                        max="90"
                        step="5"
                        value={config.watermark.rotation}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            watermark: {
                              ...prev.watermark,
                              rotation: parseInt(e.target.value),
                            },
                          }))
                        }
                        className="w-full accent-indigo-500"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs text-slate-400 mb-1">
                        <span>Boyut</span>
                        <span>{config.watermark.fontSize} pt</span>
                      </div>
                      <input
                        type="range"
                        min="16"
                        max="96"
                        step="2"
                        value={config.watermark.fontSize}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            watermark: {
                              ...prev.watermark,
                              fontSize: parseInt(e.target.value),
                            },
                          }))
                        }
                        className="w-full accent-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Tile & Scope */}
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.watermark.tile}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            watermark: { ...prev.watermark, tile: e.target.checked },
                          }))
                        }
                        className="rounded accent-indigo-500"
                      />
                      Tekrar Eden Karo Deseni (Tüm Sayfaya Yay)
                    </label>

                    <div className="flex items-center gap-2 justify-end text-xs text-slate-300">
                      <span>Kapsam:</span>
                      <select
                        value={config.watermark.scope}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            watermark: {
                              ...prev.watermark,
                              scope: e.target.value as PageScope,
                            },
                          }))
                        }
                        className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200"
                      >
                        <option value="all">Tüm Sayfalar</option>
                        <option value="odd">Yalnızca Tek Sayfalar</option>
                        <option value="even">Yalnızca Çift Sayfalar</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SAYFA NUMARASI */}
          {activeTab === "pagenum" && (
            <div className="max-w-2xl mx-auto space-y-5">
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/40 border border-slate-700">
                <span className="text-sm font-medium">Sayfa Numaralandırmasını Etkinleştir</span>
                <input
                  type="checkbox"
                  checked={config.pageNumber.enabled}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      pageNumber: { ...prev.pageNumber, enabled: e.target.checked },
                    }))
                  }
                  className="w-4 h-4 rounded accent-indigo-500 cursor-pointer"
                />
              </div>

              {config.pageNumber.enabled && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  {/* Format & Template */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Numara Biçimi</label>
                      <select
                        value={config.pageNumber.format}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            pageNumber: {
                              ...prev.pageNumber,
                              format: e.target.value as PageNumberFormat,
                            },
                          }))
                        }
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200"
                      >
                        <option value="1">1, 2, 3...</option>
                        <option value="01">01, 02, 03...</option>
                        <option value="i">i, ii, iii (Romen küçük)</option>
                        <option value="I">I, II, III (Romen büyük)</option>
                        <option value="a">a, b, c...</option>
                        <option value="A">A, B, C...</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Metin Şablonu</label>
                      <input
                        type="text"
                        value={config.pageNumber.template}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            pageNumber: { ...prev.pageNumber, template: e.target.value },
                          }))
                        }
                        placeholder="Örn: Sayfa {n} / {total} veya {n}"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200"
                      />
                    </div>
                  </div>

                  {/* 9-Position Selector */}
                  <div>
                    <label className="text-xs text-slate-400 block mb-2">Konum (9 Nokta)</label>
                    <div className="grid grid-cols-3 gap-2 max-w-sm mx-auto bg-slate-950 p-2 rounded-lg border border-slate-800">
                      {NINE_POSITIONS.map((pos) => (
                        <button
                          key={pos.id}
                          onClick={() =>
                            setConfig((prev) => ({
                              ...prev,
                              pageNumber: { ...prev.pageNumber, position: pos.id },
                            }))
                          }
                          className={`py-2 text-[11px] font-medium rounded transition-colors ${
                            config.pageNumber.position === pos.id
                              ? "bg-indigo-600 text-white font-semibold"
                              : "bg-slate-900 text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          {pos.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Starting Number & Exclude Cover */}
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.pageNumber.excludeCover}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            pageNumber: { ...prev.pageNumber, excludeCover: e.target.checked },
                          }))
                        }
                        className="rounded accent-indigo-500"
                      />
                      Kapak Sayfasını Hariç Tut (1. Sayfaya Yazma)
                    </label>

                    <div className="flex items-center gap-2 justify-end text-xs text-slate-300">
                      <span>Başlangıç Numarası:</span>
                      <input
                        type="number"
                        min="1"
                        value={config.pageNumber.startNumber}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            pageNumber: {
                              ...prev.pageNumber,
                              startNumber: parseInt(e.target.value) || 1,
                            },
                          }))
                        }
                        className="w-16 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 text-center"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ÜST/ALT BİLGİ */}
          {activeTab === "headerfooter" && (
            <div className="max-w-2xl mx-auto space-y-5">
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/40 border border-slate-700">
                <span className="text-sm font-medium">Üst ve Alt Bilgiyi Etkinleştir</span>
                <input
                  type="checkbox"
                  checked={config.headerFooter.enabled}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      headerFooter: { ...prev.headerFooter, enabled: e.target.checked },
                    }))
                  }
                  className="w-4 h-4 rounded accent-indigo-500 cursor-pointer"
                />
              </div>

              {config.headerFooter.enabled && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <p className="text-xs text-slate-400">
                    Kullanılabilir etiketler: <code className="text-indigo-400">{`{tarih}`}</code>,{" "}
                    <code className="text-indigo-400">{`{saat}`}</code>,{" "}
                    <code className="text-indigo-400">{`{dosya}`}</code>,{" "}
                    <code className="text-indigo-400">{`{sayfa}`}</code>,{" "}
                    <code className="text-indigo-400">{`{toplam}`}</code>
                  </p>

                  {/* Header 3 Columns */}
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Üst Bilgi (Header)
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="text"
                        placeholder="Sol üst..."
                        value={config.headerFooter.headerLeft}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            headerFooter: { ...prev.headerFooter, headerLeft: e.target.value },
                          }))
                        }
                        className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                      />
                      <input
                        type="text"
                        placeholder="Orta üst..."
                        value={config.headerFooter.headerCenter}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            headerFooter: { ...prev.headerFooter, headerCenter: e.target.value },
                          }))
                        }
                        className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 text-center"
                      />
                      <input
                        type="text"
                        placeholder="Sağ üst..."
                        value={config.headerFooter.headerRight}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            headerFooter: { ...prev.headerFooter, headerRight: e.target.value },
                          }))
                        }
                        className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 text-right"
                      />
                    </div>
                  </div>

                  {/* Footer 3 Columns */}
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Alt Bilgi (Footer)
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="text"
                        placeholder="Sol alt..."
                        value={config.headerFooter.footerLeft}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            headerFooter: { ...prev.headerFooter, footerLeft: e.target.value },
                          }))
                        }
                        className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                      />
                      <input
                        type="text"
                        placeholder="Orta alt..."
                        value={config.headerFooter.footerCenter}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            headerFooter: { ...prev.headerFooter, footerCenter: e.target.value },
                          }))
                        }
                        className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 text-center"
                      />
                      <input
                        type="text"
                        placeholder="Sağ alt..."
                        value={config.headerFooter.footerRight}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            headerFooter: { ...prev.headerFooter, footerRight: e.target.value },
                          }))
                        }
                        className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 text-right"
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer pt-2">
                    <input
                      type="checkbox"
                      checked={config.headerFooter.excludeCover}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          headerFooter: { ...prev.headerFooter, excludeCover: e.target.checked },
                        }))
                      }
                      className="rounded accent-indigo-500"
                    />
                    Kapak Sayfasını Hariç Tut
                  </label>
                </div>
              )}
            </div>
          )}

          {/* Digital Signature Warning Alert */}
          <div className="max-w-2xl mx-auto mt-6 p-3 rounded-lg bg-amber-950/40 border border-amber-800/60 text-amber-300 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
            <span>
              <strong>Önemli Uyarı:</strong> Sayfa süslemeleri (filigran, sayfa numarası ve üst/alt bilgi) PDF içerik akışına kalıcı olarak yazılır. Belgede önceden eklenmiş geçerli bir dijital imza varsa, bu işlem imzanın geçersizleşmesine sebep olabilir.
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-900/90">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            İptal
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleApply(false)}
              disabled={isProcessing}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow-md transition-colors disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              Süsle ve İndir
            </button>

            {onApplyToWorkspace && (
              <button
                onClick={() => handleApply(true)}
                disabled={isProcessing}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition-colors disabled:opacity-50"
              >
                <FileText className="w-4 h-4 text-emerald-400" />
                Çalışma Alanına Uygula
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
