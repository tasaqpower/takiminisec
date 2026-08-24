const fs = require('fs');
const path = require('path');
const { TEAMS } = require('./teamsData');

const DB_FILE = path.join(__dirname, 'db.json');

const INITIAL_PROVINCES = [
  { id: "adana", plate: 1, name: "Adana", region: "Akdeniz", defaultTeam: "goztepe", bid: 20, bidder: "Goztepe1925", note: "İsyan ateşi Adana'da!" },
  { id: "adiyaman", plate: 2, name: "Adıyaman", region: "Güneydoğu Anadolu", defaultTeam: "galatasaray", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "afyonkarahisar", plate: 3, name: "Afyonkarahisar", region: "Ege", defaultTeam: "fenerbahce", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "agri", plate: 4, name: "Ağrı", region: "Doğu Anadolu", defaultTeam: "galatasaray", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "amasya", plate: 5, name: "Amasya", region: "Karadeniz", defaultTeam: "besiktas", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "ankara", plate: 6, name: "Ankara", region: "İç Anadolu", defaultTeam: "trabzonspor", bid: 25, bidder: "Firtina61", note: "Başkenti fethettik!" },
  { id: "antalya", plate: 7, name: "Antalya", region: "Akdeniz", defaultTeam: "antalyaspor", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "artvin", plate: 8, name: "Artvin", region: "Karadeniz", defaultTeam: "trabzonspor", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "aydin", plate: 9, name: "Aydın", region: "Ege", defaultTeam: "fenerbahce", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "balikesir", plate: 10, name: "Balıkesir", region: "Marmara", defaultTeam: "bandirmaspor", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "bilecik", plate: 11, name: "Bilecik", region: "Marmara", defaultTeam: "besiktas", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "bingol", plate: 12, name: "Bingöl", region: "Doğu Anadolu", defaultTeam: "amedspor", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "bitlis", plate: 13, name: "Bitlis", region: "Doğu Anadolu", defaultTeam: "fenerbahce", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "bolu", plate: 14, name: "Bolu", region: "Karadeniz", defaultTeam: "boluspor", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "burdur", plate: 15, name: "Burdur", region: "Akdeniz", defaultTeam: "galatasaray", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "bursa", plate: 16, name: "Bursa", region: "Marmara", defaultTeam: "kocaelispor", bid: 30, bidder: "KorkusuzKorfez", note: "Marmara Körfez'indir!" },
  { id: "canakkale", plate: 17, name: "Çanakkale", region: "Marmara", defaultTeam: "besiktas", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "cankiri", plate: 18, name: "Çankırı", region: "İç Anadolu", defaultTeam: "fenerbahce", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "corum", plate: 19, name: "Çorum", region: "Karadeniz", defaultTeam: "corumfk", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "denizli", plate: 20, name: "Denizli", region: "Ege", defaultTeam: "galatasaray", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "diyarbakir", plate: 21, name: "Diyarbakır", region: "Güneydoğu Anadolu", defaultTeam: "besiktas", bid: 30, bidder: "CarsiGrubu", note: "Kartal her yerde uçar!" },
  { id: "edirne", plate: 22, name: "Edirne", region: "Marmara", defaultTeam: "fenerbahce", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "elazig", plate: 23, name: "Elazığ", region: "Doğu Anadolu", defaultTeam: "galatasaray", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "erzincan", plate: 24, name: "Erzincan", region: "Doğu Anadolu", defaultTeam: "besiktas", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "erzurum", plate: 25, name: "Erzurum", region: "Doğu Anadolu", defaultTeam: "erzurumspor", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "eskisehir", plate: 26, name: "Eskişehir", region: "İç Anadolu", defaultTeam: "galatasaray", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "gaziantep", plate: 27, name: "Gaziantep", region: "Güneydoğu Anadolu", defaultTeam: "gaziantepfk", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "giresun", plate: 28, name: "Giresun", region: "Karadeniz", defaultTeam: "trabzonspor", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "gumushane", plate: 29, name: "Gümüşhane", region: "Karadeniz", defaultTeam: "trabzonspor", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "hakkari", plate: 30, name: "Hakkâri", region: "Doğu Anadolu", defaultTeam: "amedspor", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "hatay", plate: 31, name: "Hatay", region: "Akdeniz", defaultTeam: "hatayspor", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "isparta", plate: 32, name: "Isparta", region: "Akdeniz", defaultTeam: "fenerbahce", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "mersin", plate: 33, name: "Mersin", region: "Akdeniz", defaultTeam: "galatasaray", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "istanbul", plate: 34, name: "İstanbul", region: "Marmara", defaultTeam: "amedspor", bid: 60, bidder: "Barikat34", note: "İstanbul artık yeşil-kırmızı!" },
  { id: "izmir", plate: 35, name: "İzmir", region: "Ege", defaultTeam: "galatasaray", bid: 35, bidder: "ultrAslanIzmir", note: "İzmir Cimbomdur!" },
  { id: "kars", plate: 36, name: "Kars", region: "Doğu Anadolu", defaultTeam: "besiktas", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "kastamonu", plate: 37, name: "Kastamonu", region: "Karadeniz", defaultTeam: "fenerbahce", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "kayseri", plate: 38, name: "Kayseri", region: "İç Anadolu", defaultTeam: "kayserispor", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "kirklareli", plate: 39, name: "Kırklareli", region: "Marmara", defaultTeam: "galatasaray", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "kirsehir", plate: 40, name: "Kırşehir", region: "İç Anadolu", defaultTeam: "fenerbahce", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "kocaeli", plate: 41, name: "Kocaeli", region: "Marmara", defaultTeam: "kocaelispor", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "konya", plate: 42, name: "Konya", region: "İç Anadolu", defaultTeam: "konyaspor", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "kutahya", plate: 43, name: "Kütahya", region: "Ege", defaultTeam: "fenerbahce", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "malatya", plate: 44, name: "Malatya", region: "Doğu Anadolu", defaultTeam: "yenimalatya", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "manisa", plate: 45, name: "Manisa", region: "Ege", defaultTeam: "manisafk", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "kahramanmaras", plate: 46, name: "Kahramanmaraş", region: "Akdeniz", defaultTeam: "galatasaray", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "mardin", plate: 47, name: "Mardin", region: "Güneydoğu Anadolu", defaultTeam: "amedspor", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "mugla", plate: 48, name: "Muğla", region: "Ege", defaultTeam: "bodrumfk", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "mus", plate: 49, name: "Muş", region: "Doğu Anadolu", defaultTeam: "amedspor", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "nevsehir", plate: 50, name: "Nevşehir", region: "İç Anadolu", defaultTeam: "besiktas", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "nigde", plate: 51, name: "Niğde", region: "İç Anadolu", defaultTeam: "fenerbahce", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "ordu", plate: 52, name: "Ordu", region: "Karadeniz", defaultTeam: "trabzonspor", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "rize", plate: 53, name: "Rize", region: "Karadeniz", defaultTeam: "caykurrize", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "sakarya", plate: 54, name: "Sakarya", region: "Marmara", defaultTeam: "sakaryaspor", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "samsun", plate: 55, name: "Samsun", region: "Karadeniz", defaultTeam: "samsunspor", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "siirt", plate: 56, name: "Siirt", region: "Güneydoğu Anadolu", defaultTeam: "amedspor", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "sinop", plate: 57, name: "Sinop", region: "Karadeniz", defaultTeam: "besiktas", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "sivas", plate: 58, name: "Sivas", region: "İç Anadolu", defaultTeam: "sivasspor", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "tekirdag", plate: 59, name: "Tekirdağ", region: "Marmara", defaultTeam: "fenerbahce", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "tokat", plate: 60, name: "Tokat", region: "Karadeniz", defaultTeam: "galatasaray", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "trabzon", plate: 61, name: "Trabzon", region: "Karadeniz", defaultTeam: "fenerbahce", bid: 45, bidder: "KadikoyBogasi", note: "Trabzon'da sarı-lacivert bayrak!" },
  { id: "tunceli", plate: 62, name: "Tunceli", region: "Doğu Anadolu", defaultTeam: "amedspor", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "sanliurfa", plate: 63, name: "Şanlıurfa", region: "Güneydoğu Anadolu", defaultTeam: "sanliurfaspor", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "usak", plate: 64, name: "Uşak", region: "Ege", defaultTeam: "fenerbahce", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "van", plate: 65, name: "Van", region: "Doğu Anadolu", defaultTeam: "amedspor", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "yozgat", plate: 66, name: "Yozgat", region: "İç Anadolu", defaultTeam: "fenerbahce", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "zonguldak", plate: 67, name: "Zonguldak", region: "Karadeniz", defaultTeam: "besiktas", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "aksaray", plate: 68, name: "Aksaray", region: "İç Anadolu", defaultTeam: "galatasaray", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "bayburt", plate: 69, name: "Bayburt", region: "Karadeniz", defaultTeam: "trabzonspor", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "karaman", plate: 70, name: "Karaman", region: "İç Anadolu", defaultTeam: "konyaspor", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "kirikkale", plate: 71, name: "Kırıkkale", region: "İç Anadolu", defaultTeam: "ankaragucu", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "batman", plate: 72, name: "Batman", region: "Güneydoğu Anadolu", defaultTeam: "amedspor", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "sirnak", plate: 73, name: "Şırnak", region: "Güneydoğu Anadolu", defaultTeam: "amedspor", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "bartin", plate: 74, name: "Bartın", region: "Karadeniz", defaultTeam: "besiktas", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "ardahan", plate: 75, name: "Ardahan", region: "Doğu Anadolu", defaultTeam: "galatasaray", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "igdir", plate: 76, name: "Iğdır", region: "Doğu Anadolu", defaultTeam: "igdirfk", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "yalova", plate: 77, name: "Yalova", region: "Marmara", defaultTeam: "fenerbahce", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "karabuk", plate: 78, name: "Karabük", region: "Karadeniz", defaultTeam: "besiktas", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "kilis", plate: 79, name: "Kilis", region: "Güneydoğu Anadolu", defaultTeam: "galatasaray", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "osmaniye", plate: 80, name: "Osmaniye", region: "Akdeniz", defaultTeam: "adana_demir", bid: 0, bidder: "Henüz Sahipsiz" },
  { id: "duzce", plate: 81, name: "Düzce", region: "Karadeniz", defaultTeam: "sakaryaspor", bid: 0, bidder: "Henüz Sahipsiz" }
];

