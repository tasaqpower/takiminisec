import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { Ban, Shuffle, Layers, Clock, MapPin, Check } from 'lucide-react';
import type { DragPayload, DragPayloadType } from '../types';
export type { DragPayload, DragPayloadType };

export interface DragTargetInfo {
  targetType: 'cut-point' | 'clip' | 'track' | 'canvas' | 'invalid';
  isValid: boolean;
  time?: number;
  label?: string;
  trackId?: string;
  clipId?: string;
}

export type DragTargetOption = DragTargetInfo | boolean;

export interface DropTarget {
  id: string;
  getBounds: () => DOMRect | null;
  onPointerMove: (e: PointerEvent, payload: DragPayload) => DragTargetInfo | null;
  onDrop: (payload: DragPayload, e: PointerEvent) => boolean | Promise<boolean>;
  onPointerLeave?: () => void;
}

interface DragDropContextType {
  isDragging: boolean;
  activePayload: DragPayload | null;
  pointerPos: { x: number; y: number };
  targetInfo: DragTargetInfo | null;
  startDrag: (payload: DragPayload, startX: number, startY: number) => void;
  updateDragPosition: (x: number, y: number, target?: DragTargetOption) => void;
  endDrag: () => { payload: DragPayload; targetInfo: DragTargetInfo | null } | null;
  cancelDrag: () => void;
  registerDropTarget: (target: DropTarget) => () => void;
  isClickSuppressed: () => boolean;
}

const DragDropContext = createContext<DragDropContextType | null>(null);

