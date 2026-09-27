import React, { useState } from 'react';
import { VideoProject, ExportFormat, ExportOptions } from '../types';
import { exportEngine, ExportProgress } from '../engine/exportEngine';
import { Download, Film, Check, Loader2, X, Clock, Sparkles } from 'lucide-react';

interface ExportModalProps {
  project: VideoProject;
  currentTime: number;
  isOpen: boolean;
  onClose: () => void;
}

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
      <div className="w-full max-w-lg bg-[#0e1014] border border-[#202531] rounded-xl shadow-2xl overflow-hidden text-xs text-gray-300 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 px-5 border-b border-[#191d26] bg-[#13161c] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-[#1c212c] border border-[#2b3342] flex items-center justify-center text-indigo-400">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Videoyu Dışa Aktar</h3>
              <p className="text-[11px] text-gray-400">Cihazınızda 100% yerel olarak işlenir</p>
            </div>
          </div>
          {!isExporting && (
            <button
              onClick={onClose}
              className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-[#1c212c] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Format selection */}
          <div>
            <label className="block text-gray-400 font-semibold mb-1.5 uppercase text-[10px] tracking-wider">
              Dışa Aktarma Formatı
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'mp4', label: 'MP4 Video', desc: 'Evrensel uyumluluk' },
                { id: 'webm', label: 'WebM Video', desc: 'Modern web & hızlı' },
                { id: 'gif', label: 'Animasyonlu GIF', desc: 'Sosyal medya & sticker' },
                { id: 'wav', label: 'WAV Ses', desc: 'Kayıpsız stüdyo sesi' },
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

          {/* Resolution & FPS (if video) */}
          {(format === 'mp4' || format === 'webm' || format === 'png') && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-gray-400 font-semibold mb-1 uppercase text-[10px] tracking-wider">
                  Çözünürlük
                </label>
                <select
                  disabled={isExporting}
                  value={`${resolution.width}x${resolution.height}`}
                  onChange={(e) => {
                    const [w, h] = e.target.value.split('x').map(Number);
                    setResolution({ width: w, height: h });
                  }}
                  className="w-full px-2.5 py-1.5 rounded-md bg-[#13161c] border border-[#202531] text-white outline-none focus:border-indigo-500 text-xs"
                >
                  <option value="1920x1080">Full HD (1080p 16:9)</option>
                  <option value="1280x720">HD (720p 16:9)</option>
                  <option value="3840x2160">4K Ultra HD (16:9)</option>
                  <option value="1080x1920">Dikey (9:16 Reels/TikTok)</option>
                  <option value="1080x1080">Kare (1:1 Instagram)</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-400 font-semibold mb-1 uppercase text-[10px] tracking-wider">
                  Kare Hızı (FPS)
                </label>
                <select
                  disabled={isExporting}
                  value={fps}
                  onChange={(e) => setFps(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-md bg-[#13161c] border border-[#202531] text-white outline-none focus:border-indigo-500 text-xs"
                >
                  <option value={24}>24 FPS (Sinematik)</option>
                  <option value={30}>30 FPS (Standart)</option>
                  <option value={60}>60 FPS (Akıcı)</option>
                </select>
              </div>
            </div>
          )}

          {/* Quality preset */}
          {(format === 'mp4' || format === 'webm') && (
            <div>
              <label className="block text-gray-400 font-semibold mb-1 uppercase text-[10px] tracking-wider">
                Kalite & Bit Hızı
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'standard', label: 'Standart (4 Mbps)', desc: 'Hızlı export' },
                  { id: 'high', label: 'Yüksek (8 Mbps)', desc: 'Önerilen' },
                  { id: 'ultra', label: 'Ultra (16 Mbps)', desc: 'Maksimum detay' },
                ].map((q) => (
                  <button
                    key={q.id}
                    disabled={isExporting}
                    onClick={() => setQuality(q.id as 'standard' | 'high' | 'ultra')}
                    className={`p-2 rounded-md border text-left transition-all ${
                      quality === q.id
                        ? 'bg-indigo-600/20 border-indigo-500 text-white'
                        : 'bg-[#13161c] border-[#202531] text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    <p className="font-medium text-xs text-gray-200">{q.label}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">{q.desc}</p>
                  </button>
                ))}
              </div>
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
        <div className="p-4 border-t border-[#191d26] bg-[#13161c] flex items-center justify-end gap-2">
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
                onClick={handleStartExport}
                className="px-4 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-sm transition-all flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Dışa Aktarımı Başlat</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
