"use client";

import React from "react";
import { Bold, Italic, Trash2, Check, MousePointer2, ScanText } from "lucide-react";
import { PDF_FONTS, type PdfFont } from "@/lib/pdf-fonts";
import type { Mark } from "@/lib/documents";

export interface TextEditControlsProps {
  selectedMark: Mark | null;
  onUpdateFormat: (updates: Partial<Mark>) => void;
  onDelete: () => void;
  onDone: () => void;
  disabled?: boolean;
  hasSelectableText?: boolean;
  onStartOcr?: () => void;
}

export function TextEditControls({
  selectedMark,
  onUpdateFormat,
  onDelete,
  onDone,
  disabled = false,
  hasSelectableText,
  onStartOcr
}: TextEditControlsProps) {
  if (!selectedMark) {
    if (hasSelectableText === false && onStartOcr) {
      return (
        <div className="flex items-center gap-2 px-2 text-xs select-none">
          <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
            Sayfada seçilebilir metin yok (taranmış PDF)
          </span>
          <button
            type="button"
            onClick={onStartOcr}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded shadow-xs cursor-pointer transition-colors"
          >
            <ScanText size={13} />
            OCR ile Metinleri Düzenle
          </button>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 px-2 text-xs text-muted-foreground select-none">
        <MousePointer2 size={14} className="opacity-70 text-indigo-500" />
        <span>Düzenlemek için sayfadaki bir metne tıkla</span>
      </div>
    );
  }

  const currentFont = selectedMark.font || "roboto";
  const currentSize = Math.max(6, Math.min(120, Math.round(selectedMark.size || 16)));
  const isBold = Boolean(selectedMark.bold);
  const isItalic = Boolean(selectedMark.italic);
  const currentColor = selectedMark.color || "#222222";

  return (
    <div className="flex items-center gap-2 shrink-0 animate-in fade-in duration-100">
      {/* Font Family Dropdown */}
      <select
        aria-label="Yazı tipi"
        className="h-8 text-xs bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded px-2 font-medium text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
        value={currentFont}
        disabled={disabled}
        onChange={(e) => onUpdateFormat({ font: e.target.value as PdfFont })}
      >
        {PDF_FONTS.map((f) => (
          <option key={f.value} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>

      {/* Font Match Quality Badge */}
      {selectedMark.sourceId?.startsWith("ocr-") || selectedMark.fontMatchQuality === "görsel eşleştirme" ? (
        <span
          className="px-2 py-1 rounded text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 select-none whitespace-nowrap"
          title="Yazı tipi taranmış belgeden görsel eşleştirme ile Courier / Daktilo olarak belirlendi."
        >
          Görsel Eşleştirme
        </span>
      ) : (selectedMark as any).isApproximateFont || selectedMark.fontMatchQuality === "yaklaşık eşleşme" ? (
        <span
          className="px-2 py-1 rounded text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200 select-none whitespace-nowrap"
          title="Kaynak yazı tipi Unicode karakterleri desteklemediği için en yakın font kullanıldı."
        >
          Yaklaşık Eşleşme
        </span>
      ) : null}

      {/* Font Size */}
      <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded px-1.5 h-8">
        <span className="text-[10px] text-muted-foreground uppercase font-semibold">Pt</span>
        <input
          type="number"
          aria-label="Yazı boyutu"
          className="w-11 text-xs bg-transparent text-slate-800 font-semibold text-center outline-none"
          min={6}
          max={120}
          value={currentSize}
          disabled={disabled}
          onChange={(e) => {
            const next = Math.max(6, Math.min(120, Number(e.target.value) || 16));
            onUpdateFormat({ size: next });
          }}
        />
      </div>

      {/* Bold Toggle */}
      <button
        type="button"
        aria-label="Kalın"
        aria-pressed={isBold}
        title="Kalın (Bold)"
        disabled={disabled}
        onClick={() => onUpdateFormat({ bold: !isBold })}
        className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${
          isBold
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
        aria-pressed={isItalic}
        title="İtalik (Italic)"
        disabled={disabled}
        onClick={() => onUpdateFormat({ italic: !isItalic })}
        className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${
          isItalic
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
          value={currentColor}
          disabled={disabled}
          onChange={(e) => onUpdateFormat({ color: e.target.value })}
        />
        <span className="text-[11px] font-mono text-slate-600 uppercase">{currentColor.slice(0, 7)}</span>
      </div>

      <div className="h-4 w-px bg-slate-200 mx-0.5" />

      {/* Delete Mark */}
      <button
        type="button"
        aria-label="Metni sil"
        title="Seçili metni sil"
        disabled={disabled}
        onClick={onDelete}
        className="h-8 px-2 flex items-center gap-1 text-xs text-rose-600 hover:bg-rose-50 hover:border-rose-200 border border-transparent rounded transition-colors"
      >
        <Trash2 size={14} />
        <span>Sil</span>
      </button>

      {/* Done / Deselect */}
      <button
        type="button"
        aria-label="Tamamla"
        title="Düzenlemeyi bitir"
        disabled={disabled}
        onClick={onDone}
        className="h-8 px-2.5 flex items-center gap-1 text-xs bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 rounded transition-colors font-medium"
      >
        <Check size={14} className="text-emerald-600" />
        <span>Bitti</span>
      </button>
    </div>
  );
}
