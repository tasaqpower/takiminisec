"use client";

import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { getLatestDraft, deleteDraft, type FormaDraft } from "./db";
import { FileText, FileType2, RotateCcw, Trash2, Clock, Layers } from "lucide-react";

interface RecoveryDialogProps {
  onRestore: (draft: FormaDraft) => void;
  onDiscard?: () => void;
}

export function RecoveryDialog({ onRestore, onDiscard }: RecoveryDialogProps) {
  const [draft, setDraft] = useState<FormaDraft | null>(null);
  const [draftTime, setDraftTime] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    getLatestDraft().then((latest) => {
      if (mounted && latest) {
        setDraft(latest);
        const diff = Math.floor((Date.now() - latest.timestamp) / 1000);
        const text = diff < 60 ? "az önce" : diff < 3600 ? `${Math.floor(diff / 60)} dakika önce` : `${Math.floor(diff / 3600)} saat önce`;
        setDraftTime(text);
        setIsOpen(true);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (!draft) return null;

  const handleRestore = () => {
    setIsOpen(false);
    onRestore(draft);
  };

  const handleDiscard = async () => {
    await deleteDraft(draft.id);
    setDraft(null);
    setIsOpen(false);
    onDiscard?.();
  };

  const changesCount =
    (draft.marks?.length || 0) +
    (draft.removals?.length || 0) +
    (draft.formFields?.length || 0) +
    (draft.pageImages?.length || 0);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md bg-white rounded-xl shadow-2xl p-6 border border-slate-100">
        <DialogTitle className="text-xl font-semibold text-slate-900 flex items-center gap-2">
          <RotateCcw className="w-5 h-5 text-indigo-600" />
          Yarım Kalan Çalışma Kurtarıldı
        </DialogTitle>
        <DialogDescription className="text-sm text-slate-500 mt-1">
          Önceki oturumunuzdan kaydedilmemiş bir çalışma bulundu. Kaldığınız yerden devam etmek ister misiniz?
        </DialogDescription>

        <div className="mt-4 p-4 rounded-lg bg-slate-50 border border-slate-200/80 flex items-start gap-3">
          <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-lg shrink-0">
            {draft.type === "word" ? <FileType2 className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-slate-800 truncate" title={draft.name}>
              {draft.name}
            </h4>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1.5">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {draftTime}
              </span>
              {changesCount > 0 && (
                <span className="flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-indigo-500" />
                  {changesCount} düzenleme mevcut
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 mt-6">
          <button
            type="button"
            onClick={handleDiscard}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Taslağı Sil
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Kapat
            </button>
            <button
              type="button"
              onClick={handleRestore}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Çalışmayı Kurtar
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
