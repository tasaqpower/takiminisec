"use client";

import React, { useState } from "react";
import {
  Bookmark,
  ListOrdered,
  Link2,
  Plus,
  Trash2,
  X,
  Check,
  AlertTriangle,
  Download,
  FileText,
  ExternalLink,
} from "lucide-react";
import type { PdfBookmarkItem, PdfLinkItem, TocHeadingCandidate } from "./navigationTypes";
import {
  validateLink,
  writeBookmarksToPdf,
  generateTocPage,
  addLinksToPdf,
} from "./navigationEngine";

interface NavigationModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfBytes?: Uint8Array | null;
  fileName?: string;
  pageCount?: number;
  onApplyToWorkspace?: (modifiedPdfBytes: Uint8Array) => void;
}

export function NavigationModal({
  isOpen,
  onClose,
  pdfBytes,
  fileName = "belge.pdf",
  pageCount = 1,
  onApplyToWorkspace,
}: NavigationModalProps) {
  const [activeTab, setActiveTab] = useState<"bookmarks" | "toc" | "links">("bookmarks");
  const [isProcessing, setIsProcessing] = useState(false);

  // Bookmarks state
  const [bookmarks, setBookmarks] = useState<PdfBookmarkItem[]>([
    { id: "bm_1", title: "1. Giriş ve Kapsam", pageIndex: 0 },
    { id: "bm_2", title: "2. Hükümler ve Şartlar", pageIndex: 1 },
  ]);

  // TOC state
  const [headings, setHeadings] = useState<TocHeadingCandidate[]>([
    { id: "h_1", title: "GİRİŞ", pageIndex: 0, level: 1, fontSize: 16, selected: true },
    { id: "h_2", title: "Genel Şartlar", pageIndex: 0, level: 2, fontSize: 14, selected: true },
    { id: "h_3", title: "YÜKÜMLÜLÜKLER", pageIndex: 1, level: 1, fontSize: 16, selected: true },
  ]);

  // Links state
  const [links, setLinks] = useState<PdfLinkItem[]>([
    {
      id: "l_1",
      pageIndex: 0,
      rect: [50, 680, 200, 700],
      type: "external",
      target: "https://example.com/sozlesme",
      displayText: "Sözleşme Detayları",
    },
  ]);

  const [newLinkTarget, setNewLinkTarget] = useState("");
  const [newLinkType, setNewLinkType] = useState<"external" | "internal" | "email">("external");
  const [newLinkPage, setNewLinkPage] = useState(0);

  if (!isOpen) return null;

  const handleApply = async (importToWorkspace: boolean = false) => {
    if (!pdfBytes) {
      alert("PDF belgesi bulunamadı.");
      return;
    }

    setIsProcessing(true);
    try {
      let result = pdfBytes;

      if (activeTab === "bookmarks" && bookmarks.length > 0) {
        result = await writeBookmarksToPdf(result, bookmarks);
      } else if (activeTab === "toc" && headings.length > 0) {
        result = await generateTocPage(result, headings);
      } else if (activeTab === "links" && links.length > 0) {
        result = await addLinksToPdf(result, links);
      }

      if (importToWorkspace && onApplyToWorkspace) {
        onApplyToWorkspace(result);
        onClose();
      } else {
        const blob = new Blob([result as unknown as BlobPart], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `navigasyonlu_${fileName}`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err: unknown) {
      alert(`İşlem hatası: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddLink = () => {
    const val = validateLink(newLinkTarget, newLinkType);
    if (!val.isValid || val.isDangerous) {
      alert("Geçersiz veya tehlikeli (javascript:, data:) bağlantı girildi!");
      return;
    }

    setLinks((prev) => [
      ...prev,
      {
        id: `link_${Date.now()}`,
        pageIndex: newLinkPage,
        rect: [50, 500, 250, 520],
        type: newLinkType,
        target: val.sanitized,
      },
    ]);
    setNewLinkTarget("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative flex flex-col w-full max-w-4xl h-[85vh] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg">
              <Bookmark className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                Yer İmleri, İçindekiler ve Bağlantılar
              </h2>
              <p className="text-xs text-slate-400">
                PDF outline ağacını düzenleyin, tıklanabilir içindekiler sayfası ekleyin veya güvenli bağlantılar tanımlayın.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-slate-800 bg-slate-950/40">
          <button
            onClick={() => setActiveTab("bookmarks")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
              activeTab === "bookmarks"
                ? "border-indigo-500 text-indigo-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Bookmark className="w-4 h-4" />
            Yer İmleri ({bookmarks.length})
          </button>
          <button
            onClick={() => setActiveTab("toc")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
              activeTab === "toc"
                ? "border-indigo-500 text-indigo-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <ListOrdered className="w-4 h-4" />
            İçindekiler Tablosu ({headings.length})
          </button>
          <button
            onClick={() => setActiveTab("links")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
              activeTab === "links"
                ? "border-indigo-500 text-indigo-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Link2 className="w-4 h-4" />
            Bağlantılar ({links.length})
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-950/30">
          {/* TAB 1: BOOKMARKS */}
          {activeTab === "bookmarks" && (
            <div className="max-w-2xl mx-auto space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">
                  Yer İmi Ağacı (Outlines)
                </span>
                <button
                  onClick={() =>
                    setBookmarks((prev) => [
                      ...prev,
                      {
                        id: `bm_${Date.now()}`,
                        title: `Yeni Başlık ${prev.length + 1}`,
                        pageIndex: 0,
                      },
                    ])
                  }
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Yer İmi Ekle
                </button>
              </div>

              <div className="space-y-2">
                {bookmarks.map((bm, idx) => (
                  <div
                    key={bm.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs"
                  >
                    <div className="flex items-center gap-3 flex-1 mr-3">
                      <Bookmark className="w-4 h-4 text-indigo-400 shrink-0" />
                      <input
                        type="text"
                        value={bm.title}
                        onChange={(e) => {
                          const val = e.target.value;
                          setBookmarks((prev) =>
                            prev.map((b) => (b.id === bm.id ? { ...b, title: val } : b))
                          );
                        }}
                        className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 flex-1"
                      />
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <span className="text-slate-400">Hedef:</span>
                        <select
                          value={bm.pageIndex}
                          onChange={(e) => {
                            const p = parseInt(e.target.value);
                            setBookmarks((prev) =>
                              prev.map((b) => (b.id === bm.id ? { ...b, pageIndex: p } : b))
                            );
                          }}
                          className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200"
                        >
                          {Array.from({ length: pageCount }).map((_, pidx) => (
                            <option key={pidx} value={pidx}>
                              Sayfa {pidx + 1}
                            </option>
                          ))}
                        </select>
                      </div>

                      <button
                        onClick={() => setBookmarks((prev) => prev.filter((b) => b.id !== bm.id))}
                        className="p-1 text-slate-500 hover:text-rose-400 rounded"
                        title="Sil"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: TOC */}
          {activeTab === "toc" && (
            <div className="max-w-2xl mx-auto space-y-4">
              <p className="text-xs text-slate-400">
                Belgenin en başına tıklanabilir bir &quot;İÇİNDEKİLER&quot; sayfası eklenir. Tıklanan başlık doğrudan ilgili sayfaya yönlendirir.
              </p>

              <div className="space-y-2">
                {headings.map((h) => (
                  <div
                    key={h.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs"
                  >
                    <div className="flex items-center gap-3 flex-1 mr-3">
                      <input
                        type="checkbox"
                        checked={h.selected}
                        onChange={(e) =>
                          setHeadings((prev) =>
                            prev.map((item) =>
                              item.id === h.id ? { ...item, selected: e.target.checked } : item
                            )
                          )
                        }
                        className="rounded accent-indigo-500"
                      />
                      <select
                        value={h.level}
                        onChange={(e) => {
                          const lvl = parseInt(e.target.value) as 1 | 2 | 3;
                          setHeadings((prev) =>
                            prev.map((item) =>
                              item.id === h.id ? { ...item, level: lvl } : item
                            )
                          );
                        }}
                        className="bg-slate-950 border border-slate-800 rounded px-1.5 py-1 text-slate-200 font-semibold"
                      >
                        <option value={1}>H1</option>
                        <option value={2}>H2</option>
                        <option value={3}>H3</option>
                      </select>
                      <input
                        type="text"
                        value={h.title}
                        onChange={(e) => {
                          const val = e.target.value;
                          setHeadings((prev) =>
                            prev.map((item) =>
                              item.id === h.id ? { ...item, title: val } : item
                            )
                          );
                        }}
                        className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 flex-1"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">Sayfa:</span>
                      <select
                        value={h.pageIndex}
                        onChange={(e) => {
                          const p = parseInt(e.target.value);
                          setHeadings((prev) =>
                            prev.map((item) =>
                              item.id === h.id ? { ...item, pageIndex: p } : item
                            )
                          );
                        }}
                        className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200"
                      >
                        {Array.from({ length: pageCount }).map((_, pidx) => (
                          <option key={pidx} value={pidx}>
                            {pidx + 1}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: LINKS */}
          {activeTab === "links" && (
            <div className="max-w-2xl mx-auto space-y-4">
              {/* Add Link Input */}
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg space-y-3">
                <span className="text-xs font-semibold text-slate-300 block">
                  Yeni Bağlantı Ekle
                </span>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <select
                    value={newLinkType}
                    onChange={(e) => setNewLinkType(e.target.value as any)}
                    className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200"
                  >
                    <option value="external">Harici Web (HTTPS)</option>
                    <option value="internal">Belge İçi Sayfa</option>
                    <option value="email">E-posta (mailto)</option>
                  </select>

                  <input
                    type="text"
                    placeholder={
                      newLinkType === "external"
                        ? "https://site.com"
                        : newLinkType === "email"
                        ? "ornek@firma.com"
                        : "Sayfa No (örn: 3)"
                    }
                    value={newLinkTarget}
                    onChange={(e) => setNewLinkTarget(e.target.value)}
                    className="col-span-2 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-400">Bulunacağı Sayfa:</span>
                    <select
                      value={newLinkPage}
                      onChange={(e) => setNewLinkPage(parseInt(e.target.value))}
                      className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200"
                    >
                      {Array.from({ length: pageCount }).map((_, pidx) => (
                        <option key={pidx} value={pidx}>
                          Sayfa {pidx + 1}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={handleAddLink}
                    disabled={!newLinkTarget.trim()}
                    className="flex items-center gap-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded text-xs font-medium"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Bağlantı Ekle
                  </button>
                </div>
              </div>

              {/* Links List */}
              <div className="space-y-2">
                {links.map((lnk) => (
                  <div
                    key={lnk.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs"
                  >
                    <div className="flex items-center gap-2 flex-1 mr-3 truncate">
                      <Link2 className="w-4 h-4 text-indigo-400 shrink-0" />
                      <span className="font-mono text-slate-300 truncate">{lnk.target}</span>
                      <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
                        S. {lnk.pageIndex + 1}
                      </span>
                    </div>

                    <button
                      onClick={() => setLinks((prev) => prev.filter((l) => l.id !== lnk.id))}
                      className="p-1 text-slate-500 hover:text-rose-400 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-900/90">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            İptal
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleApply(false)}
              disabled={isProcessing}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow-md transition-colors disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              Uygula ve İndir
            </button>

            {onApplyToWorkspace && (
              <button
                onClick={() => handleApply(true)}
                disabled={isProcessing}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition-colors disabled:opacity-50"
              >
                <FileText className="w-4 h-4 text-emerald-400" />
                Çalışma Alanına Uygula
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
