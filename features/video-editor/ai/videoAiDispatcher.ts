import { VideoProject, VideoClip } from '../types';

export interface AiProposedAction {
  id: string;
  intent: string;
  description: string;
  changesSummary: string[];
  apply: (project: VideoProject) => VideoProject;
}

/**
 * Parses user input in Turkish and generates a proposed action for the user to review.
 */
export function parseVideoAiPrompt(prompt: string, currentProject: VideoProject): AiProposedAction | null {
  const cleaned = prompt.trim().toLowerCase();

  // 1. Aspect Ratio: 9:16 / Reels / Shorts / TikTok / Dikey
  if (
    cleaned.includes('9:16') ||
    cleaned.includes('dikey') ||
    cleaned.includes('reels') ||
    cleaned.includes('tiktok') ||
    cleaned.includes('shorts')
  ) {
    return {
      id: 'ai-aspect-9-16',
      intent: 'En-Boy Oranını 9:16 (Dikey) Yap',
      description: 'Proje çözünürlüğü mobil dikey video formatına (1080x1920) dönüştürülecek.',
      changesSummary: [
        `Genişlik: ${currentProject.resolution.width}px → 1080px`,
        `Yükseklik: ${currentProject.resolution.height}px → 1920px`,
        'En-Boy Oranı: 9:16 (TikTok, Reels, Shorts uyumlu)',
      ],
      apply: (p) => ({
        ...p,
        resolution: { width: 1080, height: 1920 },
      }),
    };
  }

  // 2. Aspect Ratio: 16:9 / Yatay / YouTube
  if (cleaned.includes('16:9') || cleaned.includes('yatay') || cleaned.includes('youtube')) {
    return {
      id: 'ai-aspect-16-9',
      intent: 'En-Boy Oranını 16:9 (Yatay) Yap',
      description: 'Proje çözünürlüğü standart geniş ekran formatına (1920x1080) dönüştürülecek.',
      changesSummary: [
        `Genişlik: ${currentProject.resolution.width}px → 1920px`,
        `Yükseklik: ${currentProject.resolution.height}px → 1080px`,
        'En-Boy Oranı: 16:9 (YouTube, Monitör uyumlu)',
      ],
      apply: (p) => ({
        ...p,
        resolution: { width: 1920, height: 1080 },
      }),
    };
  }

  // 3. Aspect Ratio: 1:1 / Kare / Instagram Gönderi
  if (cleaned.includes('1:1') || cleaned.includes('kare')) {
    return {
      id: 'ai-aspect-1-1',
      intent: 'En-Boy Oranını 1:1 (Kare) Yap',
      description: 'Proje çözünürlüğü kare formatına (1080x1080) dönüştürülecek.',
      changesSummary: [
        `Genişlik: ${currentProject.resolution.width}px → 1080px`,
        `Yükseklik: ${currentProject.resolution.height}px → 1080px`,
        'En-Boy Oranı: 1:1 (Instagram kare gönderi uyumlu)',
      ],
      apply: (p) => ({
        ...p,
        resolution: { width: 1080, height: 1080 },
      }),
    };
  }

  // 4. Trim beginning: "ilk X saniyesini kırp" / "baştan X saniye kes"
  const trimMatch = cleaned.match(/(?:ilk|baştan)\s*(\d+(?:[.,]\d+)?)\s*saniye/);
  if (trimMatch || (cleaned.includes('kırp') && cleaned.includes('saniye'))) {
    const sec = trimMatch ? parseFloat(trimMatch[1].replace(',', '.')) : 3;

    return {
      id: 'ai-trim-start',
      intent: `Videonun İlk ${sec} Saniyesini Kırp`,
      description: `Timeline'daki ilk video klibinin başından ${sec} saniye kesilerek süre kısaltılacak.`,
      changesSummary: [
        `Kırpılacak süre: ${sec} saniye`,
        'Başlangıç karesi ileri taşınacak',
        'Zaman çizelgesi otomatik güncellenecek',
      ],
      apply: (p) => {
        let trimmed = false;
        const newTracks = p.tracks.map((t) => {
          if (t.type !== 'video' || trimmed) return t;
          const newClips = t.clips.map((c, idx) => {
            if (idx === 0 && !trimmed && c.duration > sec) {
              trimmed = true;
              return {
                ...c,
                trimIn: c.trimIn + sec,
                duration: c.duration - sec,
              };
            }
            return c;
          });
          return { ...t, clips: newClips };
        });
        return { ...p, tracks: newTracks };
      },
    };
  }

  // 5. Volume Mute: "sesi kapat", "sessize al"
  if (cleaned.includes('sesi kapat') || cleaned.includes('sessiz') || cleaned.includes('mute')) {
    return {
      id: 'ai-mute-all',
      intent: 'Tüm Klipleri Sessize Al',
      description: 'Zaman çizelgesindeki tüm video ve ses kliplerinin sesi kapatılacak.',
      changesSummary: [
        'Tüm ses kanalları ve klipler: Mute (Sessiz)',
        'Oynatma sessiz devam edecek',
      ],
      apply: (p) => ({
        ...p,
        tracks: p.tracks.map((t) => ({
          ...t,
          muted: true,
          clips: t.clips.map((c) => ({ ...c, muted: true })),
        })),
      }),
    };
  }

  // 6. Volume Adjust: "sesi %X yap" or "sesi yarıya indir"
  const volMatch = cleaned.match(/sesi?\s*(?:%|yüzde)?\s*(\d+)/);
  if (volMatch || cleaned.includes('yarıya')) {
    const targetVol = volMatch ? Math.max(0, Math.min(100, parseInt(volMatch[1], 10))) / 100 : 0.5;
    const percentStr = Math.round(targetVol * 100);

    return {
      id: 'ai-set-volume',
      intent: `Ses Seviyesini %${percentStr} Yap`,
      description: `Tüm ses ve video kliplerinin ses şiddeti %${percentStr} seviyesine ayarlanacak.`,
      changesSummary: [
        `Yeni ses düzeyi: %${percentStr}`,
        'Sessiz kliplerin sesi tekrar açılacak',
      ],
      apply: (p) => ({
        ...p,
        tracks: p.tracks.map((t) => ({
          ...t,
          muted: false,
          clips: t.clips.map((c) => ({ ...c, muted: false, volume: targetVol })),
        })),
      }),
    };
  }

  // 7. Speed: "hızı 2 katına çıkar", "hızlandır 2x", "ağır çekim", "hızı yarıya düşür"
  if (cleaned.includes('hızlandır') || cleaned.includes('2x') || cleaned.includes('2 kat')) {
    return {
      id: 'ai-speed-2x',
      intent: 'Video Hızını 2 Katına Çıkar (2x)',
      description: 'Video kliplerinin oynatma hızı 2x yapılarak süreleri yarıya indirilecek.',
      changesSummary: [
        'Oynatma hızı: 1.0x → 2.0x',
        'Klip süresi yarıya düşürülecek',
      ],
      apply: (p) => ({
        ...p,
        tracks: p.tracks.map((t) => ({
          ...t,
          clips: t.clips.map((c) =>
            c.type === 'video'
              ? { ...c, speed: 2.0, duration: Math.max(0.5, c.duration / 2) }
              : c
          ),
        })),
      }),
    };
  }

  if (cleaned.includes('ağır çekim') || cleaned.includes('slow motion') || cleaned.includes('yavaşlat')) {
    return {
      id: 'ai-speed-slowmo',
      intent: 'Ağır Çekim Uygula (0.5x)',
      description: 'Video kliplerinin oynatma hızı 0.5x yapılarak süreleri 2 katına çıkarılacak.',
      changesSummary: [
        'Oynatma hızı: 1.0x → 0.5x',
        'Klip süresi 2 katına uzatılacak',
      ],
      apply: (p) => ({
        ...p,
        tracks: p.tracks.map((t) => ({
          ...t,
          clips: t.clips.map((c) =>
            c.type === 'video'
              ? { ...c, speed: 0.5, duration: c.duration * 2 }
              : c
          ),
        })),
      }),
    };
  }

  // 8. Filter: Siyah-Beyaz / Grayscale
  if (cleaned.includes('siyah') || cleaned.includes('beyaz') || cleaned.includes('grayscale') || cleaned.includes('monochrome')) {
    return {
      id: 'ai-filter-bw',
      intent: 'Siyah-Beyaz (Monokrom) Filtresi Uygula',
      description: 'Kliplere yüksek kontrastlı profesyonel siyah-beyaz renk profili uygulanacak.',
      changesSummary: [
        'Doygunluk: 0% (Siyah-Beyaz)',
        'Kontrast: +15%',
      ],
      apply: (p) => ({
        ...p,
        tracks: p.tracks.map((t) => ({
          ...t,
          clips: t.clips.map((c) =>
            c.type === 'video' || c.type === 'image'
              ? {
                  ...c,
                  effects: {
                    ...c.effects,
                    saturation: 0,
                    contrast: 1.15,
                    grayscale: 1,
                  },
                }
              : c
          ),
        })),
      }),
    };
  }

  // 9. Filter: Sinematik / Sıcak Ton
  if (cleaned.includes('sinematik') || cleaned.includes('sıcak ton') || cleaned.includes('cinematic')) {
    return {
      id: 'ai-filter-cinematic',
      intent: 'Sinematik Sıcak Renk Filtresi Uygula',
      description: 'Kliplere sinematik kontrast, hafif sıcaklık ve vinyet gölgelemesi eklenecek.',
      changesSummary: [
        'Renk Sıcaklığı: +20 (Sıcak film tonu)',
        'Kontrast: +10%',
        'Vinyet: +25% köşe karartması',
      ],
      apply: (p) => ({
        ...p,
        tracks: p.tracks.map((t) => ({
          ...t,
          clips: t.clips.map((c) =>
            c.type === 'video' || c.type === 'image'
              ? {
                  ...c,
                  effects: {
                    ...c.effects,
                    temperature: 20,
                    contrast: 1.1,
                    vignette: 0.25,
                  },
                }
              : c
          ),
        })),
      }),
    };
  }

  // 10. Title / Text Add: "başlık ekle [metin]" or "yazı ekle [metin]"
  const titleMatch = prompt.match(/(?:başlık|yazı|metin)\s*(?:ekle|yaz)?\s*[:"-]?\s*(.+)/i);
  if (titleMatch && titleMatch[1]) {
    const rawText = titleMatch[1].replace(/["']/g, '').trim();
    if (rawText.length > 0) {
      return {
        id: 'ai-add-title',
        intent: `Başlık Ekle: "${rawText.substring(0, 25)}"`,
        description: `Zaman çizelgesinin başına stilize edilmiş başlık katmanı eklenecek.`,
        changesSummary: [
          `Metin: "${rawText}"`,
          'Font: Plus Jakarta Sans Bold, 64px, Beyaz',
          'Süre: 4 saniye, Yumuşak Giriş/Çıkış',
        ],
        apply: (p) => {
          let textTrack = p.tracks.find((t) => t.type === 'text');
          const newClip: VideoClip = {
            id: 'clip-text-' + Math.random().toString(36).substring(2, 9),
            trackId: textTrack ? textTrack.id : 'track-text-gen',
            type: 'text',
            name: `Başlık: ${rawText.substring(0, 15)}`,
            startTime: 0,
            duration: 4,
            trimIn: 0,
            trimOut: 4,
            sourceDuration: 4,
            textData: {
              text: rawText,
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontSize: 64,
              fontWeight: 'bold',
              fillColor: '#FFFFFF',
              textAlign: 'center',
              boxPadding: 20,
              boxRadius: 10,
              boxColor: 'rgba(0, 0, 0, 0.45)',
              shadow: {
                color: 'rgba(0,0,0,0.85)',
                blur: 12,
                offsetX: 2,
                offsetY: 4,
              },
              animation: {
                type: 'fade',
                duration: 0.6,
              },
            },
            transform: {
              x: 0,
              y: 0,
              scaleX: 1,
              scaleY: 1,
              rotation: 0,
              opacity: 1,
            },
          };

          if (textTrack) {
            return {
              ...p,
              tracks: p.tracks.map((t) =>
                t.id === textTrack!.id ? { ...t, clips: [...t.clips, newClip] } : t
              ),
            };
          } else {
            return {
              ...p,
              tracks: [
                {
                  id: 'track-text-gen',
                  name: 'Metin & Başlıklar',
                  type: 'text',
                  clips: [newClip],
                  muted: false,
                  locked: false,
                  visible: true,
                },
                ...p.tracks,
              ],
            };
          }
        },
      };
    }
  }

  // 11. Clean gaps / Sessizlikleri temizle
  if (cleaned.includes('boşluk') || cleaned.includes('sessizlik') || cleaned.includes('araları birleştir')) {
    return {
      id: 'ai-close-gaps',
      intent: 'Klipler Arasındaki Boşlukları Kapat',
      description: 'Zaman çizelgesindeki tüm video klipleri peş peşe dizilerek boşluklar kaldırılacak.',
      changesSummary: [
        'Klipler sıfırdan başlayarak peş peşe birleştirilecek',
        'Zaman kayıpları ve boşluklar giderilecek',
      ],
      apply: (p) => ({
        ...p,
        tracks: p.tracks.map((t) => {
          let curTime = 0;
          const sortedClips = [...t.clips].sort((a, b) => a.startTime - b.startTime);
          const packedClips = sortedClips.map((c) => {
            const updated = { ...c, startTime: curTime };
            curTime += c.duration;
            return updated;
          });
          return { ...t, clips: packedClips };
        }),
      }),
    };
  }

  // Generic fallback if not matched
  return null;
}
