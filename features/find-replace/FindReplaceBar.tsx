"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Search,
  ChevronUp,
  ChevronDown,
  X,
  ChevronRight,
  Replace,
  Check
} from "lucide-react";
import {
  searchInDocument,
  replaceMatchInText,
  type SearchMatch,
  type SearchOptions
} from "./searchEngine";
import { toast } from "sonner";

interface FindReplaceBarProps {
  open: boolean;
  onClose: () => void;
  marks: any[];
  originalTexts?: any[];
  onUpdateMarks?: (updatedMarks: any[]) => void;
  onReplace?: (payload: { updatedMarks: any[]; newMarks: any[]; newRemovals: any[] }) => void;
  currentPage: number;
  onNavigatePage: (pageIndex: number) => void;
}

export function FindReplaceBar({
  open,
  onClose,
  marks,
  originalTexts = [],
  onUpdateMarks,
  onReplace,
  currentPage,
  onNavigatePage
}: FindReplaceBarProps) {
  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [showReplace, setShowReplace] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [scope, setScope] = useState<"all" | "current" | "custom">("all");
  const [pageRange, setPageRange] = useState("");

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [open]);

  // Determine target pages based on scope
  const targetPageScope = useMemo(() => {
    if (scope === "current") return [currentPage];
    if (scope === "custom" && pageRange.trim()) {
      const parts = pageRange.split(",").map((p) => p.trim());
      const res: number[] = [];
      for (const part of parts) {
        if (part.includes("-")) {
          const [s, e] = part.split("-").map((v) => parseInt(v.trim(), 10));
          if (!isNaN(s) && !isNaN(e)) {
            for (let i = Math.min(s, e); i <= Math.max(s, e); i++) {
              if (i >= 1) res.push(i - 1);
            }
          }
        } else {
          const n = parseInt(part, 10);
          if (!isNaN(n) && n >= 1) res.push(n - 1);
        }
      }
      return res;
    }
    return undefined;
  }, [scope, currentPage, pageRange]);

  // Compute matches across user marks and original PDF text
  const matches: SearchMatch[] = useMemo(() => {
    if (!query.trim()) return [];
    return searchInDocument(marks, originalTexts, query, {
      caseSensitive,
      wholeWord,
      scope,
      pageScope: targetPageScope
    });
  }, [marks, originalTexts, query, caseSensitive, wholeWord, scope, targetPageScope]);

  // Clamp current match index
  useEffect(() => {
    if (matches.length === 0) {
      setCurrentIndex(0);
    } else if (currentIndex >= matches.length) {
      setCurrentIndex(0);
    }
  }, [matches.length, currentIndex]);

  // Jump to match page when index changes
  const jumpToMatch = (idx: number) => {
    if (matches.length === 0) return;
    const target = matches[idx];
    if (target && target.pageIndex !== currentPage) {
      onNavigatePage(target.pageIndex);
    }
  };

  const handleNext = () => {
    if (matches.length === 0) return;
    const nextIdx = (currentIndex + 1) % matches.length;
    setCurrentIndex(nextIdx);
    jumpToMatch(nextIdx);
  };

  const handlePrev = () => {
    if (matches.length === 0) return;
    const prevIdx = (currentIndex - 1 + matches.length) % matches.length;
    setCurrentIndex(prevIdx);
    jumpToMatch(prevIdx);
  };

  const handleReplaceCurrent = () => {
    if (matches.length === 0 || !matches[currentIndex]) return;
    const currentMatch = matches[currentIndex];

    // Case A: User mark match
    if (currentMatch.markId) {
      const mark = marks.find((m) => m.id === currentMatch.markId);
      if (!mark || !mark.text) return;

      const newText = replaceMatchInText(
        mark.text,
        currentMatch.matchStart,
        currentMatch.matchLength,
        replacement
      );
      const updated = marks.map((m) => (m.id === mark.id ? { ...m, text: newText } : m));
      if (onReplace) {
        onReplace({ updatedMarks: updated, newMarks: [], newRemovals: [] });
      } else if (onUpdateMarks) {
        onUpdateMarks(updated);
      }
      toast.success("Eşleşme değiştirildi.");
      return;
    }

    // Case B: Original PDF text item match
    if (currentMatch.editableText) {
      const et = currentMatch.editableText;
      const newText = replaceMatchInText(
        et.text,
        currentMatch.matchStart,
        currentMatch.matchLength,
        replacement
      );
      const newRemoval = { id: et.id, page: et.page, quad: et.quad };
      const newMark = {
        id: `rep_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        kind: "text",
        page: et.page,
        x: et.x,
        y: et.y,
        text: newText,
        size: et.size || 12,
        font: et.fontName || "Liberation Sans",
        color: "#000000",
        bold: false,
        italic: false,
        angle: et.angle || 0
      };

      if (onReplace) {
        onReplace({ updatedMarks: marks, newMarks: [newMark], newRemovals: [newRemoval] });
      } else if (onUpdateMarks) {
        onUpdateMarks([...marks, newMark]);
      }
      toast.success("Orijinal PDF metni değiştirildi.");
      return;
    }

    // Case C: Split text across multiple items
    if (currentMatch.splitEditableTexts && currentMatch.splitEditableTexts.length > 0) {
      const items = currentMatch.splitEditableTexts;
      const removals = items.map((et: any) => ({ id: et.id, page: et.page, quad: et.quad }));
      const first = items[0];
      const newMark = {
        id: `rep_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        kind: "text",
        page: first.page,
        x: currentMatch.bounds?.x ?? first.x,
        y: currentMatch.bounds?.y ?? first.y,
        text: replacement,
        size: first.size || 12,
        font: first.fontName || "Liberation Sans",
        color: "#000000",
        bold: false,
        italic: false,
        angle: first.angle || 0
      };

      if (onReplace) {
        onReplace({ updatedMarks: marks, newMarks: [newMark], newRemovals: removals });
      } else if (onUpdateMarks) {
        onUpdateMarks([...marks, newMark]);
      }
      toast.success("Parçalı PDF metni değiştirildi.");
    }
  };

  const handleReplaceAll = () => {
    if (matches.length === 0) return;

    let count = 0;
    const updatedMarks = [...marks];
    const newMarks: any[] = [];
    const newRemovals: any[] = [];

    // Group matches by markId and editableTextId
    const byMark = new Map<string, SearchMatch[]>();
    const byOrig = new Map<string, SearchMatch[]>();
    const splitMatches: SearchMatch[] = [];

    for (const m of matches) {
      if (m.splitEditableTexts && m.splitEditableTexts.length > 0) {
        splitMatches.push(m);
      } else if (m.markId) {
        const list = byMark.get(m.markId) || [];
        list.push(m);
        byMark.set(m.markId, list);
      } else if (m.editableTextId && m.editableText) {
        const list = byOrig.get(m.editableTextId) || [];
        list.push(m);
        byOrig.set(m.editableTextId, list);
      }
    }

    // 1. Process marks
    for (const [mId, hitList] of byMark.entries()) {
      const idx = updatedMarks.findIndex((m) => m.id === mId);
      if (idx !== -1 && updatedMarks[idx]?.text) {
        let text = updatedMarks[idx].text;
        hitList.sort((a, b) => b.matchStart - a.matchStart);
        for (const h of hitList) {
          text = replaceMatchInText(text, h.matchStart, h.matchLength, replacement);
          count++;
        }
        updatedMarks[idx] = { ...updatedMarks[idx], text };
      }
    }

    // 2. Process original PDF texts
    for (const [, hitList] of byOrig.entries()) {
      const et = hitList[0].editableText;
      let text = et.text;
      hitList.sort((a, b) => b.matchStart - a.matchStart);
      for (const h of hitList) {
        text = replaceMatchInText(text, h.matchStart, h.matchLength, replacement);
        count++;
      }
      newRemovals.push({ id: et.id, page: et.page, quad: et.quad });
      newMarks.push({
        id: `rep_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        kind: "text",
        page: et.page,
        x: et.x,
        y: et.y,
        text,
        size: et.size || 12,
        font: et.fontName || "Liberation Sans",
        color: "#000000",
        bold: false,
        italic: false,
        angle: et.angle || 0
      });
    }

    // 3. Process split text matches
    for (const sm of splitMatches) {
      if (!sm.splitEditableTexts) continue;
      for (const et of sm.splitEditableTexts) {
        newRemovals.push({ id: et.id, page: et.page, quad: et.quad });
      }
      const first = sm.splitEditableTexts[0];
      newMarks.push({
        id: `rep_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        kind: "text",
        page: first.page,
        x: sm.bounds?.x ?? first.x,
        y: sm.bounds?.y ?? first.y,
        text: replacement,
        size: first.size || 12,
        font: first.fontName || "Liberation Sans",
        color: "#000000",
        bold: false,
        italic: false,
        angle: first.angle || 0
      });
      count++;
    }

    if (onReplace) {
      onReplace({ updatedMarks, newMarks, newRemovals });
    } else if (onUpdateMarks) {
      onUpdateMarks([...updatedMarks, ...newMarks]);
    }
    toast.success(`${count} eşleşme tek adımda değiştirildi.`);
  };

  if (!open) return null;

  return (
    <div
      className="absolute top-4 right-6 z-40 bg-white/95 backdrop-blur-md shadow-2xl border border-slate-200/90 rounded-xl p-2.5 w-96 text-xs text-slate-700 animate-in fade-in slide-in-from-top-2 duration-150"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          onClose();
        }
      }}
    >
      {/* Search row */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setShowReplace(!showReplace)}
          className={`p-1 rounded hover:bg-slate-100 transition-transform duration-150 ${
            showReplace ? "rotate-90 text-indigo-600" : "text-slate-400"
          }`}
          title={showReplace ? "Değiştir bölmesini gizle" : "Değiştir bölmesini aç"}
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        <div className="relative flex-1">
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Belgede ara…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (e.shiftKey) handlePrev();
                else handleNext();
              }
            }}
            className="w-full pl-7 pr-16 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />

          {query && (
            <span className="absolute right-2 top-2 text-[10px] font-medium text-slate-400">
              {matches.length > 0 ? `${currentIndex + 1}/${matches.length}` : "0/0"}
            </span>
          )}
        </div>

        {/* Case sensitive */}
        <button
          type="button"
          onClick={() => setCaseSensitive(!caseSensitive)}
          className={`px-1.5 py-1 font-bold rounded text-[11px] transition-colors ${
            caseSensitive ? "bg-indigo-100 text-indigo-700" : "text-slate-400 hover:bg-slate-100"
          }`}
          title="Büyük/Küçük Harfe Duyarlı"
        >
          Aa
        </button>

        {/* Whole word */}
        <button
          type="button"
          onClick={() => setWholeWord(!wholeWord)}
          className={`px-1.5 py-1 font-semibold rounded text-[11px] transition-colors ${
            wholeWord ? "bg-indigo-100 text-indigo-700" : "text-slate-400 hover:bg-slate-100"
          }`}
          title="Tam Kelime Eşleştir"
        >
          \b
        </button>

        {/* Nav buttons */}
        <button
          type="button"
          disabled={matches.length === 0}
          onClick={handlePrev}
          className="p-1 text-slate-600 hover:bg-slate-100 rounded disabled:opacity-30"
          title="Önceki (Shift+Enter)"
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          disabled={matches.length === 0}
          onClick={handleNext}
          className="p-1 text-slate-600 hover:bg-slate-100 rounded disabled:opacity-30"
          title="Sonraki (Enter)"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>

        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded ml-0.5"
          title="Kapat (Esc)"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Scope Selector */}
      <div className="flex items-center gap-1 mt-2 pt-1.5 border-t border-slate-100 text-[11px]">
        <span className="text-slate-400 mr-1">Kapsam:</span>
        <button
          type="button"
          onClick={() => setScope("all")}
          className={`px-2 py-0.5 rounded font-medium transition-colors ${
            scope === "all" ? "bg-indigo-100 text-indigo-700" : "text-slate-500 hover:bg-slate-100"
          }`}
        >
          Tüm Belge
        </button>
        <button
          type="button"
          onClick={() => setScope("current")}
          className={`px-2 py-0.5 rounded font-medium transition-colors ${
            scope === "current" ? "bg-indigo-100 text-indigo-700" : "text-slate-500 hover:bg-slate-100"
          }`}
        >
          Geçerli Sayfa ({currentPage + 1})
        </button>
        <button
          type="button"
          onClick={() => setScope("custom")}
          className={`px-2 py-0.5 rounded font-medium transition-colors ${
            scope === "custom" ? "bg-indigo-100 text-indigo-700" : "text-slate-500 hover:bg-slate-100"
          }`}
        >
          Seçili Sayfalar
        </button>
        {scope === "custom" && (
          <input
            type="text"
            placeholder="Örn: 1-3, 5"
            value={pageRange}
            onChange={(e) => setPageRange(e.target.value)}
            className="w-20 px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded text-[10px] focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        )}
      </div>

      {/* Replace row */}
      {showReplace && (
        <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-1.5 pl-6">
          <input
            type="text"
            placeholder="Yeni metin ile değiştir…"
            value={replacement}
            onChange={(e) => setReplacement(e.target.value)}
            className="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />

          <button
            type="button"
            disabled={matches.length === 0}
            onClick={handleReplaceCurrent}
            className="px-2.5 py-1.5 font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md disabled:opacity-40 transition-colors"
          >
            Değiştir
          </button>
          <button
            type="button"
            disabled={matches.length === 0}
            onClick={handleReplaceAll}
            className="px-2.5 py-1.5 font-medium bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-md disabled:opacity-40 transition-colors"
          >
            Tümünü
          </button>
        </div>
      )}
    </div>
  );
}
