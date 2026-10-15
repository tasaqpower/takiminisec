import React, { useRef, useState, useMemo } from 'react';
import { VideoProject, VideoClip } from '../../types';
import { speechRecognitionEngine, SpeechSegment, TimestampedWord } from '../../engine/speechRecognitionEngine';
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
  FileText,
  Ban,
  Check,
  ChevronRight,
  X,
  Volume2,
  Edit3,
  FileSpreadsheet,
} from 'lucide-react';

export interface SubtitlesTabProps {
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
    action: 'ripple_delete' | 'vocal_mute' | 'censor_bleep'
  ) => boolean;
  onToggleClipVocalMute?: (clipId: string, enableLipFreeze?: boolean) => void;
}

export interface FlattenedTranscriptWord {
  id: string;
  segId: string;
  word: string;
  startSec: number;
  endSec: number;
  confidence?: number;
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
  onToggleClipVocalMute,
}) => {
  const srtInputRef = useRef<HTMLInputElement>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // Sub-view Tab Mode: 'doc' (Descript Transcript Editor), 'duplicates' (AI Stutter Scanner), 'srt' (SRT Import/Export)
  const [viewMode, setViewMode] = useState<'doc' | 'duplicates' | 'srt'>('doc');

  // Real transcription state
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribeProgress, setTranscribeProgress] = useState(0);
  const [transcribeStatusText, setTranscribeStatusText] = useState('');
  const [speechSegments, setSpeechSegments] = useState<SpeechSegment[]>([]);

  // Duplicate speech detection state
  const [isScanningDuplicates, setIsScanningDuplicates] = useState(false);
  const [detectedDuplicates, setDetectedDuplicates] = useState<DetectedDuplicate[] | null>(null);

  // Descript Text-Based Selection State
  const [selectedWordIds, setSelectedWordIds] = useState<Set<string>>(new Set());
  const [lastClickedWordId, setLastClickedWordId] = useState<string | null>(null);

  // Segment inline text editing state
  const [editingSegId, setEditingSegId] = useState<string | null>(null);
  const [editingSegText, setEditingSegText] = useState<string>('');
  const [isScriptModalOpen, setIsScriptModalOpen] = useState(false);
  const [pastedScript, setPastedScript] = useState('');
  const [selectedSubtitleStyle, setSelectedSubtitleStyle] = useState<'hormozi' | 'neon-glow' | 'minimal-box' | 'typewriter'>('hormozi');

  // Update segment text manually and re-partition words proportionally
  const handleUpdateSegmentText = (segId: string, newText: string) => {
    setSpeechSegments((prev) =>
      prev.map((s) => {
        if (s.id !== segId) return s;
        const tokens = newText.trim().split(/\s+/).filter(Boolean);
        const totalChars = tokens.reduce((acc, t) => acc + t.length, 0);
        let cursorStart = s.startSec;
        const words = tokens.map((token) => {
          const charFraction = Math.max(1, token.length) / Math.max(1, totalChars);
          const wordDur = Math.max(0.08, s.duration * charFraction);
          const wordEnd = Math.min(s.endSec, cursorStart + wordDur);
          const w: TimestampedWord = {
            word: token,
            startSec: parseFloat(cursorStart.toFixed(3)),
            endSec: parseFloat(wordEnd.toFixed(3)),
          };
          cursorStart = wordEnd;
          return w;
        });
        return {
          ...s,
          text: newText,
          words,
        };
      })
    );
    setEditingSegId(null);
    setStatusBanner('Konuşma metni güncellendi ve kelime zaman damgaları senkronize edildi.');
    setTimeout(() => setStatusBanner(null), 3000);
  };

  // Align pasted script / Whisper transcript onto detected PCM VAD speech intervals
  const handleApplyPastedScript = () => {
    if (!pastedScript.trim() || speechSegments.length === 0) return;
    const sentences = pastedScript
      .split(/[.\n!?]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    setSpeechSegments((prev) =>
      prev.map((seg, idx) => {
        const text = sentences[idx] || seg.text || `Segment #${idx + 1}`;
        const tokens = text.split(/\s+/).filter(Boolean);
        const totalChars = tokens.reduce((acc, t) => acc + t.length, 0);
        let cursor = seg.startSec;
        const words = tokens.map((token) => {
          const fraction = Math.max(1, token.length) / Math.max(1, totalChars);
          const dur = Math.max(0.08, seg.duration * fraction);
          const end = Math.min(seg.endSec, cursor + dur);
          const w = {
            word: token,
            startSec: parseFloat(cursor.toFixed(3)),
            endSec: parseFloat(end.toFixed(3)),
          };
          cursor = end;
          return w;
        });
        return { ...seg, text, words };
      })
    );
    setIsScriptModalOpen(false);
    setPastedScript('');
    setStatusBanner('Senaryo metni akustik konuşma segmentleriyle senkronize edildi!');
    setTimeout(() => setStatusBanner(null), 3500);
  };

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

  // Compute all words flattened with precise start and end timestamps
  const allWords = useMemo<FlattenedTranscriptWord[]>(() => {
    if (!speechSegments || speechSegments.length === 0) return [];

    const result: FlattenedTranscriptWord[] = [];
    speechSegments.forEach((seg) => {
      if (seg.words && seg.words.length > 0) {
        seg.words.forEach((w, wIdx) => {
          result.push({
            id: `${seg.id}-${wIdx}`,
            segId: seg.id,
            word: w.word,
            startSec: w.startSec,
            endSec: w.endSec,
            confidence: w.confidence ?? seg.confidence,
          });
        });
      } else if (seg.text) {
        // Fallback: tokenize words proportionally across segment duration
        const tokens = seg.text.trim().split(/\s+/).filter(Boolean);
        const totalChars = tokens.reduce((acc, t) => acc + t.length, 0);
        let cursorStart = seg.startSec;

        tokens.forEach((token, wIdx) => {
          const charFraction = Math.max(1, token.length) / Math.max(1, totalChars);
          const wordDur = Math.max(0.08, seg.duration * charFraction);
          const wordEnd = Math.min(seg.endSec, cursorStart + wordDur);

          result.push({
            id: `${seg.id}-${wIdx}`,
            segId: seg.id,
            word: token,
            startSec: parseFloat(cursorStart.toFixed(3)),
            endSec: parseFloat(wordEnd.toFixed(3)),
            confidence: seg.confidence,
          });
          cursorStart = wordEnd;
        });
      }
    });

    return result;
  }, [speechSegments]);

  // Selected words and time range
  const selectedWords = useMemo(() => {
    if (selectedWordIds.size === 0) return [];
    return allWords.filter((w) => selectedWordIds.has(w.id));
  }, [allWords, selectedWordIds]);

  const selectionRange = useMemo(() => {
    if (selectedWords.length === 0) return null;
    const sorted = [...selectedWords].sort((a, b) => a.startSec - b.startSec);
    const startSec = sorted[0].startSec;
    const endSec = sorted[sorted.length - 1].endSec;
    const text = sorted.map((w) => w.word).join(' ');
    const duration = parseFloat((endSec - startSec).toFixed(3));
    return { startSec, endSec, text, duration, count: sorted.length };
  }, [selectedWords]);

  // Current active word for live karaoke highlight
  const activeWordId = useMemo(() => {
    if (!activeClip || allWords.length === 0) return null;
    const relTime = currentTime - activeClip.startTime;
    if (relTime < 0 || relTime > activeClip.duration) return null;

    const currentWord = allWords.find(
      (w) => relTime >= w.startSec - 0.05 && relTime <= w.endSec + 0.05
    );
    return currentWord ? currentWord.id : null;
  }, [allWords, currentTime, activeClip]);

  // Helper: check if a word is part of an AI duplicate take
  const getWordDuplicateInfo = (w: FlattenedTranscriptWord) => {
    if (!detectedDuplicates || detectedDuplicates.length === 0) return null;

    for (const dup of detectedDuplicates) {
      // Is it inside second duplicate take?
      if (
        w.startSec >= dup.duplicateOccurrence.startSec - 0.1 &&
        w.endSec <= dup.duplicateOccurrence.endSec + 0.1
      ) {
        return { isDuplicateSecondTake: true, dup };
      }
      // Is it inside first occurrence?
      if (
        w.startSec >= dup.firstOccurrence.startSec - 0.1 &&
        w.endSec <= dup.firstOccurrence.endSec + 0.1
      ) {
        return { isFirstOccurrence: true, dup };
      }
    }
    return null;
  };

  // Handle Word Selection (Click & Shift+Click range selection)
  const handleWordClick = (word: FlattenedTranscriptWord, e: React.MouseEvent) => {
    // 1. Jump playhead to word timestamp
    if (activeClip && onSeek) {
      onSeek(parseFloat((activeClip.startTime + word.startSec).toFixed(3)));
    }

    // 2. Range selection with Shift key
    if (e.shiftKey && lastClickedWordId) {
      const idxA = allWords.findIndex((w) => w.id === lastClickedWordId);
      const idxB = allWords.findIndex((w) => w.id === word.id);
      if (idxA !== -1 && idxB !== -1) {
        const [low, high] = [Math.min(idxA, idxB), Math.max(idxA, idxB)];
        const newSet = new Set(selectedWordIds);
        for (let i = low; i <= high; i++) {
          newSet.add(allWords[i].id);
        }
        setSelectedWordIds(newSet);
        return;
      }
    }

    // 3. Regular single click selection
    setSelectedWordIds((prev) => {
      const next = new Set(prev);
      if (next.has(word.id) && next.size === 1) {
        next.clear();
      } else {
        next.clear();
        next.add(word.id);
      }
      return next;
    });
    setLastClickedWordId(word.id);
  };

  // Select all words in a sentence/segment
  const handleSelectSegment = (segId: string) => {
    const segWords = allWords.filter((w) => w.segId === segId);
    if (segWords.length === 0) return;

    const newSet = new Set<string>();
    segWords.forEach((w) => newSet.add(w.id));
    setSelectedWordIds(newSet);
    if (activeClip && onSeek) {
      onSeek(parseFloat((activeClip.startTime + segWords[0].startSec).toFixed(3)));
    }
  };

  // Descript Action 1: Ripple Delete Selected Range (+ Automatic Smooth Jump-Cut)
  const handleRippleCutSelected = () => {
    if (!selectionRange || !activeClip || !onRemoveDuplicateRange) return;

    const ok = onRemoveDuplicateRange(
      activeClip.id,
      selectionRange.startSec,
      selectionRange.endSec,
      'ripple_delete'
    );

    if (ok) {
      setStatusBanner(
        `"${selectionRange.text.substring(0, 30)}..." kesildi, boşluk kapatıldı ve Smooth Cut uygulandı!`
      );
      // Remove cut words from speechSegments
      removeWordRangeFromSegments(selectionRange.startSec, selectionRange.endSec);
      setSelectedWordIds(new Set());
      setLastClickedWordId(null);
      setTimeout(() => setStatusBanner(null), 4000);
    }
  };

  // Descript Action 2: Vocal Mute + Lip-Freeze Selected Range
  const handleVocalMuteSelected = () => {
    if (!selectionRange || !activeClip || !onRemoveDuplicateRange) return;

    const ok = onRemoveDuplicateRange(
      activeClip.id,
      selectionRange.startSec,
      selectionRange.endSec,
      'vocal_mute'
    );

    if (ok) {
      setStatusBanner(
        `"${selectionRange.text.substring(0, 30)}..." karakterin sesi kısıldı ve ağzı donduruldu (Lip-Freeze)!`
      );
      setSelectedWordIds(new Set());
      setLastClickedWordId(null);
      setTimeout(() => setStatusBanner(null), 4000);
    }
  };

  // Descript Action 3: Smart 1000Hz Censor Bleep Selected Range
  const handleCensorBleepSelected = () => {
    if (!selectionRange || !activeClip || !onRemoveDuplicateRange) return;

    const ok = onRemoveDuplicateRange(
      activeClip.id,
      selectionRange.startSec,
      selectionRange.endSec,
      'censor_bleep'
    );

    if (ok) {
      setStatusBanner(
        `"${selectionRange.text.substring(0, 30)}..." 1000Hz sansür bipi ile sansürlendi (arka plan korundu)!`
      );
      setSelectedWordIds(new Set());
      setLastClickedWordId(null);
      setTimeout(() => setStatusBanner(null), 4000);
    }
  };

  // Remove cut words from memory speech segments to maintain synchronized UI
  const removeWordRangeFromSegments = (cutStartSec: number, cutEndSec: number) => {
    const cutDuration = cutEndSec - cutStartSec;
    setSpeechSegments((prev) => {
      const updated: SpeechSegment[] = [];

      for (const seg of prev) {
        // Segment before cut
        if (seg.endSec <= cutStartSec + 0.05) {
          updated.push(seg);
        }
        // Segment after cut: shift timestamps left
        else if (seg.startSec >= cutEndSec - 0.05) {
          updated.push({
            ...seg,
            startSec: Math.max(0, seg.startSec - cutDuration),
            endSec: Math.max(0, seg.endSec - cutDuration),
            words: seg.words?.map((w) => ({
              ...w,
              startSec: Math.max(0, w.startSec - cutDuration),
              endSec: Math.max(0, w.endSec - cutDuration),
            })),
          });
        }
        // Segment partially overlapping cut
        else {
          const remainingWords = (seg.words || []).filter(
            (w) => w.endSec <= cutStartSec + 0.05 || w.startSec >= cutEndSec - 0.05
          );
          if (remainingWords.length > 0) {
            const firstW = remainingWords[0];
            const lastW = remainingWords[remainingWords.length - 1];
            updated.push({
              ...seg,
              startSec: firstW.startSec > cutEndSec ? firstW.startSec - cutDuration : firstW.startSec,
              endSec: lastW.endSec > cutEndSec ? lastW.endSec - cutDuration : lastW.endSec,
              text: remainingWords.map((w) => w.word).join(' '),
              words: remainingWords.map((w) => ({
                ...w,
                startSec: w.startSec > cutEndSec ? w.startSec - cutDuration : w.startSec,
                endSec: w.endSec > cutEndSec ? w.endSec - cutDuration : w.endSec,
              })),
            });
          }
        }
      }

      return updated;
    });
  };

  // Load High-Quality AI Demo Transcript (Instant testing without upload)
  const handleLoadDemoSpeech = () => {
    const demoSegments: SpeechSegment[] = [
      {
        id: 'seg-demo-1',
        startSec: 0.4,
        endSec: 2.8,
        duration: 2.4,
        energy: 0.85,
        text: 'Herkese merhaba arkadaşlar yapay zeka',
        words: [
          { word: 'Herkese', startSec: 0.4, endSec: 0.9 },
          { word: 'merhaba', startSec: 0.95, endSec: 1.45 },
          { word: 'arkadaşlar', startSec: 1.5, endSec: 2.1 },
          { word: 'yapay', startSec: 2.15, endSec: 2.45 },
          { word: 'zeka', startSec: 2.5, endSec: 2.8 },
        ],
      },
      {
        id: 'seg-demo-2',
        startSec: 3.2,
        endSec: 6.8,
        duration: 3.6,
        energy: 0.88,
        text: 'Herkese merhaba arkadaşlar yapay zeka video editörümüzün en yeni özelliklerini tanıtıyorum.',
        words: [
          { word: 'Herkese', startSec: 3.2, endSec: 3.65 },
          { word: 'merhaba', startSec: 3.7, endSec: 4.15 },
          { word: 'arkadaşlar', startSec: 4.2, endSec: 4.75 },
          { word: 'yapay', startSec: 4.8, endSec: 5.1 },
          { word: 'zeka', startSec: 5.15, endSec: 5.4 },
          { word: 'video', startSec: 5.45, endSec: 5.75 },
          { word: 'editörümüzün', startSec: 5.8, endSec: 6.2 },
          { word: 'en', startSec: 6.25, endSec: 6.4 },
          { word: 'yeni', startSec: 6.45, endSec: 6.6 },
          { word: 'özelliklerini', startSec: 6.65, endSec: 7.1 },
          { word: 'tanıtıyorum.', startSec: 7.15, endSec: 7.6 },
        ],
      },
      {
        id: 'seg-demo-3',
        startSec: 8.0,
        endSec: 12.2,
        duration: 4.2,
        energy: 0.82,
        text: 'Metin üzerinden dilediğiniz kelimeyi seçip silebilir, susturabilir veya sansür bipi ekleyebilirsiniz.',
        words: [
          { word: 'Metin', startSec: 8.0, endSec: 8.4 },
          { word: 'üzerinden', startSec: 8.45, endSec: 8.9 },
          { word: 'dilediğiniz', startSec: 8.95, endSec: 9.4 },
          { word: 'kelimeyi', startSec: 9.45, endSec: 9.85 },
          { word: 'seçip', startSec: 9.9, endSec: 10.2 },
          { word: 'silebilir,', startSec: 10.25, endSec: 10.7 },
          { word: 'susturabilir', startSec: 10.75, endSec: 11.3 },
          { word: 'veya', startSec: 11.35, endSec: 11.55 },
          { word: 'sansür', startSec: 11.6, endSec: 11.9 },
          { word: 'bipi', startSec: 11.95, endSec: 12.1 },
          { word: 'ekleyebilirsiniz.', startSec: 12.15, endSec: 12.8 },
        ],
      },
    ];

    setSpeechSegments(demoSegments);
    // Also preset detected duplicates (stutter between seg-1 and seg-2)
    setDetectedDuplicates([
      {
        id: 'dup-demo-1',
        type: 'hybrid',
        confidence: 94,
        textSnippet: 'Herkese merhaba arkadaşlar yapay zeka',
        firstOccurrence: { startSec: 0.4, endSec: 2.8, duration: 2.4 },
        duplicateOccurrence: { startSec: 3.2, endSec: 5.4, duration: 2.2 },
      },
    ]);

    setStatusBanner('Örnek AI konuşma metni ve tekrar eden cümleler yüklendi!');
    setTimeout(() => setStatusBanner(null), 3500);
  };

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
      // Relative word timestamps relative to subtitle clip start
      const relWords = (item.words || []).map((w) => ({
        word: w.word,
        startSec: Math.max(0, parseFloat((w.startSec - item.startSec).toFixed(3))),
        endSec: Math.max(0, parseFloat((w.endSec - item.startSec).toFixed(3))),
      }));

      onAddClip(subTrackId, {
        name: (item.text || `Konuşma ${idx + 1}`).substring(0, 24),
        type: 'subtitle',
        startTime: parseFloat((clipStart + item.startSec).toFixed(2)),
        duration: parseFloat(item.duration.toFixed(2)),
        sourceDuration: parseFloat(item.duration.toFixed(2)),
        textData: {
          text: item.text || `Konuşma ${idx + 1}`,
          fontSize: selectedSubtitleStyle === 'hormozi' ? 36 : 30,
          fontFamily: selectedSubtitleStyle === 'typewriter' ? 'Courier New' : 'Plus Jakarta Sans',
          color: selectedSubtitleStyle === 'neon-glow' ? '#38bdf8' : '#FFFFFF',
          backgroundColor: selectedSubtitleStyle === 'minimal-box' ? 'rgba(0,0,0,0.85)' : undefined,
          textAlign: 'center',
          lineHeight: 1.2,
          subtitleStyle: selectedSubtitleStyle,
          subtitleWords: relWords,
          activeWordColor: selectedSubtitleStyle === 'hormozi' ? '#facc15' : selectedSubtitleStyle === 'neon-glow' ? '#4ade80' : '#ffffff',
          activeWordScale: selectedSubtitleStyle === 'hormozi' ? 1.15 : 1.05,
          activeWordBoxColor: selectedSubtitleStyle === 'minimal-box' ? '#4f6bf5' : undefined,
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
      if (action === 'ripple_delete') {
        removeWordRangeFromSegments(range.startSec, range.endSec);
      }
      setDetectedDuplicates((prev) => (prev ? prev.filter((d) => d.id !== dup.id) : null));
      setTimeout(() => setStatusBanner(null), 3500);
    }
  };

  // Clean all duplicate second takes in one click
  const handleCleanAllDuplicates = () => {
    if (!onRemoveDuplicateRange || !activeClip || !detectedDuplicates || detectedDuplicates.length === 0) {
      return;
    }

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
      if (ok) {
        removeWordRangeFromSegments(dup.duplicateOccurrence.startSec, dup.duplicateOccurrence.endSec);
        count++;
      }
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
    <div className="space-y-3 p-3 text-xs bg-[#111419] flex flex-col h-full select-none">
      <input
        type="file"
        ref={srtInputRef}
        onChange={handleSrtUpload}
        accept=".srt,.vtt,.txt"
        className="hidden"
      />

      {/* Header & Sub-view Mode Selector */}
      <div className="space-y-2 border-b border-[#292F39] pb-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Subtitles className="w-4 h-4 text-[#4f6bf5]" />
            <span className="font-semibold text-[#E7EAF0]">Descript & Altyazı Stüdyosu</span>
          </div>
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#171B21] border border-[#292F39] text-[#929AA8]">
            v2.5
          </span>
        </div>

        {/* View Mode Tabs: Document, Duplicates, SRT */}
        <div className="grid grid-cols-3 gap-1 bg-[#171B21] p-0.5 rounded-[4px] border border-[#292F39]">
          <button
            type="button"
            data-testid="subtitles-tab-doc"
            onClick={() => setViewMode('doc')}
            className={`py-1 px-1.5 rounded-[3px] text-[10px] font-medium flex items-center justify-center gap-1 transition-all ${
              viewMode === 'doc'
                ? 'bg-[#4f6bf5] text-white shadow-sm font-semibold'
                : 'text-[#929AA8] hover:text-[#E7EAF0] hover:bg-[#202631]'
            }`}
          >
            <FileText size={11} />
            <span>Metin Kurgu</span>
          </button>
          <button
            type="button"
            data-testid="subtitles-tab-duplicates"
            onClick={() => setViewMode('duplicates')}
            className={`py-1 px-1.5 rounded-[3px] text-[10px] font-medium flex items-center justify-center gap-1 transition-all ${
              viewMode === 'duplicates'
                ? 'bg-amber-600 text-white shadow-sm font-semibold'
                : 'text-[#929AA8] hover:text-amber-300 hover:bg-[#202631]'
            }`}
          >
            <Scissors size={11} />
            <span>AI Tekrarlar</span>
            {detectedDuplicates && detectedDuplicates.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[8px] flex items-center justify-center font-bold">
                {detectedDuplicates.length}
              </span>
            )}
          </button>
          <button
            type="button"
            data-testid="subtitles-tab-srt"
            onClick={() => setViewMode('srt')}
            className={`py-1 px-1.5 rounded-[3px] text-[10px] font-medium flex items-center justify-center gap-1 transition-all ${
              viewMode === 'srt'
                ? 'bg-emerald-600 text-white shadow-sm font-semibold'
                : 'text-[#929AA8] hover:text-emerald-300 hover:bg-[#202631]'
            }`}
          >
            <Download size={11} />
            <span>SRT / Altyazı</span>
          </button>
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

      {/* ======================================================== */}
      {/* MODE 1: DESCRIPT TRANSCRIPT-BASED INTERACTIVE EDITOR     */}
      {/* ======================================================== */}
      {viewMode === 'doc' && (
        <div className="flex-1 flex flex-col space-y-2.5 min-h-0">
          {/* Action Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Mic size={13} className="text-purple-400" />
              <span className="text-white font-medium text-[11px]">Etkileşimli Metin Belgesi</span>
            </div>
            {speechSegments.length > 0 && (
              <span className="text-[9px] font-mono text-[#929AA8]">
                {allWords.length} kelime · {speechSegments.length} cümle
              </span>
            )}
          </div>

          {/* Transcribing Progress bar */}
          {isTranscribing && (
            <div className="p-2.5 rounded-[4px] bg-[#171B21] border border-purple-500/40 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-purple-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                  <span>🧠 Whisper AI (%100 Tarayıcı İçi / Ücretsiz)</span>
                </span>
                <span className="font-mono text-[10px] font-bold text-purple-200">{transcribeProgress}%</span>
              </div>
              <p className="text-[10px] text-[#929AA8] leading-tight truncate">
                {transcribeStatusText || 'Yapay Zeka Ses Modeli Hazırlanıyor / Çözümleniyor...'}
              </p>
              <div className="w-full h-1.5 bg-[#0E1014] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 via-indigo-500 to-[#4f6bf5] transition-all duration-200"
                  style={{ width: `${transcribeProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Empty State / Quick Transcribe buttons */}
          {speechSegments.length === 0 && !isTranscribing && (
            <div className="p-3.5 rounded-[3px] bg-[#171B21] border border-[#292F39] space-y-2.5 text-center">
              <div className="w-8 h-8 rounded-full bg-purple-950/60 border border-purple-500/40 flex items-center justify-center mx-auto text-purple-300">
                <FileText size={16} />
              </div>
              <div>
                <p className="text-white font-semibold text-[11px]">Konuşma Metni Henüz Çıkarılmadı</p>
                <p className="text-[10px] text-[#929AA8] mt-1 leading-relaxed">
                  Klipteki konuşmayı Whisper WASM ile %100 tarayıcı içinde kelime kelime metne dökebilir, kelime seçerek videoyu kırpabilirsiniz.
                </p>
              </div>

              <div className="space-y-1.5 pt-1">
                <button
                  type="button"
                  data-testid="btn-start-transcription"
                  onClick={handleStartRealTranscription}
                  disabled={!activeClip || isTranscribing}
                  className="w-full py-1.5 px-2.5 rounded-[3px] bg-gradient-to-r from-purple-600 to-[#4f6bf5] hover:from-purple-500 hover:to-[#3b55d9] disabled:opacity-50 text-white font-medium text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                  title="WASM / WebGPU ile %100 yerel Whisper Tiny modelini çalıştırır (Sıfır API Key)"
                >
                  <Sparkles size={13} />
                  <span>🎙️ Whisper AI ile Konuşmayı Çözümle</span>
                </button>
                <button
                  type="button"
                  data-testid="btn-load-demo-speech"
                  onClick={handleLoadDemoSpeech}
                  className="w-full py-1.5 px-2 rounded-[3px] bg-[#202631] hover:bg-[#28303e] border border-[#292F39] text-[#93c5fd] font-medium text-[10px] flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Sparkles size={11} className="text-amber-400" />
                  <span>Örnek AI Konuşma Metni Yükle (Hızlı Test)</span>
                </button>
              </div>
            </div>
          )}

          {/* Document Content View */}
          {speechSegments.length > 0 && (
            <div className="flex-1 flex flex-col min-h-0 bg-[#0E1014] border border-[#292F39] rounded-[4px] overflow-hidden">
              {/* Document Toolbar */}
              <div className="px-2.5 py-1.5 bg-[#171B21] border-b border-[#292F39] flex items-center justify-between text-[10px]">
                <div className="flex items-center gap-2 text-[#929AA8]">
                  <span>Kelimeye tıkla: Oynatıcı oraya gider</span>
                  <span>·</span>
                  <span>Shift+Tık: Aralık seç</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsScriptModalOpen(true)}
                    className="px-1.5 py-0.5 rounded bg-[#202631] hover:bg-[#28303e] border border-[#292F39] text-[#93c5fd] font-medium text-[9px] flex items-center gap-1 transition-colors"
                    title="Senaryo / Whisper Metni Yapıştır ve Akustik Aralıklarla Hizala"
                  >
                    <FileSpreadsheet size={10} />
                    <span>Senaryo Yapıştır</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleApplySegmentsToTimeline}
                    className="px-1.5 py-0.5 rounded bg-emerald-700/80 hover:bg-emerald-600 text-white font-medium text-[9px] transition-colors"
                    title="Altyazı olarak ekle"
                  >
                    + Altyazı Ekle
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSpeechSegments([]);
                      setSelectedWordIds(new Set());
                      setDetectedDuplicates(null);
                    }}
                    className="p-1 rounded text-[#5A6270] hover:text-red-400 hover:bg-[#202631]"
                    title="Metni Temizle"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>

              {/* CapCut / Hormozi Subtitle Style Selector */}
              <div className="px-2.5 py-1.5 bg-[#12151B] border-b border-[#292F39] flex items-center justify-between text-[10px]">
                <span className="text-[#929AA8] font-bold uppercase tracking-wider text-[9px] flex items-center gap-1">
                  <span>🎬</span>
                  <span>Altyazı Stili (CapCut & Hormozi):</span>
                </span>
                <div className="flex items-center gap-1">
                  {[
                    { id: 'hormozi', label: '⚡ Hormozi Bold', desc: 'Sarı aktif kelime + Pop-up büyüme' },
                    { id: 'neon-glow', label: '✨ Neon Glow', desc: 'Neon yeşil parlama efekti' },
                    { id: 'minimal-box', label: '📦 Minimal Box', desc: 'Mavi kutulu kelime vurgusu' },
                    { id: 'typewriter', label: '⌨️ Typewriter', desc: 'Daktilo harf harf akış' },
                  ].map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      data-testid={`btn-subtitle-style-${st.id}`}
                      onClick={() => setSelectedSubtitleStyle(st.id as any)}
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition-colors ${
                        selectedSubtitleStyle === st.id
                          ? 'bg-[#4f6bf5] text-white border-indigo-400 shadow-sm'
                          : 'bg-[#171B21] text-[#929AA8] border-[#292F39] hover:text-[#E7EAF0]'
                      }`}
                      title={st.desc}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Scrollable Document Text Body */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar text-[12px] leading-relaxed">
                {speechSegments.map((seg, sIdx) => {
                  const segWords = allWords.filter((w) => w.segId === seg.id);

                  return (
                    <div
                      key={seg.id}
                      className="group p-2 rounded-[4px] bg-[#14181F]/60 border border-[#202631] hover:border-[#4f6bf5]/40 transition-colors space-y-1.5"
                    >
                      {/* Segment Speaker / Timestamp Header */}
                      <div className="flex items-center justify-between text-[9px] text-[#5A6270]">
                        <div className="flex items-center gap-1.5 font-mono">
                          <span className="text-purple-400 font-semibold">#{sIdx + 1}</span>
                          <span className="text-[#929AA8]">
                            {seg.startSec.toFixed(2)}s - {seg.endSec.toFixed(2)}s
                          </span>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingSegId(seg.id);
                              setEditingSegText(seg.text || '');
                            }}
                            className="p-1 rounded text-[#929AA8] hover:text-[#93c5fd] hover:bg-[#202631]"
                            title="Metni Düzenle"
                          >
                            <Edit3 size={10} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSelectSegment(seg.id)}
                            className="px-1 py-0.5 rounded bg-[#202631] hover:bg-[#4f6bf5] text-[#929AA8] hover:text-white text-[9px] transition-colors"
                          >
                            Cümleyi Seç
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (activeClip && onSeek) {
                                onSeek(activeClip.startTime + seg.startSec);
                              }
                            }}
                            className="p-1 rounded text-[#929AA8] hover:text-white hover:bg-[#202631]"
                            title="Cümlenin başına git"
                          >
                            <Play size={10} fill="currentColor" />
                          </button>
                        </div>
                      </div>

                      {/* Inline Segment Text Editor or Interactive Words */}
                      {editingSegId === seg.id ? (
                        <div className="flex items-center gap-1.5 py-1">
                          <input
                            type="text"
                            value={editingSegText}
                            onChange={(e) => setEditingSegText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleUpdateSegmentText(seg.id, editingSegText);
                              if (e.key === 'Escape') setEditingSegId(null);
                            }}
                            className="flex-1 px-2 py-1 rounded bg-[#0E1014] border border-[#4f6bf5] text-white text-[11px] outline-none"
                            autoFocus
                            placeholder="Konuşma metnini yazın..."
                          />
                          <button
                            type="button"
                            onClick={() => handleUpdateSegmentText(seg.id, editingSegText)}
                            className="p-1 px-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-0.5 text-[9px] font-semibold"
                            title="Kaydet"
                          >
                            <Check size={10} />
                            <span>Kaydet</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingSegId(null)}
                            className="p-1 rounded bg-[#202631] text-[#929AA8] hover:text-white"
                            title="İptal"
                          >
                            <X size={10} />
                          </button>
                        </div>
                      ) : (
                        /* Interactive Words */
                        <div className="flex flex-wrap gap-x-1.5 gap-y-1">
                        {segWords.map((wordObj) => {
                          const isSelected = selectedWordIds.has(wordObj.id);
                          const isKaraokeActive = activeWordId === wordObj.id;
                          const dupInfo = getWordDuplicateInfo(wordObj);

                          return (
                            <span
                              key={wordObj.id}
                              onClick={(e) => handleWordClick(wordObj, e)}
                              className={`cursor-pointer px-1 py-0.5 rounded text-[11px] transition-all duration-100 ${
                                isKaraokeActive
                                  ? 'bg-[#4f6bf5] text-white font-bold ring-2 ring-[#4f6bf5]/80 shadow-md shadow-blue-500/40 scale-105 z-10'
                                  : isSelected
                                  ? 'bg-[#3b55d9] text-white font-semibold ring-1 ring-blue-400'
                                  : dupInfo?.isDuplicateSecondTake
                                  ? 'bg-amber-950/60 border border-amber-500/80 text-amber-300 line-through decoration-amber-400 hover:bg-amber-900/60'
                                  : dupInfo?.isFirstOccurrence
                                  ? 'bg-amber-950/25 border-b-2 border-amber-500/60 text-[#E7EAF0] hover:bg-[#202631]'
                                  : 'text-[#D0D6E0] hover:bg-[#202631] hover:text-white'
                              }`}
                              title={`${wordObj.word} (${wordObj.startSec.toFixed(2)}s - ${wordObj.endSec.toFixed(2)}s)${
                                dupInfo?.isDuplicateSecondTake ? ' [AI Tekrar - Silinebilir]' : ''
                              }`}
                            >
                              {wordObj.word}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>

              {/* FLOATING ACTION BAR: TRIGGERED ON WORD SELECTION */}
              {selectionRange && (
                <div className="p-2.5 bg-[#171B21] border-t-2 border-[#4f6bf5] shadow-xl space-y-2 animate-in slide-in-from-bottom duration-150">
                  <div className="flex items-center justify-between text-[10px]">
                    <div className="min-w-0 flex-1 pr-2">
                      <span className="text-[#929AA8] block text-[9px] font-semibold uppercase">
                        Seçili Metin ({selectionRange.count} Kelime · {selectionRange.duration}s):
                      </span>
                      <p className="text-white font-medium italic truncate">
                        "{selectionRange.text}"
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedWordIds(new Set());
                        setLastClickedWordId(null);
                      }}
                      className="p-1 rounded text-[#929AA8] hover:text-white hover:bg-[#202631]"
                      title="Seçimi İptal Et"
                    >
                      <X size={12} />
                    </button>
                  </div>

                  {/* 3 Core Text-Based Video Editing Actions */}
                  <div className="grid grid-cols-3 gap-1">
                    {/* Action 1: Ripple Delete + Smooth Cut */}
                    <button
                      type="button"
                      onClick={handleRippleCutSelected}
                      className="py-1.5 px-1 rounded-[3px] bg-red-600 hover:bg-red-500 text-white font-medium text-[9px] flex flex-col items-center justify-center gap-0.5 transition-colors shadow-sm"
                      title="Seçili aralığı videodan keser, boşluğu kapatır ve kafa sıçramasını önlemek için Smooth Cut ekler"
                    >
                      <div className="flex items-center gap-1 font-semibold">
                        <Scissors size={10} />
                        <span>Kes & Kapat</span>
                      </div>
                      <span className="text-[8px] text-red-100 font-normal opacity-90">Ripple + Smooth</span>
                    </button>

                    {/* Action 2: Vocal Mute + Lip-Freeze */}
                    <button
                      type="button"
                      onClick={handleVocalMuteSelected}
                      className="py-1.5 px-1 rounded-[3px] bg-purple-600 hover:bg-purple-500 text-white font-medium text-[9px] flex flex-col items-center justify-center gap-0.5 transition-colors shadow-sm"
                      title="Arka plan sesi çalmaya devam ederken karakterin sesini kısar ve dudaklarını nötr karesinde dondurur"
                    >
                      <div className="flex items-center gap-1 font-semibold">
                        <VolumeX size={10} />
                        <span>Sustur & Dondur</span>
                      </div>
                      <span className="text-[8px] text-purple-100 font-normal opacity-90">Lip-Freeze</span>
                    </button>

                    {/* Action 3: Smart 1000Hz Censor Bleep */}
                    <button
                      type="button"
                      onClick={handleCensorBleepSelected}
                      className="py-1.5 px-1 rounded-[3px] bg-amber-600 hover:bg-amber-500 text-white font-medium text-[9px] flex flex-col items-center justify-center gap-0.5 transition-colors shadow-sm"
                      title="Arka plan sesini %35'e düşürür ve seçili kelimelerin üzerine 1000Hz sansür bipi ekler"
                    >
                      <div className="flex items-center gap-1 font-semibold">
                        <Ban size={10} />
                        <span>Sansürle (Bip)</span>
                      </div>
                      <span className="text-[8px] text-amber-100 font-normal opacity-90">1000Hz Smart</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* MODE 2: AI DUPLICATE SPEECH & STUTTER CLEANER            */}
      {/* ======================================================== */}
      {viewMode === 'duplicates' && (
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
                            title="Karakterin sesini susturur ve ağzını dondurur, arka plan müziği kesilmez"
                          >
                            <VolumeX size={9} />
                            <span>Sustur + Lip-Freeze</span>
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
      )}

      {/* ======================================================== */}
      {/* MODE 3: SRT / VTT ALTYAZI İÇE & DIŞA AKTAR               */}
      {/* ======================================================== */}
      {viewMode === 'srt' && (
        <div className="p-3 rounded-[3px] bg-[#171B21] border border-[#292F39] space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
              <Download className="w-3.5 h-3.5" />
              <span>Altyazı Dosyası (SRT / VTT)</span>
            </span>
          </div>

          <p className="text-[10px] text-[#929AA8] leading-relaxed">
            Mevcut altyazı dosyanızı yükleyerek zaman çizelgesine aktarabilir veya projenizdeki altyazıları standart .SRT formatında dışa aktarabilirsiniz.
          </p>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => srtInputRef.current?.click()}
              className="p-2.5 rounded-[3px] bg-[#111419] hover:bg-[#202631] border border-[#292F39] hover:border-[#4f6bf5] text-white text-[11px] font-medium flex flex-col items-center justify-center gap-1 transition-colors"
            >
              <Upload size={14} className="text-[#4f6bf5]" />
              <span>SRT Yükle</span>
            </button>
            <button
              type="button"
              onClick={handleExportSrt}
              className="p-2.5 rounded-[3px] bg-[#111419] hover:bg-[#202631] border border-[#292F39] hover:border-emerald-500 text-white text-[11px] font-medium flex flex-col items-center justify-center gap-1 transition-colors"
            >
              <Download size={14} className="text-emerald-400" />
              <span>SRT İndir</span>
            </button>
          </div>
        </div>
      )}

      {/* Script / Transcript Paste Modal */}
      {isScriptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-none">
          <div className="w-full max-w-md bg-[#111419] border border-[#292F39] rounded-lg shadow-2xl p-4 space-y-3 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#292F39] pb-2">
              <div className="flex items-center gap-1.5 text-white font-semibold text-xs">
                <FileSpreadsheet size={14} className="text-[#4f6bf5]" />
                <span>Senaryo / Whisper Metni Yapıştır</span>
              </div>
              <button
                type="button"
                onClick={() => setIsScriptModalOpen(false)}
                className="text-[#929AA8] hover:text-white"
              >
                <X size={14} />
              </button>
            </div>

            <p className="text-[10px] text-[#929AA8] leading-relaxed">
              Video senaryonuzu veya AI transkriptinizi aşağıya yapıştırın. Sistem cümleleri otomatik ayırarak videodan çıkarılan PCM akustik konuşma segmentleriyle eşleştirecektir.
            </p>

            <textarea
              rows={6}
              value={pastedScript}
              onChange={(e) => setPastedScript(e.target.value)}
              placeholder="Senaryo veya konuşma metnini buraya yapıştırın..."
              className="w-full p-2.5 rounded bg-[#0E1014] border border-[#292F39] text-white text-[11px] outline-none focus:border-[#4f6bf5] custom-scrollbar"
            />

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsScriptModalOpen(false)}
                className="px-2.5 py-1 rounded bg-[#202631] text-[#929AA8] hover:text-white text-[10px]"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={handleApplyPastedScript}
                disabled={!pastedScript.trim()}
                className="px-3 py-1 rounded bg-[#4f6bf5] hover:bg-[#3b55d9] disabled:opacity-50 text-white font-medium text-[10px] flex items-center gap-1"
              >
                <Check size={11} />
                <span>Akustik Segmentlerle Eşle</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
