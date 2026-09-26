/**
 * FORMA Video Editor — High-Precision 13 Transition Engine
 * Computes transition matrices, composite opacities, offsets, and wipe/blur state.
 * Works symmetrically in interactive canvas preview, timeline, and export stream.
 */

import type { Transition, TransitionType } from '../types';

export interface TransitionState {
  opacity: number;
  offsetX: number; // Normalized -1 to 1 (multiply by canvas width)
  offsetY: number; // Normalized -1 to 1 (multiply by canvas height)
  scale: number;
  blur?: number; // in pixels
  wipeRatio?: number; // 0.0 to 1.0 (mask progress)
  wipeDirection?: 'left' | 'right' | 'up' | 'down';
  colorOverlay?: { r: number; g: number; b: number; a: number };
}

export interface TransitionDef {
  id: TransitionType;
  name: string;
  description: string;
  icon: string;
}

export const TRANSITION_DEFINITIONS: TransitionDef[] = [
  { id: 'cut', name: 'Sert Kesim (Cut)', description: 'Anlık kesintisiz geçiş', icon: '✂️' },
  { id: 'crossfade', name: 'Çapraz Geçiş (Crossfade)', description: 'Pürüzsüz erime', icon: '🌫️' },
  { id: 'fade-black', name: 'Karararak Geçiş (Dip to Black)', description: 'Siyaha kararma', icon: '🌑' },
  { id: 'fade-white', name: 'Parlama Geçiş (Dip to White)', description: 'Beyaza parlama', icon: '⚪' },
  { id: 'slide-left', name: 'Sola Kaydır (Slide Left)', description: 'Yatay sola kayış', icon: '⬅️' },
  { id: 'slide-right', name: 'Sağa Kaydır (Slide Right)', description: 'Yatay sağa kayış', icon: '➡️' },
  { id: 'slide-up', name: 'Yukarı Kaydır (Slide Up)', description: 'Dikey yukarı kayış', icon: '⬆️' },
  { id: 'slide-down', name: 'Aşağı Kaydır (Slide Down)', description: 'Dikey aşağı kayış', icon: '⬇️' },
  { id: 'zoom-in', name: 'Yakınlaşarak (Zoom In)', description: 'Hızlı yakınlaşma', icon: '🔍' },
  { id: 'zoom-out', name: 'Uzaklaşarak (Zoom Out)', description: 'Geniş açı uzaklaşma', icon: '🔎' },
  { id: 'blur-dissolve', name: 'Bulanık Erime (Blur Dissolve)', description: 'Sinematik optik odak kaybı', icon: '💫' },
  { id: 'wipe-left', name: 'Sola Silme (Wipe Left)', description: 'Perde sola açılma', icon: '🪟' },
  { id: 'wipe-right', name: 'Sağa Silme (Wipe Right)', description: 'Perde sağa açılma', icon: '🚪' },
];

/**
 * Computes rendering modifiers for a clip undergoing a transition
 * @param progress 0.0 (transition start) to 1.0 (transition end)
 * @param type TransitionType
 * @param isIncoming true if this is the incoming clip, false if outgoing
 */
export function computeTransitionState(
  progress: number,
  type: Transition['type'],
  isIncoming: boolean
): TransitionState {
  const p = Math.max(0, Math.min(1, progress));

  switch (type) {
    case 'crossfade':
      return {
        opacity: isIncoming ? p : 1 - p,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
      };

    case 'fade-black': {
      if (isIncoming) {
        const inP = p <= 0.5 ? 0 : (p - 0.5) * 2;
        return {
          opacity: inP,
          offsetX: 0,
          offsetY: 0,
          scale: 1,
          colorOverlay: { r: 0, g: 0, b: 0, a: 1 - inP },
        };
      } else {
        const outP = p <= 0.5 ? 1 - p * 2 : 0;
        return {
          opacity: outP,
          offsetX: 0,
          offsetY: 0,
          scale: 1,
          colorOverlay: { r: 0, g: 0, b: 0, a: 1 - outP },
        };
      }
    }

    case 'fade-white': {
      if (isIncoming) {
        const inP = p <= 0.5 ? 0 : (p - 0.5) * 2;
        return {
          opacity: inP,
          offsetX: 0,
          offsetY: 0,
          scale: 1,
          colorOverlay: { r: 255, g: 255, b: 255, a: 1 - inP },
        };
      } else {
        const outP = p <= 0.5 ? 1 - p * 2 : 0;
        return {
          opacity: outP,
          offsetX: 0,
          offsetY: 0,
          scale: 1,
          colorOverlay: { r: 255, g: 255, b: 255, a: 1 - outP },
        };
      }
    }

    case 'slide-left':
      return {
        opacity: 1,
        offsetX: isIncoming ? 1 - p : -p,
        offsetY: 0,
        scale: 1,
      };

    case 'slide-right':
      return {
        opacity: 1,
        offsetX: isIncoming ? -(1 - p) : p,
        offsetY: 0,
        scale: 1,
      };

    case 'slide-up':
      return {
        opacity: 1,
        offsetX: 0,
        offsetY: isIncoming ? 1 - p : -p,
        scale: 1,
      };

    case 'slide-down':
      return {
        opacity: 1,
        offsetX: 0,
        offsetY: isIncoming ? -(1 - p) : p,
        scale: 1,
      };

    case 'zoom-in': {
      if (isIncoming) {
        return {
          opacity: p,
          offsetX: 0,
          offsetY: 0,
          scale: 0.5 + p * 0.5,
        };
      } else {
        return {
          opacity: 1 - p,
          offsetX: 0,
          offsetY: 0,
          scale: 1.0 + p * 0.5,
        };
      }
    }

    case 'zoom-out': {
      if (isIncoming) {
        return {
          opacity: p,
          offsetX: 0,
          offsetY: 0,
          scale: 1.5 - p * 0.5,
        };
      } else {
        return {
          opacity: 1 - p,
          offsetX: 0,
          offsetY: 0,
          scale: 1.0 - p * 0.4,
        };
      }
    }

    case 'blur-dissolve': {
      const maxBlur = 20;
      if (isIncoming) {
        return {
          opacity: p,
          offsetX: 0,
          offsetY: 0,
          scale: 1,
          blur: Math.round((1 - p) * maxBlur),
        };
      } else {
        return {
          opacity: 1 - p,
          offsetX: 0,
          offsetY: 0,
          scale: 1,
          blur: Math.round(p * maxBlur),
        };
      }
    }

    case 'wipe-left': {
      if (isIncoming) {
        return {
          opacity: 1,
          offsetX: 0,
          offsetY: 0,
          scale: 1,
          wipeRatio: p,
          wipeDirection: 'left',
        };
      } else {
        return {
          opacity: 1,
          offsetX: 0,
          offsetY: 0,
          scale: 1,
          wipeRatio: 1 - p,
          wipeDirection: 'right',
        };
      }
    }

    case 'wipe-right': {
      if (isIncoming) {
        return {
          opacity: 1,
          offsetX: 0,
          offsetY: 0,
          scale: 1,
          wipeRatio: p,
          wipeDirection: 'right',
        };
      } else {
        return {
          opacity: 1,
          offsetX: 0,
          offsetY: 0,
          scale: 1,
          wipeRatio: 1 - p,
          wipeDirection: 'left',
        };
      }
    }

    case 'cut':
    case 'none':
    default:
      return {
        opacity: isIncoming ? (p >= 0.5 ? 1 : 0) : (p < 0.5 ? 1 : 0),
        offsetX: 0,
        offsetY: 0,
        scale: 1,
      };
  }
}
