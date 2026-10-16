import React, { useState, useEffect, useMemo } from 'react';
import { VideoProject, ExportFormat, ExportOptions } from '../types';
import { exportEngine, ExportProgress } from '../engine/exportEngine';
import { Download, Film, Check, Loader2, X, Clock, Sparkles, AlertTriangle, Monitor, Smartphone, Square, Zap } from 'lucide-react';

interface ExportModalProps {
  project: VideoProject;
  currentTime: number;
  isOpen: boolean;
  onClose: () => void;
}

function getAspectLabel(w: number, h: number): string {
  const ratio = w / Math.max(1, h);
  if (Math.abs(ratio - 16 / 9) < 0.05) return '16:9 Yatay';
  if (Math.abs(ratio - 9 / 16) < 0.05) return '9:16 Dikey';
  if (Math.abs(ratio - 1.0) < 0.05) return '1:1 Kare';
  if (Math.abs(ratio - 4 / 5) < 0.05) return '4:5 Portre';
  if (Math.abs(ratio - 21 / 9) < 0.05) return '21:9 Sinematik';
  return `${w}:${h}`;
}

interface TikTokPreset {
  id: string;
  name: string;
  tag: string;
  width: number;
  height: number;
  fps: number;
  quality: 'standard' | 'high' | 'ultra';
  desc: string;
}

const TIKTOK_QUICK_PRESETS: TikTokPreset[] = [
  {
    id: 'tiktok_1080p',
    name: 'TikTok 1080p',
    tag: 'Popüler Standart',
    width: 1080,
    height: 1920,
    fps: 30,
    quality: 'high',
    desc: '1080×1920 • 30 FPS • Hızlı & Keskin',
  },
  {
    id: 'tiktok_2k_60fps',
    name: 'TikTok 2K VIP',
    tag: 'Ultra Net (Önerilen)',
    width: 1440,
    height: 2560,
    fps: 60,
    quality: 'ultra',
    desc: '1440×2560 • 60 FPS • Sıkıştırmasız VIP',
  },
  {
    id: 'tiktok_4k',
    name: 'TikTok 4K Dikey',
    tag: 'Sinematik Portre',
    width: 2160,
    height: 3840,
    fps: 60,
    quality: 'ultra',
    desc: '2160×3840 • 60 FPS • Maksimum Çözünürlük',
  },
  {
    id: 'tiktok_720p',
    name: 'TikTok 720p',
    tag: 'Hızlı Taslak',
    width: 720,
    height: 1280,
    fps: 30,
    quality: 'standard',
    desc: '720×1280 • 30 FPS • Küçük Dosya Boyutu',
  },
];

