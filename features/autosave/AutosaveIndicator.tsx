"use client";

import React, { useSyncExternalStore } from "react";
import { Check, CloudOff, Loader2 } from "lucide-react";
import { autosaveStore, type AutosaveStatus } from "./autosaveStore";

interface AutosaveIndicatorProps {
  status?: AutosaveStatus;
  lastSaved?: Date | null;
  className?: string;
}

export function AutosaveIndicator({
  status: propStatus,
  lastSaved: propLastSaved,
  className = ""
}: AutosaveIndicatorProps) {
  const storeState = useSyncExternalStore(
    autosaveStore.subscribe,
    autosaveStore.getSnapshot,
    autosaveStore.getSnapshot
  );

  const status = propStatus !== undefined ? propStatus : storeState.status;
  const lastSaved = propLastSaved !== undefined ? propLastSaved : storeState.lastSaved;

  const tooltip =
    status === "saving"
      ? "Kaydediliyor…"
      : status === "error"
      ? "Taslak kaydedilemedi"
      : status === "saved"
      ? "Taslak kaydedildi"
      : lastSaved
      ? "Taslak güncel"
      : "";

  return (
    <div
      className={`inline-flex items-center justify-center shrink-0 w-6 h-6 select-none pointer-events-auto ${className}`}
      style={{
        width: 24,
        height: 24,
        minWidth: 24,
        minHeight: 24,
        maxWidth: 24,
        maxHeight: 24,
        flexShrink: 0,
        boxSizing: "border-box"
      }}
      title={tooltip || undefined}
      aria-label={tooltip || "Otomatik kaydetme durumu"}
    >
      {status === "saving" && (
        <Loader2 className="w-4 h-4 text-muted-foreground animate-spin shrink-0" />
      )}
      {status === "saved" && (
        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
      )}
      {status === "error" && (
        <CloudOff className="w-4 h-4 text-rose-500 shrink-0" />
      )}
      {status === "idle" && lastSaved && (
        <Check className="w-4 h-4 text-muted-foreground/50 shrink-0" />
      )}
      {status === "idle" && !lastSaved && (
        <div className="w-4 h-4 shrink-0" aria-hidden="true" />
      )}
    </div>
  );
}

export { type AutosaveStatus } from "./autosaveStore";
