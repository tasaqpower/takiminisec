"use client";

import React from "react";
import { PenLine, Trash2, Check, RefreshCw, PlusCircle } from "lucide-react";
import type { Mark } from "@/lib/documents";

export interface SignatureControlsProps {
  hasSignature: boolean;
  selectedSignatureMark: Mark | null;
  onOpenSignDialog: () => void;
  onUpdateFormat: (updates: Partial<Mark>) => void;
  onDeleteSignature: () => void;
  onDone?: () => void;
  disabled?: boolean;
}

export function SignatureControls({
  hasSignature,
  selectedSignatureMark,
  onOpenSignDialog,
  onUpdateFormat,
  onDeleteSignature,
  onDone,
  disabled = false
}: SignatureControlsProps) {
  if (selectedSignatureMark) {
    const currentW = Math.round(selectedSignatureMark.w || 180);
    const currentOpacity = Math.round((selectedSignatureMark.opacity ?? 1) * 100);

    return (
      <div className="flex items-center gap-2.5 shrink-0 animate-in fade-in duration-100">
        <span className="text-xs font-semibold text-slate-700 select-none">İmza Düzenle:</span>

        {/* Width Slider */}
        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded px-2 h-8 text-xs text-slate-700">
          <span className="text-[11px] text-muted-foreground">Boyut</span>
          <input
            type="range"
            aria-label="İmza boyutu"
            min={40}
            max={450}
            step={5}
            value={currentW}
            disabled={disabled}
            onChange={(e) => {
              const newW = Number(e.target.value);
              const aspect = selectedSignatureMark.h / selectedSignatureMark.w || 0.375;
              onUpdateFormat({ w: newW, h: Math.round(newW * aspect) });
            }}
            className="w-18 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          />
          <span className="w-10 font-mono text-[11px] font-semibold text-slate-700 text-right">{currentW} px</span>
        </div>

        {/* Opacity Slider */}
        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded px-2 h-8 text-xs text-slate-700">
          <span className="text-[11px] text-muted-foreground">Opaklık</span>
          <input
            type="range"
            aria-label="İmza opaklığı"
            min={20}
            max={100}
            step={5}
            value={currentOpacity}
            disabled={disabled}
            onChange={(e) => onUpdateFormat({ opacity: Number(e.target.value) / 100 })}
            className="w-14 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          />
          <span className="w-7 text-[11px] font-mono text-slate-600 text-right">%{currentOpacity}</span>
        </div>

        {/* Change Signature */}
        <button
          type="button"
          onClick={onOpenSignDialog}
          disabled={disabled}
          className="h-8 px-2 flex items-center gap-1 text-xs bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded transition-colors"
          title="İmzayı yeniden çiz veya değiştir"
        >
          <RefreshCw size={13} />
          <span>Değiştir</span>
        </button>

        {/* Delete Signature */}
        <button
          type="button"
          onClick={onDeleteSignature}
          disabled={disabled}
          className="h-8 px-2 flex items-center gap-1 text-xs text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded transition-colors"
          title="İmzayı sil"
        >
          <Trash2 size={13} />
          <span>Sil</span>
        </button>

        {/* Done */}
        {onDone && (
          <button
            type="button"
            onClick={onDone}
            disabled={disabled}
            className="h-8 px-2.5 flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded font-medium transition-colors"
          >
            <Check size={13} />
            <span>Bitti</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 shrink-0 animate-in fade-in duration-100">
      <button
        type="button"
        onClick={onOpenSignDialog}
        disabled={disabled}
        className="h-8 px-3 flex items-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded shadow-xs transition-colors"
      >
        <PenLine size={14} />
        <span>{hasSignature ? "İmza ekle / çiz" : "İmza oluştur"}</span>
      </button>

      <span className="text-[11px] text-muted-foreground ml-1 select-none">
        (Sayfadaki imzayı seçerek boyut ve opaklığını ayarlayabilirsin)
      </span>
    </div>
  );
}