function formatTimecode(seconds: number): string {
  const s = Math.max(0, seconds);
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = Math.floor(s % 60);
  const ms = Math.floor((s % 1) * 1000);
  const pad = (n: number, z = 2) => n.toString().padStart(z, '0');
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)}.${pad(ms, 3)}`;
}

export const EditorDragDropProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [activePayload, setActivePayload] = useState<DragPayload | null>(null);
  const [pointerPos, setPointerPos] = useState({ x: 0, y: 0 });
  const [targetInfo, setTargetInfo] = useState<DragTargetInfo | null>(null);

  const payloadRef = useRef<DragPayload | null>(null);
  const targetInfoRef = useRef<DragTargetInfo | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);
  const suppressClickUntilRef = useRef<number>(0);
  const activeDropTargetIdRef = useRef<string | null>(null);

  // Drop targets registry
  const dropTargetsRef = useRef<Map<string, DropTarget>>(new Map());

  const registerDropTarget = useCallback((target: DropTarget) => {
    dropTargetsRef.current.set(target.id, target);
    return () => {
      dropTargetsRef.current.delete(target.id);
      if (activeDropTargetIdRef.current === target.id) {
        activeDropTargetIdRef.current = null;
      }
    };
  }, []);

  const isClickSuppressed = useCallback(() => {
    return Date.now() < suppressClickUntilRef.current;
  }, []);

  const startDrag = useCallback((payload: DragPayload, startX: number, startY: number) => {
    payloadRef.current = payload;
    targetInfoRef.current = null;
    dragStartRef.current = { x: startX, y: startY };
    activeDropTargetIdRef.current = null;
    setActivePayload(payload);
    setPointerPos({ x: startX, y: startY });
    setTargetInfo(null);
    setIsDragging(true);
    isDraggingRef.current = true;
    suppressClickUntilRef.current = Date.now() + 500;
  }, []);

  const updateDragPosition = useCallback((x: number, y: number, target?: DragTargetOption) => {
    setPointerPos({ x, y });
    if (target !== undefined) {
      const normalized: DragTargetInfo =
        typeof target === 'boolean'
          ? { targetType: target ? 'clip' : 'invalid', isValid: target }
          : target;
      targetInfoRef.current = normalized;
      setTargetInfo(normalized);
    }
  }, []);

  const cancelDrag = useCallback(() => {
    if (activeDropTargetIdRef.current) {
      const prevTarget = dropTargetsRef.current.get(activeDropTargetIdRef.current);
      prevTarget?.onPointerLeave?.();
      activeDropTargetIdRef.current = null;
    }
    payloadRef.current = null;
    targetInfoRef.current = null;
    dragStartRef.current = null;
    isDraggingRef.current = false;
    setIsDragging(false);
    setActivePayload(null);
    setTargetInfo(null);
  }, []);

  const endDrag = useCallback(() => {
    const p = payloadRef.current;
    const t = targetInfoRef.current;
    cancelDrag();
    if (!p) return null;
    return { payload: p, targetInfo: t };
  }, [cancelDrag]);

  // Global listeners for pointer move, drop dispatch, and escape
  useEffect(() => {
    if (!isDragging) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cancelDrag();
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      setPointerPos({ x: e.clientX, y: e.clientY });

      if (!payloadRef.current) return;

      // Find drop target at mouse coordinates
      let matchedTarget: DropTarget | null = null;
      for (const target of dropTargetsRef.current.values()) {
        const bounds = target.getBounds();
        if (bounds) {
          if (
            e.clientX >= bounds.left &&
            e.clientX <= bounds.right &&
            e.clientY >= bounds.top &&
            e.clientY <= bounds.bottom
          ) {
            matchedTarget = target;
            break;
          }
        }
      }

      if (matchedTarget) {
        if (activeDropTargetIdRef.current && activeDropTargetIdRef.current !== matchedTarget.id) {
          const prev = dropTargetsRef.current.get(activeDropTargetIdRef.current);
          prev?.onPointerLeave?.();
        }
        activeDropTargetIdRef.current = matchedTarget.id;
        const info = matchedTarget.onPointerMove(e, payloadRef.current);
        if (info) {
          targetInfoRef.current = info;
          setTargetInfo(info);
        }
      } else {
        if (activeDropTargetIdRef.current) {
          const prev = dropTargetsRef.current.get(activeDropTargetIdRef.current);
          prev?.onPointerLeave?.();
          activeDropTargetIdRef.current = null;
        }
        const fallbackInfo: DragTargetInfo = { targetType: 'invalid', isValid: false };
        targetInfoRef.current = fallbackInfo;
        setTargetInfo(fallbackInfo);
      }
    };

    const handlePointerUp = async (e: PointerEvent) => {
      const payload = payloadRef.current;
      if (!payload) {
        cancelDrag();
        return;
      }

      // Check which target receives the drop
      let matchedTarget: DropTarget | null = null;
      for (const target of dropTargetsRef.current.values()) {
        const bounds = target.getBounds();
        if (bounds) {
          if (
            e.clientX >= bounds.left &&
            e.clientX <= bounds.right &&
            e.clientY >= bounds.top &&
            e.clientY <= bounds.bottom
          ) {
            matchedTarget = target;
            break;
          }
        }
      }

      suppressClickUntilRef.current = Date.now() + 350;

      if (matchedTarget) {
        try {
          await matchedTarget.onDrop(payload, e);
        } catch (err) {
          console.error('[FORMA DND] Error in drop handler:', err);
        }
      }

      cancelDrag();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging, cancelDrag]);

  return (
    <DragDropContext.Provider
      value={{
        isDragging,
        activePayload,
        pointerPos,
        targetInfo,
        startDrag,
        updateDragPosition,
        endDrag,
        cancelDrag,
        registerDropTarget,
        isClickSuppressed,
      }}
    >
      {children}

      {/* Floating Drag Ghost / Preview */}
      {isDragging && activePayload && (
        <div
          data-testid="drag-ghost"
          style={{
            position: 'fixed',
            left: `${pointerPos.x + 14}px`,
            top: `${pointerPos.y + 14}px`,
            pointerEvents: 'none',
            zIndex: 99999,
          }}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold shadow-2xl backdrop-blur-md transition-colors select-none ${
            targetInfo?.isValid === false
              ? 'bg-rose-950/90 border-2 border-rose-500 text-rose-200'
              : targetInfo?.isValid === true
              ? 'bg-emerald-950/90 border-2 border-emerald-500 text-emerald-200 ring-2 ring-emerald-500/40'
              : 'bg-[#161b22]/95 border-2 border-indigo-500 text-white'
          }`}
        >
          <span className="flex items-center justify-center w-6 h-6 rounded-md bg-white/10 shrink-0">
            {targetInfo?.isValid === true ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : targetInfo?.isValid === false ? (
              <Ban className="w-3.5 h-3.5 text-rose-400" />
            ) : activePayload.type === 'transition' ? (
              <Shuffle className="w-3.5 h-3.5 text-amber-300" />
            ) : (
              <Layers className="w-3.5 h-3.5 text-indigo-300" />
            )}
          </span>
          <div className="flex flex-col min-w-0">
            <span className="leading-tight font-bold text-white text-xs truncate max-w-[180px]">
              {activePayload.name}
            </span>
            <div className="flex items-center gap-1.5 text-[10px] opacity-90 font-mono mt-0.5 text-slate-300">
              {activePayload.duration && (
                <span className="flex items-center gap-0.5 text-amber-300">
                  <Clock className="w-2.5 h-2.5" />
                  {activePayload.duration.toFixed(1)} sn
                </span>
              )}
              {targetInfo?.time !== undefined && (
                <span className="bg-black/60 px-1 py-0.5 rounded font-mono text-amber-300 font-bold flex items-center gap-0.5">
                  <MapPin className="w-2.5 h-2.5" />
                  {formatTimecode(targetInfo.time)}
                </span>
              )}
              {targetInfo?.label && <span className="text-gray-200 font-medium truncate">• {targetInfo.label}</span>}
            </div>
          </div>
        </div>
      )}
    </DragDropContext.Provider>
  );
};

export function useEditorDragDrop(): DragDropContextType {
  const ctx = useContext(DragDropContext);
  if (!ctx) {
    throw new Error('useEditorDragDrop must be used within an EditorDragDropProvider');
  }
  return ctx;
}
