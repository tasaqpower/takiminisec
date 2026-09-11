"use client";

import React, { useRef } from "react";
import { RotateCw, Trash2, Download, RefreshCw, Sliders, X, ArrowUp, ArrowDown } from "lucide-react";
import type { PdfImageItem } from "./imageTypes";
import { download } from "@/lib/documents";

interface ImageToolbarProps {
  image: PdfImageItem | null;
  onUpdate: (updated: Partial<PdfImageItem>) => void;
  onDelete: (id: string) => void;
  onBringForward?: () => void;
  onSendBackward?: () => void;
  onClose: () => void;
}

export function ImageToolbar({
  image,
  onUpdate,
  onDelete,
  onBringForward,
  onSendBackward,
  onClose
}: ImageToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!image) return null;

  const handleRotate = () => {
    const nextRot = ((image.rotation || 0) + 90) % 360;
    onUpdate({ rotation: nextRot });
  };

  const handleOpacityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate({ opacity: parseFloat(e.target.value) });
  };

  const handleDownloadImage = () => {
    const a = document.createElement("a");
    a.href = image.dataUrl;
    a.download = `${image.name || "gorsel"}.${image.format || "png"}`;
    a.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        const isJpg = file.type === "image/jpeg" || /\.jpe?g$/i.test(file.name);
        onUpdate({
          dataUrl: reader.result,
          format: isJpg ? "jpeg" : "png",
          name: file.name
        });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 bg-white/95 backdrop-blur-md shadow-xl border border-slate-200/90 px-3 py-1.5 rounded-full animate-in fade-in zoom-in-95 duration-150">
      <span className="text-xs font-semibold text-slate-700 max-w-[120px] truncate px-1" title={image.name}>
        {image.name || "Görsel"}
      </span>

      <div className="h-4 w-px bg-slate-200" />

      {/* Rotate */}
      <button
        type="button"
        onClick={handleRotate}
        className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-full transition-colors"
        title="90° Döndür"
      >
        <RotateCw className="w-4 h-4" />
      </button>

      {/* Layer Order: Bring Forward / Send Backward */}
      {onBringForward && (
        <button
          type="button"
          onClick={onBringForward}
          className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-full transition-colors"
          title="Öne Getir"
        >
          <ArrowUp className="w-4 h-4" />
        </button>
      )}
      {onSendBackward && (
        <button
          type="button"
          onClick={onSendBackward}
          className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-full transition-colors"
          title="Arkaya Gönder"
        >
          <ArrowDown className="w-4 h-4" />
        </button>
      )}

      {/* Opacity slider */}
      <div className="flex items-center gap-1 px-1.5">
        <Sliders className="w-3.5 h-3.5 text-slate-400" />
        <input
          type="range"
          min="0.1"
          max="1"
          step="0.05"
          value={image.opacity ?? 1}
          onChange={handleOpacityChange}
          className="w-16 accent-indigo-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
          title={`Opaklık: %${Math.round((image.opacity ?? 1) * 100)}`}
        />
        <span className="text-[11px] font-mono text-slate-500 w-7">
          %{Math.round((image.opacity ?? 1) * 100)}
        </span>
      </div>

      <div className="h-4 w-px bg-slate-200" />

      {/* Replace image */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        onChange={handleFileChange}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-full transition-colors"
        title="Görseli Başka Dosyayla Değiştir"
      >
        <RefreshCw className="w-4 h-4" />
      </button>

      {/* Export image */}
      <button
        type="button"
        onClick={handleDownloadImage}
        className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-full transition-colors"
        title="Görseli İndir (PNG/JPG)"
      >
        <Download className="w-4 h-4" />
      </button>

      <div className="h-4 w-px bg-slate-200" />

      {/* Delete */}
      <button
        type="button"
        onClick={() => onDelete(image.id)}
        className="p-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-full transition-colors"
        title="Görseli Sil"
      >
        <Trash2 className="w-4 h-4" />
      </button>

      {/* Close selection */}
      <button
        type="button"
        onClick={onClose}
        className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors ml-1"
        title="Seçimi Kaldır"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
