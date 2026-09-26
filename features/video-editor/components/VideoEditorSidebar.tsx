import React, { useState, useRef } from 'react';
import { VideoProject, MediaAsset, VideoClip, TransitionType, ClipEffects, TextLayerData } from '../types';
import { saveAssetBlob } from '../db';
import { audioMixer } from '../engine/audioMixer';
import { generateCoverThumbnail } from '../engine/thumbnailGenerator';
import { BUILTIN_SFX_LIST, playSfxPreview, generateSfxBlob, SfxType } from '../engine/sfxGenerator';
import { COLOR_PRESETS } from '../engine/filterEngine';
import { TRANSITION_DEFINITIONS } from '../engine/transitionEngine';
import { TEXT_STYLE_PRESETS } from '../engine/textRasterizer';

interface SidebarProps {
  project: VideoProject;
  onAddClip: (trackId: string, clipData: Partial<VideoClip>) => VideoClip;
  onAddTextClip: (
    trackId: string,
    text: string,
    startTime?: number,
    duration?: number,
    initialData?: Partial<TextLayerData>
  ) => void;
  onAddTrack: (type: 'video' | 'audio' | 'text' | 'subtitle', name?: string) => void;
  onSetBackgroundColor: (color: string) => void;
  onSetDuration: (duration: number) => void;
  currentTime: number;
  selectedClipId?: string | null;
  onUpdateClipEffects?: (clipId: string, effects: Partial<ClipEffects>) => void;
  onUpdateClip?: (clipId: string, updates: Partial<VideoClip>) => void;
}

type TabType = 'media' | 'text' | 'audio' | 'transitions' | 'filters' | 'subtitles' | 'elements' | 'settings';

