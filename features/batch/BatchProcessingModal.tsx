"use client";

import React, { useState, useRef } from "react";
import {
  Layers,
  Upload,
  Play,
  X,
  FileArchive,
  FileSpreadsheet,
  FileCode,
  RotateCw,
  Trash2,
  Lock,
  Stamp,
  Hash,
  Minimize2,
  FileCheck2,
  Combine,
  Image as ImageIcon,
} from "lucide-react";
import type { BatchConfig, BatchFileItem, BatchOperation } from "./batchTypes";
import { runBatchQueue, createBatchZip, generateBatchCsvReport } from "./batchProcessor";

interface BatchProcessingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const OPERATIONS: { id: BatchOperation; label: string; icon: React.ComponentType<any>; desc: string }[] = [
  { id: "compress", label: "PDF Sıkıştırma", icon: Minimize2, desc: "Dosya boyutunu kaliteden ödün vermeden küçültür" },
  { id: "watermark", label: "Filigran Ekle", icon: Stamp, desc: "Belgelerin üzerine metin filigranı uygular" },
  { id: "page_number", label: "Sayfa Numaralandırma", icon: Hash, desc: "Tüm sayfalara standart sayfa numarası basar" },
  { id: "protect", label: "Parola Koruması", icon: Lock, desc: "AES-256 ile açılış parolası koyar" },
  { id: "sanitize_metadata", label: "Üstveri Temizliği", icon: FileCheck2, desc: "Yazar, tarih ve gizli XMP verilerini siler" },
  { id: "images_to_pdf", label: "Görsellerden PDF", icon: ImageIcon, desc: "Yüklenen PNG/JPG görsellerini PDF sayfasına dönüştürür" },
  { id: "merge", label: "PDF Birleştirme", icon: Combine, desc: "Tüm PDF'leri sırayla tek bir belgede toplar" },
];

