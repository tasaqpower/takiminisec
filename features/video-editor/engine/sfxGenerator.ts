/**
 * FORMA Video Editor — Built-in SFX & Audio Synthesizer
 * 100% Client-side procedural sound effect and background music generator
 * Produces standard WAV blobs with zero external downloads or copyright restrictions
 */

export type SfxType =
  | 'censor-bleep'
  | 'whoosh'
  | 'whoosh-heavy'
  | 'whoosh-reverse'
  | 'whoosh-whip'
  | 'whoosh-cinematic'
  | 'whoosh-digital'
  | 'whoosh-fire'
  | 'whoosh-sword'
  | 'whoosh-fast'
  | 'whoosh-deep'
  | 'bass-drop'
  | 'cinematic-boom'
  | 'metal-hit'
  | 'riser-tension'
  | 'riser-white-noise'
  | 'heartbeat-thump'
  | 'thunder-crack'
  | 'gong-strike'
  | '808-sub'
  | 'cinematic-sub'
  | 'pop'
  | 'bubble-double'
  | 'ding'
  | 'apple-chime'
  | 'error-buzz'
  | 'sparkle-magic'
  | 'unlock-click'
  | 'pop-cork'
  | 'coin-pickup'
  | 'level-up'
  | 'typewriter'
  | 'keyboard-mechanical'
  | 'mouse-click'
  | 'shutter'
  | 'shutter-motor'
  | 'paper-slide'
  | 'paper-tear'
  | 'tape-rewind'
  | 'record-scratch'
  | 'switch-toggle'
  | 'clock-tick'
  | 'air-horn'
  | 'sad-trombone'
  | 'record-stop'
  | 'cash-register'
  | 'punch-slap'
  | 'dramatic-dun'
  | 'laser-zap'
  | 'glitch-static'
  | 'radio-tuning'
  | 'funny-quack'
  | 'lofi-chord'
  | 'cinematic-drone'
  | 'cyber-synth-pulse'
  | 'ambient-rain'
  | 'vinyl-crackle'
  | 'crowd-cheer';

export type SfxCategory = 'sfx' | 'bgm' | 'whoosh' | 'impact' | 'ui' | 'mechanical' | 'meme';

export interface BuiltinSfxItem {
  id: SfxType;
  name: string;
  category: SfxCategory;
  subcategory?: string;
  icon: string;
  duration: number;
  description: string;
}

