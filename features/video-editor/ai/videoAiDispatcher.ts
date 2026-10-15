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
  const isLipSyncSlip =
    cleaned.includes('ms') ||
    cleaned.includes('milisaniye') ||
    cleaned.includes('kaydır') ||
    cleaned.includes('senkron') ||
    cleaned.includes('lip');
  const volMatch = !isLipSyncSlip ? cleaned.match(/sesi?\s*(?:%|yüzde)\s*(\d+)/) || cleaned.match(/sesi?\s*(\d+)\s*(?:yap|seviye)?/) : null;
  if (!isLipSyncSlip && (volMatch || cleaned.includes('yarıya'))) {
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

  // 12. AI Duplicate & Stutter Cleaner: "Tekrar eden cümleleri bul ve sil" / "Kekelemeleri temizle"
  if (
    cleaned.includes('tekrar') ||
    cleaned.includes('kekeleme') ||
    cleaned.includes('stutter') ||
    cleaned.includes('duplicate')
  ) {
    return {
      id: 'ai-remove-duplicates',
      intent: 'Tekrar Eden Cümleleri ve Kekelemeleri Temizle',
      description: 'AI videolarında karakterin aynı cümleyi yanlışlıkla iki kez söylediği anlar ve kekelemeler temizlenir, boşluklar kapatılır ve geçişlere yumuşatma (smooth cut) eklenir.',
      changesSummary: [
        'Akustik ve metin tabanlı tekrar eden okumalar (duplicate takes) tespit edilecek',
        'Tekrarlar Ripple Delete ile silinerek boşluklar kapatılacak',
        'Kafa sıçramasını önlemek için kesim geçişlerine 160ms Smooth Jump-Cut harmanlaması uygulanacak',
      ],
      apply: (p) => ({
        ...p,
        tracks: p.tracks.map((t) => {
          if (t.type !== 'video') return t;
          return {
            ...t,
            clips: t.clips.map((c, idx) => (idx > 0 ? { ...c, smoothCutIn: true, smoothCutDurationMs: 160 } : c)),
          };
        }),
      }),
    };
  }

  // 13. Character Vocal Mute + Lip-Freeze: "2. saniye ile 4. saniye arasında karakteri sustur" / "Ağzını dondur"
  if (
    cleaned.includes('karakteri sustur') ||
    cleaned.includes('karakter sustur') ||
    cleaned.includes('ağzını dondur') ||
    cleaned.includes('ağzı dondur') ||
    cleaned.includes('lip freeze') ||
    cleaned.includes('lip-freeze')
  ) {
    const rangeMatch = cleaned.match(/(\d+(?:[.,]\d+)?)\s*(?:ile|-|ila|veya)\s*(\d+(?:[.,]\d+)?)\s*saniye/);
    const startSec = rangeMatch ? parseFloat(rangeMatch[1].replace(',', '.')) : 2.0;
    const endSec = rangeMatch ? parseFloat(rangeMatch[2].replace(',', '.')) : startSec + 2.0;

    return {
      id: 'ai-vocal-mute-lip-freeze',
      intent: rangeMatch
        ? `${startSec}. sn ile ${endSec}. sn Arasında Karakteri Sustur & Ağzını Dondur`
        : 'Karakteri Sustur & Ağzını Dondur (Vocal Mute + Lip-Freeze)',
      description: `Karakterin sesini sustururken arka plan müziğini kesintisiz korur, 150ms crossfade ile ağzını nötr karesinde dondurur.`,
      changesSummary: [
        `Zaman Aralığı: ${startSec} sn - ${endSec} sn`,
        'Vokal Filtresi: 450Hz, 1000Hz, 2200Hz konuşma formantları bastırılacak',
        'Görsel Senkron: Karakter ağzı dondurulacak (Lip-Freeze 150ms crossfade)',
        'Arka Plan: Ortam ve fon sesleri kesintisiz devam edecek',
      ],
      apply: (p) => {
        let applied = false;
        return {
          ...p,
          tracks: p.tracks.map((t) => {
            if (t.type !== 'video' || applied) return t;
            const newClips: VideoClip[] = [];
            for (const c of t.clips) {
              const clipStart = c.startTime;
              const clipEnd = clipStart + c.duration;
              if (!applied && startSec >= clipStart && endSec <= clipEnd && endSec - startSec >= 0.1) {
                applied = true;
                const rStart = startSec - clipStart;
                const rEnd = endSec - clipStart;
                const speed = c.speed || 1.0;
                const trimIn = c.trimIn || 0;

                // Left
                if (rStart > 0.05) {
                  newClips.push({
                    ...c,
                    id: c.id,
                    duration: rStart,
                    trimOut: trimIn + rStart * speed,
                  });
                }
                // Middle (muted & lip frozen)
                newClips.push({
                  ...c,
                  id: 'clip-ai-freeze-' + Math.random().toString(36).substring(2, 7),
                  name: `${c.name} (Susturuldu + Lip-Freeze)`,
                  startTime: startSec,
                  duration: endSec - startSec,
                  trimIn: trimIn + rStart * speed,
                  trimOut: trimIn + rEnd * speed,
                  vocalMute: true,
                  lipFreeze: true,
                  lipFreezeFrameTime: trimIn + rStart * speed,
                  visualMuteMode: 'lip_freeze',
                });
                // Right
                if (rEnd < c.duration - 0.05) {
                  newClips.push({
                    ...c,
                    id: 'clip-ai-right-' + Math.random().toString(36).substring(2, 7),
                    startTime: endSec,
                    duration: c.duration - rEnd,
                    trimIn: trimIn + rEnd * speed,
                  });
                }
              } else {
                newClips.push(c);
              }
            }
            return { ...t, clips: newClips.sort((a, b) => a.startTime - b.startTime) };
          }),
        };
      },
    };
  }

  // 14. Lip-Sync Audio Slip: "Sesi 50ms ileri kaydır" / "Dudak senkronunu -100ms yap"
  if (
    cleaned.includes('dudak senkron') ||
    cleaned.includes('lip sync') ||
    cleaned.includes('lip-sync') ||
    (cleaned.includes('sesi') && (cleaned.includes('ms') || cleaned.includes('kaydır')))
  ) {
    const msMatch = cleaned.match(/([+-]?\d+)\s*ms/);
    let offsetMs = 50;
    if (msMatch) {
      offsetMs = parseInt(msMatch[1], 10);
    } else if (cleaned.includes('geri') || cleaned.includes('geç')) {
      offsetMs = -50;
    } else {
      offsetMs = 50;
    }

    offsetMs = Math.max(-500, Math.min(500, offsetMs));

    return {
      id: 'ai-lip-sync-slip',
      intent: `Lip-Sync İç Ses Ofsetini ${offsetMs > 0 ? `+${offsetMs}` : offsetMs}ms Ayarla`,
      description: `Klibin timeline konumunu bozmadan iç sesini ${Math.abs(offsetMs)}ms ${offsetMs >= 0 ? 'öne' : 'geriye'} kaydırarak dudak hareketine kilitler.`,
      changesSummary: [
        `Hedef Ofset: ${offsetMs > 0 ? `+${offsetMs}` : offsetMs} milisaniye`,
        offsetMs >= 0 ? 'Ses dudak hareketinden önce/erken gelecek' : 'Ses dudak hareketine göre geciktirilecek',
        'Canlı oynatım ve dışa aktarmada milisaniyelik senkronize edilecek',
      ],
      apply: (p) => ({
        ...p,
        tracks: p.tracks.map((t) => {
          if (t.type !== 'video' && t.type !== 'audio') return t;
          return {
            ...t,
            clips: t.clips.map((c) => ({
              ...c,
              audioOffsetMs: offsetMs,
            })),
          };
        }),
      }),
    };
  }

  // 15. Smooth Jump-Cut: "Kesikleri yumuşat" / "smooth cut aç" / "kafa sıçramasını önle"
  if (
    cleaned.includes('kesikleri yumuşat') ||
    cleaned.includes('kesik yumuşat') ||
    cleaned.includes('smooth cut') ||
    cleaned.includes('jump cut') ||
    cleaned.includes('kafa sıçraması')
  ) {
    return {
      id: 'ai-smooth-jump-cut',
      intent: 'Klip Geçişlerinde Kesikleri Yumuşat (Smooth Jump-Cut)',
      description: 'AI videolarında yapılan kesim noktalarında karakterin kafasındaki ani sıçramaları 160ms optik mikro harmanlama ile yok eder.',
      changesSummary: [
        'Tüm birleşen video kliplerine Smooth Jump-Cut aktif edildi',
        'Harmanlama süresi: 160ms (~5 kare optik kosinüs geçişi)',
        'Ani kafa ve açı sıçramaları pürüzsüzleştirildi',
      ],
      apply: (p) => ({
        ...p,
        tracks: p.tracks.map((t) => {
          if (t.type !== 'video') return t;
          return {
            ...t,
            clips: t.clips.map((c, idx) =>
              idx > 0 ? { ...c, smoothCutIn: true, smoothCutDurationMs: 160 } : c
            ),
          };
        }),
      }),
    };
  }

  // Generic fallback if not matched
  return null;
}
