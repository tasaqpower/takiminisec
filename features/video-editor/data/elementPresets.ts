export interface ElementPreset {
  id: string;
  name: string;
  category: 'animated' | 'tiktok' | 'youtube' | 'instagram' | 'arrows' | 'censor' | 'stickers';
  svg: string;
  defaultScale?: number;
  isAnimated?: boolean;
  elementAnimation?: string;
}

export const ELEMENT_PRESETS: ElementPreset[] = [
  // =========================================================================
  // 0. CANLI ANİMASYONLU SOSYAL MEDYA ÖĞELERİ (100% GERÇEK VE DİREKT UI)
  // =========================================================================
  {
    id: 'tiktok-animated-double-tap',
    name: 'TikTok Çift Tıkla Kalp (Patlama)',
    category: 'tiktok',
    defaultScale: 0.38,
    isAnimated: true,
    elementAnimation: 'tiktok-double-tap',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
      <defs>
        <style>
          @keyframes dtHeartPop {
            0%, 15% { transform: scale(0.2) rotate(-14deg); opacity: 0; }
            28% { transform: scale(1.32) rotate(-14deg); opacity: 1; }
            38% { transform: scale(1.0) rotate(-14deg); opacity: 1; }
            70% { transform: scale(1.04) translateY(-8px) rotate(-14deg); opacity: 1; }
            88%, 100% { transform: scale(0.85) translateY(-22px) rotate(-14deg); opacity: 0; }
          }
          @keyframes dtShock {
            0%, 20% { opacity: 0; transform: scale(0.3); }
            32% { opacity: 0.9; }
            60%, 100% { opacity: 0; transform: scale(1.6); }
          }
          .dt-heart-group { transform-origin: 80px 80px; animation: dtHeartPop 2.5s infinite cubic-bezier(0.175, 0.885, 0.32, 1.275); }
          .dt-shock-ring { transform-origin: 80px 80px; animation: dtShock 2.5s infinite ease-out; }
        </style>
        <filter id="tt-glow-dt" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="-3" dy="-2" stdDeviation="4" flood-color="#25f4ee" flood-opacity="0.8"/>
          <feDropShadow dx="3" dy="2" stdDeviation="4" flood-color="#fe2c55" flood-opacity="0.9"/>
        </filter>
      </defs>
      <circle class="dt-shock-ring" cx="80" cy="80" r="45" fill="none" stroke="#25f4ee" stroke-width="2.5"/>
      <g class="dt-heart-group" filter="url(#tt-glow-dt)">
        <path d="M80 110 C76 70 36 70 36 47 C36 28 60 20 80 39 C100 20 124 28 124 47 C124 70 84 70 80 110 Z" fill="#25f4ee" opacity="0.8" transform="translate(-3.5, -2)"/>
        <path d="M80 110 C76 70 36 70 36 47 C36 28 60 20 80 39 C100 20 124 28 124 47 C124 70 84 70 80 110 Z" fill="#fe2c55"/>
        <path d="M58 35 C48 38 43 46 43 54 C43 62 49 67 52 69 C49 64 48 58 51 50 C54 42 61 38 69 36 C64 35 61 35 58 35 Z" fill="#ffffff" opacity="0.5"/>
      </g>
    </svg>`,
  },
  {
    id: 'tiktok-animated-like',
    name: 'TikTok Yan Bar Beğen & 1.4M',
    category: 'tiktok',
    defaultScale: 0.35,
    isAnimated: true,
    elementAnimation: 'tiktok-like',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 150" width="120" height="150">
      <defs>
        <style>
          @keyframes railLikeBounce {
            0%, 20% { transform: scale(1); fill: #ffffff; }
            28% { transform: scale(0.78); fill: #ffffff; }
            38% { transform: scale(1.42); fill: #fe2c55; }
            48% { transform: scale(0.96); fill: #fe2c55; }
            58%, 100% { transform: scale(1); fill: #fe2c55; }
          }
          @keyframes railShock {
            0%, 28% { opacity: 0; transform: scale(0.2); }
            38% { opacity: 0.9; }
            60%, 100% { opacity: 0; transform: scale(1.5); }
          }
          @keyframes railCountPulse {
            0%, 30% { transform: scale(1); fill: #ffffff; }
            38% { transform: scale(1.15); fill: #fe2c55; }
            48%, 100% { transform: scale(1); fill: #ffffff; }
          }
          .rail-like-heart { transform-origin: 60px 52px; animation: railLikeBounce 2.8s infinite cubic-bezier(0.175, 0.885, 0.32, 1.275); }
          .rail-shock-ring { transform-origin: 60px 52px; animation: railShock 2.8s infinite ease-out; }
          .rail-count-text { transform-origin: 60px 125px; animation: railCountPulse 2.8s infinite ease-out; }
        </style>
      </defs>
      <circle class="rail-shock-ring" cx="60" cy="52" r="32" fill="none" stroke="#fe2c55" stroke-width="2.5"/>
      <g class="rail-like-heart">
        <path d="M60 84 C57 54 24 54 24 36 C24 20 44 13 60 29 C76 13 96 20 96 36 C96 54 63 54 60 84 Z"/>
      </g>
      <text class="rail-count-text" x="60" y="126" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-weight="700" font-size="22" letter-spacing="0.3">1.4M</text>
    </svg>`,
  },
  {
    id: 'tiktok-animated-follow',
    name: 'TikTok Canlı Takip Et (+ ➔ ✓)',
    category: 'tiktok',
    defaultScale: 0.35,
    isAnimated: true,
    elementAnimation: 'tiktok-follow-avatar',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 160" width="140" height="160">
      <defs>
        <style>
          @keyframes ttAvatarBounce {
            0%, 25% { transform: scale(1); }
            35% { transform: scale(0.92); }
            45% { transform: scale(1.08); }
            55%, 100% { transform: scale(1); }
          }
          @keyframes ttBadgeSpin {
            0%, 25% { transform: scale(1) rotate(0deg); fill: #fe2c55; }
            35% { transform: scale(0.2) rotate(90deg); fill: #fe2c55; }
            45% { transform: scale(1.2) rotate(90deg); fill: #27272a; }
            55%, 100% { transform: scale(1) rotate(0deg); fill: #27272a; }
          }
          @keyframes ttPlusHide {
            0%, 25% { opacity: 1; transform: scale(1); }
            32%, 100% { opacity: 0; transform: scale(0); }
          }
          @keyframes ttCheckShow {
            0%, 35% { opacity: 0; stroke-dashoffset: 24; }
            48%, 100% { opacity: 1; stroke-dashoffset: 0; }
          }
          @keyframes ttConfetti {
            0%, 30% { opacity: 0; transform: scale(0.3); }
            45% { opacity: 1; transform: scale(1.3); }
            70%, 100% { opacity: 0; transform: scale(1.8); }
          }
          .tt-av-wrap { transform-origin: 70px 65px; animation: ttAvatarBounce 3.2s infinite ease-in-out; }
          .tt-badge-base { transform-origin: 70px 125px; animation: ttBadgeSpin 3.2s infinite ease-in-out; }
          .tt-plus-g { transform-origin: 70px 125px; animation: ttPlusHide 3.2s infinite ease-in-out; }
          .tt-check-p { stroke-dasharray: 24; animation: ttCheckShow 3.2s infinite ease-in-out; }
          .tt-burst-ring { transform-origin: 70px 125px; animation: ttConfetti 3.2s infinite ease-out; }
        </style>
      </defs>
      <g class="tt-av-wrap">
        <circle cx="70" cy="65" r="50" fill="#18181b" stroke="#ffffff" stroke-width="3"/>
        <circle cx="70" cy="52" r="18" fill="#71717a"/>
        <path d="M38 96 C38 78 52 72 70 72 C88 72 102 78 102 96 Z" fill="#71717a"/>
      </g>
      <circle class="tt-burst-ring" cx="70" cy="125" r="28" fill="none" stroke="#25f4ee" stroke-width="2.5" stroke-dasharray="6 8"/>
      <circle class="tt-badge-base" cx="70" cy="125" r="20" stroke="#ffffff" stroke-width="2"/>
      <g class="tt-plus-g">
        <line x1="70" y1="114" x2="70" y2="136" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>
        <line x1="59" y1="125" x2="81" y2="125" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>
      </g>
      <path class="tt-check-p" d="M62 125 L68 131 L78 119" fill="none" stroke="#22c55e" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
  },
  {
    id: 'tiktok-animated-follow-btn',
    name: 'TikTok Takip Butonu (+ ➔ Takip Ediliyor)',
    category: 'tiktok',
    defaultScale: 0.35,
    isAnimated: true,
    elementAnimation: 'tiktok-follow-btn',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 84" width="280" height="84">
      <defs>
        <style>
          @keyframes ttBtnBgMorph {
            0%, 25% { fill: #fe2c55; stroke: #fe2c55; }
            38%, 100% { fill: #27272a; stroke: #3f3f46; }
          }
          @keyframes ttBtnPress {
            0%, 25% { transform: scale(1); }
            30% { transform: scale(0.92); }
            40% { transform: scale(1.04); }
            50%, 100% { transform: scale(1); }
          }
          @keyframes ttTxtFollow {
            0%, 25% { opacity: 1; }
            32%, 100% { opacity: 0; }
          }
          @keyframes ttTxtFollowing {
            0%, 32% { opacity: 0; }
            40%, 100% { opacity: 1; }
          }
          .btn-container { transform-origin: 140px 42px; animation: ttBtnPress 3.2s infinite ease-in-out; }
          .btn-rect { animation: ttBtnBgMorph 3.2s infinite ease-in-out; }
          .btn-lbl-follow { animation: ttTxtFollow 3.2s infinite ease-in-out; }
          .btn-lbl-following { animation: ttTxtFollowing 3.2s infinite ease-in-out; }
        </style>
      </defs>
      <g class="btn-container">
        <rect class="btn-rect" x="2" y="2" width="276" height="80" rx="40" stroke-width="2"/>
        <g class="btn-lbl-follow">
          <path d="M48 42 L66 42 M57 33 L57 51" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>
          <text x="82" y="50" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" font-weight="700" font-size="22">Takip Et</text>
        </g>
        <g class="btn-lbl-following">
          <path d="M38 42 L46 50 L60 34" fill="none" stroke="#22c55e" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
          <text x="72" y="50" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" font-weight="700" font-size="21">Takip Ediliyor</text>
        </g>
      </g>
    </svg>`,
  },
  {
    id: 'tiktok-sidebar-combo',
    name: 'TikTok Tam Yan Eylem Barı',
    category: 'tiktok',
    defaultScale: 0.35,
    isAnimated: true,
    elementAnimation: 'tiktok-combo',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 420" width="100" height="420">
      <defs>
        <style>
          @keyframes discSpin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          @keyframes heartBeatMini { 0%, 25% { transform: scale(1); } 35% { transform: scale(1.3); } 45%, 100% { transform: scale(1); } }
          .combo-heart { transform-origin: 50px 115px; animation: heartBeatMini 2.5s infinite ease-in-out; }
          .combo-disc { transform-origin: 50px 380px; animation: discSpin 4s linear infinite; }
        </style>
      </defs>
      <circle cx="50" cy="40" r="28" fill="#18181b" stroke="#ffffff" stroke-width="2.5"/>
      <circle cx="50" cy="32" r="10" fill="#71717a"/>
      <path d="M32 58 C32 46 40 43 50 43 C60 43 68 46 68 58 Z" fill="#71717a"/>
      <circle cx="50" cy="68" r="11" fill="#fe2c55" stroke="#ffffff" stroke-width="2"/>
      <line x1="50" y1="62" x2="50" y2="74" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="44" y1="68" x2="56" y2="68" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"/>
      <g class="combo-heart">
        <path d="M50 128 C48 110 30 110 30 98 C30 88 42 84 50 94 C58 84 70 88 70 98 C70 110 52 110 50 128 Z" fill="#fe2c55"/>
      </g>
      <text x="50" y="145" text-anchor="middle" fill="#ffffff" font-family="-apple-system, sans-serif" font-weight="700" font-size="13">1.4M</text>
      <path d="M50 175 C37 175 27 183 27 194 C27 200 30 206 36 209 L34 219 L46 213 C47 213 49 213 50 213 C63 213 73 205 73 194 C73 183 63 175 50 175 Z" fill="#ffffff"/>
      <circle cx="41" cy="194" r="2.5" fill="#18181b"/>
      <circle cx="50" cy="194" r="2.5" fill="#18181b"/>
      <circle cx="59" cy="194" r="2.5" fill="#18181b"/>
      <text x="50" y="233" text-anchor="middle" fill="#ffffff" font-family="-apple-system, sans-serif" font-weight="700" font-size="13">42.8K</text>
      <path d="M36 250 L64 250 L64 285 L50 274 L36 285 Z" fill="#facc15"/>
      <text x="50" y="303" text-anchor="middle" fill="#ffffff" font-family="-apple-system, sans-serif" font-weight="700" font-size="13">18.2K</text>
      <path d="M34 336 C34 322 46 314 58 314 L58 304 L76 322 L58 340 L58 330 C48 330 40 334 36 342 Z" fill="#ffffff"/>
      <text x="50" y="358" text-anchor="middle" fill="#ffffff" font-family="-apple-system, sans-serif" font-weight="700" font-size="13">9.4K</text>
      <g class="combo-disc">
        <circle cx="50" cy="392" r="22" fill="#111827" stroke="#374151" stroke-width="2.5"/>
        <circle cx="50" cy="392" r="16" fill="none" stroke="#1f2937" stroke-width="1.5"/>
        <circle cx="50" cy="392" r="8" fill="#fe2c55"/>
        <circle cx="50" cy="392" r="2.5" fill="#ffffff"/>
      </g>
    </svg>`,
  },
  {
    id: 'youtube-animated-subscribe',
    name: 'YouTube Abone Ol & Çan (Canlı)',
    category: 'youtube',
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
    category: 'instagram',
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
  // 2. TIKTOK & REELS VİRAL TRENDLERİ
  // =========================================================================
  {
    id: 'tiktok-like',
    name: 'TikTok Beğeni Kalbi',
    category: 'tiktok',
    defaultScale: 0.35,
    isAnimated: true,
    elementAnimation: 'tiktok-like',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 150" width="120" height="150">
      <defs>
        <style>
          @keyframes railLikeBounce2 {
            0%, 20% { transform: scale(1); fill: #ffffff; }
            28% { transform: scale(0.78); fill: #ffffff; }
            38% { transform: scale(1.42); fill: #fe2c55; }
            48% { transform: scale(0.96); fill: #fe2c55; }
            58%, 100% { transform: scale(1); fill: #fe2c55; }
          }
          @keyframes railShock2 {
            0%, 28% { opacity: 0; transform: scale(0.2); }
            38% { opacity: 0.9; }
            60%, 100% { opacity: 0; transform: scale(1.5); }
          }
          @keyframes railCountPulse2 {
            0%, 30% { transform: scale(1); fill: #ffffff; }
            38% { transform: scale(1.15); fill: #fe2c55; }
            48%, 100% { transform: scale(1); fill: #ffffff; }
          }
          .rail-like-heart2 { transform-origin: 60px 52px; animation: railLikeBounce2 2.8s infinite cubic-bezier(0.175, 0.885, 0.32, 1.275); }
          .rail-shock-ring2 { transform-origin: 60px 52px; animation: railShock2 2.8s infinite ease-out; }
          .rail-count-text2 { transform-origin: 60px 125px; animation: railCountPulse2 2.8s infinite ease-out; }
        </style>
      </defs>
      <circle class="rail-shock-ring2" cx="60" cy="52" r="32" fill="none" stroke="#fe2c55" stroke-width="2.5"/>
      <g class="rail-like-heart2">
        <path d="M60 84 C57 54 24 54 24 36 C24 20 44 13 60 29 C76 13 96 20 96 36 C96 54 63 54 60 84 Z"/>
      </g>
      <text class="rail-count-text2" x="60" y="126" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-weight="700" font-size="22" letter-spacing="0.3">1.4M</text>
    </svg>`,
  },
  {
    id: 'tiktok-double-tap-heart',
    name: 'TikTok Çift Tıkla Kalp',
    category: 'tiktok',
    defaultScale: 0.38,
    isAnimated: true,
    elementAnimation: 'tiktok-double-tap',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
      <defs>
        <style>
          @keyframes dtHeartPop2 {
            0%, 15% { transform: scale(0.2) rotate(-14deg); opacity: 0; }
            28% { transform: scale(1.32) rotate(-14deg); opacity: 1; }
            38% { transform: scale(1.0) rotate(-14deg); opacity: 1; }
            70% { transform: scale(1.04) translateY(-8px) rotate(-14deg); opacity: 1; }
            88%, 100% { transform: scale(0.85) translateY(-22px) rotate(-14deg); opacity: 0; }
          }
          @keyframes dtShock2 {
            0%, 20% { opacity: 0; transform: scale(0.3); }
            32% { opacity: 0.9; }
            60%, 100% { opacity: 0; transform: scale(1.6); }
          }
          .dt-heart-group2 { transform-origin: 80px 80px; animation: dtHeartPop2 2.5s infinite cubic-bezier(0.175, 0.885, 0.32, 1.275); }
          .dt-shock-ring2 { transform-origin: 80px 80px; animation: dtShock2 2.5s infinite ease-out; }
        </style>
        <filter id="tt-glow-dt2" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="-3" dy="-2" stdDeviation="4" flood-color="#25f4ee" flood-opacity="0.8"/>
          <feDropShadow dx="3" dy="2" stdDeviation="4" flood-color="#fe2c55" flood-opacity="0.9"/>
        </filter>
      </defs>
      <circle class="dt-shock-ring2" cx="80" cy="80" r="45" fill="none" stroke="#25f4ee" stroke-width="2.5"/>
      <g class="dt-heart-group2" filter="url(#tt-glow-dt2)">
        <path d="M80 110 C76 70 36 70 36 47 C36 28 60 20 80 39 C100 20 124 28 124 47 C124 70 84 70 80 110 Z" fill="#25f4ee" opacity="0.8" transform="translate(-3.5, -2)"/>
        <path d="M80 110 C76 70 36 70 36 47 C36 28 60 20 80 39 C100 20 124 28 124 47 C124 70 84 70 80 110 Z" fill="#fe2c55"/>
        <path d="M58 35 C48 38 43 46 43 54 C43 62 49 67 52 69 C49 64 48 58 51 50 C54 42 61 38 69 36 C64 35 61 35 58 35 Z" fill="#ffffff" opacity="0.5"/>
      </g>
    </svg>`,
  },
  {
    id: 'tiktok-like-counter',
    name: 'TikTok Beğeni Sayacı (842.5K)',
    category: 'tiktok',
    defaultScale: 0.3,
    isAnimated: true,
    elementAnimation: 'tiktok-like',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 150" width="120" height="150">
      <defs>
        <filter id="tt-icon-glow">
          <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#fe2c55" flood-opacity="0.6"/>
        </filter>
      </defs>
      <g transform="translate(60, 50) scale(1.1)" filter="url(#tt-icon-glow)">
        <path d="M0 24 C-3 -3 -32 -3 -32 -18 C-32 -30 -16 -36 0 -24 C16 -36 32 -30 32 -18 C32 -3 3 -3 0 24 Z" fill="#fe2c55"/>
      </g>
      <text x="60" y="125" text-anchor="middle" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-weight="700" font-size="22" letter-spacing="0.3">842.5K</text>
    </svg>`,
  },
  {
    id: 'tiktok-comment',
    name: 'TikTok Yorum İkonu & 42.8K',
    category: 'tiktok',
    defaultScale: 0.32,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 150" width="120" height="150">
      <path d="M60 22 C38 22 20 36 20 54 C20 64 26 73 36 78 L32 94 L52 85 C55 86 57 86 60 86 C82 86 100 72 100 54 C100 36 82 22 60 22 Z" fill="#ffffff"/>
      <circle cx="44" cy="54" r="4.5" fill="#18181b"/>
      <circle cx="60" cy="54" r="4.5" fill="#18181b"/>
      <circle cx="76" cy="54" r="4.5" fill="#18181b"/>
      <text x="60" y="125" text-anchor="middle" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-weight="700" font-size="22">42.8K</text>
    </svg>`,
  },
  {
    id: 'tiktok-repost',
    name: 'TikTok Yeniden Paylaş Rozeti',
    category: 'tiktok',
    defaultScale: 0.32,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 150" width="120" height="150">
      <circle cx="60" cy="54" r="32" fill="#facc15"/>
      <path d="M46 50 L60 36 L74 50 M60 38 L60 70 M74 58 L60 72 L46 58" fill="none" stroke="#000000" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
      <text x="60" y="125" text-anchor="middle" fill="#facc15" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-weight="700" font-size="20">14.6K</text>
    </svg>`,
  },
  {
    id: 'tiktok-follow-plus',
    name: 'TikTok Takip Et (+ ➔ ✓)',
    category: 'tiktok',
    defaultScale: 0.32,
    isAnimated: true,
    elementAnimation: 'tiktok-follow-avatar',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 160" width="140" height="160">
      <defs>
        <style>
          @keyframes ttAvatarBounce3 {
            0%, 25% { transform: scale(1); }
            35% { transform: scale(0.92); }
            45% { transform: scale(1.08); }
            55%, 100% { transform: scale(1); }
          }
          @keyframes ttBadgeSpin3 {
            0%, 25% { transform: scale(1) rotate(0deg); fill: #fe2c55; }
            35% { transform: scale(0.2) rotate(90deg); fill: #fe2c55; }
            45% { transform: scale(1.2) rotate(90deg); fill: #27272a; }
            55%, 100% { transform: scale(1) rotate(0deg); fill: #27272a; }
          }
          @keyframes ttPlusHide3 {
            0%, 25% { opacity: 1; transform: scale(1); }
            32%, 100% { opacity: 0; transform: scale(0); }
          }
          @keyframes ttCheckShow3 {
            0%, 35% { opacity: 0; stroke-dashoffset: 24; }
            48%, 100% { opacity: 1; stroke-dashoffset: 0; }
          }
          .tt-av-wrap3 { transform-origin: 70px 65px; animation: ttAvatarBounce3 3.2s infinite ease-in-out; }
          .tt-badge-base3 { transform-origin: 70px 125px; animation: ttBadgeSpin3 3.2s infinite ease-in-out; }
          .tt-plus-g3 { transform-origin: 70px 125px; animation: ttPlusHide3 3.2s infinite ease-in-out; }
          .tt-check-p3 { stroke-dasharray: 24; animation: ttCheckShow3 3.2s infinite ease-in-out; }
        </style>
      </defs>
      <g class="tt-av-wrap3">
        <circle cx="70" cy="65" r="50" fill="#18181b" stroke="#ffffff" stroke-width="3"/>
        <circle cx="70" cy="52" r="18" fill="#71717a"/>
        <path d="M38 96 C38 78 52 72 70 72 C88 72 102 78 102 96 Z" fill="#71717a"/>
      </g>
      <circle class="tt-badge-base3" cx="70" cy="125" r="20" stroke="#ffffff" stroke-width="2"/>
      <g class="tt-plus-g3">
        <line x1="70" y1="114" x2="70" y2="136" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>
        <line x1="59" y1="125" x2="81" y2="125" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>
      </g>
      <path class="tt-check-p3" d="M62 125 L68 131 L78 119" fill="none" stroke="#22c55e" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
  },
  {
    id: 'tiktok-follow-btn',
    name: 'TikTok Profil Takip Butonu',
    category: 'tiktok',
    defaultScale: 0.35,
    isAnimated: true,
    elementAnimation: 'tiktok-follow-btn',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 84" width="280" height="84">
      <defs>
        <style>
          @keyframes ttBtnBgMorph2 {
            0%, 25% { fill: #fe2c55; stroke: #fe2c55; }
            38%, 100% { fill: #27272a; stroke: #3f3f46; }
          }
          @keyframes ttBtnPress2 {
            0%, 25% { transform: scale(1); }
            30% { transform: scale(0.92); }
            40% { transform: scale(1.04); }
            50%, 100% { transform: scale(1); }
          }
          @keyframes ttTxtFollow2 {
            0%, 25% { opacity: 1; }
            32%, 100% { opacity: 0; }
          }
          @keyframes ttTxtFollowing2 {
            0%, 32% { opacity: 0; }
            40%, 100% { opacity: 1; }
          }
          .btn-container2 { transform-origin: 140px 42px; animation: ttBtnPress2 3.2s infinite ease-in-out; }
          .btn-rect2 { animation: ttBtnBgMorph2 3.2s infinite ease-in-out; }
          .btn-lbl-follow2 { animation: ttTxtFollow2 3.2s infinite ease-in-out; }
          .btn-lbl-following2 { animation: ttTxtFollowing2 3.2s infinite ease-in-out; }
        </style>
      </defs>
      <g class="btn-container2">
        <rect class="btn-rect2" x="2" y="2" width="276" height="80" rx="40" stroke-width="2"/>
        <g class="btn-lbl-follow2">
          <path d="M48 42 L66 42 M57 33 L57 51" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>
          <text x="82" y="50" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" font-weight="700" font-size="22">Takip Et</text>
        </g>
        <g class="btn-lbl-following2">
          <path d="M38 42 L46 50 L60 34" fill="none" stroke="#22c55e" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
          <text x="72" y="50" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" font-weight="700" font-size="21">Takip Ediliyor</text>
        </g>
      </g>
    </svg>`,
  },
  {
    id: 'tiktok-share-arrow',
    name: 'TikTok Paylaş Oku & Sayacı',
    category: 'tiktok',
    defaultScale: 0.32,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 150" width="120" height="150">
      <path d="M36 68 C36 44 56 32 76 32 L76 16 L104 44 L76 72 L76 56 C60 56 48 62 42 74 Z" fill="#ffffff"/>
      <text x="60" y="125" text-anchor="middle" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-weight="700" font-size="22">9.4K</text>
    </svg>`,
  },
  {
    id: 'tiktok-sound-disc',
    name: 'TikTok Dönen Müzik Plak',
    category: 'tiktok',
    defaultScale: 0.3,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
      <defs>
        <style>
          @keyframes discRotate { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          .disc-spin-group { transform-origin: 80px 80px; animation: discRotate 4s linear infinite; }
        </style>
      </defs>
      <g class="disc-spin-group">
        <circle cx="80" cy="80" r="70" fill="#111827" stroke="#374151" stroke-width="4"/>
        <circle cx="80" cy="80" r="50" fill="none" stroke="#1f2937" stroke-width="3"/>
        <circle cx="80" cy="80" r="28" fill="#fe2c55"/>
        <circle cx="80" cy="80" r="8" fill="#ffffff"/>
      </g>
      <path d="M125 40 Q135 25 145 35 Q135 45 125 40 Z" fill="#25f4ee"/>
    </svg>`,
  },
  {
    id: 'tiktok-bookmark',
    name: 'TikTok Kaydet Rozeti',
    category: 'tiktok',
    defaultScale: 0.32,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 150" width="120" height="150">
      <path d="M38 28 L82 28 L82 82 L60 66 L38 82 Z" fill="#facc15"/>
      <text x="60" y="125" text-anchor="middle" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-weight="700" font-size="22">18.2K</text>
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
