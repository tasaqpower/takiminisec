const fs = require('fs');
const path = require('path');
const { TEAMS } = require('./teamsData');

const DB_FILE = path.join(__dirname, 'db.json');

const INITIAL_PROVINCES = [
  { id: "adana", plate: 1, name: "Adana", region: "Akdeniz", defaultTeam: "adana_demir", defaultBid: 10, bidder: "Şimşekler" },
  { id: "adiyaman", plate: 2, name: "Adıyaman", region: "Güneydoğu Anadolu", defaultTeam: "galatasaray", defaultBid: 5, bidder: "Cimbomlu" },
  { id: "afyonkarahisar", plate: 3, name: "Afyonkarahisar", region: "Ege", defaultTeam: "fenerbahce", defaultBid: 5, bidder: "Afyonlu03" },
  { id: "agri", plate: 4, name: "Ağrı", region: "Doğu Anadolu", defaultTeam: "galatasaray", defaultBid: 5, bidder: "Ağrılı" },
  { id: "amasya", plate: 5, name: "Amasya", region: "Karadeniz", defaultTeam: "besiktas", defaultBid: 5, bidder: "Kartal05" },
  { id: "ankara", plate: 6, name: "Ankara", region: "İç Anadolu", defaultTeam: "ankaragucu", defaultBid: 25, bidder: "Gecekondu" },
  { id: "antalya", plate: 7, name: "Antalya", region: "Akdeniz", defaultTeam: "antalyaspor", defaultBid: 15, bidder: "07Akrep" },
  { id: "artvin", plate: 8, name: "Artvin", region: "Karadeniz", defaultTeam: "trabzonspor", defaultBid: 10, bidder: "Karadenizli" },
  { id: "aydin", plate: 9, name: "Aydın", region: "Ege", defaultTeam: "fenerbahce", defaultBid: 8, bidder: "Efe" },
  { id: "balikesir", plate: 10, name: "Balıkesir", region: "Marmara", defaultTeam: "bandirmaspor", defaultBid: 10, bidder: "Balkes" },
  { id: "bilecik", plate: 11, name: "Bilecik", region: "Marmara", defaultTeam: "besiktas", defaultBid: 5, bidder: "Bilecikli" },
  { id: "bingol", plate: 12, name: "Bingöl", region: "Doğu Anadolu", defaultTeam: "galatasaray", defaultBid: 5, bidder: "Zaza" },
  { id: "bitlis", plate: 13, name: "Bitlis", region: "Doğu Anadolu", defaultTeam: "fenerbahce", defaultBid: 5, bidder: "Bitlis13" },
  { id: "bolu", plate: 14, name: "Bolu", region: "Karadeniz", defaultTeam: "boluspor", defaultBid: 10, bidder: "Yarenler" },
  { id: "burdur", plate: 15, name: "Burdur", region: "Akdeniz", defaultTeam: "galatasaray", defaultBid: 5, bidder: "Burdurlu" },
  { id: "bursa", plate: 16, name: "Bursa", region: "Marmara", defaultTeam: "bursaspor", defaultBid: 20, bidder: "Teksas" },
  { id: "canakkale", plate: 17, name: "Çanakkale", region: "Marmara", defaultTeam: "besiktas", defaultBid: 8, bidder: "1915" },
  { id: "cankiri", plate: 18, name: "Çankırı", region: "İç Anadolu", defaultTeam: "fenerbahce", defaultBid: 5, bidder: "Yaran" },
  { id: "corum", plate: 19, name: "Çorum", region: "Karadeniz", defaultTeam: "corumfk", defaultBid: 10, bidder: "KırmızıŞimşek" },
  { id: "denizli", plate: 20, name: "Denizli", region: "Ege", defaultTeam: "galatasaray", defaultBid: 8, bidder: "Horoz" },
  { id: "diyarbakir", plate: 21, name: "Diyarbakır", region: "Güneydoğu Anadolu", defaultTeam: "amedspor", defaultBid: 30, bidder: "Barikat" },
  { id: "edirne", plate: 22, name: "Edirne", region: "Marmara", defaultTeam: "fenerbahce", defaultBid: 6, bidder: "Trakyalı" },
  { id: "elazig", plate: 23, name: "Elazığ", region: "Doğu Anadolu", defaultTeam: "galatasaray", defaultBid: 10, bidder: "Gakgoş" },
  { id: "erzincan", plate: 24, name: "Erzincan", region: "Doğu Anadolu", defaultTeam: "besiktas", defaultBid: 5, bidder: "CanErzincan" },
  { id: "erzurum", plate: 25, name: "Erzurum", region: "Doğu Anadolu", defaultTeam: "erzurumspor", defaultBid: 15, bidder: "Dadaşlar" },
  { id: "eskisehir", plate: 26, name: "Eskişehir", region: "İç Anadolu", defaultTeam: "galatasaray", defaultBid: 12, bidder: "EsEsLi" },
  { id: "gaziantep", plate: 27, name: "Gaziantep", region: "Güneydoğu Anadolu", defaultTeam: "gaziantepfk", defaultBid: 15, bidder: "Şahinler" },
  { id: "giresun", plate: 28, name: "Giresun", region: "Karadeniz", defaultTeam: "trabzonspor", defaultBid: 10, bidder: "Çotanak" },
  { id: "gumushane", plate: 29, name: "Gümüşhane", region: "Karadeniz", defaultTeam: "trabzonspor", defaultBid: 6, bidder: "Gümüş29" },
  { id: "hakkari", plate: 30, name: "Hakkâri", region: "Doğu Anadolu", defaultTeam: "galatasaray", defaultBid: 5, bidder: "Cilo" },
  { id: "hatay", plate: 31, name: "Hatay", region: "Akdeniz", defaultTeam: "hatayspor", defaultBid: 12, bidder: "AsiKral" },
  { id: "isparta", plate: 32, name: "Isparta", region: "Akdeniz", defaultTeam: "fenerbahce", defaultBid: 6, bidder: "GülDiyarı" },
  { id: "mersin", plate: 33, name: "Mersin", region: "Akdeniz", defaultTeam: "galatasaray", defaultBid: 10, bidder: "KırmızıŞeytan" },
  { id: "istanbul", plate: 34, name: "İstanbul", region: "Marmara", defaultTeam: "galatasaray", defaultBid: 50, bidder: "ultrAslan" },
  { id: "izmir", plate: 35, name: "İzmir", region: "Ege", defaultTeam: "goztepe", defaultBid: 35, bidder: "GözGöz35" },
  { id: "kars", plate: 36, name: "Kars", region: "Doğu Anadolu", defaultTeam: "besiktas", defaultBid: 5, bidder: "KarslıKartal" },
  { id: "kastamonu", plate: 37, name: "Kastamonu", region: "Karadeniz", defaultTeam: "fenerbahce", defaultBid: 5, bidder: "Kastamonu37" },
  { id: "kayseri", plate: 38, name: "Kayseri", region: "İç Anadolu", defaultTeam: "kayserispor", defaultBid: 15, bidder: "KapalıKale" },
  { id: "kirklareli", plate: 39, name: "Kırklareli", region: "Marmara", defaultTeam: "galatasaray", defaultBid: 5, bidder: "Kırklar" },
  { id: "kirsehir", plate: 40, name: "Kırşehir", region: "İç Anadolu", defaultTeam: "fenerbahce", defaultBid: 5, bidder: "Bozkır" },
  { id: "kocaeli", plate: 41, name: "Kocaeli", region: "Marmara", defaultTeam: "kocaelispor", defaultBid: 20, bidder: "HodriMeydan" },
  { id: "konya", plate: 42, name: "Konya", region: "İç Anadolu", defaultTeam: "konyaspor", defaultBid: 15, bidder: "Nalçacılılar" },
  { id: "kutahya", plate: 43, name: "Kütahya", region: "Ege", defaultTeam: "fenerbahce", defaultBid: 5, bidder: "Çinici" },
  { id: "malatya", plate: 44, name: "Malatya", region: "Doğu Anadolu", defaultTeam: "yenimalatya", defaultBid: 10, bidder: "Derebeyleri" },
  { id: "manisa", plate: 45, name: "Manisa", region: "Ege", defaultTeam: "manisafk", defaultBid: 10, bidder: "Tarzanlar" },
  { id: "kahramanmaras", plate: 46, name: "Kahramanmaraş", region: "Akdeniz", defaultTeam: "galatasaray", defaultBid: 8, bidder: "Edeler" },
  { id: "mardin", plate: 47, name: "Mardin", region: "Güneydoğu Anadolu", defaultTeam: "galatasaray", defaultBid: 8, bidder: "Mardinli" },
  { id: "mugla", plate: 48, name: "Muğla", region: "Ege", defaultTeam: "bodrumfk", defaultBid: 15, bidder: "AsiTayfa" },
  { id: "mus", plate: 49, name: "Muş", region: "Doğu Anadolu", defaultTeam: "amedspor", defaultBid: 6, bidder: "Ova49" },
  { id: "nevsehir", plate: 50, name: "Nevşehir", region: "İç Anadolu", defaultTeam: "besiktas", defaultBid: 5, bidder: "Kapadokya" },
  { id: "nigde", plate: 51, name: "Niğde", region: "İç Anadolu", defaultTeam: "fenerbahce", defaultBid: 5, bidder: "Niğde51" },
  { id: "ordu", plate: 52, name: "Ordu", region: "Karadeniz", defaultTeam: "trabzonspor", defaultBid: 10, bidder: "MorBeyaz" },
  { id: "rize", plate: 53, name: "Rize", region: "Karadeniz", defaultTeam: "caykurrize", defaultBid: 15, bidder: "Atmaca53" },
  { id: "sakarya", plate: 54, name: "Sakarya", region: "Marmara", defaultTeam: "sakaryaspor", defaultBid: 20, bidder: "Tatangalar" },
  { id: "samsun", plate: 55, name: "Samsun", region: "Karadeniz", defaultTeam: "samsunspor", defaultBid: 25, bidder: "Söğütlübahçe" },
  { id: "siirt", plate: 56, name: "Siirt", region: "Güneydoğu Anadolu", defaultTeam: "galatasaray", defaultBid: 5, bidder: "Siirtli56" },
  { id: "sinop", plate: 57, name: "Sinop", region: "Karadeniz", defaultTeam: "besiktas", defaultBid: 5, bidder: "KuzeyYıldızı" },
  { id: "sivas", plate: 58, name: "Sivas", region: "İç Anadolu", defaultTeam: "sivasspor", defaultBid: 15, bidder: "Yiğidolar" },
  { id: "tekirdag", plate: 59, name: "Tekirdağ", region: "Marmara", defaultTeam: "fenerbahce", defaultBid: 8, bidder: "Tekirdağlı" },
  { id: "tokat", plate: 60, name: "Tokat", region: "Karadeniz", defaultTeam: "galatasaray", defaultBid: 5, bidder: "Tokat60" },
  { id: "trabzon", plate: 61, name: "Trabzon", region: "Karadeniz", defaultTeam: "trabzonspor", defaultBid: 35, bidder: "Vira61" },
  { id: "tunceli", plate: 62, name: "Tunceli", region: "Doğu Anadolu", defaultTeam: "amedspor", defaultBid: 10, bidder: "Munzur" },
  { id: "sanliurfa", plate: 63, name: "Şanlıurfa", region: "Güneydoğu Anadolu", defaultTeam: "sanliurfaspor", defaultBid: 15, bidder: "63Urfa" },
  { id: "usak", plate: 64, name: "Uşak", region: "Ege", defaultTeam: "fenerbahce", defaultBid: 5, bidder: "Aşıklar" },
  { id: "van", plate: 65, name: "Van", region: "Doğu Anadolu", defaultTeam: "amedspor", defaultBid: 12, bidder: "VanDenizi" },
  { id: "yozgat", plate: 66, name: "Yozgat", region: "İç Anadolu", defaultTeam: "fenerbahce", defaultBid: 5, bidder: "Yozgatlı" },
  { id: "zonguldak", plate: 67, name: "Zonguldak", region: "Karadeniz", defaultTeam: "besiktas", defaultBid: 8, bidder: "KaraElmas" },
  { id: "aksaray", plate: 68, name: "Aksaray", region: "İç Anadolu", defaultTeam: "galatasaray", defaultBid: 5, bidder: "68Aksaray" },
  { id: "bayburt", plate: 69, name: "Bayburt", region: "Karadeniz", defaultTeam: "trabzonspor", defaultBid: 5, bidder: "Bayburt69" },
  { id: "karaman", plate: 70, name: "Karaman", region: "İç Anadolu", defaultTeam: "konyaspor", defaultBid: 5, bidder: "Karamanlı" },
  { id: "kirikkale", plate: 71, name: "Kırıkkale", region: "İç Anadolu", defaultTeam: "ankaragucu", defaultBid: 5, bidder: "71Kırıkkale" },
  { id: "batman", plate: 72, name: "Batman", region: "Güneydoğu Anadolu", defaultTeam: "amedspor", defaultBid: 12, bidder: "Petrolcü" },
  { id: "sirnak", plate: 73, name: "Şırnak", region: "Güneydoğu Anadolu", defaultTeam: "amedspor", defaultBid: 8, bidder: "Cizreli" },
  { id: "bartin", plate: 74, name: "Bartın", region: "Karadeniz", defaultTeam: "besiktas", defaultBid: 5, bidder: "Bartın74" },
  { id: "ardahan", plate: 75, name: "Ardahan", region: "Doğu Anadolu", defaultTeam: "galatasaray", defaultBid: 5, bidder: "Kafkas" },
  { id: "igdir", plate: 76, name: "Iğdır", region: "Doğu Anadolu", defaultTeam: "igdirfk", defaultBid: 15, bidder: "Ovalı76" },
  { id: "yalova", plate: 77, name: "Yalova", region: "Marmara", defaultTeam: "fenerbahce", defaultBid: 8, bidder: "Yalovalı" },
  { id: "karabuk", plate: 78, name: "Karabük", region: "Karadeniz", defaultTeam: "besiktas", defaultBid: 5, bidder: "MaviAteş" },
  { id: "kilis", plate: 79, name: "Kilis", region: "Güneydoğu Anadolu", defaultTeam: "galatasaray", defaultBid: 5, bidder: "Kilis79" },
  { id: "osmaniye", plate: 80, name: "Osmaniye", region: "Akdeniz", defaultTeam: "adana_demir", defaultBid: 8, bidder: "Kadirli" },
  { id: "duzce", plate: 81, name: "Düzce", region: "Karadeniz", defaultTeam: "sakaryaspor", defaultBid: 8, bidder: "Düzceli" }
];

