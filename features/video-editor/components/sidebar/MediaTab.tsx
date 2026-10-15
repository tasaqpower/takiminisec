import React, { useState, useRef } from 'react';
import { VideoProject, MediaAsset, VideoClip } from '../../types';
import { saveAssetBlob } from '../../db';
import { audioMixer } from '../../engine/audioMixer';
import { generateCoverThumbnail } from '../../engine/thumbnailGenerator';
import { useEditorDragDrop } from '../../context/DragDropContext';
import {
  Upload,
  Monitor,
  Video,
  Mic,
  Link,
  Plus,
  Search,
  Trash2,
  Film,
  Music,
  Image as ImageIcon,
  GripVertical,
  Sparkles,
  Square,
  Check,
} from 'lucide-react';

interface StockMediaPreset {
  id: string;
  name: string;
  category: 'intro' | 'motion' | 'tech' | 'nature';
  tag: string;
  duration: number;
  previewBg: string;
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
}

const STOCK_MEDIA_PRESETS: StockMediaPreset[] = [
  {
    id: 'test-video-a',
    name: 'Klip A — Mavi Test (440 Hz)',
    category: 'motion',
    tag: 'Klip A',
    duration: 5,
    previewBg: '#1e3a8a',
    draw: (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#1e3a8a');
      grad.addColorStop(0.5, '#2563eb');
      grad.addColorStop(1, '#1d4ed8');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = '#93c5fd';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 220, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 240px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('A', w / 2, h / 2 - 15);

      ctx.fillStyle = '#bfdbfe';
      ctx.font = 'bold 36px sans-serif';
      ctx.fillText('KLİP A (440 HZ)', w / 2, h / 2 + 160);
    },
  },
  {
    id: 'test-video-b',
    name: 'Klip B — Turuncu Test (880 Hz)',
    category: 'motion',
    tag: 'Klip B',
    duration: 5,
    previewBg: '#c2410c',
    draw: (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#c2410c');
      grad.addColorStop(0.5, '#ea580c');
      grad.addColorStop(1, '#f97316');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = '#fed7aa';
      ctx.lineWidth = 8;
      ctx.strokeRect(w / 2 - 200, h / 2 - 200, 400, 400);

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 240px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('B', w / 2, h / 2 - 15);

      ctx.fillStyle = '#ffedd5';
      ctx.font = 'bold 36px sans-serif';
      ctx.fillText('KLİP B (880 HZ)', w / 2, h / 2 + 160);
    },
  },
  {
    id: 'countdown-intro',
    name: '5 Sn Sinematik Geri Sayım',
    category: 'intro',
    tag: 'İntro',
    duration: 5,
    previewBg: '#090d16',
    draw: (ctx, w, h) => {
      const grad = ctx.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, w / 1.5);
      grad.addColorStop(0, '#1e1b4b');
      grad.addColorStop(0.7, '#0f172a');
      grad.addColorStop(1, '#020617');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = 'rgba(234, 179, 8, 0.4)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 280, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#fbbf24';
      ctx.font = '900 180px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('5', w / 2, h / 2 - 10);

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 36px sans-serif';
      ctx.fillText('BAŞLIYOR', w / 2, h / 2 + 150);
    },
  },
  {
    id: 'deep-space',
    name: 'Kozmik Galaksi & Yıldızlar',
    category: 'motion',
    tag: 'Uzay',
    duration: 6,
    previewBg: '#0b001a',
    draw: (ctx, w, h) => {
      const grad = ctx.createRadialGradient(w * 0.3, h * 0.4, 80, w / 2, h / 2, w);
      grad.addColorStop(0, '#581c87');
      grad.addColorStop(0.4, '#1e1b4b');
      grad.addColorStop(0.8, '#090514');
      grad.addColorStop(1, '#000000');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      for (let i = 0; i < 220; i++) {
        const x = (Math.sin(i * 99) * 0.5 + 0.5) * w;
        const y = (Math.cos(i * 33) * 0.5 + 0.5) * h;
        const r = i % 3 === 0 ? 2.5 : i % 2 === 0 ? 1.5 : 0.8;
        ctx.fillStyle = i % 5 === 0 ? '#38bdf8' : i % 4 === 0 ? '#f472b6' : '#ffffff';
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 44px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('KOZMİK UZAY & NEBULA', w / 2, h / 2);
    },
  },
  {
    id: 'cyber-tech',
    name: 'Matrix Siber Ağ & Kod',
    category: 'tech',
    tag: 'Siber',
    duration: 5,
    previewBg: '#021814',
    draw: (ctx, w, h) => {
      ctx.fillStyle = '#020d0a';
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = 'rgba(16, 185, 129, 0.15)';
      ctx.lineWidth = 1;
      const step = 60;
      for (let x = 0; x < w; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      ctx.fillStyle = '#10b981';
      ctx.font = '900 48px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('< CYBER MATRIX PROTOCOL />', w / 2, h / 2);
    },
  },
  {
    id: 'ocean-waves',
    name: 'Okyanus & Sakin Gün Batımı',
    category: 'nature',
    tag: 'Doğa',
    duration: 6,
    previewBg: '#0c4a6e',
    draw: (ctx, w, h) => {
      const sky = ctx.createLinearGradient(0, 0, 0, h * 0.65);
      sky.addColorStop(0, '#f97316');
      sky.addColorStop(0.5, '#fb923c');
      sky.addColorStop(1, '#fed7aa');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h * 0.65);

      ctx.fillStyle = '#fff7ed';
      ctx.beginPath();
      ctx.arc(w / 2, h * 0.45, 90, 0, Math.PI * 2);
      ctx.fill();

      const sea = ctx.createLinearGradient(0, h * 0.65, 0, h);
      sea.addColorStop(0, '#0284c7');
      sea.addColorStop(1, '#082f49');
      ctx.fillStyle = sea;
      ctx.fillRect(0, h * 0.65, w, h * 0.35);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 44px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('OKYANUS VE SAKİNLİK', w / 2, h * 0.3);
    },
  },
];

