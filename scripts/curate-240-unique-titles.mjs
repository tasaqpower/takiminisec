import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const catalogPath = path.join(rootDir, 'public/video-assets/ONLINE_CATALOG.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

// Curated Title Specifications
// 1. Lower Thirds (41 items): professional roles, names, positions, channel badges
const lowerThirdPresets = [
  { name: 'Modern Kurumsal Alt Bant', text: 'Ahmet Yılmaz\nKreatif Direktör', font: 'Plus Jakarta Sans', color: '#ffffff', bg: 'rgba(15, 23, 42, 0.88)', padX: 24, padY: 12, radius: 6, align: 'left', y: 320, anim: 'slide-up' },
  { name: 'Haber & Muhabir Alt Bandı', text: 'SON DAKİKA\nÖnemli Gelişmeler Aktarılıyor', font: 'Oswald', color: '#ffffff', bg: '#dc2626', padX: 28, padY: 14, radius: 0, align: 'left', y: 320, anim: 'slide-up' },
  { name: 'Minimalist Şık İsimlik', text: 'Zeynep Kaya\nFotoğraf Sanatçısı', font: 'Inter', color: '#f8fafc', bg: 'rgba(30, 41, 59, 0.8)', padX: 20, padY: 10, radius: 4, align: 'left', y: 320, anim: 'fade' },
  { name: 'Degrade Vurgulu Alt Bant', text: 'Can Demir\nTeknoloji Editörü', font: 'Plus Jakarta Sans', color: '#38bdf8', bg: 'rgba(12, 74, 110, 0.85)', padX: 24, padY: 12, radius: 8, align: 'left', y: 320, anim: 'slide-up' },
  { name: 'Siber & Teknoloji İsimliği', text: 'SİSTEM MİMARI\nKıdemli Yazılım Mühendisi', font: 'JetBrains Mono', color: '#38bdf8', bg: 'rgba(2, 6, 23, 0.92)', padX: 22, padY: 10, radius: 2, align: 'left', y: 320, anim: 'typewriter' },
  { name: 'Bölünmüş Çubuklu Tasarımcı', text: 'Mehmet Şahin\nKullanıcı Deneyimi Tasarımcısı', font: 'Montserrat', color: '#ffffff', bg: 'rgba(24, 24, 27, 0.9)', padX: 24, padY: 12, radius: 6, align: 'left', y: 320, anim: 'slide-up' },
  { name: 'CEO & Şirket Kurucusu', text: 'Burak Aksoy\nKurucu & İcra Kurulu Başkanı', font: 'Plus Jakarta Sans', color: '#fbbf24', bg: 'rgba(15, 23, 42, 0.92)', padX: 26, padY: 14, radius: 6, align: 'left', y: 320, anim: 'slide-up' },
  { name: 'Akademisyen & Profesör', text: 'Prof. Dr. Selim Özkan\nTıp Fakültesi Dekanı', font: 'Merriweather', color: '#ffffff', bg: 'rgba(30, 41, 59, 0.88)', padX: 22, padY: 12, radius: 4, align: 'left', y: 320, anim: 'fade' },
  { name: 'Podcast Konuk İsimliği', text: 'Ece Vural\nYazar & Dijital İletişim Uzmanı', font: 'Plus Jakarta Sans', color: '#f43f5e', bg: 'rgba(24, 24, 27, 0.9)', padX: 24, padY: 12, radius: 20, align: 'left', y: 320, anim: 'pop' },
  { name: 'Twitch & Canlı Yayıncı', text: 'VOLKAN «CYBER»\nCanlı Yayın Moderatörü', font: 'Bebas Neue', color: '#a3e635', bg: 'rgba(9, 9, 11, 0.95)', padX: 26, padY: 12, radius: 4, align: 'left', y: 320, anim: 'slide-up' },
  { name: 'Avukat & Hukuk Danışmanı', text: 'Av. Kemal Güner\nTicaret Hukuku Uzmanı', font: 'Cinzel', color: '#fbbf24', bg: 'rgba(15, 23, 42, 0.9)', padX: 24, padY: 12, radius: 4, align: 'left', y: 320, anim: 'fade' },
  { name: 'Şef & Gastronomi Ustası', text: 'Şef Murat Usta\nBaş Aşçı & Restoran Sahibi', font: 'Playfair Display', color: '#facc15', bg: 'rgba(24, 24, 27, 0.88)', padX: 24, padY: 12, radius: 6, align: 'left', y: 320, anim: 'slide-up' },
  { name: 'Mimar & Yapı Tasarımcısı', text: 'Berna Erdem\nYüksek Mimar & Restoratör', font: 'Inter', color: '#ffffff', bg: 'rgba(51, 65, 85, 0.85)', padX: 22, padY: 10, radius: 4, align: 'left', y: 320, anim: 'slide-up' },
  { name: 'Yatırım & Finans Analisti', text: 'Deniz Çetin\nBaş Portföy Yöneticisi', font: 'Roboto', color: '#34d399', bg: 'rgba(6, 78, 59, 0.88)', padX: 24, padY: 12, radius: 6, align: 'left', y: 320, anim: 'slide-up' },
  { name: 'Müzisyen & Besteci Bandı', text: 'Aras Kaan\nFilm Müziği Bestecisi', font: 'Lora', color: '#e2e8f0', bg: 'rgba(15, 23, 42, 0.85)', padX: 22, padY: 10, radius: 8, align: 'left', y: 320, anim: 'fade' },
  { name: 'Girişimci & Melek Yatırımcı', text: 'Sinan Göktaş\nGirişimci & Yönetim Kurulu Üyesi', font: 'Plus Jakarta Sans', color: '#ffffff', bg: 'rgba(30, 41, 59, 0.9)', padX: 24, padY: 12, radius: 6, align: 'left', y: 320, anim: 'slide-up' },
  { name: 'Psikolog & Yaşam Koçu', text: 'Uzm. Psk. Derya Aslan\nKlinik Psikolog & Danışman', font: 'Inter', color: '#f8fafc', bg: 'rgba(56, 189, 248, 0.15)', padX: 22, padY: 12, radius: 10, align: 'left', y: 320, anim: 'fade' },
  { name: 'Sporcu & Fitness Koçu', text: 'HAKAN POLAT\nPerformans & Kondisyon Koçu', font: 'Oswald', color: '#facc15', bg: 'rgba(0, 0, 0, 0.92)', padX: 26, padY: 12, radius: 2, align: 'left', y: 320, anim: 'slide-up' },
  { name: 'Belgesel Röportaj Şeridi', text: 'Halil Dede (84 Yaşında)\nKöyün Son Nalbur Ustası', font: 'Roboto', color: '#ffffff', bg: 'rgba(0, 0, 0, 0.85)', padX: 22, padY: 10, radius: 4, align: 'left', y: 320, anim: 'fade' },
  { name: 'Seyahat Bloggerı Şeridi', text: 'İpek ile Yolda\nDünya Turu // 45. Ülke', font: 'Caveat', color: '#fde047', bg: 'rgba(24, 24, 27, 0.85)', padX: 24, padY: 12, radius: 12, align: 'left', y: 320, anim: 'pop' },
  { name: 'Youtuber Abone Rozeti', text: 'TEKNO REHBER\nAbone Olup Bildirimleri Açın', font: 'Montserrat', color: '#ffffff', bg: '#e11d48', padX: 26, padY: 12, radius: 20, align: 'left', y: 320, anim: 'pop' },
  { name: 'Spiker & Haber Masası', text: 'GÜN ORTASI HABERLERİ\nBülten Sorumlusu: Melis Ak', font: 'Oswald', color: '#ffffff', bg: 'rgba(15, 23, 42, 0.95)', padX: 24, padY: 12, radius: 0, align: 'left', y: 320, anim: 'slide-up' },
  { name: 'Moda & Stil Danışmanı', text: 'Cansu Şahin\nModa Direktörü & Stilist', font: 'Playfair Display', color: '#f43f5e', bg: 'rgba(255, 255, 255, 0.95)', padX: 24, padY: 10, radius: 4, align: 'left', y: 320, anim: 'fade' },
  { name: 'Otomobil İnceleme Şeridi', text: '0-100 KM/S HIZLANMA TESTİ\n4.2 Saniye // Spor Modu', font: 'Barlow Condensed', color: '#facc15', bg: 'rgba(15, 23, 42, 0.9)', padX: 26, padY: 12, radius: 4, align: 'left', y: 320, anim: 'slide-up' },
  { name: 'Eğitim & Kurs Eğitmeni', text: 'Emre Kılıç\nPython & Veri Bilimi Eğitmeni', font: 'JetBrains Mono', color: '#6ee7b7', bg: 'rgba(6, 78, 59, 0.85)', padX: 22, padY: 10, radius: 6, align: 'left', y: 320, anim: 'slide-up' },
  { name: 'Sağlık & Beslenme Uzmanı', text: 'Dyt. Merve Sancak\nUzman Diyetisyen & Beslenme', font: 'Plus Jakarta Sans', color: '#ffffff', bg: 'rgba(13, 148, 136, 0.88)', padX: 22, padY: 12, radius: 8, align: 'left', y: 320, anim: 'slide-up' },
  { name: 'Gayrimenkul Danışmanı', text: 'Serdar Güven\nLüks Konut & Arsa Uzmanı', font: 'Cinzel', color: '#fde047', bg: 'rgba(15, 23, 42, 0.92)', padX: 24, padY: 12, radius: 4, align: 'left', y: 320, anim: 'slide-up' },
  { name: 'Sanat Yönetmeni Şeridi', text: 'Okan Yurtseven\nBaş Sanat Yönetmeni', font: 'Montserrat', color: '#ffffff', bg: 'rgba(88, 28, 135, 0.88)', padX: 24, padY: 12, radius: 6, align: 'left', y: 320, anim: 'slide-up' },
  { name: 'Çevre & Doğa Savunucusu', text: 'Yeşil Gelecek Hareketi\nSürdürülebilir Yaşam Sözcüsü', font: 'Inter', color: '#bbf7d0', bg: 'rgba(20, 83, 45, 0.9)', padX: 22, padY: 10, radius: 8, align: 'left', y: 320, anim: 'fade' },
  { name: 'Havacılık & Pilot İsimliği', text: 'Kpt. Pilot Tolga Yaman\nUçuş Eğitmeni & Kaptan', font: 'Roboto', color: '#38bdf8', bg: 'rgba(15, 23, 42, 0.92)', padX: 24, padY: 12, radius: 4, align: 'left', y: 320, anim: 'slide-up' },
  { name: 'Tarihçi & Araştırmacı', text: 'Doç. Dr. Ali Kemal\nOsmanlı Tarihi Araştırmacısı', font: 'Cormorant Garamond', color: '#fde047', bg: 'rgba(69, 26, 3, 0.9)', padX: 24, padY: 12, radius: 4, align: 'left', y: 320, anim: 'fade' },
  { name: 'Görsel Efekt Süpervizörü', text: 'VFX SÜPERVİZÖRÜ\nCGI & Kompozit Departmanı', font: 'JetBrains Mono', color: '#a855f7', bg: 'rgba(9, 9, 11, 0.95)', padX: 24, padY: 12, radius: 4, align: 'left', y: 320, anim: 'typewriter' },
  { name: 'Yapay Zeka Araştırmacısı', text: 'Dr. Gizem Altan\nBüyük Dil Modelleri Uzmanı', font: 'Plus Jakarta Sans', color: '#38bdf8', bg: 'rgba(15, 23, 42, 0.9)', padX: 24, padY: 12, radius: 6, align: 'left', y: 320, anim: 'slide-up' },
  { name: 'Müze & Sergi Küratörü', text: 'Leyla Soydan\nModern Sanat Müzesi Küratörü', font: 'Playfair Display', color: '#ffffff', bg: 'rgba(24, 24, 27, 0.88)', padX: 22, padY: 10, radius: 4, align: 'left', y: 320, anim: 'fade' },
  { name: 'Ses Tasarımcısı & Mühendis', text: 'Koray Tunç\nSes Tasarımı & Mastering', font: 'Fira Code', color: '#34d399', bg: 'rgba(15, 23, 42, 0.9)', padX: 22, padY: 10, radius: 4, align: 'left', y: 320, anim: 'typewriter' },
  { name: 'Stüdyo Canlı Yayın Konuğu', text: 'CANLI BAĞLANTI\nAnkara Stüdyosu // Meclis Hattı', font: 'Oswald', color: '#ffffff', bg: '#b91c1c', padX: 26, padY: 12, radius: 0, align: 'left', y: 320, anim: 'slide-up' },
  { name: 'Yayın Yönetmeni Künyesi', text: 'YAYIN YÖNETMENİ\nMurat Çelikdemir', font: 'Inter', color: '#94a3b8', bg: 'rgba(15, 23, 42, 0.85)', padX: 20, padY: 10, radius: 4, align: 'left', y: 320, anim: 'fade' },
  { name: 'Genel Koordinatör Bandı', text: 'Funda Yıldırım\nOperasyon & Proje Koordinatörü', font: 'Plus Jakarta Sans', color: '#ffffff', bg: 'rgba(30, 41, 59, 0.9)', padX: 24, padY: 12, radius: 6, align: 'left', y: 320, anim: 'slide-up' },
  { name: 'Dijital Pazarlama Lideri', text: 'Kerem Yalçın\nBüyüme & Pazarlama Lideri', font: 'Montserrat', color: '#f59e0b', bg: 'rgba(24, 24, 27, 0.9)', padX: 24, padY: 12, radius: 6, align: 'left', y: 320, anim: 'slide-up' },
  { name: 'Müşteri Başarı Yöneticisi', text: 'Aslı Doğan\nMüşteri Deneyimi Yöneticisi', font: 'Inter', color: '#ffffff', bg: 'rgba(15, 23, 42, 0.88)', padX: 22, padY: 10, radius: 6, align: 'left', y: 320, anim: 'slide-up' },
  { name: 'Teknik Yapım Şefi', text: 'TEKNİK EKİP ŞEFİ\nIşık & Kamera Operatörü', font: 'Oswald', color: '#facc15', bg: 'rgba(0, 0, 0, 0.9)', padX: 24, padY: 12, radius: 2, align: 'left', y: 320, anim: 'slide-up' },
];

// 2. Cinematic Titles (41 items)
const cinematicPresets = [
  { name: 'Hollywood Epik Altın Başlık', text: 'BÜYÜK YOLCULUK\nBir Zamanlar Anadolu\'da', font: 'Playfair Display', color: '#fbbf24', stroke: '#78350f', strokeW: 1.5, shadow: 'rgba(245, 158, 11, 0.4)', blur: 14, spacing: 3, y: 0, anim: 'tracking-in' },
  { name: 'Karanlık Gerilim & Gizem', text: 'KAYIP ŞEHİR\nGölgelerin Ardında', font: 'Cinzel', color: '#ffffff', stroke: '#000000', strokeW: 2, shadow: 'rgba(0,0,0,0.9)', blur: 16, spacing: 4, y: 0, anim: 'fade' },
  { name: 'Minimalist Film Başlığı', text: 'S E S S İ Z L İ K\nBir Yalnızlık Öyküsü', font: 'Cormorant Garamond', color: '#f8fafc', stroke: 'transparent', strokeW: 0, shadow: 'rgba(0,0,0,0.8)', blur: 8, spacing: 5, y: 0, anim: 'fade' },
  { name: 'Lüks & Prestij Başlığı', text: 'P R E S T İ J\nZamanın Ötesinde', font: 'Cinzel', color: '#fef08a', stroke: '#854d0e', strokeW: 1, shadow: 'rgba(234, 179, 8, 0.3)', blur: 12, spacing: 4, y: 0, anim: 'tracking-in' },
  { name: 'Tarih Belgeseli Epik Giriş', text: 'İMPARATORLUK\nÇağlar Boyu Zafer', font: 'Playfair Display', color: '#fef3c7', stroke: '#451a03', strokeW: 2, shadow: 'rgba(0,0,0,0.8)', blur: 10, spacing: 3, y: 0, anim: 'slide-up' },
  { name: 'Retro 80\'ler Synthwave Başlığı', text: 'GECE SÜRÜŞÜ 1984\nNeon Işıklar Altında', font: 'Righteous', color: '#f43f5e', stroke: '#fda4af', strokeW: 2, shadow: '#ec4899', blur: 20, spacing: 2, y: 0, anim: 'neon-flash' },
  { name: 'Nordic Noir İskandinav Polisiye', text: 'K U Z E Y   S O Ğ U Ğ U\nBuz Tutmuş Sırlar', font: 'Montserrat', color: '#e2e8f0', stroke: '#0f172a', strokeW: 2, shadow: 'rgba(15, 23, 42, 0.9)', blur: 12, spacing: 4, y: 0, anim: 'fade' },
  { name: 'Uzay & Bilim Kurgu Odise', text: 'YILDIZLAR ARASI\nSonsuz Boşlukta', font: 'Orbitron', color: '#38bdf8', stroke: '#0369a1', strokeW: 1.5, shadow: 'rgba(56, 189, 248, 0.5)', blur: 18, spacing: 3, y: 0, anim: 'tracking-in' },
  { name: 'Western & Vahşi Batı Macerası', text: 'TOZLU KASABA\nSon Düello', font: 'Alfa Slab One', color: '#fed7aa', stroke: '#7c2d12', strokeW: 2, shadow: 'rgba(0,0,0,0.8)', blur: 10, spacing: 2, y: 0, anim: 'slide-up' },
  { name: 'Neo-Noir Dedektif Başlığı', text: 'YAĞMURLU CADDE\nGece Yarısı Cinayeti', font: 'Oswald', color: '#facc15', stroke: '#000000', strokeW: 3, shadow: 'rgba(0,0,0,0.9)', blur: 14, spacing: 3, y: 0, anim: 'fade' },
  { name: 'Korku & Paranormal Başlık', text: 'GÖLGELERİN SESİ\nKimse Duyamaz', font: 'Nosifer', color: '#dc2626', stroke: '#000000', strokeW: 2, shadow: '#7f1d1d', blur: 18, spacing: 3, y: 0, anim: 'glitch' },
  { name: 'Aşk & Romantizm Girişi', text: 'SONSUZ MEVSİM\nKalpten Gelen Şiir', font: 'Dancing Script', color: '#fbcfe8', stroke: '#9d174d', strokeW: 1, shadow: 'rgba(219, 39, 119, 0.4)', blur: 12, spacing: 2, y: 0, anim: 'fade' },
  { name: 'Derin Deniz Belgeseli', text: 'OKYANUSUN DİBİ\nKaranlık Derinlikler', font: 'Montserrat', color: '#67e8f9', stroke: '#164e63', strokeW: 2, shadow: 'rgba(6, 182, 212, 0.4)', blur: 16, spacing: 3, y: 0, anim: 'tracking-in' },
  { name: 'Post-Apokaliptik Hayatta Kalış', text: 'HARABELER\nKıyametten Sonra', font: 'Rubik Glitch', color: '#a3e635', stroke: '#000000', strokeW: 2, shadow: 'rgba(0,0,0,0.9)', blur: 12, spacing: 3, y: 0, anim: 'glitch' },
  { name: 'Samuray & Uzak Doğu Efsanesi', text: 'KILIÇ VE ŞEREF\nSon Samuray', font: 'Cinzel', color: '#fef2f2', stroke: '#991b1b', strokeW: 2, shadow: 'rgba(0,0,0,0.8)', blur: 10, spacing: 4, y: 0, anim: 'fade' },
  { name: 'Casusluk & Gizli Operasyon', text: 'KOD ADI: PANTER\nGörev Başladı', font: 'JetBrains Mono', color: '#facc15', stroke: '#000000', strokeW: 2, shadow: 'rgba(0,0,0,0.9)', blur: 10, spacing: 3, y: 0, anim: 'typewriter' },
  { name: 'Dağcılık & Zirve Macerası', text: 'Z İ R V E\n8000 Metre', font: 'Montserrat', color: '#ffffff', stroke: '#0f172a', strokeW: 2, shadow: 'rgba(0,0,0,0.8)', blur: 14, spacing: 6, y: 0, anim: 'scale-down' },
  { name: 'Biyografi & İlham Veren Yaşam', text: 'BİR ÖMRÜN İZLERİ\nİlham Veren Hikaye', font: 'Playfair Display', color: '#fde68a', stroke: '#78350f', strokeW: 1, shadow: 'rgba(0,0,0,0.7)', blur: 10, spacing: 3, y: 0, anim: 'fade' },
  { name: 'Savaş & Kahramanlık Destanı', text: 'ÇANAKKALE\nGeçilmez Destan', font: 'Anton', color: '#dc2626', stroke: '#ffffff', strokeW: 1.5, shadow: 'rgba(0,0,0,0.9)', blur: 12, spacing: 2, y: 0, anim: 'slide-up' },
  { name: 'Antik Mitoloji & Tanrılar', text: 'OLYMPOS\nTanrıların Savaşı', font: 'Cinzel', color: '#fbbf24', stroke: '#451a03', strokeW: 2, shadow: 'rgba(245, 158, 11, 0.5)', blur: 16, spacing: 4, y: 0, anim: 'tracking-in' },
  { name: 'Siberpunk Gelecek Distopyası', text: 'NEON ŞEHİR 2099\nSentetik İnsanlar', font: 'Righteous', color: '#06b6d4', stroke: '#ec4899', strokeW: 2, shadow: '#06b6d4', blur: 20, spacing: 2, y: 0, anim: 'glitch' },
  { name: 'Felsefe & Düşünce Serisi', text: 'VAROLUŞ\nAnlam Arayışı', font: 'Cormorant Garamond', color: '#e2e8f0', stroke: 'transparent', strokeW: 0, shadow: 'rgba(0,0,0,0.8)', blur: 8, spacing: 5, y: 0, anim: 'fade' },
  { name: 'Klasik Roman Uyarlaması', text: 'GURUR VE TUTKU\nUnutulmaz Aşk', font: 'Playfair Display', color: '#fef08a', stroke: '#854d0e', strokeW: 1, shadow: 'rgba(0,0,0,0.7)', blur: 10, spacing: 3, y: 0, anim: 'fade' },
  { name: 'Polisiye Mahkeme Draması', text: 'HÜKÜM GÜNÜ\nAdalet Arayışı', font: 'Oswald', color: '#ffffff', stroke: '#1e293b', strokeW: 2, shadow: 'rgba(0,0,0,0.9)', blur: 12, spacing: 2, y: 0, anim: 'slide-up' },
  { name: 'Sonsuzluk & Evren Felsefesi', text: 'ZAMANIN BAŞLANGICI\nBüyük Patlama', font: 'Montserrat', color: '#c084fc', stroke: '#581c87', strokeW: 2, shadow: 'rgba(192, 132, 252, 0.4)', blur: 16, spacing: 4, y: 0, anim: 'tracking-in' },
  { name: 'Vahşi Doğa & Aslanlar', text: 'SAVANNA\nYaşam Mücadelesi', font: 'Bebas Neue', color: '#f59e0b', stroke: '#451a03', strokeW: 2, shadow: 'rgba(0,0,0,0.8)', blur: 10, spacing: 3, y: 0, anim: 'slide-up' },
  { name: 'Kraliyet & Hanedan Hikayesi', text: 'TAHT VE TAÇ\nKraliyet Entrikaları', font: 'Cinzel', color: '#fbbf24', stroke: '#713f12', strokeW: 1.5, shadow: 'rgba(234, 179, 8, 0.4)', blur: 14, spacing: 3, y: 0, anim: 'fade' },
  { name: 'Mistik Doğu Masalları', text: 'BİN BİR GECE\nGizemli Masallar', font: 'Playfair Display', color: '#fde047', stroke: '#854d0e', strokeW: 1.5, shadow: 'rgba(0,0,0,0.8)', blur: 12, spacing: 3, y: 0, anim: 'fade' },
  { name: 'Sanayi & Fabrika Devrimi', text: 'ÇELİK VE ATEŞ\nSanayi Çağı', font: 'Archivo Black', color: '#e2e8f0', stroke: '#0f172a', strokeW: 3, shadow: 'rgba(0,0,0,0.9)', blur: 12, spacing: 2, y: 0, anim: 'slide-up' },
  { name: 'Rüya & Bilinçaltı Labirenti', text: 'HAYAL DÜNYASI\nUyanış', font: 'Montserrat', color: '#e0e7ff', stroke: '#3730a3', strokeW: 2, shadow: 'rgba(99, 102, 241, 0.5)', blur: 18, spacing: 4, y: 0, anim: 'tracking-in' },
  { name: 'Hazine Avı & Macera', text: 'KAYIP HAZİNE\nTapınağın Sırrı', font: 'Alfa Slab One', color: '#facc15', stroke: '#78350f', strokeW: 2, shadow: 'rgba(0,0,0,0.8)', blur: 12, spacing: 2, y: 0, anim: 'slide-up' },
  { name: 'Kuzey Işıkları Auroral Başlık', text: 'A U R O R A\nGökyüzü Dansı', font: 'Montserrat', color: '#2dd4bf', stroke: '#134e4a', strokeW: 2, shadow: 'rgba(45, 212, 191, 0.5)', blur: 20, spacing: 5, y: 0, anim: 'tracking-in' },
  { name: 'Yol Hikayesi & Özgürlük', text: 'AÇIK YOLLARDA\nÖzgürlüğe Doğru', font: 'Caveat', color: '#ffffff', stroke: '#000000', strokeW: 2, shadow: 'rgba(0,0,0,0.8)', blur: 10, spacing: 2, y: 0, anim: 'fade' },
  { name: 'Sessiz Sinema Başlığı', text: 'BÖLÜM I\nBÜYÜK KARŞILAŞMA', font: 'Playfair Display', color: '#f8fafc', stroke: '#000000', strokeW: 2, shadow: 'rgba(0,0,0,0.8)', blur: 8, spacing: 3, y: 0, anim: 'fade' },
  { name: 'Gölge & Işık Fotoğrafçılığı', text: 'IŞIĞIN PEŞİNDE\nSiyah Beyaz Kareler', font: 'Inter', color: '#ffffff', stroke: '#000000', strokeW: 2, shadow: 'rgba(0,0,0,0.9)', blur: 12, spacing: 4, y: 0, anim: 'tracking-in' },
  { name: 'Derin Orman Efsaneleri', text: 'KADİM ORMAN\nAğaçların Fısıltısı', font: 'Merriweather', color: '#86efac', stroke: '#14532d', strokeW: 2, shadow: 'rgba(0,0,0,0.8)', blur: 12, spacing: 3, y: 0, anim: 'fade' },
  { name: 'Şafak Vakti Sinematik Başlık', text: 'Ş A F A K\nYeni Bir Gün Doğuyor', font: 'Cinzel', color: '#fed7aa', stroke: '#9a3412', strokeW: 1.5, shadow: 'rgba(249, 115, 22, 0.4)', blur: 14, spacing: 4, y: 0, anim: 'tracking-in' },
  { name: 'Gece Göğü & Yıldız Gözlemi', text: 'SAMANYOLU\nKozmik Yolculuk', font: 'Plus Jakarta Sans', color: '#67e8f9', stroke: '#0e7490', strokeW: 2, shadow: 'rgba(6, 182, 212, 0.5)', blur: 16, spacing: 3, y: 0, anim: 'fade' },
  { name: 'Fırtına & Deniz Dalgaları', text: 'BÜYÜK FIRTINA\nDalgalara Karşı', font: 'Anton', color: '#ffffff', stroke: '#0f172a', strokeW: 3, shadow: 'rgba(0,0,0,0.9)', blur: 14, spacing: 2, y: 0, anim: 'slide-up' },
  { name: 'Zaman Kapsülü Nostalji', text: 'HATIRALAR\nGeçmişten Kalanlar', font: 'Cormorant Garamond', color: '#fde68a', stroke: '#78350f', strokeW: 1, shadow: 'rgba(0,0,0,0.7)', blur: 10, spacing: 3, y: 0, anim: 'fade' },
  { name: 'Zafer & Şampiyonluk Finali', text: 'BÜYÜK FİNAL\nKupaya Giden Yol', font: 'Montserrat', color: '#fbbf24', stroke: '#000000', strokeW: 3, shadow: 'rgba(245, 158, 11, 0.6)', blur: 16, spacing: 3, y: 0, anim: 'pop' },
];

// 3. Social Media & Viral Video Hooks (52 items)
const socialPresets = [
  { name: 'Viral TikTok Kancası (Hook)', text: 'BU VİDEOYU SAKIN GEÇME! 🔥\nHayat Kurtaran Bilgi 👇', font: 'Montserrat', color: '#a3e635', stroke: '#000000', strokeW: 6, shadow: 'rgba(0,0,0,0.95)', blur: 10, y: -280, anim: 'pop' },
  { name: '3 Kritik Hata Başlığı', text: 'HERKESİN YAPTIĞI 3 BÜYÜK HATA! ❌\n3. Madde Şok Edecek', font: 'Anton', color: '#ef4444', stroke: '#000000', strokeW: 5, shadow: 'rgba(0,0,0,0.9)', blur: 8, y: -280, anim: 'slide-up' },
  { name: 'Reels Vurgulu Sarı Başlık', text: 'BUNU BİLİYOR MUYDUNUZ? 💡\nİnanılmaz Gerçek!', font: 'Plus Jakarta Sans', color: '#facc15', stroke: '#000000', strokeW: 5, shadow: 'rgba(0,0,0,0.9)', blur: 8, y: -280, anim: 'pop' },
  { name: 'Kaydetmeyi Unutma Hatırlatıcı', text: 'KAYDETMEYİ UNUTMA! 📌\nİhtiyacın Olacak', font: 'Montserrat', color: '#38bdf8', stroke: '#000000', strokeW: 5, shadow: 'rgba(0,0,0,0.9)', blur: 8, y: 300, anim: 'slide-up' },
  { name: 'Gizli İpucu (Pro-Tip) Şeridi', text: 'PRO TAVSİYESİ ⚡\nProfesyoneller Böyle Yapıyor', font: 'Oswald', color: '#ffffff', stroke: '#000000', strokeW: 4, bg: '#7c3aed', padX: 24, padY: 10, radius: 8, y: -280, anim: 'pop' },
  { name: 'Önce vs Sonra (Before/After)', text: 'ÖNCE  vs  SONRA ✨\nDeğişime İnanamayacaksınız', font: 'Montserrat', color: '#f43f5e', stroke: '#000000', strokeW: 5, shadow: 'rgba(0,0,0,0.9)', blur: 8, y: -280, anim: 'slide-up' },
  { name: 'Günün Sözü & Motivasyon', text: '«Vazgeçmediğin her gün,\nzafere bir adım daha yakınsın.»', font: 'Caveat', color: '#ffffff', bg: 'rgba(0,0,0,0.85)', padX: 28, padY: 16, radius: 12, y: 0, anim: 'fade' },
  { name: 'Abone Ol & Bildirim Rozeti', text: 'KANALA ABONE OL! 🔔\nYeni Videoları Kaçırma', font: 'Montserrat', color: '#ffffff', bg: '#dc2626', padX: 26, padY: 12, radius: 24, y: 320, anim: 'pop' },
  { name: 'Takip Et & Beğen Çağrısı', text: 'Daha Fazlası İçin Takip Et! 👍\nBeğenmeyi Unutma', font: 'Plus Jakarta Sans', color: '#ffffff', bg: '#2563eb', padX: 24, padY: 12, radius: 20, y: 320, anim: 'pop' },
  { name: 'Yorumunu Bırak! Tartışma', text: 'SEN BU KONUDA NE DÜŞÜNÜYORSUN? 💬\nYorumlarda Buluşalım', font: 'Montserrat', color: '#facc15', stroke: '#000000', strokeW: 4, y: 300, anim: 'slide-up' },
  { name: 'Şok Edici Gerçek Vurgusu', text: 'KİMSENİN ANLATMADIĞI GERÇEK! 😱\nDikkatle Dinleyin', font: 'Anton', color: '#f43f5e', stroke: '#000000', strokeW: 6, shadow: 'rgba(0,0,0,0.9)', blur: 10, y: -280, anim: 'glitch' },
  { name: 'En İyi 5 Taktik Başlığı', text: 'HAYATINIZI DEĞİŞTİRECEK 5 ALIŞKANLIK 🎯\n1. Madde ile Başla', font: 'Montserrat', color: '#34d399', stroke: '#000000', strokeW: 5, y: -280, anim: 'slide-up' },
  { name: 'Kısa Vlog Günlüğü Etiketi', text: 'BENİMLE BİR GÜN ✨\nSabah Rutini & Çekim', font: 'Plus Jakarta Sans', color: '#ffffff', bg: 'rgba(244, 63, 94, 0.9)', padX: 24, padY: 10, radius: 14, y: -300, anim: 'pop' },
  { name: 'Podcast Kısa Kesit (Shorts)', text: 'PODCAST KESİTİ 🎙️\n«Başarı Tesadüf Değildir»', font: 'Oswald', color: '#fbbf24', stroke: '#000000', strokeW: 4, bg: 'rgba(0,0,0,0.85)', padX: 22, padY: 10, radius: 6, y: -280, anim: 'slide-up' },
  { name: 'Soru & Cevap Başlığı (Q&A)', text: 'TAKİPÇİ SORULARI ❓\nMerak Edilenleri Cevapladım', font: 'Montserrat', color: '#ffffff', bg: '#4f46e5', padX: 24, padY: 12, radius: 16, y: -280, anim: 'pop' },
  { name: 'Reels Neon Limon Vurgusu', text: 'BU DETAYI KİMSE BİLMİYOR! ⚡\nMutlaka İzleyin', font: 'Montserrat', color: '#a3e635', stroke: '#000000', strokeW: 5, y: -280, anim: 'pop' },
  { name: 'Adım Adım Tarif & Rehber', text: '3 DAKİKADA KOLAY TARİF 🍳\nMalzemeler Açıklamada', font: 'Plus Jakarta Sans', color: '#ffffff', bg: '#ea580c', padX: 24, padY: 12, radius: 8, y: -280, anim: 'slide-up' },
  { name: 'Story & Hikaye Vurgu Başlığı', text: 'GÜNÜN ÖZETİ 📸\nSürpriz Gelişme!', font: 'Montserrat', color: '#ec4899', stroke: '#000000', strokeW: 4, y: -300, anim: 'pop' },
  { name: 'Gamer Vurgu & Zafer Anı', text: 'İMKANSIZ VURUŞ! 🎮\n1v4 Clutch Anı', font: 'Righteous', color: '#38bdf8', stroke: '#000000', strokeW: 5, shadow: '#06b6d4', blur: 16, y: -280, anim: 'glitch' },
  { name: 'Mizah & Komik Vurgu Başlığı', text: 'BENİM DURUMUN ÖZETİ 😂\nBunu Yaşayan Tek Ben Miyim?', font: 'Comic Sans MS', color: '#facc15', stroke: '#000000', strokeW: 4, y: -280, anim: 'pop' },
  { name: 'Teknoloji Karşılaştırma', text: 'iPHONE vs SAMSUNG 📱\nHangisi Daha İyi?', font: 'Oswald', color: '#ffffff', stroke: '#000000', strokeW: 4, bg: '#0284c7', padX: 24, padY: 10, radius: 8, y: -280, anim: 'slide-up' },
  { name: 'Seyahat Tavsiyesi Başlığı', text: 'TÜRKİYE\'DE GÖRMENİZ GEREKEN 3 YER 🌍\nSaklı Cennetler', font: 'Montserrat', color: '#ffffff', bg: '#059669', padX: 24, padY: 12, radius: 10, y: -280, anim: 'slide-up' },
  { name: 'Fitness & Egzersiz Rutini', text: 'KARIN KASI İÇİN 3 HAREKET 💪\nGünde 10 Dakika', font: 'Anton', color: '#f59e0b', stroke: '#000000', strokeW: 5, y: -280, anim: 'pop' },
  { name: 'Kitap Önerisi & Alıntı Kartı', text: 'HAYATIMI DEĞİŞTİREN KİTAP 📚\nMutlaka Okumalısın', font: 'Playfair Display', color: '#ffffff', bg: 'rgba(30, 41, 59, 0.9)', padX: 24, padY: 12, radius: 8, y: -280, anim: 'fade' },
  { name: 'İngilizce Pratik & Kelime', text: 'GÜNLÜK İNGİLİZCE KALIPLAR 🇬🇧\nBunu Mutlaka Öğren!', font: 'Plus Jakarta Sans', color: '#ffffff', bg: '#dc2626', padX: 24, padY: 12, radius: 12, y: -280, anim: 'pop' },
  { name: 'Yatırım & Kripto Dikkat', text: 'DİKKAT! PİYASADA BÜYÜK HAREKET 📈\nRisk Uyarısı', font: 'JetBrains Mono', color: '#34d399', bg: 'rgba(6, 78, 59, 0.95)', padX: 24, padY: 10, radius: 4, y: -280, anim: 'typewriter' },
  { name: 'Sınav & YKS Tavsiyesi', text: 'SON 3 AYDA NETLERİNİ KATLA 🎓\nTaktik Rehberi', font: 'Montserrat', color: '#38bdf8', stroke: '#000000', strokeW: 4, y: -280, anim: 'pop' },
  { name: 'Kutu Açılımı (Unboxing)', text: 'KUTU AÇILIMI & İLK BAKIŞ 📦\nBeklentileri Karşıladı mı?', font: 'Montserrat', color: '#ffffff', bg: '#d97706', padX: 24, padY: 12, radius: 8, y: -280, anim: 'slide-up' },
  { name: 'Canlı Yayın Hatırlatması', text: 'BU AKŞAM 21:00\'DE CANLI YAYIN 🔴\nKonu: Geleceğin Teknolojileri', font: 'Oswald', color: '#ffffff', bg: '#dc2626', padX: 26, padY: 12, radius: 4, y: 300, anim: 'pop' },
  { name: 'Topluluk Anketi Başlığı', text: 'SİZCE HANGİSİ DAHA ÖNEMLİ? 📊\nOylama Başladı', font: 'Plus Jakarta Sans', color: '#ffffff', bg: '#7c3aed', padX: 24, padY: 12, radius: 14, y: -280, anim: 'pop' },
  { name: 'Zaman Yönetimi İpucu', text: 'GÜNÜNÜ 2 KAT VERİMLİ YAP ⏰\nPomodoro Tekniği', font: 'Inter', color: '#ffffff', bg: '#0d9488', padX: 24, padY: 12, radius: 8, y: -280, anim: 'slide-up' },
  { name: 'Yazılımcı Mizahı & Kod', text: 'KOD İLK SEFERDE ÇALIŞINCA 💻\nYazılımcıların Gözü Yaşlı', font: 'JetBrains Mono', color: '#6ee7b7', stroke: '#000000', strokeW: 3, y: -280, anim: 'glitch' },
  { name: 'İlginç Tarih Bilgisi', text: 'TARİHİN EN TUHAF OLAYI 📜\nİnanması Güç Gerçekler', font: 'Merriweather', color: '#fde047', stroke: '#000000', strokeW: 3, y: -280, anim: 'slide-up' },
  { name: 'Cilt Bakımı & Güzellik', text: 'CAM GİBİ BİR CİLT İÇİN 3 ADIM ✨\nDoğal Bakım Rutini', font: 'Playfair Display', color: '#ffffff', bg: 'rgba(244, 63, 94, 0.85)', padX: 24, padY: 12, radius: 16, y: -280, anim: 'fade' },
  { name: 'Bütçe & Para Biriktirme', text: 'AYDA 5000 TL NASIL BİRİKİR? 💰\nBasit Tasarruf Planı', font: 'Montserrat', color: '#34d399', stroke: '#000000', strokeW: 5, y: -280, anim: 'pop' },
  { name: 'Tasarımcı Tavsiyesi', text: 'GRAFİK TASARIMDA ALTIN ORAN 🎨\nTasarımlarını Güzelleştir', font: 'Plus Jakarta Sans', color: '#c084fc', stroke: '#000000', strokeW: 4, y: -280, anim: 'pop' },
  { name: 'Yapay Zeka Prompt Taktiği', text: 'CHATGPT İÇİN MÜKEMMEL PROMPT 🤖\nKopyalayıp Yapıştır', font: 'JetBrains Mono', color: '#38bdf8', bg: 'rgba(15, 23, 42, 0.95)', padX: 24, padY: 12, radius: 6, y: -280, anim: 'typewriter' },
  { name: 'Evde Kolay Kahve Yapımı', text: 'KAFE KALİTESİNDE KAHVE ☕\nEvde 2 Dakikada Yap', font: 'Caveat', color: '#fed7aa', stroke: '#78350f', strokeW: 2, y: -280, anim: 'pop' },
  { name: 'Doğru Bilinen Yanlışlar', text: 'DOĞRU BİLDİĞİNİZ 5 BÜYÜK YANLIŞ ❌\nBilim Ne Diyor?', font: 'Anton', color: '#f43f5e', stroke: '#ffffff', strokeW: 2, y: -280, anim: 'pop' },
  { name: 'Girişimcilik İlhamı', text: 'SIFIRDAN MİLYONER OLANLAR 🚀\nBaşarının Sırrı Ne?', font: 'Montserrat', color: '#fbbf24', stroke: '#000000', strokeW: 4, y: -280, anim: 'slide-up' },
  { name: 'Diksiyon & Konuşma Sanatı', text: 'ETKİLEYİCİ KONUŞMANIN 3 KURALI 🗣️\nDiksiyon Egzersizi', font: 'Plus Jakarta Sans', color: '#ffffff', bg: '#0284c7', padX: 24, padY: 12, radius: 8, y: -280, anim: 'slide-up' },
  { name: 'Mini İnceleme Başlığı', text: '1 DAKİKADA FİLM İNCELEMESİ 🎬\nİzlemeye Değer mi?', font: 'Oswald', color: '#ffffff', bg: '#b91c1c', padX: 24, padY: 10, radius: 6, y: -280, anim: 'pop' },
  { name: 'Doğal Yaşam & Köy Hayatı', text: 'ŞEHİRDEN KÖYE GÖÇ ETTİK 🌿\nİlk 6 Ay Neler Yaşadık?', font: 'Caveat', color: '#bbf7d0', stroke: '#14532d', strokeW: 2, y: -280, anim: 'fade' },
  { name: 'Soru İşareti Merak Kancası', text: 'BUNUN CEVABINI BİLEN VAR MI? ❓\nYorumlara Yazın', font: 'Montserrat', color: '#facc15', stroke: '#000000', strokeW: 5, y: -280, anim: 'pop' },
  { name: 'Günün Sorusu Etiketi', text: 'GÜNÜN SORUSU 🎯\nDoğru Bilenleri Sabitliyorum', font: 'Plus Jakarta Sans', color: '#ffffff', bg: '#7c3aed', padX: 24, padY: 12, radius: 20, y: -280, anim: 'pop' },
  { name: 'Haftalık Favoriler Listesi', text: 'BU HAFTANIN EN İYİLERİ ⭐\nMutlaka İnceleyin', font: 'Montserrat', color: '#ffffff', bg: '#059669', padX: 24, padY: 10, radius: 8, y: -280, anim: 'slide-up' },
  { name: 'İndirim & Fırsat Alarmı', text: 'FIRSAT ALARMI! 🚨\nFiyatı Yarı Yarıya Düştü', font: 'Anton', color: '#ef4444', stroke: '#ffffff', strokeW: 2, y: -280, anim: 'pop' },
  { name: 'Hızlı Özet Kartı', text: 'ÖZETLEME 📝\n30 Saniyede Her Şey', font: 'Inter', color: '#ffffff', bg: 'rgba(15, 23, 42, 0.9)', padX: 22, padY: 10, radius: 6, y: -280, anim: 'slide-up' },
  { name: 'Psikolojik Gerçekler', text: 'İNSAN BEYNİNİN 3 TUHAF TEPKİSİ 🧠\nPsikoloji Ne Diyor?', font: 'Montserrat', color: '#e0e7ff', stroke: '#312e81', strokeW: 3, y: -280, anim: 'pop' },
  { name: 'Günün Kazananı Tebrik', text: 'HAFTANIN KAZANANI AÇIKLANDI! 🎉\nTebrik Ederiz!', font: 'Montserrat', color: '#facc15', stroke: '#000000', strokeW: 4, y: 0, anim: 'pop' },
  { name: 'Teşekkür & Veda Kartı', text: 'İZLEDİĞİNİZ İÇİN TEŞEKKÜRLER ❤️\nBir Sonraki Videoda Görüşmek Üzere', font: 'Plus Jakarta Sans', color: '#ffffff', bg: 'rgba(0,0,0,0.85)', padX: 28, padY: 14, radius: 12, y: 0, anim: 'fade' },
  { name: 'Son Çağrı & Kapanış', text: 'KANALA DESTEK OLMAK İÇİN 🌟\nKatıl Butonuna Tıklayın', font: 'Montserrat', color: '#38bdf8', stroke: '#000000', strokeW: 4, y: 320, anim: 'slide-up' }
];

// 4. Promo & Commercial Banners (31 items)
const promoPresets = [
  { name: 'Büyük İndirim Flaş Şeriti', text: '%50 BÜYÜK SEZON İNDİRİMİ\nTüm Ürünlerde Geçerli!', font: 'Anton', color: '#ffffff', bg: '#dc2626', padX: 30, padY: 14, radius: 0, y: -340, anim: 'slide-up' },
  { name: 'Bitiş Teşekkür & Sosyal Medya', text: 'BİZİ TAKİP EDİN\n@forma.video // www.forma.app', font: 'Plus Jakarta Sans', color: '#ffffff', bg: 'rgba(15, 23, 42, 0.9)', padX: 28, padY: 14, radius: 8, y: 0, anim: 'fade' },
  { name: 'Yeni Ürün Lansmanı Başlığı', text: 'YENİ NESİL PERFORMANS\nŞimdi Satışta!', font: 'Montserrat', color: '#38bdf8', stroke: '#000000', strokeW: 3, y: 0, anim: 'pop' },
  { name: 'Konum & Şehir Etiketi', text: 'İSTANBUL, TÜRKİYE\nBoğaziçi Köprüsü Manzarası', font: 'Plus Jakarta Sans', color: '#ffffff', bg: 'rgba(0, 0, 0, 0.75)', padX: 22, padY: 10, radius: 6, y: -320, anim: 'slide-up' },
  { name: 'Tarih & Saat Damgası', text: '24 EKİM 2026 // 14:30\nCanlı Yayın Kaydı', font: 'JetBrains Mono', color: '#facc15', bg: 'rgba(15, 23, 42, 0.9)', padX: 20, padY: 10, radius: 4, y: -330, anim: 'typewriter' },
  { name: 'Modern Altyazı Kutusu', text: 'Gelişmiş Türkçe Karakter Desteği:\nÇ, Ğ, İ, Ö, Ş, Ü Uyumlu', font: 'Plus Jakarta Sans', color: '#facc15', stroke: '#000000', strokeW: 4, bg: 'rgba(0,0,0,0.85)', padX: 24, padY: 12, radius: 6, y: 320, anim: 'pop' },
  { name: 'Kara Cuma (Black Friday) İndirimi', text: 'EFSANE CUMA FIRSATLARI 🔥\nSepette Ekstra %30 İndirim', font: 'Bebas Neue', color: '#facc15', bg: '#000000', padX: 28, padY: 12, radius: 4, y: -340, anim: 'slide-up' },
  { name: 'Ücretsiz Kargo Bannerı', text: '150 TL VE ÜZERİ TÜM SİPARİŞLERDE\nÜCRETSİZ AYNI GÜN KARGO 🚚', font: 'Montserrat', color: '#ffffff', bg: '#059669', padX: 26, padY: 12, radius: 6, y: -340, anim: 'slide-up' },
  { name: 'Sınırlı Süre Sayaç Başlığı', text: 'SON 24 SAAT! SÜRE DOLUYOR ⏳\nFırsatı Kaçırma', font: 'Oswald', color: '#ffffff', bg: '#ea580c', padX: 28, padY: 12, radius: 4, y: -340, anim: 'pop' },
  { name: 'Yıl Sonu Büyük Kampanyası', text: 'YIL SONU TEMİZLİK FIRSATI\nStoklarla Sınırlı', font: 'Anton', color: '#ffffff', bg: '#7c3aed', padX: 28, padY: 12, radius: 8, y: -340, anim: 'slide-up' },
  { name: 'Müşteri Yorumu & Alıntı', text: '«Hayatımda kullandığım en hızlı kurgu programı!»\n— Mert K. (Video Prodüktörü)', font: 'Playfair Display', color: '#ffffff', bg: 'rgba(15, 23, 42, 0.9)', padX: 26, padY: 14, radius: 8, y: 0, anim: 'fade' },
  { name: '1 Alana 1 Bedava Kampanyası', text: '1 ALANA 1 BEDAVA! 🎁\nSeçili Ürünlerde', font: 'Bebas Neue', color: '#facc15', stroke: '#000000', strokeW: 4, y: 0, anim: 'pop' },
  { name: 'Mobil Uygulama İndir Butonu', text: 'ŞİMDİ APP STORE & GOOGLE PLAY\'DE\nÜcretsiz İndirin', font: 'Plus Jakarta Sans', color: '#ffffff', bg: '#1e293b', padX: 24, padY: 12, radius: 14, y: 320, anim: 'slide-up' },
  { name: 'Web Sitesi Ziyaret Çağrısı', text: 'DETAYLI BİLGİ İÇİN:\nwww.forma.video/kesfet', font: 'JetBrains Mono', color: '#38bdf8', bg: 'rgba(15, 23, 42, 0.95)', padX: 24, padY: 10, radius: 4, y: 320, anim: 'typewriter' },
  { name: 'Garantili Orijinal Ürün Rozeti', text: '2 YIL RESMİ DİSTRİBÜTÖR GARANTİSİ\n%100 Orijinal Ürün', font: 'Montserrat', color: '#ffffff', bg: '#0284c7', padX: 24, padY: 10, radius: 6, y: -330, anim: 'slide-up' },
  { name: 'Yeni Sezon Koleksiyonu', text: 'SONBAHAR / KIŞ 2026\nYeni Sezon Mağazalarda', font: 'Playfair Display', color: '#fde68a', stroke: '#451a03', strokeW: 1.5, y: 0, anim: 'tracking-in' },
  { name: 'Yıldızlı Ürün Tavsiyesi', text: 'EDİTÖRÜN SEÇİMİ ⭐⭐⭐⭐⭐\nAyın En Çok Satanı', font: 'Montserrat', color: '#facc15', bg: 'rgba(0,0,0,0.85)', padX: 24, padY: 12, radius: 8, y: -300, anim: 'pop' },
  { name: 'Taksit Fırsatı Bannerı', text: 'PEŞİN FİYATINA 6 TAKSİT İMKANI\nTüm Kredi Kartlarına', font: 'Roboto', color: '#ffffff', bg: '#475569', padX: 24, padY: 10, radius: 4, y: 320, anim: 'slide-up' },
  { name: 'İade & Değişim Güvencesi', text: '14 GÜN KOŞULSUZ İADE GÜVENCESİ\nKolay Değişim', font: 'Inter', color: '#ffffff', bg: '#059669', padX: 22, padY: 10, radius: 6, y: 320, anim: 'fade' },
  { name: 'Canlı Destek Hattı', text: '7/24 CANLI DESTEK & DANIŞMA\n0850 000 00 00', font: 'Plus Jakarta Sans', color: '#38bdf8', bg: 'rgba(15, 23, 42, 0.95)', padX: 22, padY: 10, radius: 4, y: 320, anim: 'slide-up' },
  { name: 'Erken Kayıt İndirimi', text: 'ERKEN KAYITTA %30 AVANTAJ\nKontenjanlar Dolmadan!', font: 'Montserrat', color: '#ffffff', bg: '#b91c1c', padX: 26, padY: 12, radius: 6, y: -320, anim: 'pop' },
  { name: 'Ödüllü Yarışma Duyurusu', text: 'BÜYÜK YARIŞMA BAŞLADI! 🏆\nToplam 100.000 TL Ödül', font: 'Anton', color: '#facc15', stroke: '#000000', strokeW: 4, y: 0, anim: 'pop' },
  { name: 'Açılışa Özel Fırsatlar', text: 'YENİ ŞUBEMİZ AÇILDI!\nAçılışa Özel Sürprizler', font: 'Montserrat', color: '#ffffff', bg: '#d97706', padX: 24, padY: 12, radius: 8, y: 0, anim: 'slide-up' },
  { name: 'VIP Üyelik Ayrıcalığı', text: 'VIP KULÜP AYRICALIKLARI\nÖzel İndirim ve Hediyeler', font: 'Cinzel', color: '#fbbf24', bg: 'rgba(15, 23, 42, 0.95)', padX: 26, padY: 12, radius: 6, y: 0, anim: 'fade' },
  { name: 'Öğrenciye Özel İndirim', text: 'ÖĞRENCİLERE EKSTRA %20 İNDİRİM\nÖğrenci Belgenizle Başvurun', font: 'Plus Jakarta Sans', color: '#ffffff', bg: '#2563eb', padX: 24, padY: 12, radius: 8, y: 320, anim: 'pop' },
  { name: 'Haftanın Ürünü İncelemesi', text: 'HAFTANIN YILDIZ ÜRÜNÜ\nFiyat / Performans Şampiyonu', font: 'Oswald', color: '#a3e635', stroke: '#000000', strokeW: 3, y: -300, anim: 'slide-up' },
  { name: 'Festival & Etkinlik Takvimi', text: 'YAZ FESTİVALİ 2026\n15-18 Temmuz // Antalya', font: 'Montserrat', color: '#ffffff', bg: '#db2777', padX: 26, padY: 12, radius: 10, y: 0, anim: 'pop' },
  { name: 'Online Randevu Butonu', text: 'ONLİNE RANDEVU ALIN\nİlk Muayene Ücretsiz', font: 'Inter', color: '#ffffff', bg: '#0d9488', padX: 22, padY: 10, radius: 6, y: 320, anim: 'slide-up' },
  { name: 'QR Kod ile Kolay Sipariş', text: 'QR KODU OKUTUN\nMenüyü Hemen İnceleyin', font: 'Plus Jakarta Sans', color: '#ffffff', bg: 'rgba(0,0,0,0.85)', padX: 24, padY: 10, radius: 8, y: 320, anim: 'fade' },
  { name: 'Son Çağrı İndirim Kapanışı', text: 'KAMPANYA BU GECE BİTİYOR!\nAcele Edin', font: 'Anton', color: '#ffffff', bg: '#dc2626', padX: 28, padY: 12, radius: 0, y: -340, anim: 'pop' },
  { name: 'Teşekkür ve İletişim Bandı', text: 'BİZE ULAŞIN // info@forma.video\nBizi Tercih Ettiğiniz İçin Teşekkürler', font: 'Inter', color: '#cbd5e1', bg: 'rgba(15, 23, 42, 0.9)', padX: 24, padY: 10, radius: 4, y: 320, anim: 'fade' },
];

// 5. News & Broadcast (25 items)
const newsPresets = [
  { name: 'SON DAKİKA // Flaş Bülten', text: 'SON DAKİKA // FLAŞ HABER\nCumhurbaşkanlığı Külliyesi Açıklaması', font: 'Oswald', color: '#ffffff', bg: '#dc2626', padX: 28, padY: 14, radius: 0, y: 320, anim: 'slide-up' },
  { name: 'CANLI YAYIN // Sıcak Gelişme', text: 'CANLI YAYIN // MECLİS ÖZEL\nBütçe Görüşmeleri Başladı', font: 'Oswald', color: '#ffffff', bg: '#b91c1c', padX: 28, padY: 14, radius: 0, y: 320, anim: 'slide-up' },
  { name: 'Ekonomi & Piyasalar Şeridi', text: 'PİYASALARDA SON DURUM\nBIST 100 Endeksi Rekor Tazeledi', font: 'Roboto', color: '#ffffff', bg: 'rgba(15, 23, 42, 0.95)', padX: 26, padY: 12, radius: 0, y: 320, anim: 'slide-up' },
  { name: 'Hava Durumu & Meteoroloji Uyarısı', text: 'METEOROLOJİDEN SARI UYARI\nMarmara Bölgesinde Şiddetli Fırtına', font: 'Montserrat', color: '#ffffff', bg: '#d97706', padX: 26, padY: 12, radius: 0, y: 320, anim: 'slide-up' },
  { name: 'Özel Dosya & Araştırmacı Haber', text: 'ÖZEL HABER // DERİN DOSYA\nTarihi Eser Kaçakçılığı Operasyonu', font: 'Oswald', color: '#facc15', bg: 'rgba(24, 24, 27, 0.95)', padX: 26, padY: 12, radius: 0, y: 320, anim: 'slide-up' },
  { name: 'Spor Bülteni & Maç Sonucu', text: 'SÜPER LİG // MAÇ SONUCU\nGalatasaray 3 - 1 Beşiktaş', font: 'Oswald', color: '#ffffff', bg: '#047857', padX: 28, padY: 14, radius: 0, y: 320, anim: 'slide-up' },
  { name: 'Sağlık Bülteni Bilgilendirme', text: 'SAĞLIK HABERLERİ // UZMAN GÖRÜŞÜ\nGrip Mevsiminde Bağışıklık Kılavuzu', font: 'Roboto', color: '#ffffff', bg: '#0284c7', padX: 26, padY: 12, radius: 0, y: 320, anim: 'slide-up' },
  { name: 'Teknoloji Dünyası Bülteni', text: 'TEKNOLOJİ GÜNDEMİ\nYeni Nesil Kuantum İşlemci Tanıtıldı', font: 'JetBrains Mono', color: '#38bdf8', bg: 'rgba(15, 23, 42, 0.95)', padX: 24, padY: 10, radius: 0, y: 320, anim: 'typewriter' },
  { name: 'Kültür & Sanat Festivali', text: 'İSTANBUL FİLM FESTİVALİ\nAltın Lale Ödülleri Sahiplerini Buldu', font: 'Playfair Display', color: '#fde047', bg: 'rgba(24, 24, 27, 0.95)', padX: 26, padY: 12, radius: 0, y: 320, anim: 'fade' },
  { name: 'Dünya Gündemi & Dış Haberler', text: 'DÜNYA GÜNDEMİ // DIŞ HABERLER\nBirleşmiş Milletler Zirvesi Toplandı', font: 'Oswald', color: '#ffffff', bg: '#1e3a8a', padX: 28, padY: 12, radius: 0, y: 320, anim: 'slide-up' },
  { name: 'Deprem & Acil Durum Bülteni', text: 'AFAD SON DAKİKA AÇIKLAMASI\nEge Denizi\'nde 4.8 Büyüklüğünde Deprem', font: 'Anton', color: '#ffffff', bg: '#991b1b', padX: 30, padY: 14, radius: 0, y: 320, anim: 'pop' },
  { name: 'Trafik & Yol Durumu Şeridi', text: 'İSTANBUL TRAFİK DURUMU\n15 Temmuz Köprüsü Yoğunluk %65', font: 'Roboto', color: '#facc15', bg: 'rgba(15, 23, 42, 0.95)', padX: 26, padY: 12, radius: 0, y: 320, anim: 'slide-up' },
  { name: 'Seçim Özel & Sandık Sonuçları', text: 'SEÇİM 2026 // İLK SONUÇLAR\nAçılan Sandık Oranı: %82.4', font: 'Oswald', color: '#ffffff', bg: '#7c2d12', padX: 28, padY: 14, radius: 0, y: 320, anim: 'slide-up' },
  { name: 'Basın Toplantısı Canlı Yayın', text: 'CANLI BAĞLANTI // ANKARA\nBakanlar Kurulu Toplantısı Sona Erdi', font: 'Oswald', color: '#ffffff', bg: '#b91c1c', padX: 28, padY: 12, radius: 0, y: 320, anim: 'slide-up' },
  { name: 'Günün Manşetleri Özeti', text: 'GAZETE MANŞETLERİNDE BUGÜN\nÖne Çıkan Gündem Başlıkları', font: 'Oswald', color: '#ffffff', bg: '#334155', padX: 26, padY: 12, radius: 0, y: 320, anim: 'slide-up' },
  { name: 'Eğitim & Sınav Takvimi', text: 'ÖSYM DUYURUSU\n2026 Sınav Başvuru Tarihleri Açıklandı', font: 'Inter', color: '#ffffff', bg: '#0369a1', padX: 26, padY: 12, radius: 0, y: 320, anim: 'slide-up' },
  { name: 'Asayiş & Güvenlik Raporu', text: 'EMNİYET GENEL MÜDÜRLÜĞÜ\n81 İlde Eş Zamanlı Siber Denetim', font: 'Oswald', color: '#ffffff', bg: '#0f172a', padX: 26, padY: 12, radius: 0, y: 320, anim: 'slide-up' },
  { name: 'Turizm & Tatil Sezonu', text: 'TURİZMDE REKOR SEZON\nYabancı Turist Sayısı %18 Arttı', font: 'Montserrat', color: '#ffffff', bg: '#0d9488', padX: 26, padY: 12, radius: 0, y: 320, anim: 'slide-up' },
  { name: 'Çevre & İklim Değişikliği', text: 'İKLİM RAPORU // BİLİM KURULU\nKuraklık Tehdidine Karşı Önlemler', font: 'Inter', color: '#bbf7d0', bg: '#14532d', padX: 26, padY: 12, radius: 0, y: 320, anim: 'fade' },
  { name: 'Otomotiv & Sanayi Bülteni', text: 'YERLİ OTOMOTİV SANAYİSİ\nBatarya Fabrikası Temeli Atıldı', font: 'Oswald', color: '#ffffff', bg: '#1e293b', padX: 26, padY: 12, radius: 0, y: 320, anim: 'slide-up' },
  { name: 'Uzay & Bilim Keşifleri', text: 'TÜBİTAK UZAY ENSTİTÜSÜ\nYeni Gözlem Uydusu Yörüngeye Yerleşti', font: 'JetBrains Mono', color: '#67e8f9', bg: 'rgba(15, 23, 42, 0.95)', padX: 24, padY: 10, radius: 0, y: 320, anim: 'typewriter' },
  { name: 'Tarım & Çiftçi Destekleri', text: 'TARIM VE ORMAN BAKANLIĞI\nÇiftçiye Mazot ve Gübre Desteği', font: 'Roboto', color: '#facc15', bg: '#166534', padX: 26, padY: 12, radius: 0, y: 320, anim: 'slide-up' },
  { name: 'Gençlik & Spor Zirvesi', text: 'MİLLİ SPORCUMUZDAN ALTIN MADALYA\nAvrupa Şampiyonası Zaferi', font: 'Oswald', color: '#fbbf24', bg: '#991b1b', padX: 28, padY: 14, radius: 0, y: 320, anim: 'pop' },
  { name: 'Hukuk & Yargı Gündemi', text: 'ADALET BAKANLIĞI AÇIKLAMASI\nYeni Yargı Reform Paketi Mecliste', font: 'Cinzel', color: '#ffffff', bg: 'rgba(15, 23, 42, 0.95)', padX: 26, padY: 12, radius: 0, y: 320, anim: 'slide-up' },
  { name: 'Bülten Kapanış & Yayın Künyesi', text: 'GÜN SONU BÜLTENİ SONA ERDİ\nYayın Sorumlusu: Melih Can // FORMA TV', font: 'Oswald', color: '#94a3b8', bg: '#0f172a', padX: 26, padY: 12, radius: 0, y: 320, anim: 'fade' },
];

// 6. Minimalist & Clean Typography (25 items)
const minimalPresets = [
  { name: 'Sade & Zarif Beyaz İsimlik', text: 'Zeynep Kaya\nYönetmen & Yazar', font: 'Plus Jakarta Sans', color: '#ffffff', stroke: 'transparent', strokeW: 0, y: 0, anim: 'fade' },
  { name: 'Minimal Çizgili Başlık', text: 'M İ N İ M A L\nAz Çoktur', font: 'Inter', color: '#f8fafc', stroke: 'transparent', strokeW: 0, y: 0, anim: 'tracking-in' },
  { name: 'Modern Mimari Yazısı', text: 'MEKAN VE BOŞLUK\nForm Takip Eder', font: 'Montserrat', color: '#e2e8f0', stroke: 'transparent', strokeW: 0, y: 0, anim: 'fade' },
  { name: 'Sanat Galerisi Küratörlüğü', text: 'SERGİ: BEYAZ GÖLGE\nKüratör: Aslı Tunç', font: 'Playfair Display', color: '#f1f5f9', stroke: 'transparent', strokeW: 0, y: 0, anim: 'fade' },
  { name: 'Kitap Kapağı Sadeliği', text: 'BİR GÜNÜN ANATOMİSİ\nRoman', font: 'Cormorant Garamond', color: '#fef08a', stroke: 'transparent', strokeW: 0, y: 0, anim: 'fade' },
  { name: 'Koleksiyon Tanıtım Yazısı', text: 'NO: 07 // TEMİZ DOKU\nPamuk ve İpek', font: 'Inter', color: '#cbd5e1', stroke: 'transparent', strokeW: 0, y: 0, anim: 'tracking-in' },
  { name: 'Tasarım Ofisi İmzası', text: 'ATÖLYE FORMA\nİstanbul // 2026', font: 'Plus Jakarta Sans', color: '#94a3b8', stroke: 'transparent', strokeW: 0, y: 0, anim: 'fade' },
  { name: 'Fotoğraf Serisi Başlığı', text: 'IŞIK VE GÖLGE\nAnalog Arşiv', font: 'Montserrat', color: '#ffffff', stroke: 'transparent', strokeW: 0, y: 0, anim: 'fade' },
  { name: 'Masaüstü Not Kartı', text: '«Basitlik, en üst düzey gelişmişliktir.»\n— Leonardo da Vinci', font: 'Inter', color: '#e2e8f0', stroke: 'transparent', strokeW: 0, y: 0, anim: 'fade' },
  { name: 'İskandinav Yaşam Tarzı', text: 'H Y G G E\nHuzurlu Anlar', font: 'Plus Jakarta Sans', color: '#f8fafc', stroke: 'transparent', strokeW: 0, y: 0, anim: 'tracking-in' },
  { name: 'Modern Kahve Kültürü', text: 'KAHVE ATÖLYESİ\nTek Kökenli Çekirdekler', font: 'Oswald', color: '#fed7aa', stroke: 'transparent', strokeW: 0, y: 0, anim: 'fade' },
  { name: 'Doğal Malzeme & Zanaat', text: 'KADİM ZANAAT\nAhşap ve Taş', font: 'Cinzel', color: '#ffffff', stroke: 'transparent', strokeW: 0, y: 0, anim: 'fade' },
  { name: 'Zaman Damgası Minimal', text: 'BÖLÜM 01\nBAŞLANGIÇ NOKTASI', font: 'JetBrains Mono', color: '#38bdf8', stroke: 'transparent', strokeW: 0, y: 0, anim: 'typewriter' },
  { name: 'Tek Renk Kontrast Başlık', text: 'SİYAH VE BEYAZ\nSaf Işık', font: 'Anton', color: '#ffffff', stroke: 'transparent', strokeW: 0, y: 0, anim: 'slide-up' },
  { name: 'Zarif Şiir Dizesi', text: '«Gökyüzü gibi bir şey bu çocukluk,\nhiçbir yere gitmiyor.»', font: 'Lora', color: '#fef08a', stroke: 'transparent', strokeW: 0, y: 0, anim: 'fade' },
  { name: 'Akustik Dinleti Başlığı', text: 'AKUSTİK CANLI SEANS\nPiyano ve Çello', font: 'Playfair Display', color: '#ffffff', stroke: 'transparent', strokeW: 0, y: 0, anim: 'fade' },
  { name: 'Stüdyo Çekim Künyesi', text: 'STÜDYO 42 // İSTANBUL\nModa Çekimi', font: 'Inter', color: '#94a3b8', stroke: 'transparent', strokeW: 0, y: 0, anim: 'fade' },
  { name: 'Tipografik Numara Ayracı', text: '0 1\nGİRİŞ VE KAVRAMLAR', font: 'Bebas Neue', color: '#ffffff', stroke: 'transparent', strokeW: 0, y: 0, anim: 'slide-up' },
  { name: 'Düşünce Notu Yazısı', text: '«Kendini bil.»\nAntik Bilgelik', font: 'Cinzel', color: '#e2e8f0', stroke: 'transparent', strokeW: 0, y: 0, anim: 'fade' },
  { name: 'Şehir Portresi Başlığı', text: 'BİR ŞEHRİN RUHU\nSessiz Sokaklar', font: 'Montserrat', color: '#f8fafc', stroke: 'transparent', strokeW: 0, y: 0, anim: 'fade' },
  { name: 'Yol Günlüğü Başlığı', text: 'Y O L D A\n450 Kilometre', font: 'Inter', color: '#ffffff', stroke: 'transparent', strokeW: 0, y: 0, anim: 'tracking-in' },
  { name: 'Minimalist Altyazı Kutusu', text: 'Konuşmacı Sözleri // Altyazı', font: 'Plus Jakarta Sans', color: '#ffffff', bg: 'rgba(0,0,0,0.65)', padX: 18, padY: 8, radius: 4, y: 320, anim: 'fade' },
  { name: 'Kurumsal Şık İmza', text: 'FORMA STUDIOS\nwww.forma.video', font: 'Plus Jakarta Sans', color: '#64748b', stroke: 'transparent', strokeW: 0, y: 320, anim: 'fade' },
  { name: 'Sergi Kapanış Teşekkürü', text: 'ZİYARETİNİZ İÇİN TEŞEKKÜRLER\nKatalog ve Eserler', font: 'Cormorant Garamond', color: '#ffffff', stroke: 'transparent', strokeW: 0, y: 0, anim: 'fade' },
  { name: 'Sade Son Kart', text: 'S O N\n2026', font: 'Playfair Display', color: '#94a3b8', stroke: 'transparent', strokeW: 0, y: 0, anim: 'fade' },
];

// 7. Subtitles & Captions (25 items)
const subtitlePresets = [
  { name: 'TikTok Dinamik Sarı Altyazı', text: 'Bunu yaparken sakın acele etmeyin! ⚠️', font: 'Plus Jakarta Sans', color: '#facc15', stroke: '#000000', strokeW: 5, y: 280, anim: 'pop' },
  { name: 'Reels Vurgulu Neon Limon', text: 'Çünkü en kritik adım tam olarak burası!', font: 'Montserrat', color: '#a3e635', stroke: '#000000', strokeW: 5, y: 280, anim: 'pop' },
  { name: 'Netflix Klasik Beyaz Altyazı', text: '«Bunu sana daha önce söylemeliydim.»', font: 'Roboto', color: '#ffffff', stroke: '#000000', strokeW: 3, bg: 'rgba(0,0,0,0.7)', padX: 20, padY: 8, radius: 4, y: 320, anim: 'fade' },
  { name: 'YouTube Vurgulu Koyu Kutucuk', text: 'Şimdi bu detayı daha yakından inceleyelim.', font: 'Inter', color: '#ffffff', bg: 'rgba(15, 23, 42, 0.9)', padX: 22, padY: 10, radius: 6, y: 320, anim: 'fade' },
  { name: 'Hormozi Canlı Vurgu Altyazısı', text: 'MÜŞTERİ HER ZAMAN SONUCA BAKAR!', font: 'Montserrat', color: '#38bdf8', stroke: '#000000', strokeW: 6, y: 280, anim: 'pop' },
  { name: 'Sinematik Film Altyazısı', text: '— Gözlerini kapat ve beni dinle.', font: 'Playfair Display', color: '#fef08a', stroke: '#000000', strokeW: 2, y: 330, anim: 'fade' },
  { name: 'Podcast Doğal Diyalog Altyazısı', text: 'Kesinlikle katılıyorum, bu noktayı kaçırıyoruz.', font: 'Plus Jakarta Sans', color: '#e2e8f0', bg: 'rgba(24, 24, 27, 0.85)', padX: 20, padY: 8, radius: 6, y: 320, anim: 'fade' },
  { name: 'Neon Pembe Vurgu Altyazısı', text: 'Bu anı sakın kaçırma! ✨', font: 'Plus Jakarta Sans', color: '#f43f5e', stroke: '#fda4af', strokeW: 2, y: 280, anim: 'pop' },
  { name: 'Kırmızı Uyarı Altyazı Kutusu', text: 'DİKKAT: Bu işlemi asla evde denemeyin!', font: 'Oswald', color: '#ffffff', bg: '#dc2626', padX: 22, padY: 8, radius: 4, y: 320, anim: 'pop' },
  { name: 'Yeşil Onay Altyazısı', text: 'İşte bu yöntem %100 işe yarıyor! ✅', font: 'Montserrat', color: '#34d399', stroke: '#000000', strokeW: 4, y: 280, anim: 'pop' },
  { name: 'Belgesel Açıklama Metni', text: 'Bu antik kalıntılar tam 3000 yıl öncesine dayanıyor.', font: 'Merriweather', color: '#ffffff', bg: 'rgba(0,0,0,0.8)', padX: 20, padY: 8, radius: 4, y: 330, anim: 'fade' },
  { name: 'Daktilo Harf Harf Altyazı', text: 'Sistem komutları yükleniyor...', font: 'JetBrains Mono', color: '#38bdf8', bg: 'rgba(15, 23, 42, 0.9)', padX: 20, padY: 8, radius: 4, y: 320, anim: 'typewriter' },
  { name: 'Çocuk Çizgi Dizi Altyazısı', text: 'Hop! Bak şimdi nereye zıplıyoruz! 🐰', font: 'Comic Sans MS', color: '#facc15', stroke: '#000000', strokeW: 4, y: 280, anim: 'pop' },
  { name: 'İngilizce / Türkçe Çeviri Altyazısı', text: '«Never give up on your dreams.»\n(Hayallerinden asla vazgeçme.)', font: 'Plus Jakarta Sans', color: '#ffffff', stroke: '#000000', strokeW: 3, y: 310, anim: 'fade' },
  { name: 'Haber Ticker Kayan Altyazı', text: 'SON DAKİKA: Merkez Bankası faiz kararını açıkladı.', font: 'Oswald', color: '#ffffff', bg: '#000000', padX: 24, padY: 8, radius: 0, y: 340, anim: 'slide-up' },
  { name: 'Şarkı Sözü / Lirik Altyazısı', text: '«Bırak ay gitsin sen kal bu gece...» 🎵', font: 'Caveat', color: '#fef08a', stroke: '#000000', strokeW: 2, y: 310, anim: 'fade' },
  { name: 'Gamer Canlı Tepki Altyazısı', text: 'HAYIRDIR OĞLUM SANA! Nasıl vurdum ama? 🔥', font: 'Anton', color: '#ef4444', stroke: '#000000', strokeW: 5, y: 280, anim: 'pop' },
  { name: 'Röportaj Çevirisi Altyazısı', text: '«Türkiye\'deki yemekleri asla unutamayacağım.»', font: 'Inter', color: '#ffffff', bg: 'rgba(15, 23, 42, 0.85)', padX: 20, padY: 8, radius: 6, y: 320, anim: 'fade' },
  { name: 'Sessiz Sinema Başlık Kartı', text: 'Ertesi Sabah Kasabada...', font: 'Playfair Display', color: '#ffffff', bg: 'rgba(0,0,0,0.9)', padX: 26, padY: 10, radius: 0, y: 0, anim: 'fade' },
  { name: 'Ekonomik Gösterge Altyazısı', text: 'Enflasyon rakamları beklentilerin altında kaldı.', font: 'Roboto', color: '#34d399', stroke: '#000000', strokeW: 3, y: 320, anim: 'slide-up' },
  { name: 'Eğitim Dersi Not Altyazısı', text: 'Formül: E = m · c² (Kütle ve Enerji Eşdeğerliği)', font: 'JetBrains Mono', color: '#facc15', bg: 'rgba(6, 78, 59, 0.9)', padX: 20, padY: 8, radius: 4, y: 320, anim: 'slide-up' },
  { name: 'Felsefe Alıntısı Altyazısı', text: '«Düşünüyorum, öyleyse varım.»', font: 'Cinzel', color: '#fde68a', stroke: '#000000', strokeW: 2, y: 320, anim: 'fade' },
  { name: 'Duygusal Veda Altyazısı', text: 'Her şey için çok teşekkür ederim.', font: 'Plus Jakarta Sans', color: '#ffffff', stroke: '#000000', strokeW: 3, y: 320, anim: 'fade' },
  { name: 'Hızlı Soru Altyazısı', text: 'Sence burada kim haklı?', font: 'Montserrat', color: '#facc15', stroke: '#000000', strokeW: 4, y: 290, anim: 'pop' },
  { name: 'Kapanış İmzası Altyazısı', text: 'Hazırlayan & Sunan: FORMA Yapım Ekibi', font: 'Inter', color: '#94a3b8', stroke: '#000000', strokeW: 2, y: 330, anim: 'fade' },
];

// Helper to assemble full textData for a title preset
function buildPresetTextData(p, category, style) {
  return {
    text: p.text,
    fontFamily: p.font || 'Plus Jakarta Sans',
    fontSize: p.font.includes('Anton') || p.font.includes('Oswald') ? 56 : (p.font.includes('Cinzel') ? 48 : 52),
    fontWeight: p.font.includes('Montserrat') || p.font.includes('Anton') ? '900' : 'bold',
    color: p.color || '#ffffff',
    fillColor: p.color || '#ffffff',
    strokeColor: p.stroke || 'transparent',
    strokeWidth: p.strokeW || 0,
    backgroundColor: p.bg || undefined,
    backgroundOpacity: p.bg ? 0.9 : 0,
    paddingX: p.padX || 24,
    paddingY: p.padY || 12,
    borderRadius: p.radius !== undefined ? p.radius : 6,
    shadowColor: p.shadow || (style === 'cinematic' ? 'rgba(0,0,0,0.8)' : undefined),
    shadowBlur: p.blur || (style === 'cinematic' ? 12 : 0),
    shadowOffsetY: p.blur ? 3 : 0,
    letterSpacing: p.spacing || 0,
    textAlign: p.align || 'center',
    alignment: p.align || 'center',
    inAnimation: p.anim || 'fade',
    inDuration: 0.8,
    outAnimation: 'fade',
    outDuration: 0.6
  };
}

// Map the 240 items by style
const stylePresetsMap = {
  'lower-third': lowerThirdPresets,
  'cinematic': cinematicPresets,
  'social': socialPresets,
  'promo': promoPresets,
  'news': newsPresets,
  'minimal': minimalPresets,
  'subtitle': subtitlePresets
};

const styleIndexCounter = {
  'lower-third': 0,
  'cinematic': 0,
  'social': 0,
  'promo': 0,
  'news': 0,
  'minimal': 0,
  'subtitle': 0
};

let updatedCount = 0;

for (let i = 0; i < catalog.length; i++) {
  const item = catalog[i];
  if (item.category === 'Başlık Şablonları') {
    const style = item.style || 'lower-third';
    const presetsList = stylePresetsMap[style] || lowerThirdPresets;
    const curIdx = styleIndexCounter[style] % presetsList.length;
    styleIndexCounter[style]++;

    const preset = presetsList[curIdx];
    const textData = buildPresetTextData(preset, item.category, style);

    item.name = preset.name;
    item.localizedName = preset.name;
    item.defaultText = preset.text;
    item.metadata = {
      id: item.id,
      name: preset.name,
      category: item.category,
      style: style,
      textData,
      transform: {
        x: 0,
        y: preset.y !== undefined ? preset.y : (style === 'lower-third' ? 320 : 0)
      }
    };

    updatedCount++;
  }
}

fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), 'utf8');
console.log(`[SUCCESS] Updated ${updatedCount} title templates in ONLINE_CATALOG.json with rich, unique curated presets!`);
