import React, { useState, useMemo, useEffect } from 'react';
import {
  VideoProject,
  VideoClip,
  Transform2D,
  ClipEffects,
  Transition,
  TimelineTransition,
  EffectSegment,
  TransitionType,
  TextLayerData,
  TextInAnimationType,
  TextLoopAnimationType,
  TextOutAnimationType,
  TextEasingType,
} from '../types';
import { COLOR_PRESETS, VISUAL_EFFECT_DEFINITIONS } from '../engine/filterEngine';
import { TRANSITION_DEFINITIONS } from '../engine/transitionEngine';
import { audioMixer } from '../engine/audioMixer';
import { TEXT_STYLE_PRESETS } from '../engine/textRasterizer';
import { FONT_CATALOG, FONT_CATEGORIES, loadGoogleFont, prefetchCategoryFonts, FontCategory } from '../engine/fontCatalog';
import { notifyCanvasNeedsRedraw } from '../engine/previewRenderer';
import {
  SlidersHorizontal,
  Activity,
  Crop,
  Palette,
  Volume2,
  VolumeX,
  Type,
  Trash2,
  Copy,
  Film,
  Music,
  Image as ImageIcon,
  Sparkles,
  Shuffle,
  Wand2,
  Check,
  RotateCcw,
  X,
  Settings,
  Clock,
  Sliders,
  Move,
  MoveLeft,
  MoveRight,
  MoveUp,
  MoveDown,
  ArrowRight,
  ArrowLeft,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Zap,
  Heart,
  Sun,
  Square,
  Circle,
  AlertTriangle,
  CheckCircle2,
  Search,
  Info,
} from 'lucide-react';
import { InspectorRow } from './ui/InspectorRow';
import { SectionHeader } from './ui/SectionHeader';
import { EmptyState } from './ui/EmptyState';
import { InspectorSection } from './ui/InspectorSection';
import { NumericField } from './ui/NumericField';
import { PanelHeader } from './ui/PanelHeader';

