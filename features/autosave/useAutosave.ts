"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { saveDraft, deleteDraft, type FormaDraft } from "./db";
import { toast } from "sonner";

export interface UseAutosaveProps {
  file: File | null;
  type: "pdf" | "word";
  bytes?: Uint8Array | null;
  marks?: any[];
  removals?: any[];
  wordContent?: string;
  pageRotations?: Record<number, number>;
  currentPage?: number;
  formFields?: any[];
  pageImages?: any[];
  pageOrder?: number[];
  annotations?: any[];
  zoom?: number;
  isDirty?: boolean;
  intent?: string;
  enabled?: boolean;
  onSaved?: () => void;
}

export type AutosaveStatus = "idle" | "saving" | "saved" | "error";

export function useAutosave({
  file,
  type,
  bytes,
  marks = [],
  removals = [],
  wordContent,
  pageRotations = {},
  currentPage = 1,
  formFields = [],
  pageImages = [],
  pageOrder = [],
  annotations = [],
  zoom = 1,
  isDirty = false,
  intent = "edit",
  enabled = true,
  onSaved
}: UseAutosaveProps) {
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const cachedBuffer = useRef<ArrayBuffer | null>(null);
  const saveTimer = useRef<NodeJS.Timeout | null>(null);
  const isFirstRender = useRef(true);

  // Load arrayBuffer from file or direct bytes
  useEffect(() => {
    if (bytes) {
      const copy = new Uint8Array(bytes.byteLength);
      copy.set(bytes);
      cachedBuffer.current = copy.buffer;
      return;
    }
    if (!file) {
      cachedBuffer.current = null;
      return;
    }
    file.arrayBuffer().then((buf) => {
      cachedBuffer.current = buf;
    }).catch(err => {
      console.warn("Could not read file for autosave:", err);
    });
  }, [file, bytes]);

  const performSave = useCallback(async () => {
    const fileName = file?.name || "belge.pdf";
    if (!enabled || !cachedBuffer.current) return;

    // Check if there are any changes to save
    const hasEdits =
      (marks && marks.length > 0) ||
      (removals && removals.length > 0) ||
      (wordContent && wordContent.trim().length > 0) ||
      (formFields && formFields.length > 0) ||
      (pageImages && pageImages.length > 0) ||
      (pageOrder && pageOrder.length > 0) ||
      (annotations && annotations.length > 0) ||
      Object.keys(pageRotations).length > 0 ||
      isDirty;

    if (!hasEdits) return;

    setStatus("saving");
    try {
      const draft: FormaDraft = {
        id: "current_draft",
        name: fileName,
        type,
        fileData: cachedBuffer.current,
        timestamp: Date.now(),
        intent,
        marks,
        removals,
        wordContent,
        pageRotations,
        currentPage,
        formFields,
        pageImages,
        pageOrder,
        annotations,
        zoom,
        isDirty
      };

      const success = await saveDraft(draft);
      if (success) {
        setStatus("saved");
        setLastSaved(new Date());
        onSaved?.();
      } else {
        setStatus("error");
      }
    } catch (e: any) {
      console.error("Autosave error:", e);
      setStatus("error");
      if (e?.name === "QuotaExceededError") {
        toast.warning("Tarayıcı depolama kotası aşıldı, taslak kaydedilemedi.");
      }
    }
  }, [enabled, file, bytes, type, marks, removals, wordContent, pageRotations, currentPage, formFields, pageImages, pageOrder, annotations, zoom, isDirty, intent, onSaved]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (!enabled || (!file && !bytes)) return;

    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
    }

    saveTimer.current = setTimeout(() => {
      void performSave();
    }, 1200);

    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }
    };
  }, [marks, removals, wordContent, pageRotations, currentPage, formFields, pageImages, pageOrder, annotations, zoom, isDirty, enabled, file, bytes, performSave]);

  const clearCurrentDraft = useCallback(async () => {
    await deleteDraft("current_draft");
    setStatus("idle");
    setLastSaved(null);
  }, []);

  return {
    status,
    lastSaved,
    clearCurrentDraft,
    forceSave: performSave
  };
}
