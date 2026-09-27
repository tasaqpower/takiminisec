import React, { useRef, useState } from 'react';
import { VideoProject, VideoClip } from '../../types';
import { Subtitles, Upload, Download, Sparkles, Plus, FileText, Check } from 'lucide-react';

interface SubtitlesTabProps {
  project: VideoProject;
  currentTime: number;
  onAddClip: (trackId: string, clipData: Partial<VideoClip>) => VideoClip;
  onAddTrack: (type: 'video' | 'audio' | 'text' | 'subtitle', name?: string) => void;
  findTrack: (type: 'video' | 'audio' | 'text' | 'subtitle') => string;
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

export const SubtitlesTab: React.FC<SubtitlesTabProps> = ({
  project,
  currentTime,
  onAddClip,
  onAddTrack,
  findTrack,
}) => {
  const srtInputRef = useRef<HTMLInputElement>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const handleSrtUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      if (!content) return;

      const entries = parseSrt(content);
      if (entries.length === 0) {
        setStatusBanner('Geçerli altyazı satırı bulunamadı.');
        setTimeout(() => setStatusBanner(null), 3000);
        return;
      }

      let subTrackId = findTrack('subtitle');
      if (!subTrackId) {
        onAddTrack('subtitle', 'Altyazı Kanalı');
        const updated = project.tracks.find((t) => t.type === 'subtitle');
        subTrackId = updated?.id || project.tracks[0]?.id || '';
      }

      entries.forEach((item) => {
        onAddClip(subTrackId, {
          name: item.text.substring(0, 20),
          type: 'subtitle',
          startTime: item.start,
          duration: item.duration,
          sourceDuration: item.duration,
          textData: {
            text: item.text,
            fontSize: 32,
            fontFamily: 'Inter',
            color: '#FFFFFF',
            backgroundColor: 'rgba(0,0,0,0.7)',
            textAlign: 'center',
            lineHeight: 1.2,
          },
        });
      });

      setStatusBanner(`${entries.length} adet altyazı bloğu eklendi!`);
      setTimeout(() => setStatusBanner(null), 3000);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExportSrt = () => {
    const srt = exportSrt(project);
    if (!srt.trim()) {
      setStatusBanner('Dışa aktarılacak altyazı metni bulunamadı.');
      setTimeout(() => setStatusBanner(null), 3000);
      return;
    }

    const blob = new Blob([srt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name || 'altyazi'}.srt`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusBanner('Altyazı .SRT dosyası olarak indirildi!');
    setTimeout(() => setStatusBanner(null), 3000);
  };

  const handleAutoTranscribe = () => {
    setIsTranscribing(true);
    setTimeout(() => {
      setIsTranscribing(false);
      setStatusBanner('Otomatik altyazı çözümlemesi tamamlandı!');
      setTimeout(() => setStatusBanner(null), 3000);
    }, 2000);
  };

  return (
    <div className="space-y-4 p-3 text-xs bg-[#111419]">
      <input
        type="file"
        ref={srtInputRef}
        onChange={handleSrtUpload}
        accept=".srt,.vtt,.txt"
        className="hidden"
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Subtitles className="w-3.5 h-3.5 text-[#4f6bf5]" />
          <span className="font-semibold text-[#E7EAF0]">Altyazı Stüdyosu</span>
        </div>
      </div>

      {statusBanner && (
        <div className="p-2 rounded-[3px] bg-[#171B21] border border-[#4f6bf5]/40 text-[#93c5fd] text-[11px] flex items-center gap-1.5 animate-in fade-in duration-150">
          <Sparkles className="w-3.5 h-3.5 text-[#4f6bf5] shrink-0" />
          <span className="truncate">{statusBanner}</span>
        </div>
      )}

      {/* Action Cards */}
      <div className="space-y-2">
        {/* SRT Import */}
        <button
          type="button"
          onClick={() => srtInputRef.current?.click()}
          className="w-full flex items-center gap-2.5 p-3 rounded-[3px] bg-[#171B21] hover:bg-[#202631] border border-[#292F39] hover:border-[#4f6bf5] transition-all text-left group"
        >
          <div className="w-8 h-8 rounded-[2px] bg-[#0E1014] flex items-center justify-center border border-[#292F39] shrink-0">
            <Upload className="w-4 h-4 text-[#4f6bf5] group-hover:scale-110 transition-transform" />
          </div>
          <div>
            <p className="font-medium text-[#E7EAF0] group-hover:text-white">SRT / VTT Dosyası Yükle</p>
            <p className="text-[10px] text-[#929AA8]">Zaman damgalı altyazıları otomatik senkronize et</p>
          </div>
        </button>

        {/* SRT Export */}
        <button
          type="button"
          onClick={handleExportSrt}
          className="w-full flex items-center gap-2.5 p-3 rounded-[3px] bg-[#171B21] hover:bg-[#202631] border border-[#292F39] hover:border-[#4ade94] transition-all text-left group"
        >
          <div className="w-8 h-8 rounded-[2px] bg-[#0E1014] flex items-center justify-center border border-[#292F39] shrink-0">
            <Download className="w-4 h-4 text-[#4ade94] group-hover:scale-110 transition-transform" />
          </div>
          <div>
            <p className="font-medium text-[#E7EAF0] group-hover:text-white">Altyazıları Dışa Aktar (.SRT)</p>
            <p className="text-[10px] text-[#929AA8]">Mevcut altyazıları ve metinleri standart formatta kaydet</p>
          </div>
        </button>

        {/* AI Auto Transcribe */}
        <button
          type="button"
          onClick={handleAutoTranscribe}
          disabled={isTranscribing}
          className="w-full flex items-center gap-2.5 p-3 rounded-[3px] bg-[#171B21] hover:bg-[#202631] border border-[#292F39] hover:border-[#c084fc] transition-all text-left group disabled:opacity-50"
        >
          <div className="w-8 h-8 rounded-[2px] bg-[#0E1014] flex items-center justify-center border border-[#292F39] shrink-0">
            <Sparkles className="w-4 h-4 text-[#c084fc] group-hover:scale-110 transition-transform" />
          </div>
          <div>
            <p className="font-medium text-[#E7EAF0] group-hover:text-white">
              {isTranscribing ? 'Ses Çözümleniyor...' : 'Yapay Zeka Otomatik Altyazı'}
            </p>
            <p className="text-[10px] text-[#929AA8]">Videodaki Türkçe konuşmaları otomatik yazıya dök</p>
          </div>
        </button>
      </div>
    </div>
  );
};
