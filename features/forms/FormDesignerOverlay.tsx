"use client";

import React, { useState, useEffect } from "react";
import {
  Type,
  AlignLeft,
  CheckSquare,
  List,
  Calendar,
  PenTool,
  Trash2,
  Settings,
  Plus
} from "lucide-react";
import type { FormFieldItem, FormFieldType } from "./formTypes";

interface FormDesignerOverlayProps {
  fields: FormFieldItem[];
  pageIndex: number;
  onAddField: (type: FormFieldType) => void;
  onUpdateField: (id: string, updated: Partial<FormFieldItem>) => void;
  onDeleteField: (id: string) => void;
  pageWidth: number;
  pageHeight: number;
}

const HANDLE_SIZE = 8;

export function FormDesignerOverlay({
  fields,
  pageIndex,
  onAddField,
  onUpdateField,
  onDeleteField,
  pageWidth,
  pageHeight
}: FormDesignerOverlayProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingProps, setEditingProps] = useState<FormFieldItem | null>(null);

  const [dragState, setDragState] = useState<{
    type: "move" | "resize";
    corner?: "nw" | "ne" | "se" | "sw";
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
    initialW: number;
    initialH: number;
  } | null>(null);

  const pageFields = fields.filter((f) => f.page === pageIndex);
  const selectedField = pageFields.find((f) => f.id === selectedId) || null;

  useEffect(() => {
    if (!dragState || !selectedField) return;

    const handlePointerMove = (e: PointerEvent) => {
      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;

      if (dragState.type === "move") {
        const nextX = Math.max(0, Math.min(pageWidth - selectedField.w, dragState.initialX + dx));
        const nextY = Math.max(0, Math.min(pageHeight - selectedField.h, dragState.initialY + dy));
        onUpdateField(selectedField.id, { x: Math.round(nextX), y: Math.round(nextY) });
      } else if (dragState.type === "resize" && dragState.corner) {
        const { initialX, initialY, initialW, initialH } = dragState;
        let newX = initialX;
        let newY = initialY;
        let newW = initialW;
        let newH = initialH;

        if (dragState.corner === "se") {
          newW = Math.max(24, initialW + dx);
          newH = Math.max(20, initialH + dy);
        } else if (dragState.corner === "sw") {
          newW = Math.max(24, initialW - dx);
          newX = initialX + (initialW - newW);
          newH = Math.max(20, initialH + dy);
        } else if (dragState.corner === "ne") {
          newW = Math.max(24, initialW + dx);
          newH = Math.max(20, initialH - dy);
          newY = initialY + (initialH - newH);
        } else if (dragState.corner === "nw") {
          newW = Math.max(24, initialW - dx);
          newX = initialX + (initialW - newW);
          newH = Math.max(20, initialH - dy);
          newY = initialY + (initialH - newH);
        }

        onUpdateField(selectedField.id, {
          x: Math.round(newX),
          y: Math.round(newY),
          w: Math.round(newW),
          h: Math.round(newH)
        });
      }
    };

    const handlePointerUp = () => setDragState(null);

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [dragState, selectedField, pageWidth, pageHeight, onUpdateField]);

  return (
    <div className="absolute inset-0 pointer-events-none z-20">
      {/* Floating Toolbar to Add Form Fields */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 pointer-events-auto flex items-center gap-1 bg-white/95 backdrop-blur-md shadow-lg border border-slate-200/90 px-2.5 py-1.5 rounded-full text-xs">
        <span className="text-[11px] font-semibold text-slate-500 px-1">Alan Ekle:</span>
        <button
          type="button"
          onClick={() => onAddField("text")}
          className="inline-flex items-center gap-1 px-2 py-1 text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 rounded font-medium transition-colors"
          title="Tek Satırlı Metin Kutusu"
        >
          <Type className="w-3.5 h-3.5" /> Metin
        </button>
        <button
          type="button"
          onClick={() => onAddField("multiline")}
          className="inline-flex items-center gap-1 px-2 py-1 text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 rounded font-medium transition-colors"
          title="Çok Satırlı Metin Kutusu"
        >
          <AlignLeft className="w-3.5 h-3.5" /> Paragraf
        </button>
        <button
          type="button"
          onClick={() => onAddField("checkbox")}
          className="inline-flex items-center gap-1 px-2 py-1 text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 rounded font-medium transition-colors"
          title="Onay Kutusu"
        >
          <CheckSquare className="w-3.5 h-3.5" /> Onay
        </button>
        <button
          type="button"
          onClick={() => onAddField("dropdown")}
          className="inline-flex items-center gap-1 px-2 py-1 text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 rounded font-medium transition-colors"
          title="Açılır Seçim Listesi"
        >
          <List className="w-3.5 h-3.5" /> Liste
        </button>
        <button
          type="button"
          onClick={() => onAddField("date")}
          className="inline-flex items-center gap-1 px-2 py-1 text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 rounded font-medium transition-colors"
          title="Tarih Alanı"
        >
          <Calendar className="w-3.5 h-3.5" /> Tarih
        </button>
        <button
          type="button"
          onClick={() => onAddField("signature")}
          className="inline-flex items-center gap-1 px-2 py-1 text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 rounded font-medium transition-colors"
          title="İmza Alanı"
        >
          <PenTool className="w-3.5 h-3.5" /> İmza
        </button>
      </div>

      {/* Render existing form fields on the page */}
      {pageFields.map((f) => {
        const isSelected = f.id === selectedId;

        return (
          <div
            key={f.id}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedId(f.id);
            }}
            style={{
              position: "absolute",
              left: `${f.x}px`,
              top: `${f.y}px`,
              width: `${f.w}px`,
              height: `${f.h}px`,
              pointerEvents: "auto",
              cursor: isSelected ? "move" : "pointer"
            }}
            className={`border rounded flex items-center justify-between px-2 select-none transition-all ${
              isSelected
                ? "border-indigo-600 bg-indigo-50/50 shadow-md ring-2 ring-indigo-400"
                : "border-dashed border-indigo-400 bg-indigo-50/20 hover:bg-indigo-50/35"
            }`}
            onPointerDown={(e) => {
              if (!isSelected) {
                setSelectedId(f.id);
                return;
              }
              e.stopPropagation();
              setDragState({
                type: "move",
                startX: e.clientX,
                startY: e.clientY,
                initialX: f.x,
                initialY: f.y,
                initialW: f.w,
                initialH: f.h
              });
            }}
          >
            <span className="text-[11px] font-semibold text-indigo-900 truncate">
              {f.name || f.type}
            </span>

            {isSelected && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingProps(f);
                  }}
                  className="p-1 hover:bg-white rounded text-indigo-700"
                  title="Özellikler"
                >
                  <Settings className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteField(f.id);
                  }}
                  className="p-1 hover:bg-rose-100 rounded text-rose-600"
                  title="Alanı Sil"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Resize handles */}
            {isSelected &&
              (["nw", "ne", "se", "sw"] as const).map((corner) => {
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
                return (
                  <div
                    key={corner}
                    style={{
                      position: "absolute",
                      width: HANDLE_SIZE,
                      height: HANDLE_SIZE,
                      ...getPos()
                    }}
                    className="bg-white border-2 border-indigo-600 rounded-sm shadow-sm"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      setDragState({
                        type: "resize",
                        corner,
                        startX: e.clientX,
                        startY: e.clientY,
                        initialX: f.x,
                        initialY: f.y,
                        initialW: f.w,
                        initialH: f.h
                      });
                    }}
                  />
                );
              })}
          </div>
        );
      })}

      {/* Properties editing modal/card */}
      {editingProps && (
        <div className="absolute top-16 right-4 z-40 bg-white shadow-2xl border border-slate-200 rounded-xl p-4 w-72 pointer-events-auto text-xs space-y-3">
          <div className="flex justify-between items-center border-b pb-2">
            <span className="font-semibold text-slate-800">Alan Ayarları</span>
            <button
              type="button"
              onClick={() => setEditingProps(null)}
              className="text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          </div>
          <div>
            <label className="block text-slate-500 mb-1 font-medium">Alan Adı (Name)</label>
            <input
              type="text"
              value={editingProps.name}
              onChange={(e) => {
                const next = { ...editingProps, name: e.target.value };
                setEditingProps(next);
                onUpdateField(editingProps.id, { name: e.target.value });
              }}
              className="w-full px-2.5 py-1.5 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-slate-500 mb-1 font-medium">Varsayılan Değer</label>
            <input
              type="text"
              value={String(editingProps.value || "")}
              onChange={(e) => {
                const next = { ...editingProps, value: e.target.value };
                setEditingProps(next);
                onUpdateField(editingProps.id, { value: e.target.value });
              }}
              className="w-full px-2.5 py-1.5 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          {editingProps.type === "dropdown" && (
            <div>
              <label className="block text-slate-500 mb-1 font-medium">Seçenekler (Virgülle ayırın)</label>
              <input
                type="text"
                value={(editingProps.options || []).join(", ")}
                onChange={(e) => {
                  const opts = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
                  const next = { ...editingProps, options: opts };
                  setEditingProps(next);
                  onUpdateField(editingProps.id, { options: opts });
                }}
                className="w-full px-2.5 py-1.5 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          )}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="reqCheck"
              checked={editingProps.required || false}
              onChange={(e) => {
                const next = { ...editingProps, required: e.target.checked };
                setEditingProps(next);
                onUpdateField(editingProps.id, { required: e.target.checked });
              }}
              className="rounded text-indigo-600"
            />
            <label htmlFor="reqCheck" className="text-slate-700 font-medium cursor-pointer">
              Zorunlu Alan
            </label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="roCheck"
              checked={editingProps.readOnly || false}
              onChange={(e) => {
                const next = { ...editingProps, readOnly: e.target.checked };
                setEditingProps(next);
                onUpdateField(editingProps.id, { readOnly: e.target.checked });
              }}
              className="rounded text-indigo-600"
            />
            <label htmlFor="roCheck" className="text-slate-700 font-medium cursor-pointer">
              Salt Okunur (Read-only)
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