class Database {
  constructor() {
    this.data = {
      provinces: {},
      activityFeed: [],
      stats: {
        totalBidsCount: 7,
        totalMoneySpent: 245
      }
    };
    this.init();
  }

  init() {
    let totalSpent = 0;
    let bidsCount = 0;
    const now = Date.now();

    INITIAL_PROVINCES.forEach(p => {
      const bidAmount = p.bid || 0;
      const history = [];

      if (bidAmount > 0) {
        totalSpent += bidAmount;
        bidsCount += 1;
        history.push({
          id: 'bid_' + Math.random().toString(36).substr(2, 6),
          teamId: p.defaultTeam,
          amount: bidAmount,
          bidder: p.bidder,
          timestamp: now - Math.floor(Math.random() * 1800000),
          note: p.note || ''
        });
      }

      this.data.provinces[p.id] = {
        id: p.id,
        plate: p.plate,
        name: p.name,
        region: p.region,
        currentTeamId: p.defaultTeam,
        currentBid: bidAmount,
        totalInvested: bidAmount,
        lastBidder: p.bidder,
        lastBidTime: now,
        bidHistory: history
      };
    });

    this.data.stats = {
      totalBidsCount: bidsCount,
      totalMoneySpent: totalSpent
    };

    // Realistic lively ticker activity feed
    this.data.activityFeed = [
      {
        id: 'act_1',
        provinceId: 'istanbul',
        provinceName: 'İstanbul',
        teamId: 'amedspor',
        amount: 60,
        bidder: 'Barikat34',
        prevTeamId: 'galatasaray',
        prevBid: 50,
        timestamp: now - 120000
      },
      {
        id: 'act_2',
        provinceId: 'trabzon',
        provinceName: 'Trabzon',
        teamId: 'fenerbahce',
        amount: 45,
        bidder: 'KadikoyBogasi',
        prevTeamId: 'trabzonspor',
        prevBid: 30,
        timestamp: now - 340000
      },
      {
        id: 'act_3',
        provinceId: 'izmir',
        provinceName: 'İzmir',
        teamId: 'galatasaray',
        amount: 35,
        bidder: 'ultrAslanIzmir',
        prevTeamId: 'goztepe',
        prevBid: 25,
        timestamp: now - 620000
      },
      {
        id: 'act_4',
        provinceId: 'bursa',
        provinceName: 'Bursa',
        teamId: 'kocaelispor',
        amount: 30,
        bidder: 'KorkusuzKorfez',
        prevTeamId: 'bursaspor',
        prevBid: 20,
        timestamp: now - 950000
      },
      {
        id: 'act_5',
        provinceId: 'diyarbakir',
        provinceName: 'Diyarbakır',
        teamId: 'besiktas',
        amount: 30,
        bidder: 'CarsiGrubu',
        prevTeamId: 'amedspor',
        prevBid: 20,
        timestamp: now - 1250000
      },
      {
        id: 'act_6',
        provinceId: 'ankara',
        provinceName: 'Ankara',
        teamId: 'trabzonspor',
        amount: 25,
        bidder: 'Firtina61',
        prevTeamId: 'ankaragucu',
        prevBid: 15,
        timestamp: now - 1600000
      },
      {
        id: 'act_7',
        provinceId: 'adana',
        provinceName: 'Adana',
        teamId: 'goztepe',
        amount: 20,
        bidder: 'Goztepe1925',
        prevTeamId: 'adana_demir',
        prevBid: 10,
        timestamp: now - 2100000
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
    const teamCounts = {};
    const teamMoney = {};
    let totalProvinces = 0;

    Object.values(this.data.provinces).forEach(p => {
      teamCounts[p.currentTeamId] = (teamCounts[p.currentTeamId] || 0) + 1;
      teamMoney[p.currentTeamId] = (teamMoney[p.currentTeamId] || 0) + p.totalInvested;
      totalProvinces++;
    });

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
      .sort((a, b) => b.totalMoney - a.totalMoney || b.count - a.count);

    const topProvinces = Object.values(this.data.provinces)
      .sort((a, b) => b.totalInvested - a.totalInvested || b.currentBid - a.currentBid)
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

    const minRequired = province.currentBid > 0 ? province.currentBid + 1 : 1;
    const bidAmount = Number(amount);

    if (isNaN(bidAmount) || bidAmount < minRequired) {
      throw new Error(`Teklif yetersiz! Minimum gereken tutar: ${minRequired} ₺`);
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

    if (province.bidHistory.length > 50) {
      province.bidHistory = province.bidHistory.slice(0, 50);
    }

    this.data.stats.totalBidsCount += 1;
    this.data.stats.totalMoneySpent += bidAmount;

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
