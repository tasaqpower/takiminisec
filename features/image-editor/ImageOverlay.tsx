"use client";

import React, { useState, useRef, useEffect } from "react";
import type { PdfImageItem, PdfDetectedImage, PdfImageEdit } from "./imageTypes";
import { computeResizedBounds, transformDeltaForRotation } from "@/lib/resize-geometry";

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
  baseWidth?: number;
  baseHeight?: number;
  rotation?: number;
  zoom?: number;
  tool?: string;
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
  baseWidth,
  baseHeight,
  rotation = 0,
  zoom = 1,
  tool = "select"
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

  const [isDragging, setIsDraggingState] = useState(false);
  const isDraggingRef = useRef(false);
  const setIsDragging = (dragging: boolean) => {
    if (isDraggingRef.current !== dragging) {
      isDraggingRef.current = dragging;
      setIsDraggingState(dragging);
      onDragStateChange?.(dragging);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined" && import.meta.env?.DEV && process.env.NEXT_PUBLIC_ENABLE_TEST_API === "true") {
      (window as any).__isDraggingImage = isDragging;
    }
  }, [isDragging]);

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      const state = dragStateRef.current;
      if (!state || !selectedImage) return;

      e.preventDefault();
      const z = zoom > 0 ? zoom : 1;
      const rawDx = (e.clientX - state.startX) / z;
      const rawDy = (e.clientY - state.startY) / z;
      const { dx, dy } = transformDeltaForRotation(rawDx, rawDy, rotation);
      const el = imageElementRefs.current.get(selectedImage.id);
      const effectiveBaseW = baseWidth || pageWidth;
      const effectiveBaseH = baseHeight || pageHeight;

      if (state.type === "move") {
        const nextX = Math.max(0, Math.min(effectiveBaseW - selectedImage.w, state.initialX + dx));
        const nextY = Math.max(0, Math.min(effectiveBaseH - selectedImage.h, state.initialY + dy));
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
        const resized = computeResizedBounds({
          kind: "image",
          corner: state.corner,
          startRect: {
            x: state.initialX,
            y: state.initialY,
            w: state.initialW,
            h: state.initialH
          },
          dx,
          dy,
          pageWidth: effectiveBaseW,
          pageHeight: effectiveBaseH,
          minSize: 12
        });

        pendingUpdateRef.current = {
          x: Math.round(resized.x),
          y: Math.round(resized.y),
          w: Math.round(resized.w),
          h: Math.round(resized.h)
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
      if (!state) return;

      if (state.capturedTarget && typeof state.capturedTarget.releasePointerCapture === "function" && state.pointerId !== undefined) {
        try {
          state.capturedTarget.releasePointerCapture(state.pointerId);
        } catch {}
      }

      dragStateRef.current = null;
      setIsDragging(false);

      if (pendingUpdateRef.current && selectedImage) {
        const update = { ...pendingUpdateRef.current };
        pendingUpdateRef.current = null;
        onUpdate(selectedImage.id, update);
        onCommit?.(selectedImage.id);
      }
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
  }, [selectedImage, pageWidth, pageHeight, baseWidth, baseHeight, rotation, zoom, onUpdate, onCommit]);

  const rot = (((rotation || 0) % 360) + 360) % 360;
  const effectiveBaseW = baseWidth || pageWidth;
  const effectiveBaseH = baseHeight || pageHeight;
  const rotationTransform =
    rot === 90
      ? `translate(${effectiveBaseH}px, 0px) rotate(90deg)`
      : rot === 180
      ? `translate(${effectiveBaseW}px, ${effectiveBaseH}px) rotate(180deg)`
      : rot === 270
      ? `translate(0px, ${effectiveBaseW}px) rotate(270deg)`
      : undefined;

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
      <div
        style={{
          width: `${effectiveBaseW}px`,
          height: `${effectiveBaseH}px`,
          transform: rotationTransform,
          transformOrigin: "0 0",
          position: "relative",
          pointerEvents: "none"
        }}
      >
      {/* 1. Transparent hit-boxes for detected images that have not been modified/transitioned */}
      {activeDetected.map((det) => {
        const isNonMovable = det.isMovable === false;
        // Background scans or full-page images should never intercept clicks or block text selection
        const isBackgroundScan = det.w >= effectiveBaseW * 0.85 && det.h >= effectiveBaseH * 0.85;
        const canInteract = tool === "select" && !isNonMovable && !isBackgroundScan;

        return (
          <div
            key={`hit_${det.id}`}
            data-image-id={det.id}
            data-detected="true"
            title={canInteract ? (det.name || "Görsel (Düzenlemek için tıkla)") : undefined}
            style={{
              position: "absolute",
              left: `${det.x}px`,
              top: `${det.y}px`,
              width: `${det.w}px`,
              height: `${det.h}px`,
              transform: `rotate(${det.rotation || 0}deg)`,
              pointerEvents: canInteract ? "auto" : "none",
              cursor: canInteract ? "pointer" : "default",
              touchAction: "none",
              userSelect: "none"
            }}
            className={canInteract ? "hover:ring-2 hover:ring-indigo-400/80 hover:bg-indigo-500/10 transition-all rounded-[1px]" : ""}
            onClick={(e) => {
              if (!canInteract) return;
              e.stopPropagation();
              if (onRequestEdit) onRequestEdit(det);
              else onSelect(det.id);
            }}
            onPointerDown={(e) => {
              if (!canInteract) return;
              e.stopPropagation();
              e.preventDefault();
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
                  const hitSize = 18;
                  const dotSize = 8;
                  const getPos = () => {
                    switch (corner) {
                      case "nw":
                        return { top: -hitSize / 2, left: -hitSize / 2, cursor: "nwse-resize" };
                      case "ne":
                        return { top: -hitSize / 2, right: -hitSize / 2, cursor: "nesw-resize" };
                      case "se":
                        return { bottom: -hitSize / 2, right: -hitSize / 2, cursor: "nwse-resize" };
                      case "sw":
                        return { bottom: -hitSize / 2, left: -hitSize / 2, cursor: "nesw-resize" };
                    }
                  };
                  const pos = getPos();

                  return (
                    <div
                      key={corner}
                      data-corner={corner}
                      style={{
                        position: "absolute",
                        width: hitSize,
                        height: hitSize,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        touchAction: "none",
                        userSelect: "none",
                        pointerEvents: "auto",
                        zIndex: 20,
                        ...pos
                      }}
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
                    >
                      <div
                        style={{
                          width: dotSize,
                          height: dotSize,
                          borderRadius: "50%",
                          backgroundColor: "#8b5cf6",
                          border: "1.5px solid #ffffff",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                          pointerEvents: "none"
                        }}
                      />
                    </div>
                  );
                })}
              </>
            )}
          </div>
        );
      })}
      </div>
    </div>
  );
}
