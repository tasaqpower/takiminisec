import React, { useState, useMemo } from 'react';
import {
  VideoProject,
  VideoClip,
  Transform2D,
  ClipEffects,
  Transition,
  TransitionType,
  TextLayerData,
  TextInAnimationType,
  TextLoopAnimationType,
  TextOutAnimationType,
  TextEasingType,
} from '../types';
import { COLOR_PRESETS } from '../engine/filterEngine';
import { TRANSITION_DEFINITIONS } from '../engine/transitionEngine';
import { TEXT_STYLE_PRESETS } from '../engine/textRasterizer';
import { FONT_CATALOG, FONT_CATEGORIES, loadGoogleFont, prefetchCategoryFonts, FontCategory } from '../engine/fontCatalog';
import { notifyCanvasNeedsRedraw } from '../engine/previewRenderer';

interface PropertiesPanelProps {
  project: VideoProject;
  selectedClip: VideoClip | null;
  onUpdateClip: (clipId: string, updates: Partial<VideoClip>) => void;
  onDeleteClip: (clipId: string) => void;
  onRippleDeleteClip: (clipId: string) => void;
  onDuplicateClip: (clipId: string) => void;
  onSetBackgroundColor: (color: string) => void;
  onSetDuration: (duration: number) => void;
  onDetachAudio?: (clipId: string) => void;
  onPreviewAnimation?: (clipStartTime: number, durationSec?: number) => void;
  onSeek?: (time: number) => void;
}

const IN_ANIMATIONS: { id: TextInAnimationType; name: string; desc: string; icon: string; tag: string }[] = [
  { id: 'typewriter', name: 'Daktilo Yazısı', desc: 'Harf harf daktilo gibi yazılır', icon: '⌨️', tag: 'Daktilo' },
  { id: 'pop', name: 'Yaylı Pop', desc: 'Esnek yay hareketiyle fırlar', icon: '💥', tag: 'Pop' },
  { id: 'scale', name: 'Büyüyerek Açılma', desc: 'Merkezden büyüyerek açılır', icon: '🔍', tag: 'Zoom' },
  { id: 'fade', name: 'Yumuşak Belirme', desc: 'Opaklık akıcı şekilde artar', icon: '✨', tag: 'Fade' },
  { id: 'slide-up', name: 'Aşağıdan Yukarı', desc: 'Alttan yumuşakça kayar', icon: '⬆️', tag: 'Kayma' },
  { id: 'slide-down', name: 'Yukarıdan Aşağı', desc: 'Tavandan yumuşakça iner', icon: '⬇️', tag: 'İnme' },
  { id: 'slide-left', name: 'Sağdan Sola', desc: 'Sağdan akarak gelir', icon: '⬅️', tag: 'Kayma' },
  { id: 'slide-right', name: 'Soldan Sağa', desc: 'Soldan akarak gelir', icon: '➡️', tag: 'Kayma' },
  { id: 'blur-in', name: 'Bulanıktan Net', desc: 'Netleşerek görünür', icon: '🌫️', tag: 'Netleşme' },
  { id: 'word-by-word', name: 'Kelime Kelime', desc: 'Kelimeler sırayla belirir', icon: '💬', tag: 'Kelime' },
  { id: 'char-by-char', name: 'Harf Harf', desc: 'Harfler teker teker açılır', icon: '🔤', tag: 'Harf' },
  { id: 'none', name: 'Animasyonsuz', desc: 'Doğrudan sabit görünür', icon: '⏹️', tag: 'Sabit' },
];

const LOOP_ANIMATIONS: { id: TextLoopAnimationType; name: string; icon: string }[] = [
  { id: 'none', name: 'Döngü Yok (Sabit)', icon: '⏹️' },
  { id: 'pulse', name: 'Nabız Atışı (Pulse)', icon: '💓' },
  { id: 'heartbeat', name: 'Kalp Ritmi (Heartbeat)', icon: '❤️' },
  { id: 'float', name: 'Havada Süzülme (Float)', icon: '🎈' },
  { id: 'shimmer', name: 'Işıltı & Parıldama (Shimmer)', icon: '✨' },
];

const OUT_ANIMATIONS: { id: TextOutAnimationType; name: string; icon: string }[] = [
  { id: 'none', name: 'Çıkış Yok (Sert Kesim)', icon: '⏹️' },
  { id: 'fade', name: 'Kaybolma (Fade Out)', icon: '✨' },
  { id: 'slide-down', name: 'Aşağı Kayarak Çıkış', icon: '⬇️' },
  { id: 'slide-up', name: 'Yukarı Kayarak Çıkış', icon: '⬆️' },
  { id: 'scale-down', name: 'Küçülerek Kaybolma', icon: '🔍' },
  { id: 'blur-out', name: 'Bulanıklaşarak Çıkış', icon: '🌫️' },
  { id: 'typewriter-erase', name: 'Daktilo ile Silinme', icon: '⌨️' },
];

const EASING_OPTIONS: { id: TextEasingType; name: string }[] = [
  { id: 'ease-out', name: 'Yumuşak Bitiş (Ease Out)' },
  { id: 'ease-in-out', name: 'Dengeli (Ease In-Out)' },
  { id: 'ease-in', name: 'Hızlanan (Ease In)' },
  { id: 'back', name: 'Geri Sekme (Back Pop)' },
  { id: 'bounce', name: 'Yaylı Zıplama (Bounce)' },
  { id: 'elastic', name: 'Elastik Titreşim (Elastic)' },
  { id: 'linear', name: 'Doğrusal (Linear)' },
];