interface MediaTabProps {
  project: VideoProject;
  currentTime: number;
  selectedClipId?: string | null;
  onAddClip: (trackId: string, clipData: Partial<VideoClip>) => VideoClip;
  findTrack: (type: 'video' | 'audio' | 'text' | 'subtitle') => string;
  getNextClipStartTime: (trackId: string) => number;
}

export const MediaTab: React.FC<MediaTabProps> = ({
  project,
  currentTime,
  onAddClip,
  findTrack,
  getNextClipStartTime,
}) => {
  const { startDrag, isClickSuppressed } = useEditorDragDrop();
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [isRecordingScreen, setIsRecordingScreen] = useState(false);
  const [isRecordingWebcam, setIsRecordingWebcam] = useState(false);
  const [isUrlInputOpen, setIsUrlInputOpen] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [isUrlLoading, setIsUrlLoading] = useState(false);
  const [customColor, setCustomColor] = useState('#4f46e5');
  const [mediaSubTab, setMediaSubTab] = useState<'all' | 'stock' | 'colors' | 'uploads'>('all');
  const [assetFilter, setAssetFilter] = useState<'all' | 'video' | 'audio' | 'image'>('all');
  const [assetSearch, setAssetSearch] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const screenRecRef = useRef<MediaRecorder | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const webcamRecRef = useRef<MediaRecorder | null>(null);
  const webcamStreamRef = useRef<MediaStream | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isVideo = file.type.startsWith('video');
      const isAudio = file.type.startsWith('audio');
      const isImage = file.type.startsWith('image');

      if (!isVideo && !isAudio && !isImage) continue;

      const assetId = 'asset-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
      await saveAssetBlob(assetId, file);

      let duration = 5;
      let width: number | undefined;
      let height: number | undefined;
      let thumbnailUrl: string | undefined;

      const objectUrl = URL.createObjectURL(file);

      if (isVideo) {
        const v = document.createElement('video');
        v.preload = 'metadata';
        v.src = objectUrl;
        await new Promise<void>((res) => {
          v.onloadedmetadata = () => {
            duration = v.duration || 5;
            width = v.videoWidth;
            height = v.videoHeight;
            res();
          };
          v.onerror = () => res();
        });

        const thumb = await generateCoverThumbnail(file, 1.0);
        if (thumb) thumbnailUrl = thumb;
      } else if (isAudio) {
        const a = document.createElement('audio');
        a.preload = 'metadata';
        a.src = objectUrl;
        await new Promise<void>((res) => {
          a.onloadedmetadata = () => {
            duration = a.duration || 5;
            res();
          };
          a.onerror = () => res();
        });
      } else if (isImage) {
        const img = new Image();
        img.src = objectUrl;
        await new Promise<void>((res) => {
          img.onload = () => {
            width = img.width;
            height = img.height;
            res();
          };
          img.onerror = () => res();
        });
        thumbnailUrl = objectUrl;
      }

      const newAsset: MediaAsset = {
        id: assetId,
        name: file.name,
        type: isVideo ? 'video' : isAudio ? 'audio' : 'image',
        mimeType: file.type,
        size: file.size,
        duration,
        width,
        height,
        thumbnailUrl,
        blob: file,
      };

      setAssets((prev) => [newAsset, ...prev]);

      const targetType = isVideo ? 'video' : isAudio ? 'audio' : 'video';
      const targetTrackId = findTrack(targetType);
      const startTime = getNextClipStartTime(targetTrackId);

      onAddClip(targetTrackId, {
        assetId: newAsset.id,
        name: newAsset.name,
        type: newAsset.type,
        sourceUrl: objectUrl,
        startTime,
        duration: isImage ? 4 : duration,
        sourceDuration: duration,
        trimIn: 0,
        trimOut: isImage ? 4 : duration,
      });
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const addDemoColorClip = (name: string, color: string) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1920, 1080);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 72px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, 960, 540);

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const assetId = 'asset-color-' + Date.now();
      await saveAssetBlob(assetId, blob);
      const url = URL.createObjectURL(blob);

      const newAsset: MediaAsset = {
        id: assetId,
        name: `${name} (Arka Plan)`,
        type: 'image',
        mimeType: 'image/png',
        size: blob.size,
        duration: 5,
        thumbnailUrl: url,
        url,
        blob,
      };
      setAssets((prev) => [newAsset, ...prev]);

      const targetTrackId = findTrack('video');
      onAddClip(targetTrackId, {
        assetId,
        name: `${name} (Arka Plan)`,
        type: 'image',
        sourceUrl: url,
        startTime: currentTime,
        duration: 5,
        sourceDuration: 5,
        trimIn: 0,
        trimOut: 5,
      });
      setStatusBanner(`"${name}" arka plan katmanı eklendi!`);
      setTimeout(() => setStatusBanner(null), 3000);
    }, 'image/png');
  };

  const addStockMediaClip = (preset: StockMediaPreset) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d')!;
    preset.draw(ctx, 1920, 1080);

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const assetId = 'stock-' + preset.id + '-' + Date.now();
      await saveAssetBlob(assetId, blob);
      const url = URL.createObjectURL(blob);

      const newAsset: MediaAsset = {
        id: assetId,
        name: `${preset.name}`,
        type: 'image',
        mimeType: 'image/png',
        size: blob.size,
        duration: preset.duration,
        thumbnailUrl: url,
        url,
        blob,
      };
      setAssets((prev) => [newAsset, ...prev]);

      const targetTrackId = findTrack('video');
      const startPos = currentTime > 0 ? currentTime : getNextClipStartTime(targetTrackId);
      onAddClip(targetTrackId, {
        assetId,
        name: preset.name,
        type: 'image',
        sourceUrl: url,
        startTime: startPos,
        duration: preset.duration,
        sourceDuration: preset.duration,
        trimIn: 0,
        trimOut: preset.duration,
      });
      setStatusBanner(`"${preset.name}" zaman çizelgesine eklendi!`);
      setTimeout(() => setStatusBanner(null), 3000);
    }, 'image/png');
  };

  const toggleScreenRecording = async () => {
    if (isRecordingScreen) {
      if (screenRecRef.current && screenRecRef.current.state !== 'inactive') {
        screenRecRef.current.stop();
      }
      setIsRecordingScreen(false);
    } else {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        alert('Tarayıcınız ekran kaydı özelliğini desteklemiyor.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: { ideal: 30 } },
          audio: true,
        });
        screenStreamRef.current = stream;

        const chunks: Blob[] = [];
        const mediaRec = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8,opus' });
        screenRecRef.current = mediaRec;

        mediaRec.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunks.push(e.data);
        };

        mediaRec.onstop = async () => {
          stream.getTracks().forEach((t) => t.stop());
          const completeBlob = new Blob(chunks, { type: 'video/webm' });
          const assetId = 'screen-' + Date.now();
          await saveAssetBlob(assetId, completeBlob);
          const url = URL.createObjectURL(completeBlob);

          const newAsset: MediaAsset = {
            id: assetId,
            name: 'Ekran Kaydı (' + new Date().toLocaleTimeString('tr-TR') + ')',
            type: 'video',
            mimeType: 'video/webm',
            size: completeBlob.size,
            duration: 8,
            url,
            blob: completeBlob,
          };
          setAssets((prev) => [newAsset, ...prev]);

          const targetTrackId = findTrack('video');
          onAddClip(targetTrackId, {
            assetId,
            name: newAsset.name,
            type: 'video',
            sourceUrl: url,
            startTime: currentTime,
            duration: 8,
            sourceDuration: 8,
            trimIn: 0,
            trimOut: 8,
          });
          setStatusBanner('Ekran kaydı başarıyla eklendi!');
          setTimeout(() => setStatusBanner(null), 3000);
        };

        stream.getVideoTracks()[0].onended = () => {
          if (mediaRec.state !== 'inactive') {
            mediaRec.stop();
          }
          setIsRecordingScreen(false);
        };

        mediaRec.start(500);
        setIsRecordingScreen(true);
      } catch (err: any) {
        if (err.name !== 'NotAllowedError') {
          alert('Ekran kaydı başlatılamadı: ' + err.message);
        }
      }
    }
  };

  const toggleWebcamRecording = async () => {
    if (isRecordingWebcam) {
      if (webcamRecRef.current && webcamRecRef.current.state !== 'inactive') {
        webcamRecRef.current.stop();
      }
      setIsRecordingWebcam(false);
    } else {
      if (!navigator.mediaDevices?.getUserMedia) {
        alert('Tarayıcınız kamera kaydı özelliğini desteklemiyor.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720 },
          audio: true,
        });
        webcamStreamRef.current = stream;

        const chunks: Blob[] = [];
        const mediaRec = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8,opus' });
        webcamRecRef.current = mediaRec;

        mediaRec.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunks.push(e.data);
        };

        mediaRec.onstop = async () => {
          stream.getTracks().forEach((t) => t.stop());
          const completeBlob = new Blob(chunks, { type: 'video/webm' });
          const assetId = 'cam-' + Date.now();
          await saveAssetBlob(assetId, completeBlob);
          const url = URL.createObjectURL(completeBlob);

          const newAsset: MediaAsset = {
            id: assetId,
            name: 'Kamera Kaydı (' + new Date().toLocaleTimeString('tr-TR') + ')',
            type: 'video',
            mimeType: 'video/webm',
            size: completeBlob.size,
            duration: 6,
            url,
            blob: completeBlob,
          };
          setAssets((prev) => [newAsset, ...prev]);

          const targetTrackId = findTrack('video');
          onAddClip(targetTrackId, {
            assetId,
            name: newAsset.name,
            type: 'video',
            sourceUrl: url,
            startTime: currentTime,
            duration: 6,
            sourceDuration: 6,
            trimIn: 0,
            trimOut: 6,
          });
          setStatusBanner('Kamera kaydı başarıyla eklendi!');
          setTimeout(() => setStatusBanner(null), 3000);
        };

        mediaRec.start(500);
        setIsRecordingWebcam(true);
      } catch (err: any) {
        if (err.name !== 'NotAllowedError') {
          alert('Kamera kaydı başlatılamadı: ' + err.message);
        }
      }
    }
  };

  const toggleVoiceRecording = async () => {
    if (isRecordingVoice) {
      const blob = await audioMixer.stopVoiceRecording();
      setIsRecordingVoice(false);
      if (blob) {
        const assetId = 'voice-' + Date.now();
        await saveAssetBlob(assetId, blob);
        const url = URL.createObjectURL(blob);
        const trackId = findTrack('audio');
        onAddClip(trackId, {
          assetId,
          name: 'Ses Kaydı (Mikrofon)',
          type: 'audio',
          sourceUrl: url,
          startTime: currentTime,
          duration: 5,
          sourceDuration: 5,
        });
        setStatusBanner('Ses kaydı eklendi!');
        setTimeout(() => setStatusBanner(null), 3000);
      }
    } else {
      try {
        await audioMixer.startVoiceRecording();
        setIsRecordingVoice(true);
      } catch {
        alert('Mikrofona erişilemedi.');
      }
    }
  };

  const handleImportUrl = async () => {
    if (!urlInput.trim()) return;
    setIsUrlLoading(true);
    try {
      const res = await fetch(urlInput.trim());
      const blob = await res.blob();
      const isVideo = blob.type.startsWith('video') || urlInput.match(/\.(mp4|webm|mov)($|\?)/i);
      const isAudio = blob.type.startsWith('audio') || urlInput.match(/\.(mp3|wav|ogg|aac)($|\?)/i);
      const isImage = blob.type.startsWith('image') || urlInput.match(/\.(png|jpg|jpeg|webp|gif|svg)($|\?)/i);

      const assetId = 'url-' + Date.now();
      await saveAssetBlob(assetId, blob);
      const url = URL.createObjectURL(blob);
      const filename = urlInput.split('/').pop()?.split('?')[0] || 'Web Medyası';

      const newAsset: MediaAsset = {
        id: assetId,
        name: filename,
        type: isVideo ? 'video' : isAudio ? 'audio' : 'image',
        mimeType: blob.type || (isVideo ? 'video/mp4' : isAudio ? 'audio/mp3' : 'image/png'),
        size: blob.size,
        duration: isImage ? 4 : 8,
        url,
        blob,
      };
      setAssets((prev) => [newAsset, ...prev]);

      const targetType = isAudio ? 'audio' : 'video';
      const targetTrackId = findTrack(targetType);
      onAddClip(targetTrackId, {
        assetId,
        name: filename,
        type: newAsset.type,
        sourceUrl: url,
        startTime: currentTime,
        duration: isImage ? 4 : 8,
        sourceDuration: isImage ? 4 : 8,
        trimIn: 0,
        trimOut: isImage ? 4 : 8,
      });
      setUrlInput('');
      setIsUrlInputOpen(false);
      setStatusBanner('Web medyası başarıyla aktarıldı!');
      setTimeout(() => setStatusBanner(null), 3000);
    } catch (err: any) {
      alert('URL yüklenirken hata oluştu: ' + err.message);
    } finally {
      setIsUrlLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-2.5 p-2.5 text-xs select-none">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        multiple
        accept="video/*,audio/*,image/*"
        className="hidden"
      />

      {statusBanner && (
        <div className="p-1.5 rounded-[3px] bg-[#141C27] border border-[#26374D] text-[#b0cbe8] text-[11px] flex items-center gap-1.5 animate-in fade-in duration-100">
          <Sparkles className="w-3.5 h-3.5 text-[#4f6bf5] shrink-0" />
          <span className="truncate">{statusBanner}</span>
        </div>
      )}

      {/* 1. TOP NLE ACTION TOOLBAR (Compact, 28px height) */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex-1 h-7 px-2 rounded-[3px] bg-[#171B21] hover:bg-[#202631] border border-[#292F39] text-[#E7EAF0] text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
          title="Bilgisayarınızdan video, ses veya görsel içe aktarın"
        >
          <Upload size={12} className="text-[#4f6bf5]" />
          <span>İçe Aktar</span>
        </button>

        {/* Quick recording icons */}
        <button
          type="button"
          onClick={toggleScreenRecording}
          title={isRecordingScreen ? 'Ekran Kaydını Durdur' : 'Ekran Kaydı'}
          className={`w-7 h-7 rounded-[3px] flex items-center justify-center border transition-colors ${
            isRecordingScreen
              ? 'bg-red-950/80 border-red-700 text-red-400 animate-pulse'
              : 'bg-[#171B21] border-[#292F39] text-[#929AA8] hover:text-[#E7EAF0] hover:bg-[#202631]'
          }`}
        >
          {isRecordingScreen ? <Square size={11} /> : <Monitor size={12} />}
        </button>

        <button
          type="button"
          onClick={toggleWebcamRecording}
          title={isRecordingWebcam ? 'Kamera Kaydını Durdur' : 'Kamera Kaydı'}
          className={`w-7 h-7 rounded-[3px] flex items-center justify-center border transition-colors ${
            isRecordingWebcam
              ? 'bg-red-950/80 border-red-700 text-red-400 animate-pulse'
              : 'bg-[#171B21] border-[#292F39] text-[#929AA8] hover:text-[#E7EAF0] hover:bg-[#202631]'
          }`}
        >
          {isRecordingWebcam ? <Square size={11} /> : <Video size={12} />}
        </button>

        <button
          type="button"
          onClick={toggleVoiceRecording}
          title={isRecordingVoice ? 'Ses Kaydını Durdur' : 'Mikrofon Kaydı'}
          className={`w-7 h-7 rounded-[3px] flex items-center justify-center border transition-colors ${
            isRecordingVoice
              ? 'bg-red-950/80 border-red-700 text-red-400 animate-pulse'
              : 'bg-[#171B21] border-[#292F39] text-[#929AA8] hover:text-[#E7EAF0] hover:bg-[#202631]'
          }`}
        >
          {isRecordingVoice ? <Square size={11} /> : <Mic size={12} />}
        </button>

        <button
          type="button"
          onClick={() => setIsUrlInputOpen((prev) => !prev)}
          title="Web Bağlantısından İçe Aktar (URL)"
          className={`w-7 h-7 rounded-[3px] flex items-center justify-center border transition-colors ${
            isUrlInputOpen
              ? 'bg-[#202631] border-[#4f6bf5] text-[#4f6bf5]'
              : 'bg-[#171B21] border-[#292F39] text-[#929AA8] hover:text-[#E7EAF0] hover:bg-[#202631]'
          }`}
        >
          <Link size={12} />
        </button>
      </div>

      {/* URL Import Bar (Collapsible) */}
      {isUrlInputOpen && (
        <div className="p-2 rounded-[3px] bg-[#111419] border border-[#292F39] space-y-1.5 animate-in fade-in duration-100">
          <div className="flex gap-1">
            <input
              type="url"
              placeholder="https://example.com/video.mp4"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              className="flex-1 px-2 py-1 rounded-[2px] bg-[#171B21] border border-[#292F39] text-[#E7EAF0] text-[11px] outline-none focus:border-[#4f6bf5]"
            />
            <button
              type="button"
              disabled={isUrlLoading || !urlInput.trim()}
              onClick={handleImportUrl}
              className="px-2.5 py-1 rounded-[2px] bg-[#4f6bf5] hover:bg-[#3b55d9] disabled:opacity-40 text-white font-medium text-[11px] whitespace-nowrap"
            >
              {isUrlLoading ? '...' : 'İndir'}
            </button>
          </div>
        </div>
      )}

      {/* 2. SEARCH & CATEGORY FILTER */}
      <div className="space-y-1.5 shrink-0">
        <div className="relative">
          <Search size={12} className="text-[#5A6270] absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Medyalarda filtrele..."
            value={assetSearch}
            onChange={(e) => setAssetSearch(e.target.value)}
            className="w-full h-7 pl-7 pr-2 rounded-[3px] bg-[#111419] border border-[#292F39] text-[#E7EAF0] text-xs outline-none focus:border-[#4f6bf5] placeholder-[#5A6270]"
          />
        </div>

        {/* Filter Segment Tabs */}
        <div className="flex rounded-[3px] bg-[#111419] p-0.5 border border-[#292F39]">
          {[
            { id: 'all', label: 'Tümü' },
            { id: 'stock', label: 'Stok' },
            { id: 'colors', label: 'Zemin' },
            { id: 'uploads', label: `Medyam (${assets.length})` },
          ].map((sub) => (
            <button
              key={sub.id}
              type="button"
              onClick={() => setMediaSubTab(sub.id as any)}
              className={`flex-1 py-1 px-1 rounded-[2px] text-[10px] font-medium transition-colors truncate text-center ${
                mediaSubTab === sub.id
                  ? 'bg-[#202631] text-[#E7EAF0] shadow-sm'
                  : 'text-[#929AA8] hover:text-[#E7EAF0]'
              }`}
            >
              {sub.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. SCROLLABLE MEDIA LIST (Desktop NLE layout) */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-0.5 custom-scrollbar">
        {/* STOCK PRESETS */}
        {(mediaSubTab === 'all' || mediaSubTab === 'stock') && (
          <div className="space-y-1">
            <div className="text-[10px] font-semibold text-[#929AA8] uppercase tracking-wider px-1">
              Hazır Stok Klipler
            </div>
            <div className="space-y-1">
              {STOCK_MEDIA_PRESETS.filter(
                (p) => !assetSearch.trim() || p.name.toLowerCase().includes(assetSearch.toLowerCase())
              ).map((preset) => (
                <div
                  key={preset.id}
                  data-stock-clip={preset.id}
                  onPointerDown={(e) => {
                    if (e.button === 0) {
                      startDrag(
                        {
                          type: 'image',
                          id: preset.id,
                          name: preset.name,
                          icon: 'Film',
                          duration: preset.duration,
                          category: preset.category,
                          data: preset,
                        },
                        e.clientX,
                        e.clientY
                      );
                    }
                  }}
                  onClick={() => {
                    if (isClickSuppressed()) return;
                    addStockMediaClip(preset);
                  }}
                  className="group relative flex items-center justify-between p-1.5 rounded-[3px] bg-[#171B21] hover:bg-[#202631] border border-[#292F39] hover:border-[#3B4351] cursor-grab active:cursor-grabbing transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-6 rounded-[2px] bg-[#0E1014] border border-[#292F39] flex items-center justify-center shrink-0">
                      <Film size={11} className="text-[#6ba1df]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-[#E7EAF0] group-hover:text-white truncate">
                        {preset.name}
                      </p>
                      <p className="text-[10px] text-[#5A6270] font-mono leading-none">
                        {preset.duration}s • {preset.tag}
                      </p>
                    </div>
                  </div>
                  <GripVertical size={13} className="text-[#5A6270] group-hover:text-[#929AA8] shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CHROMA & COLOR PRESETS */}
        {(mediaSubTab === 'all' || mediaSubTab === 'colors') && (
          <div className="space-y-1 pt-1">
            <div className="text-[10px] font-semibold text-[#929AA8] uppercase tracking-wider px-1">
              Renk & Zeminler
            </div>
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => addDemoColorClip('Yeşil Perde', '#00ff00')}
                className="p-1.5 rounded-[3px] bg-[#171B21] hover:bg-[#202631] border border-[#292F39] flex items-center gap-1.5 text-left transition-colors"
              >
                <span className="w-3 h-3 rounded-[2px] bg-[#00ff00] shrink-0" />
                <span className="text-xs text-[#E7EAF0] truncate">Yeşil Perde</span>
              </button>
              <button
                type="button"
                onClick={() => addDemoColorClip('Mavi Perde', '#0000ff')}
                className="p-1.5 rounded-[3px] bg-[#171B21] hover:bg-[#202631] border border-[#292F39] flex items-center gap-1.5 text-left transition-colors"
              >
                <span className="w-3 h-3 rounded-[2px] bg-[#0000ff] shrink-0" />
                <span className="text-xs text-[#E7EAF0] truncate">Mavi Perde</span>
              </button>
            </div>
          </div>
        )}

        {/* UPLOADED ASSETS */}
        {(mediaSubTab === 'all' || mediaSubTab === 'uploads') && (
          <div className="space-y-1 pt-1">
            <div className="flex items-center justify-between text-[10px] font-semibold text-[#929AA8] uppercase tracking-wider px-1">
              <span>Yüklenen Medyalar ({assets.length})</span>
              {assets.length > 0 && (
                <button
                  type="button"
                  onClick={() => setAssets([])}
                  className="text-red-400 hover:text-red-300 normal-case font-normal"
                >
                  Temizle
                </button>
              )}
            </div>

            {assets.length === 0 ? (
              <div className="p-3 rounded-[3px] bg-[#111419] border border-[#292F39] text-center text-xs text-[#5A6270]">
                Henüz medya yüklenmedi.
              </div>
            ) : (
              <div className="space-y-1">
                {assets
                  .filter((a) => !assetSearch.trim() || a.name.toLowerCase().includes(assetSearch.toLowerCase()))
                  .map((asset) => (
                    <div
                      key={asset.id}
                      data-media-item={asset.id}
                      onPointerDown={(e) => {
                        if (e.button === 0) {
                          startDrag(
                            {
                              type: asset.type === 'audio' ? 'audio' : asset.type === 'image' ? 'image' : 'video',
                              id: asset.id,
                              name: asset.name,
                              icon: asset.type === 'audio' ? 'Music' : asset.type === 'image' ? 'Image' : 'Film',
                              duration: asset.type === 'image' ? 4 : asset.duration,
                              data: asset,
                            },
                            e.clientX,
                            e.clientY
                          );
                        }
                      }}
                      onClick={() => {
                        if (isClickSuppressed()) return;
                        const targetTrackId = findTrack(asset.type === 'audio' ? 'audio' : 'video');
                        const startPos = currentTime > 0 ? currentTime : getNextClipStartTime(targetTrackId);
                        onAddClip(targetTrackId, {
                          assetId: asset.id,
                          name: asset.name,
                          type: asset.type,
                          sourceUrl: asset.url,
                          startTime: startPos,
                          duration: asset.type === 'image' ? 4 : asset.duration,
                          sourceDuration: asset.duration,
                        });
                      }}
                      className="group flex items-center justify-between p-1.5 rounded-[3px] bg-[#171B21] hover:bg-[#202631] border border-[#292F39] hover:border-[#3B4351] cursor-grab active:cursor-grabbing transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-6 rounded-[2px] bg-[#0E1014] border border-[#292F39] flex items-center justify-center shrink-0 overflow-hidden">
                          {asset.thumbnailUrl ? (
                            <img src={asset.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                          ) : asset.type === 'audio' ? (
                            <Music size={11} className="text-[#4ade94]" />
                          ) : asset.type === 'image' ? (
                            <ImageIcon size={11} className="text-[#f59e0b]" />
                          ) : (
                            <Film size={11} className="text-[#6ba1df]" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-[#E7EAF0] group-hover:text-white truncate">
                            {asset.name}
                          </p>
                          <p className="text-[10px] text-[#5A6270] font-mono leading-none">
                            {asset.duration.toFixed(1)}s • {asset.type.toUpperCase()}
                          </p>
                        </div>
                      </div>
                      <GripVertical size={13} className="text-[#5A6270] group-hover:text-[#929AA8] shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
