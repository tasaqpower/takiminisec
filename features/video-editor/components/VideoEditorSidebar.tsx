import React, { useState, useRef } from 'react';
import { VideoProject, MediaAsset, VideoClip, TransitionType, ClipEffects, TextLayerData } from '../types';
import { saveAssetBlob } from '../db';
import { audioMixer } from '../engine/audioMixer';
import { generateCoverThumbnail } from '../engine/thumbnailGenerator';
import { BUILTIN_SFX_LIST, playSfxPreview, generateSfxBlob, SfxType } from '../engine/sfxGenerator';
import { COLOR_PRESETS } from '../engine/filterEngine';
import { TRANSITION_DEFINITIONS } from '../engine/transitionEngine';
import { TEXT_STYLE_PRESETS } from '../engine/textRasterizer';

interface ElementPreset {
  id: string;
  name: string;
  category: 'social' | 'arrows' | 'shapes' | 'emojis';
  svg?: string;
  char?: string;
  icon: string;
}

const ELEMENT_PRESETS: ElementPreset[] = [
  // Sosyal Medya
  {
    id: 'yt-sub',
    name: 'YouTube Abone Ol',
    category: 'social',
    icon: '🔴',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 100" width="360" height="100">
      <rect width="360" height="100" rx="50" fill="#FF0000"/>
      <path d="M45 28 L45 72 L85 50 Z" fill="#FFFFFF"/>
      <text x="105" y="62" fill="#FFFFFF" font-family="Arial, sans-serif" font-weight="900" font-size="28">ABONE OL</text>
      <path d="M305 38 C305 32 298 27 292 27 C286 27 279 32 279 38 L279 55 L270 64 L314 64 L305 55 Z M292 75 C295 75 297 73 297 70 L287 70 C287 73 289 75 292 75 Z" fill="#FFFFFF"/>
    </svg>`,
  },
  {
    id: 'ig-follow',
    name: 'Instagram Takip Et',
    category: 'social',
    icon: '📸',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 100" width="360" height="100">
      <defs>
        <linearGradient id="ig" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#833ab4"/>
          <stop offset="50%" stop-color="#fd1d1d"/>
          <stop offset="100%" stop-color="#fcb045"/>
        </linearGradient>
      </defs>
      <rect width="360" height="100" rx="50" fill="url(#ig)"/>
      <rect x="35" y="27" width="46" height="46" rx="13" fill="none" stroke="#FFFFFF" stroke-width="4.5"/>
      <circle cx="58" cy="50" r="12" fill="none" stroke="#FFFFFF" stroke-width="4.5"/>
      <circle cx="69" cy="38" r="3" fill="#FFFFFF"/>
      <text x="100" y="61" fill="#FFFFFF" font-family="Arial, sans-serif" font-weight="800" font-size="28">TAKİP ET</text>
    </svg>`,
  },
  {
    id: 'like-thumbs',
    name: 'Beğen (Like)',
    category: 'social',
    icon: '👍',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 100" width="280" height="100">
      <rect width="280" height="100" rx="50" fill="#2563EB"/>
      <path d="M42 54 L42 76 L55 76 L55 54 Z M62 54 L62 76 L86 76 C89 76 91 74 92 72 L99 56 C100 54 99 51 96 51 L79 51 L82 38 C82 34 78 31 75 31 L72 33 L62 50 Z" fill="#FFFFFF"/>
      <text x="115" y="62" fill="#FFFFFF" font-family="Arial, sans-serif" font-weight="800" font-size="30">BEĞEN</text>
    </svg>`,
  },
  {
    id: 'tiktok-heart',
    name: 'TikTok Beğen',
    category: 'social',
    icon: '🖤',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 100" width="280" height="100">
      <rect width="280" height="100" rx="50" fill="#000000" stroke="#00f2fe" stroke-width="3"/>
      <path d="M52 36 C45 27 33 29 29 38 C24 52 44 67 52 73 C60 67 80 52 75 38 C71 29 59 27 52 36 Z" fill="#FF0050"/>
      <text x="92" y="61" fill="#FFFFFF" font-family="Arial, sans-serif" font-weight="800" font-size="28">BEĞEN</text>
    </svg>`,
  },
  // Oklar & Vurgular
  {
    id: 'red-arrow-right',
    name: 'Kırmızı Dikkat Oku',
    category: 'arrows',
    icon: '➡️',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 120" width="220" height="120">
      <path d="M15 42 L130 42 L130 15 L205 60 L130 105 L130 78 L15 78 Z" fill="#EF4444" stroke="#FFFFFF" stroke-width="5"/>
    </svg>`,
  },
  {
    id: 'yellow-arrow-down',
    name: 'Sarı İkaz Oku',
    category: 'arrows',
    icon: '⬇️',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 200" width="120" height="200">
      <path d="M42 15 L78 15 L78 125 L105 125 L60 185 L15 125 L42 125 Z" fill="#EAB308" stroke="#000000" stroke-width="5"/>
    </svg>`,
  },
  {
    id: 'red-circle-target',
    name: 'Kırmızı Odak Çemberi',
    category: 'arrows',
    icon: '🎯',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
      <circle cx="90" cy="90" r="70" fill="none" stroke="#EF4444" stroke-width="10" stroke-dasharray="12 8"/>
      <circle cx="90" cy="90" r="18" fill="#EF4444"/>
    </svg>`,
  },
  // Şekiller & Rozetler
  {
    id: 'speech-bubble',
    name: 'Konuşma Balonu',
    category: 'shapes',
    icon: '💬',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 160" width="260" height="160">
      <path d="M25 15 C12 15 10 28 10 40 L10 95 C10 108 22 115 35 115 L80 115 L95 145 L125 115 L225 115 C238 115 250 108 250 95 L250 40 C250 28 238 15 225 15 Z" fill="#FFFFFF" stroke="#374151" stroke-width="5"/>
      <text x="130" y="75" text-anchor="middle" fill="#111827" font-family="Arial, sans-serif" font-weight="bold" font-size="22">BURAYA BAK!</text>
    </svg>`,
  },
  {
    id: 'gold-star',
    name: 'Altın Yıldız',
    category: 'shapes',
    icon: '⭐',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
      <polygon points="90,10 114,62 171,66 128,103 142,160 90,129 38,160 52,103 9,66 66,62" fill="#FBBF24" stroke="#D97706" stroke-width="5"/>
    </svg>`,
  },
  {
    id: 'warning-triangle',
    name: 'Uyarı Levhası',
    category: 'shapes',
    icon: '⚠️',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 160" width="180" height="160">
      <polygon points="90,12 172,148 8,148" fill="#F59E0B" stroke="#000000" stroke-width="7"/>
      <rect x="85" y="58" width="10" height="44" rx="5" fill="#000000"/>
      <circle cx="90" cy="124" r="7" fill="#000000"/>
    </svg>`,
  },
  // Emojiler
  { id: 'emoji-fire', name: 'Alev (Fire)', category: 'emojis', char: '🔥', icon: '🔥' },
  { id: 'emoji-rocket', name: 'Roket (Rocket)', category: 'emojis', char: '🚀', icon: '🚀' },
  { id: 'emoji-100', name: 'Yüz Puan (100)', category: 'emojis', char: '💯', icon: '💯' },
  { id: 'emoji-shock', name: 'Şok (Shock)', category: 'emojis', char: '😱', icon: '😱' },
  { id: 'emoji-clap', name: 'Alkış (Clap)', category: 'emojis', char: '👏', icon: '👏' },
  { id: 'emoji-party', name: 'Kutlama (Party)', category: 'emojis', char: '🎉', icon: '🎉' },
];

async function createSvgAssetBlob(svgString: string): Promise<Blob> {
  return new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
}

async function createEmojiAssetBlob(emojiChar: string): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.font = '160px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emojiChar, 128, 138);
  }
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b || new Blob([], { type: 'image/png' })), 'image/png');
  });
}

function parseSrt(srtContent: string): { start: number; duration: number; text: string }[] {
  const items: { start: number; duration: number; text: string }[] = [];
  const blocks = srtContent.replace(/\r\n/g, '\n').split(/\n\s*\n/);

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 2) continue;

    const timeLine = lines.find((l) => l.includes('-->'));
    if (!timeLine) continue;

    const [startStr, endStr] = timeLine.split('-->').map((s) => s.trim());
    const parseSec = (t: string) => {
      const [hms, ms] = t.split(/[,.]/);
      const parts = hms.split(':').map(Number);
      return parts[0] * 3600 + parts[1] * 60 + parts[2] + (Number(ms) || 0) / 1000;
    };

    const start = parseSec(startStr);
    const end = parseSec(endStr);
    const textLines = lines.slice(lines.indexOf(timeLine) + 1).join('\n');

    if (!isNaN(start) && !isNaN(end) && end > start && textLines.trim()) {
      items.push({ start, duration: end - start, text: textLines.trim() });
    }
  }
  return items;
}

