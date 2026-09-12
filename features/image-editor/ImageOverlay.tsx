"use client";

import React, { useState, useRef, useEffect } from "react";
import type { PdfImageItem, PdfDetectedImage, PdfImageEdit } from "./imageTypes";

interface ImageOverlayProps {
  detectedImages?: PdfDetectedImage[];
  editedImages?: PdfImageEdit[];
  images?: PdfImageItem[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onRequestEdit?: (image: PdfDetectedImage) => void;
  onUpdate: (id: string, updated: Partial<PdfImageItem>) => void;
  onCommit?: (id: string) => void;
  onDragStateChange?: (isDragging: boolean) => void;
  pageWidth: number;
  pageHeight: number;
  zoom?: number;
}

const HANDLE_SIZE = 10;

export function ImageOverlay({
  detectedImages = [],
  editedImages = [],
  images = [],
  selectedId,
  onSelect,
  onRequestEdit,
  onUpdate,
  onCommit,
  onDragStateChange,
  pageWidth,
  pageHeight,
  zoom = 1
}: ImageOverlayProps) {
  // Use editedImages if provided, otherwise fallback to images that are modified or selected
  const activeEdits: PdfImageEdit[] = editedImages.length > 0
    ? editedImages.filter((img) => !img.deleted)
    : images.filter((img) => !img.deleted && (img.isModified || !img.isOriginal || img.id === selectedId));

  // Detected images that are not yet being actively edited
  const activeDetected: PdfDetectedImage[] = detectedImages.filter(
    (det) => !activeEdits.some((ed) => ed.id === det.id)
  );

  const selectedImage = activeEdits.find((i) => i.id === selectedId) || null;
  const imageElementRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const rafIdRef = useRef<number | null>(null);
  const pendingUpdateRef = useRef<Partial<PdfImageItem> | null>(null);

  // Mutable ref for drag state to prevent ANY React re-renders during pointermove
  const dragStateRef = useRef<{
    type: "move" | "resize" | "rotate";
    corner?: "nw" | "ne" | "se" | "sw";
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
    initialW: number;
    initialH: number;
    initialAngle: number;
    centerX: number;
    centerY: number;
    capturedTarget?: HTMLElement | null;
    pointerId?: number;
  } | null>(null);

  const isDraggingRef = useRef(false);
  const setIsDragging = (dragging: boolean) => {
    if (isDraggingRef.current !== dragging) {
      isDraggingRef.current = dragging;
      if (typeof window !== "undefined") {
        (window as any).__isDraggingImage = dragging;
      }
      onDragStateChange?.(dragging);
    }
  };

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      const state = dragStateRef.current;
      if (!state || !selectedImage) return;

      e.preventDefault();
      const z = zoom > 0 ? zoom : 1;
      const dx = (e.clientX - state.startX) / z;
      const dy = (e.clientY - state.startY) / z;
      const el = imageElementRefs.current.get(selectedImage.id);

      if (state.type === "move") {
        const nextX = Math.max(0, Math.min(pageWidth - selectedImage.w, state.initialX + dx));
        const nextY = Math.max(0, Math.min(pageHeight - selectedImage.h, state.initialY + dy));
        pendingUpdateRef.current = { x: Math.round(nextX), y: Math.round(nextY) };

        if (!rafIdRef.current) {
          rafIdRef.current = requestAnimationFrame(() => {
            rafIdRef.current = null;
            if (el && pendingUpdateRef.current) {
              const moveDx = (pendingUpdateRef.current.x ?? state.initialX) - state.initialX;
              const moveDy = (pendingUpdateRef.current.y ?? state.initialY) - state.initialY;
              el.style.transform = `translate3d(${moveDx}px, ${moveDy}px, 0) rotate(${state.initialAngle}deg)`;
            }
          });
        }
      } else if (state.type === "resize" && state.corner) {
        const { initialX, initialY, initialW, initialH } = state;
        let newX = initialX;
        let newY = initialY;
        let newW = initialW;
        let newH = initialH;

        if (state.corner === "se") {
          newW = Math.max(20, initialW + dx);
          newH = Math.max(20, initialH + dy);
        } else if (state.corner === "sw") {
          newW = Math.max(20, initialW - dx);
          newX = initialX + (initialW - newW);
          newH = Math.max(20, initialH + dy);
        } else if (state.corner === "ne") {
          newW = Math.max(20, initialW + dx);
          newH = Math.max(20, initialH - dy);
          newY = initialY + (initialH - newH);
        } else if (state.corner === "nw") {
          newW = Math.max(20, initialW - dx);
          newX = initialX + (initialW - newW);
          newH = Math.max(20, initialH - dy);
          newY = initialY + (initialH - newH);
        }

        pendingUpdateRef.current = {
          x: Math.round(newX),
          y: Math.round(newY),
          w: Math.round(newW),
          h: Math.round(newH)
        };

        if (!rafIdRef.current) {
          rafIdRef.current = requestAnimationFrame(() => {
            rafIdRef.current = null;
            if (el && pendingUpdateRef.current) {
              el.style.left = `${pendingUpdateRef.current.x}px`;
              el.style.top = `${pendingUpdateRef.current.y}px`;
              el.style.width = `${pendingUpdateRef.current.w}px`;
              el.style.height = `${pendingUpdateRef.current.h}px`;
            }
          });
        }
      } else if (state.type === "rotate") {
        const rad = Math.atan2(e.clientY - state.centerY, e.clientX - state.centerX);
        let deg = Math.round((rad * 180) / Math.PI) + 90;
        if (deg < 0) deg += 360;
        const finalDeg = deg % 360;
        pendingUpdateRef.current = { rotation: finalDeg };

        if (!rafIdRef.current) {
          rafIdRef.current = requestAnimationFrame(() => {
            rafIdRef.current = null;
            if (el) {
              el.style.transform = `rotate(${finalDeg}deg)`;
            }
          });
        }
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      const state = dragStateRef.current;
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      if (state && selectedImage) {
        if (state.capturedTarget && typeof state.pointerId === "number") {
          try {
            state.capturedTarget.releasePointerCapture(state.pointerId);
          } catch {}
        }
        const el = imageElementRefs.current.get(selectedImage.id);
        if (pendingUpdateRef.current) {
          const updates = { ...pendingUpdateRef.current, isModified: true };
          if (el) {
            el.style.transform = `rotate(${updates.rotation ?? selectedImage.rotation ?? 0}deg)`;
            if (typeof updates.x === "number") el.style.left = `${updates.x}px`;
            if (typeof updates.y === "number") el.style.top = `${updates.y}px`;
            if (typeof updates.w === "number") el.style.width = `${updates.w}px`;
            if (typeof updates.h === "number") el.style.height = `${updates.h}px`;
          }
          onUpdate(selectedImage.id, updates);
          onCommit?.(selectedImage.id);
        } else if (el) {
          el.style.transform = `rotate(${selectedImage.rotation || 0}deg)`;
        }
      }
      pendingUpdateRef.current = null;
      dragStateRef.current = null;
      setIsDragging(false);
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", handlePointerUp, { passive: false });
    window.addEventListener("pointercancel", handlePointerUp, { passive: false });

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [selectedImage, pageWidth, pageHeight, zoom, onUpdate, onCommit]);

  return (
    <div
      className="absolute top-0 left-0 pointer-events-none z-20"
      style={{
        width: `${pageWidth}px`,
        height: `${pageHeight}px`,
        transform: `scale(${zoom || 1})`,
        transformOrigin: "0 0",
        touchAction: "none",
        userSelect: "none"
      }}
    >
      {/* 1. Transparent hit-boxes for detected images that have not been modified/transitioned */}
      {activeDetected.map((det) => {
        const isNonMovable = det.isMovable === false;
        return (
          <div
            key={`hit_${det.id}`}
            data-image-id={det.id}
            data-detected="true"
            title={det.name || "Görsel (Düzenlemek için tıkla)"}
            style={{
              position: "absolute",
              left: `${det.x}px`,
              top: `${det.y}px`,
              width: `${det.w}px`,
              height: `${det.h}px`,
              transform: `rotate(${det.rotation || 0}deg)`,
              pointerEvents: "auto",
              cursor: isNonMovable ? "not-allowed" : "pointer",
              touchAction: "none",
              userSelect: "none"
            }}
            className="hover:ring-2 hover:ring-indigo-400/80 hover:bg-indigo-500/10 transition-all rounded-[1px]"
            onClick={(e) => {
              e.stopPropagation();
              if (onRequestEdit) onRequestEdit(det);
              else onSelect(det.id);
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              if (isNonMovable) return;
              if (onRequestEdit) onRequestEdit(det);
              else onSelect(det.id);
            }}
          />
        );
      })}

      {/* 2. Actively edited images with visible <img> (canvas pixels already removed underneath) */}
      {activeEdits.map((img) => {
        const isSelected = img.id === selectedId;
        const isNonMovable = img.isMovable === false;

        return (
          <div
            key={img.id}
            data-image-id={img.id}
            data-edit="true"
            ref={(node) => {
              if (node) imageElementRefs.current.set(img.id, node);
              else imageElementRefs.current.delete(img.id);
            }}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(img.id);
            }}
            style={{
              position: "absolute",
              left: `${img.x}px`,
              top: `${img.y}px`,
              width: `${img.w}px`,
              height: `${img.h}px`,
              transform: `rotate(${img.rotation || 0}deg)`,
              opacity: img.opacity ?? 1,
              pointerEvents: "auto",
              cursor: isNonMovable ? "not-allowed" : isSelected ? "move" : "pointer",
              touchAction: "none",
              userSelect: "none"
            }}
            className={`transition-shadow ${
              isSelected
                ? isNonMovable
                  ? "ring-2 ring-amber-500 ring-offset-1 shadow-lg"
                  : "ring-2 ring-indigo-500 ring-offset-1 shadow-lg"
                : "hover:ring-1 hover:ring-indigo-300"
            }`}
            onPointerDown={(e) => {
              if (isNonMovable) {
                e.stopPropagation();
                return;
              }
              if (!isSelected) {
                onSelect(img.id);
                return;
              }
              e.stopPropagation();
              e.preventDefault();
              const target = e.currentTarget as HTMLElement;
              try {
                target.setPointerCapture(e.pointerId);
              } catch {}
              dragStateRef.current = {
                type: "move",
                startX: e.clientX,
                startY: e.clientY,
                initialX: img.x,
                initialY: img.y,
                initialW: img.w,
                initialH: img.h,
                initialAngle: img.rotation || 0,
                centerX: img.x + img.w / 2,
                centerY: img.y + img.h / 2,
                capturedTarget: target,
                pointerId: e.pointerId
              };
              setIsDragging(true);
            }}
          >
            <img
              src={img.previewUrl || img.dataUrl}
              alt={img.name || "Görsel"}
              className="w-full h-full object-fill pointer-events-none select-none block"
              draggable={false}
            />

            {/* Resize handles when selected and movable */}
            {isSelected && !isNonMovable && (
              <>
                {(["nw", "ne", "se", "sw"] as const).map((corner) => {
                  const getPos = () => {
                    switch (corner) {
                      case "nw":
                        return { top: -HANDLE_SIZE / 2, left: -HANDLE_SIZE / 2, cursor: "nwse-resize" };
                      case "ne":
                        return { top: -HANDLE_SIZE / 2, right: -HANDLE_SIZE / 2, cursor: "nesw-resize" };
                      case "se":
                        return { bottom: -HANDLE_SIZE / 2, right: -HANDLE_SIZE / 2, cursor: "nwse-resize" };
                      case "sw":
                        return { bottom: -HANDLE_SIZE / 2, left: -HANDLE_SIZE / 2, cursor: "nesw-resize" };
                    }
                  };
                  const pos = getPos();

                  return (
                    <div
                      key={corner}
                      data-corner={corner}
                      style={{
                        position: "absolute",
                        width: HANDLE_SIZE,
                        height: HANDLE_SIZE,
                        touchAction: "none",
                        userSelect: "none",
                        ...pos
                      }}
                      className="bg-white border-2 border-indigo-600 rounded-sm shadow-sm"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        const target = e.currentTarget as HTMLElement;
                        try {
                          target.setPointerCapture(e.pointerId);
                        } catch {}
                        dragStateRef.current = {
                          type: "resize",
                          corner,
                          startX: e.clientX,
                          startY: e.clientY,
                          initialX: img.x,
                          initialY: img.y,
                          initialW: img.w,
                          initialH: img.h,
                          initialAngle: img.rotation || 0,
                          centerX: img.x + img.w / 2,
                          centerY: img.y + img.h / 2,
                          capturedTarget: target,
                          pointerId: e.pointerId
                        };
                        setIsDragging(true);
                      }}
                    />
                  );
                })}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
