/**
 * FORMA Video Editor — Transition Engine
 * Computes transition matrices and composite opacities/offsets for clips
 */

import type { Transition } from '../types';

export interface TransitionState {
  opacity: number;
  offsetX: number;
  offsetY: number;
  scale: number;
  colorOverlay?: { r: number; g: number; b: number; a: number };
}

/**
 * Computes the rendering modifiers for a clip undergoing a transition
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
        scale: 1
      };

    case 'fade-black': {
      // 0..0.5 outgoing fades to black, 0.5..1.0 incoming fades from black
      if (isIncoming) {
        const inP = p <= 0.5 ? 0 : (p - 0.5) * 2;
        return {
          opacity: inP,
          offsetX: 0,
          offsetY: 0,
          scale: 1,
          colorOverlay: { r: 0, g: 0, b: 0, a: 1 - inP }
        };
      } else {
        const outP = p <= 0.5 ? 1 - p * 2 : 0;
        return {
          opacity: outP,
          offsetX: 0,
          offsetY: 0,
          scale: 1,
          colorOverlay: { r: 0, g: 0, b: 0, a: 1 - outP }
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
          colorOverlay: { r: 255, g: 255, b: 255, a: 1 - inP }
        };
      } else {
        const outP = p <= 0.5 ? 1 - p * 2 : 0;
        return {
          opacity: outP,
          offsetX: 0,
          offsetY: 0,
          scale: 1,
          colorOverlay: { r: 255, g: 255, b: 255, a: 1 - outP }
        };
      }
    }

    case 'slide-left':
      // Outgoing slides from 0 to -1, incoming slides from 1 to 0
      return {
        opacity: 1,
        offsetX: isIncoming ? 1 - p : -p,
        offsetY: 0,
        scale: 1
      };

    case 'slide-right':
      return {
        opacity: 1,
        offsetX: isIncoming ? -(1 - p) : p,
        offsetY: 0,
        scale: 1
      };

    case 'zoom-in': {
      // Outgoing scales 1.0 -> 1.5 & fades; Incoming scales 0.5 -> 1.0
      if (isIncoming) {
        return {
          opacity: p,
          offsetX: 0,
          offsetY: 0,
          scale: 0.5 + p * 0.5
        };
      } else {
        return {
          opacity: 1 - p,
          offsetX: 0,
          offsetY: 0,
          scale: 1.0 + p * 0.5
        };
      }
    }

    case 'zoom-out': {
      // Outgoing scales 1.0 -> 0.6 & fades; Incoming scales 1.5 -> 1.0
      if (isIncoming) {
        return {
          opacity: p,
          offsetX: 0,
          offsetY: 0,
          scale: 1.5 - p * 0.5
        };
      } else {
        return {
          opacity: 1 - p,
          offsetX: 0,
          offsetY: 0,
          scale: 1.0 - p * 0.4
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
        scale: 1
      };
  }
}