export const VideoPropertiesPanel: React.FC<PropertiesPanelProps> = ({
  project,
  selectedClip,
  onUpdateClip,
  onDeleteClip,
  onRippleDeleteClip,
  onDuplicateClip,
  onSetBackgroundColor,
  onSetDuration,
  onDetachAudio,
  onPreviewAnimation,
  onSeek,
}) => {
  const [isFontPickerOpen, setIsFontPickerOpen] = useState(false);
  const [fontSearch, setFontSearch] = useState('');
  const [fontCategory, setFontCategory] = useState<FontCategory>('all');

  const filteredFonts = useMemo(() => {
    return FONT_CATALOG.filter((f) => {
      const matchCat = fontCategory === 'all' || f.category === fontCategory;
      const matchSearch =
        !fontSearch.trim() ||
        f.name.toLowerCase().includes(fontSearch.toLowerCase()) ||
        f.id.toLowerCase().includes(fontSearch.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [fontCategory, fontSearch]);

  if (!selectedClip) {
    return (
      <aside className="w-80 bg-[#0d1117] border-l border-[#21262d] flex flex-col shrink-0 select-none z-10 overflow-y-auto p-4 text-xs">
        <h3 className="font-semibold text-gray-300 uppercase tracking-wider text-[11px] mb-3">
          Proje Ayarları
        </h3>

        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-[#161b22] border border-[#30363d] space-y-2">
            <span className="text-gray-400 block text-[10px] uppercase font-bold">Proje Adı</span>
            <p className="text-white font-medium text-xs truncate">{project.name}</p>
          </div>

          <div className="p-3 rounded-lg bg-[#161b22] border border-[#30363d] space-y-3">
            <div>
              <label className="text-gray-400 block text-[10px] uppercase font-bold mb-1">
                Çözünürlük & En-Boy
              </label>
              <p className="text-gray-200 font-mono">
                {project.resolution.width} x {project.resolution.height} (
                {project.resolution.width > project.resolution.height ? '16:9 Yatay' : '9:16 Dikey'})
              </p>
            </div>

            <div>
              <label className="text-gray-400 block text-[10px] uppercase font-bold mb-1">
                Kare Hızı (FPS)
              </label>
              <p className="text-gray-200 font-mono">{project.fps} FPS</p>
            </div>

            <div>
              <label className="text-gray-400 block text-[10px] uppercase font-bold mb-1">
                Toplam Süre (Saniye)
              </label>
              <input
                type="number"
                min="1"
                max="3600"
                value={project.duration}
                onChange={(e) => onSetDuration(Math.max(1, parseInt(e.target.value) || 10))}
                className="w-full px-2 py-1.5 rounded bg-[#0d1117] border border-[#30363d] text-white outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            <div>
              <label className="text-gray-400 block text-[10px] uppercase font-bold mb-1">
                Tuval Arka Plan Rengi
              </label>
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
          </div>

          <div className="p-4 rounded-lg bg-[#161b22]/40 border border-[#21262d] text-center text-gray-500 text-[11px]">
            Düzenlemek istediğiniz klibi zaman çizelgesinden veya önizleme tuvalinden seçin.
          </div>
        </div>
      </aside>
    );
  }

  const updateTransform = (partial: Partial<Transform2D>) => {
    onUpdateClip(selectedClip.id, {
      transform: {
        ...(selectedClip.transform || {
          x: 0,
          y: 0,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
          opacity: 1,
        }),
        ...partial,
      },
    });
  };

  const updateEffects = (partial: Partial<ClipEffects>) => {
    onUpdateClip(selectedClip.id, {
      effects: {
        ...(selectedClip.effects || {}),
        ...partial,
      },
    });
  };

  const updateTextData = (partial: Partial<TextLayerData>) => {
    if (!selectedClip.textData) return;
    onUpdateClip(selectedClip.id, {
      textData: {
        ...selectedClip.textData,
        ...partial,
      },
    });
  };

  const transform = selectedClip.transform || { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 };
  const effects = selectedClip.effects || {};
  const textData = selectedClip.textData;

  return (
    <aside className="w-80 bg-[#0d1117] border-l border-[#21262d] flex flex-col shrink-0 select-none z-10 overflow-y-auto text-xs">
      {/* Header */}
      <div className="p-3 border-b border-[#21262d] bg-[#161b22]/40 flex items-center justify-between">
        <div className="min-w-0 flex-1 mr-2">
          <input
            type="text"
            value={selectedClip.name}
            onChange={(e) => onUpdateClip(selectedClip.id, { name: e.target.value })}
            className="w-full font-semibold text-white bg-transparent border-b border-transparent hover:border-gray-500 focus:border-indigo-500 outline-none truncate"
          />
          <p className="text-[10px] text-gray-400 capitalize mt-0.5">
            {selectedClip.type.toUpperCase()} • {selectedClip.duration.toFixed(2)} sn
          </p>
        </div>
        <button
          onClick={() => onDuplicateClip(selectedClip.id)}
          className="p-1.5 rounded hover:bg-[#21262d] text-gray-400 hover:text-white"
          title="Klibi Kopyala"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </button>
      </div>

      <div className="p-4 space-y-5">
        {/* ============================================================== */}
        {/* ADVANCED TEXT LAYER SECTION                                    */}
        {/* ============================================================== */}
        {selectedClip.type === 'text' && textData && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-indigo-400 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                <span>🔤</span>
                <span>Metin & Tipografi</span>
              </h4>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-950/60 text-indigo-300 border border-indigo-800/40">
                TR Karakter Uyumlu
              </span>
            </div>

            {/* 10 1-Click Style Presets */}
            <div className="space-y-1.5">
              <label className="text-gray-400 text-[10px] block uppercase font-bold tracking-wider">
                1-Tıkla Stil Şablonları (10 Hazır Stil)
              </label>
              <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
                {TEXT_STYLE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => updateTextData(preset.data)}
                    className="p-1.5 rounded-lg bg-[#161b22] hover:bg-[#21262d] border border-[#30363d] hover:border-indigo-500/70 text-left transition-all group flex flex-col justify-between"
                    title={preset.description}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/20"
                        style={{ backgroundColor: preset.previewBg }}
                      />
                      <span className="text-[10px] font-semibold text-gray-200 group-hover:text-indigo-300 truncate">
                        {preset.name}
                      </span>
                    </div>
                    <span className="text-[9px] text-gray-500 line-clamp-1">
                      {preset.description}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Direct Text Editor Textarea */}
            <div>
              <label className="text-gray-400 text-[10px] block mb-1">
                Metin İçeriği (Tuvalde Çift Tıklayarak da Düzenleyebilirsiniz)
              </label>
              <textarea
                rows={3}
                value={textData.text}
                onChange={(e) => updateTextData({ text: e.target.value })}
                placeholder="Metninizi yazın... (Türkçe karakterler desteklenir)"
                className="w-full p-2.5 rounded bg-[#161b22] border border-[#30363d] text-white outline-none focus:border-indigo-500 text-xs font-medium leading-relaxed resize-y"
              />
            </div>

            {/* 200+ Typography Engine & Google Fonts Picker */}
            <div className="relative">
              <div className="flex items-center justify-between mb-1">
                <label className="text-gray-400 text-[10px] block">
                  Yazı Tipi ({FONT_CATALOG.length}+ Google Font)
                </label>
                <span className="text-[9px] text-indigo-400 font-medium">Türkçe Destekli</span>
              </div>

              {/* Current Active Font Trigger */}
              <button
                type="button"
                onClick={() => setIsFontPickerOpen(!isFontPickerOpen)}
                className="w-full px-3 py-2 rounded bg-[#161b22] hover:bg-[#21262d] border border-[#30363d] hover:border-indigo-500 text-left flex items-center justify-between transition-colors group"
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="text-indigo-400 text-xs">🔤</span>
                  <span
                    className="text-white text-xs font-semibold truncate"
                    style={{ fontFamily: textData.fontFamily?.split(',')[0] || 'Plus Jakarta Sans' }}
                  >
                    {textData.fontFamily?.split(',')[0].replace(/['"]/g, '') || 'Plus Jakarta Sans'}
                  </span>
                </div>
                <span className="text-gray-400 group-hover:text-white text-[10px]">
                  {isFontPickerOpen ? '▲ Kapat' : '▼ Değiştir'}
                </span>
              </button>

              {/* Expanded Font Selector Modal/Dropdown */}
              {isFontPickerOpen && (
                <div className="mt-2 p-2.5 rounded-lg bg-[#0d1117] border border-[#30363d] shadow-2xl space-y-2 z-30 relative">
                  {/* Search Input */}
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Font ara... (Örn: Montserrat, Bebas, Pacifico)"
                      value={fontSearch}
                      onChange={(e) => setFontSearch(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded bg-[#161b22] border border-[#30363d] text-white text-xs outline-none focus:border-indigo-500"
                    />
                    {fontSearch && (
                      <button
                        type="button"
                        onClick={() => setFontSearch('')}
                        className="absolute right-2 top-1.5 text-gray-400 hover:text-white text-xs"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Category Pills */}
                  <div className="flex gap-1 overflow-x-auto no-scrollbar pb-1">
                    {FONT_CATEGORIES.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          setFontCategory(cat.id);
                          prefetchCategoryFonts(cat.id);
                        }}
                        className={`px-2 py-1 rounded text-[10px] whitespace-nowrap transition-colors flex items-center gap-1 ${
                          fontCategory === cat.id
                            ? 'bg-indigo-600 text-white font-semibold'
                            : 'bg-[#161b22] text-gray-400 hover:text-white'
                        }`}
                      >
                        <span>{cat.icon}</span>
                        <span>{cat.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Scrollable Font List (200+ Fonts) */}
                  <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                    {filteredFonts.length === 0 ? (
                      <div className="text-center py-4 text-xs text-gray-500">
                        Aradığınız kriterde font bulunamadı.
                      </div>
                    ) : (
                      filteredFonts.map((f) => {
                        const isSelected = textData.fontFamily?.toLowerCase().includes(f.id.toLowerCase());
                        return (
                          <div
                            key={f.id}
                            onClick={async () => {
                              const familyStr = `"${f.id}", ${f.fallback || 'sans-serif'}`;
                              updateTextData({
                                fontFamily: familyStr,
                              });
                              setIsFontPickerOpen(false);
                              await loadGoogleFont(f.id);
                              notifyCanvasNeedsRedraw();
                            }}
                            onMouseEnter={() => {
                              loadGoogleFont(f.id).catch(() => {});
                            }}
                            className={`p-2 rounded flex items-center justify-between cursor-pointer transition-all ${
                              isSelected
                                ? 'bg-indigo-600/30 border border-indigo-500 text-indigo-300'
                                : 'bg-[#161b22]/70 hover:bg-[#21262d] text-gray-200'
                            }`}
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-semibold truncate">{f.name}</p>
                              <p
                                className="text-[11px] text-gray-400 truncate mt-0.5"
                                style={{ fontFamily: `"${f.id}", ${f.fallback}` }}
                              >
                                {textData.text?.substring(0, 24) || 'İyilik ve Adalet — 123'}
                              </p>
                            </div>
                            {isSelected && <span className="text-indigo-400 text-xs font-bold">✓</span>}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Weight, Size, Spacing */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-gray-400 text-[10px] block mb-1">
                  Boyut ({textData.fontSize || 54}px)
                </label>
                <input
                  type="range"
                  min="16"
                  max="160"
                  value={textData.fontSize || 54}
                  onChange={(e) => updateTextData({ fontSize: parseInt(e.target.value) || 54 })}
                  className="w-full accent-indigo-500"
                />
              </div>

              <div>
                <label className="text-gray-400 text-[10px] block mb-1">Kalınlık (Weight)</label>
                <select
                  value={String(textData.fontWeight || 'bold')}
                  onChange={(e) =>
                    updateTextData({
                      fontWeight: e.target.value as any,
                    })
                  }
                  className="w-full px-2 py-1.5 rounded bg-[#161b22] border border-[#30363d] text-white outline-none text-xs"
                >
                  <option value="300">300 (İnce / Light)</option>
                  <option value="400">400 (Normal / Regular)</option>
                  <option value="500">500 (Orta / Medium)</option>
                  <option value="600">600 (Yarı Kalın / Semi-Bold)</option>
                  <option value="bold">700 (Kalın / Bold)</option>
                  <option value="900">900 (Siyah / Black)</option>
                </select>
              </div>
            </div>

            {/* Letter Spacing & Line Height */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-gray-400 text-[10px] block mb-1">
                  Harf Aralığı ({textData.letterSpacing || 0}px)
                </label>
                <input
                  type="range"
                  min="-2"
                  max="12"
                  step="0.5"
                  value={textData.letterSpacing || 0}
                  onChange={(e) => updateTextData({ letterSpacing: parseFloat(e.target.value) || 0 })}
                  className="w-full accent-indigo-500"
                />
              </div>

              <div>
                <label className="text-gray-400 text-[10px] block mb-1">
                  Satır Yüksekliği ({textData.lineHeight || 1.25}x)
                </label>
                <input
                  type="range"
                  min="0.9"
                  max="2.0"
                  step="0.05"
                  value={textData.lineHeight || 1.25}
                  onChange={(e) => updateTextData({ lineHeight: parseFloat(e.target.value) || 1.25 })}
                  className="w-full accent-indigo-500"
                />
              </div>
            </div>

            {/* Text Alignment & Transformations */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#21262d]">
              {/* Alignment */}
              <div className="flex items-center bg-[#161b22] p-0.5 rounded border border-[#30363d]">
                {(['left', 'center', 'right'] as const).map((align) => (
                  <button
                    key={align}
                    type="button"
                    onClick={() => updateTextData({ textAlign: align, alignment: align })}
                    className={`px-2 py-1 rounded text-xs transition-colors ${
                      (textData.textAlign || textData.alignment || 'center') === align
                        ? 'bg-indigo-600 text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                    title={align === 'left' ? 'Sola Hizala' : align === 'center' ? 'Ortala' : 'Sağa Hizala'}
                  >
                    {align === 'left' ? '⇤' : align === 'center' ? '≡' : '⇥'}
                  </button>
                ))}
              </div>

              {/* Text Transform */}
              <div className="flex items-center bg-[#161b22] p-0.5 rounded border border-[#30363d]">
                {[
                  { id: 'none', label: 'Aa' },
                  { id: 'uppercase', label: 'AA' },
                  { id: 'lowercase', label: 'aa' },
                ].map((tr) => (
                  <button
                    key={tr.id}
                    type="button"
                    onClick={() => updateTextData({ textTransform: tr.id as any })}
                    className={`px-1.5 py-1 rounded text-[10px] font-mono transition-colors ${
                      (textData.textTransform || 'none') === tr.id
                        ? 'bg-indigo-600 text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {tr.label}
                  </button>
                ))}
              </div>

              {/* Italic & Underline */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() =>
                    updateTextData({
                      fontStyle: textData.fontStyle === 'italic' ? 'normal' : 'italic',
                    })
                  }
                  className={`w-7 h-7 rounded border text-xs italic font-serif flex items-center justify-center ${
                    textData.fontStyle === 'italic'
                      ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500'
                      : 'border-[#30363d] text-gray-400 hover:text-white'
                  }`}
                  title="İtalik"
                >
                  I
                </button>
                <button
                  type="button"
                  onClick={() => updateTextData({ underline: !textData.underline })}
                  className={`w-7 h-7 rounded border text-xs underline flex items-center justify-center ${
                    textData.underline
                      ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500'
                      : 'border-[#30363d] text-gray-400 hover:text-white'
                  }`}
                  title="Altı Çizili"
                >
                  U
                </button>
              </div>
            </div>

            {/* Colors: Fill, Stroke, Box */}
            <div className="space-y-2 pt-2 border-t border-[#21262d]">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-gray-400 text-[10px] block mb-1">Metin Rengi</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={textData.fillColor || textData.color || '#ffffff'}
                      onChange={(e) => updateTextData({ fillColor: e.target.value, color: e.target.value })}
                      className="w-7 h-7 rounded border border-[#30363d] bg-transparent cursor-pointer"
                    />
                    <span className="font-mono text-[10px] text-gray-300 uppercase">
                      {textData.fillColor || textData.color || '#ffffff'}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="text-gray-400 text-[10px] block mb-1">
                    Dış Kontur ({textData.strokeWidth || 0}px)
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={textData.strokeColor || '#000000'}
                      onChange={(e) => updateTextData({ strokeColor: e.target.value })}
                      className="w-7 h-7 rounded border border-[#30363d] bg-transparent cursor-pointer"
                    />
                    <input
                      type="range"
                      min="0"
                      max="12"
                      value={textData.strokeWidth || 0}
                      onChange={(e) => updateTextData({ strokeWidth: parseInt(e.target.value) || 0 })}
                      className="w-full accent-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Background Box (Pill) */}
              <div className="p-2.5 rounded bg-[#161b22] border border-[#30363d] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-gray-300">Arka Plan Kutusu (Pill)</span>
                  <button
                    type="button"
                    onClick={() =>
                      updateTextData({
                        backgroundColor: textData.backgroundColor ? undefined : 'rgba(0,0,0,0.7)',
                        backgroundOpacity: textData.backgroundColor ? 0 : 0.7,
                      })
                    }
                    className="text-[10px] text-indigo-400 hover:text-indigo-300"
                  >
                    {textData.backgroundColor ? 'Kaldır' : '+ Kutu Ekle'}
                  </button>
                </div>

                {textData.backgroundColor && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-gray-400 text-[9px] block mb-1">Kutu Rengi</label>
                        <input
                          type="color"
                          value={textData.backgroundColor.startsWith('#') ? textData.backgroundColor : '#000000'}
                          onChange={(e) => updateTextData({ backgroundColor: e.target.value, boxColor: e.target.value })}
                          className="w-full h-6 rounded border border-[#30363d] bg-transparent cursor-pointer"
                        />
                      </div>
                      <div>
                        <label className="text-gray-400 text-[9px] block mb-1">
                          Opaklık ({Math.round((textData.backgroundOpacity ?? 0.7) * 100)}%)
                        </label>
                        <input
                          type="range"
                          min="0.1"
                          max="1.0"
                          step="0.05"
                          value={textData.backgroundOpacity ?? 0.7}
                          onChange={(e) => updateTextData({ backgroundOpacity: parseFloat(e.target.value) })}
                          className="w-full accent-indigo-500"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-gray-400 text-[9px] block mb-1">
                          Yatay Boşluk ({textData.paddingX ?? 20}px)
                        </label>
                        <input
                          type="range"
                          min="4"
                          max="50"
                          value={textData.paddingX ?? 20}
                          onChange={(e) => updateTextData({ paddingX: parseInt(e.target.value) })}
                          className="w-full accent-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="text-gray-400 text-[9px] block mb-1">
                          Köşe Yuvarlama ({textData.borderRadius ?? 8}px)
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="32"
                          value={textData.borderRadius ?? 8}
                          onChange={(e) => updateTextData({ borderRadius: parseInt(e.target.value) })}
                          className="w-full accent-indigo-500"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Visual Text Animation Gallery */}
            <div className="p-3 rounded-lg bg-[#161b22] border border-[#30363d] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-gray-300 uppercase tracking-wider block">
                  Metin Animasyonları
                </span>
                <span className="text-[9px] text-indigo-400 font-medium">Canlı Önizleme</span>
              </div>

              {/* Big "Play Animation Live on Canvas" Action */}
              <button
                type="button"
                onClick={() => {
                  const duration = (textData.inDuration && textData.inDuration > 0) ? textData.inDuration : 0.8;
                  const startTime = selectedClip.startTime ?? selectedClip.start ?? 0;
                  onPreviewAnimation?.(startTime, duration + 1.2);
                }}
                className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/40 transition-all active:scale-95"
              >
                <span className="text-sm">▶</span>
                <span>Animasyonu Tuvalde Canlı Oynat</span>
              </button>

              {/* Visual In-Animation Cards Grid */}
              <div>
                <label className="text-gray-400 text-[10px] block mb-1.5 font-medium">
                  Giriş Animasyonu (1-Tıkla Canlı Önizle)
                </label>
                <div className="grid grid-cols-2 gap-1.5 max-h-52 overflow-y-auto pr-1">
                  {IN_ANIMATIONS.map((anim) => {
                    const activeIn =
                      textData.inAnimation ||
                      (typeof textData.animation === 'object' ? textData.animation.type : undefined) ||
                      (typeof textData.animation === 'string' ? textData.animation : 'none');
                    const isActive = activeIn === anim.id;

                    return (
                      <button
                        key={anim.id}
                        type="button"
                        onClick={() => {
                          const duration = (textData.inDuration && textData.inDuration > 0) ? textData.inDuration : 0.8;
                          updateTextData({
                            inAnimation: anim.id,
                            inDuration: duration,
                            animation: {
                              type: anim.id,
                              duration: duration,
                            },
                          });
                          // Automatically trigger live preview on canvas so user sees the animation immediately!
                          const startTime = selectedClip.startTime ?? selectedClip.start ?? 0;
                          onPreviewAnimation?.(startTime, duration + 1.2);
                        }}
                        className={`p-2 rounded-lg text-left transition-all relative border flex flex-col justify-between ${
                          isActive
                            ? 'bg-indigo-600/30 border-indigo-500 text-white shadow-md shadow-indigo-950/50'
                            : 'bg-[#0d1117] hover:bg-[#1f242c] border-[#30363d] text-gray-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm">{anim.icon}</span>
                          <span
                            className={`text-[8px] px-1 py-0.5 rounded font-mono font-semibold ${
                              isActive ? 'bg-indigo-500 text-white' : 'bg-[#21262d] text-gray-400'
                            }`}
                          >
                            {anim.tag}
                          </span>
                        </div>
                        <p className="text-xs font-semibold leading-tight truncate">{anim.name}</p>
                        <p className="text-[9px] text-gray-400 truncate mt-0.5">{anim.desc}</p>
                        {isActive && (
                          <div className="absolute top-1 right-1 text-indigo-400 text-xs font-bold">
                            ✓
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* In Animation Easing & Duration */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#30363d]/60">
                <div>
                  <div className="flex justify-between text-gray-400 text-[9px] mb-0.5">
                    <span>Giriş Süresi</span>
                    <span className="font-mono text-indigo-300">{textData.inDuration ?? 0.6}s</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="2.5"
                    step="0.1"
                    value={textData.inDuration ?? 0.6}
                    onChange={(e) => updateTextData({ inDuration: parseFloat(e.target.value) })}
                    className="w-full accent-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-gray-400 text-[9px] block mb-0.5">Yumuşatma (Easing)</label>
                  <select
                    value={textData.inEasing || 'ease-out'}
                    onChange={(e) => updateTextData({ inEasing: e.target.value as TextEasingType })}
                    className="w-full px-2 py-1 rounded bg-[#0d1117] border border-[#30363d] text-white outline-none text-[11px]"
                  >
                    {EASING_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Loop Animation */}
              <div>
                <label className="text-gray-400 text-[10px] block mb-1">Sürekli Döngü (Loop)</label>
                <div className="grid grid-cols-3 gap-1">
                  {LOOP_ANIMATIONS.map((loop) => {
                    const isLoopActive = (textData.loopAnimation || 'none') === loop.id;
                    return (
                      <button
                        key={loop.id}
                        type="button"
                        onClick={() => {
                          updateTextData({ loopAnimation: loop.id });
                          const startTime = selectedClip.startTime ?? selectedClip.start ?? 0;
                          onPreviewAnimation?.(startTime, 2.0);
                        }}
                        className={`p-1.5 rounded text-center text-[10px] border transition-all ${
                          isLoopActive
                            ? 'bg-purple-600/30 border-purple-500 text-purple-200 font-semibold'
                            : 'bg-[#0d1117] hover:bg-[#21262d] border-[#30363d] text-gray-400'
                        }`}
                      >
                        <span className="block text-xs">{loop.icon}</span>
                        <span className="truncate block mt-0.5">{loop.name.split(' ')[0]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Out Animation */}
              <div>
                <label className="text-gray-400 text-[10px] block mb-1">Çıkış Animasyonu (Out)</label>
                <select
                  value={textData.outAnimation || 'none'}
                  onChange={(e) => {
                    const duration = (textData.outDuration && textData.outDuration > 0) ? textData.outDuration : 0.6;
                    updateTextData({
                      outAnimation: e.target.value as TextOutAnimationType,
                      outDuration: duration,
                    });
                    const startTime =
                      (selectedClip.startTime ?? selectedClip.start ?? 0) + Math.max(0, selectedClip.duration - duration - 0.2);
                    onPreviewAnimation?.(startTime, duration + 0.6);
                  }}
                  className="w-full px-2 py-1.5 rounded bg-[#0d1117] border border-[#30363d] text-white outline-none text-xs"
                >
                  {OUT_ANIMATIONS.map((out) => (
                    <option key={out.id} value={out.id}>
                      {out.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TRANSFORM SECTION (VIDEO, IMAGE, TEXT, ETC.)                    */}
        {/* ============================================================== */}
        <div className="space-y-3">
          <h4 className="font-semibold text-gray-300 text-[11px] uppercase tracking-wider">
            Konum & Dönüşüm (Transform)
          </h4>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-gray-400 text-[10px] block mb-1">Konum X (px)</label>
              <input
                type="number"
                value={transform.x}
                onChange={(e) => updateTransform({ x: parseFloat(e.target.value) || 0 })}
                className="w-full px-2 py-1 rounded bg-[#161b22] border border-[#30363d] text-white font-mono"
              />
            </div>
            <div>
              <label className="text-gray-400 text-[10px] block mb-1">Konum Y (px)</label>
              <input
                type="number"
                value={transform.y}
                onChange={(e) => updateTransform({ y: parseFloat(e.target.value) || 0 })}
                className="w-full px-2 py-1 rounded bg-[#161b22] border border-[#30363d] text-white font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-gray-400 text-[10px] block mb-1">
                Ölçek ({Math.round(transform.scaleX * 100)}%)
              </label>
              <input
                type="range"
                min="0.1"
                max="3.0"
                step="0.05"
                value={transform.scaleX}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  updateTransform({ scaleX: val, scaleY: val });
                }}
                className="w-full accent-indigo-500"
              />
            </div>
            <div>
              <label className="text-gray-400 text-[10px] block mb-1">
                Opaklık ({Math.round(transform.opacity * 100)}%)
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={transform.opacity}
                onChange={(e) => updateTransform({ opacity: parseFloat(e.target.value) })}
                className="w-full accent-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="text-gray-400 text-[10px] block mb-1">
              Döndürme ({Math.round(transform.rotation)}°)
            </label>
            <input
              type="range"
              min="-180"
              max="180"
              step="1"
              value={transform.rotation}
              onChange={(e) => updateTransform({ rotation: parseInt(e.target.value) })}
              className="w-full accent-indigo-500"
            />
          </div>
        </div>

        {/* SPEED SECTION */}
        {selectedClip.type === 'video' && (
          <div className="space-y-2">
            <h4 className="font-semibold text-gray-300 text-[11px] uppercase tracking-wider">
              Oynatma Hızı ({selectedClip.speed || 1}x)
            </h4>
            <div className="flex items-center gap-2">
              {[0.5, 1.0, 1.5, 2.0].map((s) => (
                <button
                  key={s}
                  onClick={() => onUpdateClip(selectedClip.id, { speed: s })}
                  className={`flex-1 py-1 rounded text-[11px] font-mono border ${
                    (selectedClip.speed || 1) === s
                      ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500/50'
                      : 'bg-[#161b22] text-gray-400 border-[#30363d] hover:text-white'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>
        )}

        {/* AUDIO SECTION */}
        {(selectedClip.type === 'video' || selectedClip.type === 'audio') && (
          <div className="space-y-3">
            <h4 className="font-semibold text-gray-300 text-[11px] uppercase tracking-wider">
              Ses Ayarları
            </h4>

            <div>
              <div className="flex justify-between text-gray-400 text-[10px] mb-1">
                <span>Ses Seviyesi</span>
                <span className="font-mono">{Math.round((selectedClip.volume ?? 1) * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="2"
                step="0.05"
                value={selectedClip.volume ?? 1}
                onChange={(e) => onUpdateClip(selectedClip.id, { volume: parseFloat(e.target.value) })}
                className="w-full accent-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-gray-400 text-[10px] block mb-1">Giriş Fade ({selectedClip.fadeIn || 0}s)</label>
                <input
                  type="range"
                  min="0"
                  max="3"
                  step="0.2"
                  value={selectedClip.fadeIn || 0}
                  onChange={(e) => onUpdateClip(selectedClip.id, { fadeIn: parseFloat(e.target.value) })}
                  className="w-full accent-indigo-500"
                />
              </div>
              <div>
                <label className="text-gray-400 text-[10px] block mb-1">Çıkış Fade ({selectedClip.fadeOut || 0}s)</label>
                <input
                  type="range"
                  min="0"
                  max="3"
                  step="0.2"
                  value={selectedClip.fadeOut || 0}
                  onChange={(e) => onUpdateClip(selectedClip.id, { fadeOut: parseFloat(e.target.value) })}
                  className="w-full accent-indigo-500"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer text-gray-300 text-xs">
              <input
                type="checkbox"
                checked={selectedClip.muted || false}
                onChange={(e) => onUpdateClip(selectedClip.id, { muted: e.target.checked })}
                className="rounded border-[#30363d] accent-indigo-500"
              />
              <span>Klibi Sessize Al (Mute)</span>
            </label>

            {selectedClip.type === 'video' && onDetachAudio && (
              <button
                type="button"
                onClick={() => onDetachAudio(selectedClip.id)}
                className="w-full mt-2 py-2 px-3 rounded-lg bg-indigo-600/20 text-indigo-300 border border-indigo-500/40 hover:bg-indigo-600/30 flex items-center justify-center gap-2 text-xs font-semibold transition-colors"
                title="Videonun sesini ayrı bir ses kanalına taşır ve videoyu sessize alır"
              >
                <span>🎵</span>
                <span>Sesi Videodan Ayır (Detach Audio)</span>
              </button>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* TRANSITIONS SECTION (13 TRANSITIONS)                            */}
        {/* ============================================================== */}
        {(selectedClip.type === 'video' || selectedClip.type === 'image') && (
          <div className="space-y-3">
            <h4 className="font-semibold text-gray-300 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
              <span>🔀</span>
              <span>Geçiş Efektleri (13 Profesyonel Geçiş)</span>
            </h4>

            <div>
              <label className="text-gray-400 text-[10px] block mb-1">Giriş Geçişi (Transition In)</label>
              <select
                value={selectedClip.transitionIn?.type || 'cut'}
                onChange={(e) => {
                  const type = e.target.value as TransitionType;
                  if (type === 'cut' || type === 'none') {
                    onUpdateClip(selectedClip.id, { transitionIn: undefined });
                  } else {
                    onUpdateClip(selectedClip.id, {
                      transitionIn: { type, duration: selectedClip.transitionIn?.duration || 0.8 },
                    });
                  }
                }}
                className="w-full px-2 py-1.5 rounded bg-[#161b22] border border-[#30363d] text-white outline-none"
              >
                {TRANSITION_DEFINITIONS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.icon} {o.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-gray-400 text-[10px] block mb-1">Çıkış Geçişi (Transition Out)</label>
              <select
                value={selectedClip.transitionOut?.type || 'cut'}
                onChange={(e) => {
                  const type = e.target.value as TransitionType;
                  if (type === 'cut' || type === 'none') {
                    onUpdateClip(selectedClip.id, { transitionOut: undefined });
                  } else {
                    onUpdateClip(selectedClip.id, {
                      transitionOut: { type, duration: selectedClip.transitionOut?.duration || 0.8 },
                    });
                  }
                }}
                className="w-full px-2 py-1.5 rounded bg-[#161b22] border border-[#30363d] text-white outline-none"
              >
                {TRANSITION_DEFINITIONS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.icon} {o.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* COLOR & FILTERS SECTION */}
        {(selectedClip.type === 'video' || selectedClip.type === 'image') && (
          <div className="space-y-3">
            <h4 className="font-semibold text-gray-300 text-[11px] uppercase tracking-wider">
              Renk & Filtre Ayarları
            </h4>

            {/* Presets */}
            <div>
              <label className="text-gray-400 text-[10px] block mb-1.5 uppercase font-bold tracking-wider">
                Hazır Renk Şablonları (Presets)
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => updateEffects(preset.effects)}
                    className="p-1.5 rounded-lg bg-[#0d1117] border border-[#30363d] hover:border-indigo-500/60 text-left transition-all group flex items-center gap-2"
                    title={preset.description}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: preset.thumbnailColor }}
                    />
                    <span className="text-[10px] font-medium text-gray-300 group-hover:text-white truncate">
                      {preset.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex justify-between text-gray-400 text-[10px] mb-1">
                <span>Parlaklık</span>
                <span className="font-mono">{effects.brightness ?? 0}</span>
              </div>
              <input
                type="range"
                min="-1"
                max="1"
                step="0.05"
                value={effects.brightness ?? 0}
                onChange={(e) => updateEffects({ brightness: parseFloat(e.target.value) })}
                className="w-full accent-indigo-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-gray-400 text-[10px] mb-1">
                <span>Kontrast</span>
                <span className="font-mono">{effects.contrast ?? 1}</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="2.5"
                step="0.05"
                value={effects.contrast ?? 1}
                onChange={(e) => updateEffects({ contrast: parseFloat(e.target.value) })}
                className="w-full accent-indigo-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-gray-400 text-[10px] mb-1">
                <span>Doygunluk (Saturation)</span>
                <span className="font-mono">{effects.saturation ?? 1}</span>
              </div>
              <input
                type="range"
                min="0"
                max="2.5"
                step="0.05"
                value={effects.saturation ?? 1}
                onChange={(e) => updateEffects({ saturation: parseFloat(e.target.value) })}
                className="w-full accent-indigo-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-gray-400 text-[10px] mb-1">
                <span>Renk Sıcaklığı (Temperature)</span>
                <span className="font-mono">{effects.temperature ?? 0}</span>
              </div>
              <input
                type="range"
                min="-50"
                max="50"
                step="2"
                value={effects.temperature ?? 0}
                onChange={(e) => updateEffects({ temperature: parseInt(e.target.value) })}
                className="w-full accent-indigo-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-gray-400 text-[10px] mb-1">
                <span>Vinyet (Kenar Karartması)</span>
                <span className="font-mono">{Math.round((effects.vignette ?? 0) * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={effects.vignette ?? 0}
                onChange={(e) => updateEffects({ vignette: parseFloat(e.target.value) })}
                className="w-full accent-indigo-500"
              />
            </div>
          </div>
        )}

        {/* DELETE & RIPPLE DELETE BUTTONS */}
        <div className="pt-2 border-t border-[#21262d] space-y-2">
          <button
            onClick={() => onRippleDeleteClip(selectedClip.id)}
            className="w-full py-1.5 px-3 rounded bg-amber-950/30 text-amber-300 border border-amber-800/40 hover:bg-amber-950/50 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            title="Klibi sil ve arkasındaki klipleri öne kaydırarak boşluğu kapat"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            <span>Boşluksuz Sil (Ripple Delete)</span>
          </button>

          <button
            onClick={() => onDeleteClip(selectedClip.id)}
            className="w-full py-1.5 px-3 rounded bg-red-950/30 text-red-300 border border-red-800/40 hover:bg-red-950/50 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span>Klibi Sil (Delete)</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
