import React, { useState } from 'react';
import { VideoProject } from '../types';
import {
  Undo2,
  Redo2,
  Download,
  Sparkles,
  Edit2,
  Check,
  Film,
  Monitor,
  Smartphone,
  Square,
  ArrowLeft,
  Keyboard,
} from 'lucide-react';
import { IconButton } from './ui/IconButton';

interface TopbarProps {
  project: VideoProject;
  onUpdateProjectName: (name: string) => void;
  onUpdateResolution: (width: number, height: number) => void;
  onUpdateFps: (fps: number) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onOpenExport: () => void;
  onOpenAi: () => void;
  onOpenShortcuts?: () => void;
  onNavigateHome?: () => void;
  isDirty?: boolean;
  saveStatus?: 'saved' | 'saving' | 'error';
}

const RESOLUTION_PRESETS = [
  { label: '1080p Full HD (16:9)', width: 1920, height: 1080 },
  { label: '720p HD (16:9)', width: 1280, height: 720 },
  { label: '4K Ultra HD (16:9)', width: 3840, height: 2160 },
  { label: '1080p Dikey Reels (9:16)', width: 1080, height: 1920 },
  { label: '1080p Kare Post (1:1)', width: 1080, height: 1080 },
];

export const VideoEditorTopbar: React.FC<TopbarProps> = ({
  project,
  onUpdateProjectName,
  onUpdateResolution,
  onUpdateFps,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onOpenExport,
  onOpenAi,
  onOpenShortcuts,
  onNavigateHome,
  isDirty,
  saveStatus,
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(project.name);
  const [viewScale, setViewScale] = useState<'fit' | '50' | '100'>('fit');

  const handleNameSubmit = () => {
    setIsEditingName(false);
    if (tempName.trim()) {
      onUpdateProjectName(tempName.trim());
    } else {
      setTempName(project.name);
    }
  };

  const currentResKey = `${project.resolution.width}x${project.resolution.height}`;

  return (
    <header className="h-[46px] bg-[#0B0D10] border-b border-[#292F39] flex items-center justify-between px-3 select-none shrink-0 z-30 font-sans">
      {/* 1. SOL BÖLÜM: Forma Logosu, Proje Adı, Kaydetme Durumu, Undo/Redo */}
      <div className="flex items-center gap-2.5 min-w-0">
        {onNavigateHome && (
          <button
            type="button"
            onClick={onNavigateHome}
            title="Ana Sayfaya Dön"
            className="w-7 h-7 rounded-[3px] text-[#929AA8] hover:text-[#E7EAF0] hover:bg-[#171B21] flex items-center justify-center transition-colors"
          >
            <ArrowLeft size={14} />
          </button>
        )}

        {/* Forma Brand Logo & Title (PRO ROZETİ VE SLOGAN YOK) */}
        <div className="flex items-center gap-1.5 pr-2 border-r border-[#292F39]">
          <div className="w-5 h-5 rounded-[3px] bg-[#171B21] border border-[#292F39] flex items-center justify-center text-[#E7EAF0]">
            <Film size={12} className="text-[#4f6bf5]" />
          </div>
          <span className="font-semibold text-xs tracking-tight text-[#E7EAF0]">FORMA</span>
        </div>

        {/* Proje Adı (Düzenlenebilir) */}
        <div className="flex items-center gap-2 min-w-0">
          {isEditingName ? (
            <input
              type="text"
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              onBlur={handleNameSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleNameSubmit();
                if (e.key === 'Escape') {
                  setIsEditingName(false);
                  setTempName(project.name);
                }
              }}
              autoFocus
              className="px-2 py-0.5 text-xs bg-[#171B21] text-[#E7EAF0] rounded-[3px] border border-[#4f6bf5] outline-none w-44 font-medium"
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setTempName(project.name);
                setIsEditingName(true);
              }}
              className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-[3px] text-xs font-medium text-[#E7EAF0] hover:bg-[#171B21] group transition-colors max-w-[180px]"
              title="Proje Adını Düzenle"
            >
              <span className="truncate">{project.name}</span>
              <Edit2 size={10} className="text-[#5A6270] group-hover:text-[#929AA8] opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          )}

          {/* Kaydetme Durumu (Minimal nokta + metin) */}
          <div className="flex items-center gap-1 text-[10px] font-mono hidden sm:flex">
            {(saveStatus || (isDirty ? 'saving' : 'saved')) === 'saving' ? (
              <span data-testid="autosave-status" className="flex items-center gap-1 text-[#f59e0b]" title="Değişiklikler kaydediliyor...">
                <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b] animate-pulse" />
                <span className="text-[10px]">Kaydediliyor</span>
              </span>
            ) : (saveStatus || (isDirty ? 'saving' : 'saved')) === 'error' ? (
              <span data-testid="autosave-status" className="flex items-center gap-1 text-rose-400" title="Kaydedilemedi!">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                <span className="text-[10px]">Kaydedilemedi</span>
              </span>
            ) : (
              <span data-testid="autosave-status" className="flex items-center gap-1 text-[#10b981]" title="Tüm değişiklikler kaydedildi">
                <Check size={11} className="text-[#10b981]" />
                <span className="text-[10px] text-[#929AA8]">Kaydedildi</span>
              </span>
            )}
          </div>
        </div>

        {/* Undo ve Redo Butonları */}
        <div className="flex items-center ml-1 bg-[#111419] rounded-[3px] border border-[#292F39] p-0.5">
          <IconButton
            icon={<Undo2 size={12} />}
            label="Geri Al"
            shortcut="Ctrl+Z"
            size="xs"
            disabled={!canUndo}
            onClick={onUndo}
          />
          <div className="w-[1px] h-3 bg-[#292F39]" />
          <IconButton
            icon={<Redo2 size={12} />}
            label="Yinele"
            shortcut="Ctrl+Y"
            size="xs"
            disabled={!canRedo}
            onClick={onRedo}
          />
        </div>
      </div>

      {/* 2. ORTA BÖLÜM: En-boy Oranı, Çözünürlük, FPS, Görünüm Ölçeği */}
      <div className="hidden lg:flex items-center gap-2">
        {/* En-boy oranı hızlı seçim */}
        <div className="flex items-center bg-[#111419] rounded-[3px] border border-[#292F39] p-0.5 gap-0.5">
          <button
            type="button"
            onClick={() => onUpdateResolution(1920, 1080)}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded-[2px] text-[10px] font-mono transition-colors ${
              project.resolution.width === 1920 && project.resolution.height === 1080
                ? 'bg-[#202631] text-[#E7EAF0] font-semibold border border-[#292F39]'
                : 'text-[#929AA8] hover:text-[#E7EAF0] hover:bg-[#171B21]'
            }`}
            title="16:9 Yatay"
          >
            <Monitor size={10} />
            <span>16:9</span>
          </button>
          <button
            type="button"
            onClick={() => onUpdateResolution(1080, 1920)}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded-[2px] text-[10px] font-mono transition-colors ${
              project.resolution.width === 1080 && project.resolution.height === 1920
                ? 'bg-[#202631] text-[#E7EAF0] font-semibold border border-[#292F39]'
                : 'text-[#929AA8] hover:text-[#E7EAF0] hover:bg-[#171B21]'
            }`}
            title="9:16 Dikey"
          >
            <Smartphone size={10} />
            <span>9:16</span>
          </button>
          <button
            type="button"
            onClick={() => onUpdateResolution(1080, 1080)}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded-[2px] text-[10px] font-mono transition-colors ${
              project.resolution.width === 1080 && project.resolution.height === 1080
                ? 'bg-[#202631] text-[#E7EAF0] font-semibold border border-[#292F39]'
                : 'text-[#929AA8] hover:text-[#E7EAF0] hover:bg-[#171B21]'
            }`}
            title="1:1 Kare"
          >
            <Square size={9} />
            <span>1:1</span>
          </button>
        </div>

        {/* Çözünürlük Seçici */}
        <select
          value={currentResKey}
          onChange={(e) => {
            const [w, h] = e.target.value.split('x').map(Number);
            onUpdateResolution(w, h);
          }}
          className="h-6 bg-[#111419] border border-[#292F39] text-[#E7EAF0] text-[11px] rounded-[3px] px-1.5 outline-none hover:border-[#3B4351] focus:border-[#4f6bf5] cursor-pointer"
        >
          {RESOLUTION_PRESETS.map((p) => (
            <option key={`${p.width}x${p.height}`} value={`${p.width}x${p.height}`}>
              {p.label}
            </option>
          ))}
        </select>

        {/* FPS Seçici */}
        <select
          value={project.fps}
          onChange={(e) => onUpdateFps(Number(e.target.value))}
          className="h-6 bg-[#111419] border border-[#292F39] text-[#E7EAF0] text-[11px] font-mono rounded-[3px] px-1.5 outline-none hover:border-[#3B4351] focus:border-[#4f6bf5] cursor-pointer"
        >
          <option value={24}>24 fps</option>
          <option value={30}>30 fps</option>
          <option value={60}>60 fps</option>
        </select>

        {/* Görünüm Ölçeği */}
        <select
          value={viewScale}
          onChange={(e) => setViewScale(e.target.value as any)}
          className="h-6 bg-[#111419] border border-[#292F39] text-[#929AA8] text-[10px] font-mono rounded-[3px] px-1.5 outline-none hover:border-[#3B4351] cursor-pointer"
          title="Önizleme Tuvali Görünüm Ölçeği"
        >
          <option value="fit">Sığdır</option>
          <option value="50">50%</option>
          <option value="100">100%</option>
        </select>
      </div>

      {/* 3. SAĞ BÖLÜM: Forma AI, Kısayollar, Dışa Aktar */}
      <div className="flex items-center gap-1.5">
        {onOpenShortcuts && (
          <button
            type="button"
            onClick={onOpenShortcuts}
            className="flex items-center gap-1 h-6 px-2 rounded-[3px] text-[11px] text-[#929AA8] hover:text-[#E7EAF0] hover:bg-[#171B21] transition-colors"
            title="Klavye Kısayolları (Ctrl+/)"
          >
            <Keyboard size={12} />
            <span className="hidden xl:inline">Kısayollar</span>
          </button>
        )}

        {/* Forma AI Asistanı */}
        <button
          type="button"
          data-action="open-ai"
          onClick={onOpenAi}
          className="flex items-center gap-1.5 h-6 px-2.5 rounded-[3px] text-[11px] font-medium bg-[#171B21] text-[#E7EAF0] hover:bg-[#202631] border border-[#292F39] transition-colors"
          title="Forma AI Komut Paneli"
        >
          <Sparkles size={11} className="text-[#4f6bf5]" />
          <span>Forma AI</span>
        </button>

        {/* Dışa Aktar (Kompakt ana eylem butonu) */}
        <button
          type="button"
          data-action="open-export"
          onClick={onOpenExport}
          className="flex items-center gap-1.5 h-6 px-3 rounded-[3px] text-xs font-semibold text-white bg-[#4f6bf5] hover:bg-[#3b55d9] active:bg-[#2e47c7] border border-[#4f6bf5]/60 transition-colors select-none"
          title="Videoyu Dışa Aktar"
        >
          <Download size={12} strokeWidth={2.2} />
          <span>Dışa Aktar</span>
        </button>
      </div>
    </header>
  );
};
