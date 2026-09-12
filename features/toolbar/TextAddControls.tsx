"use client";

import React from "react";
import { Bold, Italic, AlignLeft, AlignCenter, AlignRight, PlusCircle } from "lucide-react";
import { PDF_FONTS, type PdfFont } from "@/lib/pdf-fonts";

export interface TextAddControlsProps {
  font: PdfFont;
  onFontChange: (font: PdfFont) => void;
  size: number;
  onSizeChange: (size: number) => void;
  bold: boolean;
  onBoldChange: (bold: boolean) => void;
  italic: boolean;
  onItalicChange: (italic: boolean) => void;
  color: string;
  onColorChange: (color: string) => void;
  align?: "left" | "center" | "right";
  onAlignChange?: (align: "left" | "center" | "right") => void;
  onQuickAdd?: () => void;
  disabled?: boolean;
}

export function TextAddControls({
  font,
  onFontChange,
  size,
  onSizeChange,
  bold,
  onBoldChange,
  italic,
  onItalicChange,
  color,
  onColorChange,
  align = "left",
  onAlignChange,
  onQuickAdd,
  disabled = false
}: TextAddControlsProps) {
  return (
    <div className="flex items-center gap-2 shrink-0 animate-in fade-in duration-100">
      {/* Font Family Dropdown */}
      <select
        aria-label="Yazı tipi"
        className="h-8 text-xs bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded px-2 font-medium text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
        value={font}
        disabled={disabled}
        onChange={(e) => onFontChange(e.target.value as PdfFont)}
      >
        {PDF_FONTS.map((f) => (
          <option key={f.value} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>

      {/* Font Size */}
      <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded px-1.5 h-8">
        <span className="text-[10px] text-muted-foreground uppercase font-semibold">Pt</span>
        <input
          type="number"
          aria-label="Yazı boyutu"
          className="w-11 text-xs bg-transparent text-slate-800 font-semibold text-center outline-none"
          min={6}
          max={120}
          value={size}
          disabled={disabled}
          onChange={(e) => onSizeChange(Math.max(6, Math.min(120, Number(e.target.value) || 16)))}
        />
      </div>

      {/* Bold Toggle */}
      <button
        type="button"
        aria-label="Kalın"
        aria-pressed={bold}
        title="Kalın"
        disabled={disabled}
        onClick={() => onBoldChange(!bold)}
        className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${
          bold
            ? "bg-indigo-100 text-indigo-700 font-bold border border-indigo-200"
            : "text-slate-600 hover:bg-slate-100 border border-transparent"
        }`}
      >
        <Bold size={15} />
      </button>

      {/* Italic Toggle */}
      <button
        type="button"
        aria-label="İtalik"
        aria-pressed={italic}
        title="İtalik"
        disabled={disabled}
        onClick={() => onItalicChange(!italic)}
        className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${
          italic
            ? "bg-indigo-100 text-indigo-700 font-bold border border-indigo-200"
            : "text-slate-600 hover:bg-slate-100 border border-transparent"
        }`}
      >
        <Italic size={15} />
      </button>

      {/* Color Picker */}
      <div className="flex items-center gap-1.5 px-1.5 h-8 bg-slate-50 border border-slate-200 rounded cursor-pointer hover:bg-slate-100 transition-colors" title="Metin rengi">
        <input
          type="color"
          aria-label="Metin rengi"
          className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0 m-0"
          value={color}
          disabled={disabled}
          onChange={(e) => onColorChange(e.target.value)}
        />
        <span className="text-[11px] font-mono text-slate-600 uppercase">{color.slice(0, 7)}</span>
      </div>

      {/* Alignment */}
      {onAlignChange && (
        <div className="flex items-center bg-slate-50 border border-slate-200 rounded p-0.5 h-8">
          <button
            type="button"
            aria-label="Sola hizala"
            aria-pressed={align === "left"}
            onClick={() => onAlignChange("left")}
            className={`w-6 h-7 flex items-center justify-center rounded ${align === "left" ? "bg-white text-indigo-600 shadow-xs" : "text-slate-500 hover:text-slate-800"}`}
          >
            <AlignLeft size={13} />
          </button>
          <button
            type="button"
            aria-label="Ortala"
            aria-pressed={align === "center"}
            onClick={() => onAlignChange("center")}
            className={`w-6 h-7 flex items-center justify-center rounded ${align === "center" ? "bg-white text-indigo-600 shadow-xs" : "text-slate-500 hover:text-slate-800"}`}
          >
            <AlignCenter size={13} />
          </button>
          <button
            type="button"
            aria-label="Sağa hizala"
            aria-pressed={align === "right"}
            onClick={() => onAlignChange("right")}
            className={`w-6 h-7 flex items-center justify-center rounded ${align === "right" ? "bg-white text-indigo-600 shadow-xs" : "text-slate-500 hover:text-slate-800"}`}
          >
            <AlignRight size={13} />
          </button>
        </div>
      )}

      {/* Quick Add Button / Page Click Instruction */}
      {onQuickAdd && (
        <button
          type="button"
          onClick={onQuickAdd}
          disabled={disabled}
          className="h-8 px-2.5 flex items-center gap-1.5 text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium rounded border border-indigo-200 transition-colors"
          title="Sayfaya yeni metin kutusu ekle"
        >
          <PlusCircle size={14} />
          <span>Sayfaya ekle</span>
        </button>
      )}

      <span className="text-[11px] text-muted-foreground ml-1 hidden lg:inline select-none">
        (Sayfada tıkla ve yaz)
      </span>
    </div>
  );
}
