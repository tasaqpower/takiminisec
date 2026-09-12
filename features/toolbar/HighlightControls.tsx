"use client";

import React from "react";
import { Highlighter } from "lucide-react";

export interface HighlightControlsProps {
  color: string;
  onColorChange: (color: string) => void;
  opacity: number;
  onOpacityChange: (opacity: number) => void;
  height: number;
  onHeightChange: (height: number) => void;
  disabled?: boolean;
}

const PRESET_COLORS = [
  { label: "Sarı", value: "#ffeb3b" },
  { label: "Yeşil", value: "#69f0ae" },
  { label: "Mavi", value: "#80d8ff" },
  { label: "Pembe", value: "#ff80ab" },
  { label: "Turuncu", value: "#ffd180" }
];

export function HighlightControls({
  color,
  onColorChange,
  opacity,
  onOpacityChange,
  height,
  onHeightChange,
  disabled = false
}: HighlightControlsProps) {
  const opacityPercent = Math.round(opacity <= 1 ? opacity * 100 : opacity);

  return (
    <div className="flex items-center gap-2.5 shrink-0 animate-in fade-in duration-100">
      {/* Preset Swatches */}
      <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded px-1.5 h-8">
        {PRESET_COLORS.map((c) => (
          <button
            key={c.value}
            type="button"
            aria-label={c.label}
            title={c.label}
            disabled={disabled}
            onClick={() => onColorChange(c.value)}
            style={{ backgroundColor: c.value }}
            className={`w-5 h-5 rounded-full transition-transform ${
              color.toLowerCase() === c.value.toLowerCase()
                ? "ring-2 ring-indigo-600 ring-offset-1 scale-110"
                : "hover:scale-105 opacity-80 hover:opacity-100"
            }`}
          />
        ))}
        {/* Custom Color */}
        <input
          type="color"
          aria-label="Özel vurgu rengi"
          title="Özel renk"
          className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0 m-0 ml-0.5"
          value={color}
          disabled={disabled}
          onChange={(e) => onColorChange(e.target.value)}
        />
      </div>

      {/* Opacity Control */}
      <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded px-2 h-8 text-xs text-slate-700">
        <span className="text-[11px] text-muted-foreground">Opaklık</span>
        <input
          type="range"
          aria-label="Vurgu opaklığı"
          min={15}
          max={90}
          step={5}
          value={opacityPercent}
          disabled={disabled}
          onChange={(e) => onOpacityChange(Number(e.target.value) / 100)}
          className="w-16 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
        />
        <span className="w-7 text-[11px] font-mono text-slate-600 text-right">%{opacityPercent}</span>
      </div>

      {/* Height / Thickness */}
      <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded px-2 h-8 text-xs text-slate-700">
        <span className="text-[11px] text-muted-foreground">Kalınlık</span>
        <select
          aria-label="Vurgu kalınlığı"
          className="h-6 text-xs bg-transparent font-medium text-slate-700 outline-none cursor-pointer"
          value={height}
          disabled={disabled}
          onChange={(e) => onHeightChange(Number(e.target.value))}
        >
          <option value={14}>14 px (İnce)</option>
          <option value={20}>20 px (Standart)</option>
          <option value={26}>26 px (Geniş)</option>
          <option value={36}>36 px (Başlık)</option>
        </select>
      </div>

      <span className="text-[11px] text-muted-foreground hidden xl:inline select-none">
        (Metin üstüne sürükle)
      </span>
    </div>
  );
}
