"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Camera,
  Upload,
  RotateCw,
  Crop,
  Copy,
  Trash2,
  FileText,
  Download,
  X,
  Check,
  RefreshCw,
  SplitSquareVertical,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import type { ScannedPage, ImageAdjustments, FilterMode, ScannerExportOptions } from "./scannerTypes";
import {
  detectDocumentEdges,
  warpPerspective,
  detectDeskewAngle,
  applyDocumentAdjustments,
} from "./imageProcessing";
import { startCamera, stopCamera, captureFrame } from "./cameraManager";
import { exportScannedPdf } from "./scannerPdfExport";

interface DocumentScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportToWorkspace?: (pdfBytes: Uint8Array, fileName: string) => void;
}

const DEFAULT_ADJUSTMENTS: ImageAdjustments = {
  brightness: 0,
  contrast: 0,
  sharpness: 0,
  shadowReduction: 0,
  filterMode: "color",
  deskewAngle: 0,
};

let scanCounter = 0;
function generateScanId(): string {
  scanCounter += 1;
  return `scan_${Date.now()}_${scanCounter}`;
}

export function DocumentScannerModal({
  isOpen,
  onClose,
  onImportToWorkspace,
}: DocumentScannerModalProps) {
  const [pages, setPages] = useState<ScannedPage[]>([]);
  const [activePageIndex, setActivePageIndex] = useState<number>(0);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressMsg, setProgressMsg] = useState<string>("");
  const [showSideBySide, setShowSideBySide] = useState<boolean>(false);

  // Export settings
  const [exportOptions, setExportOptions] = useState<ScannerExportOptions>({
    fitToA4: true,
    margin: "small",
    applyOcr: false,
    ocrLanguage: "tur",
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activePage = pages[activePageIndex] || null;

  // Cleanup camera stream
  const handleStopCamera = useCallback(() => {
    stopCamera(cameraStreamRef.current, videoRef.current);
    cameraStreamRef.current = null;
    setIsCameraActive(false);
    setCameraError(null);
  }, []);

  useEffect(() => {
    return () => {
      handleStopCamera();
    };
  }, [handleStopCamera]);

  const addImageFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (!dataUrl) return;

      const img = new Image();
      img.onload = () => {
        const newPage: ScannedPage = {
          id: generateScanId(),
          originalDataUrl: dataUrl,
          processedDataUrl: dataUrl,
          width: img.width,
          height: img.height,
          rotation: 0,
          adjustments: { ...DEFAULT_ADJUSTMENTS },
        };
        setPages((prev) => [...prev, newPage]);
        setActivePageIndex(pages.length);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  // Clipboard paste support
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          const file = items[i].getAsFile();
          if (file) {
            addImageFile(file);
          }
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [isOpen]);

  const handleStartCamera = async () => {
    if (!videoRef.current) return;
    setCameraError(null);
    const res = await startCamera(videoRef.current);
    if (res.success && res.stream) {
      cameraStreamRef.current = res.stream;
      setIsCameraActive(true);
    } else {
      setCameraError(res.error || "Kamera başlatılamadı.");
      setIsCameraActive(false);
    }
  };

  const handleCaptureCamera = () => {
    if (!videoRef.current) return;
    const capturedDataUrl = captureFrame(videoRef.current);
    if (capturedDataUrl) {
      const img = new Image();
      img.onload = () => {
        const newPage: ScannedPage = {
          id: `scan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          originalDataUrl: capturedDataUrl,
          processedDataUrl: capturedDataUrl,
          width: img.width,
          height: img.height,
          rotation: 0,
          adjustments: { ...DEFAULT_ADJUSTMENTS },
        };
        setPages((prev) => [...prev, newPage]);
        setActivePageIndex(pages.length);
      };
      img.src = capturedDataUrl;
    }
  };

  // Re-run adjustments on active page
  const updateActivePageAdjustments = useCallback(
    (newAdjustments: Partial<ImageAdjustments>) => {
      if (!activePage) return;

      const updatedAdj: ImageAdjustments = {
        ...activePage.adjustments,
        ...newAdjustments,
      };

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, img.width, img.height);
        const processed = applyDocumentAdjustments(imgData, updatedAdj);
        ctx.putImageData(processed, 0, 0);

        const newProcessedUrl = canvas.toDataURL("image/jpeg", 0.92);

        setPages((prev) =>
          prev.map((p, idx) =>
            idx === activePageIndex
              ? {
                  ...p,
                  adjustments: updatedAdj,
                  processedDataUrl: newProcessedUrl,
                }
              : p
          )
        );
      };
      img.src = activePage.originalDataUrl;
    },
    [activePage, activePageIndex]
  );

  // Auto edge detection
  const handleAutoDetectEdges = () => {
    if (!activePage) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, img.width, img.height);
      const edges = detectDocumentEdges(imgData);

      setPages((prev) =>
        prev.map((p, idx) =>
          idx === activePageIndex ? { ...p, corners: edges } : p
        )
      );
    };
    img.src = activePage.processedDataUrl || activePage.originalDataUrl;
  };

  // Perspective warp
  const handlePerspectiveWarp = () => {
    if (!activePage) return;
    const corners =
      activePage.corners || {
        topLeft: { x: 0, y: 0 },
        topRight: { x: activePage.width, y: 0 },
        bottomRight: { x: activePage.width, y: activePage.height },
        bottomLeft: { x: 0, y: activePage.height },
      };

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, img.width, img.height);
      const warped = warpPerspective(imgData, corners);

      const outCanvas = document.createElement("canvas");
      outCanvas.width = warped.width;
      outCanvas.height = warped.height;
      const outCtx = outCanvas.getContext("2d");
      if (!outCtx) return;
      outCtx.putImageData(warped, 0, 0);

      const warpedUrl = outCanvas.toDataURL("image/jpeg", 0.92);

      setPages((prev) =>
        prev.map((p, idx) =>
          idx === activePageIndex
            ? {
                ...p,
                processedDataUrl: warpedUrl,
                width: warped.width,
                height: warped.height,
                corners: undefined,
              }
            : p
        )
      );
    };
    img.src = activePage.processedDataUrl || activePage.originalDataUrl;
  };

  // Auto deskew
  const handleAutoDeskew = () => {
    if (!activePage) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, img.width, img.height);
      const angle = detectDeskewAngle(imgData);

      if (Math.abs(angle) > 0) {
        updateActivePageAdjustments({ deskewAngle: angle });
      }
    };
    img.src = activePage.processedDataUrl || activePage.originalDataUrl;
  };

  // Rotate 90 degrees
  const handleRotate = () => {
    if (!activePage) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.height;
      canvas.height = img.width;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((90 * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);

      const rotatedUrl = canvas.toDataURL("image/jpeg", 0.92);

      setPages((prev) =>
        prev.map((p, idx) =>
          idx === activePageIndex
            ? {
                ...p,
                processedDataUrl: rotatedUrl,
                originalDataUrl: rotatedUrl,
                width: canvas.width,
                height: canvas.height,
                rotation: (p.rotation + 90) % 360,
              }
            : p
        )
      );
    };
    img.src = activePage.processedDataUrl || activePage.originalDataUrl;
  };

  // Reset to original
  const handleReset = () => {
    if (!activePage) return;
    setPages((prev) =>
      prev.map((p, idx) =>
        idx === activePageIndex
          ? {
              ...p,
              processedDataUrl: p.originalDataUrl,
              adjustments: { ...DEFAULT_ADJUSTMENTS },
              corners: undefined,
            }
          : p
      )
    );
  };

  // Duplicate page
  const handleDuplicatePage = (idx: number) => {
    const pageToDup = pages[idx];
    if (!pageToDup) return;
    const dup: ScannedPage = {
      ...pageToDup,
      id: generateScanId(),
    };
    const newPages = [...pages];
    newPages.splice(idx + 1, 0, dup);
    setPages(newPages);
    setActivePageIndex(idx + 1);
  };

  // Delete page
  const handleDeletePage = (idx: number) => {
    const newPages = pages.filter((_, i) => i !== idx);
    setPages(newPages);
    if (activePageIndex >= newPages.length) {
      setActivePageIndex(Math.max(0, newPages.length - 1));
    }
  };

  // Move page order
  const handleMovePage = (from: number, to: number) => {
    if (to < 0 || to >= pages.length) return;
    const newPages = [...pages];
    const [moved] = newPages.splice(from, 1);
    newPages.splice(to, 0, moved);
    setPages(newPages);
    setActivePageIndex(to);
  };

  // Export PDF
  const handleExport = async (importToWorkspace: boolean = false) => {
    if (!pages.length) return;
    setIsProcessing(true);
    setProgressMsg("Taranmış sayfalar PDF olarak derleniyor...");

    try {
      const pdfBytes = await exportScannedPdf(pages, exportOptions, (curr, total, msg) => {
        setProgressMsg(`${msg} (%${Math.round((curr / total) * 100)})`);
      });

      if (importToWorkspace && onImportToWorkspace) {
        onImportToWorkspace(pdfBytes, "tarama-belgesi.pdf");
        onClose();
      } else {
        const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `tarama_${Date.now()}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err: unknown) {
      alert(`Dışa aktarma hatası: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsProcessing(false);
      setProgressMsg("");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative flex flex-col w-full max-w-5xl h-[90vh] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                Belge Tarayıcı ve Görüntü İyileştirme
              </h2>
              <p className="text-xs text-slate-400">
                Görselleri yükleyin veya kamerayla çekin, perspektif ve filtrelerle iyileştirip tek PDF yapın.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              handleStopCamera();
              onClose();
            }}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Main Visualizer Area */}
          <div className="flex-1 flex flex-col p-4 bg-slate-950/60 overflow-y-auto">
            {/* Top Toolbar / Input Actions */}
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    files.forEach(addImageFile);
                    e.target.value = "";
                  }}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Görsel Yükle (JPG/PNG/WebP)
                </button>

                {!isCameraActive ? (
                  <button
                    onClick={handleStartCamera}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors border border-slate-700"
                  >
                    <Camera className="w-3.5 h-3.5 text-emerald-400" />
                    Kamerayı Aç
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCaptureCamera}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Fotoğraf Çek
                    </button>
                    <button
                      onClick={handleStopCamera}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition-colors"
                    >
                      Kamerayı Kapat
                    </button>
                  </div>
                )}
              </div>

              {activePage && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowSideBySide(!showSideBySide)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border transition-colors ${
                      showSideBySide
                        ? "bg-indigo-600/30 border-indigo-500 text-indigo-300"
                        : "bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <SplitSquareVertical className="w-3.5 h-3.5" />
                    Yan Yana Karşılaştır
                  </button>
                  <button
                    onClick={handleReset}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Sıfırla
                  </button>
                </div>
              )}
            </div>

            {/* Error banner if camera rejected */}
            {cameraError && (
              <div className="mb-4 p-3 rounded-lg bg-rose-950/50 border border-rose-800/80 text-rose-300 text-xs flex items-center justify-between">
                <span>{cameraError}</span>
                <button
                  onClick={() => setCameraError(null)}
                  className="text-rose-400 hover:text-rose-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Video preview when camera active */}
            {isCameraActive && (
              <div className="relative mb-4 flex flex-col items-center justify-center bg-black rounded-lg overflow-hidden border border-slate-800 min-h-[300px]">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="max-h-[360px] w-auto rounded"
                />
                <p className="mt-2 text-xs text-slate-400">
                  Belgeyi kadrajın ortasına hizalayıp &quot;Fotoğraf Çek&quot; butonuna basın.
                </p>
              </div>
            )}

            {/* Page Display Area */}
            {activePage ? (
              <div className="flex-1 flex flex-col items-center justify-center relative min-h-[350px] p-2 bg-slate-900/40 rounded-lg border border-slate-800/80">
                {!showSideBySide ? (
                  <div className="relative max-w-full max-h-full flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={activePage.processedDataUrl || activePage.originalDataUrl}
                      alt="Taranmış Belge"
                      className="max-w-full max-h-[480px] object-contain rounded shadow-lg border border-slate-700"
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4 w-full h-full items-center">
                    <div className="flex flex-col items-center">
                      <span className="text-xs text-slate-400 mb-1">Orijinal</span>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={activePage.originalDataUrl}
                        alt="Orijinal"
                        className="max-h-[440px] max-w-full object-contain rounded border border-slate-700"
                      />
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-xs text-emerald-400 mb-1 font-medium">İşlenmiş / İyileştirilmiş</span>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={activePage.processedDataUrl}
                        alt="İşlenmiş"
                        className="max-h-[440px] max-w-full object-contain rounded border border-emerald-600/60 shadow-lg"
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const files = Array.from(e.dataTransfer.files).filter((f) =>
                    f.type.startsWith("image/")
                  );
                  files.forEach(addImageFile);
                }}
                className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-700 rounded-xl p-8 text-center text-slate-400 hover:border-indigo-500/50 transition-colors"
              >
                <Upload className="w-12 h-12 text-slate-600 mb-3" />
                <p className="text-sm font-medium text-slate-300">
                  Taranacak belgeleri sürükleyip buraya bırakın veya panodan yapıştırın (Ctrl+V)
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  JPG, PNG veya WebP desteklenir.
                </p>
              </div>
            )}

            {/* Bottom Multi-Page Thumbnail Strip */}
            {pages.length > 0 && (
              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center gap-3 overflow-x-auto pb-1">
                {pages.map((p, idx) => (
                  <div
                    key={p.id}
                    onClick={() => setActivePageIndex(idx)}
                    className={`relative group shrink-0 w-20 h-28 rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
                      idx === activePageIndex
                        ? "border-indigo-500 shadow-md shadow-indigo-500/20"
                        : "border-slate-800 hover:border-slate-600"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.processedDataUrl || p.originalDataUrl}
                      alt={`Sayfa ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-1 left-1 bg-black/70 px-1.5 py-0.5 rounded text-[10px] text-white">
                      {idx + 1}
                    </div>
                    {/* Quick controls on hover */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDuplicatePage(idx);
                        }}
                        title="Çoğalt"
                        className="p-1 bg-slate-800 text-slate-200 hover:text-white rounded"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePage(idx);
                        }}
                        title="Sil"
                        className="p-1 bg-rose-900/80 text-rose-200 hover:text-white rounded"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Adjustment Sidebar */}
          {activePage && (
            <div className="w-80 border-l border-slate-800 bg-slate-900/90 p-4 flex flex-col justify-between overflow-y-auto">
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-xs font-semibold text-slate-300">
                    Sayfa {activePageIndex + 1} / {pages.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleMovePage(activePageIndex, activePageIndex - 1)}
                      disabled={activePageIndex === 0}
                      className="p-1 bg-slate-800 text-slate-300 hover:text-white disabled:opacity-40 rounded"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleMovePage(activePageIndex, activePageIndex + 1)}
                      disabled={activePageIndex === pages.length - 1}
                      className="p-1 bg-slate-800 text-slate-300 hover:text-white disabled:opacity-40 rounded"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Geometry & Orientation Tools */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                    Geometri ve Kenarlar
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handleAutoDetectEdges}
                      className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition-colors"
                    >
                      <Crop className="w-3.5 h-3.5 text-indigo-400" />
                      Kenar Bul
                    </button>
                    <button
                      onClick={handlePerspectiveWarp}
                      className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Perspektif
                    </button>
                    <button
                      onClick={handleAutoDeskew}
                      className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition-colors"
                    >
                      Eğrilik Gider
                    </button>
                    <button
                      onClick={handleRotate}
                      className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition-colors"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      90° Döndür
                    </button>
                  </div>
                </div>

                {/* Color Mode Selection */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                    Renk Modu
                  </label>
                  <div className="grid grid-cols-3 gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
                    {(["color", "grayscale", "bw"] as FilterMode[]).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => updateActivePageAdjustments({ filterMode: mode })}
                        className={`py-1 text-xs font-medium rounded capitalize transition-colors ${
                          activePage.adjustments.filterMode === mode
                            ? "bg-indigo-600 text-white"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        {mode === "color" ? "Renkli" : mode === "grayscale" ? "Gri" : "S/B"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sliders: Brightness, Contrast, Sharpness, Shadow */}
                <div className="space-y-3">
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Görüntü İyileştirme
                  </label>

                  <div>
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                      <span>Parlaklık</span>
                      <span>{activePage.adjustments.brightness}</span>
                    </div>
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      value={activePage.adjustments.brightness}
                      onChange={(e) =>
                        updateActivePageAdjustments({ brightness: Number(e.target.value) })
                      }
                      className="w-full accent-indigo-500"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                      <span>Kontrast</span>
                      <span>{activePage.adjustments.contrast}</span>
                    </div>
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      value={activePage.adjustments.contrast}
                      onChange={(e) =>
                        updateActivePageAdjustments({ contrast: Number(e.target.value) })
                      }
                      className="w-full accent-indigo-500"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                      <span>Keskinlik</span>
                      <span>{activePage.adjustments.sharpness}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={activePage.adjustments.sharpness}
                      onChange={(e) =>
                        updateActivePageAdjustments({ sharpness: Number(e.target.value) })
                      }
                      className="w-full accent-indigo-500"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                      <span>Gölge/Sararma Azaltma</span>
                      <span>{activePage.adjustments.shadowReduction}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={activePage.adjustments.shadowReduction}
                      onChange={(e) =>
                        updateActivePageAdjustments({ shadowReduction: Number(e.target.value) })
                      }
                      className="w-full accent-indigo-500"
                    />
                  </div>
                </div>

                {/* PDF Output Options */}
                <div className="pt-2 border-t border-slate-800 space-y-2">
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    PDF Çıktı Ayarları
                  </label>

                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={exportOptions.fitToA4}
                      onChange={(e) =>
                        setExportOptions((prev) => ({ ...prev, fitToA4: e.target.checked }))
                      }
                      className="rounded accent-indigo-500"
                    />
                    A4 Boyutuna Sığdır
                  </label>

                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span>Kenar Boşluğu:</span>
                    <select
                      value={exportOptions.margin}
                      onChange={(e) =>
                        setExportOptions((prev) => ({
                          ...prev,
                          margin: e.target.value as "none" | "small" | "normal",
                        }))
                      }
                      className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200"
                    >
                      <option value="none">Yok (0 pt)</option>
                      <option value="small">Küçük (18 pt)</option>
                      <option value="normal">Normal (36 pt)</option>
                    </select>
                  </div>

                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={exportOptions.applyOcr}
                      onChange={(e) =>
                        setExportOptions((prev) => ({ ...prev, applyOcr: e.target.checked }))
                      }
                      className="rounded accent-indigo-500"
                    />
                    Aranabilir PDF Yap (Yerel OCR)
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-800 space-y-2">
                {isProcessing && (
                  <div className="text-[11px] text-indigo-400 animate-pulse text-center">
                    {progressMsg}
                  </div>
                )}
                <button
                  onClick={() => handleExport(false)}
                  disabled={isProcessing || pages.length === 0}
                  className="w-full flex items-center justify-center gap-2 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow-md transition-colors disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  PDF Olarak İndir ({pages.length} Sayfa)
                </button>

                {onImportToWorkspace && (
                  <button
                    onClick={() => handleExport(true)}
                    disabled={isProcessing || pages.length === 0}
                    className="w-full flex items-center justify-center gap-2 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <FileText className="w-4 h-4 text-emerald-400" />
                    Çalışma Alanında Aç
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
