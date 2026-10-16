export interface ElementPreset {
  id: string;
  name: string;
  category: 'animated' | 'ai' | 'tiktok' | 'youtube' | 'instagram' | 'arrows' | 'censor' | 'stickers';
  svg: string;
  defaultScale?: number;
  isAnimated?: boolean;
  elementAnimation?: string;
}

export const ELEMENT_PRESETS: ElementPreset[] = [
  // =========================================================================
  // 0. CANLI ANİMASYONLU ÖĞELER (CANVAS & CSS ANIMATED STICKERS)
  // =========================================================================
  {
    id: 'tiktok-animated-follow',
    name: 'TikTok Canlı Takip Et (+ ➔ ✓)',
    category: 'animated',
    defaultScale: 0.35,
    isAnimated: true,
    elementAnimation: 'tiktok-follow',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 180" width="160" height="180">
      <defs>
        <style>
          @keyframes followPulse {
            0%, 25% { transform: scale(1); fill: #fe2c55; }
            35% { transform: scale(0.85); fill: #fe2c55; }
            45% { transform: scale(1.15); fill: #27272a; }
            55%, 100% { transform: scale(1); fill: #27272a; }
          }
          @keyframes iconMorph {
            0%, 25% { opacity: 1; transform: rotate(0deg); }
            35% { opacity: 0; transform: rotate(90deg) scale(0); }
            45%, 100% { opacity: 0; }
          }
          @keyframes checkReveal {
            0%, 35% { opacity: 0; stroke-dashoffset: 24; }
            50%, 100% { opacity: 1; stroke-dashoffset: 0; }
          }
          @keyframes sparkBurst {
            0%, 35% { opacity: 0; transform: scale(0.3); }
            50% { opacity: 1; transform: scale(1.2); }
            70%, 100% { opacity: 0; transform: scale(1.6); }
          }
          .follow-btn { transform-origin: 80px 125px; animation: followPulse 3.5s infinite ease-in-out; }
          .plus-icon { transform-origin: 80px 125px; animation: iconMorph 3.5s infinite ease-in-out; }
          .check-icon { stroke-dasharray: 24; animation: checkReveal 3.5s infinite ease-in-out; }
          .burst-spark { transform-origin: 80px 125px; animation: sparkBurst 3.5s infinite ease-out; }
        </style>
      </defs>
      <!-- Avatar Circle -->
      <circle cx="80" cy="65" r="50" fill="#18181b" stroke="#ffffff" stroke-width="4"/>
      <circle cx="80" cy="52" r="18" fill="#71717a"/>
      <path d="M48 95 C48 78 62 72 80 72 C98 72 112 78 112 95 Z" fill="#71717a"/>
      <!-- Follow Badge (+ turns into ✓) -->
      <circle class="burst-spark" cx="80" cy="125" r="32" fill="none" stroke="#25f4ee" stroke-width="2"/>
      <circle class="follow-btn" cx="80" cy="125" r="22" stroke="#ffffff" stroke-width="2.5"/>
      <!-- Plus Icon -->
      <g class="plus-icon">
        <line x1="80" y1="113" x2="80" y2="137" stroke="#ffffff" stroke-width="4.5" stroke-linecap="round"/>
        <line x1="68" y1="125" x2="92" y2="125" stroke="#ffffff" stroke-width="4.5" stroke-linecap="round"/>
      </g>
      <!-- Checkmark Icon -->
      <path class="check-icon" d="M72 125 L78 131 L89 119" fill="none" stroke="#22c55e" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
      <text x="80" y="168" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-weight="900" font-size="12">TAKİP ET</text>
    </svg>`,
  },
  {
    id: 'tiktok-animated-like',
    name: 'TikTok Canlı Beğen (Pop & Kalpler)',
    category: 'animated',
    defaultScale: 0.35,
    isAnimated: true,
    elementAnimation: 'tiktok-like',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 90" width="280" height="90">
      <defs>
        <style>
          @keyframes likeBounce {
            0%, 20% { transform: scale(1); }
            28% { transform: scale(0.8); }
            38% { transform: scale(1.4); }
            48% { transform: scale(0.95); }
            58%, 100% { transform: scale(1); }
          }
          @keyframes shockwave {
            0%, 30% { opacity: 0; r: 16; }
            40% { opacity: 0.9; }
            65%, 100% { opacity: 0; r: 48; }
          }
          @keyframes miniHeartPop {
            0%, 30% { opacity: 0; transform: translate(0, 0) scale(0); }
            50% { opacity: 1; transform: translate(-14px, -24px) scale(1); }
            80%, 100% { opacity: 0; transform: translate(-22px, -42px) scale(0.6); }
          }
          .heart-bounce { transform-origin: 52px 45px; animation: likeBounce 3.2s infinite cubic-bezier(0.34, 1.56, 0.64, 1); }
          .shock-ring { animation: shockwave 3.2s infinite ease-out; }
          .floating-heart { animation: miniHeartPop 3.2s infinite ease-out; }
        </style>
        <filter id="tt-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="-2" dy="-2" stdDeviation="3" flood-color="#25f4ee" flood-opacity="0.8"/>
          <feDropShadow dx="2" dy="2" stdDeviation="3" flood-color="#fe2c55" flood-opacity="0.9"/>
        </filter>
      </defs>
      <rect x="3" y="3" width="274" height="84" rx="42" fill="#090a0f" stroke="#fe2c55" stroke-width="2.5"/>
      <rect x="5" y="5" width="270" height="80" rx="40" fill="none" stroke="#25f4ee" stroke-width="1.5" stroke-opacity="0.6"/>
      <!-- Shockwave circle -->
      <circle class="shock-ring" cx="52" cy="45" fill="none" stroke="#25f4ee" stroke-width="2.5"/>
      <!-- Floating mini hearts -->
      <g class="floating-heart">
        <path d="M52 45 C50 40 40 40 40 33 C40 28 45 26 50 31 C55 26 60 28 60 33 C60 40 54 40 52 45 Z" fill="#fe2c55"/>
      </g>
      <!-- Main Heart -->
      <g class="heart-bounce" transform="translate(52, 45)" filter="url(#tt-glow)">
        <path d="M0 16 C-2 -2 -24 -2 -24 -14 C-24 -24 -12 -28 0 -18 C12 -28 24 -24 24 -14 C24 -2 2 -2 0 16 Z" fill="#25f4ee" opacity="0.7" transform="translate(-2, -1) scale(0.9)"/>
        <path d="M0 16 C-2 -2 -24 -2 -24 -14 C-24 -24 -12 -28 0 -18 C12 -28 24 -24 24 -14 C24 -2 2 -2 0 16 Z" fill="#fe2c55" transform="scale(0.9)"/>
      </g>
      <text x="105" y="44" fill="#ffffff" font-family="Arial Black, Impact, sans-serif" font-weight="900" font-size="24" letter-spacing="1">BEĞEN</text>
      <text x="105" y="66" fill="#fe2c55" font-family="Arial, sans-serif" font-weight="800" font-size="15" letter-spacing="0.5">❤️ 1.4M</text>
    </svg>`,
  },
  {
    id: 'tiktok-animated-follow-btn',
    name: 'TikTok Takip Butonu (+ ➔ ✓)',
    category: 'animated',
    defaultScale: 0.35,
    isAnimated: true,
    elementAnimation: 'tiktok-follow-btn',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 90" width="280" height="90">
      <defs>
        <style>
          @keyframes pillMorph {
            0%, 25% { fill: #fe2c55; }
            40%, 100% { fill: #222630; stroke: #3b4351; }
          }
          @keyframes btnClick {
            0%, 25% { transform: scale(1); }
            32% { transform: scale(0.92); }
            42% { transform: scale(1.05); }
            52%, 100% { transform: scale(1); }
          }
          .pill-container { transform-origin: 140px 45px; animation: btnClick 3.5s infinite ease-in-out; }
          .pill-bg { animation: pillMorph 3.5s infinite ease-in-out; }
        </style>
      </defs>
      <g class="pill-container">
        <rect class="pill-bg" width="280" height="90" rx="45" fill="#fe2c55"/>
        <circle cx="50" cy="45" r="22" fill="#ffffff" fill-opacity="0.2"/>
        <path d="M42 45 L58 45 M50 37 L50 53" stroke="#ffffff" stroke-width="4.5" stroke-linecap="round"/>
        <text x="88" y="55" fill="#ffffff" font-family="Arial Black, Impact, sans-serif" font-weight="900" font-size="22" letter-spacing="1">TAKİP ET</text>
      </g>
    </svg>`,
  },
  {
    id: 'tiktok-animated-double-tap',
    name: 'TikTok Çift Tıkla Kalp (Patlama)',
    category: 'animated',
    defaultScale: 0.38,
    isAnimated: true,
    elementAnimation: 'tiktok-double-tap',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
      <defs>
        <style>
          @keyframes doubleTapZoom {
            0%, 15% { transform: scale(0) rotate(-15deg); opacity: 0; }
            28% { transform: scale(1.3) rotate(-15deg); opacity: 1; }
            38% { transform: scale(1.0) rotate(-15deg); opacity: 1; }
            70% { transform: scale(1.05) translateY(-10px) rotate(-15deg); opacity: 1; }
            90%, 100% { transform: scale(0.9) translateY(-25px) rotate(-15deg); opacity: 0; }
          }
          .pop-heart { transform-origin: 100px 95px; animation: doubleTapZoom 3s infinite ease-out; }
        </style>
      </defs>
      <circle cx="100" cy="100" r="85" fill="none" stroke="#fe2c55" stroke-width="2" stroke-dasharray="6 12" opacity="0.6"/>
      <g class="pop-heart">
        <path d="M100 140 C95 90 40 90 40 59 C40 35 70 25 100 50 C130 25 160 35 160 59 C160 90 105 90 100 140 Z" fill="#25f4ee" opacity="0.7" transform="translate(-4, -2)"/>
        <path d="M100 140 C95 90 40 90 40 59 C40 35 70 25 100 50 C130 25 160 35 160 59 C160 90 105 90 100 140 Z" fill="#fe2c55"/>
      </g>
      <text x="100" y="175" text-anchor="middle" fill="#ffffff" font-family="Arial Black, sans-serif" font-weight="900" font-size="16">ÇİFT TIKLA ❤️</text>
    </svg>`,
  },
  {
    id: 'youtube-animated-subscribe',
    name: 'YouTube Abone Ol & Çan (Canlı)',
    category: 'animated',
    defaultScale: 0.35,
    isAnimated: true,
    elementAnimation: 'youtube-sub',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 90" width="320" height="90">
      <defs>
        <style>
          @keyframes ytClick {
            0%, 25% { fill: #cc0000; }
            40%, 100% { fill: #27272a; }
          }
          @keyframes bellRing {
            0%, 45% { transform: rotate(0deg); }
            50% { transform: rotate(18deg); }
            55% { transform: rotate(-18deg); }
            60% { transform: rotate(15deg); }
            65% { transform: rotate(-15deg); }
            70%, 100% { transform: rotate(0deg); }
          }
          .yt-btn { animation: ytClick 3.5s infinite ease-in-out; }
          .yt-bell { transform-origin: 275px 45px; animation: bellRing 3.5s infinite ease-in-out; }
        </style>
      </defs>
      <rect class="yt-btn" width="320" height="90" rx="45" fill="#cc0000"/>
      <text x="125" y="55" fill="#ffffff" font-family="Arial Black, Impact, sans-serif" font-weight="900" font-size="22" letter-spacing="1">ABONE OL</text>
      <g class="yt-bell">
        <path d="M275 32 C267 32 263 37 263 45 L260 53 L290 53 L287 45 C287 37 283 32 275 32 Z" fill="#facc15"/>
        <circle cx="275" cy="57" r="3.5" fill="#facc15"/>
      </g>
    </svg>`,
  },
  {
    id: 'instagram-animated-like',
    name: 'Instagram Beğeni (Canlı Kalp)',
    category: 'animated',
    defaultScale: 0.32,
    isAnimated: true,
    elementAnimation: 'instagram-like',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
      <defs>
        <linearGradient id="ig-grad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#feda75"/>
          <stop offset="25%" stop-color="#fa7e1e"/>
          <stop offset="50%" stop-color="#d62976"/>
          <stop offset="75%" stop-color="#962fbf"/>
          <stop offset="100%" stop-color="#4f5bd5"/>
        </linearGradient>
        <style>
          @keyframes igPop {
            0%, 20% { transform: scale(0.9); }
            35% { transform: scale(1.35); }
            48%, 100% { transform: scale(1); }
          }
          .ig-heart { transform-origin: 80px 80px; animation: igPop 3s infinite cubic-bezier(0.34, 1.56, 0.64, 1); }
        </style>
      </defs>
      <circle cx="80" cy="80" r="70" fill="#121212" stroke="#262626" stroke-width="2"/>
      <g class="ig-heart">
        <path d="M80 120 C76 84 36 84 36 60 C36 41 60 33 80 53 C100 33 124 41 124 60 C124 84 84 84 80 120 Z" fill="url(#ig-grad)"/>
      </g>
    </svg>`,
  },

  // =========================================================================
  // 1. YAPAY ZEKA & TEKNOLOJİ (AI & TECH)
  // =========================================================================
  {
    id: 'ai-magic-sparkle',
    name: 'AI Sihirli Parıltı',
    category: 'ai',
    defaultScale: 0.28,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
      <defs>
        <radialGradient id="ai-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.8"/>
          <stop offset="100%" stop-color="#818cf8" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <circle cx="80" cy="80" r="75" fill="url(#ai-glow)"/>
      <path d="M80 15 Q80 80 145 80 Q80 80 80 145 Q80 80 15 80 Q80 80 80 15 Z" fill="#38bdf8"/>
      <path d="M125 35 Q125 55 145 55 Q125 55 125 75 Q125 55 105 55 Q125 55 125 35 Z" fill="#a855f7"/>
      <path d="M40 105 Q40 120 55 120 Q40 120 40 135 Q40 120 25 120 Q40 120 40 105 Z" fill="#f43f5e"/>
    </svg>`,
  },
  {
    id: 'ai-generated-badge',
    name: 'AI Generated Rozeti',
    category: 'ai',
    defaultScale: 0.35,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 90" width="340" height="90">
      <rect width="340" height="90" rx="45" fill="#0b0f19" stroke="#38bdf8" stroke-width="3"/>
      <circle cx="48" cy="45" r="22" fill="#0284c7"/>
      <path d="M48 30 L52 41 L63 45 L52 49 L48 60 L44 49 L33 45 L44 41 Z" fill="#ffffff"/>
      <text x="85" y="55" fill="#38bdf8" font-family="Arial, sans-serif" font-weight="900" font-size="24" letter-spacing="1.5">AI GENERATED</text>
    </svg>`,
  },
  {
    id: 'ai-brain-circuit',
    name: 'Yapay Zeka Beyin Ağı',
    category: 'ai',
    defaultScale: 0.32,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 180" width="200" height="180">
      <path d="M40 90 C30 50 60 25 95 30 C105 15 145 20 155 50 C175 60 175 110 150 130 C145 155 110 165 95 150 C75 165 40 145 40 90 Z" fill="#0f172a" stroke="#818cf8" stroke-width="4"/>
      <circle cx="70" cy="65" r="7" fill="#38bdf8"/>
      <circle cx="130" cy="65" r="7" fill="#38bdf8"/>
      <circle cx="100" cy="100" r="9" fill="#c084fc"/>
      <circle cx="75" cy="125" r="6" fill="#38bdf8"/>
      <circle cx="125" cy="125" r="6" fill="#38bdf8"/>
      <line x1="70" y1="65" x2="100" y2="100" stroke="#38bdf8" stroke-width="3"/>
      <line x1="130" y1="65" x2="100" y2="100" stroke="#38bdf8" stroke-width="3"/>
      <line x1="100" y1="100" x2="75" y2="125" stroke="#c084fc" stroke-width="3"/>
      <line x1="100" y1="100" x2="125" y2="125" stroke="#c084fc" stroke-width="3"/>
    </svg>`,
  },
  {
    id: 'ai-prompt-box',
    name: 'AI Prompt Kutusu',
    category: 'ai',
    defaultScale: 0.38,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 380 90" width="380" height="90">
      <rect width="380" height="90" rx="16" fill="#18181b" stroke="#a855f7" stroke-width="3"/>
      <circle cx="42" cy="45" r="18" fill="#9333ea"/>
      <text x="42" y="52" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-weight="900" font-size="20">✦</text>
      <text x="75" y="44" fill="#a855f7" font-family="Arial, sans-serif" font-weight="bold" font-size="14">PROMPT</text>
      <text x="75" y="66" fill="#ffffff" font-family="Arial, sans-serif" font-weight="900" font-size="19">/imagine viral_reels...</text>
      <rect x="300" y="32" width="60" height="26" rx="6" fill="#9333ea"/>
      <text x="330" y="50" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-weight="bold" font-size="12">RUN</text>
    </svg>`,
  },
  {
    id: 'ai-robot-avatar',
    name: 'AI Asistan Robot',
    category: 'ai',
    defaultScale: 0.3,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
      <rect x="35" y="45" width="90" height="75" rx="20" fill="#1e293b" stroke="#38bdf8" stroke-width="4"/>
      <line x1="80" y1="20" x2="80" y2="45" stroke="#38bdf8" stroke-width="4"/>
      <circle cx="80" cy="18" r="8" fill="#f43f5e"/>
      <circle cx="60" cy="78" r="10" fill="#38bdf8"/>
      <circle cx="100" cy="78" r="10" fill="#38bdf8"/>
      <rect x="58" y="100" width="44" height="6" rx="3" fill="#38bdf8"/>
      <rect x="22" y="65" width="12" height="35" rx="6" fill="#0284c7"/>
      <rect x="126" y="65" width="12" height="35" rx="6" fill="#0284c7"/>
    </svg>`,
  },
  {
    id: 'ai-audio-wave',
    name: 'AI Ses Dalgası',
    category: 'ai',
    defaultScale: 0.35,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 100" width="320" height="100">
      <rect width="320" height="100" rx="14" fill="#090d16" stroke="#06b6d4" stroke-width="2.5"/>
      <rect x="30" y="40" width="10" height="20" rx="5" fill="#06b6d4"/>
      <rect x="50" y="25" width="10" height="50" rx="5" fill="#3b82f6"/>
      <rect x="70" y="15" width="10" height="70" rx="5" fill="#8b5cf6"/>
      <rect x="90" y="30" width="10" height="40" rx="5" fill="#ec4899"/>
      <rect x="110" y="10" width="10" height="80" rx="5" fill="#06b6d4"/>
      <rect x="130" y="25" width="10" height="50" rx="5" fill="#3b82f6"/>
      <rect x="150" y="40" width="10" height="20" rx="5" fill="#8b5cf6"/>
      <text x="175" y="58" fill="#ffffff" font-family="Arial, sans-serif" font-weight="900" font-size="20">AI SES MİKSİ</text>
    </svg>`,
  },
  {
    id: 'ai-thinking-bubble',
    name: 'AI Düşünüyor Balonu',
    category: 'ai',
    defaultScale: 0.35,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 100" width="320" height="100">
      <rect width="320" height="100" rx="20" fill="#1e1b4b" stroke="#818cf8" stroke-width="3"/>
      <circle cx="45" cy="50" r="16" fill="#4338ca"/>
      <text x="45" y="57" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-weight="900" font-size="20">🧠</text>
      <text x="75" y="45" fill="#818cf8" font-family="Arial, sans-serif" font-weight="bold" font-size="12">SİSTEM ANALİZİ</text>
      <text x="75" y="70" fill="#ffffff" font-family="Arial, sans-serif" font-weight="900" font-size="18">AI DÜŞÜNÜYOR...</text>
      <circle cx="270" cy="50" r="5" fill="#818cf8"/>
      <circle cx="285" cy="50" r="5" fill="#818cf8"/>
      <circle cx="300" cy="50" r="5" fill="#818cf8"/>
    </svg>`,
  },
  {
    id: 'ai-hud-target',
    name: 'Cyber HUD Odak Halkası',
    category: 'ai',
    defaultScale: 0.32,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
      <circle cx="90" cy="90" r="75" fill="none" stroke="#22d3ee" stroke-width="3" stroke-dasharray="14 8"/>
      <circle cx="90" cy="90" r="50" fill="none" stroke="#06b6d4" stroke-width="2"/>
      <circle cx="90" cy="90" r="10" fill="#22d3ee"/>
      <line x1="90" y1="10" x2="90" y2="35" stroke="#22d3ee" stroke-width="4"/>
      <line x1="90" y1="145" x2="90" y2="170" stroke="#22d3ee" stroke-width="4"/>
      <line x1="10" y1="90" x2="35" y2="90" stroke="#22d3ee" stroke-width="4"/>
      <line x1="145" y1="90" x2="170" y2="90" stroke="#22d3ee" stroke-width="4"/>
    </svg>`,
  },
  {
    id: 'ai-neon-tag',
    name: 'Neon AI Yazısı',
    category: 'ai',
    defaultScale: 0.34,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 90" width="280" height="90">
      <rect width="280" height="90" rx="14" fill="#000000" stroke="#a855f7" stroke-width="3"/>
      <text x="140" y="58" text-anchor="middle" fill="#f43f5e" font-family="Impact, Arial Black, sans-serif" font-weight="900" font-size="40" letter-spacing="4">&lt; AI PRO &gt;</text>
    </svg>`,
  },
  {
    id: 'ai-neural-node',
    name: 'Yapay Sinir Ağı Düğümü',
    category: 'ai',
    defaultScale: 0.3,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
      <circle cx="80" cy="80" r="60" fill="#0369a1" fill-opacity="0.2" stroke="#38bdf8" stroke-width="3"/>
      <circle cx="80" cy="80" r="28" fill="#0284c7" stroke="#ffffff" stroke-width="4"/>
      <circle cx="35" cy="45" r="10" fill="#38bdf8"/>
      <circle cx="125" cy="45" r="10" fill="#38bdf8"/>
      <circle cx="35" cy="115" r="10" fill="#38bdf8"/>
      <circle cx="125" cy="115" r="10" fill="#38bdf8"/>
      <line x1="80" y1="80" x2="35" y2="45" stroke="#38bdf8" stroke-width="2.5"/>
      <line x1="80" y1="80" x2="125" y2="45" stroke="#38bdf8" stroke-width="2.5"/>
      <line x1="80" y1="80" x2="35" y2="115" stroke="#38bdf8" stroke-width="2.5"/>
      <line x1="80" y1="80" x2="125" y2="115" stroke="#38bdf8" stroke-width="2.5"/>
    </svg>`,
  },

  // =========================================================================
  // 2. TIKTOK & REELS VİRAL TRENDLERİ
  // =========================================================================
  {
    id: 'tiktok-like',
    name: 'TikTok Beğen',
    category: 'tiktok',
    defaultScale: 0.35,
    isAnimated: true,
    elementAnimation: 'tiktok-like',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 90" width="280" height="90">
      <defs>
        <filter id="tt-like-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="-2" dy="-2" stdDeviation="3" flood-color="#25f4ee" flood-opacity="0.8"/>
          <feDropShadow dx="2" dy="2" stdDeviation="3" flood-color="#fe2c55" flood-opacity="0.9"/>
        </filter>
        <linearGradient id="tt-heart-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#ff3b69"/>
          <stop offset="100%" stop-color="#fe2c55"/>
        </linearGradient>
      </defs>
      <rect x="3" y="3" width="274" height="84" rx="42" fill="#090a0f" stroke="#fe2c55" stroke-width="2.5"/>
      <rect x="5" y="5" width="270" height="80" rx="40" fill="none" stroke="#25f4ee" stroke-width="1.5" stroke-opacity="0.6"/>
      <g transform="translate(52, 45)" filter="url(#tt-like-glow)">
        <path d="M0 16 C-2 -2 -24 -2 -24 -14 C-24 -24 -12 -28 0 -18 C12 -28 24 -24 24 -14 C24 -2 2 -2 0 16 Z" fill="#25f4ee" opacity="0.7" transform="translate(-2, -1) scale(0.9)"/>
        <path d="M0 16 C-2 -2 -24 -2 -24 -14 C-24 -24 -12 -28 0 -18 C12 -28 24 -24 24 -14 C24 -2 2 -2 0 16 Z" fill="url(#tt-heart-grad)" transform="scale(0.9)"/>
      </g>
      <text x="105" y="44" fill="#ffffff" font-family="Arial Black, Impact, sans-serif" font-weight="900" font-size="24" letter-spacing="1">BEĞEN</text>
      <text x="105" y="66" fill="#fe2c55" font-family="Arial, sans-serif" font-weight="800" font-size="15" letter-spacing="0.5">❤️ 1.4M</text>
    </svg>`,
  },
  {
    id: 'tiktok-double-tap-heart',
    name: 'TikTok Çift Tıkla Kalp',
    category: 'tiktok',
    defaultScale: 0.38,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
      <defs>
        <filter id="tt-pop-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="-3" dy="-2" stdDeviation="6" flood-color="#25f4ee" flood-opacity="0.8"/>
          <feDropShadow dx="3" dy="3" stdDeviation="6" flood-color="#fe2c55" flood-opacity="0.9"/>
        </filter>
      </defs>
      <circle cx="100" cy="100" r="85" fill="none" stroke="#fe2c55" stroke-width="2" stroke-dasharray="6 12" opacity="0.6"/>
      <circle cx="45" cy="55" r="5" fill="#25f4ee"/>
      <circle cx="160" cy="65" r="4" fill="#fe2c55"/>
      <circle cx="150" cy="145" r="6" fill="#25f4ee"/>
      <circle cx="50" cy="140" r="4.5" fill="#ffffff"/>
      <g transform="translate(100, 95)" filter="url(#tt-pop-glow)">
        <path d="M0 45 C-5 -5 -60 -5 -60 -36 C-60 -60 -30 -70 0 -45 C30 -70 60 -60 60 -36 C60 -5 5 -5 0 45 Z" fill="#25f4ee" opacity="0.6" transform="translate(-4, -2)"/>
        <path d="M0 45 C-5 -5 -60 -5 -60 -36 C-60 -60 -30 -70 0 -45 C30 -70 60 -60 60 -36 C60 -5 5 -5 0 45 Z" fill="#fe2c55"/>
        <path d="M-8 -15 C-12 -28 -28 -32 -38 -24 C-46 -18 -42 -2 -34 10 Z" fill="#ffffff" opacity="0.3"/>
      </g>
      <text x="100" y="175" text-anchor="middle" fill="#ffffff" font-family="Arial Black, Impact, sans-serif" font-weight="900" font-size="16" letter-spacing="1">ÇİFT TIKLA ❤️</text>
    </svg>`,
  },
  {
    id: 'tiktok-like-counter',
    name: 'TikTok Beğeni Sayacı',
    category: 'tiktok',
    defaultScale: 0.3,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 160" width="140" height="160">
      <defs>
        <filter id="tt-icon-glow">
          <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#fe2c55" flood-opacity="0.6"/>
        </filter>
      </defs>
      <circle cx="70" cy="60" r="44" fill="#18181b" stroke="#ffffff" stroke-width="3" stroke-opacity="0.2"/>
      <g transform="translate(70, 58) scale(0.9)" filter="url(#tt-icon-glow)">
        <path d="M0 24 C-3 -3 -32 -3 -32 -18 C-32 -30 -16 -36 0 -24 C16 -36 32 -30 32 -18 C32 -3 3 -3 0 24 Z" fill="#fe2c55"/>
      </g>
      <text x="70" y="132" text-anchor="middle" fill="#ffffff" font-family="Arial Black, Impact, sans-serif" font-weight="900" font-size="24" letter-spacing="0.5">842.5K</text>
    </svg>`,
  },
  {
    id: 'tiktok-comment',
    name: 'TikTok Yorum Yap',
    category: 'tiktok',
    defaultScale: 0.32,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 90" width="260" height="90">
      <rect width="260" height="90" rx="45" fill="#18181b" stroke="#ffffff" stroke-width="2.5" stroke-opacity="0.3"/>
      <path d="M42 30 C30 30 22 38 22 48 C22 55 26 61 32 64 L30 74 L42 67 C44 67 46 67 48 67 C60 67 68 59 68 48 C68 38 60 30 48 30 Z" fill="#ffffff"/>
      <circle cx="37" cy="48" r="2.5" fill="#18181b"/>
      <circle cx="45" cy="48" r="2.5" fill="#18181b"/>
      <circle cx="53" cy="48" r="2.5" fill="#18181b"/>
      <text x="85" y="56" fill="#ffffff" font-family="Arial, sans-serif" font-weight="900" font-size="24">YORUM YAP</text>
    </svg>`,
  },
  {
    id: 'tiktok-repost',
    name: 'TikTok Yeniden Paylaş',
    category: 'tiktok',
    defaultScale: 0.32,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 90" width="280" height="90">
      <rect width="280" height="90" rx="45" fill="#18181b" stroke="#facc15" stroke-width="3"/>
      <circle cx="48" cy="45" r="22" fill="#facc15"/>
      <path d="M38 42 L48 32 L58 42 M48 34 L48 56 M58 48 L48 58 L38 48" fill="none" stroke="#000000" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      <text x="88" y="56" fill="#facc15" font-family="Arial, sans-serif" font-weight="900" font-size="22">YENİDEN PAYLAŞ</text>
    </svg>`,
  },
  {
    id: 'tiktok-follow-plus',
    name: 'TikTok Takip Et (+)',
    category: 'tiktok',
    defaultScale: 0.32,
    isAnimated: true,
    elementAnimation: 'tiktok-follow',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 160" width="140" height="160">
      <circle cx="70" cy="65" r="50" fill="#18181b" stroke="#ffffff" stroke-width="4"/>
      <circle cx="70" cy="55" r="18" fill="#71717a"/>
      <path d="M40 98 C40 82 54 75 70 75 C86 75 100 82 100 98 Z" fill="#71717a"/>
      <circle cx="70" cy="120" r="22" fill="#fe2c55"/>
      <line x1="70" y1="108" x2="70" y2="132" stroke="#ffffff" stroke-width="5" stroke-linecap="round"/>
      <line x1="58" y1="120" x2="82" y2="120" stroke="#ffffff" stroke-width="5" stroke-linecap="round"/>
    </svg>`,
  },
  {
    id: 'tiktok-fyp-badge',
    name: 'TikTok FYP Keşfet',
    category: 'tiktok',
    defaultScale: 0.35,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 90" width="320" height="90">
      <rect width="320" height="90" rx="45" fill="#000000" stroke="#fe2c55" stroke-width="3"/>
      <circle cx="48" cy="45" r="24" fill="#fe2c55"/>
      <text x="48" y="54" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-weight="900" font-size="24">🔥</text>
      <text x="88" y="56" fill="#ffffff" font-family="Arial, sans-serif" font-weight="900" font-size="26" letter-spacing="1">#FYP • KEŞFET</text>
    </svg>`,
  },
  {
    id: 'tiktok-share-arrow',
    name: 'TikTok Paylaş Oku',
    category: 'tiktok',
    defaultScale: 0.33,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 90" width="280" height="90">
      <rect width="280" height="90" rx="45" fill="#18181b" stroke="#25f4ee" stroke-width="3"/>
      <path d="M35 55 C35 35 55 25 75 25 L75 12 L105 38 L75 64 L75 50 C58 50 48 56 42 68 Z" fill="#25f4ee"/>
      <text x="120" y="56" fill="#ffffff" font-family="Arial, sans-serif" font-weight="900" font-size="26">PAYLAŞ</text>
    </svg>`,
  },
  {
    id: 'tiktok-sound-disc',
    name: 'TikTok Dönen Plak',
    category: 'tiktok',
    defaultScale: 0.3,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
      <circle cx="80" cy="80" r="70" fill="#111827" stroke="#374151" stroke-width="4"/>
      <circle cx="80" cy="80" r="50" fill="none" stroke="#1f2937" stroke-width="3"/>
      <circle cx="80" cy="80" r="28" fill="#fe2c55"/>
      <circle cx="80" cy="80" r="8" fill="#ffffff"/>
      <path d="M125 40 Q135 25 145 35 Q135 45 125 40 Z" fill="#25f4ee"/>
    </svg>`,
  },
  {
    id: 'tiktok-bookmark',
    name: 'TikTok Kaydet Rozeti',
    category: 'tiktok',
    defaultScale: 0.33,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 90" width="260" height="90">
      <rect width="260" height="90" rx="45" fill="#facc15" stroke="#ca8a04" stroke-width="3"/>
      <path d="M45 25 L75 25 L75 68 L60 55 L45 68 Z" fill="#000000"/>
      <text x="95" y="56" fill="#000000" font-family="Arial, sans-serif" font-weight="900" font-size="26">KAYDET</text>
    </svg>`,
  },
  {
    id: 'tiktok-pov-tag',
    name: 'POV: Başlık Kutusu',
    category: 'tiktok',
    defaultScale: 0.34,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 85" width="260" height="85">
      <rect width="260" height="85" rx="12" fill="#ffffff" stroke="#000000" stroke-width="4"/>
      <text x="130" y="58" text-anchor="middle" fill="#000000" font-family="Impact, Arial Black, sans-serif" font-weight="900" font-size="46" letter-spacing="3">POV:</text>
    </svg>`,
  },
  {
    id: 'tiktok-part2-tag',
    name: 'PART 2 GELİYOR!',
    category: 'tiktok',
    defaultScale: 0.36,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 85" width="340" height="85">
      <rect width="340" height="85" rx="14" fill="#e11d48" stroke="#ffffff" stroke-width="3.5"/>
      <text x="170" y="56" text-anchor="middle" fill="#ffffff" font-family="Impact, Arial Black, sans-serif" font-weight="900" font-size="34" letter-spacing="2">⚠️ PART 2 PROFİLDE!</text>
    </svg>`,
  },
  {
    id: 'tiktok-wait-end',
    name: 'Sonuna Kadar İzle',
    category: 'tiktok',
    defaultScale: 0.36,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 85" width="360" height="85">
      <rect width="360" height="85" rx="42" fill="#000000" stroke="#f59e0b" stroke-width="3"/>
      <text x="180" y="54" text-anchor="middle" fill="#f59e0b" font-family="Arial, sans-serif" font-weight="900" font-size="25" letter-spacing="1">⏳ SONUNA KADAR İZLE</text>
    </svg>`,
  },
  {
    id: 'tiktok-countdown-321',
    name: 'Geri Sayım 3-2-1',
    category: 'tiktok',
    defaultScale: 0.3,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
      <circle cx="80" cy="80" r="70" fill="#000000" stroke="#ef4444" stroke-width="6"/>
      <circle cx="80" cy="80" r="54" fill="none" stroke="#ffffff" stroke-width="2" stroke-dasharray="8 6"/>
      <text x="80" y="105" text-anchor="middle" fill="#ffffff" font-family="Impact, Arial Black, sans-serif" font-weight="900" font-size="70">3</text>
    </svg>`,
  },
  {
    id: 'tiktok-viral-fire',
    name: 'Viral Alev Rozeti',
    category: 'tiktok',
    defaultScale: 0.32,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
      <path d="M90 10 C105 50 145 70 145 110 C145 150 115 170 90 170 C65 170 35 150 35 110 C35 70 75 50 90 10 Z" fill="#fe2c55"/>
      <path d="M90 60 C100 85 120 100 120 125 C120 150 105 160 90 160 C75 160 60 150 60 125 C60 100 80 85 90 60 Z" fill="#facc15"/>
      <text x="90" y="135" text-anchor="middle" fill="#000000" font-family="Arial, sans-serif" font-weight="900" font-size="20">TREND</text>
    </svg>`,
  },

  // =========================================================================
  // 3. YOUTUBE & SHORTS
  // =========================================================================
  {
    id: 'yt-sub-bell',
    name: 'YouTube Abone Ol + Çan',
    category: 'youtube',
    defaultScale: 0.36,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 380 90" width="380" height="90">
      <rect width="250" height="90" rx="45" fill="#cc0000"/>
      <text x="125" y="56" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-weight="900" font-size="26">ABONE OL</text>
      <rect x="270" y="0" width="110" height="90" rx="45" fill="#27272a"/>
      <path d="M325 28 C325 22 318 17 312 17 C306 17 299 22 299 28 L299 48 L288 58 L336 58 L325 48 Z M312 70 C316 70 318 67 318 64 L306 64 C306 67 308 70 312 70 Z" fill="#ffffff"/>
      <path d="M345 32 C350 37 350 48 345 53" stroke="#facc15" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M280 32 C275 37 275 48 280 53" stroke="#facc15" stroke-width="3" fill="none" stroke-linecap="round"/>
    </svg>`,
  },
  {
    id: 'yt-shorts-logo',
    name: 'YouTube Shorts Rozeti',
    category: 'youtube',
    defaultScale: 0.32,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 90" width="280" height="90">
      <rect width="280" height="90" rx="45" fill="#0f0f0f" stroke="#27272a" stroke-width="2"/>
      <rect x="25" y="20" width="35" height="50" rx="10" fill="#ff0000"/>
      <polygon points="38,35 50,45 38,55" fill="#ffffff"/>
      <text x="80" y="56" fill="#ffffff" font-family="Arial, sans-serif" font-weight="900" font-size="28">Shorts</text>
    </svg>`,
  },
  {
    id: 'yt-like-counter',
    name: 'YouTube Beğeni Sayacı',
    category: 'youtube',
    defaultScale: 0.34,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 90" width="300" height="90">
      <rect width="300" height="90" rx="45" fill="#27272a" stroke="#3f3f46" stroke-width="2"/>
      <path d="M42 50 L42 70 L54 70 L54 50 Z M60 50 L60 70 L82 70 C85 70 87 68 88 66 L94 52 C95 50 94 47 91 47 L76 47 L79 35 C79 31 75 28 72 28 L69 30 L60 46 Z" fill="#ffffff"/>
      <text x="110" y="56" fill="#ffffff" font-family="Arial, sans-serif" font-weight="900" font-size="26">100K+ LİKE</text>
    </svg>`,
  },
  {
    id: 'yt-link-desc',
    name: 'Link Açıklamada Oku',
    category: 'youtube',
    defaultScale: 0.36,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 380 90" width="380" height="90">
      <rect width="380" height="90" rx="45" fill="#18181b" stroke="#3b82f6" stroke-width="3"/>
      <text x="175" y="55" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-weight="900" font-size="23">LİNK AÇIKLAMADA</text>
      <path d="M330 35 L330 55 L340 55 L325 70 L310 55 L320 55 L320 35 Z" fill="#3b82f6"/>
    </svg>`,
  },
  {
    id: 'yt-comment-bubble',
    name: 'Yorum Yap Rozeti',
    category: 'youtube',
    defaultScale: 0.35,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 90" width="320" height="90">
      <rect width="320" height="90" rx="45" fill="#27272a"/>
      <path d="M40 32 C40 26 45 22 52 22 L88 22 C95 22 100 26 100 32 L100 52 C100 58 95 62 88 62 L60 62 L45 74 L48 62 L52 62 C45 62 40 58 40 52 Z" fill="#ffffff"/>
      <text x="120" y="55" fill="#ffffff" font-family="Arial, sans-serif" font-weight="900" font-size="24">YORUM YAP</text>
    </svg>`,
  },
  {
    id: 'yt-4k-uhd',
    name: '4K Ultra HD Rozeti',
    category: 'youtube',
    defaultScale: 0.3,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 80" width="220" height="80">
      <rect width="220" height="80" rx="14" fill="#000000" stroke="#eab308" stroke-width="3"/>
      <text x="110" y="55" text-anchor="middle" fill="#eab308" font-family="Impact, Arial Black, sans-serif" font-weight="900" font-size="40" letter-spacing="2">4K UHD</text>
    </svg>`,
  },
  {
    id: 'yt-watch-now',
    name: 'Şimdi İzle Butonu',
    category: 'youtube',
    defaultScale: 0.34,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 85" width="280" height="85">
      <rect width="280" height="85" rx="42" fill="#ff0000"/>
      <polygon points="45,28 70,42 45,56" fill="#ffffff"/>
      <text x="90" y="54" fill="#ffffff" font-family="Arial, sans-serif" font-weight="900" font-size="26">ŞİMDİ İZLE</text>
    </svg>`,
  },
  {
    id: 'yt-sponsor-tag',
    name: 'Ücretli Tanıtım Etiketi',
    category: 'youtube',
    defaultScale: 0.32,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 70" width="260" height="70">
      <rect width="260" height="70" rx="8" fill="#18181b" stroke="#71717a" stroke-width="2"/>
      <text x="130" y="44" text-anchor="middle" fill="#e4e4e7" font-family="Arial, sans-serif" font-weight="bold" font-size="18">ÜCRETLİ TANITIM</text>
    </svg>`,
  },
  {
    id: 'yt-dislike-button',
    name: 'Dislike Rozeti',
    category: 'youtube',
    defaultScale: 0.3,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 90" width="160" height="90">
      <rect width="160" height="90" rx="45" fill="#27272a"/>
      <path d="M98 40 L98 20 L86 20 L86 40 Z M80 40 L80 20 L58 20 C55 20 53 22 52 24 L46 38 C45 40 46 43 49 43 L64 43 L61 55 C61 59 65 62 68 62 L71 60 L80 44 Z" fill="#ffffff"/>
    </svg>`,
  },
  {
    id: 'yt-timer-badge',
    name: 'Sayaç / Zaman Rozeti',
    category: 'youtube',
    defaultScale: 0.3,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 80" width="200" height="80">
      <rect width="200" height="80" rx="16" fill="#000000" stroke="#ef4444" stroke-width="3"/>
      <text x="100" y="52" text-anchor="middle" fill="#ef4444" font-family="monospace, sans-serif" font-weight="900" font-size="34">⏱ 00:30</text>
    </svg>`,
  },

  // =========================================================================
  // 4. INSTAGRAM (REELS & STORY)
  // =========================================================================
  {
    id: 'ig-verified-blue',
    name: 'Instagram Mavi Tik',
    category: 'instagram',
    defaultScale: 0.28,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 140" width="140" height="140">
      <path d="M70 10 L84 22 L102 18 L110 35 L128 40 L128 58 L140 70 L128 82 L128 100 L110 105 L102 122 L84 118 L70 130 L56 118 L38 122 L30 105 L12 100 L12 82 L0 70 L12 58 L12 40 L30 35 L38 18 L56 22 Z" fill="#3897f0"/>
      <polyline points="45,72 62,88 95,52" fill="none" stroke="#ffffff" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
  },
  {
    id: 'ig-reels-badge',
    name: 'Instagram Reels Rozeti',
    category: 'instagram',
    defaultScale: 0.34,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 90" width="280" height="90">
      <defs>
        <linearGradient id="ig-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#833ab4"/>
          <stop offset="50%" stop-color="#fd1d1d"/>
          <stop offset="100%" stop-color="#fcb045"/>
        </linearGradient>
      </defs>
      <rect width="280" height="90" rx="45" fill="url(#ig-grad)"/>
      <rect x="35" y="24" width="42" height="42" rx="12" fill="none" stroke="#ffffff" stroke-width="4"/>
      <polygon points="50,37 68,45 50,53" fill="#ffffff"/>
      <text x="95" y="56" fill="#ffffff" font-family="Arial, sans-serif" font-weight="900" font-size="28">REELS</text>
    </svg>`,
  },
  {
    id: 'ig-gradient-heart',
    name: 'Instagram Kalp Beğeni',
    category: 'instagram',
    defaultScale: 0.3,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
      <defs>
        <linearGradient id="ig-heart" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fd1d1d"/>
          <stop offset="100%" stop-color="#833ab4"/>
        </linearGradient>
      </defs>
      <path d="M80 32 C65 12 35 15 25 38 C12 68 60 115 80 135 C100 115 148 68 135 38 C125 15 95 12 80 32 Z" fill="url(#ig-heart)"/>
    </svg>`,
  },
  {
    id: 'ig-dm-plane',
    name: 'Instagram DM Gönder',
    category: 'instagram',
    defaultScale: 0.32,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 85" width="240" height="85">
      <rect width="240" height="85" rx="42" fill="#262626" stroke="#404040" stroke-width="2"/>
      <path d="M35 42 L65 25 L55 58 L46 47 Z M55 58 L48 52" fill="#ffffff" stroke="#ffffff" stroke-width="2"/>
      <text x="85" y="53" fill="#ffffff" font-family="Arial, sans-serif" font-weight="900" font-size="26">DM AT</text>
    </svg>`,
  },
  {
    id: 'ig-link-bio',
    name: 'Biyografideki Link Rozeti',
    category: 'instagram',
    defaultScale: 0.35,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 85" width="340" height="85">
      <defs>
        <linearGradient id="ig-bio" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#833ab4"/>
          <stop offset="100%" stop-color="#fd1d1d"/>
        </linearGradient>
      </defs>
      <rect width="340" height="85" rx="42" fill="url(#ig-bio)"/>
      <text x="170" y="53" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-weight="900" font-size="22">🔗 BİYOGRAFİDEKİ LİNK</text>
    </svg>`,
  },
  {
    id: 'ig-new-post',
    name: 'Yeni Gönderi Patlaması',
    category: 'instagram',
    defaultScale: 0.32,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
      <polygon points="90,10 115,35 150,30 155,65 180,90 155,115 150,150 115,145 90,170 65,145 30,150 25,115 0,90 25,65 30,30 65,35" fill="#f43f5e"/>
      <text x="90" y="85" text-anchor="middle" fill="#ffffff" font-family="Impact, Arial Black, sans-serif" font-weight="900" font-size="26">YENİ</text>
      <text x="90" y="115" text-anchor="middle" fill="#ffffff" font-family="Impact, Arial Black, sans-serif" font-weight="900" font-size="22">POST!</text>
    </svg>`,
  },
  {
    id: 'ig-tap-here',
    name: 'Buraya Tıkla (Story)',
    category: 'instagram',
    defaultScale: 0.33,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 85" width="300" height="85">
      <rect width="300" height="85" rx="42" fill="#000000" stroke="#ec4899" stroke-width="3"/>
      <text x="150" y="53" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-weight="900" font-size="22">👆 BURAYA TIKLA</text>
    </svg>`,
  },
  {
    id: 'ig-poll-yesno',
    name: 'Story Anket (Evet/Hayır)',
    category: 'instagram',
    defaultScale: 0.35,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 90" width="320" height="90">
      <rect width="320" height="90" rx="16" fill="#262626" stroke="#404040" stroke-width="2"/>
      <rect x="15" y="15" width="140" height="60" rx="12" fill="#22c55e"/>
      <text x="85" y="53" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-weight="900" font-size="24">EVET</text>
      <rect x="165" y="15" width="140" height="60" rx="12" fill="#ef4444"/>
      <text x="235" y="53" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-weight="900" font-size="24">HAYIR</text>
    </svg>`,
  },
  {
    id: 'ig-question-box',
    name: 'Soru Sor Kutusu',
    category: 'instagram',
    defaultScale: 0.36,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 100" width="340" height="100">
      <rect width="340" height="100" rx="20" fill="#ffffff" stroke="#e5e5e5" stroke-width="2"/>
      <text x="170" y="40" text-anchor="middle" fill="#000000" font-family="Arial, sans-serif" font-weight="bold" font-size="18">Bana bir soru sor</text>
      <rect x="25" y="55" width="290" height="32" rx="16" fill="#f5f5f5"/>
      <text x="170" y="77" text-anchor="middle" fill="#737373" font-family="Arial, sans-serif" font-size="14">Bir şeyler yaz...</text>
    </svg>`,
  },
  {
    id: 'ig-sound-wave',
    name: 'Instagram Ses Çubuğu',
    category: 'instagram',
    defaultScale: 0.28,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120" width="160" height="120">
      <rect width="160" height="120" rx="20" fill="#000000" fill-opacity="0.8"/>
      <rect x="35" y="45" width="12" height="30" rx="6" fill="#ec4899"/>
      <rect x="55" y="25" width="12" height="70" rx="6" fill="#f43f5e"/>
      <rect x="75" y="15" width="12" height="90" rx="6" fill="#a855f7"/>
      <rect x="95" y="35" width="12" height="50" rx="6" fill="#8b5cf6"/>
      <rect x="115" y="50" width="12" height="20" rx="6" fill="#3b82f6"/>
    </svg>`,
  },

  // =========================================================================
  // 5. OKLAR & VURGULAR (ATTENTION HOOKS)
  // =========================================================================
  {
    id: 'arrow-neon-green',
    name: 'Neon Yeşil Vurgu Oku',
    category: 'arrows',
    defaultScale: 0.32,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 120" width="240" height="120">
      <path d="M15 45 L150 45 L150 15 L225 60 L150 105 L150 75 L15 75 Z" fill="#22c55e" stroke="#ffffff" stroke-width="6"/>
    </svg>`,
  },
  {
    id: 'arrow-curved-red',
    name: 'Kavisli Kırmızı Ok',
    category: 'arrows',
    defaultScale: 0.34,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 180" width="200" height="180">
      <path d="M30 160 C30 70 80 40 140 40 L140 10 L195 55 L140 100 L140 70 C90 70 60 90 55 160 Z" fill="#ef4444" stroke="#ffffff" stroke-width="5"/>
    </svg>`,
  },
  {
    id: 'arrow-hand-pointer',
    name: 'İşaret Eden El (3D)',
    category: 'arrows',
    defaultScale: 0.3,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
      <path d="M25 85 L70 85 L70 45 C70 38 78 35 84 40 L84 75 L95 75 L95 55 C95 50 102 48 106 52 L106 75 L116 75 L116 62 C116 58 123 56 127 60 L127 105 C127 135 105 145 80 145 C50 145 25 125 25 100 Z" fill="#facc15" stroke="#ca8a04" stroke-width="5"/>
    </svg>`,
  },
  {
    id: 'target-pulsing-circle',
    name: 'Kırmızı Hedef Halkası',
    category: 'arrows',
    defaultScale: 0.3,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
      <circle cx="90" cy="90" r="75" fill="none" stroke="#ef4444" stroke-width="8" stroke-dasharray="16 10"/>
      <circle cx="90" cy="90" r="40" fill="none" stroke="#ef4444" stroke-width="5"/>
      <circle cx="90" cy="90" r="14" fill="#ef4444"/>
    </svg>`,
  },
  {
    id: 'highlight-yellow-marker',
    name: 'Sarı Vurgulayıcı Çerçeve',
    category: 'arrows',
    defaultScale: 0.36,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 120" width="340" height="120">
      <rect x="8" y="8" width="324" height="104" rx="14" fill="none" stroke="#facc15" stroke-width="8" stroke-dasharray="14 10"/>
    </svg>`,
  },
  {
    id: 'zoom-corner-brackets',
    name: 'Kamera Odak Köşelikleri',
    category: 'arrows',
    defaultScale: 0.34,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
      <path d="M20 60 L20 20 L60 20" fill="none" stroke="#38bdf8" stroke-width="8" stroke-linecap="round"/>
      <path d="M140 20 L180 20 L180 60" fill="none" stroke="#38bdf8" stroke-width="8" stroke-linecap="round"/>
      <path d="M20 140 L20 180 L60 180" fill="none" stroke="#38bdf8" stroke-width="8" stroke-linecap="round"/>
      <path d="M140 180 L180 180 L180 140" fill="none" stroke="#38bdf8" stroke-width="8" stroke-linecap="round"/>
      <circle cx="100" cy="100" r="6" fill="#38bdf8"/>
    </svg>`,
  },
  {
    id: 'warning-exclamation',
    name: 'Sarı İkaz Ünlemi (!)',
    category: 'arrows',
    defaultScale: 0.3,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
      <polygon points="80,15 150,140 10,140" fill="#facc15" stroke="#000000" stroke-width="7"/>
      <rect x="74" y="55" width="12" height="45" rx="6" fill="#000000"/>
      <circle cx="80" cy="118" r="8" fill="#000000"/>
    </svg>`,
  },
  {
    id: 'question-mark-neon',
    name: 'Neon Soru İşareti (?)',
    category: 'arrows',
    defaultScale: 0.3,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 180" width="140" height="180">
      <path d="M35 50 C35 20 60 15 75 15 C105 15 115 35 110 55 C105 75 80 85 80 110 L80 115" fill="none" stroke="#c084fc" stroke-width="16" stroke-linecap="round"/>
      <circle cx="80" cy="155" r="10" fill="#c084fc"/>
    </svg>`,
  },

  // =========================================================================
  // 6. SANSÜR, GİZLİLİK & FİNANS
  // =========================================================================
  {
    id: 'censor-black-bar',
    name: 'Siyah Sansür Bandı',
    category: 'censor',
    defaultScale: 0.4,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 80" width="340" height="80">
      <rect width="340" height="80" rx="6" fill="#000000" stroke="#27272a" stroke-width="2"/>
      <text x="170" y="50" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-weight="900" font-size="26" letter-spacing="4">[ SANSÜR ]</text>
    </svg>`,
  },
  {
    id: 'censor-red-badge',
    name: 'Kırmızı GİZLİ Kaşesi',
    category: 'censor',
    defaultScale: 0.36,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 90" width="300" height="90">
      <rect width="300" height="90" rx="10" fill="#dc2626" stroke="#991b1b" stroke-width="4"/>
      <text x="150" y="58" text-anchor="middle" fill="#ffffff" font-family="Impact, Arial Black, sans-serif" font-weight="900" font-size="36" letter-spacing="3">TOP SECRET</text>
    </svg>`,
  },
  {
    id: 'censor-pixel-mosaic',
    name: 'Mozaik Sansür Deseni',
    category: 'censor',
    defaultScale: 0.35,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 120" width="240" height="120">
      <rect width="60" height="40" x="0" y="0" fill="#374151"/>
      <rect width="60" height="40" x="60" y="0" fill="#4b5563"/>
      <rect width="60" height="40" x="120" y="0" fill="#1f2937"/>
      <rect width="60" height="40" x="180" y="0" fill="#6b7280"/>
      <rect width="60" height="40" x="0" y="40" fill="#4b5563"/>
      <rect width="60" height="40" x="60" y="40" fill="#1f2937"/>
      <rect width="60" height="40" x="120" y="40" fill="#9ca3af"/>
      <rect width="60" height="40" x="180" y="40" fill="#374151"/>
      <rect width="60" height="40" x="0" y="80" fill="#111827"/>
      <rect width="60" height="40" x="60" y="80" fill="#6b7280"/>
      <rect width="60" height="40" x="120" y="80" fill="#4b5563"/>
      <rect width="60" height="40" x="180" y="80" fill="#1f2937"/>
    </svg>`,
  },
  {
    id: 'finance-crypto-bull',
    name: 'Yükselen Stonks Grafiği',
    category: 'censor',
    defaultScale: 0.35,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 100" width="320" height="100">
      <rect width="320" height="100" rx="16" fill="#052e16" stroke="#22c55e" stroke-width="3"/>
      <polyline points="25,75 75,55 125,65 185,25" fill="none" stroke="#22c55e" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
      <polygon points="180,15 205,25 185,45" fill="#22c55e"/>
      <text x="215" y="60" fill="#22c55e" font-family="Arial, sans-serif" font-weight="900" font-size="28">+450%</text>
    </svg>`,
  },
  {
    id: 'finance-money-bag',
    name: 'Para & Kazanç Rozeti ($$$)',
    category: 'censor',
    defaultScale: 0.32,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
      <circle cx="80" cy="80" r="70" fill="#15803d" stroke="#22c55e" stroke-width="5"/>
      <text x="80" y="105" text-anchor="middle" fill="#facc15" font-family="Impact, Arial Black, sans-serif" font-weight="900" font-size="70">$</text>
    </svg>`,
  },
  {
    id: 'badge-discount-50',
    name: '%50 İndirim Etiketi',
    category: 'stickers',
    defaultScale: 0.32,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
      <polygon points="90,10 115,35 150,30 155,65 180,90 155,115 150,150 115,145 90,170 65,145 30,150 25,115 0,90 25,65 30,30 65,35" fill="#dc2626"/>
      <text x="90" y="85" text-anchor="middle" fill="#ffffff" font-family="Impact, Arial Black, sans-serif" font-weight="900" font-size="34">%50</text>
      <text x="90" y="115" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-weight="900" font-size="20">İNDİRİM</text>
    </svg>`,
  },
  {
    id: 'badge-100-percent',
    name: '100% Onaylı & Güvenli',
    category: 'stickers',
    defaultScale: 0.34,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 90" width="280" height="90">
      <rect width="280" height="90" rx="45" fill="#15803d" stroke="#22c55e" stroke-width="3"/>
      <circle cx="48" cy="45" r="22" fill="#22c55e"/>
      <polyline points="38,45 46,53 58,37" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
      <text x="85" y="55" fill="#ffffff" font-family="Arial, sans-serif" font-weight="900" font-size="24">100% ONAYLI</text>
    </svg>`,
  },
];

export const ELEMENT_PRESETS_MAP = new Map<string, ElementPreset>(
  ELEMENT_PRESETS.map((p) => [p.id, p])
);

/**
 * Fast lookup helper to resolve SVG content by assetId, clipId, preset id, or clip name
 */
export function getElementSvg(idOrAssetId: string | undefined, clipName?: string): string | undefined {
  if (idOrAssetId) {
    if (ELEMENT_PRESETS_MAP.has(idOrAssetId)) {
      return ELEMENT_PRESETS_MAP.get(idOrAssetId)!.svg;
    }
    // Try element-xxx-timestamp pattern
    if (idOrAssetId.startsWith('element-')) {
      const raw = idOrAssetId.replace('element-', '');
      const presetId = raw.replace(/-\d+$/, '');
      if (ELEMENT_PRESETS_MAP.has(presetId)) {
        return ELEMENT_PRESETS_MAP.get(presetId)!.svg;
      }
    }
  }

  // Name or fuzzy matching fallback (e.g. for recovered projects or clips whose id lost its preset link)
  const lookup = (clipName || idOrAssetId || '').toLowerCase().trim();
  if (lookup) {
    // 1. Exact match with preset id or name
    for (const preset of ELEMENT_PRESETS) {
      if (lookup === preset.id.toLowerCase() || lookup === preset.name.toLowerCase()) {
        return preset.svg;
      }
    }

    // 2. Specific social media keywords
    if (lookup.includes('tiktok') || lookup.includes('tik tok')) {
      if (lookup.includes('beğen') || lookup.includes('begen') || lookup.includes('like') || lookup.includes('kalp')) {
        return ELEMENT_PRESETS_MAP.get('tiktok-like')?.svg;
      }
      if (lookup.includes('çift') || lookup.includes('cift') || lookup.includes('double')) {
        return ELEMENT_PRESETS_MAP.get('tiktok-double-tap-heart')?.svg;
      }
      if (lookup.includes('takip') || lookup.includes('follow') || lookup.includes('+')) {
        return ELEMENT_PRESETS_MAP.get('tiktok-follow-plus')?.svg;
      }
      if (lookup.includes('paylaş') || lookup.includes('paylas') || lookup.includes('share')) {
        return ELEMENT_PRESETS_MAP.get('tiktok-share-arrow')?.svg;
      }
      if (lookup.includes('yorum') || lookup.includes('comment')) {
        return ELEMENT_PRESETS_MAP.get('tiktok-comment')?.svg;
      }
      if (lookup.includes('yeniden') || lookup.includes('repost')) {
        return ELEMENT_PRESETS_MAP.get('tiktok-repost')?.svg;
      }
      if (lookup.includes('kaydet') || lookup.includes('bookmark')) {
        return ELEMENT_PRESETS_MAP.get('tiktok-bookmark')?.svg;
      }
      if (lookup.includes('fyp') || lookup.includes('keşfet') || lookup.includes('kesfet')) {
        return ELEMENT_PRESETS_MAP.get('tiktok-fyp-badge')?.svg;
      }
      if (lookup.includes('plak') || lookup.includes('sound') || lookup.includes('disc')) {
        return ELEMENT_PRESETS_MAP.get('tiktok-sound-disc')?.svg;
      }
      // General tiktok fallback
      return ELEMENT_PRESETS_MAP.get('tiktok-like')?.svg;
    }

    if (lookup.includes('youtube') || lookup.includes('yt')) {
      if (lookup.includes('abone') || lookup.includes('sub') || lookup.includes('çan') || lookup.includes('can') || lookup.includes('bell')) {
        return ELEMENT_PRESETS_MAP.get('yt-sub-bell')?.svg;
      }
      if (lookup.includes('beğen') || lookup.includes('begen') || lookup.includes('like')) {
        return ELEMENT_PRESETS_MAP.get('yt-like-counter')?.svg;
      }
      if (lookup.includes('shorts')) {
        return ELEMENT_PRESETS_MAP.get('yt-shorts-logo')?.svg;
      }
    }

    if (lookup.includes('instagram') || lookup.includes('ig')) {
      if (lookup.includes('kalp') || lookup.includes('heart') || lookup.includes('beğen') || lookup.includes('begen') || lookup.includes('like')) {
        return ELEMENT_PRESETS_MAP.get('ig-gradient-heart')?.svg;
      }
      if (lookup.includes('mavi') || lookup.includes('verified') || lookup.includes('tik')) {
        return ELEMENT_PRESETS_MAP.get('ig-verified-blue')?.svg;
      }
      if (lookup.includes('reels')) {
        return ELEMENT_PRESETS_MAP.get('ig-reels-badge')?.svg;
      }
    }

    // 3. Fallback substring match
    for (const preset of ELEMENT_PRESETS) {
      if (lookup.includes(preset.name.toLowerCase()) || preset.name.toLowerCase().includes(lookup)) {
        return preset.svg;
      }
    }
  }

  return undefined;
}

/**
 * Creates a permanent, self-contained SVG Data URI with zero external network or IndexedDB dependency
 */
export function createSvgDataUrl(svgString: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString.trim())}`;
}
