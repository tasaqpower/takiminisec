"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { saveDraft, deleteDraft, type FormaDraft } from "./db";
import { toast } from "sonner";

export interface UseAutosaveProps {
  file: File | null;
  type: "pdf" | "word";
  marks?: any[];
  removals?: any[];
  wordContent?: string;
  pageRotations?: Record<number, number>;
  currentPage?: number;
  formFields?: any[];
  pageImages?: any[];
  pageOrder?: number[];
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
  marks = [],
  removals = [],
  wordContent,
  pageRotations = {},
  currentPage = 1,
  formFields = [],
  pageImages = [],
  pageOrder = [],
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

  // Load arrayBuffer from file once
  useEffect(() => {
    if (!file) {
      cachedBuffer.current = null;
      return;
    }
    file.arrayBuffer().then((buf) => {
      cachedBuffer.current = buf;
    }).catch(err => {
      console.warn("Could not read file for autosave:", err);
    });
  }, [file]);

  const performSave = useCallback(async () => {
    if (!enabled || !file || !cachedBuffer.current) return;

    // Check if there are any changes to save
    const hasEdits =
      (marks && marks.length > 0) ||
      (removals && removals.length > 0) ||
      (wordContent && wordContent.trim().length > 0) ||
      (formFields && formFields.length > 0) ||
      (pageImages && pageImages.length > 0) ||
      (pageOrder && pageOrder.length > 0) ||
      Object.keys(pageRotations).length > 0 ||
      isDirty;

    if (!hasEdits) return;

    setStatus("saving");
    try {
      const draft: FormaDraft = {
        id: "current_draft",
        name: file.name,
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
  }, [enabled, file, type, marks, removals, wordContent, pageRotations, currentPage, formFields, pageImages, pageOrder, zoom, isDirty, intent, onSaved]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (!enabled || !file) return;

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
  }, [marks, removals, wordContent, pageRotations, currentPage, formFields, pageImages, pageOrder, zoom, isDirty, enabled, file, performSave]);

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
