"use client";

import React, { useState } from "react";
import {
  MessageSquare,
  CheckCircle,
  Circle,
  Trash2,
  Download,
  Filter,
  X,
  FileSpreadsheet,
  Edit2,
  Check,
} from "lucide-react";
import type { PdfAnnotation, AnnotationFilter } from "./annotationTypes";
import { exportAnnotationsReport } from "./annotationEngine";

interface AnnotationSidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  annotations: PdfAnnotation[];
  onUpdateAnnotation: (annot: PdfAnnotation) => void;
  onDeleteAnnotation: (id: string) => void;
  onJumpToAnnotation?: (annot: PdfAnnotation) => void;
  pageCount: number;
}

export function AnnotationSidePanel({
  isOpen,
  onClose,
  annotations,
  onUpdateAnnotation,
  onDeleteAnnotation,
  onJumpToAnnotation,
  pageCount,
}: AnnotationSidePanelProps) {
  const [filter, setFilter] = useState<AnnotationFilter>({
    pageIndex: "all",
    author: "all",
    resolved: "all",
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState<string>("");

  if (!isOpen) return null;

  // Unique authors
  const authors = Array.from(new Set(annotations.map((a) => a.author || "Kullanıcı")));

  // Filtered annotations
  const filtered = annotations.filter((a) => {
    if (filter.pageIndex !== "all" && a.pageIndex !== filter.pageIndex) return false;
    if (filter.author !== "all" && a.author !== filter.author) return false;
    if (filter.resolved !== "all" && a.resolved !== filter.resolved) return false;
    return true;
  });

  const handleExportJson = async () => {
    const jsonStr = (await exportAnnotationsReport(annotations, "json")) as string;
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `yorumlar_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportSummaryPdf = async () => {
    const pdfBytes = (await exportAnnotationsReport(annotations, "summaryPdf")) as Uint8Array;
    const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `yorum_raporu_${Date.now()}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-80 border-l border-slate-800 bg-slate-900/95 flex flex-col h-full text-slate-100 animate-in slide-in-from-right duration-150">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-indigo-400" />
          <h3 className="text-sm font-semibold">Yorumlar & İnceleme</h3>
          <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full font-medium">
            {filtered.length}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Filter Bar */}
      <div className="p-3 border-b border-slate-800 bg-slate-950/40 space-y-2">
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <Filter className="w-3.5 h-3.5" />
          <span>Filtrele</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <select
            value={filter.pageIndex}
            onChange={(e) =>
              setFilter((prev) => ({
                ...prev,
                pageIndex: e.target.value === "all" ? "all" : parseInt(e.target.value),
              }))
            }
            className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200"
          >
            <option value="all">Tüm Sayfalar</option>
            {Array.from({ length: pageCount }).map((_, i) => (
              <option key={i} value={i}>
                Sayfa {i + 1}
              </option>
            ))}
          </select>

          <select
            value={filter.resolved === "all" ? "all" : filter.resolved ? "true" : "false"}
            onChange={(e) =>
              setFilter((prev) => ({
                ...prev,
                resolved:
                  e.target.value === "all"
                    ? "all"
                    : e.target.value === "true",
              }))
            }
            className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200"
          >
            <option value="all">Tüm Durumlar</option>
            <option value="false">Açık Yorumlar</option>
            <option value="true">Çözülenler</option>
          </select>
        </div>

        {authors.length > 1 && (
          <select
            value={filter.author}
            onChange={(e) =>
              setFilter((prev) => ({ ...prev, author: e.target.value }))
            }
            className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200"
          >
            <option value="all">Tüm Yazarlar</option>
            {authors.map((auth) => (
              <option key={auth} value={auth}>
                {auth}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Annotation List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500">
            Filtreye uygun yorum bulunamadı.
          </div>
        ) : (
          filtered.map((annot) => {
            const isEditing = editingId === annot.id;

            return (
              <div
                key={annot.id}
                onClick={() => onJumpToAnnotation?.(annot)}
                className={`p-3 rounded-lg border text-xs space-y-2 transition-colors cursor-pointer ${
                  annot.resolved
                    ? "bg-slate-950/40 border-slate-800/60 opacity-60"
                    : "bg-slate-800/40 border-slate-700/80 hover:border-indigo-500/50"
                }`}
              >
                {/* Header: Author & Page */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-slate-200">{annot.author}</span>
                    <span className="text-[10px] bg-slate-800 px-1.5 py-0.2 rounded text-slate-400">
                      S. {annot.pageIndex + 1}
                    </span>
                    <span className="text-[10px] text-indigo-400 uppercase font-medium">
                      {annot.type}
                    </span>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdateAnnotation({ ...annot, resolved: !annot.resolved });
                    }}
                    title={annot.resolved ? "Yeniden Aç" : "Çözüldü Olarak İşaretle"}
                    className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200"
                  >
                    {annot.resolved ? (
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Circle className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                {/* Content / Edit Box */}
                {isEditing ? (
                  <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="w-full bg-slate-950 border border-indigo-500 rounded p-1.5 text-xs text-slate-200 focus:outline-none resize-none"
                      rows={2}
                    />
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]"
                      >
                        İptal
                      </button>
                      <button
                        onClick={() => {
                          onUpdateAnnotation({ ...annot, contents: editContent });
                          setEditingId(null);
                        }}
                        className="flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-600 text-white text-[10px]"
                      >
                        <Check className="w-3 h-3" /> Kaydet
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-300 whitespace-pre-wrap">
                    {annot.contents || (
                      <span className="italic text-slate-500">Açıklama girilmedi</span>
                    )}
                  </p>
                )}

                {/* Footer Controls */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[10px] text-slate-500">
                  <span>{annot.date.slice(0, 10)}</span>
                  <div className="flex items-center gap-1">
                    {!isEditing && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingId(annot.id);
                          setEditContent(annot.contents);
                        }}
                        className="p-1 hover:text-slate-300 rounded"
                        title="Düzenle"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteAnnotation(annot.id);
                      }}
                      className="p-1 hover:text-rose-400 rounded"
                      title="Sil"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Export Footer */}
      <div className="p-3 border-t border-slate-800 bg-slate-900 space-y-1.5">
        <div className="text-[11px] font-semibold text-slate-400">Yorumları Dışa Aktar</div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleExportJson}
            className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 text-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-indigo-400" />
            JSON İndir
          </button>
          <button
            onClick={handleExportSummaryPdf}
            className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 text-xs transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            Özet PDF
          </button>
        </div>
      </div>
    </div>
  );
}