class Database {
  constructor() {
    this.data = {
      provinces: {},
      activityFeed: [],
      stats: {
        totalBidsCount: 0,
        totalMoneySpent: 0
      }
    };
    this.init();
  }

  init() {
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        this.data = JSON.parse(raw);
        return;
      } catch (err) {
        console.error("DB file read error, recreating initial state:", err);
      }
    }

    // Initialize fresh provinces
    INITIAL_PROVINCES.forEach(p => {
      this.data.provinces[p.id] = {
        id: p.id,
        plate: p.plate,
        name: p.name,
        region: p.region,
        currentTeamId: p.defaultTeam,
        currentBid: p.defaultBid,
        totalInvested: p.defaultBid,
        lastBidder: p.bidder,
        lastBidTime: Date.now() - Math.floor(Math.random() * 3600000),
        bidHistory: [
          {
            id: 'init_' + p.id,
            teamId: p.defaultTeam,
            amount: p.defaultBid,
            bidder: p.bidder,
            timestamp: Date.now() - Math.floor(Math.random() * 3600000),
            note: 'Başlangıç Teklifi'
          }
        ]
      };
      this.data.stats.totalBidsCount += 1;
      this.data.stats.totalMoneySpent += p.defaultBid;
    });

    this.data.activityFeed = [
      {
        id: 'act_init_1',
        provinceId: 'diyarbakir',
        provinceName: 'Diyarbakır',
        teamId: 'amedspor',
        amount: 30,
        bidder: 'Barikat',
        prevTeamId: 'fenerbahce',
        timestamp: Date.now() - 300000
      },
      {
        id: 'act_init_2',
        provinceId: 'istanbul',
        provinceName: 'İstanbul',
        teamId: 'galatasaray',
        amount: 50,
        bidder: 'ultrAslan',
        prevTeamId: 'besiktas',
        timestamp: Date.now() - 180000
      },
      {
        id: 'act_init_3',
        provinceId: 'izmir',
        provinceName: 'İzmir',
        teamId: 'goztepe',
        amount: 35,
        bidder: 'GözGöz35',
        prevTeamId: 'fenerbahce',
        timestamp: Date.now() - 60000
      }
    ];

    this.save();
  }

  save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (err) {
      console.error("DB write error:", err);
    }
  }

  getAllProvinces() {
    return this.data.provinces;
  }

  getProvince(id) {
    return this.data.provinces[id];
  }

  getActivityFeed() {
    return this.data.activityFeed.slice(0, 50);
  }

  getStats() {
    // Calculate team shares
    const teamCounts = {};
    const teamMoney = {};
    let totalProvinces = 0;

    Object.values(this.data.provinces).forEach(p => {
      teamCounts[p.currentTeamId] = (teamCounts[p.currentTeamId] || 0) + 1;
      teamMoney[p.currentTeamId] = (teamMoney[p.currentTeamId] || 0) + p.totalInvested;
      totalProvinces++;
    });

    // Sort teams by province count descending
    const teamLeaderboard = Object.entries(teamCounts)
      .map(([teamId, count]) => {
        const teamObj = TEAMS.find(t => t.id === teamId) || { name: teamId, shortName: teamId, primaryColor: '#555', badge: '⚽' };
        return {
          teamId,
          name: teamObj.name,
          shortName: teamObj.shortName,
          badge: teamObj.badge,
          primaryColor: teamObj.primaryColor,
          secondaryColor: teamObj.secondaryColor,
          count,
          percentage: ((count / totalProvinces) * 100).toFixed(1),
          totalMoney: teamMoney[teamId] || 0
        };
      })
      .sort((a, b) => b.count - a.count || b.totalMoney - a.totalMoney);

    // Top Battleground Provinces (most invested / highest current bid)
    const topProvinces = Object.values(this.data.provinces)
      .sort((a, b) => b.totalInvested - a.totalInvested)
      .slice(0, 10);

    return {
      totalBidsCount: this.data.stats.totalBidsCount,
      totalMoneySpent: this.data.stats.totalMoneySpent,
      teamLeaderboard,
      topProvinces,
      totalProvinces
    };
  }

  placeBid({ provinceId, teamId, amount, bidder, note }) {
    const province = this.data.provinces[provinceId];
    if (!province) {
      throw new Error(`İl bulunamadı: ${provinceId}`);
    }

    const minRequired = province.currentBid + 1;
    const bidAmount = Number(amount);

    if (isNaN(bidAmount) || bidAmount < minRequired) {
      throw new Error(`Teklif yetersiz! Minimum gereken tutar: ${minRequired} ₺ (Mevcut: ${province.currentBid} ₺)`);
    }

    const prevTeamId = province.currentTeamId;
    const prevBid = province.currentBid;
    const prevBidder = province.lastBidder;

    const newBidItem = {
      id: 'bid_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      teamId,
      amount: bidAmount,
      bidder: bidder.trim() || 'Anonim Taraftar',
      timestamp: Date.now(),
      note: note || ''
    };

    province.currentTeamId = teamId;
    province.currentBid = bidAmount;
    province.totalInvested += bidAmount;
    province.lastBidder = newBidItem.bidder;
    province.lastBidTime = newBidItem.timestamp;
    province.bidHistory.unshift(newBidItem);

    // Keep history max 50 items per province
    if (province.bidHistory.length > 50) {
      province.bidHistory = province.bidHistory.slice(0, 50);
    }

    this.data.stats.totalBidsCount += 1;
    this.data.stats.totalMoneySpent += bidAmount;

    // Activity feed item
    const feedItem = {
      id: 'act_' + Date.now(),
      provinceId: province.id,
      provinceName: province.name,
      teamId,
      amount: bidAmount,
      bidder: newBidItem.bidder,
      prevTeamId,
      prevBid,
      prevBidder,
      timestamp: newBidItem.timestamp
    };

    this.data.activityFeed.unshift(feedItem);
    if (this.data.activityFeed.length > 100) {
      this.data.activityFeed = this.data.activityFeed.slice(0, 100);
    }

    this.save();

    return {
      updatedProvince: province,
      activity: feedItem,
      stats: this.getStats()
    };
  }
}

module.exports = new Database();