export const BUILTIN_SFX_LIST: BuiltinSfxItem[] = [
  // ==========================================
  // 1. GEÇİŞ & WHOOSH (10 Parça)
  // ==========================================
  {
    id: 'whoosh',
    name: 'Hızlı Geçiş (Woosh)',
    category: 'whoosh',
    subcategory: 'Geçiş',
    icon: '💨',
    duration: 0.45,
    description: 'Klip ve sahne geçişleri için dinamik hava süpürme sesi',
  },
  {
    id: 'whoosh-heavy',
    name: 'Ağır Sinematik Whoosh',
    category: 'whoosh',
    subcategory: 'Geçiş',
    icon: '🌪️',
    duration: 0.65,
    description: 'Büyük başlıklar ve dramatik geçişler için baslı süpürme',
  },
  {
    id: 'whoosh-reverse',
    name: 'Ters Emiş Whoosh (Reverse)',
    category: 'whoosh',
    subcategory: 'Geçiş',
    icon: '⏪',
    duration: 0.8,
    description: 'Vurgu öncesi gerilim yükselten ters hava emiş sesi',
  },
  {
    id: 'whoosh-whip',
    name: 'Whip Pan Hızlı Kırbaç',
    category: 'whoosh',
    subcategory: 'Geçiş',
    icon: '⚡',
    duration: 0.22,
    description: 'Ani kamera çevirme ve hızlı sahne atlamaları için kırbaç rüzgarı',
  },
  {
    id: 'whoosh-cinematic',
    name: 'Fragman Derin Whoosh',
    category: 'whoosh',
    subcategory: 'Geçiş',
    icon: '🎬',
    duration: 1.1,
    description: 'Hollywood fragmanları tarzında geniş stereo hava akımı',
  },
  {
    id: 'whoosh-digital',
    name: 'Siber Glitch Whoosh',
    category: 'whoosh',
    subcategory: 'Geçiş',
    icon: '🤖',
    duration: 0.35,
    description: 'Dijital bozulmalar ve teknolojik arayüz geçişleri',
  },
  {
    id: 'whoosh-fire',
    name: 'Alev Püskürtme Whoosh',
    category: 'whoosh',
    subcategory: 'Geçiş',
    icon: '🔥',
    duration: 0.55,
    description: 'Aksiyon dolu sahneler için alev rüzgarı süpürmesi',
  },
  {
    id: 'whoosh-sword',
    name: 'Kılıç Savurma Sesi',
    category: 'whoosh',
    subcategory: 'Geçiş',
    icon: '⚔️',
    duration: 0.3,
    description: 'Hızlı çelik savrulması ve metalik hava yarılması',
  },
  {
    id: 'whoosh-fast',
    name: 'Mikro Swipe Whoosh',
    category: 'whoosh',
    subcategory: 'Geçiş',
    icon: '📱',
    duration: 0.18,
    description: 'TikTok kaydırma ve küçük ikon hareketleri için ultra hızlı geçiş',
  },
  {
    id: 'whoosh-deep',
    name: 'Sub Bas Whoosh',
    category: 'whoosh',
    subcategory: 'Geçiş',
    icon: '🔈',
    duration: 0.75,
    description: 'Düşük frekanslı titreşimli hava hareketi',
  },

  // ==========================================
  // 2. VURUŞ, BAS & YÜKSELİŞ (10 Parça)
  // ==========================================
  {
    id: 'bass-drop',
    name: 'Sinematik Vuruş (Bass Impact)',
    category: 'impact',
    subcategory: 'Vuruş',
    icon: '💥',
    duration: 2.2,
    description: 'Dramatik sahne girişleri için derin bas darbesi ve yankı',
  },
  {
    id: 'cinematic-boom',
    name: 'Hollywood Sinema Boom',
    category: 'impact',
    subcategory: 'Vuruş',
    icon: '💣',
    duration: 2.5,
    description: 'Dev patlama ve derin sinematik yankı darbesi',
  },
  {
    id: '808-sub',
    name: '808 Trap Sub Bas',
    category: 'impact',
    subcategory: 'Vuruş',
    icon: '🎧',
    duration: 1.5,
    description: 'Modern beat ve Reels kurguları için tok 808 bas vuruşu',
  },
  {
    id: 'metal-hit',
    name: 'Ağır Metalik Çekiç (Anvil)',
    category: 'impact',
    subcategory: 'Vuruş',
    icon: '🔨',
    duration: 1.2,
    description: 'Ağır örs ve çelik çarpma vuruşu',
  },
  {
    id: 'riser-tension',
    name: 'Gerilim Yükselişi (Tension Riser)',
    category: 'impact',
    subcategory: 'Yükseliş',
    icon: '📈',
    duration: 2.8,
    description: 'Doruk noktasına doğru yükselen gerilim tonu',
  },
  {
    id: 'riser-white-noise',
    name: 'Beyaz Gürültü Süpürme (Noise Sweep)',
    category: 'impact',
    subcategory: 'Yükseliş',
    icon: '🌊',
    duration: 2.2,
    description: 'EDM ve dans video geçişleri için filtreli gürültü yükselişi',
  },
  {
    id: 'heartbeat-thump',
    name: 'Dramatik Kalp Atışı (Heartbeat)',
    category: 'impact',
    subcategory: 'Vuruş',
    icon: '💓',
    duration: 0.9,
    description: 'Korku, heyecan ve odak anları için tok göğüs vuruşu',
  },
  {
    id: 'thunder-crack',
    name: 'Şimşek & Gök Gürültüsü',
    category: 'impact',
    subcategory: 'Vuruş',
    icon: '⚡',
    duration: 2.4,
    description: 'Dramatik gök gürültüsü ve uzak yankılanma',
  },
  {
    id: 'gong-strike',
    name: 'Tibet Gongu & Çan',
    category: 'impact',
    subcategory: 'Vuruş',
    icon: '🔔',
    duration: 3.2,
    description: 'Farkındalık ve bölüm sonları için rezonanslı bronz gong',
  },
  {
    id: 'cinematic-sub',
    name: 'Sub-Woofer Titreşimi',
    category: 'impact',
    subcategory: 'Vuruş',
    icon: '🔊',
    duration: 1.8,
    description: 'Sinema salonu kalitesinde 40 Hz derin bas dalgası',
  },

  // ==========================================
  // 3. SOSYAL, BİLDİRİM & POP (10 Parça)
  // ==========================================
  {
    id: 'pop',
    name: 'Baloncuk / Bildirim (Pop)',
    category: 'ui',
    subcategory: 'Bildirim',
    icon: '🫧',
    duration: 0.16,
    description: 'Yazı ve ikon animasyonları için tatlı bildirim sesi',
  },
  {
    id: 'bubble-double',
    name: 'Çift Su Damlası Pop',
    category: 'ui',
    subcategory: 'Bildirim',
    icon: '💧',
    duration: 0.28,
    description: 'Ardı ardına gelen iki ferahlatıcı su damlası',
  },
  {
    id: 'ding',
    name: 'Başarı / Tamam (Chime)',
    category: 'ui',
    subcategory: 'Bildirim',
    icon: '✨',
    duration: 1.2,
    description: 'Önemli vurgular ve tamamlanma anları için parlak kristal zil',
  },
  {
    id: 'apple-chime',
    name: 'Modern Cihaz Bildirimi (Tri-Tone)',
    category: 'ui',
    subcategory: 'Bildirim',
    icon: '🔔',
    duration: 0.75,
    description: 'Klasik akıllı telefon mesaj ve bildirim üçlemesi',
  },
  {
    id: 'sparkle-magic',
    name: 'Sihirli Işıltı (Sparkle Wand)',
    category: 'ui',
    subcategory: 'Bildirim',
    icon: '🪄',
    duration: 1.4,
    description: 'Peri masalı, parıltı ve güzellik efektleri için şıkırtı',
  },
  {
    id: 'unlock-click',
    name: 'Ekran Kilidi Açılma (Unlock)',
    category: 'ui',
    subcategory: 'Bildirim',
    icon: '🔓',
    duration: 0.09,
    description: 'Telefon ekranı açılma kilit mekanik tıkı',
  },
  {
    id: 'pop-cork',
    name: 'Mantar Patlatma (Cork Pop)',
    category: 'ui',
    subcategory: 'Bildirim',
    icon: '🍾',
    duration: 0.25,
    description: 'Şampanya mantarı patlaması ve sevinç anları',
  },
  {
    id: 'coin-pickup',
    name: 'Retro Altın Alma (8-bit Coin)',
    category: 'ui',
    subcategory: 'Bildirim',
    icon: '🪙',
    duration: 0.38,
    description: 'Klasik atari oyunu altın toplama melodisi',
  },
  {
    id: 'level-up',
    name: 'Seviye Atlama (Level Up)',
    category: 'ui',
    subcategory: 'Bildirim',
    icon: '⭐',
    duration: 0.75,
    description: 'Başarı ve oyun zaferi için 8-bit yükseliş melodisi',
  },
  {
    id: 'error-buzz',
    name: 'Hata / Yanlış Uyarısı (Buzzer)',
    category: 'ui',
    subcategory: 'Bildirim',
    icon: '❌',
    duration: 0.4,
    description: 'Yanlış cevaplar ve komik hatalar için alçak testere uyarısı',
  },

  // ==========================================
  // 4. MEKANİK, KAĞIT & OFİS (11 Parça)
  // ==========================================
  {
    id: 'typewriter',
    name: 'Daktilo Tuşu (Click)',
    category: 'mechanical',
    subcategory: 'Mekanik',
    icon: '⌨️',
    duration: 0.08,
    description: 'Metin belirme ve başlık animasyonları için mekanik tıkırtı',
  },
  {
    id: 'keyboard-mechanical',
    name: 'Mekanik Klavye Clack (Blue Switch)',
    category: 'mechanical',
    subcategory: 'Mekanik',
    icon: '🖥️',
    duration: 0.07,
    description: 'ASMR tarzı net dokunsal bilgisayar klavye tuşu',
  },
  {
    id: 'mouse-click',
    name: 'Fare Tıklaması (Mouse Click)',
    category: 'mechanical',
    subcategory: 'Mekanik',
    icon: '🖱️',
    duration: 0.06,
    description: 'Öğretici ve ekran kayıtları için mikroswitch fare tıkı',
  },
  {
    id: 'shutter',
    name: 'Kamera Deklanşör',
    category: 'mechanical',
    subcategory: 'Mekanik',
    icon: '📷',
    duration: 0.28,
    description: 'Fotoğraf çekimi ve donma anları için mekanik deklanşör',
  },
  {
    id: 'shutter-motor',
    name: 'Seri Çekim Deklanşör (Burst)',
    category: 'mechanical',
    subcategory: 'Mekanik',
    icon: '📸',
    duration: 0.45,
    description: 'Paparazzi ve spor fotoğrafları için motorlu hızlı çekim',
  },
  {
    id: 'paper-slide',
    name: 'Kağıt Kayması (Paper Slide)',
    category: 'mechanical',
    subcategory: 'Mekanik',
    icon: '📄',
    duration: 0.32,
    description: 'Belge sunumu ve kart geçişleri için yumuşak kağıt sesi',
  },
  {
    id: 'paper-tear',
    name: 'Kağıt Yırtılması (Paper Tear)',
    category: 'mechanical',
    subcategory: 'Mekanik',
    icon: '📜',
    duration: 0.4,
    description: 'Doküman yırtma ve sert geçişler için organik hışırtı',
  },
  {
    id: 'tape-rewind',
    name: 'Kaset Hızlı Sarma (Rewind)',
    category: 'mechanical',
    subcategory: 'Mekanik',
    icon: '📼',
    duration: 0.6,
    description: 'Geçmişe dönüş ve zaman atlamaları için kaset sarma vızıltısı',
  },
  {
    id: 'record-scratch',
    name: 'Plak Çizilme / Durdurma (Scratch)',
    category: 'mechanical',
    subcategory: 'Mekanik',
    icon: '💽',
    duration: 0.48,
    description: 'DJ turntable vinil plak çizilme sesi',
  },
  {
    id: 'switch-toggle',
    name: 'Elektrik Anahtarı (Toggle)',
    category: 'mechanical',
    subcategory: 'Mekanik',
    icon: '🔘',
    duration: 0.12,
    description: 'Ağır şalter ve lamba açıp kapama mandalı',
  },
  {
    id: 'clock-tick',
    name: 'Antika Saat Tik-Tak (Tick)',
    category: 'mechanical',
    subcategory: 'Mekanik',
    icon: '🕰️',
    duration: 0.15,
    description: 'Zaman akışı ve bekleme anları için ahşap saat vuruşu',
  },

  // ==========================================
  // 5. VİRAL SOSYAL & MEME (11 Parça)
  // ==========================================
  {
    id: 'censor-bleep',
    name: 'Sansür Bip Sesi (1000Hz Bleep)',
    category: 'meme',
    subcategory: 'Viral',
    icon: '🛑',
    duration: 1.5,
    description: 'Konuşma ve küfür sansürleme için klasik 1000 Hz TV test/sansür tonu',
  },
  {
    id: 'air-horn',
    name: 'Meme Havalı Korna (Air Horn)',
    category: 'meme',
    subcategory: 'Viral',
    icon: '📢',
    duration: 0.9,
    description: 'Trap ve montaj videolarının vazgeçilmez hip-hop kornası',
  },
  {
    id: 'sad-trombone',
    name: 'Hüzünlü Trombon (Womp Womp)',
    category: 'meme',
    subcategory: 'Viral',
    icon: '🎺',
    duration: 2.2,
    description: 'Hayal kırıklığı ve komik başarısızlıklar için womp-womp trombon',
  },
  {
    id: 'record-stop',
    name: 'Vinil Fren Durması (Freeze Frame)',
    category: 'meme',
    subcategory: 'Viral',
    icon: '🛑',
    duration: 0.65,
    description: '"Buraya nasıl geldiğimi merak ediyorsunuzdur" donma anı efekti',
  },
  {
    id: 'cash-register',
    name: 'Kasa Açılma Ka-Ching (Money)',
    category: 'meme',
    subcategory: 'Viral',
    icon: '💰',
    duration: 0.75,
    description: 'Kazanç, para ve satış anları için nostaljik kasa zili',
  },
  {
    id: 'punch-slap',
    name: 'Komedi Tokadı / Şaplak (Slap)',
    category: 'meme',
    subcategory: 'Viral',
    icon: '👋',
    duration: 0.28,
    description: 'Çizgi film ve şaka videoları için komik tokat sesi',
  },
  {
    id: 'dramatic-dun',
    name: 'Dramatik Şok (Dun Dun Dun!)',
    category: 'meme',
    subcategory: 'Viral',
    icon: '😱',
    duration: 1.6,
    description: 'Beklenmedik ters köşe ve gerilim şoku orkestra vuruşu',
  },
  {
    id: 'laser-zap',
    name: 'Uzay Lazeri (Pew Pew)',
    category: 'meme',
    subcategory: 'Viral',
    icon: '🔫',
    duration: 0.28,
    description: 'Sci-fi bilim kurgu lazer tabancası atışı',
  },
  {
    id: 'glitch-static',
    name: 'TV Karıncalanma Statik (Glitch)',
    category: 'meme',
    subcategory: 'Viral',
    icon: '📡',
    duration: 0.45,
    description: 'Bozuk sinyal ve televizyon cızırtı patlaması',
  },
  {
    id: 'radio-tuning',
    name: 'Radyo Frekans Arama',
    category: 'meme',
    subcategory: 'Viral',
    icon: '📻',
    duration: 0.8,
    description: 'Kanal arayan analog radyo ıslığı ve cızırtısı',
  },
  {
    id: 'funny-quack',
    name: 'Plastik Ördek Vaklaması (Quack)',
    category: 'meme',
    subcategory: 'Viral',
    icon: '🦆',
    duration: 0.32,
    description: 'Gülünç anlar ve komik tepkiler için banyo ördeği cıyaklaması',
  },

  // ==========================================
  // 6. BGM & DÖNGÜ ATMOSFERLERİ (6 Parça)
  // ==========================================
  {
    id: 'lofi-chord',
    name: 'Lofi Piyano Fonu (Warm Chill)',
    category: 'bgm',
    subcategory: 'Müzik',
    icon: '🎹',
    duration: 6.4,
    description: 'Arka plan için rahatlatıcı 4 akorlu elektrik piyano döngüsü',
  },
  {
    id: 'cinematic-drone',
    name: 'Uzay & Derin Atmosfer Pedi',
    category: 'bgm',
    subcategory: 'Müzik',
    icon: '🌌',
    duration: 7.5,
    description: 'Sinematik anlatımlar ve meditasyon için derin synth süzülmesi',
  },
  {
    id: 'cyber-synth-pulse',
    name: '80ler Synthwave Nabız (Arp)',
    category: 'bgm',
    subcategory: 'Müzik',
    icon: '🌆',
    duration: 6.0,
    description: 'Retro fütüristik araba sürüş ve teknoloji arka planı',
  },
  {
    id: 'ambient-rain',
    name: 'Huzurlu Yağmur Sesi (Rain Ambience)',
    category: 'bgm',
    subcategory: 'Atmosfer',
    icon: '🌧️',
    duration: 6.0,
    description: 'Kahve dükkanı ve huzurlu anlar için organik yağmur damlaları',
  },
  {
    id: 'vinyl-crackle',
    name: 'Nostaljik Plak Cızırtısı (Vinyl)',
    category: 'bgm',
    subcategory: 'Atmosfer',
    icon: '☕',
    duration: 5.0,
    description: 'Lo-Fi beatlerin altına koyulan sıcak vinil tozu ve çıtırtısı',
  },
  {
    id: 'crowd-cheer',
    name: 'Stadyum Tezahüratı & Alkış',
    category: 'bgm',
    subcategory: 'Atmosfer',
    icon: '👏',
    duration: 3.5,
    description: 'Coşkulu kalabalık kutlaması ve zafer alkışı',
  },
];

