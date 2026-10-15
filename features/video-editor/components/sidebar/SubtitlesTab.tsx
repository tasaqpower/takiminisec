import React, { useRef, useState, useMemo } from 'react';
import { VideoProject, VideoClip } from '../../types';
import { speechRecognitionEngine, SpeechSegment } from '../../engine/speechRecognitionEngine';
import { duplicateSpeechDetector, DetectedDuplicate } from '../../engine/duplicateSpeechDetector';
import {
  Subtitles,
  Upload,
  Download,
  Sparkles,
  Play,
  Scissors,
  VolumeX,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Mic,
  Trash2,
  RefreshCw,
  Layers,
} from 'lucide-react';

interface SubtitlesTabProps {
  project: VideoProject;
  currentTime: number;
  onAddClip: (trackId: string, clipData: Partial<VideoClip>) => VideoClip;
  onAddTrack: (type: 'video' | 'audio' | 'text' | 'subtitle', name?: string) => void;
  findTrack: (type: 'video' | 'audio' | 'text' | 'subtitle') => string;
  onSeek?: (time: number) => void;
  selectedClipId?: string | null;
  onRemoveDuplicateRange?: (
    clipId: string,
    rangeStart: number,
    rangeEnd: number,
    action: 'ripple_delete' | 'vocal_mute'
  ) => boolean;
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
  onSeek,
  selectedClipId,
  onRemoveDuplicateRange,
}) => {
  const srtInputRef = useRef<HTMLInputElement>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // Real transcription state
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribeProgress, setTranscribeProgress] = useState(0);
  const [transcribeStatusText, setTranscribeStatusText] = useState('');
  const [speechSegments, setSpeechSegments] = useState<SpeechSegment[]>([]);

  // Duplicate speech detection state
  const [isScanningDuplicates, setIsScanningDuplicates] = useState(false);
  const [detectedDuplicates, setDetectedDuplicates] = useState<DetectedDuplicate[] | null>(null);

  // Available candidate clips (video and audio clips with media)
  const candidateClips = useMemo(() => {
    return project.tracks
      .filter((t) => t.type === 'video' || t.type === 'audio')
      .flatMap((t) => t.clips)
      .filter((c) => c.sourceUrl || c.assetId);
  }, [project.tracks]);

  // Selected or active clip
  const [selectedTargetClipId, setSelectedTargetClipId] = useState<string>('');
  const activeClip = useMemo(() => {
    if (selectedTargetClipId) {
      return candidateClips.find((c) => c.id === selectedTargetClipId) || null;
    }
    if (selectedClipId) {
      const c = candidateClips.find((clip) => clip.id === selectedClipId);
      if (c) return c;
    }
    return candidateClips[0] || null;
  }, [selectedTargetClipId, selectedClipId, candidateClips]);

  // Handle Real Transcription via SpeechRecognitionEngine
  const handleStartRealTranscription = async () => {
    if (!activeClip) {
      setStatusBanner('Lütfen önce analiz edilecek bir video veya ses klibi seçin.');
      setTimeout(() => setStatusBanner(null), 3000);
      return;
    }

    setIsTranscribing(true);
    setTranscribeProgress(10);
    setTranscribeStatusText('PCM ses dalgaları yükleniyor...');

    try {
      const result = await speechRecognitionEngine.transcribeClip(activeClip, {
        language: 'tr-TR',
        onProgress: (pct, text) => {
          setTranscribeProgress(pct);
          setTranscribeStatusText(text);
        },
      });

      setSpeechSegments(result.segments);
      setStatusBanner(`${result.segments.length} adet konuşma segmenti başarıyla çözümlendi!`);
      setTimeout(() => setStatusBanner(null), 4000);
    } catch (err: any) {
      console.error('[SubtitlesTab] Transcription error:', err);
      setStatusBanner('Ses analizi sırasında bir hata oluştu: ' + (err?.message || 'Bilinmeyen hata'));
      setTimeout(() => setStatusBanner(null), 4000);
    } finally {
      setIsTranscribing(false);
    }
  };

  // Add all detected segments to the subtitle track
  const handleApplySegmentsToTimeline = () => {
    if (!activeClip || speechSegments.length === 0) return;

    let subTrackId = findTrack('subtitle');
    if (!subTrackId) {
      onAddTrack('subtitle', 'AI Altyazı Kanalı');
      const updated = project.tracks.find((t) => t.type === 'subtitle');
      subTrackId = updated?.id || project.tracks[0]?.id || '';
    }

    const clipStart = activeClip.startTime;

    speechSegments.forEach((item, idx) => {
      onAddClip(subTrackId, {
        name: (item.text || `Konuşma ${idx + 1}`).substring(0, 24),
        type: 'subtitle',
        startTime: parseFloat((clipStart + item.startSec).toFixed(2)),
        duration: parseFloat(item.duration.toFixed(2)),
        sourceDuration: parseFloat(item.duration.toFixed(2)),
        textData: {
          text: item.text || `Konuşma ${idx + 1}`,
          fontSize: 32,
          fontFamily: 'Plus Jakarta Sans',
          color: '#FFFFFF',
          backgroundColor: 'rgba(0,0,0,0.7)',
          textAlign: 'center',
          lineHeight: 1.2,
        },
      });
    });

    setStatusBanner(`${speechSegments.length} adet altyazı zaman çizelgesine eklendi!`);
    setTimeout(() => setStatusBanner(null), 3000);
  };

  // Handle Scanning for AI Duplicate Takes and Stutters
  const handleScanDuplicates = async () => {
    if (!activeClip) {
      setStatusBanner('Lütfen önce taranacak bir klip seçin.');
      setTimeout(() => setStatusBanner(null), 3000);
      return;
    }

    setIsScanningDuplicates(true);
    setStatusBanner('Akustik dalga boyu ve konuşma korelasyonu taranıyor...');

    try {
      const dups = await duplicateSpeechDetector.detectDuplicates(activeClip, {
        minRepeatDurationSec: 0.5,
        maxRepeatDurationSec: 10.0,
        correlationThreshold: 0.70,
        knownSegments: speechSegments.length > 0 ? speechSegments : undefined,
      });

      setDetectedDuplicates(dups);
      if (dups.length === 0) {
        setStatusBanner('Temiz! Klipte tekrar eden cümle veya kekeleme bulunamadı.');
      } else {
        setStatusBanner(`${dups.length} adet tekrar eden cümle/kekeleme yakalandı!`);
      }
      setTimeout(() => setStatusBanner(null), 4000);
    } catch (err: any) {
      console.error('[SubtitlesTab] Duplicate detection error:', err);
      setStatusBanner('Tekrar analizi sırasında hata: ' + (err?.message || 'Bilinmeyen hata'));
      setTimeout(() => setStatusBanner(null), 4000);
    } finally {
      setIsScanningDuplicates(false);
    }
  };

  // Clean a single duplicate range (either take 1 or take 2)
  const handleCleanDuplicateRange = (
    dup: DetectedDuplicate,
    targetOccurrence: 'first' | 'second',
    action: 'ripple_delete' | 'vocal_mute'
  ) => {
    if (!onRemoveDuplicateRange || !activeClip) return;

    const range =
      targetOccurrence === 'first' ? dup.firstOccurrence : dup.duplicateOccurrence;

    const ok = onRemoveDuplicateRange(activeClip.id, range.startSec, range.endSec, action);
    if (ok) {
      setStatusBanner(
        action === 'ripple_delete'
          ? 'Tekrar eden aralık kesildi ve boşluk kapatıldı!'
          : 'Tekrar eden aralık susturuldu (arka plan sesi devam ediyor)!'
      );
      // Remove cleaned item from state list
      setDetectedDuplicates((prev) => (prev ? prev.filter((d) => d.id !== dup.id) : null));
      setTimeout(() => setStatusBanner(null), 3500);
    }
  };

  // Clean all duplicate second takes in one click
  const handleCleanAllDuplicates = () => {
    if (!onRemoveDuplicateRange || !activeClip || !detectedDuplicates || detectedDuplicates.length === 0) {
      return;
    }

    // Process from end to beginning so earlier time offsets are preserved
    const sorted = [...detectedDuplicates].sort(
      (a, b) => b.duplicateOccurrence.startSec - a.duplicateOccurrence.startSec
    );

    let count = 0;
    for (const dup of sorted) {
      const ok = onRemoveDuplicateRange(
        activeClip.id,
        dup.duplicateOccurrence.startSec,
        dup.duplicateOccurrence.endSec,
        'ripple_delete'
      );
      if (ok) count++;
    }

    setDetectedDuplicates([]);
    setStatusBanner(`${count} adet tekrar eden cümle başarıyla kesilip temizlendi!`);
    setTimeout(() => setStatusBanner(null), 4000);
  };

  // SRT file import
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

  // SRT file export
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

  return (
    <div className="space-y-4 p-3 text-xs bg-[#111419]">
      <input
        type="file"
        ref={srtInputRef}
        onChange={handleSrtUpload}
        accept=".srt,.vtt,.txt"
        className="hidden"
      />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#292F39] pb-2">
        <div className="flex items-center gap-1.5">
          <Subtitles className="w-4 h-4 text-[#4f6bf5]" />
          <span className="font-semibold text-[#E7EAF0]">AI Konuşma & Altyazı Stüdyosu</span>
        </div>
      </div>

      {/* Status Alert Banner */}
      {statusBanner && (
        <div className="p-2 rounded-[3px] bg-[#171B21] border border-[#4f6bf5]/40 text-[#93c5fd] text-[11px] flex items-center gap-1.5 animate-in fade-in duration-150">
          <Sparkles className="w-3.5 h-3.5 text-[#4f6bf5] shrink-0" />
          <span className="truncate">{statusBanner}</span>
        </div>
      )}

      {/* Target Clip Selector */}
      <div className="space-y-1">
        <label className="text-[10px] uppercase font-bold text-[#929AA8] tracking-wider block">
          Analiz Edilecek Klip
        </label>
        {candidateClips.length === 0 ? (
          <p className="text-[11px] text-[#5A6270] italic bg-[#171B21] p-2 rounded-[3px]">
            Zaman çizelgesinde ses veya video klibi bulunamadı.
          </p>
        ) : (
          <select
            value={activeClip?.id || ''}
            onChange={(e) => setSelectedTargetClipId(e.target.value)}
            className="w-full h-7 px-2 bg-[#171B21] border border-[#292F39] rounded-[3px] text-white text-[11px] outline-none focus:border-[#4f6bf5]"
          >
            {candidateClips.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.duration.toFixed(1)}s - {c.type === 'video' ? 'Video' : 'Ses'})
              </option>
            ))}
          </select>
        )}
      </div>

      {/* SECTION 1: REAL SPEECH-TO-TEXT & VAD */}
      <div className="p-3 rounded-[3px] bg-[#171B21] border border-[#292F39] space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-white flex items-center gap-1.5">
            <Mic className="w-3.5 h-3.5 text-purple-400" />
            <span>Konuşma Çözümleme (PCM VAD)</span>
          </span>
          {activeClip && (
            <span className="text-[9px] font-mono text-[#929AA8]">
              {activeClip.duration.toFixed(1)} sn
            </span>
          )}
        </div>

        <p className="text-[10px] text-[#929AA8] leading-relaxed">
          Klipteki insan konuşmasını milisaniyelik hassasiyetle yakalar, kelime zaman damgaları çıkarır.
        </p>

        {isTranscribing ? (
          <div className="space-y-1.5 py-1">
            <div className="flex justify-between text-[10px] text-[#93c5fd]">
              <span>{transcribeStatusText}</span>
              <span className="font-mono">{transcribeProgress}%</span>
            </div>
            <div className="w-full h-1.5 bg-[#0E1014] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-[#4f6bf5] transition-all duration-200"
                style={{ width: `${transcribeProgress}%` }}
              />
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleStartRealTranscription}
            disabled={!activeClip || isTranscribing}
            className="w-full py-1.5 px-2.5 rounded-[3px] bg-[#4f6bf5] hover:bg-[#3b55d9] disabled:opacity-50 text-white font-medium text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm"
          >
            <Sparkles size={13} />
            <span>Konuşmayı Otomatik Çözümle</span>
          </button>
        )}

        {/* Speech segments results */}
        {speechSegments.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-[#292F39]">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-[#E7EAF0] font-semibold">
                {speechSegments.length} Segment Yakalandı
              </span>
              <button
                type="button"
                onClick={handleApplySegmentsToTimeline}
                className="px-2 py-0.5 rounded-[2px] bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-[9px] transition-colors"
                title="Tüm altyazıları zaman çizelgesine kanal olarak ekle"
              >
                + Çizelgeye Ekle
              </button>
            </div>

            <div className="max-h-36 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
              {speechSegments.map((seg, idx) => (
                <div
                  key={seg.id}
                  className="p-1.5 rounded-[2px] bg-[#111419] border border-[#292F39] flex items-center justify-between text-[10px] hover:border-purple-500/50 transition-colors"
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="flex items-center gap-1 font-mono text-[#4f6bf5] text-[9px]">
                      <span>{seg.startSec.toFixed(2)}s</span>
                      <span>-</span>
                      <span>{seg.endSec.toFixed(2)}s</span>
                      <span className="text-[#5A6270]">({seg.duration.toFixed(2)}s)</span>
                    </div>
                    <p className="text-white truncate mt-0.5">{seg.text}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (activeClip && onSeek) {
                        onSeek(activeClip.startTime + seg.startSec);
                      }
                    }}
                    className="p-1 rounded text-[#929AA8] hover:text-white hover:bg-[#202631]"
                    title="Bu noktaya git"
                  >
                    <Play size={10} fill="currentColor" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2: AI DUPLICATE SPEECH & STUTTER CLEANER */}
      <div className="p-3 rounded-[3px] bg-[#171B21] border border-amber-500/30 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-amber-300 flex items-center gap-1.5">
            <Scissors className="w-3.5 h-3.5 text-amber-400" />
            <span>AI Tekrar & Kekeleme Temizleme</span>
          </span>
          <span className="text-[9px] font-mono bg-amber-950/60 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/40">
            Akustik Korelasyon
          </span>
        </div>

        <p className="text-[10px] text-[#929AA8] leading-relaxed">
          AI karakterlerinin aynı cümleyi iki kez söylediği anları (duplicate takes) veya kekelemeleri ses dalgasından yakalar ve tek tıkla boşluksuz keser.
        </p>

        <button
          type="button"
          onClick={handleScanDuplicates}
          disabled={!activeClip || isScanningDuplicates}
          className="w-full py-1.5 px-2.5 rounded-[3px] bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-medium text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm"
        >
          {isScanningDuplicates ? (
            <>
              <RefreshCw size={12} className="animate-spin" />
              <span>Dalga Boyu Karşılaştırılıyor...</span>
            </>
          ) : (
            <>
              <Scissors size={12} />
              <span>Tekrar Eden Cümleleri Tara</span>
            </>
          )}
        </button>

        {/* Detected Duplicates List */}
        {detectedDuplicates !== null && (
          <div className="space-y-2 pt-2 border-t border-[#292F39]">
            {detectedDuplicates.length === 0 ? (
              <div className="p-2 rounded bg-emerald-950/30 border border-emerald-500/30 text-emerald-300 text-[10px] flex items-center gap-1.5">
                <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
                <span>Kusursuz! Klipte tekrar eden cümle veya kekeleme bulunamadı.</span>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-amber-300 font-semibold">
                    {detectedDuplicates.length} Tekrar Tespit Edildi
                  </span>
                  <button
                    type="button"
                    onClick={handleCleanAllDuplicates}
                    className="px-2 py-0.5 rounded-[2px] bg-red-600 hover:bg-red-500 text-white font-medium text-[9px] transition-colors flex items-center gap-1"
                    title="Tüm tekrarları boşluksuz tek tıkla sil"
                  >
                    <Trash2 size={9} />
                    <span>Tümünü Sil</span>
                  </button>
                </div>

                <div className="max-h-48 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {detectedDuplicates.map((dup) => (
                    <div
                      key={dup.id}
                      className="p-2 rounded-[3px] bg-[#111419] border border-amber-500/40 space-y-1.5 text-[10px]"
                    >
                      <div className="flex items-center justify-between">
                        <span className="px-1.5 py-0.2 rounded bg-amber-950/80 text-amber-300 border border-amber-500/60 font-semibold text-[9px]">
                          %{dup.confidence} Eşleşme
                        </span>
                        <span className="text-[#5A6270] text-[9px] truncate max-w-[120px]">
                          {dup.type === 'hybrid'
                            ? 'Akustik + Metin'
                            : dup.type === 'text_repeat'
                            ? 'Metin Tekrarı'
                            : 'Akustik Dalga'}
                        </span>
                      </div>

                      {dup.textSnippet && (
                        <p className="text-white italic text-[10px] border-l-2 border-amber-400 pl-1.5 line-clamp-2">
                          "{dup.textSnippet}"
                        </p>
                      )}

                      <div className="grid grid-cols-2 gap-1 text-[9px] font-mono text-[#929AA8]">
                        <div className="bg-[#171B21] p-1 rounded">
                          <span className="text-amber-300/80 block">1. Okuma:</span>
                          <span>
                            {dup.firstOccurrence.startSec}s - {dup.firstOccurrence.endSec}s
                          </span>
                        </div>
                        <div className="bg-[#171B21] p-1 rounded">
                          <span className="text-red-400 block">2. Tekrar:</span>
                          <span>
                            {dup.duplicateOccurrence.startSec}s - {dup.duplicateOccurrence.endSec}s
                          </span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="grid grid-cols-2 gap-1 pt-1 border-t border-[#292F39]">
                        <button
                          type="button"
                          onClick={() => handleCleanDuplicateRange(dup, 'second', 'ripple_delete')}
                          className="py-1 px-1 rounded-[2px] bg-red-950/50 hover:bg-red-900/60 text-red-300 border border-red-500/40 text-[9px] font-medium transition-colors flex items-center justify-center gap-1"
                          title="Tekrar eden 2. okumayı kesip aradaki boşluğu kapat"
                        >
                          <Scissors size={9} />
                          <span>2. Tekrarı Kes</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCleanDuplicateRange(dup, 'second', 'vocal_mute')}
                          className="py-1 px-1 rounded-[2px] bg-amber-950/50 hover:bg-amber-900/60 text-amber-300 border border-amber-500/40 text-[9px] font-medium transition-colors flex items-center justify-center gap-1"
                          title="Görüntüyü kesmeden sadece karakterin sesini o aralıkta sustur"
                        >
                          <VolumeX size={9} />
                          <span>Sustur (Mute)</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* SECTION 3: SRT IMPORT & EXPORT */}
      <div className="space-y-2 pt-2 border-t border-[#292F39]">
        <label className="text-[10px] uppercase font-bold text-[#929AA8] tracking-wider block">
          Altyazı Dosyası (SRT / VTT)
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => srtInputRef.current?.click()}
            className="p-2 rounded-[3px] bg-[#171B21] hover:bg-[#202631] border border-[#292F39] hover:border-[#4f6bf5] text-white text-[10px] font-medium flex items-center justify-center gap-1.5 transition-colors"
          >
            <Upload size={11} className="text-[#4f6bf5]" />
            <span>SRT Yükle</span>
          </button>
          <button
            type="button"
            onClick={handleExportSrt}
            className="p-2 rounded-[3px] bg-[#171B21] hover:bg-[#202631] border border-[#292F39] hover:border-emerald-500 text-white text-[10px] font-medium flex items-center justify-center gap-1.5 transition-colors"
          >
            <Download size={11} className="text-emerald-400" />
            <span>SRT İndir</span>
          </button>
        </div>
      </div>
    </div>
  );
};
