"use client";

import React from "react";
import { Check, CloudOff, Loader2 } from "lucide-react";
import type { AutosaveStatus } from "./useAutosave";

interface AutosaveIndicatorProps {
  status: AutosaveStatus;
  lastSaved: Date | null;
  className?: string;
}

export function AutosaveIndicator({ status, lastSaved, className = "" }: AutosaveIndicatorProps) {
  if (status === "idle" && !lastSaved) {
    return null;
  }

  const formatTime = (d: Date) => {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full font-medium transition-all ${
        status === "saving"
          ? "bg-amber-50 text-amber-700 border border-amber-200"
          : status === "error"
          ? "bg-rose-50 text-rose-700 border border-rose-200"
          : "bg-emerald-50 text-emerald-700 border border-emerald-200"
      } ${className}`}
      title={lastSaved ? `Son taslak: ${formatTime(lastSaved)}` : undefined}
    >
      {status === "saving" && (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Kaydediliyor…</span>
        </>
      )}
      {status === "saved" && (
        <>
          <Check className="w-3.5 h-3.5" />
          <span>Taslak kaydedildi {lastSaved ? `(${formatTime(lastSaved)})` : ""}</span>
        </>
      )}
      {status === "error" && (
        <>
          <CloudOff className="w-3.5 h-3.5" />
          <span>Taslak kaydedilemedi</span>
        </>
      )}
      {status === "idle" && lastSaved && (
        <>
          <Check className="w-3.5 h-3.5 text-emerald-600" />
          <span>Taslak güncel ({formatTime(lastSaved)})</span>
        </>
      )}
    </div>
  );
}