function exportSrt(project: VideoProject): string {
  const textClips = project.tracks
    .filter((t) => t.type === 'text' || t.type === 'subtitle')
    .flatMap((t) => t.clips)
    .filter((c) => c.textData?.text)
    .sort((a, b) => a.startTime - b.startTime);

  const formatSrtTime = (seconds: number) => {
    const s = Math.max(0, seconds);
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = Math.floor(s % 60);
    const ms = Math.floor((s % 1) * 1000);
    const pad = (n: number, z = 2) => n.toString().padStart(z, '0');
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)},${pad(ms, 3)}`;
  };

  return textClips
    .map((c, i) => {
      const start = formatSrtTime(c.startTime);
      const end = formatSrtTime(c.startTime + c.duration);
      return `${i + 1}\n${start} --> ${end}\n${c.textData?.text}\n`;
    })
    .join('\n');
}

interface StockMediaPreset {
  id: string;
  name: string;
  category: 'intro' | 'motion' | 'tech' | 'nature';
  tag: string;
  icon: string;
  duration: number;
  previewBg: string;
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
}

const STOCK_MEDIA_PRESETS: StockMediaPreset[] = [
  {
    id: 'countdown-intro',
    name: '5 Sn Sinematik Geri Sayım',
    category: 'intro',
    tag: 'İntro',
    icon: '⏳',
    duration: 5,
    previewBg: '#090d16',
    draw: (ctx, w, h) => {
      const grad = ctx.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, w / 1.5);
      grad.addColorStop(0, '#1e1b4b');
      grad.addColorStop(0.7, '#0f172a');
      grad.addColorStop(1, '#020617');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = 'rgba(234, 179, 8, 0.4)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 280, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(234, 179, 8, 0.2)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 340, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(234, 179, 8, 0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(w / 2 - 380, h / 2);
      ctx.lineTo(w / 2 + 380, h / 2);
      ctx.moveTo(w / 2, h / 2 - 380);
      ctx.lineTo(w / 2, h / 2 + 380);
      ctx.stroke();

      ctx.fillStyle = '#fbbf24';
      ctx.font = '900 180px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('5', w / 2, h / 2 - 10);

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 36px sans-serif';
      ctx.fillText('BAŞLIYOR', w / 2, h / 2 + 150);
    },
  },
  {
    id: 'deep-space',
    name: 'Kozmik Galaksi & Yıldızlar',
    category: 'motion',
    tag: 'Uzay',
    icon: '🌌',
    duration: 6,
    previewBg: '#0b001a',
    draw: (ctx, w, h) => {
      const grad = ctx.createRadialGradient(w * 0.3, h * 0.4, 80, w / 2, h / 2, w);
      grad.addColorStop(0, '#581c87');
      grad.addColorStop(0.4, '#1e1b4b');
      grad.addColorStop(0.8, '#090514');
      grad.addColorStop(1, '#000000');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      for (let i = 0; i < 220; i++) {
        const x = (Math.sin(i * 99) * 0.5 + 0.5) * w;
        const y = (Math.cos(i * 33) * 0.5 + 0.5) * h;
        const r = (i % 3 === 0) ? 2.5 : (i % 2 === 0 ? 1.5 : 0.8);
        ctx.fillStyle = i % 5 === 0 ? '#38bdf8' : (i % 4 === 0 ? '#f472b6' : '#ffffff');
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 44px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('KOZMİK UZAY & NEBULA', w / 2, h / 2);
    },
  },
  {
    id: 'cyber-tech',
    name: 'Matrix Siber Ağ & Kod',
    category: 'tech',
    tag: 'Siber',
    icon: '💻',
    duration: 5,
    previewBg: '#021814',
    draw: (ctx, w, h) => {
      ctx.fillStyle = '#020d0a';
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = 'rgba(16, 185, 129, 0.15)';
      ctx.lineWidth = 1;
      const step = 60;
      for (let x = 0; x < w; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      for (let i = 0; i < 25; i++) {
        const nx = Math.floor((Math.sin(i * 17) * 0.5 + 0.5) * (w / step)) * step;
        const ny = Math.floor((Math.cos(i * 23) * 0.5 + 0.5) * (h / step)) * step;
        ctx.fillStyle = '#34d399';
        ctx.beginPath();
        ctx.arc(nx, ny, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = '#10b981';
      ctx.font = '900 48px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('< CYBER MATRIX PROTOCOL />', w / 2, h / 2);
    },
  },
  {
    id: 'ocean-waves',
    name: 'Okyanus & Sakin Gün Batımı',
    category: 'nature',
    tag: 'Doğa',
    icon: '🌊',
    duration: 6,
    previewBg: '#0c4a6e',
    draw: (ctx, w, h) => {
      const sky = ctx.createLinearGradient(0, 0, 0, h * 0.65);
      sky.addColorStop(0, '#f97316');
      sky.addColorStop(0.5, '#fb923c');
      sky.addColorStop(1, '#fed7aa');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h * 0.65);

      ctx.fillStyle = '#fff7ed';
      ctx.beginPath();
      ctx.arc(w / 2, h * 0.45, 90, 0, Math.PI * 2);
      ctx.fill();

      const sea = ctx.createLinearGradient(0, h * 0.65, 0, h);
      sea.addColorStop(0, '#0284c7');
      sea.addColorStop(1, '#082f49');
      ctx.fillStyle = sea;
      ctx.fillRect(0, h * 0.65, w, h * 0.35);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      for (let y = h * 0.7; y < h; y += 40) {
        ctx.fillRect(w * 0.2, y, w * 0.6, 3);
      }

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 44px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('OKYANUS VE SAKİNLİK', w / 2, h * 0.3);
    },
  },
  {
    id: 'celebration-confetti',
    name: 'Kutlama & Renkli Konfeti',
    category: 'intro',
    tag: 'Kutlama',
    icon: '🎆',
    duration: 5,
    previewBg: '#1e1035',
    draw: (ctx, w, h) => {
      const bg = ctx.createRadialGradient(w / 2, h / 2, 100, w / 2, h / 2, w * 0.8);
      bg.addColorStop(0, '#3b0764');
      bg.addColorStop(1, '#090111');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      const colors = ['#f43f5e', '#ec4899', '#a855f7', '#3b82f6', '#10b981', '#f59e0b', '#facc15'];
      for (let i = 0; i < 180; i++) {
        const cx = (Math.sin(i * 47) * 0.5 + 0.5) * w;
        const cy = (Math.cos(i * 61) * 0.5 + 0.5) * h;
        const rot = (i * 37) % 360;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate((rot * Math.PI) / 180);
        ctx.fillStyle = colors[i % colors.length];
        ctx.fillRect(-8, -4, 16, 8);
        ctx.restore();
      }

      ctx.fillStyle = '#fef08a';
      ctx.font = '900 52px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🎉 TEBRİKLER & KUTLAMA 🎉', w / 2, h / 2);
    },
  },
  {
    id: 'tiktok-reels-916',
    name: '9:16 Dikey Neon Reels Zemin',
    category: 'motion',
    tag: 'Dikey 9:16',
    icon: '📱',
    duration: 6,
    previewBg: '#0f172a',
    draw: (ctx, w, h) => {
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, w, h);

      const vWidth = h * (9 / 16);
      const startX = (w - vWidth) / 2;

      const grad = ctx.createLinearGradient(startX, 0, startX + vWidth, h);
      grad.addColorStop(0, '#ec4899');
      grad.addColorStop(0.5, '#8b5cf6');
      grad.addColorStop(1, '#3b82f6');
      ctx.fillStyle = grad;
      ctx.fillRect(startX, 0, vWidth, h);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.fillRect(startX + 20, 20, vWidth - 40, h - 40);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 38px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('REELS & TIKTOK 9:16', w / 2, h / 2);
    },
  },
];

interface ColorPresetItem {
  name: string;
  color: string;
  category: 'chroma' | 'solid' | 'gradient';
  desc: string;
}

const COLOR_PRESETS_LIST: ColorPresetItem[] = [
  // Chroma Key
  { name: 'Yeşil Perde', color: '#00ff00', category: 'chroma', desc: 'Chroma Key Yeşil Ekran' },
  { name: 'Mavi Perde', color: '#0000ff', category: 'chroma', desc: 'Chroma Key Mavi Ekran' },
  // Solid
  { name: 'Sinematik Siyah', color: '#050505', category: 'solid', desc: 'Saf Siyah Zemin' },
  { name: 'Stüdyo Beyaz', color: '#ffffff', category: 'solid', desc: 'Saf Beyaz Zemin' },
  { name: 'Koyu Mavi', color: '#1e293b', category: 'solid', desc: 'Slate Blue' },
  { name: 'Tutku Kırmızı', color: '#881337', category: 'solid', desc: 'Deep Crimson' },
  { name: 'Zümrüt Yeşil', color: '#064e3b', category: 'solid', desc: 'Emerald' },
  { name: 'Mor Gece', color: '#3b0764', category: 'solid', desc: 'Deep Violet' },
  // Gradients
  { name: 'Neon Günbatımı', color: 'linear-gradient(135deg, #f97316, #ec4899)', category: 'gradient', desc: 'Turuncu -> Pembe' },
  { name: 'Kozmik Mor', color: 'linear-gradient(135deg, #4f46e5, #06b6d4)', category: 'gradient', desc: 'İndigo -> Camgöbeği' },
  { name: 'Siber Ateş', color: 'linear-gradient(135deg, #f12711, #f5af19)', category: 'gradient', desc: 'Ateş Kırmızısı' },
  { name: 'Kuzey Işıkları', color: 'linear-gradient(135deg, #00f2fe, #4facfe)', category: 'gradient', desc: 'Neon Turkuaz' },
];

interface SidebarProps {
  project: VideoProject;
  onAddClip: (trackId: string, clipData: Partial<VideoClip>) => VideoClip;
  onAddTextClip: (
    trackId: string,
    text: string,
    startTime?: number,
    duration?: number,
    initialData?: Partial<TextLayerData>
  ) => void;
  onAddTrack: (type: 'video' | 'audio' | 'text' | 'subtitle', name?: string) => void;
  onSetBackgroundColor: (color: string) => void;
  onSetDuration: (duration: number) => void;
  currentTime: number;
  selectedClipId?: string | null;
  onSelectClip?: (clipId: string | null) => void;
  onPreviewAnimation?: (target: string | number, duration?: number) => void;
  onUpdateClipEffects?: (clipId: string, effects: Partial<ClipEffects>) => void;
  onUpdateClip?: (clipId: string, updates: Partial<VideoClip>) => void;
}

type TabType = 'media' | 'text' | 'audio' | 'transitions' | 'filters' | 'subtitles' | 'elements' | 'settings';

export const VideoEditorSidebar: React.FC<SidebarProps> = ({
  project,
  onAddClip,
  onAddTextClip,
  onAddTrack,
  onSetBackgroundColor,
  onSetDuration,
  currentTime,
  selectedClipId,
  onSelectClip,
  onPreviewAnimation,
  onUpdateClipEffects,
  onUpdateClip,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('media');
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [isRecordingScreen, setIsRecordingScreen] = useState(false);
  const [isRecordingWebcam, setIsRecordingWebcam] = useState(false);
  const [isUrlInputOpen, setIsUrlInputOpen] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [isUrlLoading, setIsUrlLoading] = useState(false);
  const [customColor, setCustomColor] = useState('#4f46e5');
  const [mediaSubTab, setMediaSubTab] = useState<'all' | 'stock' | 'colors' | 'uploads'>('all');
  const [assetFilter, setAssetFilter] = useState<'all' | 'video' | 'audio' | 'image'>('all');
  const [assetSearch, setAssetSearch] = useState('');

  const [sfxCategory, setSfxCategory] = useState<'all' | 'sfx' | 'bgm'>('all');
  const [elementsCategory, setElementsCategory] = useState<'all' | 'social' | 'arrows' | 'shapes' | 'emojis'>('all');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [addingSfxId, setAddingSfxId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const srtInputRef = useRef<HTMLInputElement>(null);
  const screenRecRef = useRef<MediaRecorder | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const webcamRecRef = useRef<MediaRecorder | null>(null);
  const webcamStreamRef = useRef<MediaStream | null>(null);

  // Find suitable track
  const findTrack = (type: 'video' | 'audio' | 'text' | 'subtitle') => {
    const t = project.tracks.find((track) => track.type === type && !track.locked);
    if (t) return t.id;
    if (type === 'text' || type === 'subtitle') {
      return '';
    }
    return project.tracks[0]?.id || '';
  };

  // Handle local file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isVideo = file.type.startsWith('video');
      const isAudio = file.type.startsWith('audio');
      const isImage = file.type.startsWith('image');

      if (!isVideo && !isAudio && !isImage) continue;

      const assetId = 'asset-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
      await saveAssetBlob(assetId, file);

      let duration = 5;
      let width: number | undefined;
      let height: number | undefined;
      let thumbnailUrl: string | undefined;

      const objectUrl = URL.createObjectURL(file);

      if (isVideo) {
        const v = document.createElement('video');
        v.preload = 'metadata';
        v.src = objectUrl;
        await new Promise<void>((res) => {
          v.onloadedmetadata = () => {
            duration = v.duration || 5;
            width = v.videoWidth;
            height = v.videoHeight;
            res();
          };
          v.onerror = () => res();
        });

        // Generate thumbnail
        const thumb = await generateCoverThumbnail(file, 1.0);
        if (thumb) thumbnailUrl = thumb;
      } else if (isAudio) {
        const a = document.createElement('audio');
        a.preload = 'metadata';
        a.src = objectUrl;
        await new Promise<void>((res) => {
          a.onloadedmetadata = () => {
            duration = a.duration || 5;
            res();
          };
          a.onerror = () => res();
        });
      } else if (isImage) {
        const img = new Image();
        img.src = objectUrl;
        await new Promise<void>((res) => {
          img.onload = () => {
            width = img.width;
            height = img.height;
            res();
          };
          img.onerror = () => res();
        });
        thumbnailUrl = objectUrl;
      }

      const newAsset: MediaAsset = {
        id: assetId,
        name: file.name,
        type: isVideo ? 'video' : isAudio ? 'audio' : 'image',
        mimeType: file.type,
        size: file.size,
        duration,
        width,
        height,
        thumbnailUrl,
        blob: file,
      };

      setAssets((prev) => [newAsset, ...prev]);

      // Automatically add to timeline
      const targetType = isVideo ? 'video' : isAudio ? 'audio' : 'video';
      const targetTrackId = findTrack(targetType);

      onAddClip(targetTrackId, {
        assetId: newAsset.id,
        name: newAsset.name,
        type: newAsset.type,
        sourceUrl: objectUrl,
        startTime: currentTime,
        duration: isImage ? 4 : duration,
        sourceDuration: duration,
        trimIn: 0,
        trimOut: isImage ? 4 : duration,
      });
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Add color / gradient asset
  const addDemoColorClip = (name: string, color: string) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d')!;

    if (color.startsWith('linear-gradient')) {
      const grad = ctx.createLinearGradient(0, 0, 1920, 1080);
      const matches = color.match(/#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)/g);
      if (matches && matches.length >= 2) {
        matches.forEach((c, idx) => {
          grad.addColorStop(idx / (matches.length - 1), c);
        });
        ctx.fillStyle = grad;
      } else {
        ctx.fillStyle = '#1e1b4b';
      }
    } else {
      ctx.fillStyle = color;
    }
    ctx.fillRect(0, 0, 1920, 1080);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 72px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, 960, 540);

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const assetId = 'asset-color-' + Date.now();
      await saveAssetBlob(assetId, blob);
      const url = URL.createObjectURL(blob);

      const newAsset: MediaAsset = {
        id: assetId,
        name: `${name} (Arka Plan)`,
        type: 'image',
        mimeType: 'image/png',
        size: blob.size,
        duration: 5,
        thumbnailUrl: url,
        url,
        blob,
      };
      setAssets((prev) => [newAsset, ...prev]);

      const targetTrackId = findTrack('video');
      onAddClip(targetTrackId, {
        assetId,
        name: `${name} (Arka Plan)`,
        type: 'image',
        sourceUrl: url,
        startTime: currentTime,
        duration: 5,
        sourceDuration: 5,
        trimIn: 0,
        trimOut: 5,
      });
      setStatusBanner(`🎨 "${name}" arka plan katmanı eklendi!`);
      setTimeout(() => setStatusBanner(null), 3000);
    }, 'image/png');
  };

  // Add stock media preset clip
  const addStockMediaClip = (preset: (typeof STOCK_MEDIA_PRESETS)[0]) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d')!;
    preset.draw(ctx, 1920, 1080);

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const assetId = 'stock-' + preset.id + '-' + Date.now();
      await saveAssetBlob(assetId, blob);
      const url = URL.createObjectURL(blob);

      const newAsset: MediaAsset = {
        id: assetId,
        name: `${preset.name}`,
        type: 'image',
        mimeType: 'image/png',
        size: blob.size,
        duration: preset.duration,
        thumbnailUrl: url,
        url,
        blob,
      };
      setAssets((prev) => [newAsset, ...prev]);

      const targetTrackId = findTrack('video');
      onAddClip(targetTrackId, {
        assetId,
        name: preset.name,
        type: 'image',
        sourceUrl: url,
        startTime: currentTime,
        duration: preset.duration,
        sourceDuration: preset.duration,
        trimIn: 0,
        trimOut: preset.duration,
      });
      setStatusBanner(`✨ "${preset.name}" zaman çizelgesine eklendi!`);
      setTimeout(() => setStatusBanner(null), 3000);
    }, 'image/png');
  };

  // Screen recording (Ekran Paylaşımı & Kaydı)
  const toggleScreenRecording = async () => {
    if (isRecordingScreen) {
      if (screenRecRef.current && screenRecRef.current.state !== 'inactive') {
        screenRecRef.current.stop();
      }
      setIsRecordingScreen(false);
    } else {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        alert('Tarayıcınız ekran kaydı özelliğini desteklemiyor.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: { ideal: 30 } },
          audio: true,
        });
        screenStreamRef.current = stream;

        const chunks: Blob[] = [];
        const mediaRec = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8,opus' });
        screenRecRef.current = mediaRec;

        mediaRec.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunks.push(e.data);
        };

        mediaRec.onstop = async () => {
          stream.getTracks().forEach((t) => t.stop());
          const completeBlob = new Blob(chunks, { type: 'video/webm' });
          const assetId = 'screen-' + Date.now();
          await saveAssetBlob(assetId, completeBlob);
          const url = URL.createObjectURL(completeBlob);

          const newAsset: MediaAsset = {
            id: assetId,
            name: 'Ekran Kaydı (' + new Date().toLocaleTimeString('tr-TR') + ')',
            type: 'video',
            mimeType: 'video/webm',
            size: completeBlob.size,
            duration: 8,
            url,
            blob: completeBlob,
          };
          setAssets((prev) => [newAsset, ...prev]);

          const targetTrackId = findTrack('video');
          onAddClip(targetTrackId, {
            assetId,
            name: newAsset.name,
            type: 'video',
            sourceUrl: url,
            startTime: currentTime,
            duration: 8,
            sourceDuration: 8,
            trimIn: 0,
            trimOut: 8,
          });
          setStatusBanner('✅ Ekran kaydı başarıyla eklendi!');
          setTimeout(() => setStatusBanner(null), 3000);
        };

        stream.getVideoTracks()[0].onended = () => {
          if (mediaRec.state !== 'inactive') {
            mediaRec.stop();
          }
          setIsRecordingScreen(false);
        };

        mediaRec.start(500);
        setIsRecordingScreen(true);
      } catch (err: any) {
        if (err.name !== 'NotAllowedError') {
          alert('Ekran kaydı başlatılamadı: ' + err.message);
        }
      }
    }
  };

  // Webcam recording (Kamera Kaydı)
  const toggleWebcamRecording = async () => {
    if (isRecordingWebcam) {
      if (webcamRecRef.current && webcamRecRef.current.state !== 'inactive') {
        webcamRecRef.current.stop();
      }
      setIsRecordingWebcam(false);
    } else {
      if (!navigator.mediaDevices?.getUserMedia) {
        alert('Tarayıcınız kamera kaydı özelliğini desteklemiyor.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720 },
          audio: true,
        });
        webcamStreamRef.current = stream;

        const chunks: Blob[] = [];
        const mediaRec = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8,opus' });
        webcamRecRef.current = mediaRec;

        mediaRec.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunks.push(e.data);
        };

        mediaRec.onstop = async () => {
          stream.getTracks().forEach((t) => t.stop());
          const completeBlob = new Blob(chunks, { type: 'video/webm' });
          const assetId = 'cam-' + Date.now();
          await saveAssetBlob(assetId, completeBlob);
          const url = URL.createObjectURL(completeBlob);

          const newAsset: MediaAsset = {
            id: assetId,
            name: 'Kamera Kaydı (' + new Date().toLocaleTimeString('tr-TR') + ')',
            type: 'video',
            mimeType: 'video/webm',
            size: completeBlob.size,
            duration: 6,
            url,
            blob: completeBlob,
          };
          setAssets((prev) => [newAsset, ...prev]);

          const targetTrackId = findTrack('video');
          onAddClip(targetTrackId, {
            assetId,
            name: newAsset.name,
            type: 'video',
            sourceUrl: url,
            startTime: currentTime,
            duration: 6,
            sourceDuration: 6,
            trimIn: 0,
            trimOut: 6,
          });
          setStatusBanner('✅ Kamera kaydı başarıyla eklendi!');
          setTimeout(() => setStatusBanner(null), 3000);
        };

        mediaRec.start(500);
        setIsRecordingWebcam(true);
      } catch (err: any) {
        if (err.name !== 'NotAllowedError') {
          alert('Kamera kaydı başlatılamadı: ' + err.message);
        }
      }
    }
  };

  // URL import
  const handleImportUrl = async () => {
    if (!urlInput.trim()) return;
    setIsUrlLoading(true);
    try {
      const res = await fetch(urlInput.trim());
      const blob = await res.blob();
      const isVideo = blob.type.startsWith('video') || urlInput.match(/\.(mp4|webm|mov)($|\?)/i);
      const isAudio = blob.type.startsWith('audio') || urlInput.match(/\.(mp3|wav|ogg|aac)($|\?)/i);
      const isImage = blob.type.startsWith('image') || urlInput.match(/\.(png|jpg|jpeg|webp|gif|svg)($|\?)/i);

      const assetId = 'url-' + Date.now();
      await saveAssetBlob(assetId, blob);
      const url = URL.createObjectURL(blob);
      const filename = urlInput.split('/').pop()?.split('?')[0] || 'Web Medyası';

      const newAsset: MediaAsset = {
        id: assetId,
        name: filename,
        type: isVideo ? 'video' : isAudio ? 'audio' : 'image',
        mimeType: blob.type || (isVideo ? 'video/mp4' : isAudio ? 'audio/mp3' : 'image/png'),
        size: blob.size,
        duration: isImage ? 4 : 8,
        url,
        blob,
      };
      setAssets((prev) => [newAsset, ...prev]);

      const targetType = isAudio ? 'audio' : 'video';
      const targetTrackId = findTrack(targetType);
      onAddClip(targetTrackId, {
        assetId,
        name: filename,
        type: newAsset.type,
        sourceUrl: url,
        startTime: currentTime,
        duration: isImage ? 4 : 8,
        sourceDuration: isImage ? 4 : 8,
        trimIn: 0,
        trimOut: isImage ? 4 : 8,
      });
      setUrlInput('');
      setIsUrlInputOpen(false);
      setStatusBanner('✅ Web medyası başarıyla aktarıldı!');
      setTimeout(() => setStatusBanner(null), 3000);
    } catch (err: any) {
      alert('URL yüklenirken hata oluştu: ' + err.message);
    } finally {
      setIsUrlLoading(false);
    }
  };

  // Delete individual asset
  const handleDeleteAsset = (assetId: string) => {
    setAssets((prev) => prev.filter((a) => a.id !== assetId));
  };

  // Clear all assets
  const handleClearAllAssets = () => {
    if (assets.length === 0) return;
    if (confirm('Tüm yüklenen medyaları kütüphaneden kaldırmak istediğinize emin misiniz?')) {
      setAssets([]);
      setStatusBanner('🗑️ Tüm medyalar kütüphaneden temizlendi.');
      setTimeout(() => setStatusBanner(null), 3000);
    }
  };

  // Live microphone voiceover toggle
  const toggleVoiceRecording = async () => {
    if (isRecordingVoice) {
      const blob = await audioMixer.stopVoiceRecording();
      setIsRecordingVoice(false);
      if (blob) {
        const assetId = 'voice-' + Date.now();
        await saveAssetBlob(assetId, blob);
        const url = URL.createObjectURL(blob);
        const trackId = findTrack('audio');
        onAddClip(trackId, {
          assetId,
          name: 'Ses Kaydı (Mikrofon)',
          type: 'audio',
          sourceUrl: url,
          startTime: currentTime,
          duration: 5,
          sourceDuration: 5,
        });
      }
    } else {
      try {
        await audioMixer.startVoiceRecording();
        setIsRecordingVoice(true);
      } catch (err) {
        alert('Mikrofon erişim izni alınamadı: ' + err);
      }
    }
  };

  const speechRecRef = useRef<any>(null);

  const toggleSpeechRecognition = () => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      alert('Tarayıcınız SpeechRecognition API desteklemiyor. Lütfen Google Chrome veya Microsoft Edge kullanın.');
      return;
    }

    if (isTranscribing) {
      if (speechRecRef.current) {
        try {
          speechRecRef.current.stop();
        } catch (e) {}
      }
      setIsTranscribing(false);
      setStatusBanner('🛑 Ses tanıma durduruldu.');
      setTimeout(() => setStatusBanner(null), 3000);
      return;
    }

    try {
      const rec = new SpeechRec();
      rec.lang = 'tr-TR';
      rec.continuous = true;
      rec.interimResults = false;
      let startOffset = currentTime;

      rec.onstart = () => {
        setIsTranscribing(true);
        setStatusBanner('🎙️ Dinleniyor... Türkçe konuşmanız altyazıya dönüştürülüyor.');
      };

      rec.onresult = (evt: any) => {
        for (let i = evt.resultIndex; i < evt.results.length; ++i) {
          if (evt.results[i].isFinal) {
            const transcript = evt.results[i][0].transcript.trim();
            if (transcript) {
              let targetTrackId = findTrack('subtitle');
              if (!targetTrackId) {
                targetTrackId = findTrack('text');
              }
              onAddTextClip(targetTrackId, transcript, startOffset, 3, {
                fontSize: 34,
                fontFamily: 'Montserrat',
                fill: '#FFFFFF',
                strokeColor: '#000000',
                strokeWidth: 4,
                fontWeight: 'bold',
                position: { x: 0, y: 360 },
              });
              startOffset += 3.2;
              setStatusBanner(`💬 Altyazı eklendi: "${transcript.slice(0, 25)}..."`);
            }
          }
        }
      };

      rec.onerror = (e: any) => {
        console.warn('Speech recognition error:', e);
        setIsTranscribing(false);
        setStatusBanner('⚠️ Ses tanıma hatası veya mikrofon izni verilmedi.');
        setTimeout(() => setStatusBanner(null), 4000);
      };

      rec.onend = () => {
        setIsTranscribing(false);
      };

      speechRecRef.current = rec;
      rec.start();
    } catch (err) {
      console.warn('Speech recognition error:', err);
      setIsTranscribing(false);
    }
  };

  const handleAddElement = async (preset: typeof ELEMENT_PRESETS[number]) => {
    try {
      let blob: Blob;
      if (preset.svg) {
        blob = await createSvgAssetBlob(preset.svg);
      } else if (preset.char) {
        blob = await createEmojiAssetBlob(preset.char);
      } else {
        return;
      }
      const assetId = 'asset-elem-' + preset.id + '-' + Date.now();
      await saveAssetBlob(assetId, blob);
      const url = URL.createObjectURL(blob);
      const targetTrackId = findTrack('video');
      const newClip = onAddClip(targetTrackId, {
        assetId,
        name: preset.name,
        type: 'image',
        sourceUrl: url,
        startTime: currentTime,
        duration: 4,
        sourceDuration: 4,
        trimIn: 0,
        trimOut: 4,
        transform: {
          x: 0,
          y: 0,
          scale: 0.65,
          scaleX: 0.65,
          scaleY: 0.65,
          rotation: 0,
          opacity: 1,
        },
      });
      if (newClip?.id) {
        onSelectClip?.(newClip.id);
      }
      setStatusBanner(`⭐ "${preset.name}" zaman çizelgesine eklendi!`);
      setTimeout(() => setStatusBanner(null), 3000);
    } catch (err) {
      console.warn('Failed to add element preset:', err);
    }
  };

  const handleSrtImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const items = parseSrt(text);
      if (items.length === 0) {
        alert('SRT dosyasında geçerli altyazı bulunamadı.');
        return;
      }

      let subTrackId = findTrack('subtitle');
      if (!subTrackId) {
        subTrackId = findTrack('text');
      }

      for (const item of items) {
        onAddTextClip(subTrackId, item.text, item.start, Math.max(1, item.duration), {
          fontSize: 32,
          fontFamily: 'Montserrat',
          fill: '#FFFFFF',
          strokeColor: '#000000',
          strokeWidth: 4,
          fontWeight: 'bold',
          position: { x: 0, y: 360 },
        });
      }

      setStatusBanner(`✅ ${items.length} adet altyazı başarıyla eklendi!`);
      setTimeout(() => setStatusBanner(null), 4000);
    } catch (err) {
      alert('SRT dosyası okunurken hata oluştu: ' + err);
    } finally {
      if (srtInputRef.current) srtInputRef.current.value = '';
    }
  };

  const handleExportSrt = () => {
    const srt = exportSrt(project);
    if (!srt.trim()) {
      alert('Projede dışa aktarılacak metin veya altyazı klipi bulunmuyor.');
      return;
    }
    const blob = new Blob([srt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name || 'proje'}_altyazi.srt`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusBanner('📥 Altyazı .SRT dosyası olarak indirildi!');
    setTimeout(() => setStatusBanner(null), 3000);
  };

  return (
    <aside className="w-[360px] bg-[#0d1117] border-r border-[#21262d] flex flex-col shrink-0 select-none z-10">
      {/* Navigation Tabs - 2-row 4x2 grid so all 8 tabs are visible */}
      <div className="grid grid-cols-4 gap-1 p-1.5 border-b border-[#21262d] bg-[#161b22]/70 shrink-0">
        {[
          { id: 'media', label: 'Medya', icon: '📁' },
          { id: 'text', label: 'Metin', icon: '🔤' },
          { id: 'elements', label: 'Öğeler', icon: '⭐' },
          { id: 'audio', label: 'Ses', icon: '🎵' },
          { id: 'transitions', label: 'Geçişler', icon: '🔀' },
          { id: 'filters', label: 'Filtreler', icon: '🎨' },
          { id: 'subtitles', label: 'Altyazı', icon: '💬' },
          { id: 'settings', label: 'Ayarlar', icon: '⚙️' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as TabType)}
            title={tab.label}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-1.5 rounded-md text-[11px] font-semibold transition-all ${
              activeTab === tab.id
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-200 hover:bg-[#21262d]'
            }`}
          >
            <span className="shrink-0">{tab.icon}</span>
            <span className="truncate">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* 1. MEDIA TAB */}
        {activeTab === 'media' && (
          <div className="space-y-4">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              multiple
              accept="video/*,audio/*,image/*"
              className="hidden"
            />

            {/* Top Quick Actions Grid */}
            <div className="grid grid-cols-2 gap-2">
              {/* File Upload */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center p-3 rounded-lg border border-dashed border-[#30363d] hover:border-indigo-500 hover:bg-[#161b22] text-gray-300 hover:text-white transition-all group"
              >
                <svg className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition-transform mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <span className="text-xs font-semibold">Dosya Yükle</span>
                <span className="text-[9px] text-gray-500">Video, Ses, Resim</span>
              </button>

              {/* Screen Record */}
              <button
                type="button"
                onClick={toggleScreenRecording}
                className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${
                  isRecordingScreen
                    ? 'border-red-500 bg-red-950/30 text-red-300 animate-pulse'
                    : 'border-[#30363d] hover:border-emerald-500 hover:bg-[#161b22] text-gray-300 hover:text-white'
                }`}
              >
                <span className="text-base mb-1">{isRecordingScreen ? '⏹️' : '🖥️'}</span>
                <span className="text-xs font-semibold">
                  {isRecordingScreen ? 'Kaydı Bitir' : 'Ekranı Kaydet'}
                </span>
                <span className="text-[9px] text-gray-500">
                  {isRecordingScreen ? 'Kayıt Yapılıyor...' : 'Ekran & Sekme'}
                </span>
              </button>

              {/* Webcam Record */}
              <button
                type="button"
                onClick={toggleWebcamRecording}
                className={`flex flex-col items-center justify-center p-2.5 rounded-lg border transition-all ${
                  isRecordingWebcam
                    ? 'border-red-500 bg-red-950/30 text-red-300 animate-pulse'
                    : 'border-[#30363d] hover:border-purple-500 hover:bg-[#161b22] text-gray-300 hover:text-white'
                }`}
              >
                <span className="text-base mb-0.5">{isRecordingWebcam ? '⏹️' : '📹'}</span>
                <span className="text-xs font-semibold">
                  {isRecordingWebcam ? 'Kamerayı Durdur' : 'Kamera Kaydet'}
                </span>
                <span className="text-[9px] text-gray-500">
                  {isRecordingWebcam ? 'Kayıt Yapılıyor...' : 'Webcam & Ses'}
                </span>
              </button>

              {/* Voice Record */}
              <button
                type="button"
                onClick={toggleVoiceRecording}
                className={`flex flex-col items-center justify-center p-2.5 rounded-lg border transition-all ${
                  isRecordingVoice
                    ? 'border-red-500 bg-red-950/30 text-red-300 animate-pulse'
                    : 'border-[#30363d] hover:border-red-500 hover:bg-[#161b22] text-gray-300 hover:text-white'
                }`}
              >
                <svg className="w-5 h-5 text-red-400 mb-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                <span className="text-xs font-semibold">
                  {isRecordingVoice ? 'Kaydı Durdur' : 'Ses Kaydet'}
                </span>
                <span className="text-[9px] text-gray-500">
                  {isRecordingVoice ? 'Kaydediliyor...' : 'Yalnızca Mikrofon'}
                </span>
              </button>
            </div>

            {/* URL Import Bar Toggle */}
            <div className="p-2 rounded-lg bg-[#161b22] border border-[#30363d]">
              {!isUrlInputOpen ? (
                <button
                  type="button"
                  onClick={() => setIsUrlInputOpen(true)}
                  className="w-full flex items-center justify-between text-xs text-gray-300 hover:text-white transition-colors"
                >
                  <span className="flex items-center gap-1.5 font-medium">
                    <span>🔗</span>
                    <span>Web Bağlantısından Medya İçe Aktar (URL)</span>
                  </span>
                  <span className="text-indigo-400 text-xs font-bold">+ Aç</span>
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-gray-400 uppercase">Doğrudan Medya URL'si</span>
                    <button
                      type="button"
                      onClick={() => setIsUrlInputOpen(false)}
                      className="text-[10px] text-gray-400 hover:text-white"
                    >
                      ✕ Kapat
                    </button>
                  </div>
                  <div className="flex gap-1.5">
                    <input
                      type="url"
                      placeholder="https://example.com/video.mp4"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 rounded bg-[#0d1117] border border-[#30363d] text-white text-xs outline-none focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      disabled={isUrlLoading || !urlInput.trim()}
                      onClick={handleImportUrl}
                      className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs whitespace-nowrap"
                    >
                      {isUrlLoading ? 'İndiriliyor...' : 'İçe Aktar'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Media Sub-Tab Segment Filter */}
            <div className="flex rounded-lg bg-[#161b22] p-1 border border-[#30363d] gap-1">
              {[
                { id: 'all', label: 'Tümü', icon: '📁' },
                { id: 'stock', label: 'Stok Klipler', icon: '✨' },
                { id: 'colors', label: 'Renk & Zemin', icon: '🎨' },
                { id: 'uploads', label: `Medyalarım (${assets.length})`, icon: '📥' },
              ].map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => setMediaSubTab(sub.id as any)}
                  className={`flex-1 py-1 px-1 rounded text-[10px] font-semibold flex items-center justify-center gap-1 transition-colors whitespace-nowrap ${
                    mediaSubTab === sub.id
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <span className="shrink-0">{sub.icon}</span>
                  <span className="truncate">{sub.label}</span>
                </button>
              ))}
            </div>

            {/* 1. STOCK PRESETS SECTION */}
            {(mediaSubTab === 'all' || mediaSubTab === 'stock') && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                    <span>✨</span>
                    <span>Hazır Stok Klipler & İntrolar</span>
                  </h4>
                  <span className="text-[9px] text-gray-500">1-Tıkla Ekle</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {STOCK_MEDIA_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => addStockMediaClip(preset)}
                      className="p-2 rounded-lg bg-[#161b22] hover:bg-[#21262d] border border-[#30363d] hover:border-indigo-500/70 text-left transition-all group flex flex-col justify-between"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-lg">{preset.icon}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-950/60 text-indigo-300 border border-indigo-800/40">
                          {preset.tag}
                        </span>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-200 group-hover:text-indigo-300 leading-tight">
                          {preset.name}
                        </p>
                        <p className="text-[9px] text-gray-500 mt-0.5">⏱️ {preset.duration} sn HD</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 2. COLOR & GRADIENT SECTION */}
            {(mediaSubTab === 'all' || mediaSubTab === 'colors') && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <span>🎨</span>
                    <span>Renk, Gradyan & Yeşil Perde</span>
                  </h4>
                  <span className="text-[9px] text-emerald-400 font-medium">Chroma Uyumlu</span>
                </div>

                {/* Chroma Keys */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => addDemoColorClip('Yeşil Perde (Chroma)', '#00ff00')}
                    className="p-2 rounded-lg border border-emerald-500/50 bg-[#064e3b]/30 hover:bg-[#064e3b]/50 text-left transition-all flex items-center gap-2 group"
                  >
                    <span className="w-5 h-5 rounded-full bg-[#00ff00] border border-white/20 shrink-0 shadow-sm" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-emerald-300 leading-tight">Yeşil Perde</p>
                      <p className="text-[9px] text-gray-400">Chroma Key</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => addDemoColorClip('Mavi Perde (Chroma)', '#0000ff')}
                    className="p-2 rounded-lg border border-blue-500/50 bg-[#1e3a8a]/30 hover:bg-[#1e3a8a]/50 text-left transition-all flex items-center gap-2 group"
                  >
                    <span className="w-5 h-5 rounded-full bg-[#0000ff] border border-white/20 shrink-0 shadow-sm" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-blue-300 leading-tight">Mavi Perde</p>
                      <p className="text-[9px] text-gray-400">Chroma Key</p>
                    </div>
                  </button>
                </div>

                {/* Quick Color Grid */}
                <div className="grid grid-cols-3 gap-1.5">
                  {COLOR_PRESETS_LIST.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => addDemoColorClip(c.name, c.color)}
                      style={{ background: c.color }}
                      className="h-9 rounded-md border border-white/10 hover:border-white text-[10px] font-medium text-white shadow transition-all flex items-center justify-center p-1 text-center truncate drop-shadow"
                      title={c.desc}
                    >
                      <span className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] truncate">{c.name}</span>
                    </button>
                  ))}
                </div>

                {/* Custom Color Creator */}
                <div className="p-2 rounded-lg bg-[#161b22] border border-[#30363d] flex items-center justify-between gap-2">
                  <span className="text-[10px] font-medium text-gray-300">Özel Renk Zemin:</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={customColor}
                      onChange={(e) => setCustomColor(e.target.value)}
                      className="w-7 h-7 rounded border border-[#30363d] bg-transparent cursor-pointer"
                    />
                    <button
                      type="button"
                      onClick={() => addDemoColorClip('Özel Renk', customColor)}
                      className="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-semibold whitespace-nowrap"
                    >
                      + Ekle
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 3. UPLOADED ASSETS LIBRARY */}
            {(mediaSubTab === 'all' || mediaSubTab === 'uploads') && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    Yüklenen Medyalar ({assets.length})
                  </h4>
                  {assets.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearAllAssets}
                      className="text-[10px] text-red-400 hover:text-red-300"
                    >
                      Tümünü Temizle
                    </button>
                  )}
                </div>

                {/* Filter & Search Bar */}
                {assets.length > 0 && (
                  <div className="space-y-1.5">
                    <input
                      type="text"
                      placeholder="Medyalarda ara..."
                      value={assetSearch}
                      onChange={(e) => setAssetSearch(e.target.value)}
                      className="w-full px-2.5 py-1 rounded bg-[#161b22] border border-[#30363d] text-white text-xs outline-none focus:border-indigo-500"
                    />
                    <div className="flex gap-1">
                      {(['all', 'video', 'audio', 'image'] as const).map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setAssetFilter(f)}
                          className={`flex-1 py-0.5 rounded text-[9px] font-medium transition-colors ${
                            assetFilter === f
                              ? 'bg-indigo-600 text-white'
                              : 'bg-[#161b22] text-gray-400 hover:text-white'
                          }`}
                        >
                          {f === 'all' ? 'Tümü' : f === 'video' ? 'Video' : f === 'audio' ? 'Ses' : 'Görsel'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {assets.length === 0 ? (
                  <div className="p-4 rounded-lg bg-[#161b22]/50 border border-[#21262d] text-center text-xs text-gray-500">
                    Henüz medya yüklenmedi. Yukarıdaki butonlardan dosya yükleyebilir, ekran/kamera kaydedebilir veya hazır stok klipleri ekleyebilirsiniz.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {assets
                      .filter((a) => assetFilter === 'all' || a.type === assetFilter)
                      .filter((a) => !assetSearch.trim() || a.name.toLowerCase().includes(assetSearch.toLowerCase()))
                      .map((asset) => (
                        <div
                          key={asset.id}
                          className="flex items-center gap-2.5 p-2 rounded-lg bg-[#161b22] hover:bg-[#21262d] border border-[#30363d] group transition-all"
                        >
                          <div
                            onClick={() => {
                              const targetTrackId = findTrack(asset.type === 'audio' ? 'audio' : 'video');
                              onAddClip(targetTrackId, {
                                assetId: asset.id,
                                name: asset.name,
                                type: asset.type,
                                startTime: currentTime,
                                duration: asset.type === 'image' ? 4 : asset.duration,
                                sourceDuration: asset.duration,
                              });
                            }}
                            className="w-12 h-10 rounded bg-[#0d1117] flex items-center justify-center overflow-hidden border border-white/5 cursor-pointer shrink-0"
                          >
                            {asset.thumbnailUrl ? (
                              <img src={asset.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-base">{asset.type === 'audio' ? '🎵' : '📹'}</span>
                            )}
                          </div>
                          <div
                            onClick={() => {
                              const targetTrackId = findTrack(asset.type === 'audio' ? 'audio' : 'video');
                              onAddClip(targetTrackId, {
                                assetId: asset.id,
                                name: asset.name,
                                type: asset.type,
                                startTime: currentTime,
                                duration: asset.type === 'image' ? 4 : asset.duration,
                                sourceDuration: asset.duration,
                              });
                            }}
                            className="flex-1 min-w-0 cursor-pointer"
                          >
                            <p className="text-xs font-medium text-gray-200 truncate group-hover:text-indigo-300">
                              {asset.name}
                            </p>
                            <p className="text-[10px] text-gray-500">
                              {Math.round(asset.duration)} sn • {asset.type.toUpperCase()}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                const targetTrackId = findTrack(asset.type === 'audio' ? 'audio' : 'video');
                                onAddClip(targetTrackId, {
                                  assetId: asset.id,
                                  name: asset.name,
                                  type: asset.type,
                                  startTime: currentTime,
                                  duration: asset.type === 'image' ? 4 : asset.duration,
                                  sourceDuration: asset.duration,
                                });
                              }}
                              className="p-1 rounded text-gray-400 hover:text-indigo-400 hover:bg-[#30363d]"
                              title="Zaman Çizelgesine Ekle"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteAsset(asset.id)}
                              className="p-1 rounded text-gray-400 hover:text-red-400 hover:bg-[#30363d]"
                              title="Kütüphaneden Sil"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 2. TEXT TAB */}
        {activeTab === 'text' && (
          <div className="space-y-4">
            <div className="p-2.5 rounded-lg bg-indigo-950/30 border border-indigo-900/50 text-[11px] text-indigo-300 flex items-start gap-2">
              <svg className="w-4 h-4 shrink-0 text-indigo-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Türkçe karakterler (ç, Ç, ğ, Ğ, ı, İ, ö, Ö, ş, Ş, ü, Ü) tam desteklenir. Tuval üzerinde çift tıklayarak doğrudan düzenleyebilirsiniz.</span>
            </div>

            {/* 6 Quick-Add Templates */}
            <div>
              <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Hızlı Metin Şablonları (6 Çeşit)
              </h4>
              <div className="space-y-2">
                {[
                  {
                    label: 'Başlık (Heading)',
                    text: 'FORMA VİDEO DÜZENLEME',
                    desc: 'Büyük ve dikkat çekici ana başlık',
                    data: { fontSize: 64, fontWeight: 'bold' as const },
                  },
                  {
                    label: 'Alt Başlık (Subheading)',
                    text: 'Profesyonel İçerik Üretimi',
                    desc: 'Açıklayıcı alt metin katmanı',
                    data: { fontSize: 40, fontWeight: '600' as const },
                  },
                  {
                    label: 'Paragraf / Gövde (Body)',
                    text: 'Tarayıcıda %100 yerel ve güvenli video kurgu deneyimi.',
                    desc: 'Okunaklı gövde ve paragraf yazısı',
                    data: { fontSize: 26, fontWeight: 'normal' as const, lineHeight: 1.4 },
                  },
                  {
                    label: 'Vurgu / Callout',
                    text: 'DİKKAT! ÖNEMLİ DETAY 🔥',
                    desc: 'Renkli arkalık kutusuyla öne çıkan vurgu',
                    data: {
                      fontSize: 36,
                      fontWeight: '800' as const,
                      backgroundColor: 'rgba(99, 102, 241, 0.9)',
                      backgroundOpacity: 0.9,
                      paddingX: 20,
                      paddingY: 10,
                      borderRadius: 8,
                    },
                  },
                  {
                    label: 'Altyazı (Subtitle)',
                    text: 'Videonun altındaki okunaklı altyazı metni.',
                    desc: 'Siyah kontur ve yarı saydam zemin',
                    data: {
                      fontSize: 34,
                      fontWeight: 'bold' as const,
                      strokeColor: '#000000',
                      strokeWidth: 4,
                      backgroundColor: 'rgba(0,0,0,0.7)',
                      backgroundOpacity: 0.7,
                      paddingX: 18,
                      paddingY: 8,
                      borderRadius: 6,
                    },
                  },
                  {
                    label: 'Rozet / Etiket (Badge)',
                    text: 'YENİ SÜRÜM v2.0',
                    desc: 'Kompakt, yuvarlak köşeli etiket',
                    data: {
                      fontSize: 22,
                      fontWeight: '900' as const,
                      textTransform: 'uppercase' as const,
                      letterSpacing: 1.5,
                      backgroundColor: '#dc2626',
                      backgroundOpacity: 0.95,
                      paddingX: 16,
                      paddingY: 6,
                      borderRadius: 20,
                    },
                  },
                ].map((tmpl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      const targetTrackId = findTrack('text');
                      onAddTextClip(targetTrackId, tmpl.text, currentTime, 4, tmpl.data);
                    }}
                    className="w-full text-left p-2.5 rounded-lg bg-[#161b22] hover:bg-[#21262d] border border-[#30363d] hover:border-indigo-500/60 transition-all group"
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-semibold text-gray-200 group-hover:text-indigo-300">
                        {tmpl.label}
                      </span>
                      <span className="text-[10px] text-indigo-400 font-medium">+ Ekle</span>
                    </div>
                    <p className="text-[10px] text-gray-400 line-clamp-1">{tmpl.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* 10 1-Click Style Presets */}
            <div>
              <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                1-Tıkla Tasarım Stilleri (10 Hazır Stil)
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {TEXT_STYLE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      const targetTrackId = findTrack('text');
                      onAddTextClip(
                        targetTrackId,
                        preset.name,
                        currentTime,
                        4,
                        preset.data
                      );
                    }}
                    className="p-2 rounded-lg bg-[#161b22] hover:bg-[#21262d] border border-[#30363d] hover:border-indigo-500/60 transition-all text-left flex flex-col justify-between group"
                    title={preset.description}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/20"
                        style={{ backgroundColor: preset.previewBg }}
                      />
                      <span className="text-[11px] font-semibold text-gray-200 group-hover:text-indigo-300 truncate">
                        {preset.name}
                      </span>
                    </div>
                    <p className="text-[9px] text-gray-500 line-clamp-1">{preset.description}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 2.5 ELEMENTS TAB */}
        {activeTab === 'elements' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                Öğeler & Çıkartmalar ({ELEMENT_PRESETS.length})
              </h4>
              <span className="text-[10px] text-amber-400 font-mono">Vektör & SVG</span>
            </div>

            {statusBanner && (
              <div className="p-2 rounded-lg bg-indigo-600/20 border border-indigo-500/40 text-indigo-200 text-[11px] flex items-center gap-1.5 animate-fadeIn">
                <span>⭐</span>
                <span className="truncate">{statusBanner}</span>
              </div>
            )}

            <p className="text-[11px] text-gray-400">
              Videonuzun üzerine tıklayarak hemen animasyonlu veya statik rozet, ok ve emojiler ekleyin.
            </p>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1">
              {[
                { id: 'all', label: 'Tümü' },
                { id: 'social', label: 'Sosyal Medya' },
                { id: 'arrows', label: 'Ok & Vurgu' },
                { id: 'shapes', label: 'Şekiller' },
                { id: 'emojis', label: 'Emojiler' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setElementsCategory(cat.id as any)}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap transition-colors ${
                    elementsCategory === cat.id
                      ? 'bg-amber-500 text-black shadow-sm'
                      : 'bg-[#161b22] text-gray-400 hover:text-gray-200 border border-[#30363d]'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Elements Grid */}
            <div className="grid grid-cols-2 gap-2">
              {ELEMENT_PRESETS.filter(
                (el) => elementsCategory === 'all' || el.category === elementsCategory
              ).map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleAddElement(preset)}
                  className="p-2 rounded-lg bg-[#161b22] hover:bg-[#21262d] border border-[#30363d] hover:border-amber-500 transition-all text-left flex flex-col justify-between group cursor-pointer"
                >
                  <div className="w-full h-12 rounded bg-[#0d1117] flex items-center justify-center p-1 mb-1.5 overflow-hidden">
                    {preset.svg ? (
                      <div
                        className="w-full h-full flex items-center justify-center [&>svg]:max-h-full [&>svg]:max-w-full"
                        dangerouslySetInnerHTML={{ __html: preset.svg }}
                      />
                    ) : (
                      <span className="text-2xl">{preset.char || preset.icon}</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-gray-200 group-hover:text-amber-400 truncate">
                      {preset.name}
                    </span>
                    <span className="text-amber-400 text-xs font-bold">+</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 3. AUDIO TAB */}
        {activeTab === 'audio' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                Ses & Müzik Kütüphanesi
              </h4>
              <button
                onClick={() => onAddTrack('audio', 'Ek Ses Kanalı')}
                className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold"
              >
                + Kanal Ekle
              </button>
            </div>

            {/* SFX Category Selector */}
            <div className="flex items-center bg-[#161b22] p-0.5 rounded-lg border border-[#30363d] gap-1">
              <button
                onClick={() => setSfxCategory('all')}
                className={`flex-1 py-1 rounded text-[10px] font-medium transition-colors ${
                  sfxCategory === 'all'
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Tümü
              </button>
              <button
                onClick={() => setSfxCategory('sfx')}
                className={`flex-1 py-1 rounded text-[10px] font-medium transition-colors ${
                  sfxCategory === 'sfx'
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Efektler (SFX)
              </button>
              <button
                onClick={() => setSfxCategory('bgm')}
                className={`flex-1 py-1 rounded text-[10px] font-medium transition-colors ${
                  sfxCategory === 'bgm'
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Fon Müziği
              </button>
            </div>

            {/* Built-in SFX list */}
            <div className="space-y-2">
              {BUILTIN_SFX_LIST.filter(
                (s) => sfxCategory === 'all' || s.category === sfxCategory
              ).map((sfx) => (
                <div
                  key={sfx.id}
                  className="p-2.5 rounded-lg bg-[#161b22] border border-[#30363d] hover:border-indigo-500/50 transition-all flex items-center justify-between gap-2.5 group"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-lg shrink-0">{sfx.icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-gray-200 truncate group-hover:text-indigo-300">
                        {sfx.name}
                      </p>
                      <p className="text-[10px] text-gray-400 truncate">
                        {sfx.duration} sn • {sfx.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => playSfxPreview(sfx.id)}
                      className="p-1.5 rounded-md bg-[#0d1117] hover:bg-indigo-600/30 text-gray-300 hover:text-indigo-300 border border-[#30363d] transition-colors"
                      title="Sesi Dinle"
                    >
                      🔊
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          setAddingSfxId(sfx.id);
                          const blob = await generateSfxBlob(sfx.id);
                          const assetId = 'asset-sfx-' + sfx.id + '-' + Date.now();
                          await saveAssetBlob(assetId, blob);
                          const url = URL.createObjectURL(blob);
                          const targetTrackId = findTrack('audio');
                          onAddClip(targetTrackId, {
                            assetId,
                            sourceUrl: url,
                            name: sfx.name,
                            type: 'audio',
                            startTime: currentTime,
                            duration: sfx.duration,
                            sourceDuration: sfx.duration,
                            trimIn: 0,
                            trimOut: sfx.duration,
                            volume: 0.9,
                          });
                        } catch (err) {
                          console.warn('Failed to add SFX:', err);
                        } finally {
                          setAddingSfxId(null);
                        }
                      }}
                      disabled={addingSfxId === sfx.id}
                      className="px-2 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold transition-colors flex items-center gap-1 shadow-sm"
                      title="Zaman Çizelgesine Ekle"
                    >
                      {addingSfxId === sfx.id ? '...' : '+ Ekle'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. TRANSITIONS TAB */}
        {activeTab === 'transitions' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                Klip Geçiş Efektleri (13 Çeşit)
              </h4>
              <span className="text-[10px] text-indigo-400 font-mono">13 Geçiş</span>
            </div>

            {statusBanner && (
              <div className="p-2 rounded-lg bg-indigo-600/20 border border-indigo-500/40 text-indigo-200 text-[11px] flex items-center gap-1.5 animate-fadeIn">
                <span>⚡</span>
                <span className="truncate">{statusBanner}</span>
              </div>
            )}

            <p className="text-[11px] text-gray-400">
              {selectedClipId
                ? 'Geçiş uygulamak ve tuvalde canlı izlemek için bir efekte tıklayın.'
                : 'Bir efekte tıkladığınızda otomatik olarak oynatma çizgisindeki veya ilk klibe uygulanır.'}
            </p>

            <div className="grid grid-cols-2 gap-2">
              {TRANSITION_DEFINITIONS.map((tr) => {
                const allClips = project.tracks
                  .flatMap((t) => t.clips)
                  .filter((c) => c.type === 'video' || c.type === 'image');
                const targetClip =
                  (selectedClipId && allClips.find((c) => c.id === selectedClipId)) ||
                  allClips.find((c) => currentTime >= c.startTime && currentTime <= c.startTime + c.duration) ||
                  allClips[0];
                const isApplied = targetClip?.transitionIn?.type === tr.id;

                return (
                  <button
                    key={tr.id}
                    type="button"
                    onClick={() => {
                      if (!targetClip) {
                        setStatusBanner('⚠️ Lütfen önce bir video veya görsel klip ekleyin.');
                        setTimeout(() => setStatusBanner(null), 3000);
                        return;
                      }

                      onSelectClip?.(targetClip.id);

                      if (onUpdateClip) {
                        onUpdateClip(targetClip.id, {
                          transitionIn:
                            tr.id === 'cut' || tr.id === 'none'
                              ? undefined
                              : { type: tr.id, duration: targetClip.transitionIn?.duration || 0.8 },
                        });
                      }

                      if (onPreviewAnimation && tr.id !== 'cut' && tr.id !== 'none') {
                        onPreviewAnimation(targetClip.id, 1.2);
                      }

                      setStatusBanner(`✨ "${tr.name}" uygulandı & oynatılıyor!`);
                      setTimeout(() => setStatusBanner(null), 3000);
                    }}
                    className={`p-2 rounded-lg border text-left transition-all group cursor-pointer ${
                      isApplied
                        ? 'bg-indigo-600/30 border-indigo-500 text-white ring-1 ring-indigo-500/50'
                        : 'bg-[#161b22] hover:bg-[#21262d] border-[#30363d] hover:border-indigo-500/60'
                    }`}
                    title={tr.description}
                  >
                    <div className="w-full h-8 rounded bg-[#0d1117] mb-1.5 flex items-center justify-center text-sm gap-1">
                      <span>{tr.icon}</span>
                      <span className="text-[10px] font-bold text-indigo-400 font-mono">
                        {tr.id.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-gray-200 group-hover:text-indigo-300 truncate">
                        {tr.name}
                      </p>
                      {isApplied && <span className="text-indigo-400 font-bold text-xs">✓</span>}
                    </div>
                    <p className="text-[10px] text-gray-400 truncate">{tr.description}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 5. FILTERS TAB */}
        {activeTab === 'filters' && (
          <div className="space-y-3">
            <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              Renk & Atmosfer Filtreleri ({COLOR_PRESETS.length})
            </h4>
            <p className="text-[11px] text-gray-400">
              {selectedClipId
                ? 'Seçili klibe filtre uygulamak için şablonlardan birine tıklayın.'
                : 'Bir filtreye tıklayarak aktif veya seçili klibe anında uygulayın.'}
            </p>
            <div className="grid grid-cols-1 gap-2">
              {COLOR_PRESETS.map((preset) => {
                const allClips = project.tracks
                  .flatMap((t) => t.clips)
                  .filter((c) => c.type === 'video' || c.type === 'image');
                const targetClip =
                  (selectedClipId && allClips.find((c) => c.id === selectedClipId)) ||
                  allClips.find((c) => currentTime >= c.startTime && currentTime <= c.startTime + c.duration) ||
                  allClips[0];

                return (
                  <button
                    key={preset.id}
                    onClick={() => {
                      if (!targetClip) {
                        setStatusBanner('⚠️ Lütfen önce bir video veya görsel klip ekleyin.');
                        setTimeout(() => setStatusBanner(null), 3000);
                        return;
                      }
                      onSelectClip?.(targetClip.id);
                      if (onUpdateClipEffects) {
                        onUpdateClipEffects(targetClip.id, preset.effects);
                      }
                      setStatusBanner(`🎨 "${preset.name}" filtresi uygulandı!`);
                      setTimeout(() => setStatusBanner(null), 3000);
                    }}
                    className="w-full p-2.5 rounded-lg bg-[#161b22] border border-[#30363d] hover:border-indigo-500 hover:bg-[#21262d] transition-all text-left group flex items-start gap-3 cursor-pointer"
                  >
                    <span
                      className="w-4 h-4 rounded-full shrink-0 mt-0.5 shadow-sm"
                      style={{ backgroundColor: preset.thumbnailColor }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-semibold text-gray-200 group-hover:text-indigo-300">
                          {preset.name}
                        </span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#0d1117] text-gray-400 uppercase font-mono">
                          {preset.category}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-400 leading-tight">
                        {preset.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 6. SUBTITLES TAB */}
        {activeTab === 'subtitles' && (
          <div className="space-y-4">
            <input
              type="file"
              ref={srtInputRef}
              onChange={handleSrtImport}
              accept=".srt,.vtt,text/plain"
              className="hidden"
            />

            <div className="flex items-center justify-between">
              <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                Altyazı Stüdyosu
              </h4>
              <span className="text-[10px] text-indigo-400 font-mono">Türkçe Destekli</span>
            </div>

            {statusBanner && (
              <div className="p-2 rounded-lg bg-indigo-600/20 border border-indigo-500/40 text-indigo-200 text-[11px] flex items-center gap-1.5 animate-fadeIn">
                <span>💬</span>
                <span className="truncate">{statusBanner}</span>
              </div>
            )}

            {/* 1. Otomatik Konuşmayı Metne Çevir (Speech to Text) */}
            <div className="p-3 rounded-lg bg-[#161b22] border border-[#30363d] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-200 flex items-center gap-1.5">
                  <span>🎙️</span>
                  <span>Otomatik Ses Tanıma (AI STT)</span>
                </span>
                {isTranscribing && (
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                  </span>
                )}
              </div>
              <p className="text-[10px] text-gray-400">
                Mikrofonunuzdan konuşarak videoya anında zaman damgalı Türkçe altyazı yazdırın.
              </p>
              <button
                type="button"
                onClick={toggleSpeechRecognition}
                className={`w-full py-2 px-3 rounded-md font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm ${
                  isTranscribing
                    ? 'bg-red-600 hover:bg-red-500 text-white animate-pulse'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                }`}
              >
                <span>{isTranscribing ? '🛑' : '🎙️'}</span>
                <span>{isTranscribing ? 'Dinleme Durdur' : 'Konuşmayı Başlat (Türkçe STT)'}</span>
              </button>
            </div>

            {/* 2. SRT Dosya İçe & Dışa Aktarma */}
            <div className="p-3 rounded-lg bg-[#161b22] border border-[#30363d] space-y-2.5">
              <span className="text-xs font-semibold text-gray-200 flex items-center gap-1.5">
                <span>📄</span>
                <span>SRT / VTT Dosya Yönetimi</span>
              </span>
              <p className="text-[10px] text-gray-400">
                Hazır altyazı dosyasını içeri aktarın veya projedeki tüm metinleri standart .SRT olarak indirin.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => srtInputRef.current?.click()}
                  className="py-2 px-2 rounded-md bg-[#0d1117] hover:bg-[#21262d] border border-[#30363d] hover:border-indigo-500 text-gray-200 text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  title="SRT veya VTT dosyasını zaman çizelgesine yükle"
                >
                  <span>📂</span>
                  <span>SRT Yükle</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportSrt}
                  className="py-2 px-2 rounded-md bg-[#0d1117] hover:bg-[#21262d] border border-[#30363d] hover:border-emerald-500 text-gray-200 text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  title="Altyazıları .srt dosyası olarak bilgisayarına indir"
                >
                  <span>📥</span>
                  <span>SRT İndir</span>
                </button>
              </div>
            </div>

            {/* 3. Hazır Altyazı Şablonları */}
            <div className="space-y-2">
              <h5 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                Hazır Altyazı Stilleri
              </h5>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    const subTrackId = findTrack('subtitle') || findTrack('text');
                    onAddTextClip(subTrackId, 'Klasik Sinematik Altyazı', currentTime, 3, {
                      fontSize: 34,
                      fontFamily: 'Montserrat',
                      fill: '#FFFFFF',
                      strokeColor: '#000000',
                      strokeWidth: 4,
                      fontWeight: 'bold',
                      position: { x: 0, y: 360 },
                    });
                  }}
                  className="w-full text-left p-2.5 rounded-lg bg-[#161b22] hover:bg-[#21262d] border border-[#30363d] hover:border-indigo-500 transition-all group flex items-center justify-between cursor-pointer"
                >
                  <div>
                    <p className="text-xs font-semibold text-gray-200 group-hover:text-indigo-300">
                      Klasik Beyaz (Siyah Dış Hat)
                    </p>
                    <p className="text-[10px] text-gray-400">Yüksek kontrast, her videoda net okunur</p>
                  </div>
                  <span className="text-indigo-400 text-xs font-semibold">+ Ekle</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const subTrackId = findTrack('subtitle') || findTrack('text');
                    onAddTextClip(subTrackId, '🔥 TİKTOK & REELS VURGUSU!', currentTime, 3, {
                      fontSize: 36,
                      fontFamily: 'Montserrat',
                      fill: '#FBBF24',
                      strokeColor: '#000000',
                      strokeWidth: 3,
                      backgroundColor: 'rgba(0,0,0,0.85)',
                      backgroundOpacity: 0.85,
                      paddingX: 18,
                      paddingY: 8,
                      borderRadius: 8,
                      fontWeight: '900',
                      position: { x: 0, y: 320 },
                    });
                  }}
                  className="w-full text-left p-2.5 rounded-lg bg-[#161b22] hover:bg-[#21262d] border border-[#30363d] hover:border-amber-500 transition-all group flex items-center justify-between cursor-pointer"
                >
                  <div>
                    <p className="text-xs font-semibold text-gray-200 group-hover:text-amber-400">
                      TikTok / Reels Kutulu Vurgulu
                    </p>
                    <p className="text-[10px] text-gray-400">Sarı parlak metin ve siyah arka plan kutusu</p>
                  </div>
                  <span className="text-amber-400 text-xs font-semibold">+ Ekle</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 7. SETTINGS TAB */}
        {activeTab === 'settings' && (
          <div className="space-y-4 text-xs">
            <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              Proje Ayarları
            </h4>

            <div>
              <label className="block text-gray-400 mb-1">Arka Plan Rengi</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={project.backgroundColor || '#000000'}
                  onChange={(e) => onSetBackgroundColor(e.target.value)}
                  className="w-8 h-8 rounded border border-[#30363d] bg-transparent cursor-pointer"
                />
                <span className="font-mono text-gray-300">{project.backgroundColor || '#000000'}</span>
              </div>
            </div>

            <div>
              <label className="block text-gray-400 mb-1">Toplam Proje Süresi (Saniye)</label>
              <input
                type="number"
                min="1"
                max="3600"
                value={project.duration}
                onChange={(e) => onSetDuration(Math.max(1, parseInt(e.target.value) || 10))}
                className="w-full px-2 py-1.5 rounded bg-[#161b22] border border-[#30363d] text-white outline-none focus:border-indigo-500"
              />
            </div>

            <div className="p-3 rounded-lg bg-[#161b22] border border-[#30363d] space-y-1 text-gray-400 text-[11px]">
              <p>Çözünürlük: {project.resolution.width} x {project.resolution.height}</p>
              <p>Kare Hızı: {project.fps} FPS</p>
              <p>Kanal Sayısı: {project.tracks.length}</p>
              <p>Toplam Klip: {project.tracks.reduce((acc, t) => acc + t.clips.length, 0)}</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