export const VideoEditorSidebar: React.FC<SidebarProps> = ({
  project,
  onAddClip,
  onAddTextClip,
  onAddTrack,
  onSetBackgroundColor,
  onSetDuration,
  currentTime,
  selectedClipId,
  onUpdateClipEffects,
  onUpdateClip,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('media');
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [sfxCategory, setSfxCategory] = useState<'all' | 'sfx' | 'bgm'>('all');
  const [addingSfxId, setAddingSfxId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Find suitable track
  const findTrack = (type: 'video' | 'audio' | 'text' | 'subtitle') => {
    const t = project.tracks.find((track) => track.type === type && !track.locked);
    if (t) return t.id;
    if (type === 'text' || type === 'subtitle') {
      return '';
    }
    return project.tracks[0]?.id || '';
  };

  // Handle local file upload
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

        // Generate thumbnail
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

      // Automatically add to timeline
      const targetType = isVideo ? 'video' : isAudio ? 'audio' : 'video';
      const targetTrackId = findTrack(targetType);

      onAddClip(targetTrackId, {
        assetId: newAsset.id,
        name: newAsset.name,
        type: newAsset.type,
        sourceUrl: objectUrl,
        startTime: currentTime,
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

  // Add demo asset for immediate testing
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
    ctx.fillText(name, 960, 540);

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const assetId = 'asset-color-' + Date.now();
      await saveAssetBlob(assetId, blob);
      const url = URL.createObjectURL(blob);

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
    }, 'image/png');
  };

  // Live microphone voiceover toggle
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
      }
    } else {
      try {
        await audioMixer.startVoiceRecording();
        setIsRecordingVoice(true);
      } catch (err) {
        alert('Mikrofon erişim izni alınamadı: ' + err);
      }
    }
  };

  return (
    <aside className="w-80 bg-[#0d1117] border-r border-[#21262d] flex flex-col shrink-0 select-none z-10">
      {/* Navigation Tabs */}
      <div className="flex border-b border-[#21262d] overflow-x-auto no-scrollbar bg-[#161b22]/50 p-1 gap-1">
        {[
          { id: 'media', label: 'Medya', icon: '📁' },
          { id: 'text', label: 'Metin', icon: '🔤' },
          { id: 'audio', label: 'Ses', icon: '🎵' },
          { id: 'transitions', label: 'Geçişler', icon: '🔀' },
          { id: 'filters', label: 'Filtreler', icon: '🎨' },
          { id: 'subtitles', label: 'Altyazı', icon: '💬' },
          { id: 'settings', label: 'Ayarlar', icon: '⚙️' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
                : 'text-gray-400 hover:text-gray-200 hover:bg-[#21262d]'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* 1. MEDIA TAB */}
        {activeTab === 'media' && (
          <div className="space-y-4">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              multiple
              accept="video/*,audio/*,image/*"
              className="hidden"
            />

            {/* Upload & Record Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center p-3 rounded-lg border border-dashed border-[#30363d] hover:border-indigo-500 hover:bg-[#161b22] text-gray-300 hover:text-white transition-all group"
              >
                <svg className="w-6 h-6 text-indigo-400 group-hover:scale-110 transition-transform mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <span className="text-xs font-semibold">Dosya Yükle</span>
                <span className="text-[10px] text-gray-500">Video, Ses, Görsel</span>
              </button>

              <button
                onClick={toggleVoiceRecording}
                className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${
                  isRecordingVoice
                    ? 'border-red-500 bg-red-950/30 text-red-300 animate-pulse'
                    : 'border-[#30363d] hover:border-red-500 hover:bg-[#161b22] text-gray-300 hover:text-white'
                }`}
              >
                <svg className="w-6 h-6 text-red-400 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                <span className="text-xs font-semibold">
                  {isRecordingVoice ? 'Kaydı Durdur' : 'Ses Kaydet'}
                </span>
                <span className="text-[10px] text-gray-500">Mikrofon</span>
              </button>
            </div>

            {/* Quick Demo Solid Clips */}
            <div>
              <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Hızlı Renk Katmanları
              </h4>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { name: 'Koyu Mavi', color: '#1e293b' },
                  { name: 'Kırmızı', color: '#881337' },
                  { name: 'Zümrüt', color: '#064e3b' },
                  { name: 'Mor Gece', color: '#3b0764' },
                  { name: 'Kömür', color: '#18181b' },
                  { name: 'Altın', color: '#78350f' },
                ].map((c) => (
                  <button
                    key={c.name}
                    onClick={() => addDemoColorClip(c.name, c.color)}
                    style={{ backgroundColor: c.color }}
                    className="h-10 rounded-md border border-white/10 hover:border-white text-[10px] font-medium text-white/90 shadow transition-all flex items-center justify-center p-1 text-center"
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Asset library list */}
            <div>
              <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Yüklenen Medyalar ({assets.length})
              </h4>
              {assets.length === 0 ? (
                <div className="p-4 rounded-lg bg-[#161b22]/50 border border-[#21262d] text-center text-xs text-gray-500">
                  Henüz medya yüklenmedi. Yukarıdaki butondan video veya ses dosyaları ekleyebilirsiniz.
                </div>
              ) : (
                <div className="space-y-2">
                  {assets.map((asset) => (
                    <div
                      key={asset.id}
                      onClick={() => {
                        const targetTrackId = findTrack(asset.type === 'audio' ? 'audio' : 'video');
                        onAddClip(targetTrackId, {
                          assetId: asset.id,
                          name: asset.name,
                          type: asset.type,
                          startTime: currentTime,
                          duration: asset.type === 'image' ? 4 : asset.duration,
                          sourceDuration: asset.duration,
                        });
                      }}
                      className="flex items-center gap-2.5 p-2 rounded-lg bg-[#161b22] hover:bg-[#21262d] border border-[#30363d] cursor-pointer group transition-all"
                    >
                      <div className="w-12 h-10 rounded bg-[#0d1117] flex items-center justify-center overflow-hidden border border-white/5">
                        {asset.thumbnailUrl ? (
                          <img src={asset.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-base">{asset.type === 'audio' ? '🎵' : '📹'}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-200 truncate group-hover:text-indigo-300">
                          {asset.name}
                        </p>
                        <p className="text-[10px] text-gray-500">
                          {Math.round(asset.duration)} sn • {asset.type.toUpperCase()}
                        </p>
                      </div>
                      <button className="p-1 rounded text-gray-400 group-hover:text-indigo-400" title="Timeline'a Ekle">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 2. TEXT TAB */}
        {activeTab === 'text' && (
          <div className="space-y-4">
            <div className="p-2.5 rounded-lg bg-indigo-950/30 border border-indigo-900/50 text-[11px] text-indigo-300 flex items-start gap-2">
              <svg className="w-4 h-4 shrink-0 text-indigo-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Türkçe karakterler (ç, Ç, ğ, Ğ, ı, İ, ö, Ö, ş, Ş, ü, Ü) tam desteklenir. Tuval üzerinde çift tıklayarak doğrudan düzenleyebilirsiniz.</span>
            </div>

            {/* 6 Quick-Add Templates */}
            <div>
              <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Hızlı Metin Şablonları (6 Çeşit)
              </h4>
              <div className="space-y-2">
                {[
                  {
                    label: 'Başlık (Heading)',
                    text: 'FORMA VİDEO DÜZENLEME',
                    desc: 'Büyük ve dikkat çekici ana başlık',
                    data: { fontSize: 64, fontWeight: 'bold' as const },
                  },
                  {
                    label: 'Alt Başlık (Subheading)',
                    text: 'Profesyonel İçerik Üretimi',
                    desc: 'Açıklayıcı alt metin katmanı',
                    data: { fontSize: 40, fontWeight: '600' as const },
                  },
                  {
                    label: 'Paragraf / Gövde (Body)',
                    text: 'Tarayıcıda %100 yerel ve güvenli video kurgu deneyimi.',
                    desc: 'Okunaklı gövde ve paragraf yazısı',
                    data: { fontSize: 26, fontWeight: 'normal' as const, lineHeight: 1.4 },
                  },
                  {
                    label: 'Vurgu / Callout',
                    text: 'DİKKAT! ÖNEMLİ DETAY 🔥',
                    desc: 'Renkli arkalık kutusuyla öne çıkan vurgu',
                    data: {
                      fontSize: 36,
                      fontWeight: '800' as const,
                      backgroundColor: 'rgba(99, 102, 241, 0.9)',
                      backgroundOpacity: 0.9,
                      paddingX: 20,
                      paddingY: 10,
                      borderRadius: 8,
                    },
                  },
                  {
                    label: 'Altyazı (Subtitle)',
                    text: 'Videonun altındaki okunaklı altyazı metni.',
                    desc: 'Siyah kontur ve yarı saydam zemin',
                    data: {
                      fontSize: 34,
                      fontWeight: 'bold' as const,
                      strokeColor: '#000000',
                      strokeWidth: 4,
                      backgroundColor: 'rgba(0,0,0,0.7)',
                      backgroundOpacity: 0.7,
                      paddingX: 18,
                      paddingY: 8,
                      borderRadius: 6,
                    },
                  },
                  {
                    label: 'Rozet / Etiket (Badge)',
                    text: 'YENİ SÜRÜM v2.0',
                    desc: 'Kompakt, yuvarlak köşeli etiket',
                    data: {
                      fontSize: 22,
                      fontWeight: '900' as const,
                      textTransform: 'uppercase' as const,
                      letterSpacing: 1.5,
                      backgroundColor: '#dc2626',
                      backgroundOpacity: 0.95,
                      paddingX: 16,
                      paddingY: 6,
                      borderRadius: 20,
                    },
                  },
                ].map((tmpl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      const targetTrackId = findTrack('text');
                      onAddTextClip(targetTrackId, tmpl.text, currentTime, 4, tmpl.data);
                    }}
                    className="w-full text-left p-2.5 rounded-lg bg-[#161b22] hover:bg-[#21262d] border border-[#30363d] hover:border-indigo-500/60 transition-all group"
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-semibold text-gray-200 group-hover:text-indigo-300">
                        {tmpl.label}
                      </span>
                      <span className="text-[10px] text-indigo-400 font-medium">+ Ekle</span>
                    </div>
                    <p className="text-[10px] text-gray-400 line-clamp-1">{tmpl.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* 10 1-Click Style Presets */}
            <div>
              <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                1-Tıkla Tasarım Stilleri (10 Hazır Stil)
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {TEXT_STYLE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      const targetTrackId = findTrack('text');
                      onAddTextClip(
                        targetTrackId,
                        preset.name,
                        currentTime,
                        4,
                        preset.data
                      );
                    }}
                    className="p-2 rounded-lg bg-[#161b22] hover:bg-[#21262d] border border-[#30363d] hover:border-indigo-500/60 transition-all text-left flex flex-col justify-between group"
                    title={preset.description}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/20"
                        style={{ backgroundColor: preset.previewBg }}
                      />
                      <span className="text-[11px] font-semibold text-gray-200 group-hover:text-indigo-300 truncate">
                        {preset.name}
                      </span>
                    </div>
                    <p className="text-[9px] text-gray-500 line-clamp-1">{preset.description}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 3. AUDIO TAB */}
        {activeTab === 'audio' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                Ses & Müzik Kütüphanesi
              </h4>
              <button
                onClick={() => onAddTrack('audio', 'Ek Ses Kanalı')}
                className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold"
              >
                + Kanal Ekle
              </button>
            </div>

            {/* SFX Category Selector */}
            <div className="flex items-center bg-[#161b22] p-0.5 rounded-lg border border-[#30363d] gap-1">
              <button
                onClick={() => setSfxCategory('all')}
                className={`flex-1 py-1 rounded text-[10px] font-medium transition-colors ${
                  sfxCategory === 'all'
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Tümü
              </button>
              <button
                onClick={() => setSfxCategory('sfx')}
                className={`flex-1 py-1 rounded text-[10px] font-medium transition-colors ${
                  sfxCategory === 'sfx'
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Efektler (SFX)
              </button>
              <button
                onClick={() => setSfxCategory('bgm')}
                className={`flex-1 py-1 rounded text-[10px] font-medium transition-colors ${
                  sfxCategory === 'bgm'
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Fon Müziği
              </button>
            </div>

            {/* Built-in SFX list */}
            <div className="space-y-2">
              {BUILTIN_SFX_LIST.filter(
                (s) => sfxCategory === 'all' || s.category === sfxCategory
              ).map((sfx) => (
                <div
                  key={sfx.id}
                  className="p-2.5 rounded-lg bg-[#161b22] border border-[#30363d] hover:border-indigo-500/50 transition-all flex items-center justify-between gap-2.5 group"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-lg shrink-0">{sfx.icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-gray-200 truncate group-hover:text-indigo-300">
                        {sfx.name}
                      </p>
                      <p className="text-[10px] text-gray-400 truncate">
                        {sfx.duration} sn • {sfx.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => playSfxPreview(sfx.id)}
                      className="p-1.5 rounded-md bg-[#0d1117] hover:bg-indigo-600/30 text-gray-300 hover:text-indigo-300 border border-[#30363d] transition-colors"
                      title="Sesi Dinle"
                    >
                      🔊
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          setAddingSfxId(sfx.id);
                          const blob = await generateSfxBlob(sfx.id);
                          const assetId = 'asset-sfx-' + sfx.id + '-' + Date.now();
                          await saveAssetBlob(assetId, blob);
                          const url = URL.createObjectURL(blob);
                          const targetTrackId = findTrack('audio');
                          onAddClip(targetTrackId, {
                            assetId,
                            sourceUrl: url,
                            name: sfx.name,
                            type: 'audio',
                            startTime: currentTime,
                            duration: sfx.duration,
                            sourceDuration: sfx.duration,
                            trimIn: 0,
                            trimOut: sfx.duration,
                            volume: 0.9,
                          });
                        } catch (err) {
                          console.warn('Failed to add SFX:', err);
                        } finally {
                          setAddingSfxId(null);
                        }
                      }}
                      disabled={addingSfxId === sfx.id}
                      className="px-2 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold transition-colors flex items-center gap-1 shadow-sm"
                      title="Zaman Çizelgesine Ekle"
                    >
                      {addingSfxId === sfx.id ? '...' : '+ Ekle'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. TRANSITIONS TAB */}
        {activeTab === 'transitions' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                Klip Geçiş Efektleri (13 Çeşit)
              </h4>
              <span className="text-[10px] text-indigo-400 font-mono">13 Geçiş</span>
            </div>
            <p className="text-[11px] text-gray-400">
              {selectedClipId
                ? 'Seçili klibe geçiş uygulamak için aşağıdaki efektlerden birine tıklayın.'
                : 'Bir klibe geçiş uygulamak için önce zaman çizelgesinden video veya görsel klibi seçin.'}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {TRANSITION_DEFINITIONS.map((tr) => (
                <button
                  key={tr.id}
                  type="button"
                  onClick={() => {
                    if (selectedClipId && onUpdateClip) {
                      onUpdateClip(selectedClipId, {
                        transitionIn: tr.id === 'cut' || tr.id === 'none' ? undefined : { type: tr.id, duration: 0.8 },
                      });
                    }
                  }}
                  className={`p-2 rounded-lg border text-left transition-all group ${
                    selectedClipId
                      ? 'bg-[#161b22] hover:bg-[#21262d] border-[#30363d] hover:border-indigo-500/60 cursor-pointer'
                      : 'bg-[#161b22]/70 border-[#30363d]/70 opacity-80 cursor-default'
                  }`}
                  title={tr.description}
                >
                  <div className="w-full h-8 rounded bg-[#0d1117] mb-1.5 flex items-center justify-center text-sm gap-1">
                    <span>{tr.icon}</span>
                    <span className="text-[10px] font-bold text-indigo-400 font-mono">
                      {tr.id.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-gray-200 group-hover:text-indigo-300 truncate">
                    {tr.name}
                  </p>
                  <p className="text-[10px] text-gray-400 truncate">{tr.description}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 5. FILTERS TAB */}
        {activeTab === 'filters' && (
          <div className="space-y-3">
            <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              Renk & Atmosfer Filtreleri ({COLOR_PRESETS.length})
            </h4>
            <p className="text-[11px] text-gray-400">
              {selectedClipId
                ? 'Seçili klibe filtre uygulamak için şablonlardan birine tıklayın.'
                : 'Zaman çizelgesinden bir video veya görsel seçerek tek tıkla filtre uygulayın.'}
            </p>
            <div className="grid grid-cols-1 gap-2">
              {COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => {
                    if (selectedClipId && onUpdateClipEffects) {
                      onUpdateClipEffects(selectedClipId, preset.effects);
                    }
                  }}
                  className={`w-full p-2.5 rounded-lg bg-[#161b22] border transition-all text-left group flex items-start gap-3 ${
                    selectedClipId
                      ? 'hover:border-indigo-500 hover:bg-[#21262d] cursor-pointer'
                      : 'border-[#30363d] opacity-80 cursor-default'
                  }`}
                >
                  <span
                    className="w-4 h-4 rounded-full shrink-0 mt-0.5 shadow-sm"
                    style={{ backgroundColor: preset.thumbnailColor }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-semibold text-gray-200 group-hover:text-indigo-300">
                        {preset.name}
                      </span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#0d1117] text-gray-400 uppercase font-mono">
                        {preset.category}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-400 leading-tight">
                      {preset.description}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 6. SUBTITLES TAB */}
        {activeTab === 'subtitles' && (
          <div className="space-y-3">
            <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              Altyazı Yönetimi
            </h4>
            <p className="text-xs text-gray-400">
              Sosyal medya için dinamik Türkçe altyazılar oluşturun veya zaman çizelgesine altyazı blokları ekleyin.
            </p>
            <button
              onClick={() => {
                const trackId = findTrack('text');
                onAddTextClip(trackId, 'Yeni altyazı metni...', currentTime, 3);
              }}
              className="w-full py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
            >
              <span>+</span>
              <span>Mevcut Konuma Altyazı Ekle</span>
            </button>
          </div>
        )}

        {/* 7. SETTINGS TAB */}
        {activeTab === 'settings' && (
          <div className="space-y-4 text-xs">
            <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              Proje Ayarları
            </h4>

            <div>
              <label className="block text-gray-400 mb-1">Arka Plan Rengi</label>
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

            <div>
              <label className="block text-gray-400 mb-1">Toplam Proje Süresi (Saniye)</label>
              <input
                type="number"
                min="1"
                max="3600"
                value={project.duration}
                onChange={(e) => onSetDuration(Math.max(1, parseInt(e.target.value) || 10))}
                className="w-full px-2 py-1.5 rounded bg-[#161b22] border border-[#30363d] text-white outline-none focus:border-indigo-500"
              />
            </div>

            <div className="p-3 rounded-lg bg-[#161b22] border border-[#30363d] space-y-1 text-gray-400 text-[11px]">
              <p>Çözünürlük: {project.resolution.width} x {project.resolution.height}</p>
              <p>Kare Hızı: {project.fps} FPS</p>
              <p>Kanal Sayısı: {project.tracks.length}</p>
              <p>Toplam Klip: {project.tracks.reduce((acc, t) => acc + t.clips.length, 0)}</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