interface PropertiesPanelProps {
  project: VideoProject;
  selectedClip: VideoClip | null;
  currentTime?: number;
  selectedTransitionId?: string | null;
  selectedEffectSegmentId?: string | null;
  onUpdateClip: (clipId: string, updates: Partial<VideoClip>) => void;
  onDeleteClip: (clipId: string) => void;
  onRippleDeleteClip: (clipId: string) => void;
  onDuplicateClip: (clipId: string) => void;
  onSetBackgroundColor: (color: string) => void;
  onSetDuration: (duration: number) => void;
  onDetachAudio?: (clipId: string) => void;
  onPreviewAnimation?: (target: string | number, durationSec?: number) => void;
  onSeek?: (time: number) => void;
  onUpdateTimelineTransition?: (id: string, updates: Partial<TimelineTransition>) => void;
  onDeleteTimelineTransition?: (id: string) => void;
  onUpdateEffectSegment?: (segmentId: string, updates: Partial<EffectSegment>) => void;
  onDeleteEffectSegment?: (segmentId: string) => void;
  onDeselectTransition?: () => void;
  onDeselectEffectSegment?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

const IN_ANIMATIONS: { id: TextInAnimationType; name: string; desc: string; tag: string }[] = [
  { id: 'typewriter', name: 'Daktilo Yazısı', desc: 'Harf harf daktilo gibi yazılır', tag: 'Daktilo' },
  { id: 'pop', name: 'Yaylı Pop', desc: 'Esnek yay hareketiyle fırlar', tag: 'Pop' },
  { id: 'scale', name: 'Büyüyerek Açılma', desc: 'Merkezden büyüyerek açılır', tag: 'Zoom' },
  { id: 'fade', name: 'Yumuşak Belirme', desc: 'Opaklık akıcı şekilde artar', tag: 'Fade' },
  { id: 'slide-up', name: 'Aşağıdan Yukarı', desc: 'Alttan yumuşakça kayar', tag: 'Kayma' },
  { id: 'slide-down', name: 'Tavandan Düşüş', desc: 'Tavandan yumuşakça iner', tag: 'İnme' },
  { id: 'slide-left', name: 'Sağdan Sola', desc: 'Sağdan akarak gelir', tag: 'Kayma' },
  { id: 'slide-right', name: 'Soldan Sağa', desc: 'Soldan akarak gelir', tag: 'Kayma' },
  { id: 'blur-in', name: 'Bulanıktan Net', desc: 'Netleşerek görünür', tag: 'Netleşme' },
  { id: 'flip', name: '3D Fırdöndü / Takla', desc: 'Y ekseninde 3D dönerek açılır', tag: '3D Spin' },
  { id: 'neon-flash', name: 'Neon Flaş & Çakma', desc: 'Neon flaş çakışlarıyla yanar', tag: 'Neon' },
  { id: 'glitch', name: 'Siber Glitch', desc: 'Dijital parazit ve kaymalar', tag: 'Glitch' },
  { id: 'tracking', name: 'Sinematik Genişleme', desc: 'Harf aralığı açılarak yayılır', tag: 'Sinema' },
  { id: 'bounce-drop', name: 'Zıplayan Düşüş', desc: 'Yukarıdan düşüp yaylanır', tag: 'Zıplama' },
  { id: 'wave', name: 'Dalgalı Giriş', desc: 'Sinüs dalgasıyla süzülür', tag: 'Dalga' },
  { id: 'crash-zoom', name: 'Çarpıcı Yakınlaşma', desc: 'Devasa boyuttan yerine oturur', tag: 'Crash' },
  { id: 'word-by-word', name: 'Kelime Kelime', desc: 'Kelimeler sırayla belirir', tag: 'Kelime' },
  { id: 'char-by-char', name: 'Harf Harf', desc: 'Harfler teker teker açılır', tag: 'Harf' },
  { id: 'none', name: 'Animasyonsuz', desc: 'Doğrudan sabit görünür', tag: 'Sabit' },
];

const LOOP_ANIMATIONS: { id: TextLoopAnimationType; name: string }[] = [
  { id: 'none', name: 'Döngü Yok (Sabit)' },
  { id: 'pulse', name: 'Nabız Atışı (Pulse)' },
  { id: 'heartbeat', name: 'Kalp Ritmi (Heartbeat)' },
  { id: 'float', name: 'Havada Süzülme (Float)' },
  { id: 'shimmer', name: 'Işıltı & Parıldama (Shimmer)' },
  { id: 'glow-breathe', name: 'Nefes Alan Neon (Glow)' },
  { id: 'jitter', name: 'Dijital Titreme (Jitter)' },
  { id: 'strobe', name: 'Flaşör / Çakar (Strobe)' },
  { id: 'spin-slow', name: 'Ağır 3D Salınım (Tilt)' },
];

const OUT_ANIMATIONS: { id: TextOutAnimationType; name: string }[] = [
  { id: 'none', name: 'Çıkış Yok (Sert Kesim)' },
  { id: 'fade', name: 'Kaybolma (Fade Out)' },
  { id: 'slide-down', name: 'Aşağı Kayarak Çıkış' },
  { id: 'slide-up', name: 'Yukarı Kayarak Çıkış' },
  { id: 'scale-down', name: 'Küçülerek Kaybolma' },
  { id: 'blur-out', name: 'Bulanıklaşarak Çıkış' },
  { id: 'typewriter-erase', name: 'Daktilo ile Silinme' },
  { id: 'glitch-out', name: 'Dijital Dağılma (Glitch)' },
  { id: 'flip-out', name: '3D Dönerek Kaybolma' },
  { id: 'crash-out', name: 'Sonsuza Fırlama (Crash)' },
];

const getAnimationLucideIcon = (id: string) => {
  switch (id) {
    case 'typewriter':
    case 'word-by-word':
    case 'char-by-char':
      return <Type className="w-3.5 h-3.5 text-indigo-400" />;
    case 'pop':
    case 'bounce-drop':
      return <Sparkles className="w-3.5 h-3.5 text-amber-400" />;
    case 'scale':
    case 'scale-down':
    case 'crash-zoom':
    case 'crash-out':
      return <ZoomIn className="w-3.5 h-3.5 text-sky-400" />;
    case 'fade':
    case 'shimmer':
      return <Sparkles className="w-3.5 h-3.5 text-purple-400" />;
    case 'slide-up':
      return <MoveUp className="w-3.5 h-3.5 text-emerald-400" />;
    case 'slide-down':
      return <MoveDown className="w-3.5 h-3.5 text-rose-400" />;
    case 'slide-left':
      return <MoveLeft className="w-3.5 h-3.5 text-cyan-400" />;
    case 'slide-right':
      return <MoveRight className="w-3.5 h-3.5 text-blue-400" />;
    case 'flip':
    case 'flip-out':
    case 'spin-slow':
      return <RotateCw className="w-3.5 h-3.5 text-amber-400" />;
    case 'neon-flash':
    case 'glitch':
    case 'glitch-out':
      return <Zap className="w-3.5 h-3.5 text-yellow-400" />;
    case 'pulse':
    case 'heartbeat':
      return <Heart className="w-3.5 h-3.5 text-rose-400" />;
    case 'glow-breathe':
      return <Sun className="w-3.5 h-3.5 text-amber-400" />;
    case 'jitter':
    case 'strobe':
      return <Activity className="w-3.5 h-3.5 text-indigo-400" />;
    case 'none':
      return <Square className="w-3.5 h-3.5 text-gray-500" />;
    default:
      return <Sparkles className="w-3.5 h-3.5 text-gray-400" />;
  }
};

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
  currentTime = 0,
  selectedTransitionId,
  selectedEffectSegmentId,
  onUpdateClip,
  onDeleteClip,
  onRippleDeleteClip,
  onDuplicateClip,
  onSetBackgroundColor,
  onSetDuration,
  onDetachAudio,
  onPreviewAnimation,
  onSeek,
  onUpdateTimelineTransition,
  onDeleteTimelineTransition,
  onUpdateEffectSegment,
  onDeleteEffectSegment,
  onDeselectTransition,
  onDeselectEffectSegment,
  className,
  style,
}) => {
  const [isFontPickerOpen, setIsFontPickerOpen] = useState(false);
  const [fontSearch, setFontSearch] = useState('');
  const [fontCategory, setFontCategory] = useState<FontCategory>('all');
  const [activeTransitionTab, setActiveTransitionTab] = useState<'in' | 'out'>('in');
  const [activeTab, setActiveTab] = useState<'basic' | 'animation' | 'mask' | 'color' | 'audio'>('basic');
  const [activeTextTab, setActiveTextTab] = useState<'text' | 'animation' | 'transform'>('text');

  useEffect(() => {
    if (selectedClip?.type === 'text') {
      setActiveTextTab('text');
    } else if (selectedClip?.type === 'audio') {
      setActiveTab('audio');
    } else {
      if (activeTab === 'audio' && selectedClip?.type === 'image') {
        setActiveTab('basic');
      }
    }
  }, [selectedClip?.id, selectedClip?.type]);

  useEffect(() => {
    if (isFontPickerOpen) {
      prefetchCategoryFonts(fontCategory);
    }
  }, [isFontPickerOpen, fontCategory]);

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

  const [transSearch, setTransSearch] = useState('');
  const [transCategory, setTransCategory] = useState<string>('all');

  // 1. Transition Inspector takes precedence whenever a transition is selected
  if (selectedTransitionId) {
    const tr =
      project.transitions?.find((t) => t.id === selectedTransitionId) ||
      project.tracks.flatMap((t) => t.transitions || []).find((t) => t.id === selectedTransitionId);

    if (tr) {
      const trDef = TRANSITION_DEFINITIONS.find((d) => d.id === tr.type);
      const track = project.tracks.find((t) => t.id === tr.trackId);
      const leftClip = track?.clips.find((c) => c.id === tr.leftClipId);
      const rightClip = track?.clips.find((c) => c.id === tr.rightClipId);

      // Handle calculations & Safe Duration
      const leftHandleSec = leftClip?.sourceDuration
        ? Math.max(0, leftClip.sourceDuration - (leftClip.trimIn + leftClip.duration))
        : 0;
      const rightHandleSec = rightClip ? rightClip.trimIn : 0;
      const requiredHalf = tr.duration / 2;

      // Calculate max safe duration without freezing frames
      const isBetweenBlocked = leftHandleSec <= 0.001 || rightHandleSec <= 0.001;
      const maxSafeDuration = tr.alignment === 'between'
        ? (isBetweenBlocked ? 0.0 : Math.min(5.0, parseFloat((2 * Math.min(leftHandleSec, rightHandleSec)).toFixed(2))))
        : tr.alignment === 'in'
        ? (rightHandleSec <= 0.001 ? 0.0 : Math.min(5.0, parseFloat(rightHandleSec.toFixed(2))))
        : (leftHandleSec <= 0.001 ? 0.0 : Math.min(5.0, parseFloat(leftHandleSec.toFixed(2))));

      const hasHandleWarning = Boolean(
        leftClip && rightClip && (
          tr.alignment === 'between'
            ? (leftHandleSec < requiredHalf || rightHandleSec < requiredHalf || isBetweenBlocked)
            : tr.alignment === 'in'
            ? rightHandleSec < tr.duration
            : leftHandleSec < tr.duration
        )
      );

      // Telemetry
      const audioCurve = tr.audioCurve || 'constant-power';
      const telemetry = audioMixer.getCrossfadeTelemetry(0.5, audioCurve);
      const gainOutDb = (20 * Math.log10(Math.max(0.001, telemetry.gainOut))).toFixed(1);
      const gainInDb = (20 * Math.log10(Math.max(0.001, telemetry.gainIn))).toFixed(1);
      const powerDb = (10 * Math.log10(Math.max(0.001, telemetry.totalPower))).toFixed(1);

      // Filter transitions for type selector
      const availableTransitions = TRANSITION_DEFINITIONS.filter((t) => {
        if (t.id === 'cut' || t.id === 'none') return false;
        const matchCat = transCategory === 'all' || t.category === transCategory;
        const matchSearch =
          !transSearch.trim() ||
          t.name.toLowerCase().includes(transSearch.toLowerCase()) ||
          t.id.toLowerCase().includes(transSearch.toLowerCase());
        return matchCat && matchSearch;
      });

      // Calculate start and end times on timeline
      const halfDur = tr.duration / 2;
      const startTime = tr.alignment === 'in' ? tr.cutTime : tr.alignment === 'out' ? tr.cutTime - tr.duration : tr.cutTime - halfDur;
      const endTime = tr.alignment === 'in' ? tr.cutTime + tr.duration : tr.alignment === 'out' ? tr.cutTime : tr.cutTime + halfDur;

      return (
        <aside
          className={`bg-[#111419] border-l border-[#292F39] flex flex-col shrink-0 select-none z-10 overflow-y-auto overflow-x-hidden custom-scrollbar text-xs ${
            className || ''
          }`}
          style={style || { width: 300 }}
        >
          <PanelHeader
            title="Geçiş Özellikleri"
            badge={trDef?.name || tr.type}
            onClose={onDeselectTransition}
          />

          <div className="p-3 space-y-3 min-w-0 overflow-x-hidden">
            {/* 1. Header Overview & Timeline Location */}
            <div className="p-2.5 rounded-[3px] bg-[#171B21] border border-[#292F39] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#E7EAF0] flex items-center gap-1.5 truncate">
                  <Shuffle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="truncate">{trDef?.name || tr.type}</span>
                </span>
                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 shrink-0">
                  {trDef?.category === 'basic'
                    ? 'Temel'
                    : trDef?.category === 'slide-push'
                    ? 'Kaydırma'
                    : trDef?.category === 'wipe-mask'
                    ? 'Silme'
                    : trDef?.category === 'camera-motion'
                    ? 'Kamera'
                    : 'Sinematik'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px] pt-1 border-t border-[#232934] text-[#929AA8]">
                <div>
                  <span className="block text-[#5A6270] text-[9px]">Kesim Zamanı</span>
                  <span className="font-mono text-[#cbd5e1] font-semibold">{tr.cutTime.toFixed(2)}s</span>
                </div>
                <div>
                  <span className="block text-[#5A6270] text-[9px]">Geçiş Aralığı</span>
                  <span className="font-mono text-[#cbd5e1] font-semibold">{Math.max(0, startTime).toFixed(2)}s – {endTime.toFixed(2)}s</span>
                </div>
              </div>
            </div>

            {/* 2. Media Handles Warning Check */}
            {hasHandleWarning ? (
              <div className="p-2.5 rounded-[3px] bg-amber-950/30 border border-amber-500/50 text-amber-200 text-[11px] space-y-1.5">
                <div className="flex items-start gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block text-amber-300">Yetersiz Medya Kolu (Handle)</span>
                    <p className="text-[10px] text-amber-200/90 mt-0.5 leading-tight">
                      {isBetweenBlocked && tr.alignment === 'between'
                        ? 'Sol ve sağ medya kolu 0.00s olduğu için ortalı crossfade engellenmiştir.'
                        : 'Kliplerde bu geçiş süresini karşılayacak yeterli ek kare bulunmuyor.'}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1 text-[9px] font-mono bg-black/40 p-1.5 rounded border border-amber-500/20 text-[#cbd5e1]">
                  <div>Sol Ek Kare: <span className="text-amber-300">{leftHandleSec.toFixed(2)}s</span></div>
                  <div>Sağ Ek Kare: <span className="text-amber-300">{rightHandleSec.toFixed(2)}s</span></div>
                </div>
                <div className="pt-1 flex items-center justify-between gap-1">
                  <span className="text-[10px] text-amber-300 font-medium">
                    Güvenli Süre: <span className="font-mono font-bold">{maxSafeDuration.toFixed(2)}s</span>
                  </span>
                  {maxSafeDuration > 0 ? (
                    <button
                      type="button"
                      onClick={() => onUpdateTimelineTransition?.(tr.id, { duration: maxSafeDuration })}
                      className="px-2 py-1 rounded-[2px] bg-amber-500 hover:bg-amber-400 text-black text-[10px] font-bold shadow transition-colors shrink-0"
                    >
                      Süreyi {maxSafeDuration.toFixed(1)} sn&apos;ye İndir
                    </button>
                  ) : (
                    <span className="px-2 py-1 rounded-[2px] bg-rose-950/60 border border-rose-500/50 text-rose-300 text-[9px] font-bold shrink-0">
                      Ortalı Crossfade Engellendi (0.00s)
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-2 rounded-[3px] bg-emerald-950/20 border border-emerald-500/30 text-emerald-300 text-[10px] flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Kliplerde yeterli ek kare (handle) mevcut.</span>
              </div>
            )}

            {/* 3. Duration & Alignment */}
            <div className="p-2.5 rounded-[3px] bg-[#171B21] border border-[#292F39] space-y-3">
              <span className="text-[#929AA8] font-medium text-[11px] block">Süre ve Hizalama</span>
              <NumericField
                label="Geçiş Süresi"
                value={parseFloat(tr.duration.toFixed(2))}
                min={0.1}
                max={5.0}
                step={0.05}
                unit="s"
                defaultValue={1.0}
                onChange={(val) => onUpdateTimelineTransition?.(tr.id, { duration: Math.max(0.1, Math.min(5.0, val)) })}
              />

              <div className="space-y-1">
                <span className="text-[#5A6270] text-[10px] block">Kesim Hizalaması</span>
                <div className="grid grid-cols-3 gap-1">
                  {(['between', 'in', 'out'] as const).map((align) => {
                    const isDisabled = align === 'between' && isBetweenBlocked;
                    return (
                      <button
                        key={align}
                        disabled={isDisabled}
                        title={
                          isDisabled
                            ? 'Ortalı crossfade için iki klipte de ek kare (handle) bulunmalıdır. Kliplerde ek kare olmadığı için (0.00s) ortalı crossfade engellenmiştir.'
                            : undefined
                        }
                        onClick={() => onUpdateTimelineTransition?.(tr.id, { alignment: align })}
                        className={`py-1.5 rounded-[2px] text-[10px] font-medium border transition-colors flex flex-col items-center gap-0.5 ${
                          isDisabled
                            ? 'opacity-40 cursor-not-allowed bg-[#0e1014] text-[#5A6270] border-[#202531]'
                            : (tr.alignment || 'between') === align
                            ? 'bg-[#202631] text-amber-300 border-amber-400 font-semibold shadow-sm'
                            : 'bg-[#111419] text-[#929AA8] border-[#292F39] hover:bg-[#171B21] hover:text-[#E7EAF0]'
                        }`}
                      >
                        <span>{align === 'between' ? 'Ortalı' : align === 'in' ? 'Girişte' : 'Çıkışta'}</span>
                        <span className="text-[8px] opacity-60">
                          {align === 'between' ? '(-½ .. +½)' : align === 'in' ? '(0 .. +1)' : '(-1 .. 0)'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 4. Motion & Dynamic Parameters */}
            <div className="p-2.5 rounded-[3px] bg-[#171B21] border border-[#292F39] space-y-2.5">
              <span className="text-[#929AA8] font-medium text-[11px] block">Hareket & Geçiş Dinamikleri</span>

              {/* Easing Curve */}
              <div className="space-y-1">
                <span className="text-[#5A6270] text-[10px] block">Hızlanma Eğrisi (Easing)</span>
                <div className="grid grid-cols-2 gap-1">
                  {[
                    { id: 'linear', label: 'Doğrusal', en: 'Linear' },
                    { id: 'ease-in-out', label: 'Yumuşak', en: 'Ease In-Out' },
                    { id: 'ease-in', label: 'Hızlanan', en: 'Ease In' },
                    { id: 'ease-out', label: 'Yavaşlayan', en: 'Ease Out' },
                  ].map((curve) => (
                    <button
                      key={curve.id}
                      type="button"
                      title={curve.en}
                      onClick={() => onUpdateTimelineTransition?.(tr.id, { easing: curve.id as any })}
                      className={`py-1 px-1.5 rounded-[2px] text-[10px] font-medium border text-center truncate transition-colors ${
                        (tr.easing || 'linear') === curve.id
                          ? 'bg-[#202631] text-amber-300 border-amber-400 font-semibold shadow-sm'
                          : 'bg-[#111419] text-[#929AA8] border-[#292F39] hover:border-[#4f6bf5] hover:text-[#E7EAF0]'
                      }`}
                    >
                      {curve.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Direction Selector */}
              <div className="space-y-1">
                <span className="text-[#5A6270] text-[10px] block">Hareket Yönü</span>
                <div className="grid grid-cols-4 gap-1">
                  {[
                    { id: 'left', label: 'Sol', icon: MoveLeft },
                    { id: 'right', label: 'Sağ', icon: MoveRight },
                    { id: 'up', label: 'Yukarı', icon: MoveUp },
                    { id: 'down', label: 'Aşağı', icon: MoveDown },
                  ].map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      onClick={() => onUpdateTimelineTransition?.(tr.id, { direction: id as any })}
                      className={`py-1 px-1 rounded-[2px] text-[10px] font-medium border flex items-center justify-center gap-1 transition-colors ${
                        (tr.direction || 'left') === id
                          ? 'bg-[#202631] text-amber-300 border-amber-400 font-semibold'
                          : 'bg-[#111419] text-[#929AA8] border-[#292F39] hover:border-[#4f6bf5]'
                      }`}
                      title={label}
                    >
                      <Icon className="w-3 h-3" />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Feather / Edge Softness */}
              <NumericField
                label="Kenar Yumuşatma (Feather)"
                value={tr.feather ?? 10}
                min={0}
                max={50}
                step={1}
                unit="px"
                defaultValue={10}
                onChange={(val) => onUpdateTimelineTransition?.(tr.id, { feather: val })}
              />

              {/* Color Picker for Dip / Flash / Tint */}
              <div className="space-y-1.5 pt-1 border-t border-[#232934]">
                <div className="flex items-center justify-between">
                  <span className="text-[#5A6270] text-[10px]">Geçiş Rengi (Dip / Flaş)</span>
                  <span className="font-mono text-[10px] text-[#cbd5e1]">{tr.color || '#000000'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {['#000000', '#ffffff', '#f59e0b', '#3b82f6', '#ef4444'].map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => onUpdateTimelineTransition?.(tr.id, { color: col })}
                      style={{ backgroundColor: col }}
                      className={`w-5 h-5 rounded-[2px] border ${
                        (tr.color || '#000000').toLowerCase() === col.toLowerCase()
                          ? 'ring-2 ring-amber-400 border-white'
                          : 'border-[#384152] hover:scale-105'
                      }`}
                      title={col}
                    />
                  ))}
                  <input
                    type="color"
                    value={tr.color || '#000000'}
                    onChange={(e) => onUpdateTimelineTransition?.(tr.id, { color: e.target.value })}
                    className="w-6 h-5 p-0 bg-transparent rounded border border-[#292F39] cursor-pointer ml-auto"
                    title="Özel Renk Seç"
                  />
                </div>
              </div>
            </div>

            {/* 5. Audio Crossfade Engine */}
            <div className="p-2.5 rounded-[3px] bg-[#171B21] border border-[#292F39] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[#E7EAF0] font-medium text-[11px] flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                  Ses Çapraz Geçişi (Crossfade)
                </span>
                <input
                  type="checkbox"
                  checked={tr.audioCrossfade !== false}
                  onChange={(e) => onUpdateTimelineTransition?.(tr.id, { audioCrossfade: e.target.checked })}
                  className="w-4 h-4 accent-amber-400 rounded-[2px] cursor-pointer"
                />
              </div>

              {tr.audioCrossfade !== false && (
                <>
                  <div className="space-y-1">
                    <span className="text-[#5A6270] text-[10px] block">Ses Eğrisi</span>
                    <div className="grid grid-cols-3 gap-1">
                      {[
                        { id: 'constant-power', label: 'Sabit Güç' },
                        { id: 'linear', label: 'Doğrusal' },
                        { id: 'ease-in-out', label: 'S-Eğrisi' },
                      ].map((c) => (
                        <button
                          key={c.id}
                          onClick={() => onUpdateTimelineTransition?.(tr.id, { audioCurve: c.id as any })}
                          className={`py-1 rounded-[2px] text-[10px] font-medium border transition-colors ${
                            audioCurve === c.id
                              ? 'bg-[#202631] text-cyan-300 border-cyan-400 font-semibold'
                              : 'bg-[#111419] text-[#929AA8] border-[#292F39] hover:bg-[#171B21]'
                          }`}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Telemetry Card */}
                  <div className="p-2 rounded-[2px] bg-[#12151a] border border-[#202632] space-y-1.5">
                    <div className="flex items-center justify-between text-[9px] text-[#929AA8]">
                      <span className="flex items-center gap-1 font-semibold text-[#cbd5e1]">
                        <Activity className="w-3 h-3 text-cyan-400" />
                        Akustik Telemetri (%50 Kesim)
                      </span>
                      <span className="text-emerald-400 font-mono font-bold">
                        {audioCurve === 'constant-power' ? 'Eşit Enerji (1.00)' : audioCurve === 'linear' ? 'Doğrusal' : 'Yumuşak'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-1 text-[9px]">
                      <div className="px-1.5 py-1 rounded bg-[#171b22] border border-[#283140]">
                        <span className="text-[#5A6270] block text-[8px]">Sol Klip Kazancı (A)</span>
                        <span className="font-mono text-cyan-300 font-bold">{telemetry.gainOut}</span>
                        <span className="text-[#5A6270] ml-1">({gainOutDb} dB)</span>
                      </div>
                      <div className="px-1.5 py-1 rounded bg-[#171b22] border border-[#283140]">
                        <span className="text-[#5A6270] block text-[8px]">Sağ Klip Kazancı (B)</span>
                        <span className="font-mono text-amber-300 font-bold">{telemetry.gainIn}</span>
                        <span className="text-[#5A6270] ml-1">({gainInDb} dB)</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[9px] pt-1 border-t border-[#1e2430]">
                      <span className="text-[#929AA8]">Toplam Akustik Güç:</span>
                      <span className="font-mono text-emerald-400 font-bold">{telemetry.totalPower} ({powerDb} dB)</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* 6. Change Transition Type Selector (52 Transitions Browser) */}
            <div className="p-2.5 rounded-[3px] bg-[#171B21] border border-[#292F39] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[#929AA8] font-medium text-[11px] block">Geçiş Tipini Değiştir</span>
                <span className="text-[10px] text-[#5A6270] font-mono">{availableTransitions.length} / 52</span>
              </div>

              {/* Filter Search */}
              <div className="relative">
                <Search className="w-3 h-3 text-[#5A6270] absolute left-2 top-2 pointer-events-none" />
                <input
                  type="text"
                  value={transSearch}
                  onChange={(e) => setTransSearch(e.target.value)}
                  placeholder="Geçiş filtrele..."
                  className="w-full pl-6 pr-2 py-1 bg-[#111419] border border-[#292F39] rounded-[2px] text-[10px] text-white placeholder-[#5A6270] focus:border-amber-400 focus:outline-none"
                />
              </div>

              {/* Category Pills */}
              <div className="flex flex-wrap gap-1">
                {[
                  { id: 'all', label: 'Tümü' },
                  { id: 'basic', label: 'Temel' },
                  { id: 'slide-push', label: 'Kaydırma' },
                  { id: 'wipe-mask', label: 'Silme' },
                  { id: 'camera-motion', label: 'Kamera' },
                  { id: 'cinematic-digital', label: 'Sinema' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setTransCategory(cat.id)}
                    className={`px-1.5 py-0.5 rounded-[2px] text-[9px] font-medium whitespace-nowrap transition-colors ${
                      transCategory === cat.id
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-[#111419] text-[#929AA8] hover:text-white border border-[#292F39]'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Transitions Grid */}
              <div className="grid grid-cols-2 gap-1 max-h-52 overflow-y-auto pr-1 custom-scrollbar">
                {availableTransitions.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => onUpdateTimelineTransition?.(tr.id, { type: t.id })}
                    className={`p-1.5 rounded-[2px] border text-left text-[10px] flex items-center gap-1.5 transition-colors ${
                      tr.type === t.id
                        ? 'bg-[#202631] text-amber-300 border-amber-400 font-semibold shadow-sm'
                        : 'bg-[#111419] text-[#929AA8] border-[#292F39] hover:border-amber-400/60 hover:text-[#E7EAF0]'
                    }`}
                  >
                    <Shuffle size={11} className={tr.type === t.id ? 'text-amber-400 shrink-0' : 'text-[#5A6270] shrink-0'} />
                    <span className="truncate">{t.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 7. Reset and Delete Action Buttons */}
            <div className="space-y-1.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  onUpdateTimelineTransition?.(tr.id, {
                    duration: 1.0,
                    alignment: 'between',
                    easing: 'linear',
                    direction: 'left',
                    feather: 10,
                    audioCrossfade: true,
                    audioCurve: 'constant-power',
                  });
                }}
                className="w-full py-1.5 rounded-[3px] bg-[#171B21] hover:bg-[#202631] text-[#929AA8] hover:text-white border border-[#292F39] font-medium text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <RotateCcw size={12} />
                <span>Varsayılanlara Sıfırla</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onDeleteTimelineTransition?.(tr.id);
                  onDeselectTransition?.();
                }}
                className="w-full py-1.5 rounded-[3px] bg-red-950/20 hover:bg-red-950/40 text-red-400 hover:text-red-300 border border-red-500/40 font-medium text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <Trash2 size={13} />
                <span>Geçişi Kaldır</span>
              </button>
            </div>
          </div>
        </aside>
      );
    }
  }

  if (!selectedClip) {
    if (selectedEffectSegmentId) {
      const eff =
        project.effectSegments?.find((e) => e.id === selectedEffectSegmentId) ||
        project.tracks.flatMap((t) => t.effectSegments || []).find((e) => e.id === selectedEffectSegmentId) ||
        project.tracks.flatMap((t) => t.clips).flatMap((c) => c.effectSegments || []).find((e) => e.id === selectedEffectSegmentId);

      if (eff) {
        return (
          <aside
            className={`bg-[#111419] border-l border-[#292F39] flex flex-col shrink-0 select-none z-10 overflow-y-auto custom-scrollbar text-xs ${
              className || ''
            }`}
            style={style || { width: 300 }}
          >
            <PanelHeader
              title="Görsel Efekt Şeridi"
              badge={eff.name}
              onClose={onDeselectEffectSegment}
            />

            <div className="p-3 space-y-3">
              {/* Active Toggle */}
              <div className="p-2.5 rounded-[3px] bg-[#171B21] border border-[#292F39] flex items-center justify-between">
                <div>
                  <span className="text-[#E7EAF0] font-medium text-[11px] block">Efekt Aktif</span>
                  <span className="text-[#5A6270] text-[10px]">Önizleme ve dışa aktarımda uygula</span>
                </div>
                <input
                  type="checkbox"
                  checked={eff.enabled}
                  onChange={(e) => onUpdateEffectSegment?.(eff.id, { enabled: e.target.checked })}
                  className="w-4 h-4 accent-[#4f6bf5] rounded-[2px] cursor-pointer"
                />
              </div>

              {/* Sliders with NumericField */}
              <div className="p-2.5 rounded-[3px] bg-[#171B21] border border-[#292F39] space-y-2.5">
                <NumericField
                  label="Yoğunluk"
                  value={Math.round(((eff.parameters?.intensity ?? 1.0) as number) * 100)}
                  min={0}
                  max={100}
                  step={1}
                  unit="%"
                  defaultValue={100}
                  onChange={(val) =>
                    onUpdateEffectSegment?.(eff.id, {
                      parameters: { ...eff.parameters, intensity: val / 100 },
                    })
                  }
                />

                <NumericField
                  label="Hız"
                  value={parseFloat(((eff.parameters?.speed ?? 1.0) as number).toFixed(1))}
                  min={0.2}
                  max={3.0}
                  step={0.1}
                  unit="x"
                  defaultValue={1.0}
                  onChange={(val) =>
                    onUpdateEffectSegment?.(eff.id, {
                      parameters: { ...eff.parameters, speed: val },
                    })
                  }
                />

                <NumericField
                  label="Süre"
                  value={parseFloat(eff.duration.toFixed(1))}
                  min={0.5}
                  max={20}
                  step={0.5}
                  unit="s"
                  defaultValue={3.0}
                  onChange={(val) => onUpdateEffectSegment?.(eff.id, { duration: val })}
                />
              </div>

              {/* Delete button */}
              <button
                onClick={() => {
                  onDeleteEffectSegment?.(eff.id);
                  onDeselectEffectSegment?.();
                }}
                className="w-full py-1.5 rounded-[3px] bg-[#171B21] hover:bg-[#202631] text-[#f87171] border border-[#f87171]/40 font-medium text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <Trash2 size={13} />
                <span>Efekti Kaldır</span>
              </button>
            </div>
          </aside>
        );
      }
    }

    return (
      <aside
        className={`bg-[#111419] border-l border-[#292F39] flex flex-col shrink-0 select-none z-10 overflow-y-auto custom-scrollbar text-xs ${
          className || ''
        }`}
        style={style || { width: 300 }}
      >
        <PanelHeader
          title="Proje Ayarları"
          badge={`${project.fps} FPS`}
        />

        <div className="p-3 space-y-3">
          <div className="p-2.5 rounded-[3px] bg-[#171B21] border border-[#292F39] space-y-1">
            <span className="text-[#5A6270] block text-[10px] uppercase font-bold tracking-tight">Proje Adı</span>
            <p className="text-[#E7EAF0] font-medium text-xs truncate">{project.name}</p>
          </div>

          <div className="p-2.5 rounded-[3px] bg-[#171B21] border border-[#292F39] space-y-2.5">
            <div>
              <span className="text-[#5A6270] block text-[10px] uppercase font-bold tracking-tight mb-0.5">
                Çözünürlük & En-Boy
              </span>
              <p className="text-[#929AA8] font-mono text-[11px]">
                {project.resolution.width} x {project.resolution.height} (
                {project.resolution.width > project.resolution.height ? '16:9 Yatay' : '9:16 Dikey'})
              </p>
            </div>

            <div>
              <span className="text-[#5A6270] block text-[10px] uppercase font-bold tracking-tight mb-0.5">
                Kare Hızı (FPS)
              </span>
              <p className="text-[#929AA8] font-mono text-[11px]">{project.fps} FPS</p>
            </div>

            <div>
              <span className="text-[#5A6270] block text-[10px] uppercase font-bold tracking-tight mb-0.5">
                Toplam Süre (Saniye)
              </span>
              <input
                type="number"
                min="1"
                max="3600"
                value={project.duration}
                onChange={(e) => onSetDuration(Math.max(1, parseInt(e.target.value) || 10))}
                className="w-full h-7 px-2 rounded-[3px] bg-[#111419] border border-[#292F39] text-[#E7EAF0] outline-none focus:border-[#4f6bf5] font-mono text-xs"
              />
            </div>

            <div>
              <span className="text-[#5A6270] block text-[10px] uppercase font-bold tracking-tight mb-0.5">
                Tuval Arka Plan Rengi
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={project.backgroundColor || '#000000'}
                  onChange={(e) => onSetBackgroundColor(e.target.value)}
                  className="w-6 h-6 rounded-[2px] border border-[#292F39] bg-transparent cursor-pointer"
                />
                <span className="font-mono text-[#929AA8] text-xs">{project.backgroundColor || '#000000'}</span>
              </div>
            </div>
          </div>

          <EmptyState
            icon={<Film size={24} className="text-[#5A6270]" />}
            title="Klip Seçilmedi"
            description="Düzenlemek istediğiniz klibi zaman çizelgesinden veya önizleme tuvalinden seçin."
          />
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

  const isTextLike = selectedClip.type === 'text' || selectedClip.type === 'subtitle';
  const isVisualMedia = selectedClip.type === 'video' || selectedClip.type === 'image';
  const isAudioOnly = selectedClip.type === 'audio';

  const renderTransform = () => (
    <InspectorSection
      title="Dönüşüm (Transform)"
      defaultOpen={true}
      onReset={() => updateTransform({ x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 })}
    >
      <div className="p-2.5 space-y-2.5">
        <div className="grid grid-cols-2 gap-2">
          <NumericField
            label="Konum X"
            value={Math.round(transform.x)}
            min={-1920}
            max={1920}
            step={1}
            unit="px"
            defaultValue={0}
            compact={true}
            onChange={(x) => updateTransform({ x })}
          />
          <NumericField
            label="Konum Y"
            value={Math.round(transform.y)}
            min={-1080}
            max={1080}
            step={1}
            unit="px"
            defaultValue={0}
            compact={true}
            onChange={(y) => updateTransform({ y })}
          />
        </div>
        <NumericField
          label="Ölçek"
          value={Math.round(transform.scaleX * 100)}
          min={10}
          max={300}
          step={1}
          unit="%"
          defaultValue={100}
          onChange={(scale) => updateTransform({ scaleX: scale / 100, scaleY: scale / 100 })}
        />
        <NumericField
          label="Opaklık"
          value={Math.round(transform.opacity * 100)}
          min={0}
          max={100}
          step={1}
          unit="%"
          defaultValue={100}
          onChange={(opacity) => updateTransform({ opacity: opacity / 100 })}
        />
        <NumericField
          label="Döndürme"
          value={Math.round(transform.rotation)}
          min={-180}
          max={180}
          step={1}
          unit="°"
          defaultValue={0}
          onChange={(rotation) => updateTransform({ rotation })}
        />
      </div>
    </InspectorSection>
  );

  const renderKeyframeStudio = () => {
    const relTime = Number(
      Math.max(0, Math.min(selectedClip.duration, (currentTime - selectedClip.startTime) * (selectedClip.speed || 1))).toFixed(2)
    );
    const keyframes = selectedClip.keyframes || [];
    const existingKfIndex = keyframes.findIndex((kf) => Math.abs(kf.time - relTime) < 0.08);
    const hasKfAtPlayhead = existingKfIndex !== -1;

    return (
      <InspectorSection
        title="Keyframe Stüdyosu"
        defaultOpen={false}
        badge={keyframes.length > 0 ? `${keyframes.length} Kare` : undefined}
      >
        <div className="p-2.5 space-y-2.5">
          <div className="flex items-center justify-between text-[11px] bg-[#171B21] p-2 rounded-[3px] border border-[#292F39]">
            <span className="text-[#929AA8]">Şu Anki Konum:</span>
            <span className="font-mono text-[#4f6bf5] font-bold">
              {relTime.toFixed(2)}s / {selectedClip.duration.toFixed(2)}s
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              const newKf = {
                id: 'kf-' + Date.now(),
                time: relTime,
                x: transform.x,
                y: transform.y,
                scaleX: transform.scaleX,
                scaleY: transform.scaleY,
                rotation: transform.rotation,
                opacity: transform.opacity,
              };
              let updated: typeof keyframes;
              if (hasKfAtPlayhead) {
                updated = keyframes.map((kf, i) => (i === existingKfIndex ? { ...kf, ...newKf } : kf));
              } else {
                updated = [...keyframes, newKf].sort((a, b) => a.time - b.time);
              }
              onUpdateClip(selectedClip.id, { keyframes: updated });
            }}
            className={`w-full py-1.5 px-3 rounded-[3px] text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm ${
              hasKfAtPlayhead
                ? 'bg-[#202631] text-[#f59e0b] border border-[#f59e0b]/40 hover:bg-[#283040]'
                : 'bg-[#4f6bf5] text-white hover:bg-[#3b55d9]'
            }`}
          >
            <span>◆</span>
            <span>{hasKfAtPlayhead ? "Bu Karedeki Keyframe'i Güncelle" : '+ Mevcut Konuma Keyframe Ekle'}</span>
          </button>

          {keyframes.length > 0 && (
            <div className="space-y-1 max-h-36 overflow-y-auto pr-0.5">
              <div className="flex items-center justify-between text-[10px] text-[#929AA8] px-1">
                <span>Zaman Damgası</span>
                <button
                  type="button"
                  onClick={() => onUpdateClip(selectedClip.id, { keyframes: [] })}
                  className="text-[#f87171] hover:text-red-300 font-semibold"
                >
                  Tümünü Sil
                </button>
              </div>
              {keyframes.map((kf) => (
                <div
                  key={kf.id}
                  className="flex items-center justify-between p-1.5 rounded-[3px] bg-[#171B21] border border-[#292F39] text-[11px]"
                >
                  <button
                    type="button"
                    onClick={() => {
                      const targetTime = selectedClip.startTime + kf.time / (selectedClip.speed || 1);
                      onSeek?.(targetTime);
                    }}
                    className="font-mono text-[#f59e0b] hover:underline flex items-center gap-1"
                    title="Bu keyframe anına git"
                  >
                    <span>◆</span>
                    <span>{kf.time.toFixed(2)}s</span>
                  </button>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[#929AA8] font-mono">
                      X:{Math.round(kf.x ?? 0)} Y:{Math.round(kf.y ?? 0)} Ö:{((kf.scaleX ?? 1) * 100).toFixed(0)}%
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const updated = keyframes.filter((k) => k.id !== kf.id);
                        onUpdateClip(selectedClip.id, { keyframes: updated });
                      }}
                      className="text-[#5A6270] hover:text-[#f87171] p-0.5 rounded transition-colors"
                      title="Sil"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </InspectorSection>
    );
  };

  const renderSpeed = () => (
    <InspectorSection
      title="Oynatma Hızı (Speed)"
      defaultOpen={false}
      badge={`${selectedClip.speed || 1}x`}
      onReset={() => onUpdateClip(selectedClip.id, { speed: 1.0 })}
    >
      <div className="p-2.5 space-y-2.5">
        <div className="grid grid-cols-4 gap-1">
          {[0.5, 1.0, 1.5, 2.0].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onUpdateClip(selectedClip.id, { speed: s })}
              className={`py-1 rounded-[3px] text-xs font-mono border transition-colors ${
                (selectedClip.speed || 1) === s
                  ? 'bg-[#202631] text-[#E7EAF0] border-[#4f6bf5] font-semibold'
                  : 'bg-[#171B21] text-[#929AA8] border-[#292F39] hover:text-[#E7EAF0] hover:bg-[#202631]'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
        <NumericField
          label="Hız Katsayısı"
          value={selectedClip.speed || 1.0}
          min={0.1}
          max={4.0}
          step={0.1}
          unit="x"
          defaultValue={1.0}
          onChange={(speed) => onUpdateClip(selectedClip.id, { speed })}
        />
      </div>
    </InspectorSection>
  );

  const renderCropAndMask = () => {
    const crop = effects.crop || { top: 0, right: 0, bottom: 0, left: 0 };
    const mask = effects.mask || { type: 'none' };

    return (
      <InspectorSection
        title="Kırpma & Maskeleme (Crop & Mask)"
        defaultOpen={false}
        onReset={() => updateEffects({ crop: { top: 0, right: 0, bottom: 0, left: 0 }, mask: { type: 'none' } })}
      >
        <div className="p-2.5 space-y-3">
          {/* Mask Presets */}
          <div>
            <label className="text-[#929AA8] text-[10px] block mb-1.5 uppercase font-bold tracking-wider">
              Şekil Maskesi
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: 'none', label: 'Normal', icon: <Square size={13} className="mx-auto" /> },
                { id: 'circle', label: 'Daire', icon: <Circle size={13} className="mx-auto" /> },
                { id: 'rounded-rect', label: 'Yuvarlak', icon: <Square size={13} className="mx-auto rounded-[2px]" /> },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => updateEffects({ mask: { type: m.id as any } })}
                  className={`p-1.5 rounded-[3px] border text-center transition-all ${
                    mask.type === m.id
                      ? 'bg-[#202631] border-[#4f6bf5] text-[#E7EAF0] font-semibold'
                      : 'bg-[#171B21] hover:bg-[#202631] border-[#292F39] text-[#929AA8]'
                  }`}
                >
                  <div className="flex items-center justify-center h-4">{m.icon}</div>
                  <span className="text-[10px] block truncate mt-0.5">{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 4-Edge Crop Sliders */}
          <div className="space-y-2">
            <span className="text-[#929AA8] text-[10px] font-bold uppercase tracking-wider block">Kenar Kırpma (%)</span>
            <div className="grid grid-cols-2 gap-2">
              <NumericField
                label="Üst"
                value={crop.top || 0}
                min={0}
                max={45}
                step={1}
                unit="%"
                compact={true}
                defaultValue={0}
                onChange={(top) => updateEffects({ crop: { ...crop, top } })}
              />
              <NumericField
                label="Alt"
                value={crop.bottom || 0}
                min={0}
                max={45}
                step={1}
                unit="%"
                compact={true}
                defaultValue={0}
                onChange={(bottom) => updateEffects({ crop: { ...crop, bottom } })}
              />
              <NumericField
                label="Sol"
                value={crop.left || 0}
                min={0}
                max={45}
                step={1}
                unit="%"
                compact={true}
                defaultValue={0}
                onChange={(left) => updateEffects({ crop: { ...crop, left } })}
              />
              <NumericField
                label="Sağ"
                value={crop.right || 0}
                min={0}
                max={45}
                step={1}
                unit="%"
                compact={true}
                defaultValue={0}
                onChange={(right) => updateEffects({ crop: { ...crop, right } })}
              />
            </div>
          </div>
        </div>
      </InspectorSection>
    );
  };

  const renderCompositing = () => {
    const blendMode = (selectedClip as any).blendMode || 'normal';
    return (
      <InspectorSection
        title="Kompozitleme (Compositing)"
        defaultOpen={false}
        onReset={() => {
          onUpdateClip(selectedClip.id, { blendMode: 'normal' } as any);
        }}
      >
        <div className="p-2.5 space-y-2">
          <div>
            <label className="text-[#929AA8] text-[10px] block mb-1 uppercase font-bold tracking-wider">
              Karışım Modu (Blend Mode)
            </label>
            <select
              value={blendMode}
              onChange={(e) => onUpdateClip(selectedClip.id, { blendMode: e.target.value } as any)}
              className="w-full h-7 px-2 rounded-[3px] bg-[#171B21] border border-[#292F39] text-[#E7EAF0] text-xs outline-none focus:border-[#4f6bf5]"
            >
              <option value="normal">Normal</option>
              <option value="multiply">Çarpma (Multiply)</option>
              <option value="screen">Ekran (Screen)</option>
              <option value="overlay">Kaplama (Overlay)</option>
              <option value="darken">Koyulaştır (Darken)</option>
              <option value="lighten">Aydınlat (Lighten)</option>
              <option value="color-dodge">Renk Soldurma (Color Dodge)</option>
              <option value="difference">Fark (Difference)</option>
            </select>
          </div>
        </div>
      </InspectorSection>
    );
  };

  const renderChromaKey = () => (
    <InspectorSection
      title="Chroma Key (Yeşil Ekran)"
      defaultOpen={false}
      badge={effects.chromaKey?.enabled ? 'Açık' : undefined}
      onReset={() => updateEffects({ chromaKey: { enabled: false, color: '#00FF00', similarity: 0.35, smoothness: 0.1 } })}
    >
      <div className="p-2.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[#E7EAF0]">Yeşil Ekran Filtresi</span>
          <button
            type="button"
            onClick={() => {
              const current = effects.chromaKey;
              const nextEnabled = !current?.enabled;
              updateEffects({
                chromaKey: {
                  enabled: nextEnabled,
                  color: current?.color || '#00FF00',
                  similarity: current?.similarity ?? 0.35,
                  smoothness: current?.smoothness ?? 0.1,
                },
              });
            }}
            className={`px-2 py-0.5 rounded-[3px] text-xs font-semibold border transition-colors ${
              effects.chromaKey?.enabled
                ? 'bg-[#12241b] text-[#86efac] border-[#1d4430]'
                : 'bg-[#171B21] text-[#929AA8] border-[#292F39] hover:text-[#E7EAF0]'
            }`}
          >
            {effects.chromaKey?.enabled ? 'Açık' : 'Kapalı'}
          </button>
        </div>

        {effects.chromaKey?.enabled && (
          <div className="space-y-2 pt-2 border-t border-[#292F39]">
            <div>
              <label className="text-[#929AA8] text-[10px] block mb-1">Hedef Rengi Seç</label>
              <div className="flex items-center gap-1.5">
                {[
                  { color: '#00FF00', label: 'Yeşil' },
                  { color: '#0000FF', label: 'Mavi' },
                  { color: '#000000', label: 'Siyah' },
                  { color: '#FFFFFF', label: 'Beyaz' },
                ].map((c) => (
                  <button
                    key={c.color}
                    type="button"
                    onClick={() =>
                      updateEffects({
                        chromaKey: {
                          ...effects.chromaKey!,
                          color: c.color,
                        },
                      })
                    }
                    className={`flex-1 py-1 rounded-[3px] text-[10px] flex items-center justify-center gap-1 border ${
                      effects.chromaKey?.color?.toUpperCase() === c.color.toUpperCase()
                        ? 'border-[#4f6bf5] bg-[#202631] text-[#E7EAF0]'
                        : 'border-[#292F39] bg-[#171B21] text-[#929AA8]'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full border border-white/20" style={{ backgroundColor: c.color }} />
                    <span>{c.label}</span>
                  </button>
                ))}
                <input
                  type="color"
                  value={effects.chromaKey.color || '#00FF00'}
                  onChange={(e) =>
                    updateEffects({
                      chromaKey: {
                        ...effects.chromaKey!,
                        color: e.target.value,
                      },
                    })
                  }
                  className="w-7 h-7 rounded-[3px] border border-[#292F39] bg-transparent cursor-pointer shrink-0"
                  title="Özel Renk Seç"
                />
              </div>
            </div>

            <NumericField
              label="Tolerans"
              value={Math.round((effects.chromaKey.similarity ?? 0.35) * 100)}
              min={5}
              max={80}
              step={1}
              unit="%"
              defaultValue={35}
              onChange={(val) =>
                updateEffects({
                  chromaKey: {
                    ...effects.chromaKey!,
                    similarity: val / 100,
                  },
                })
              }
            />

            <NumericField
              label="Yumuşatma"
              value={Math.round((effects.chromaKey.smoothness ?? 0.1) * 100)}
              min={0}
              max={40}
              step={1}
              unit="%"
              defaultValue={10}
              onChange={(val) =>
                updateEffects({
                  chromaKey: {
                    ...effects.chromaKey!,
                    smoothness: val / 100,
                  },
                })
              }
            />
          </div>
        )}
      </div>
    </InspectorSection>
  );

  const renderColorFilters = () => (
    <InspectorSection
      title="Renk & Filtreler (Color & LUTs)"
      defaultOpen={false}
      onReset={() =>
        updateEffects({
          brightness: 0,
          contrast: 1,
          saturation: 1,
          temperature: 0,
          vignette: 0,
        })
      }
    >
      <div className="p-2.5 space-y-2.5">
        {/* Presets */}
        <div>
          <label className="text-[#929AA8] text-[10px] block mb-1.5 uppercase font-bold tracking-wider">
            Hazır Renk Şablonları (Presets)
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {COLOR_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => updateEffects(preset.effects)}
                className="p-1.5 rounded-[3px] bg-[#171B21] border border-[#292F39] hover:border-[#4f6bf5] text-left transition-all group flex items-center gap-2"
                title={preset.description}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: preset.thumbnailColor }}
                />
                <span className="text-[10px] font-medium text-[#929AA8] group-hover:text-[#E7EAF0] truncate">
                  {preset.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        <NumericField
          label="Parlaklık"
          value={Math.round((effects.brightness ?? 0) * 100)}
          min={-100}
          max={100}
          step={1}
          unit="%"
          defaultValue={0}
          onChange={(b) => updateEffects({ brightness: b / 100 })}
        />

        <NumericField
          label="Kontrast"
          value={Math.round((effects.contrast ?? 1) * 100)}
          min={20}
          max={250}
          step={1}
          unit="%"
          defaultValue={100}
          onChange={(c) => updateEffects({ contrast: c / 100 })}
        />

        <NumericField
          label="Doygunluk"
          value={Math.round((effects.saturation ?? 1) * 100)}
          min={0}
          max={250}
          step={1}
          unit="%"
          defaultValue={100}
          onChange={(s) => updateEffects({ saturation: s / 100 })}
        />

        <NumericField
          label="Sıcaklık"
          value={effects.temperature ?? 0}
          min={-50}
          max={50}
          step={1}
          unit=""
          defaultValue={0}
          onChange={(t) => updateEffects({ temperature: t })}
        />

        <NumericField
          label="Vinyet"
          value={Math.round((effects.vignette ?? 0) * 100)}
          min={0}
          max={100}
          step={1}
          unit="%"
          defaultValue={0}
          onChange={(v) => updateEffects({ vignette: v / 100 })}
        />
      </div>
    </InspectorSection>
  );

  const renderAudioSettings = () => (
    <InspectorSection
      title="Ses Ayarları (Audio)"
      defaultOpen={selectedClip.type === 'audio'}
      badge={`${Math.round((selectedClip.volume ?? 1) * 100)}%`}
      onReset={() => onUpdateClip(selectedClip.id, { volume: 1.0, fadeIn: 0, fadeOut: 0, muted: false })}
    >
      <div className="p-2.5 space-y-2.5">
        <NumericField
          label="Ses Seviyesi"
          value={Math.round((selectedClip.volume ?? 1) * 100)}
          min={0}
          max={200}
          step={1}
          unit="%"
          defaultValue={100}
          onChange={(val) => onUpdateClip(selectedClip.id, { volume: val / 100 })}
        />

        <div className="grid grid-cols-2 gap-2">
          <NumericField
            label="Giriş Fade"
            value={selectedClip.fadeIn || 0}
            min={0}
            max={3}
            step={0.1}
            unit="s"
            compact={true}
            defaultValue={0}
            onChange={(fadeIn) => onUpdateClip(selectedClip.id, { fadeIn })}
          />
          <NumericField
            label="Çıkış Fade"
            value={selectedClip.fadeOut || 0}
            min={0}
            max={3}
            step={0.1}
            unit="s"
            compact={true}
            defaultValue={0}
            onChange={(fadeOut) => onUpdateClip(selectedClip.id, { fadeOut })}
          />
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] text-[#929AA8]">Klibi Sessize Al (Mute)</span>
          <button
            type="button"
            onClick={() => onUpdateClip(selectedClip.id, { muted: !selectedClip.muted })}
            className={`w-7 h-6 rounded-[3px] flex items-center justify-center border transition-colors ${
              selectedClip.muted
                ? 'bg-[#202631] text-[#f59e0b] border-[#f59e0b]/40'
                : 'bg-[#171B21] text-[#929AA8] border-[#292F39] hover:text-[#E7EAF0]'
            }`}
          >
            {selectedClip.muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
          </button>
        </div>

        {selectedClip.type === 'video' && onDetachAudio && (
          <button
            type="button"
            onClick={() => onDetachAudio(selectedClip.id)}
            className="w-full mt-1 py-1.5 px-3 rounded-[3px] bg-[#171B21] hover:bg-[#202631] text-[#E7EAF0] border border-[#292F39] hover:border-[#4f6bf5] flex items-center justify-center gap-2 text-xs font-medium transition-colors"
            title="Videonun sesini ayrı bir ses kanalına taşır ve videoyu sessize alır"
          >
            <Music size={13} className="text-[#38b577]" />
            <span>Sesi Videodan Ayır (Detach)</span>
          </button>
        )}
      </div>
    </InspectorSection>
  );

  const renderTransitions = () => {
    const currentTrans = activeTransitionTab === 'in' ? selectedClip.transitionIn : selectedClip.transitionOut;
    const activeType = currentTrans?.type || 'cut';
    const activeDuration = currentTrans?.duration ?? 0.8;
    const def = TRANSITION_DEFINITIONS.find((t) => t.id === activeType) || TRANSITION_DEFINITIONS[0];

    return (
      <InspectorSection
        title="Geçiş Efektleri (Transitions)"
        defaultOpen={false}
        badge={activeType !== 'cut' && activeType !== 'none' ? def.name : undefined}
      >
        <div className="p-2.5 space-y-2.5">
          {/* In / Out Direction Tabs */}
          <div className="grid grid-cols-2 p-0.5 rounded-[3px] bg-[#171B21] border border-[#292F39]">
            <button
              type="button"
              onClick={() => setActiveTransitionTab('in')}
              className={`py-1 rounded-[2px] text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                activeTransitionTab === 'in'
                  ? 'bg-[#202631] text-[#E7EAF0] shadow-sm'
                  : 'text-[#929AA8] hover:text-[#E7EAF0]'
              }`}
            >
              <ArrowRight size={12} className="text-[#4f6bf5]" />
              <span>Giriş Geçişi</span>
              {selectedClip.transitionIn?.type && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#38b577]" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTransitionTab('out')}
              className={`py-1 rounded-[2px] text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                activeTransitionTab === 'out'
                  ? 'bg-[#202631] text-[#E7EAF0] shadow-sm'
                  : 'text-[#929AA8] hover:text-[#E7EAF0]'
              }`}
            >
              <ArrowLeft size={12} className="text-[#4f6bf5]" />
              <span>Çıkış Geçişi</span>
              {selectedClip.transitionOut?.type && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#38b577]" />
              )}
            </button>
          </div>

          {/* Active Transition Info & Controls */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs bg-[#171B21] p-2 rounded-[3px] border border-[#292F39]">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base">{def.icon}</span>
                <div className="min-w-0">
                  <p className="font-semibold text-[#E7EAF0] truncate text-xs">{def.name}</p>
                  <p className="text-[10px] text-[#929AA8] truncate">{def.description}</p>
                </div>
              </div>
              {activeType !== 'cut' && activeType !== 'none' && (
                <button
                  type="button"
                  onClick={() => {
                    if (activeTransitionTab === 'in') {
                      onUpdateClip(selectedClip.id, { transitionIn: undefined });
                    } else {
                      onUpdateClip(selectedClip.id, { transitionOut: undefined });
                    }
                  }}
                  className="text-[10px] text-[#f87171] hover:text-red-300 font-semibold px-2 py-0.5 rounded-[3px] bg-red-950/40 border border-red-800/40 shrink-0"
                >
                  Kaldır
                </button>
              )}
            </div>

            {/* Duration */}
            {activeType !== 'cut' && activeType !== 'none' && (
              <NumericField
                label="Geçiş Süresi"
                value={activeDuration}
                min={0.2}
                max={2.5}
                step={0.1}
                unit="s"
                defaultValue={0.8}
                onChange={(dur) => {
                  if (activeTransitionTab === 'in') {
                    onUpdateClip(selectedClip.id, {
                      transitionIn: { type: activeType, duration: dur },
                    });
                  } else {
                    onUpdateClip(selectedClip.id, {
                      transitionOut: { type: activeType, duration: dur },
                    });
                  }
                }}
              />
            )}

            {/* Live Canvas Preview Button */}
            {activeType !== 'cut' && activeType !== 'none' && onPreviewAnimation && (
              <button
                type="button"
                onClick={() => {
                  if (activeTransitionTab === 'in') {
                    onSeek?.(selectedClip.startTime);
                    onPreviewAnimation(selectedClip.id, activeDuration + 0.3);
                  } else {
                    onSeek?.(Math.max(0, selectedClip.startTime + selectedClip.duration - activeDuration));
                    onPreviewAnimation(selectedClip.id, activeDuration + 0.3);
                  }
                }}
                className="w-full py-1.5 px-3 rounded-[3px] bg-[#202631] hover:bg-[#283040] text-[#E7EAF0] border border-[#292F39] text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
              >
                <span>▶</span>
                <span>Geçişi Önizle</span>
              </button>
            )}

            {/* Visual Grid of All 13 Transitions */}
            <div className="grid grid-cols-2 gap-1.5 max-h-44 overflow-y-auto pr-1">
              {TRANSITION_DEFINITIONS.map((tr) => {
                const isSelected = activeType === tr.id;
                return (
                  <button
                    key={tr.id}
                    type="button"
                    onClick={() => {
                      if (tr.id === 'cut' || tr.id === 'none') {
                        if (activeTransitionTab === 'in') {
                          onUpdateClip(selectedClip.id, { transitionIn: undefined });
                        } else {
                          onUpdateClip(selectedClip.id, { transitionOut: undefined });
                        }
                      } else {
                        if (activeTransitionTab === 'in') {
                          onUpdateClip(selectedClip.id, {
                            transitionIn: { type: tr.id, duration: activeDuration },
                          });
                          onSeek?.(selectedClip.startTime);
                          onPreviewAnimation?.(selectedClip.id, activeDuration + 0.3);
                        } else {
                          onUpdateClip(selectedClip.id, {
                            transitionOut: { type: tr.id, duration: activeDuration },
                          });
                          onSeek?.(Math.max(0, selectedClip.startTime + selectedClip.duration - activeDuration));
                          onPreviewAnimation?.(selectedClip.id, activeDuration + 0.3);
                        }
                      }
                    }}
                    className={`p-1.5 rounded-[3px] text-left transition-all border flex flex-col justify-between ${
                      isSelected
                        ? 'bg-[#202631] border-[#4f6bf5] text-[#E7EAF0]'
                        : 'bg-[#171B21] hover:bg-[#202631] border-[#292F39] text-[#929AA8]'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-0.5">
                      <span className="text-sm">{tr.icon}</span>
                      {isSelected && <Check size={12} className="text-[#4f6bf5]" />}
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold truncate leading-tight text-[#E7EAF0]">{tr.name}</p>
                      <p className="text-[9px] text-[#929AA8] truncate mt-0.5">{tr.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </InspectorSection>
    );
  };

  const getClipTypeIcon = () => {
    switch (selectedClip.type) {
      case 'video':
        return <Film className="w-3.5 h-3.5 text-indigo-400" />;
      case 'audio':
        return <Music className="w-3.5 h-3.5 text-emerald-400" />;
      case 'image':
        return <ImageIcon className="w-3.5 h-3.5 text-purple-400" />;
      default:
        return <Type className="w-3.5 h-3.5 text-amber-400" />;
    }
  };

  const getClipTypeLabel = () => {
    switch (selectedClip.type) {
      case 'video':
        return 'Video';
      case 'audio':
        return 'Ses';
      case 'image':
        return 'Görsel';
      default:
        return 'Metin';
    }
  };

  return (
    <aside
      className={`bg-[#111419] border-l border-[#292F39] flex flex-col shrink-0 select-none z-10 h-full overflow-hidden text-xs ${
        className || ''
      }`}
      style={style || { width: 300 }}
    >
      {/* Clip Header */}
      <PanelHeader
        title={selectedClip.name}
        badge={getClipTypeLabel()}
        actions={
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => onDuplicateClip(selectedClip.id)}
              className="w-6 h-6 rounded-[3px] text-[#929AA8] hover:text-[#E7EAF0] hover:bg-[#171B21] flex items-center justify-center transition-colors"
              title="Klibi Çoğalt (Ctrl+D)"
            >
              <Copy size={13} />
            </button>
            {selectedClip.type === 'video' && onDetachAudio && (
              <button
                type="button"
                onClick={() => onDetachAudio(selectedClip.id)}
                className="w-6 h-6 rounded-[3px] text-[#929AA8] hover:text-[#38b577] hover:bg-[#171B21] flex items-center justify-center transition-colors"
                title="Sesi Klipten Ayır"
              >
                <VolumeX size={13} />
              </button>
            )}
            <button
              type="button"
              onClick={() => onDeleteClip(selectedClip.id)}
              className="w-6 h-6 rounded-[3px] text-[#929AA8] hover:text-[#f87171] hover:bg-[#171B21] flex items-center justify-center transition-colors"
              title="Klibi Sil (Delete)"
            >
              <Trash2 size={13} />
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* ============================================================== */}
        {/* ADVANCED TEXT LAYER SECTION                                    */}
        {/* ============================================================== */}
        {isTextLike && textData && (
          <>
            <InspectorSection title="Metin & Tipografi" defaultOpen={true}>
              <div className="p-3 space-y-3">

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
                    className="p-1.5 rounded-md bg-[#13161c] hover:bg-[#181c24] border border-[#202531] hover:border-gray-600 text-left transition-all group flex flex-col justify-between"
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
                className="w-full p-2 rounded-md bg-[#0d1016] border border-[#202531] text-white outline-none focus:border-indigo-500 text-xs font-medium leading-relaxed resize-y"
              />
            </div>

            {/* 200+ Typography Engine & Google Fonts Picker */}
            <div className="relative">
              <div className="flex items-center justify-between mb-1">
                <label className="text-gray-400 text-[10px] block">
                  Yazı Tipi ({FONT_CATALOG.length}+ Google Font)
                </label>
                <span className="text-[9px] text-gray-400 font-medium">Türkçe Destekli</span>
              </div>

              {/* Current Active Font Trigger */}
              <button
                type="button"
                onClick={() => {
                  const next = !isFontPickerOpen;
                  setIsFontPickerOpen(next);
                  if (next) {
                    prefetchCategoryFonts(fontCategory);
                  }
                }}
                className="w-full px-3 py-1.5 rounded-md bg-[#0d1016] hover:bg-[#13161c] border border-[#202531] hover:border-gray-600 text-left flex items-center justify-between transition-colors group"
              >
                <div className="flex items-center gap-2 truncate">
                  <Type className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span
                    className="text-white text-xs font-medium truncate"
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
                <div className="mt-2 p-2.5 rounded-md bg-[#0d1016] border border-[#202531] shadow-2xl space-y-2 z-30 relative">
                  {/* Search Input */}
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Font ara... (Örn: Montserrat, Bebas, Pacifico)"
                      value={fontSearch}
                      onChange={(e) => setFontSearch(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded bg-[#13161c] border border-[#202531] text-white text-xs outline-none focus:border-indigo-500"
                    />
                    {fontSearch && (
                      <button
                        type="button"
                        onClick={() => setFontSearch('')}
                        className="absolute right-2 top-2 text-gray-400 hover:text-white text-xs"
                      >
                        <X className="w-3 h-3" />
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
                        className={`px-2 py-0.5 rounded-[3px] text-[10px] whitespace-nowrap transition-colors flex items-center ${
                          fontCategory === cat.id
                            ? 'bg-[#4f6bf5] text-white font-semibold'
                            : 'bg-[#171B21] text-[#929AA8] hover:text-[#E7EAF0]'
                        }`}
                      >
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
                            <div className="min-w-0 flex-1">
                              <p
                                className="text-sm font-semibold truncate text-white tracking-wide"
                                style={{ fontFamily: `"${f.id}", ${f.fallback || 'sans-serif'}` }}
                              >
                                {f.name}
                              </p>
                              <p
                                className="text-[11px] text-indigo-300/80 truncate mt-0.5"
                                style={{ fontFamily: `"${f.id}", ${f.fallback || 'sans-serif'}` }}
                              >
                                {textData.text?.substring(0, 28) || 'İyilik ve Adalet — 123'}
                              </p>
                            </div>
                            {isSelected && <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
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
            </div>
            </InspectorSection>

            {renderTransform()}

            {/* Visual Text Animation Gallery */}
            <InspectorSection title="Metin Animasyonları" defaultOpen={false}>
              <div className="p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-[#929AA8] uppercase tracking-wider block">
                  Metin Animasyonları
                </span>
                <span className="text-[9px] text-[#4f6bf5] font-medium">Canlı Önizleme</span>
              </div>

              {/* Big "Play Animation Live on Canvas" Action */}
              <button
                type="button"
                onClick={() => {
                  const duration = (textData.inDuration && textData.inDuration > 0) ? textData.inDuration : 0.8;
                  const startTime = selectedClip.startTime ?? selectedClip.start ?? 0;
                  onPreviewAnimation?.(startTime, duration + 1.2);
                }}
                className="w-full py-1.5 px-3 rounded-[3px] bg-[#4f6bf5] hover:bg-[#3b55d9] text-white font-medium text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                <span>▶</span>
                <span>Animasyonu Tuvalde Canlı Oynat</span>
              </button>

              {/* Visual In-Animation Cards Grid */}
              <div>
                <label className="text-[#929AA8] text-[10px] block mb-1.5 font-medium">
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
                        className={`p-2 rounded-[3px] text-left transition-all relative border flex flex-col justify-between ${
                          isActive
                            ? 'bg-[#202631] border-[#4f6bf5] text-[#E7EAF0] shadow-sm'
                            : 'bg-[#171B21] hover:bg-[#202631] border-[#292F39] text-[#929AA8]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="w-5 h-5 flex items-center justify-center">{getAnimationLucideIcon(anim.id)}</div>
                          <span
                            className={`text-[8px] px-1 py-0.2 rounded-[2px] font-mono font-medium ${
                              isActive ? 'bg-[#4f6bf5] text-white' : 'bg-[#111419] text-[#929AA8]'
                            }`}
                          >
                            {anim.tag}
                          </span>
                        </div>
                        <p className="text-xs font-medium leading-tight truncate text-[#E7EAF0]">{anim.name}</p>
                        <p className="text-[9px] text-[#5A6270] truncate mt-0.5">{anim.desc}</p>
                        {isActive && (
                          <div className="absolute top-1.5 right-1.5 text-[#4f6bf5]">
                            <Check size={12} />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* In Animation Easing & Duration */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#292F39]">
                <div>
                  <div className="flex justify-between text-[#929AA8] text-[9px] mb-0.5">
                    <span>Giriş Süresi</span>
                    <span className="font-mono text-[#4f6bf5]">{textData.inDuration ?? 0.6}s</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="2.5"
                    step="0.1"
                    value={textData.inDuration ?? 0.6}
                    onChange={(e) => updateTextData({ inDuration: parseFloat(e.target.value) })}
                    className="w-full accent-[#4f6bf5]"
                  />
                </div>

                <div>
                  <label className="text-[#929AA8] text-[9px] block mb-0.5">Yumuşatma (Easing)</label>
                  <select
                    value={textData.inEasing || 'ease-out'}
                    onChange={(e) => updateTextData({ inEasing: e.target.value as TextEasingType })}
                    className="w-full h-7 px-2 rounded-[3px] bg-[#171B21] border border-[#292F39] text-[#E7EAF0] outline-none text-xs"
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
                <label className="text-[#929AA8] text-[10px] block mb-1">Sürekli Döngü (Loop)</label>
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
                        className={`p-1.5 rounded-[3px] text-center text-[10px] border transition-all ${
                          isLoopActive
                            ? 'bg-[#202631] border-[#4f6bf5] text-[#E7EAF0] font-medium'
                            : 'bg-[#171B21] hover:bg-[#202631] border-[#292F39] text-[#929AA8]'
                        }`}
                      >
                        <div className="flex items-center justify-center h-4 mb-0.5">{getAnimationLucideIcon(loop.id)}</div>
                        <span className="truncate block mt-0.5">{loop.name.split(' ')[0]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Out Animation */}
              <div>
                <label className="text-[#929AA8] text-[10px] block mb-1">Çıkış Animasyonu (Out)</label>
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
                  className="w-full h-7 px-2 rounded-[3px] bg-[#171B21] border border-[#292F39] text-[#E7EAF0] outline-none text-xs"
                >
                  {OUT_ANIMATIONS.map((out) => (
                    <option key={out.id} value={out.id}>
                      {out.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            </InspectorSection>

            {renderKeyframeStudio()}
          </>
        )}

        {/* VISUAL MEDIA CLIPS (VIDEO / IMAGE) */}
        {isVisualMedia && (
          <>
            {renderTransform()}
            {renderCropAndMask()}
            {renderCompositing()}
            {selectedClip.type === 'video' && renderSpeed()}
            {selectedClip.type === 'video' && renderAudioSettings()}
            {renderColorFilters()}
            {renderChromaKey()}
            {renderTransitions()}
            {renderKeyframeStudio()}
          </>
        )}

        {/* AUDIO ONLY CLIPS */}
        {isAudioOnly && (
          <>
            {renderAudioSettings()}
            {renderSpeed()}
          </>
        )}
      </div>

      {/* Pinned Delete Actions Footer */}
      <div className="p-2 border-t border-[#292F39] bg-[#111419] shrink-0 grid grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={() => onRippleDeleteClip(selectedClip.id)}
          className="h-7 px-2 rounded-[3px] bg-[#171B21] text-[#f59e0b] border border-[#f59e0b]/40 hover:bg-[#202631] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
          title="Klibi sil ve arkasındaki klipleri öne kaydırarak boşluğu kapat"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          <span className="truncate">Boşluksuz Sil</span>
        </button>

        <button
          type="button"
          onClick={() => onDeleteClip(selectedClip.id)}
          className="h-7 px-2 rounded-[3px] bg-[#171B21] text-[#f87171] border border-[#f87171]/40 hover:bg-[#202631] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
          title="Klibi Sil"
        >
          <Trash2 size={13} />
          <span className="truncate">Klibi Sil</span>
        </button>
      </div>
    </aside>
  );
};
