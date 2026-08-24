const fs = require('fs');
const path = require('path');
const { TEAMS } = require('./teamsData');

const DB_FILE = path.join(__dirname, 'db.json');

const INITIAL_PROVINCES = [
  { id: "adana", plate: 1, name: "Adana", region: "Akdeniz", defaultTeam: "adana_demir" },
  { id: "adiyaman", plate: 2, name: "Adıyaman", region: "Güneydoğu Anadolu", defaultTeam: "galatasaray" },
  { id: "afyonkarahisar", plate: 3, name: "Afyonkarahisar", region: "Ege", defaultTeam: "fenerbahce" },
  { id: "agri", plate: 4, name: "Ağrı", region: "Doğu Anadolu", defaultTeam: "galatasaray" },
  { id: "amasya", plate: 5, name: "Amasya", region: "Karadeniz", defaultTeam: "besiktas" },
  { id: "ankara", plate: 6, name: "Ankara", region: "İç Anadolu", defaultTeam: "ankaragucu" },
  { id: "antalya", plate: 7, name: "Antalya", region: "Akdeniz", defaultTeam: "antalyaspor" },
  { id: "artvin", plate: 8, name: "Artvin", region: "Karadeniz", defaultTeam: "trabzonspor" },
  { id: "aydin", plate: 9, name: "Aydın", region: "Ege", defaultTeam: "fenerbahce" },
  { id: "balikesir", plate: 10, name: "Balıkesir", region: "Marmara", defaultTeam: "bandirmaspor" },
  { id: "bilecik", plate: 11, name: "Bilecik", region: "Marmara", defaultTeam: "besiktas" },
  { id: "bingol", plate: 12, name: "Bingöl", region: "Doğu Anadolu", defaultTeam: "amedspor" },
  { id: "bitlis", plate: 13, name: "Bitlis", region: "Doğu Anadolu", defaultTeam: "fenerbahce" },
  { id: "bolu", plate: 14, name: "Bolu", region: "Karadeniz", defaultTeam: "boluspor" },
  { id: "burdur", plate: 15, name: "Burdur", region: "Akdeniz", defaultTeam: "galatasaray" },
  { id: "bursa", plate: 16, name: "Bursa", region: "Marmara", defaultTeam: "bursaspor" },
  { id: "canakkale", plate: 17, name: "Çanakkale", region: "Marmara", defaultTeam: "besiktas" },
  { id: "cankiri", plate: 18, name: "Çankırı", region: "İç Anadolu", defaultTeam: "fenerbahce" },
  { id: "corum", plate: 19, name: "Çorum", region: "Karadeniz", defaultTeam: "corumfk" },
  { id: "denizli", plate: 20, name: "Denizli", region: "Ege", defaultTeam: "galatasaray" },
  { id: "diyarbakir", plate: 21, name: "Diyarbakır", region: "Güneydoğu Anadolu", defaultTeam: "amedspor" },
  { id: "edirne", plate: 22, name: "Edirne", region: "Marmara", defaultTeam: "fenerbahce" },
  { id: "elazig", plate: 23, name: "Elazığ", region: "Doğu Anadolu", defaultTeam: "galatasaray" },
  { id: "erzincan", plate: 24, name: "Erzincan", region: "Doğu Anadolu", defaultTeam: "besiktas" },
  { id: "erzurum", plate: 25, name: "Erzurum", region: "Doğu Anadolu", defaultTeam: "erzurumspor" },
  { id: "eskisehir", plate: 26, name: "Eskişehir", region: "İç Anadolu", defaultTeam: "galatasaray" },
  { id: "gaziantep", plate: 27, name: "Gaziantep", region: "Güneydoğu Anadolu", defaultTeam: "gaziantepfk" },
  { id: "giresun", plate: 28, name: "Giresun", region: "Karadeniz", defaultTeam: "trabzonspor" },
  { id: "gumushane", plate: 29, name: "Gümüşhane", region: "Karadeniz", defaultTeam: "trabzonspor" },
  { id: "hakkari", plate: 30, name: "Hakkâri", region: "Doğu Anadolu", defaultTeam: "amedspor" },
  { id: "hatay", plate: 31, name: "Hatay", region: "Akdeniz", defaultTeam: "hatayspor" },
  { id: "isparta", plate: 32, name: "Isparta", region: "Akdeniz", defaultTeam: "fenerbahce" },
  { id: "mersin", plate: 33, name: "Mersin", region: "Akdeniz", defaultTeam: "galatasaray" },
  { id: "istanbul", plate: 34, name: "İstanbul", region: "Marmara", defaultTeam: "galatasaray" },
  { id: "izmir", plate: 35, name: "İzmir", region: "Ege", defaultTeam: "goztepe" },
  { id: "kars", plate: 36, name: "Kars", region: "Doğu Anadolu", defaultTeam: "besiktas" },
  { id: "kastamonu", plate: 37, name: "Kastamonu", region: "Karadeniz", defaultTeam: "fenerbahce" },
  { id: "kayseri", plate: 38, name: "Kayseri", region: "İç Anadolu", defaultTeam: "kayserispor" },
  { id: "kirklareli", plate: 39, name: "Kırklareli", region: "Marmara", defaultTeam: "galatasaray" },
  { id: "kirsehir", plate: 40, name: "Kırşehir", region: "İç Anadolu", defaultTeam: "fenerbahce" },
  { id: "kocaeli", plate: 41, name: "Kocaeli", region: "Marmara", defaultTeam: "kocaelispor" },
  { id: "konya", plate: 42, name: "Konya", region: "İç Anadolu", defaultTeam: "konyaspor" },
  { id: "kutahya", plate: 43, name: "Kütahya", region: "Ege", defaultTeam: "fenerbahce" },
  { id: "malatya", plate: 44, name: "Malatya", region: "Doğu Anadolu", defaultTeam: "yenimalatya" },
  { id: "manisa", plate: 45, name: "Manisa", region: "Ege", defaultTeam: "manisafk" },
  { id: "kahramanmaras", plate: 46, name: "Kahramanmaraş", region: "Akdeniz", defaultTeam: "galatasaray" },
  { id: "mardin", plate: 47, name: "Mardin", region: "Güneydoğu Anadolu", defaultTeam: "amedspor" },
  { id: "mugla", plate: 48, name: "Muğla", region: "Ege", defaultTeam: "bodrumfk" },
  { id: "mus", plate: 49, name: "Muş", region: "Doğu Anadolu", defaultTeam: "amedspor" },
  { id: "nevsehir", plate: 50, name: "Nevşehir", region: "İç Anadolu", defaultTeam: "besiktas" },
  { id: "nigde", plate: 51, name: "Niğde", region: "İç Anadolu", defaultTeam: "fenerbahce" },
  { id: "ordu", plate: 52, name: "Ordu", region: "Karadeniz", defaultTeam: "trabzonspor" },
  { id: "rize", plate: 53, name: "Rize", region: "Karadeniz", defaultTeam: "caykurrize" },
  { id: "sakarya", plate: 54, name: "Sakarya", region: "Marmara", defaultTeam: "sakaryaspor" },
  { id: "samsun", plate: 55, name: "Samsun", region: "Karadeniz", defaultTeam: "samsunspor" },
  { id: "siirt", plate: 56, name: "Siirt", region: "Güneydoğu Anadolu", defaultTeam: "amedspor" },
  { id: "sinop", plate: 57, name: "Sinop", region: "Karadeniz", defaultTeam: "besiktas" },
  { id: "sivas", plate: 58, name: "Sivas", region: "İç Anadolu", defaultTeam: "sivasspor" },
  { id: "tekirdag", plate: 59, name: "Tekirdağ", region: "Marmara", defaultTeam: "fenerbahce" },
  { id: "tokat", plate: 60, name: "Tokat", region: "Karadeniz", defaultTeam: "galatasaray" },
  { id: "trabzon", plate: 61, name: "Trabzon", region: "Karadeniz", defaultTeam: "trabzonspor" },
  { id: "tunceli", plate: 62, name: "Tunceli", region: "Doğu Anadolu", defaultTeam: "amedspor" },
  { id: "sanliurfa", plate: 63, name: "Şanlıurfa", region: "Güneydoğu Anadolu", defaultTeam: "sanliurfaspor" },
  { id: "usak", plate: 64, name: "Uşak", region: "Ege", defaultTeam: "fenerbahce" },
  { id: "van", plate: 65, name: "Van", region: "Doğu Anadolu", defaultTeam: "amedspor" },
  { id: "yozgat", plate: 66, name: "Yozgat", region: "İç Anadolu", defaultTeam: "fenerbahce" },
  { id: "zonguldak", plate: 67, name: "Zonguldak", region: "Karadeniz", defaultTeam: "besiktas" },
  { id: "aksaray", plate: 68, name: "Aksaray", region: "İç Anadolu", defaultTeam: "galatasaray" },
  { id: "bayburt", plate: 69, name: "Bayburt", region: "Karadeniz", defaultTeam: "trabzonspor" },
  { id: "karaman", plate: 70, name: "Karaman", region: "İç Anadolu", defaultTeam: "konyaspor" },
  { id: "kirikkale", plate: 71, name: "Kırıkkale", region: "İç Anadolu", defaultTeam: "ankaragucu" },
  { id: "batman", plate: 72, name: "Batman", region: "Güneydoğu Anadolu", defaultTeam: "amedspor" },
  { id: "sirnak", plate: 73, name: "Şırnak", region: "Güneydoğu Anadolu", defaultTeam: "amedspor" },
  { id: "bartin", plate: 74, name: "Bartın", region: "Karadeniz", defaultTeam: "besiktas" },
  { id: "ardahan", plate: 75, name: "Ardahan", region: "Doğu Anadolu", defaultTeam: "galatasaray" },
  { id: "igdir", plate: 76, name: "Iğdır", region: "Doğu Anadolu", defaultTeam: "igdirfk" },
  { id: "yalova", plate: 77, name: "Yalova", region: "Marmara", defaultTeam: "fenerbahce" },
  { id: "karabuk", plate: 78, name: "Karabük", region: "Karadeniz", defaultTeam: "besiktas" },
  { id: "kilis", plate: 79, name: "Kilis", region: "Güneydoğu Anadolu", defaultTeam: "galatasaray" },
  { id: "osmaniye", plate: 80, name: "Osmaniye", region: "Akdeniz", defaultTeam: "adana_demir" },
  { id: "duzce", plate: 81, name: "Düzce", region: "Karadeniz", defaultTeam: "sakaryaspor" }
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
    // Initialize clean state: totalMoneySpent starts at 0!
    INITIAL_PROVINCES.forEach(p => {
      this.data.provinces[p.id] = {
        id: p.id,
        plate: p.plate,
        name: p.name,
        region: p.region,
        currentTeamId: p.defaultTeam,
        currentBid: 0,
        totalInvested: 0,
        lastBidder: 'Henüz Sahipsiz',
        lastBidTime: Date.now(),
        bidHistory: []
      };
    });

    this.data.stats = {
      totalBidsCount: 0,
      totalMoneySpent: 0
    };

    this.data.activityFeed = [];

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
      .sort((a, b) => b.count - a.count || b.totalMoney - a.totalMoney);

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
