"use client";

import React from "react";
import { Eraser, Trash2, Pen } from "lucide-react";

export interface DrawControlsProps {
  color: string;
  onColorChange: (color: string) => void;
  size: number;
  onSizeChange: (size: number) => void;
  opacity: number;
  onOpacityChange: (opacity: number) => void;
  isEraser: boolean;
  onToggleEraser: () => void;
  onClearPageDrawings: () => void;
  hasDrawings?: boolean;
  disabled?: boolean;
}

const COMMON_PEN_COLORS = [
  { label: "Siyah", value: "#111827" },
  { label: "Lacivert", value: "#30294d" },
  { label: "Mavi", value: "#2563eb" },
  { label: "Kırmızı", value: "#dc2626" },
  { label: "Yeşil", value: "#16a34a" }
];

export function DrawControls({
  color,
  onColorChange,
  size,
  onSizeChange,
  opacity,
  onOpacityChange,
  isEraser,
  onToggleEraser,
  onClearPageDrawings,
  hasDrawings = true,
  disabled = false
}: DrawControlsProps) {
  const opacityPercent = Math.round(opacity <= 1 ? opacity * 100 : opacity);

  return (
    <div className="flex items-center gap-2.5 shrink-0 animate-in fade-in duration-100">
      {/* Pen / Eraser Mode Toggle */}
      <div className="flex items-center bg-slate-50 border border-slate-200 rounded p-0.5 h-8">
        <button
          type="button"
          aria-label="Kalem"
          aria-pressed={!isEraser}
          title="Kalem aracı"
          disabled={disabled}
          onClick={() => isEraser && onToggleEraser()}
          className={`flex items-center gap-1 px-2 h-7 rounded text-xs font-medium transition-colors ${
            !isEraser ? "bg-white text-indigo-700 shadow-xs border border-slate-200/60" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <Pen size={13} />
          <span>Kalem</span>
        </button>

        <button
          type="button"
          aria-label="Silgi"
          aria-pressed={isEraser}
          title="Silgi modu"
          disabled={disabled}
          onClick={() => !isEraser && onToggleEraser()}
          className={`flex items-center gap-1 px-2 h-7 rounded text-xs font-medium transition-colors ${
            isEraser ? "bg-rose-50 text-rose-700 shadow-xs border border-rose-200" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <Eraser size={13} />
          <span>Silgi</span>
        </button>
      </div>

      {/* Color Selection (hidden if in eraser mode) */}
      {!isEraser && (
        <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded px-1.5 h-8">
          {COMMON_PEN_COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              aria-label={c.label}
              title={c.label}
              disabled={disabled}
              onClick={() => onColorChange(c.value)}
              style={{ backgroundColor: c.value }}
              className={`w-4 h-4 rounded-full transition-transform ${
                color.toLowerCase() === c.value.toLowerCase()
                  ? "ring-2 ring-indigo-600 ring-offset-1 scale-110"
                  : "hover:scale-105 opacity-80 hover:opacity-100"
              }`}
            />
          ))}
          <input
            type="color"
            aria-label="Özel kalem rengi"
            title="Özel renk"
            className="w-4 h-4 rounded cursor-pointer border-0 bg-transparent p-0 m-0 ml-0.5"
            value={color}
            disabled={disabled}
            onChange={(e) => onColorChange(e.target.value)}
          />
        </div>
      )}

      {/* Line Thickness Slider with Clear Numerical Value */}
      <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded px-2 h-8 text-xs text-slate-700">
        <span className="text-[11px] text-muted-foreground">{isEraser ? "Silgi boyutu" : "Kalınlık"}</span>
        <input
          type="range"
          aria-label="Kalem kalınlığı"
          min={1}
          max={24}
          step={1}
          value={size}
          disabled={disabled}
          onChange={(e) => onSizeChange(Number(e.target.value))}
          className="w-18 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
        />
        <span className="w-9 font-mono text-[11px] font-semibold text-slate-700 text-right">
          {size} px
        </span>
      </div>

      {/* Opacity Control */}
      {!isEraser && (
        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded px-2 h-8 text-xs text-slate-700">
          <span className="text-[11px] text-muted-foreground">Opaklık</span>
          <input
            type="range"
            aria-label="Çizim opaklığı"
            min={10}
            max={100}
            step={5}
            value={opacityPercent}
            disabled={disabled}
            onChange={(e) => onOpacityChange(Number(e.target.value) / 100)}
            className="w-14 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          />
          <span className="w-7 text-[11px] font-mono text-slate-600 text-right">%{opacityPercent}</span>
        </div>
      )}

      {/* Clear Page Drawings Button */}
      <button
        type="button"
        aria-label="Çizimleri temizle"
        title="Bu sayfadaki tüm çizimleri sil"
        disabled={disabled || !hasDrawings}
        onClick={onClearPageDrawings}
        className="h-8 px-2 flex items-center gap-1 text-xs text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded transition-colors"
      >
        <Trash2 size={13} />
        <span className="hidden sm:inline">Temizle</span>
      </button>
    </div>
  );
}
