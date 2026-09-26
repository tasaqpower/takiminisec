import React from 'react';
import { VideoProject, VideoClip, Transform2D, ClipEffects, Transition, TransitionType, TextLayerData } from '../types';
import { COLOR_PRESETS } from '../engine/filterEngine';

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
}

const TRANSITION_OPTIONS: { value: TransitionType; label: string }[] = [
  { value: 'cut', label: 'Yok / Sert Kesim (Cut)' },
  { value: 'crossfade', label: 'Çapraz Geçiş (Crossfade)' },
  { value: 'fade-black', label: 'Karararak Geçiş (Dip to Black)' },
  { value: 'fade-white', label: 'Parlama Geçiş (Dip to White)' },
  { value: 'slide-left', label: 'Sola Kaydır (Slide Left)' },
  { value: 'slide-right', label: 'Sağa Kaydır (Slide Right)' },
  { value: 'zoom-in', label: 'Yakınlaşarak (Zoom In)' },
  { value: 'zoom-out', label: 'Uzaklaşarak (Zoom Out)' },
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
}) => {
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
                {project.resolution.width} x {project.resolution.height} ({project.resolution.width > project.resolution.height ? '16:9 Yatay' : '9:16 Dikey'})
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
            Düzenlemek istediğiniz klibi zaman çizelgesinden seçin.
          </div>
        </div>
      </aside>
    );
  }

  // Helper update callbacks
  const updateTransform = (partial: Partial<Transform2D>) => {
    onUpdateClip(selectedClip.id, {
      transform: {
        ...(selectedClip.transform || { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 }),
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
        {/* TEXT LAYER SECTION */}
        {selectedClip.type === 'text' && selectedClip.textData && (
          <div className="space-y-3 p-3 rounded-lg bg-[#161b22] border border-[#30363d]">
            <h4 className="font-semibold text-indigo-400 text-[11px] uppercase tracking-wider">
              Metin Ayarları (Türkçe Uyumlu)
            </h4>

            <div>
              <label className="text-gray-400 text-[10px] block mb-1">Metin İçeriği</label>
              <textarea
                rows={3}
                value={selectedClip.textData.text}
                onChange={(e) => updateTextData({ text: e.target.value })}
                className="w-full p-2 rounded bg-[#0d1117] border border-[#30363d] text-white outline-none focus:border-indigo-500 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-gray-400 text-[10px] block mb-1">Font Boyutu ({selectedClip.textData.fontSize}px)</label>
                <input
                  type="range"
                  min="16"
                  max="140"
                  value={selectedClip.textData.fontSize}
                  onChange={(e) => updateTextData({ fontSize: parseInt(e.target.value) })}
                  className="w-full accent-indigo-500"
                />
              </div>

              <div>
                <label className="text-gray-400 text-[10px] block mb-1">Metin Rengi</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    value={selectedClip.textData.fillColor || '#FFFFFF'}
                    onChange={(e) => updateTextData({ fillColor: e.target.value })}
                    className="w-7 h-7 rounded border border-[#30363d] bg-transparent cursor-pointer"
                  />
                  <span className="text-[11px] font-mono text-gray-300">
                    {selectedClip.textData.fillColor || '#FFFFFF'}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <label className="text-gray-400 text-[10px] block mb-1">Animasyon</label>
              <select
                value={selectedClip.textData.animation?.type || 'none'}
                onChange={(e) =>
                  updateTextData({
                    animation: {
                      type: e.target.value as 'none' | 'fade' | 'slide-up' | 'slide-down' | 'scale' | 'typewriter',
                      duration: selectedClip.textData?.animation?.duration || 0.5,
                    },
                  })
                }
                className="w-full px-2 py-1.5 rounded bg-[#0d1117] border border-[#30363d] text-white outline-none"
              >
                <option value="none">Animasyonsuz</option>
                <option value="fade">Yumuşak Belirme (Fade)</option>
                <option value="slide-up">Aşağıdan Yukarı Kayma (Slide Up)</option>
                <option value="slide-down">Yukarıdan Aşağı Kayma (Slide Down)</option>
                <option value="scale">Büyüyerek Belirme (Scale Pop)</option>
                <option value="typewriter">Daktilo Yazısı (Typewriter)</option>
              </select>
            </div>
          </div>
        )}

        {/* TRANSFORM SECTION */}
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

        {/* TRANSITIONS SECTION */}
        {(selectedClip.type === 'video' || selectedClip.type === 'image') && (
          <div className="space-y-3">
            <h4 className="font-semibold text-gray-300 text-[11px] uppercase tracking-wider">
              Geçiş Efektleri (Transitions)
            </h4>

            <div>
              <label className="text-gray-400 text-[10px] block mb-1">Giriş Geçişi (Transition In)</label>
              <select
                value={selectedClip.transitionIn?.type || 'cut'}
                onChange={(e) => {
                  const type = e.target.value as TransitionType;
                  if (type === 'cut') {
                    onUpdateClip(selectedClip.id, { transitionIn: undefined });
                  } else {
                    onUpdateClip(selectedClip.id, {
                      transitionIn: { type, duration: selectedClip.transitionIn?.duration || 0.8 },
                    });
                  }
                }}
                className="w-full px-2 py-1.5 rounded bg-[#161b22] border border-[#30363d] text-white outline-none"
              >
                {TRANSITION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
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
                  if (type === 'cut') {
                    onUpdateClip(selectedClip.id, { transitionOut: undefined });
                  } else {
                    onUpdateClip(selectedClip.id, {
                      transitionOut: { type, duration: selectedClip.transitionOut?.duration || 0.8 },
                    });
                  }
                }}
                className="w-full px-2 py-1.5 rounded bg-[#161b22] border border-[#30363d] text-white outline-none"
              >
                {TRANSITION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
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
