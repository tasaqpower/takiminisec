import React, { useState } from 'react';
import { VideoProject, VideoClip } from '../../types';
import { saveAssetBlob } from '../../db';
import { useEditorDragDrop } from '../../context/DragDropContext';
import { Shapes, Search, GripVertical, Sparkles, Plus } from 'lucide-react';

interface ElementPreset {
  id: string;
  name: string;
  category: 'social' | 'arrows' | 'shapes' | 'emojis';
  svg?: string;
  char?: string;
}

const ELEMENT_PRESETS: ElementPreset[] = [
  // Sosyal Medya
  {
    id: 'yt-sub',
    name: 'YouTube Abone Ol',
    category: 'social',
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
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 120" width="220" height="120">
      <path d="M15 42 L130 42 L130 15 L205 60 L130 105 L130 78 L15 78 Z" fill="#EF4444" stroke="#FFFFFF" stroke-width="5"/>
    </svg>`,
  },
  {
    id: 'yellow-arrow-down',
    name: 'Sarı İkaz Oku',
    category: 'arrows',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 200" width="120" height="200">
      <path d="M42 15 L78 15 L78 125 L105 125 L60 185 L15 125 L42 125 Z" fill="#EAB308" stroke="#000000" stroke-width="5"/>
    </svg>`,
  },
  {
    id: 'red-circle-target',
    name: 'Kırmızı Odak Çemberi',
    category: 'arrows',
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
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 160" width="260" height="160">
      <path d="M25 15 C12 15 10 28 10 40 L10 95 C10 108 22 115 35 115 L80 115 L95 145 L125 115 L225 115 C238 115 250 108 250 95 L250 40 C250 28 238 15 225 15 Z" fill="#FFFFFF" stroke="#374151" stroke-width="5"/>
      <text x="130" y="75" text-anchor="middle" fill="#111827" font-family="Arial, sans-serif" font-weight="bold" font-size="22">BURAYA BAK!</text>
    </svg>`,
  },
  {
    id: 'gold-star',
    name: 'Altın Yıldız',
    category: 'shapes',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
      <polygon points="90,10 114,62 171,66 128,103 142,160 90,129 38,160 52,103 9,66 66,62" fill="#FBBF24" stroke="#D97706" stroke-width="5"/>
    </svg>`,
  },
  {
    id: 'warning-triangle',
    name: 'Uyarı Levhası',
    category: 'shapes',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 160" width="180" height="160">
      <polygon points="90,12 172,148 8,148" fill="#F59E0B" stroke="#000000" stroke-width="7"/>
      <rect x="85" y="58" width="10" height="44" rx="5" fill="#000000"/>
      <circle cx="90" cy="124" r="7" fill="#000000"/>
    </svg>`,
  },
  // Vektörel Çıkartmalar & Rozetler (Sıfır Emoji - Saf SVG)
  {
    id: 'badge-fire',
    name: 'Alev Vektörü',
    category: 'emojis',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <path d="M50 10 C50 30 70 40 70 60 C70 80 55 90 50 90 C45 90 30 80 30 60 C30 45 40 30 50 10 Z" fill="#EF4444"/>
      <path d="M50 40 C50 55 60 60 60 70 C60 80 52 85 50 85 C48 85 40 80 40 70 C40 60 45 50 50 40 Z" fill="#FBBF24"/>
    </svg>`,
  },
  {
    id: 'badge-rocket',
    name: 'Roket Rozeti',
    category: 'emojis',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <path d="M50 15 C60 25 70 45 65 65 L35 65 C30 45 40 25 50 15 Z" fill="#3B82F6"/>
      <circle cx="50" cy="40" r="8" fill="#FFFFFF"/>
      <polygon points="35,65 20,80 35,75" fill="#EF4444"/>
      <polygon points="65,65 80,80 65,75" fill="#EF4444"/>
      <polygon points="45,65 50,85 55,65" fill="#F59E0B"/>
    </svg>`,
  },
  {
    id: 'badge-100',
    name: '100 Rozeti',
    category: 'emojis',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80" width="120" height="80">
      <text x="60" y="55" text-anchor="middle" fill="#DC2626" font-family="Arial, sans-serif" font-weight="900" font-size="44">100</text>
      <line x1="20" y1="68" x2="100" y2="68" stroke="#DC2626" stroke-width="4" stroke-linecap="round"/>
      <line x1="25" y1="74" x2="95" y2="74" stroke="#DC2626" stroke-width="4" stroke-linecap="round"/>
    </svg>`,
  },
  {
    id: 'badge-check',
    name: 'Onay Rozeti',
    category: 'emojis',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <circle cx="50" cy="50" r="42" fill="#10B981"/>
      <polyline points="30,52 44,66 70,36" fill="none" stroke="#FFFFFF" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
  },
  {
    id: 'badge-sparkle',
    name: 'Parıltı Vektörü',
    category: 'emojis',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <path d="M50 5 Q50 50 95 50 Q50 50 50 95 Q50 50 5 50 Q50 50 50 5 Z" fill="#F59E0B"/>
    </svg>`,
  },
];

async function createSvgAssetBlob(svgString: string): Promise<Blob> {
  return new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
}

interface ElementsTabProps {
  project: VideoProject;
  currentTime: number;
  onAddClip: (trackId: string, clipData: Partial<VideoClip>) => VideoClip;
  findTrack: (type: 'video' | 'audio' | 'text' | 'subtitle') => string;
  getNextClipStartTime: (trackId: string) => number;
}

export const ElementsTab: React.FC<ElementsTabProps> = ({
  project,
  currentTime,
  onAddClip,
  findTrack,
  getNextClipStartTime,
}) => {
  const { startDrag, isClickSuppressed } = useEditorDragDrop();
  const [category, setCategory] = useState<'all' | 'social' | 'arrows' | 'shapes' | 'emojis'>('all');
  const [search, setSearch] = useState('');
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const filteredElements = ELEMENT_PRESETS.filter(
    (item) => category === 'all' || item.category === category
  ).filter(
    (item) =>
      !search.trim() ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.id.toLowerCase().includes(search.toLowerCase())
  );

  const handleAddElement = async (preset: ElementPreset) => {
    try {
      if (!preset.svg) return;
      const blob = await createSvgAssetBlob(preset.svg);

      const assetId = 'element-' + preset.id + '-' + Date.now();
      await saveAssetBlob(assetId, blob);
      const objectUrl = URL.createObjectURL(blob);

      const targetTrackId = findTrack('video');
      const startTime = getNextClipStartTime(targetTrackId);

      onAddClip(targetTrackId, {
        assetId,
        name: preset.name,
        type: 'image',
        sourceUrl: objectUrl,
        startTime,
        duration: 3.0,
        sourceDuration: 3.0,
      });

      setStatusBanner(`"${preset.name}" katmanı eklendi!`);
      setTimeout(() => setStatusBanner(null), 3000);
    } catch (err) {
      console.error('Öğe eklenemedi:', err);
    }
  };

  return (
    <div className="space-y-3 p-3 text-xs bg-[#111419]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Shapes className="w-3.5 h-3.5 text-[#f59e0b]" />
          <span className="font-semibold text-[#E7EAF0]">Grafik & Çıkartmalar</span>
        </div>
        <span className="text-[10px] text-[#929AA8] font-mono bg-[#171B21] px-2 py-0.5 rounded-[2px] border border-[#292F39]">
          {filteredElements.length} Öğe
        </span>
      </div>

      {statusBanner && (
        <div className="p-2 rounded-[3px] bg-[#171B21] border border-[#4f6bf5]/40 text-[#93c5fd] text-[11px] flex items-center gap-1.5 animate-in fade-in duration-150">
          <Sparkles className="w-3.5 h-3.5 text-[#4f6bf5] shrink-0" />
          <span className="truncate">{statusBanner}</span>
        </div>
      )}

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-[#929AA8] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          placeholder="Grafik veya çıkartma ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-8 pr-2.5 py-1.5 rounded-[3px] bg-[#171B21] border border-[#292F39] text-[#E7EAF0] placeholder-[#5A6270] text-xs outline-none focus:border-[#4f6bf5] transition-colors"
        />
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5">
        {[
          { id: 'all', label: 'Tümü' },
          { id: 'social', label: 'Sosyal' },
          { id: 'arrows', label: 'Oklar' },
          { id: 'shapes', label: 'Şekiller' },
          { id: 'emojis', label: 'Çıkartmalar' },
        ].map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategory(c.id as any)}
            className={`px-2.5 py-1 rounded-[2px] text-[11px] font-medium whitespace-nowrap transition-colors ${
              category === c.id
                ? 'bg-[#202631] text-[#E7EAF0] border border-[#4f6bf5]'
                : 'bg-[#171B21] text-[#929AA8] hover:text-[#E7EAF0] border border-[#292F39]'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Grid of Elements */}
      <div className="grid grid-cols-2 gap-2 max-h-[calc(100vh-270px)] overflow-y-auto pr-1 custom-scrollbar">
        {filteredElements.map((elem) => (
          <div
            key={elem.id}
            data-element-item={elem.id}
            onPointerDown={(e) => {
              if (e.button === 0) {
                startDrag(
                  {
                    type: 'image',
                    id: elem.id,
                    name: elem.name,
                    icon: 'Shapes',
                    duration: 3.0,
                    category: elem.category,
                    data: elem,
                  },
                  e.clientX,
                  e.clientY
                );
              }
            }}
            onClick={() => {
              if (isClickSuppressed()) return;
              handleAddElement(elem);
            }}
            className="group relative flex flex-col justify-between p-2 rounded-[3px] bg-[#171B21] hover:bg-[#202631] border border-[#292F39] hover:border-[#3B4351] transition-all cursor-grab active:cursor-grabbing select-none"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-medium text-[#929AA8] uppercase tracking-tight">
                {elem.category}
              </span>
              <GripVertical className="w-3.5 h-3.5 text-[#5A6270] group-hover:text-[#929AA8] transition-colors" />
            </div>

            <div className="h-14 rounded-[2px] bg-[#0E1014] border border-[#292F39] flex items-center justify-center p-1.5 overflow-hidden my-1">
              {elem.svg && (
                <div
                  className="w-full h-full flex items-center justify-center pointer-events-none [&>svg]:max-h-full [&>svg]:w-auto"
                  dangerouslySetInnerHTML={{ __html: elem.svg }}
                />
              )}
            </div>

            <p className="text-[11px] font-medium text-[#E7EAF0] group-hover:text-white truncate">
              {elem.name}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};