/**
 * Encodes an AudioBuffer into an uncompressed 16-bit PCM WAV Blob
 */
export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;

  const dataLength = buffer.length * blockAlign;
  const bufferLength = 44 + dataLength;

  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);

  function writeString(offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  // RIFF Chunk
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(8, 'WAVE');

  // fmt sub-chunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);

  // data sub-chunk
  writeString(36, 'data');
  view.setUint32(40, dataLength, true);

  // Interleave audio samples
  let offset = 44;
  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(buffer.getChannelData(c));
  }

  for (let i = 0; i < buffer.length; i++) {
    for (let c = 0; c < numChannels; c++) {
      let sample = channels[c][i];
      sample = Math.max(-1, Math.min(1, sample));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([view], { type: 'audio/wav' });
}

/**
 * Procedurally synthesize sound effect using Web Audio API
 */
export async function generateSfxBlob(type: SfxType): Promise<Blob> {
  const item = BUILTIN_SFX_LIST.find((s) => s.id === type) || BUILTIN_SFX_LIST[0];
  const sampleRate = 48000;
  const duration = item.duration;

  // Use OfflineAudioContext for instantaneous render without audio hardware latency
  const ctx = new OfflineAudioContext(2, Math.max(1, Math.round(sampleRate * duration)), sampleRate);

  // Procedural Noise Generator helper
  const createNoiseBuffer = (dur: number) => {
    const bufferSize = Math.round(sampleRate * dur);
    const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    return noise;
  };

  // Switch sound synthesis logic
  if (type === 'whoosh') {
    const noise = createNoiseBuffer(duration);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 3.2;
    filter.frequency.setValueAtTime(150, 0);
    filter.frequency.exponentialRampToValueAtTime(2600, duration * 0.45);
    filter.frequency.exponentialRampToValueAtTime(180, duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, 0);
    gain.gain.linearRampToValueAtTime(0.9, duration * 0.4);
    gain.gain.exponentialRampToValueAtTime(0.001, duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(0);
  } else if (type === 'whoosh-heavy' || type === 'whoosh-deep') {
    const noise = createNoiseBuffer(duration);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 4.0;
    filter.frequency.setValueAtTime(80, 0);
    filter.frequency.exponentialRampToValueAtTime(1400, duration * 0.5);
    filter.frequency.exponentialRampToValueAtTime(90, duration);

    const subOsc = ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(120, 0);
    subOsc.frequency.exponentialRampToValueAtTime(45, duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, 0);
    gain.gain.linearRampToValueAtTime(0.95, duration * 0.45);
    gain.gain.exponentialRampToValueAtTime(0.001, duration);

    noise.connect(filter);
    filter.connect(gain);
    subOsc.connect(gain);
    gain.connect(ctx.destination);

    noise.start(0);
    subOsc.start(0);
    subOsc.stop(duration);
  } else if (type === 'whoosh-reverse') {
    const noise = createNoiseBuffer(duration);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 2.5;
    filter.frequency.setValueAtTime(120, 0);
    filter.frequency.exponentialRampToValueAtTime(3800, duration * 0.95);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.01, 0);
    gain.gain.exponentialRampToValueAtTime(0.95, duration * 0.95);
    gain.gain.linearRampToValueAtTime(0.0001, duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(0);
  } else if (type === 'whoosh-whip' || type === 'whoosh-fast') {
    const noise = createNoiseBuffer(duration);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 4.5;
    filter.frequency.setValueAtTime(300, 0);
    filter.frequency.exponentialRampToValueAtTime(4200, duration * 0.4);
    filter.frequency.exponentialRampToValueAtTime(400, duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, 0);
    gain.gain.linearRampToValueAtTime(1.0, duration * 0.35);
    gain.gain.exponentialRampToValueAtTime(0.001, duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(0);
  } else if (type === 'whoosh-cinematic') {
    const noise = createNoiseBuffer(duration);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 2.0;
    filter.frequency.setValueAtTime(200, 0);
    filter.frequency.exponentialRampToValueAtTime(2200, duration * 0.5);
    filter.frequency.exponentialRampToValueAtTime(120, duration);

    const subOsc = ctx.createOscillator();
    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(90, 0);
    subOsc.frequency.exponentialRampToValueAtTime(35, duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, 0);
    gain.gain.linearRampToValueAtTime(0.85, duration * 0.45);
    gain.gain.exponentialRampToValueAtTime(0.001, duration);

    noise.connect(filter);
    filter.connect(gain);
    subOsc.connect(gain);
    gain.connect(ctx.destination);
    noise.start(0);
    subOsc.start(0);
    subOsc.stop(duration);
  } else if (type === 'whoosh-digital') {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, 0);
    osc.frequency.exponentialRampToValueAtTime(120, duration * 0.8);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2500, 0);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.7, 0);
    gain.gain.exponentialRampToValueAtTime(0.001, duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(0);
    osc.stop(duration);
  } else if (type === 'whoosh-fire') {
    const noise = createNoiseBuffer(duration);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, 0);
    filter.frequency.exponentialRampToValueAtTime(1800, duration * 0.4);
    filter.frequency.exponentialRampToValueAtTime(300, duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, 0);
    gain.gain.linearRampToValueAtTime(0.9, duration * 0.35);
    gain.gain.exponentialRampToValueAtTime(0.001, duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(0);
  } else if (type === 'whoosh-sword') {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2400, 0);
    osc.frequency.exponentialRampToValueAtTime(650, duration);

    const noise = createNoiseBuffer(duration);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(3200, 0);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, 0);
    gain.gain.linearRampToValueAtTime(0.85, 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, duration);

    osc.connect(gain);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(0);
    osc.stop(duration);
    noise.start(0);
  } else if (type === 'bass-drop' || type === '808-sub' || type === 'cinematic-sub') {
    const startFreq = type === '808-sub' ? 180 : 130;
    const endFreq = type === 'cinematic-sub' ? 28 : 36;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(startFreq, 0);
    osc.frequency.exponentialRampToValueAtTime(endFreq, duration * 0.85);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.95, 0);
    gain.gain.linearRampToValueAtTime(0.85, 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(0);
    osc.stop(duration);
  } else if (type === 'cinematic-boom') {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(95, 0);
    osc.frequency.exponentialRampToValueAtTime(24, duration * 0.9);

    const noise = createNoiseBuffer(0.5);
    const nFilter = ctx.createBiquadFilter();
    nFilter.type = 'lowpass';
    nFilter.frequency.setValueAtTime(450, 0);

    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.8, 0);
    nGain.gain.exponentialRampToValueAtTime(0.001, 0.5);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.95, 0);
    gain.gain.exponentialRampToValueAtTime(0.001, duration);

    osc.connect(gain);
    noise.connect(nFilter);
    nFilter.connect(nGain);
    nGain.connect(ctx.destination);
    gain.connect(ctx.destination);

    osc.start(0);
    osc.stop(duration);
    noise.start(0);
  } else if (type === 'metal-hit') {
    const freqs = [320, 840, 1480, 2120];
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, 0);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.4 / (idx + 1), 0);
      gain.gain.exponentialRampToValueAtTime(0.001, duration / (idx + 1));

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(0);
      osc.stop(duration);
    });
  } else if (type === 'riser-tension') {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(90, 0);
    osc.frequency.exponentialRampToValueAtTime(880, duration);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(200, 0);
    filter.frequency.exponentialRampToValueAtTime(4500, duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.05, 0);
    gain.gain.exponentialRampToValueAtTime(0.9, duration * 0.95);
    gain.gain.linearRampToValueAtTime(0.001, duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(0);
    osc.stop(duration);
  } else if (type === 'riser-white-noise') {
    const noise = createNoiseBuffer(duration);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 4.0;
    filter.frequency.setValueAtTime(250, 0);
    filter.frequency.exponentialRampToValueAtTime(6500, duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.05, 0);
    gain.gain.exponentialRampToValueAtTime(0.9, duration * 0.95);
    gain.gain.linearRampToValueAtTime(0.0001, duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(0);
  } else if (type === 'heartbeat-thump') {
    const playThump = (st: number, p: number) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(75 * p, st);
      osc.frequency.exponentialRampToValueAtTime(35, st + 0.18);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, st);
      gain.gain.linearRampToValueAtTime(0.95 * p, st + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, st + 0.22);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(st);
      osc.stop(st + 0.25);
    };
    playThump(0, 1.0);
    playThump(0.28, 0.75);
  } else if (type === 'thunder-crack') {
    const noise = createNoiseBuffer(duration);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, 0);
    filter.frequency.exponentialRampToValueAtTime(150, duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.95, 0);
    gain.gain.exponentialRampToValueAtTime(0.001, duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(0);
  } else if (type === 'gong-strike') {
    const fundamental = 210;
    const overtones = [1, 1.58, 2.32, 3.1];
    overtones.forEach((ratio, idx) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(fundamental * ratio, 0);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.7 / (idx + 1), 0);
      gain.gain.exponentialRampToValueAtTime(0.0001, duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(0);
      osc.stop(duration);
    });
  } else if (type === 'pop' || type === 'pop-cork') {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    const startF = type === 'pop-cork' ? 180 : 350;
    const endF = type === 'pop-cork' ? 680 : 950;
    osc.frequency.setValueAtTime(startF, 0);
    osc.frequency.exponentialRampToValueAtTime(endF, duration * 0.7);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.9, 0);
    gain.gain.exponentialRampToValueAtTime(0.001, duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(0);
    osc.stop(duration);
  } else if (type === 'bubble-double') {
    const makePop = (st: number, f1: number, f2: number) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f1, st);
      osc.frequency.exponentialRampToValueAtTime(f2, st + 0.1);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.85, st);
      gain.gain.exponentialRampToValueAtTime(0.001, st + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(st);
      osc.stop(st + 0.13);
    };
    makePop(0, 420, 880);
    makePop(0.12, 580, 1100);
  } else if (type === 'ding') {
    const fundamental = 880;
    const harmonics = [1, 2.76, 5.4, 8.9];
    const gains = [0.6, 0.25, 0.1, 0.05];

    harmonics.forEach((h, idx) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(fundamental * h, 0);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(gains[idx], 0);
      gain.gain.exponentialRampToValueAtTime(0.0001, duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(0);
      osc.stop(duration);
    });
  } else if (type === 'apple-chime') {
    // Tri-tone Eb5, G5, Bb5
    const notes = [622.25, 783.99, 932.33];
    notes.forEach((freq, idx) => {
      const st = idx * 0.1;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, st);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.65, st);
      gain.gain.exponentialRampToValueAtTime(0.001, st + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(st);
      osc.stop(st + 0.55);
    });
  } else if (type === 'sparkle-magic') {
    const notes = [1046.5, 1318.5, 1567.98, 2093.0, 2637.0, 3135.96];
    notes.forEach((freq, idx) => {
      const st = idx * 0.08;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, st);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.4, st);
      gain.gain.exponentialRampToValueAtTime(0.001, st + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(st);
      osc.stop(st + 0.45);
    });
  } else if (type === 'unlock-click' || type === 'mouse-click') {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(2200, 0);
    osc.frequency.exponentialRampToValueAtTime(240, duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.8, 0);
    gain.gain.exponentialRampToValueAtTime(0.001, duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(0);
    osc.stop(duration);
  } else if (type === 'coin-pickup') {
    // 8-bit Coin B5 -> E6
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(987.77, 0);
    osc.frequency.setValueAtTime(1318.51, 0.08);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.5, 0);
    gain.gain.exponentialRampToValueAtTime(0.001, duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(0);
    osc.stop(duration);
  } else if (type === 'level-up') {
    const arpeggio = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    const step = duration / arpeggio.length;
    arpeggio.forEach((freq, idx) => {
      const st = idx * step;
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, st);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.45, st);
      gain.gain.exponentialRampToValueAtTime(0.001, st + step * 1.5);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(st);
      osc.stop(st + step * 1.5);
    });
  } else if (type === 'error-buzz') {
    const playBuzz = (st: number) => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, st);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.65, st);
      gain.gain.exponentialRampToValueAtTime(0.001, st + 0.16);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(st);
      osc.stop(st + 0.18);
    };
    playBuzz(0);
    playBuzz(0.2);
  } else if (type === 'typewriter' || type === 'keyboard-mechanical') {
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1400, 0);
    osc.frequency.exponentialRampToValueAtTime(90, duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.85, 0);
    gain.gain.exponentialRampToValueAtTime(0.001, duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(0);
    osc.stop(duration);
  } else if (type === 'shutter') {
    const createClick = (startTime: number, pitch: number) => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(pitch, startTime);
      osc.frequency.exponentialRampToValueAtTime(120, startTime + 0.05);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(0.75, startTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.07);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.08);
    };
    createClick(0, 1800);
    createClick(0.12, 1400);
  } else if (type === 'shutter-motor') {
    for (let i = 0; i < 3; i++) {
      const st = i * 0.12;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1600, st);
      osc.frequency.exponentialRampToValueAtTime(150, st + 0.05);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.75, st);
      gain.gain.exponentialRampToValueAtTime(0.001, st + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(st);
      osc.stop(st + 0.09);
    }
  } else if (type === 'paper-slide' || type === 'paper-tear') {
    const noise = createNoiseBuffer(duration);
    const filter = ctx.createBiquadFilter();
    filter.type = type === 'paper-tear' ? 'bandpass' : 'highpass';
    filter.frequency.setValueAtTime(type === 'paper-tear' ? 1800 : 2500, 0);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.01, 0);
    gain.gain.linearRampToValueAtTime(0.7, duration * 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(0);
  } else if (type === 'tape-rewind') {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, 0);
    osc.frequency.exponentialRampToValueAtTime(1800, duration * 0.8);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.4, 0);
    gain.gain.exponentialRampToValueAtTime(0.001, duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(0);
    osc.stop(duration);
  } else if (type === 'record-scratch') {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, 0);
    osc.frequency.linearRampToValueAtTime(150, duration * 0.5);
    osc.frequency.linearRampToValueAtTime(950, duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.65, 0);
    gain.gain.exponentialRampToValueAtTime(0.001, duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(0);
    osc.stop(duration);
  } else if (type === 'switch-toggle' || type === 'clock-tick') {
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(type === 'clock-tick' ? 950 : 650, 0);
    osc.frequency.exponentialRampToValueAtTime(80, duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.7, 0);
    gain.gain.exponentialRampToValueAtTime(0.001, duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(0);
    osc.stop(duration);
  } else if (type === 'air-horn') {
    const chord = [466.16, 520.0, 622.25]; // Bb4 detuned triad
    chord.forEach((freq) => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, 0);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.4, 0);
      gain.gain.setValueAtTime(0.4, duration - 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(0);
      osc.stop(duration);
    });
  } else if (type === 'sad-trombone') {
    const notes = [311.13, 293.66, 277.18, 246.94]; // Eb4 -> D4 -> Db4 -> B3
    const step = duration / notes.length;
    notes.forEach((freq, idx) => {
      const st = idx * step;
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, st);
      if (idx === notes.length - 1) {
        // Vibrato on the last note
        osc.frequency.linearRampToValueAtTime(freq - 15, st + step);
      }

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.45, st);
      gain.gain.exponentialRampToValueAtTime(0.001, st + step);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(st);
      osc.stop(st + step);
    });
  } else if (type === 'record-stop') {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, 0);
    osc.frequency.exponentialRampToValueAtTime(30, duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.7, 0);
    gain.gain.exponentialRampToValueAtTime(0.001, duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(0);
    osc.stop(duration);
  } else if (type === 'cash-register') {
    // Mechanical latch + crystal bell
    const bell = ctx.createOscillator();
    bell.type = 'sine';
    bell.frequency.setValueAtTime(1760, 0.05);

    const bGain = ctx.createGain();
    bGain.gain.setValueAtTime(0.001, 0);
    bGain.gain.linearRampToValueAtTime(0.8, 0.06);
    bGain.gain.exponentialRampToValueAtTime(0.001, duration);

    bell.connect(bGain);
    bGain.connect(ctx.destination);
    bell.start(0.05);
    bell.stop(duration);
  } else if (type === 'punch-slap') {
    const noise = createNoiseBuffer(duration);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1200, 0);

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, 0);
    osc.frequency.exponentialRampToValueAtTime(45, duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.95, 0);
    gain.gain.exponentialRampToValueAtTime(0.001, duration);

    noise.connect(filter);
    filter.connect(gain);
    osc.connect(gain);
    gain.connect(ctx.destination);

    noise.start(0);
    osc.start(0);
    osc.stop(duration);
  } else if (type === 'dramatic-dun') {
    const chord = [130.81, 164.81, 196.0]; // C3, E3, G3
    chord.forEach((freq) => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, 0);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.5, 0);
      gain.gain.exponentialRampToValueAtTime(0.001, duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(0);
      osc.stop(duration);
    });
  } else if (type === 'laser-zap') {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(2600, 0);
    osc.frequency.exponentialRampToValueAtTime(140, duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.7, 0);
    gain.gain.exponentialRampToValueAtTime(0.001, duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(0);
    osc.stop(duration);
  } else if (type === 'glitch-static' || type === 'radio-tuning') {
    const noise = createNoiseBuffer(duration);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 5.0;
    filter.frequency.setValueAtTime(1500, 0);
    filter.frequency.linearRampToValueAtTime(800, duration * 0.5);
    filter.frequency.linearRampToValueAtTime(3200, duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.65, 0);
    gain.gain.exponentialRampToValueAtTime(0.001, duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(0);
  } else if (type === 'funny-quack') {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(280, 0);
    osc.frequency.linearRampToValueAtTime(450, duration * 0.5);
    osc.frequency.linearRampToValueAtTime(220, duration);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 6.0;
    filter.frequency.setValueAtTime(900, 0);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.7, 0);
    gain.gain.exponentialRampToValueAtTime(0.001, duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(0);
    osc.stop(duration);
  } else if (type === 'lofi-chord') {
    const chords = [
      [349.23, 440.0, 523.25, 659.25], // F4, A4, C5, E5
      [329.63, 392.0, 493.88, 587.33], // E4, G4, B4, D5
      [293.66, 349.23, 440.0, 523.25], // D4, F4, A4, C5
      [261.63, 329.63, 392.0, 493.88], // C4, E4, G4, B4
    ];
    const chordDuration = duration / chords.length;

    chords.forEach((chord, chordIdx) => {
      const chordStart = chordIdx * chordDuration;
      chord.forEach((freq) => {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, chordStart);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.001, chordStart);
        gain.gain.linearRampToValueAtTime(0.18, chordStart + 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, chordStart + chordDuration);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(chordStart);
        osc.stop(chordStart + chordDuration);
      });
    });
  } else if (type === 'cinematic-drone') {
    const baseFreqs = [55, 110, 165]; // A1, A2, E3
    baseFreqs.forEach((freq) => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, 0);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(350, 0);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.01, 0);
      gain.gain.linearRampToValueAtTime(0.25, duration * 0.2);
      gain.gain.setValueAtTime(0.25, duration * 0.8);
      gain.gain.exponentialRampToValueAtTime(0.001, duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(0);
      osc.stop(duration);
    });
  } else if (type === 'cyber-synth-pulse') {
    const arpNotes = [110, 130.81, 164.81, 196.0];
    const noteDur = 0.25;
    const totalNotes = Math.floor(duration / noteDur);
    for (let i = 0; i < totalNotes; i++) {
      const st = i * noteDur;
      const freq = arpNotes[i % arpNotes.length];
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, st);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, st);
      filter.frequency.exponentialRampToValueAtTime(200, st + noteDur);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.35, st);
      gain.gain.exponentialRampToValueAtTime(0.001, st + noteDur);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(st);
      osc.stop(st + noteDur);
    }
  } else if (type === 'ambient-rain' || type === 'vinyl-crackle' || type === 'crowd-cheer') {
    const noise = createNoiseBuffer(duration);
    const filter = ctx.createBiquadFilter();
    filter.type = type === 'ambient-rain' ? 'lowpass' : 'bandpass';
    filter.frequency.setValueAtTime(type === 'ambient-rain' ? 1200 : 2200, 0);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.01, 0);
    gain.gain.linearRampToValueAtTime(type === 'crowd-cheer' ? 0.75 : 0.35, duration * 0.1);
    gain.gain.setValueAtTime(type === 'crowd-cheer' ? 0.75 : 0.35, duration * 0.8);
    gain.gain.exponentialRampToValueAtTime(0.001, duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(0);
  } else {
    // Fallback: 1000 Hz clean bleep
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1000, 0);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.8, 0);
    gain.gain.exponentialRampToValueAtTime(0.001, duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(0);
    osc.stop(duration);
  }

  const renderedBuffer = await ctx.startRendering();
  return audioBufferToWavBlob(renderedBuffer);
}

/**
 * Quick preview player using AudioContext
 */
let previewAudioElement: HTMLAudioElement | null = null;
export async function playSfxPreview(type: SfxType): Promise<void> {
  try {
    if (previewAudioElement) {
      previewAudioElement.pause();
      previewAudioElement.currentTime = 0;
    }
    const blob = await generateSfxBlob(type);
    const url = URL.createObjectURL(blob);
    previewAudioElement = new Audio(url);
    previewAudioElement.onended = () => URL.revokeObjectURL(url);
    await previewAudioElement.play();
  } catch (err) {
    console.warn('Failed to preview SFX:', err);
  }
}
