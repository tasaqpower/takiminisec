import React, { useState, useEffect } from 'react';
import { X, Flame, Shield, Coins, User, MessageSquare, History, CheckCircle, AlertCircle, Sparkles, Share2, Copy, ExternalLink, Wallet } from 'lucide-react';
import confetti from 'canvas-confetti';
import { playTakeoverSound } from '../utils/audio';

export default function ProvinceModal({
  province,
  teams = [],
  isOpen,
  onClose,
  onPlaceBid,
  isSubmitting,
  userBalance = 0,
  onOpenWallet
}) {
  if (!isOpen || !province) return null;

  const currentTeam = teams.find(t => t.id === province.currentTeamId) || {
    id: province.currentTeamId,
    name: 'Belirtilmemiş',
    shortName: '---',
    primaryColor: '#333',
    badge: '⚽'
  };

  const minRequiredBid = (province.currentBid || 0) + 1;

  // Form State
  const [selectedTeamId, setSelectedTeamId] = useState(
    teams.find(t => t.id !== province.currentTeamId)?.id || 'galatasaray'
  );
  const [bidAmount, setBidAmount] = useState(minRequiredBid);
  const [bidderName, setBidderName] = useState(
    localStorage.getItem('outbid_nickname') || ''
  );
  const [note, setNote] = useState('');
  const [activeTab, setActiveTab] = useState('bid');
  const [leagueFilter, setLeagueFilter] = useState('ALL');
  const [teamSearch, setTeamSearch] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [conqueredState, setConqueredState] = useState(null);

  useEffect(() => {
    setBidAmount(minRequiredBid);
    setErrorMsg('');
    setConqueredState(null);
  }, [province.currentBid, minRequiredBid, province.id]);

  const handleQuickAdd = (increment) => {
    setBidAmount(prev => Math.max(minRequiredBid, prev + increment));
  };

  const handleSubmitBid = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!bidderName.trim()) {
      setErrorMsg('Lütfen bir kullanıcı adı (nickname) girin!');
      return;
    }

    if (Number(bidAmount) < minRequiredBid) {
      setErrorMsg(`Teklif yetersiz! Minimum gereken tutar: ${minRequiredBid} ₺`);
      return;
    }

    if (!selectedTeamId) {
      setErrorMsg('Lütfen şehri boyamak istediğiniz takımı seçin!');
      return;
    }

    if (userBalance < Number(bidAmount)) {
      setErrorMsg(`Cüzdan bakiyeniz yetersiz! (Mevcut: ₺${userBalance.toFixed(2)}, Gereken: ₺${bidAmount}). Lütfen önce bakiye yükleyin.`);
      return;
    }

    localStorage.setItem('outbid_nickname', bidderName.trim());

    try {
      const selectedTeam = teams.find(t => t.id === selectedTeamId);
      
      await onPlaceBid({
        provinceId: province.id,
        teamId: selectedTeamId,
        amount: Number(bidAmount),
        bidder: bidderName.trim(),
        note: note.trim()
      });

      confetti({
        particleCount: 150,
        spread: 90,
        origin: { y: 0.6 }
      });
      playTakeoverSound();

      setConqueredState({
        teamName: selectedTeam?.name || 'Takımın',
        teamBadge: selectedTeam?.badge || '⚽',
        amount: bidAmount,
        bidder: bidderName.trim(),
        provinceName: province.name
      });
    } catch (err) {
      setErrorMsg(err.message || 'Teklif verilirken bir hata oluştu.');
    }
  };

  const handleShareTwitter = () => {
    if (!conqueredState) return;
    const tweetText = `🔥 #${conqueredState.provinceName} ilini ${conqueredState.amount} ₺ teklifle ${conqueredState.teamName} yaptım!\n\nŞehrini korumaya veya geri almaya gücün yetiyorsa gel geç bakalım:`;
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent('https://takiminisec.lol')}`;
    window.open(tweetUrl, '_blank');
  };

  const handleShareWhatsApp = () => {
    if (!conqueredState) return;
    const text = `🔥 #${conqueredState.provinceName} ilini ${conqueredState.amount} ₺ teklifle ${conqueredState.teamName} yaptım! Geri almak için tıkla: https://takiminisec.lol`;
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  };

  const filteredTeams = teams.filter(t => {
    const matchesLeague = leagueFilter === 'ALL' || t.league === leagueFilter;
    const matchesSearch = t.name.toLowerCase().includes(teamSearch.toLowerCase()) || 
                          t.shortName.toLowerCase().includes(teamSearch.toLowerCase());
    return matchesLeague && matchesSearch;
  });

  const selectedTeamObj = teams.find(t => t.id === selectedTeamId) || {};
  const isBalanceLow = userBalance < Number(bidAmount);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      
      <div 
        className="relative w-full max-w-xl bg-[#0f172a] rounded-t-3xl sm:rounded-3xl border border-gray-800 text-white shadow-2xl overflow-hidden max-h-[92vh] sm:max-h-[90vh] flex flex-col my-0 sm:my-8"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div 
          className="relative px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-800/80 transition-colors shrink-0"
          style={{
            background: `linear-gradient(135deg, ${currentTeam.primaryColor || '#1e293b'} 0%, #0f172a 100%)`
          }}
        >
          <button
            onClick={onClose}
            className="absolute top-3 right-3 sm:top-4 sm:right-4 p-2 rounded-full bg-black/40 hover:bg-black/70 text-gray-300 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-black/40 border border-white/10 text-xl sm:text-2xl font-black shadow-lg">
              {currentTeam.badge || '🇹🇷'}
            </span>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] sm:text-xs uppercase tracking-widest font-black text-amber-400 bg-black/50 px-2 py-0.5 rounded-full border border-amber-500/20">
                  İl #{province.plate} • {province.region}
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-0.5">
                {province.name}
              </h3>
            </div>
          </div>

          {/* Status Bar */}
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2 mt-3 bg-black/50 backdrop-blur-md p-2.5 sm:p-3 rounded-2xl border border-white/10 text-xs">
            <div>
              <div className="text-gray-400 text-[9px] uppercase font-bold">Mevcut Takım</div>
              <div className="font-extrabold text-white truncate text-[11px] sm:text-xs mt-0.5">
                {currentTeam.name}
              </div>
            </div>
            <div>
              <div className="text-gray-400 text-[9px] uppercase font-bold">En Yüksek Teklif</div>
              <div className="font-black text-amber-400 text-xs sm:text-sm mt-0.5">
                ₺{province.currentBid}
              </div>
            </div>
            <div>
              <div className="text-gray-400 text-[9px] uppercase font-bold">Son Sahip</div>
              <div className="font-bold text-gray-200 truncate text-[11px] sm:text-xs mt-0.5">
                @{province.lastBidder || 'Anonim'}
              </div>
            </div>
          </div>
        </div>

        {/* Success Conquered Screen */}
        {conqueredState ? (
          <div className="p-6 sm:p-8 text-center space-y-5 overflow-y-auto">
            <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500 text-3xl sm:text-4xl shadow-xl shadow-emerald-500/20 animate-bounce">
              {conqueredState.teamBadge}
            </div>

            <div>
              <h3 className="text-xl sm:text-2xl font-black text-white">
                ŞEHİR SENİN TAKIMINA GEÇTİ! 🎉
              </h3>
              <p className="text-xs sm:text-sm text-gray-300 mt-1">
                <b>{conqueredState.provinceName}</b> artık <b>{conqueredState.teamName}</b> renklerinde!
              </p>
            </div>

            {/* Social Share Buttons */}
            <div className="space-y-2.5 pt-2">
              <button
                onClick={handleShareTwitter}
                className="w-full py-3 sm:py-3.5 px-4 rounded-2xl bg-black hover:bg-gray-900 border border-gray-700 font-black text-xs uppercase tracking-wider text-white shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>𝕏</span>
                <span>X (Twitter)'da Meydan Oku & Paylaş</span>
              </button>

              <button
                onClick={handleShareWhatsApp}
                className="w-full py-3 sm:py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 font-black text-xs uppercase tracking-wider text-white shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                <span>WhatsApp Gruplarına At</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="text-xs text-gray-400 hover:text-white underline cursor-pointer"
            >
              Haritaya Dön
            </button>
          </div>
        ) : (
          <>
            {/* Modal Tabs */}
            <div className="flex border-b border-gray-800 bg-gray-950 px-4 sm:px-6 shrink-0">
              <button
                onClick={() => setActiveTab('bid')}
                className={`py-2.5 sm:py-3 px-3 sm:px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'bid'
                    ? 'border-amber-400 text-amber-400'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                <Flame className="w-3.5 h-3.5" /> Şehri Ele Geçir
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`py-2.5 sm:py-3 px-3 sm:px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'history'
                    ? 'border-amber-400 text-amber-400'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                <History className="w-3.5 h-3.5" /> Geçmiş ({province.bidHistory?.length || 0})
              </button>
            </div>

            {/* Tab 1: Teklif Verme Formu */}
            {activeTab === 'bid' && (
              <form onSubmit={handleSubmitBid} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
                
                {errorMsg && (
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-950/60 border border-red-800 text-red-300 text-xs font-semibold">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* Balance Notification */}
                <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-2xl bg-gray-900 border border-gray-800 text-xs">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-emerald-400" />
                    <span className="text-gray-400">Bakiyen:</span>
                    <span className="font-black text-emerald-400">₺{userBalance.toFixed(2)}</span>
                  </div>
                  {isBalanceLow && (
                    <button
                      type="button"
                      onClick={onOpenWallet}
                      className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-[11px] rounded-lg transition-all cursor-pointer"
                    >
                      + Bakiye Yükle
                    </button>
                  )}
                </div>

                {/* 1. Takım Seçimi */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] sm:text-xs font-black text-gray-300 uppercase tracking-wider flex items-center gap-1">
                      <Shield className="w-3 h-3 text-amber-400" />
                      1. Yapmak İstediğin Takım
                    </label>

                    <div className="flex items-center gap-1 bg-gray-900 p-0.5 rounded-lg border border-gray-800 text-[9px]">
                      {['ALL', 'Süper Lig', '1. Lig'].map((l) => (
                        <button
                          key={l}
                          type="button"
                          onClick={() => setLeagueFilter(l)}
                          className={`px-1.5 py-0.5 rounded font-bold transition-all ${
                            leagueFilter === l ? 'bg-amber-500 text-black' : 'text-gray-400 hover:text-white'
                          }`}
                        >
                          {l === 'ALL' ? 'Tümü' : l}
                        </button>
                      ))}
                    </div>
                  </div>

                  <input
                    type="text"
                    placeholder="Takım ara (GS, FB, BJK, TS, Amed...)"
                    value={teamSearch}
                    onChange={(e) => setTeamSearch(e.target.value)}
                    className="w-full mb-1.5 bg-gray-900/90 border border-gray-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
                  />

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-36 overflow-y-auto p-1 bg-gray-950 rounded-xl border border-gray-800/80">
                    {filteredTeams.map((team) => {
                      const isSelected = selectedTeamId === team.id;
                      return (
                        <button
                          key={team.id}
                          type="button"
                          onClick={() => setSelectedTeamId(team.id)}
                          className={`flex items-center gap-1.5 p-1.5 sm:p-2 rounded-xl border text-left transition-all relative cursor-pointer ${
                            isSelected
                              ? 'border-amber-400 bg-amber-950/40 text-white shadow-md'
                              : 'border-gray-800/80 bg-gray-900/60 hover:bg-gray-800 text-gray-300'
                          }`}
                        >
                          <span className="text-sm sm:text-base">{team.badge}</span>
                          <div className="truncate">
                            <div className="text-[11px] sm:text-xs font-bold truncate">{team.name}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Teklif Tutarı */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] sm:text-xs font-black text-gray-300 uppercase tracking-wider flex items-center gap-1">
                      <Coins className="w-3 h-3 text-amber-400" />
                      2. Teklif Tutarı (TL)
                    </label>
                    <span className="text-[10px] sm:text-[11px] text-amber-400 font-bold">
                      Min: ₺{minRequiredBid}
                    </span>
                  </div>

                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-base">₺</span>
                    <input
                      type="number"
                      min={minRequiredBid}
                      value={bidAmount}
                      onChange={(e) => setBidAmount(Number(e.target.value))}
                      className="w-full bg-gray-900 border border-gray-700 focus:border-amber-400 rounded-xl pl-8 pr-3 py-2 text-base font-black text-white focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-5 gap-1 mt-1.5">
                    {[1, 5, 10, 25, 50].map((inc) => (
                      <button
                        key={inc}
                        type="button"
                        onClick={() => handleQuickAdd(inc)}
                        className="bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200 text-[11px] font-bold py-1 rounded-lg transition-all cursor-pointer"
                      >
                        +{inc}₺
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Nickname & Slogan */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-bold text-gray-300 mb-1 block">
                      Nickname (Zorunlu)
                    </label>
                    <input
                      type="text"
                      placeholder="Örn: ultrAslan, Carsi"
                      value={bidderName}
                      onChange={(e) => setBidderName(e.target.value)}
                      maxLength={25}
                      required
                      className="w-full bg-gray-900 border border-gray-700 focus:border-amber-400 rounded-xl px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-gray-300 mb-1 block">
                      Slogan / Not
                    </label>
                    <input
                      type="text"
                      placeholder="Örn: Şehir bizimdir!"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      maxLength={60}
                      className="w-full bg-gray-900 border border-gray-700 focus:border-amber-400 rounded-xl px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Action Button */}
                {isBalanceLow ? (
                  <button
                    type="button"
                    onClick={onOpenWallet}
                    className="w-full py-3.5 px-4 rounded-2xl font-black text-xs sm:text-sm bg-gradient-to-r from-emerald-500 to-teal-500 text-black shadow-lg shadow-emerald-500/25 transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Wallet className="w-4 h-4" />
                    <span>Bakiyen Yetersiz • Bakiye Yükle (Shopier)</span>
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3.5 px-4 rounded-2xl font-black text-xs sm:text-sm bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 text-black shadow-lg shadow-amber-500/25 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    <Flame className="w-4 h-4 fill-current" />
                    <span>
                      {isSubmitting ? 'İşleniyor...' : `${province.name}'ı ${selectedTeamObj.name || 'Takımın'} Yap (₺${bidAmount})`}
                    </span>
                  </button>
                )}

              </form>
            )}

            {/* Tab 2: İhale Geçmişi */}
            {activeTab === 'history' && (
              <div className="p-4 sm:p-6 overflow-y-auto space-y-2 flex-1">
                {(!province.bidHistory || province.bidHistory.length === 0) ? (
                  <div className="text-center py-6 text-gray-500 text-xs">
                    Henüz bu il için bir teklif geçmişi yok.
                  </div>
                ) : (
                  province.bidHistory.map((item, idx) => {
                    const itemTeam = teams.find(t => t.id === item.teamId) || { name: item.teamId, badge: '⚽' };
                    const timeAgo = new Date(item.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

                    return (
                      <div
                        key={item.id || idx}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-gray-950 border border-gray-800/80 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-base">{itemTeam.badge}</span>
                          <div>
                            <div className="font-bold text-white flex items-center gap-1">
                              <span>{itemTeam.name}</span>
                              <span className="text-[10px] text-gray-400 font-normal">@{item.bidder}</span>
                            </div>
                            {item.note && (
                              <div className="text-[10px] text-amber-300/80 italic mt-0.5">
                                "{item.note}"
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="font-black text-amber-400 text-xs sm:text-sm">
                            ₺{item.amount}
                          </div>
                          <div className="text-[9px] text-gray-500">
                            {timeAgo}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}
