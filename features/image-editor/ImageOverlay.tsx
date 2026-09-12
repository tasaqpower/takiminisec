"use client";

import React, { useState, useRef, useEffect } from "react";
import type { PdfImageItem } from "./imageTypes";

interface ImageOverlayProps {
  images: PdfImageItem[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onUpdate: (id: string, updated: Partial<PdfImageItem>) => void;
  onCommit?: (id: string) => void;
  onDragStateChange?: (isDragging: boolean) => void;
  pageWidth: number;
  pageHeight: number;
  zoom?: number;
}

const HANDLE_SIZE = 10;

export function ImageOverlay({
  images,
  selectedId,
  onSelect,
  onUpdate,
  onCommit,
  onDragStateChange,
  pageWidth,
  pageHeight,
  zoom = 1
}: ImageOverlayProps) {
  const [dragState, setDragState] = useState<{
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
  } | null>(null);

  const selectedImage = images.find((i) => i.id === selectedId) || null;
  const imageElementRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const rafIdRef = useRef<number | null>(null);
  const pendingUpdateRef = useRef<Partial<PdfImageItem> | null>(null);

  useEffect(() => {
    onDragStateChange?.(Boolean(dragState));
  }, [dragState, onDragStateChange]);

  useEffect(() => {
    if (!dragState || !selectedImage) return;

    const handlePointerMove = (e: PointerEvent) => {
      const z = zoom > 0 ? zoom : 1;
      const dx = (e.clientX - dragState.startX) / z;
      const dy = (e.clientY - dragState.startY) / z;
      const el = imageElementRefs.current.get(selectedImage.id);

      if (dragState.type === "move") {
        const nextX = Math.max(0, Math.min(pageWidth - selectedImage.w, dragState.initialX + dx));
        const nextY = Math.max(0, Math.min(pageHeight - selectedImage.h, dragState.initialY + dy));
        pendingUpdateRef.current = { x: Math.round(nextX), y: Math.round(nextY) };

        if (!rafIdRef.current) {
          rafIdRef.current = requestAnimationFrame(() => {
            rafIdRef.current = null;
            if (el && pendingUpdateRef.current) {
              const moveDx = (pendingUpdateRef.current.x ?? dragState.initialX) - dragState.initialX;
              const moveDy = (pendingUpdateRef.current.y ?? dragState.initialY) - dragState.initialY;
              el.style.transform = `translate3d(${moveDx}px, ${moveDy}px, 0) rotate(${dragState.initialAngle}deg)`;
            }
          });
        }
      } else if (dragState.type === "resize" && dragState.corner) {
        const { initialX, initialY, initialW, initialH } = dragState;
        let newX = initialX;
        let newY = initialY;
        let newW = initialW;
        let newH = initialH;

        if (dragState.corner === "se") {
          newW = Math.max(20, initialW + dx);
          newH = Math.max(20, initialH + dy);
        } else if (dragState.corner === "sw") {
          newW = Math.max(20, initialW - dx);
          newX = initialX + (initialW - newW);
          newH = Math.max(20, initialH + dy);
        } else if (dragState.corner === "ne") {
          newW = Math.max(20, initialW + dx);
          newH = Math.max(20, initialH - dy);
          newY = initialY + (initialH - newH);
        } else if (dragState.corner === "nw") {
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
      } else if (dragState.type === "rotate") {
        const rad = Math.atan2(e.clientY - dragState.centerY, e.clientX - dragState.centerX);
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

    const handlePointerUp = () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      const el = imageElementRefs.current.get(selectedImage.id);
      if (dragState && selectedImage && pendingUpdateRef.current) {
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
      pendingUpdateRef.current = null;
      setDragState(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [dragState, selectedImage, pageWidth, pageHeight, zoom, onUpdate, onCommit]);

  return (
    <div
      className="absolute top-0 left-0 pointer-events-none z-20"
      style={{
        width: `${pageWidth}px`,
        height: `${pageHeight}px`,
        transform: `scale(${zoom || 1})`,
        transformOrigin: "0 0"
      }}
    >
      {images.map((img) => {
        const isSelected = img.id === selectedId;
        const isNonMovable = img.isMovable === false;

        return (
          <div
            key={img.id}
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
              cursor: isNonMovable ? "not-allowed" : isSelected ? "move" : "pointer"
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
              try {
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              } catch {}
              setDragState({
                type: "move",
                startX: e.clientX,
                startY: e.clientY,
                initialX: img.x,
                initialY: img.y,
                initialW: img.w,
                initialH: img.h,
                initialAngle: img.rotation || 0,
                centerX: img.x + img.w / 2,
                centerY: img.y + img.h / 2
              });
            }}
          >
            <img
              src={img.previewUrl || img.dataUrl}
              alt={img.name || "Görsel"}
              className="w-full h-full object-fill pointer-events-none select-none"
              draggable={false}
              style={{
                display: img.isOriginal && !img.isModified && !isSelected ? "none" : "block"
              }}
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
                        ...pos
                      }}
                      className="bg-white border-2 border-indigo-600 rounded-sm shadow-sm"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        try {
                          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                        } catch {}
                        setDragState({
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
                          centerY: img.y + img.h / 2
                        });
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
