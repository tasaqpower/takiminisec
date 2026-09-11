"use client";

import React, { useState, useRef, useEffect } from "react";
import type { PdfImageItem } from "./imageTypes";

interface ImageOverlayProps {
  images: PdfImageItem[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onUpdate: (id: string, updated: Partial<PdfImageItem>) => void;
  pageWidth: number;
  pageHeight: number;
}

const HANDLE_SIZE = 10;

export function ImageOverlay({
  images,
  selectedId,
  onSelect,
  onUpdate,
  pageWidth,
  pageHeight
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

  useEffect(() => {
    if (!dragState || !selectedImage) return;

    const handlePointerMove = (e: PointerEvent) => {
      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;

      if (dragState.type === "move") {
        const nextX = Math.max(0, Math.min(pageWidth - selectedImage.w, dragState.initialX + dx));
        const nextY = Math.max(0, Math.min(pageHeight - selectedImage.h, dragState.initialY + dy));
        onUpdate(selectedImage.id, { x: Math.round(nextX), y: Math.round(nextY) });
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

        onUpdate(selectedImage.id, {
          x: Math.round(newX),
          y: Math.round(newY),
          w: Math.round(newW),
          h: Math.round(newH)
        });
      } else if (dragState.type === "rotate") {
        const rad = Math.atan2(e.clientY - dragState.centerY, e.clientX - dragState.centerX);
        let deg = Math.round((rad * 180) / Math.PI) + 90;
        if (deg < 0) deg += 360;
        onUpdate(selectedImage.id, { rotation: deg % 360 });
      }
    };

    const handlePointerUp = () => {
      setDragState(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [dragState, selectedImage, pageWidth, pageHeight, onUpdate]);

  return (
    <div className="absolute inset-0 pointer-events-none z-20">
      {images.map((img) => {
        const isSelected = img.id === selectedId;
        return (
          <div
            key={img.id}
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
              cursor: isSelected ? "move" : "pointer"
            }}
            className={`transition-shadow ${
              isSelected
                ? "ring-2 ring-indigo-500 ring-offset-1 shadow-lg"
                : "hover:ring-1 hover:ring-indigo-300"
            }`}
            onPointerDown={(e) => {
              if (!isSelected) {
                onSelect(img.id);
                return;
              }
              e.stopPropagation();
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
              src={img.dataUrl}
              alt={img.name || "Görsel"}
              className="w-full h-full object-contain pointer-events-none select-none"
              draggable={false}
            />

            {/* Resize and Rotation handles when selected */}
            {isSelected && (
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
                      style={{
                        position: "absolute",
                        width: HANDLE_SIZE,
                        height: HANDLE_SIZE,
                        ...pos
                      }}
                      className="bg-white border-2 border-indigo-600 rounded-sm shadow-sm"
                      onPointerDown={(e) => {
                        e.stopPropagation();
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
