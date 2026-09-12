"use client";

import React, { useRef } from "react";
import { RotateCw, Download, RefreshCw, Trash2, X, Image as ImageIcon } from "lucide-react";
import type { PdfImageItem } from "@/features/image-editor/imageTypes";

export interface ImageControlsProps {
  image: PdfImageItem;
  onUpdate: (updated: Partial<PdfImageItem>) => void;
  onDelete: (id: string) => void;
  onDeselect: () => void;
  disabled?: boolean;
}

export function ImageControls({
  image,
  onUpdate,
  onDelete,
  onDeselect,
  disabled = false
}: ImageControlsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleRotate = () => {
    const nextRot = ((image.rotation || 0) + 90) % 360;
    onUpdate({ rotation: nextRot });
  };

  const handleOpacityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate({ opacity: parseFloat(e.target.value) });
  };

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = image.dataUrl || image.previewUrl || "";
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
          previewUrl: reader.result,
          format: isJpg ? "jpeg" : "png",
          name: file.name
        });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const opacityPercent = Math.round((image.opacity ?? 1) * 100);

  return (
    <div className="flex items-center gap-2 shrink-0 animate-in fade-in duration-100 bg-indigo-50/70 border border-indigo-200/80 rounded-md px-2 py-0.5">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-900 pr-1 border-r border-indigo-200">
        <ImageIcon size={14} className="text-indigo-600" />
        <span className="max-w-[100px] truncate" title={image.name || "Görsel"}>
          {image.name || "Görsel"}
        </span>
      </div>

      {/* 90° Rotate */}
      <button
        type="button"
        aria-label="90 derece döndür"
        title="90° Döndür"
        disabled={disabled}
        onClick={handleRotate}
        className="h-7 px-2 flex items-center gap-1 text-xs text-slate-700 hover:bg-white hover:text-indigo-600 rounded transition-colors"
      >
        <RotateCw size={13} />
        <span className="hidden md:inline">90°</span>
      </button>

      {/* Opacity */}
      <div className="flex items-center gap-1 px-1.5 h-7 text-xs text-slate-700">
        <span className="text-[11px] text-muted-foreground">Opaklık</span>
        <input
          type="range"
          aria-label="Görsel opaklığı"
          min={0.1}
          max={1}
          step={0.05}
          value={image.opacity ?? 1}
          disabled={disabled}
          onChange={handleOpacityChange}
          className="w-14 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
        />
        <span className="w-7 text-[11px] font-mono text-slate-600 text-right">%{opacityPercent}</span>
      </div>

      {/* Replace Image */}
      <button
        type="button"
        aria-label="Görseli değiştir"
        title="Farklı bir görsel seç"
        disabled={disabled}
        onClick={() => fileInputRef.current?.click()}
        className="h-7 px-2 flex items-center gap-1 text-xs text-slate-700 hover:bg-white hover:text-indigo-600 rounded transition-colors"
      >
        <RefreshCw size={13} />
        <span className="hidden sm:inline">Değiştir</span>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Download Image */}
      <button
        type="button"
        aria-label="Görseli indir"
        title="Görseli bilgisayarına indir"
        disabled={disabled}
        onClick={handleDownload}
        className="h-7 px-2 flex items-center gap-1 text-xs text-slate-700 hover:bg-white hover:text-indigo-600 rounded transition-colors"
      >
        <Download size={13} />
        <span className="hidden sm:inline">İndir</span>
      </button>

      {/* Delete Image */}
      <button
        type="button"
        aria-label="Görseli sil"
        title="Görseli sayfadan kaldır"
        disabled={disabled}
        onClick={() => onDelete(image.id)}
        className="h-7 px-2 flex items-center gap-1 text-xs text-rose-600 hover:bg-white hover:text-rose-700 rounded transition-colors"
      >
        <Trash2 size={13} />
        <span className="hidden sm:inline">Sil</span>
      </button>

      {/* Deselect / Close */}
      <button
        type="button"
        aria-label="Seçimi kaldır"
        title="Seçimi kaldır (Esc)"
        disabled={disabled}
        onClick={onDeselect}
        className="h-7 w-7 flex items-center justify-center text-slate-500 hover:bg-white hover:text-slate-800 rounded transition-colors ml-0.5"
      >
        <X size={14} />
      </button>
    </div>
  );
}
