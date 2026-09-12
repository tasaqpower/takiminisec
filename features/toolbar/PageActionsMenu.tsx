"use client";

import React, { useState } from "react";
import {
  RotateCw,
  ArrowUp,
  ArrowDown,
  Scissors,
  Trash2,
  Layers,
  ChevronDown
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction
} from "@/components/ui/alert-dialog";

export interface PageActionsMenuProps {
  activePage: number;
  pageCount: number;
  onRotate: () => void;
  onMovePage: (direction: number) => void;
  onSeparatePage: () => void;
  onDeletePage: () => void;
  disabled?: boolean;
}

export function PageActionsMenu({
  activePage,
  pageCount,
  onRotate,
  onMovePage,
  onSeparatePage,
  onDeletePage,
  disabled = false
}: PageActionsMenuProps) {
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Sayfa işlemleri"
            disabled={disabled}
            onClick={() => setMenuOpen((o) => !o)}
            className="h-8 px-2.5 flex items-center gap-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded transition-colors select-none"
            title="Aktif sayfa işlemleri"
          >
            <Layers size={14} className="text-indigo-600" />
            <span>Sayfa {activePage + 1}</span>
            <ChevronDown size={12} className="text-slate-400 ml-0.5" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-48 p-1 z-50">
          <DropdownMenuItem
            onClick={onRotate}
            className="flex items-center gap-2 px-2.5 py-1.5 text-xs cursor-pointer"
          >
            <RotateCw size={14} className="text-slate-500" />
            <span>90° Döndür</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => onMovePage(-1)}
            disabled={activePage === 0}
            className="flex items-center gap-2 px-2.5 py-1.5 text-xs cursor-pointer disabled:opacity-40"
          >
            <ArrowUp size={14} className="text-slate-500" />
            <span>Öne Taşı</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => onMovePage(1)}
            disabled={activePage >= pageCount - 1}
            className="flex items-center gap-2 px-2.5 py-1.5 text-xs cursor-pointer disabled:opacity-40"
          >
            <ArrowDown size={14} className="text-slate-500" />
            <span>Arkaya Taşı</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={onSeparatePage}
            className="flex items-center gap-2 px-2.5 py-1.5 text-xs cursor-pointer"
          >
            <Scissors size={14} className="text-slate-500" />
            <span>Bu Sayfayı Ayır</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator className="my-1" />

          <DropdownMenuItem
            onClick={() => setConfirmDeleteOpen(true)}
            disabled={pageCount < 2}
            className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-rose-600 focus:text-rose-700 focus:bg-rose-50 cursor-pointer disabled:opacity-40"
          >
            <Trash2 size={14} />
            <span>Sayfayı Sil</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Confirmation Dialog for Page Deletion */}
      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogTitle>Sayfayı silmek istiyor musunuz?</AlertDialogTitle>
          <AlertDialogDescription>
            Sayfa {activePage + 1} belgeden kaldırılacaktır. İstediğiniz zaman Geri Al (Ctrl+Z) ile geri getirebilirsiniz.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700 text-white"
              onClick={() => {
                setConfirmDeleteOpen(false);
                onDeletePage();
              }}
            >
              Sayfayı Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