export function BatchProcessingModal({ isOpen, onClose }: BatchProcessingModalProps) {
  const [items, setItems] = useState<BatchFileItem[]>([]);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [cancelledIds, setCancelledIds] = useState<Set<string>>(new Set());

  const [config, setConfig] = useState<BatchConfig>({
    operation: "compress",
    compressPreset: "balanced",
    watermarkText: "GİZLİ",
    watermarkOpacity: 0.25,
    pageNumberFormat: "1",
    password: "",
    maxConcurrent: 2,
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFilesAdded = async (files: File[]) => {
    const newItems: BatchFileItem[] = [];
    for (const f of files) {
      const buffer = await f.arrayBuffer();
      newItems.push({
        id: `batch_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name: f.name,
        size: f.size,
        status: "pending",
        progress: 0,
        bytes: new Uint8Array(buffer),
      });
    }
    setItems((prev) => [...prev, ...newItems]);
  };

  const handleStartQueue = async () => {
    if (!items.length) return;
    if (config.operation === "protect" && !config.password) {
      alert("Lütfen koruma için bir parola belirleyin.");
      return;
    }

    setIsRunning(true);
    setCancelledIds(new Set());

    try {
      const results = await runBatchQueue(
        items,
        config,
        (_itemId, _itemProg, _completed, _total, _msg) => {
          setItems((prev) => [...prev]);
        },
        (id) => cancelledIds.has(id)
      );
      setItems(results);
    } catch (err: unknown) {
      alert(`Kuyruk hatası: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleDownloadZip = async () => {
    const successItems = items.filter((i) => i.status === "success" && i.resultBytes);
    if (!successItems.length) {
      alert("İndirilecek başarılı işlem çıktısı bulunamadı.");
      return;
    }

    try {
      const zipBytes = await createBatchZip(successItems);
      const blob = new Blob([zipBytes as unknown as BlobPart], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `toplu_cikti_${Date.now()}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      alert(`ZIP oluşturma hatası: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleDownloadCsv = () => {
    const csv = generateBatchCsvReport(items, config.operation);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `toplu_islem_raporu_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadJson = () => {
    const jsonStr = JSON.stringify(
      items.map((i) => ({
        name: i.name,
        size: i.size,
        status: i.status,
        resultName: i.resultName,
        executionTimeMs: i.executionTimeMs,
        error: i.error,
      })),
      null,
      2
    );
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `toplu_islem_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCancelItem = (id: string) => {
    setCancelledIds((prev) => new Set([...prev, id]));
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, status: "cancelled", progress: 0 } : it))
    );
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const successCount = items.filter((i) => i.status === "success").length;
  const errorCount = items.filter((i) => i.status === "error").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative flex flex-col w-full max-w-5xl h-[85vh] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                Toplu Dosya İşlemleri Kuyruğu
              </h2>
              <p className="text-xs text-slate-400">
                Birden fazla PDF ve görseli tek seferde sıkıştırın, koruyun, filigranlayın veya birleştirin.
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

        {/* Operation Selection Bar */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/40">
          <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
            Toplu İşlem Türü Seçin
          </label>
          <div className="grid grid-cols-4 gap-2">
            {OPERATIONS.map((op) => {
              const Icon = op.icon;
              const isSel = config.operation === op.id;
              return (
                <button
                  key={op.id}
                  onClick={() => setConfig((prev) => ({ ...prev, operation: op.id }))}
                  className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-colors ${
                    isSel
                      ? "bg-indigo-600/20 border-indigo-500 text-white"
                      : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isSel ? "text-indigo-400" : "text-slate-500"}`} />
                  <div>
                    <div className="text-xs font-medium leading-none">{op.label}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Operation Specific Configs */}
          {config.operation === "watermark" && (
            <div className="mt-3 flex items-center gap-3 text-xs">
              <span className="text-slate-400">Filigran Metni:</span>
              <input
                type="text"
                value={config.watermarkText}
                onChange={(e) => setConfig((prev) => ({ ...prev, watermarkText: e.target.value }))}
                className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200"
              />
            </div>
          )}

          {config.operation === "protect" && (
            <div className="mt-3 flex items-center gap-3 text-xs">
              <span className="text-slate-400">Koruma Parolası:</span>
              <input
                type="password"
                value={config.password}
                placeholder="Şifre girin..."
                onChange={(e) => setConfig((prev) => ({ ...prev, password: e.target.value }))}
                className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200"
              />
            </div>
          )}
        </div>

        {/* Content Body: Queue List */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-950/30">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  handleFilesAdded(files);
                  e.target.value = "";
                }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors shadow-sm"
              >
                <Upload className="w-3.5 h-3.5" />
                Dosya Ekle
              </button>
              <span className="text-xs text-slate-400">
                Toplam {items.length} dosya kuyrukta
              </span>
            </div>

            {items.length > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-emerald-400 font-medium">✓ {successCount} Başarılı</span>
                {errorCount > 0 && <span className="text-rose-400 font-medium">✕ {errorCount} Hatalı</span>}
              </div>
            )}
          </div>

          {items.length === 0 ? (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const files = Array.from(e.dataTransfer.files);
                handleFilesAdded(files);
              }}
              className="flex flex-col items-center justify-center border-2 border-dashed border-slate-800 rounded-xl p-12 text-center text-slate-500"
            >
              <Layers className="w-10 h-10 text-slate-700 mb-2" />
              <p className="text-xs font-medium text-slate-400">
                Toplu işlenecek dosyaları buraya sürükleyin veya &quot;Dosya Ekle&quot; butonuna basın.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs"
                >
                  <div className="flex items-center gap-3 max-w-[50%]">
                    <span className="font-medium text-slate-200 truncate">{item.name}</span>
                    <span className="text-[10px] text-slate-500">
                      {(item.size / 1024).toFixed(1)} KB
                    </span>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Status badge */}
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        item.status === "success"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : item.status === "error"
                          ? "bg-rose-500/20 text-rose-300"
                          : item.status === "processing"
                          ? "bg-indigo-500/20 text-indigo-300 animate-pulse"
                          : item.status === "cancelled"
                          ? "bg-slate-800 text-slate-500"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {item.status === "success"
                        ? "Başarılı"
                        : item.status === "error"
                        ? "Hata"
                        : item.status === "processing"
                        ? `İşleniyor (%${item.progress})`
                        : item.status === "cancelled"
                        ? "İptal Edildi"
                        : "Bekliyor"}
                    </span>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1">
                      {item.status === "processing" && (
                        <button
                          onClick={() => handleCancelItem(item.id)}
                          title="İptal Et"
                          className="p-1 text-slate-400 hover:text-white"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {!isRunning && (
                        <button
                          onClick={() => handleRemoveItem(item.id)}
                          title="Kaldır"
                          className="p-1 text-slate-500 hover:text-rose-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              Kapat
            </button>

            {successCount > 0 && (
              <>
                <button
                  onClick={handleDownloadZip}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors shadow-sm"
                >
                  <FileArchive className="w-3.5 h-3.5" />
                  ZIP İndir ({successCount} Dosya)
                </button>
                <button
                  onClick={handleDownloadCsv}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition-colors"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-400" />
                  CSV Raporu
                </button>
                <button
                  onClick={handleDownloadJson}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition-colors"
                >
                  <FileCode className="w-3.5 h-3.5 text-indigo-400" />
                  JSON
                </button>
              </>
            )}
          </div>

          <button
            onClick={handleStartQueue}
            disabled={isRunning || items.length === 0}
            className="flex items-center gap-2 px-5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow-md transition-colors disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5" />
            {isRunning ? "Kuyruk İşleniyor..." : "Kuyruğu Başlat"}
          </button>
        </div>
      </div>
    </div>
  );
}
