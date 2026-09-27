/**
 * FORMA Professional Video Editor — Desktop NLE Design Tokens
 * Conforms to Adobe Premiere Pro, DaVinci Resolve & Final Cut Pro standards.
 * Pure dark graphite palette, 4px maximum border-radii, desaturated track styling.
 */

export const TOKENS = {
  colors: {
    // Core surfaces (Exact user specification)
    bgApp: '#0B0D10',          // Deepest workspace background
    bgPanel: '#111419',        // Primary panel background
    bgElevated: '#171B21',     // Secondary surface / inputs / cards
    bgSelected: '#202631',     // Active / selected surface
    borderDivider: '#292F39',  // Standard divider & border
    borderSubtle: '#1C212A',   // Inset / hairline divider
    borderFocus: '#4f6bf5',    // Focus state

    // Typography
    textPrimary: '#E7EAF0',    // High-contrast primary text
    textSecondary: '#929AA8',  // Secondary / labels
    textMuted: '#5A6270',      // Muted technical notes
    textDisabled: '#3D4450',

    // Functional Accents (Restrained, NOT oversaturated purple)
    accent: '#4f6bf5',         // Calm blue-indigo primary action
    accentHover: '#3b55d9',
    accentMuted: 'rgba(79, 107, 245, 0.12)',
    accentBorder: 'rgba(79, 107, 245, 0.35)',

    // Semantic colors
    playhead: '#ff4d4d',       // Crisp red-orange playhead
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#38bdf8',

    // Professional NLE Track Palettes (Desaturated, calm, distinct)
    tracks: {
      video: {
        bg: '#141c27',
        bgHover: '#1a2535',
        border: '#26374d',
        borderSelected: '#4f80c2',
        text: '#b0cbe8',
        headerIcon: '#5b8dc7',
        sprocket: '#0b1118',
      },
      audio: {
        bg: '#12241b',
        bgHover: '#183024',
        border: '#214734',
        borderSelected: '#3ec985',
        text: '#a6e2c3',
        headerIcon: '#38b577',
        waveform: '#2ecc71',
      },
      text: {
        bg: '#211626',
        bgHover: '#2d1d34',
        border: '#442650',
        borderSelected: '#a865c2',
        text: '#dfbee9',
        headerIcon: '#a855f7',
      },
      effect: {
        bg: '#1b1728',
        bgHover: '#251f38',
        border: '#3c3057',
        borderSelected: '#8f77c7',
        text: '#d2c8f0',
        headerIcon: '#8b5cf6',
      },
    },
  },

  dimensions: {
    topbarHeight: 46,
    toolRailWidth: 46,
    sidebarMin: 240,
    sidebarDefault: 280,
    sidebarMax: 360,
    inspectorMin: 260,
    inspectorDefault: 300,
    inspectorMax: 380,
    timelineMin: 240,
    timelineDefaultRatio: 0.34, // ~34% of screen height
    trackHeaderWidth: 160,
  },

  radii: {
    none: '0px',
    sm: '2px',
    md: '3px',
    base: '4px',
    // Max 4px for all controls, no rounded-xl or rounded-full
  },
} as const;
