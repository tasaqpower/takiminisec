import { useEffect } from 'react';

interface ShortcutHandlers {
  onTogglePlay: () => void;
  onSplit: () => void;
  onDelete: () => void;
  onRippleDelete: () => void;
  onDuplicate: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onStepForward: (seconds: number) => void;
  onStepBackward: (seconds: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onJumpStart: () => void;
  onJumpEnd: () => void;
  onDeselect: () => void;
}

export function useShortcuts(handlers: ShortcutHandlers, enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Guard against typing in form inputs
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      // Undo / Redo
      if (cmdOrCtrl && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) {
          handlers.onRedo();
        } else {
          handlers.onUndo();
        }
        return;
      }

      if (cmdOrCtrl && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        handlers.onRedo();
        return;
      }

      // Duplicate: Ctrl+D
      if (cmdOrCtrl && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        handlers.onDuplicate();
        return;
      }

      // Space: Play/Pause
      if (e.code === 'Space') {
        e.preventDefault();
        handlers.onTogglePlay();
        return;
      }

      // S: Split at playhead
      if (e.key === 's' || e.key === 'S') {
        if (!cmdOrCtrl) {
          e.preventDefault();
          handlers.onSplit();
          return;
        }
      }

      // Delete / Backspace
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (e.shiftKey) {
          handlers.onRippleDelete();
        } else {
          handlers.onDelete();
        }
        return;
      }

      // Arrows
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const step = e.shiftKey ? 1.0 : 1 / 30;
        handlers.onStepBackward(step);
        return;
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        const step = e.shiftKey ? 1.0 : 1 / 30;
        handlers.onStepForward(step);
        return;
      }

      // Zoom + / -
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        handlers.onZoomIn();
        return;
      }

      if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        handlers.onZoomOut();
        return;
      }

      // Home / End
      if (e.key === 'Home' || e.key === '0') {
        e.preventDefault();
        handlers.onJumpStart();
        return;
      }

      if (e.key === 'End') {
        e.preventDefault();
        handlers.onJumpEnd();
        return;
      }

      // Escape
      if (e.key === 'Escape') {
        e.preventDefault();
        handlers.onDeselect();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, handlers]);
}