export const VideoExportModal: React.FC<ExportModalProps> = ({
  project,
  currentTime,
  isOpen,
  onClose,
}) => {
  const [format, setFormat] = useState<ExportFormat>('mp4');
  const [resolution, setResolution] = useState<{ width: number; height: number }>(project.resolution);
  const [fps, setFps] = useState<number>(project.fps || 30);
  const [quality, setQuality] = useState<'standard' | 'high' | 'ultra'>('high');
  const [filename, setFilename] = useState<string>(
    `${project.name.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}_export`
  );

  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);

  // Synchronize resolution & fps whenever modal opens or project changes
  useEffect(() => {
    if (isOpen) {
      setResolution(project.resolution);
      setFps(project.fps || 30);
      setFilename(`${project.name.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}_export`);
    }
  }, [isOpen, project.resolution.width, project.resolution.height, project.fps, project.name]);

  const resolutionPresets = useMemo(() => {
    const projKey = `${project.resolution.width}x${project.resolution.height}`;
    const standardPresets = [
      { id: '1080x1920', label: '1080p Dikey (1080×1920 - 9:16 Reels / TikTok / Shorts)', width: 1080, height: 1920, group: 'tiktok' },
      { id: '1440x2560', label: '2K QHD Dikey (1440×2560 - 9:16 Ultra Net Reels / Shorts)', width: 1440, height: 2560, group: 'tiktok' },
      { id: '2160x3840', label: '4K Dikey (2160×3840 - 9:16 Sinematik Dikey)', width: 2160, height: 3840, group: 'tiktok' },
      { id: '720x1280', label: '720p Dikey (720×1280 - 9:16 Düşük Boyut)', width: 720, height: 1280, group: 'tiktok' },
      { id: '1920x1080', label: '1080p Full HD (1920×1080 - 16:9 Yatay)', width: 1920, height: 1080, group: 'horizontal' },
      { id: '2560x1440', label: '2K QHD (2560×1440 - 16:9 Net)', width: 2560, height: 1440, group: 'horizontal' },
      { id: '3840x2160', label: '4K Ultra HD (3840×2160 - 16:9 Sinematik)', width: 3840, height: 2160, group: 'horizontal' },
      { id: '1280x720', label: '720p HD (1280×720 - 16:9 Hızlı)', width: 1280, height: 720, group: 'horizontal' },
      { id: '1080x1080', label: '1080p Kare (1080×1080 - 1:1 Instagram Post)', width: 1080, height: 1080, group: 'other' },
      { id: '1080x1350', label: '1080p Portre (1080×1350 - 4:5 Instagram Dikey)', width: 1080, height: 1350, group: 'other' },
    ];

    const isStandard = standardPresets.some((p) => p.id === projKey);
    const presets = [...standardPresets];

    if (!isStandard) {
      presets.unshift({
        id: projKey,
        label: `🎯 Proje Çözünürlüğü (${project.resolution.width}×${project.resolution.height} - ${getAspectLabel(project.resolution.width, project.resolution.height)})`,
        width: project.resolution.width,
        height: project.resolution.height,
        group: 'project',
      });
    }

    return presets;
  }, [project.resolution.width, project.resolution.height]);

  const projAspect = project.resolution.width / Math.max(1, project.resolution.height);
  const selAspect = resolution.width / Math.max(1, resolution.height);
  const isAspectMatch = Math.abs(projAspect - selAspect) < 0.02;
  const isTikTokAspect = Math.abs(selAspect - 9 / 16) < 0.04;

  const activeTikTokPreset = TIKTOK_QUICK_PRESETS.find(
    (p) => p.width === resolution.width && p.height === resolution.height && p.fps === fps
  );

  const applyTikTokPreset = (preset: TikTokPreset) => {
    setFormat('mp4');
    setResolution({ width: preset.width, height: preset.height });
    setFps(preset.fps);
    setQuality(preset.quality);
  };

  if (!isOpen) return null;

  const handleStartExport = async () => {
    setIsExporting(true);
    setProgress({
      percent: 0,
      currentFrame: 0,
      totalFrames: 100,
      etaSeconds: 0,
      statusText: 'Dışa aktarma başlatılıyor...',
    });

    try {
      const options: ExportOptions = {
        format,
        resolution,
        fps,
        quality,
        filename: `${filename}.${format}`,
      };

      const blob = await exportEngine.exportProject(project, options, currentTime, (p) => {
        setProgress(p);
      });

      if (blob) {
        const isDevOrTest =
          process.env.NODE_ENV !== 'production' ||
          (typeof window !== 'undefined' && (
            window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1' ||
            Boolean((window as any).__FORMA_TEST__)
          ));
        if (isDevOrTest && typeof window !== 'undefined') {
          (window as any).__lastExportedBlob = blob;
        }
        exportEngine.downloadBlob(blob, `${filename}.${format}`);
        setTimeout(() => {
          setIsExporting(false);
          setProgress(null);
          onClose();
        }, 1200);
      } else {
        setIsExporting(false);
        setProgress(null);
      }
    } catch (err) {
      alert('Dışa aktarım sırasında bir hata oluştu: ' + err);
      setIsExporting(false);
      setProgress(null);
    }
  };

  const handleCancelExport = () => {
    exportEngine.cancel();
    setIsExporting(false);
    setProgress(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-none">
      <div className="w-full max-w-xl bg-[#0e1014] border border-[#202531] rounded-xl shadow-2xl overflow-hidden text-xs text-gray-300 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 px-5 border-b border-[#191d26] bg-[#13161c] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-[#1c212c] border border-[#2b3342] flex items-center justify-center text-indigo-400">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Videoyu Dışa Aktar</h3>
              <p className="text-[11px] text-gray-400">
                WASM H.264 CFR Motoru &middot; Sabit Kare Hızı &middot; Sıfır Ses Kayması
              </p>
            </div>
          </div>
          {!isExporting && (
            <button
              onClick={onClose}
              data-testid="export-modal-close-btn"
              className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-[#1c212c] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Format selection */}
          <div>
            <label className="block text-gray-400 font-semibold mb-1.5 uppercase text-[10px] tracking-wider">
              Dışa Aktarma Formatı
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'mp4', label: 'MP4 Video', desc: 'Evrensel uyumluluk (H.264+AAC)' },
                { id: 'webm', label: 'WebM Video', desc: 'Modern web & hızlı (VP8+Opus)' },
                { id: 'gif', label: 'Animasyonlu GIF', desc: 'Sosyal medya & sticker' },
                { id: 'wav', label: 'WAV Ses', desc: 'Kayıpsız stüdyo sesi (48kHz)' },
                { id: 'mp3', label: 'MP3 Ses', desc: 'Yüksek kalite ses' },
                { id: 'png', label: 'PNG Kare', desc: 'Anlık ekran görüntüsü' },
              ].map((f) => (
                <button
                  key={f.id}
                  disabled={isExporting}
                  onClick={() => setFormat(f.id as ExportFormat)}
                  className={`p-2 rounded-md border text-left transition-all ${
                    format === f.id
                      ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-sm'
                      : 'bg-[#13161c] border-[#202531] text-gray-400 hover:border-gray-600 hover:text-gray-200'
                  }`}
                >
                  <p className="font-semibold text-xs text-gray-200">{f.label}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5 truncate">{f.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* TikTok / Reels Dedicated Quick Presets */}
          {(format === 'mp4' || format === 'webm') && (
            <div className="p-3 rounded-lg bg-gradient-to-r from-pink-950/20 via-[#181224] to-indigo-950/20 border border-pink-500/30">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-pink-400" />
                  <span className="font-semibold text-white text-xs">
                    TikTok / Reels / Shorts Hızlı Presetleri (9:16 Dikey)
                  </span>
                </div>
                <span className="text-[10px] text-pink-300 font-mono bg-pink-500/20 px-1.5 py-0.5 rounded border border-pink-500/30">
                  ⚡ 1-Tıkla Ayarla
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {TIKTOK_QUICK_PRESETS.map((preset) => {
                  const isActive =
                    resolution.width === preset.width &&
                    resolution.height === preset.height &&
                    fps === preset.fps &&
                    quality === preset.quality;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      disabled={isExporting}
                      onClick={() => applyTikTokPreset(preset)}
                      className={`p-2 rounded-md border text-left transition-all ${
                        isActive
                          ? 'bg-pink-600/25 border-pink-500 text-white shadow-md shadow-pink-950/50'
                          : 'bg-[#12141a]/90 border-[#2b2738] text-gray-300 hover:border-pink-500/50 hover:bg-[#181622]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[11px] text-pink-200 truncate">{preset.name}</span>
                        {isActive && <Check className="w-3 h-3 text-pink-400 shrink-0" />}
                      </div>
                      <p className="text-[9px] text-pink-300/80 font-medium mt-0.5">{preset.tag}</p>
                      <p className="text-[9px] text-gray-400 font-mono mt-1 leading-tight">{preset.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Resolution & FPS (if video) */}
          {(format === 'mp4' || format === 'webm' || format === 'png') && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-gray-400 font-semibold uppercase text-[10px] tracking-wider">
                      Çözünürlük
                    </label>
                    <span className="text-[10px] font-mono text-indigo-400">
                      {resolution.width}×{resolution.height} ({getAspectLabel(resolution.width, resolution.height)})
                    </span>
                  </div>
                  <select
                    disabled={isExporting}
                    data-testid="export-modal-resolution-select"
                    value={`${resolution.width}x${resolution.height}`}
                    onChange={(e) => {
                      const [w, h] = e.target.value.split('x').map(Number);
                      setResolution({ width: w, height: h });
                    }}
                    className="w-full px-2.5 py-1.5 rounded-md bg-[#13161c] border border-[#202531] text-white outline-none focus:border-indigo-500 text-xs"
                  >
                    {/* Proje Özel Formatı (Eğer standart dışı ise) */}
                    {resolutionPresets.filter((p) => p.group === 'project').length > 0 && (
                      <optgroup label="⭐ Projenizin Özel Çözünürlüğü">
                        {resolutionPresets
                          .filter((p) => p.group === 'project')
                          .map((p) => (
                            <option key={p.id} value={`${p.width}x${p.height}`}>
                              {p.label}
                            </option>
                          ))}
                      </optgroup>
                    )}

                    {/* TikTok / Reels 9:16 Dikey */}
                    <optgroup label="📱 TikTok / Reels / Shorts (9:16 Dikey) - ÖNERİLEN">
                      {resolutionPresets
                        .filter((p) => p.group === 'tiktok')
                        .map((p) => {
                          const isProj = p.width === project.resolution.width && p.height === project.resolution.height;
                          return (
                            <option key={p.id} value={`${p.width}x${p.height}`}>
                              {isProj ? `⭐ [Proje Formatı] ${p.label}` : p.label}
                            </option>
                          );
                        })}
                    </optgroup>

                    {/* YouTube 16:9 Yatay */}
                    <optgroup label="💻 YouTube / Masaüstü (16:9 Yatay)">
                      {resolutionPresets
                        .filter((p) => p.group === 'horizontal')
                        .map((p) => {
                          const isProj = p.width === project.resolution.width && p.height === project.resolution.height;
                          return (
                            <option key={p.id} value={`${p.width}x${p.height}`}>
                              {isProj ? `⭐ [Proje Formatı] ${p.label}` : p.label}
                            </option>
                          );
                        })}
                    </optgroup>

                    {/* Instagram Kare / Portre */}
                    <optgroup label="📷 Instagram Gönderi / Portre">
                      {resolutionPresets
                        .filter((p) => p.group === 'other')
                        .map((p) => {
                          const isProj = p.width === project.resolution.width && p.height === project.resolution.height;
                          return (
                            <option key={p.id} value={`${p.width}x${p.height}`}>
                              {isProj ? `⭐ [Proje Formatı] ${p.label}` : p.label}
                            </option>
                          );
                        })}
                    </optgroup>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-gray-400 font-semibold uppercase text-[10px] tracking-wider">
                      Kare Hızı (FPS)
                    </label>
                    <span className="text-[10px] font-mono text-gray-400">{fps} FPS</span>
                  </div>
                  <select
                    disabled={isExporting}
                    value={fps}
                    onChange={(e) => setFps(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded-md bg-[#13161c] border border-[#202531] text-white outline-none focus:border-indigo-500 text-xs"
                  >
                    <option value={24}>24 FPS (Sinematik)</option>
                    <option value={30}>30 FPS (Standart YouTube/Reels)</option>
                    <option value={60}>60 FPS (Akıcı Oyun/Hareket)</option>
                  </select>
                </div>
              </div>

              {/* Aspect Ratio Match & Warning Feedback */}
              {!isAspectMatch ? (
                <div data-testid="export-modal-aspect-status" className="p-2.5 rounded-md bg-amber-950/30 border border-amber-600/40 text-[11px] text-amber-200 flex items-start justify-between gap-2">
                  <div className="flex items-start gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-amber-300">En-Boy Oranı Değişiyor</p>
                      <p className="text-[10px] text-amber-200/80 leading-relaxed">
                        Projeniz <strong>{project.resolution.width}×{project.resolution.height} ({getAspectLabel(project.resolution.width, project.resolution.height)})</strong>,
                        fakat dışa aktarma <strong>{resolution.width}×{resolution.height} ({getAspectLabel(resolution.width, resolution.height)})</strong> olarak ayarlandı.
                        Görüntüyü bozmamak için otomatik CapCut bulanık arka plan dolgusu uygulanacaktır.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setResolution(project.resolution)}
                    className="shrink-0 px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-[10px] font-medium transition-colors"
                  >
                    Projeye Eşitle
                  </button>
                </div>
              ) : (
                <div data-testid="export-modal-aspect-status" className="p-2 rounded-md bg-emerald-950/20 border border-emerald-600/30 text-[11px] text-emerald-300 flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>
                    Proje çözünürlüğü ve en-boy oranı ile tam uyumlu (<strong>{project.resolution.width}×{project.resolution.height}</strong> - {getAspectLabel(project.resolution.width, project.resolution.height)}).
                  </span>
                </div>
              )}

              {/* TikTok Native Format Compliance Badge */}
              {isTikTokAspect && (
                <div className="p-2.5 rounded-md bg-[#191424] border border-pink-500/40 text-[11px] text-pink-200 flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-pink-500/20 text-pink-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="font-semibold text-pink-300">TikTok & Reels Algoritma Uyumu Aktif</p>
                      <span className="text-[9px] px-1.5 py-0.2 bg-pink-500/20 text-pink-300 rounded border border-pink-500/30 font-mono">
                        9:16 CFR 48kHz
                      </span>
                    </div>
                    <p className="text-[10px] text-pink-200/80 leading-relaxed mt-0.5">
                      YUV420p renk alanı, H.264 High Profile ve Moov Atom (FastStart) kuralına uygun üretilir. TikTok sunucularına yüklendiğinde kalite kaybı, pikselleşme veya ses kayması yaşanmaz.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Quality preset */}
          {(format === 'mp4' || format === 'webm') && (
            <div>
              <label className="block text-gray-400 font-semibold mb-1 uppercase text-[10px] tracking-wider">
                Kalite & Bit Hızı (Netlik Seviyesi)
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  {
                    id: 'standard',
                    label: 'Standart (Hızlı)',
                    desc: 'CRF 23 &middot; 192k AAC &middot; Küçük dosya boyutu',
                  },
                  {
                    id: 'high',
                    label: 'Yüksek (Önerilen)',
                    desc: 'CRF 20 &middot; 256k AAC &middot; Net ve dengeli',
                  },
                  {
                    id: 'ultra',
                    label: 'Ultra (Stüdyo)',
                    desc: 'CRF 18 &middot; 320k AAC &middot; Maksimum detay',
                  },
                ].map((q) => (
                  <button
                    key={q.id}
                    disabled={isExporting}
                    onClick={() => setQuality(q.id as 'standard' | 'high' | 'ultra')}
                    className={`p-2.5 rounded-md border text-left transition-all ${
                      quality === q.id
                        ? 'bg-indigo-600/20 border-indigo-500 text-white'
                        : 'bg-[#13161c] border-[#202531] text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    <p className="font-semibold text-xs text-gray-200">{q.label}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5 leading-snug">{q.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Audio & Sync Features Note */}
          {(format === 'mp4' || format === 'webm') && (
            <div className="p-2.5 rounded-md bg-[#13161c] border border-[#202531] text-[10px] text-gray-400 space-y-1">
              <div className="flex items-center gap-1.5 text-indigo-400 font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Ses ve Görüntü Senkronizasyonu (Zero Drift Sync):</span>
              </div>
              <p>
                Her video karesi timeline üzerindeki milisaniyelik zamana kilitlenerek render edilir. Ses miksi 48.000 Hz kayıpsız stüdyo akışıyla birleştirilerek donma, atlama ve dudak senkron (ses kayması) sorunları %100 önlenir.
              </p>
            </div>
          )}

          {/* Filename */}
          <div>
            <label className="block text-gray-400 font-semibold mb-1 uppercase text-[10px] tracking-wider">
              Dosya Adı
            </label>
            <div className="flex items-center rounded-md bg-[#13161c] border border-[#202531] px-2.5 py-1.5">
              <input
                type="text"
                disabled={isExporting}
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                className="w-full bg-transparent text-white outline-none text-xs font-mono"
              />
              <span className="text-gray-500 font-mono text-xs">.{format}</span>
            </div>
          </div>

          {/* Exporting Progress display */}
          {isExporting && progress && (
            <div className="p-3.5 rounded-md bg-[#13161c] border border-indigo-500/30 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-indigo-300 font-medium flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{progress.statusText}</span>
                </span>
                <span className="text-white font-mono font-bold">{progress.percent}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-[#0a0c10] overflow-hidden">
                <div
                  className="h-full bg-indigo-500 transition-all duration-150 rounded-full"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-gray-400 font-mono">
                <span>
                  Kare: {progress.currentFrame} / {progress.totalFrames}
                </span>
                <span>Kalan Süre: ~{progress.etaSeconds} sn</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[#191d26] bg-[#13161c] flex items-center justify-between">
          <div className="text-[11px] font-mono text-gray-400">
            <span>Çıktı: </span>
            <span className="text-white font-medium">
              {resolution.width}×{resolution.height}
            </span>
            <span className="text-gray-500"> &middot; </span>
            <span className="text-white font-medium">{fps} FPS</span>
            <span className="text-gray-500"> &middot; </span>
            <span className="text-indigo-400 uppercase font-bold">{format}</span>
          </div>

          <div className="flex items-center gap-2">
            {isExporting ? (
              <button
                onClick={handleCancelExport}
                className="px-4 py-1.5 rounded-md bg-red-950/40 text-red-300 border border-red-800/50 hover:bg-red-950/60 font-medium text-xs transition-colors"
              >
                İptal Et
              </button>
            ) : (
              <>
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-md text-gray-400 hover:text-white hover:bg-[#1c212c] font-medium text-xs transition-colors"
                >
                  Vazgeç
                </button>
                <button
                  data-action="start-export"
                  onClick={handleStartExport}
                  className="px-4 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-sm transition-all flex items-center gap-1.5 font-semibold"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Dışa Aktarımı Başlat</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
