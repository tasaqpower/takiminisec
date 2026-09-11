"use client";

import React from "react";
import type { FormFieldItem } from "./formTypes";

interface FormFieldsLayerProps {
  fields: FormFieldItem[];
  pageIndex: number;
  onFieldValueChange: (id: string, value: string | boolean) => void;
}

export function FormFieldsLayer({
  fields,
  pageIndex,
  onFieldValueChange
}: FormFieldsLayerProps) {
  const pageFields = fields.filter((f) => f.page === pageIndex);
  if (pageFields.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      {pageFields.map((f) => {
        const style: React.CSSProperties = {
          position: "absolute",
          left: `${f.x}px`,
          top: `${f.y}px`,
          width: `${f.w}px`,
          height: `${f.h}px`,
          pointerEvents: "auto"
        };

        if (f.type === "checkbox") {
          return (
            <div key={f.id} style={style} className="flex items-center justify-center">
              <input
                type="checkbox"
                checked={f.value === true}
                onChange={(e) => onFieldValueChange(f.id, e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer shadow-sm"
              />
            </div>
          );
        }

        if (f.type === "dropdown") {
          return (
            <select
              key={f.id}
              style={style}
              value={String(f.value || "")}
              onChange={(e) => onFieldValueChange(f.id, e.target.value)}
              className="bg-white/90 border border-slate-300 rounded px-2 py-0.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-sm"
            >
              <option value="">Seçiniz…</option>
              {(f.options || []).map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          );
        }

        if (f.type === "multiline") {
          return (
            <textarea
              key={f.id}
              style={style}
              value={String(f.value || "")}
              onChange={(e) => onFieldValueChange(f.id, e.target.value)}
              className="bg-white/90 border border-slate-300 rounded p-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none shadow-sm"
              placeholder={f.label || "Metin girin…"}
            />
          );
        }

        if (f.type === "date") {
          return (
            <input
              key={f.id}
              type="date"
              style={style}
              value={String(f.value || "")}
              onChange={(e) => onFieldValueChange(f.id, e.target.value)}
              className="bg-white/90 border border-slate-300 rounded px-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-sm"
            />
          );
        }

        // Standard text field or signature placeholder
        return (
          <input
            key={f.id}
            type="text"
            style={style}
            value={String(f.value || "")}
            onChange={(e) => onFieldValueChange(f.id, e.target.value)}
            className="bg-white/90 border border-slate-300 rounded px-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-sm"
            placeholder={f.label || f.name || "Metin girin…"}
          />
        );
      })}
    </div>
  );
}
