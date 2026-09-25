"use client";

import { useEffect, useRef, useCallback } from "react";
import { saveDraft, deleteDraft, computeFileHash, type FormaDraft } from "./db";
import { autosaveStore, type AutosaveStatus } from "./autosaveStore";
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
  isDragging?: boolean;
  onSaved?: () => void;
}

export { type AutosaveStatus } from "./autosaveStore";

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
  isDragging = false,
  onSaved
}: UseAutosaveProps) {
  const cachedBuffer = useRef<ArrayBuffer | null>(null);
  const currentDraftIdRef = useRef<string>("current_draft");
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
    if (typeof window !== "undefined" && import.meta.env?.DEV && process.env.NEXT_PUBLIC_ENABLE_TEST_API === "true") {
      if ((window as any).__isTestingDrag) return;
    }

    // Check dragging state: do NOT autosave while dragging
    const isDevTestDragging = typeof window !== "undefined" && import.meta.env?.DEV && process.env.NEXT_PUBLIC_ENABLE_TEST_API === "true" && Boolean((window as any).__isDraggingImage || (window as any).__isDragging);
    const dragging = isDragging || isDevTestDragging;
    if (dragging) return;

    // Filter genuine image edits (do NOT count unmodified detected images as edits)
    const genuineImageEdits = (pageImages || []).filter(
      (img: any) => img.isModified || img.deleted || !img.isOriginal
    );

    // Check if there are any real changes to save
    const hasEdits =
      (marks && marks.length > 0) ||
      (removals && removals.length > 0) ||
      (wordContent && wordContent.trim().length > 0) ||
      (formFields && formFields.length > 0) ||
      genuineImageEdits.length > 0 ||
      (pageOrder && pageOrder.length > 0) ||
      (annotations && annotations.length > 0) ||
      Object.keys(pageRotations).length > 0 ||
      isDirty;

    if (!hasEdits) return;

    autosaveStore.setStatus("saving");
    try {
      const fileHash = await computeFileHash(cachedBuffer.current);
      const draftId = fileHash ? `draft_${fileHash}` : `draft_${fileName}`;
      currentDraftIdRef.current = draftId;

      const draft: FormaDraft = {
        id: draftId,
        name: fileName,
        type,
        fileData: cachedBuffer.current,
        timestamp: Date.now(),
        intent,
        fileHash,
        marks,
        removals,
        wordContent,
        pageRotations,
        currentPage,
        formFields,
        pageImages: genuineImageEdits,
        imageEdits: genuineImageEdits,
        pageOrder,
        annotations,
        zoom,
        isDirty
      };

      const success = await saveDraft(draft);
      if (success) {
        autosaveStore.setStatus("saved", new Date());
        if (typeof window !== "undefined" && import.meta.env?.DEV && process.env.NEXT_PUBLIC_ENABLE_TEST_API === "true") {
          (window as any).__lastAutosaveTimestamp = Date.now();
          (window as any).__autosaveWriteCount = ((window as any).__autosaveWriteCount || 0) + 1;
        }
        onSaved?.();
      } else {
        autosaveStore.setStatus("error");
      }
    } catch (e: any) {
      console.error("Autosave error:", e);
      autosaveStore.setStatus("error");
      if (e?.name === "QuotaExceededError") {
        toast.warning("Tarayıcı depolama kotası aşıldı, taslak kaydedilemedi.");
      }
    }
  }, [enabled, file, bytes, type, marks, removals, wordContent, pageRotations, currentPage, formFields, pageImages, pageOrder, annotations, zoom, isDirty, intent, isDragging, onSaved]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (!enabled || (!file && !bytes)) return;

    const isDevTestDragging = typeof window !== "undefined" && import.meta.env?.DEV && process.env.NEXT_PUBLIC_ENABLE_TEST_API === "true" && Boolean((window as any).__isDraggingImage || (window as any).__isDragging);
    const dragging = isDragging || isDevTestDragging;
    if (dragging) {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      return;
    }

    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
    }

    // 2-second debounce timer on user edits
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      void performSave();
    }, 2000);

    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }
    };
  }, [marks, removals, wordContent, pageRotations, currentPage, formFields, pageImages, pageOrder, annotations, zoom, isDirty, enabled, isDragging, file, bytes, performSave]);

  const clearCurrentDraft = useCallback(async () => {
    if (currentDraftIdRef.current) {
      await deleteDraft(currentDraftIdRef.current);
    }
    await deleteDraft("current_draft");
    autosaveStore.reset();
  }, []);

  return {
    get status() {
      return autosaveStore.getSnapshot().status;
    },
    get lastSaved() {
      return autosaveStore.getSnapshot().lastSaved;
    },
    clearCurrentDraft,
    forceSave: performSave
  };
}
