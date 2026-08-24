import React, { useState, useEffect } from 'react';
import { X, Flame, Shield, Coins, User, MessageSquare, History, CheckCircle, AlertCircle, Sparkles, Share2, Copy, ExternalLink } from 'lucide-react';
import confetti from 'canvas-confetti';
import { playTakeoverSound } from '../utils/audio';

export default function ProvinceModal({
  province,
  teams = [],
  isOpen,
  onClose,
  onPlaceBid,
  isSubmitting
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
  const [activeTab, setActiveTab] = useState('bid'); // 'bid' | 'history'
  const [leagueFilter, setLeagueFilter] = useState('ALL'); // 'ALL' | 'Süper Lig' | '1. Lig'
  const [teamSearch, setTeamSearch] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [conqueredState, setConqueredState] = useState(null); // { teamName, amount, bidder, provinceName }

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
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(window.location.origin)}`;
    window.open(tweetUrl, '_blank');
  };

  const handleShareWhatsApp = () => {
    if (!conqueredState) return;
    const text = `🔥 #${conqueredState.provinceName} ilini ${conqueredState.amount} ₺ teklifle ${conqueredState.teamName} yaptım! Geri almak için tıkla: ${window.location.origin}`;
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  };

  // Filtered teams
  const filteredTeams = teams.filter(t => {
    const matchesLeague = leagueFilter === 'ALL' || t.league === leagueFilter;
    const matchesSearch = t.name.toLowerCase().includes(teamSearch.toLowerCase()) || 
                          t.shortName.toLowerCase().includes(teamSearch.toLowerCase());
    return matchesLeague && matchesSearch;
  });

  const selectedTeamObj = teams.find(t => t.id === selectedTeamId) || {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      
      <div 
        className="relative w-full max-w-xl bg-[#0f172a] rounded-3xl border border-gray-800 text-white shadow-2xl overflow-hidden my-8"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div 
          className="relative px-6 py-5 border-b border-gray-800/80 transition-colors"
          style={{
            background: `linear-gradient(135deg, ${currentTeam.primaryColor || '#1e293b'} 0%, #0f172a 100%)`
          }}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/40 hover:bg-black/70 text-gray-300 hover:text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center w-12 h-12 rounded-2xl bg-black/40 border border-white/10 text-2xl font-black shadow-lg">
              {currentTeam.badge || '🇹🇷'}
            </span>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-widest font-black text-amber-400 bg-black/50 px-2 py-0.5 rounded-full border border-amber-500/20">
                  İl #{province.plate} • {province.region}
                </span>
              </div>
              <h3 className="text-2xl font-black text-white tracking-tight mt-0.5">
                {province.name}
              </h3>
            </div>
          </div>

          {/* Status Bar */}
          <div className="grid grid-cols-3 gap-2 mt-4 bg-black/50 backdrop-blur-md p-3 rounded-2xl border border-white/10 text-xs">
            <div>
              <div className="text-gray-400 text-[10px] uppercase font-bold">Mevcut Takım</div>
              <div className="font-extrabold text-white truncate flex items-center gap-1 mt-0.5">
                <span>{currentTeam.name}</span>
              </div>
            </div>
            <div>
              <div className="text-gray-400 text-[10px] uppercase font-bold">En Yüksek Teklif</div>
              <div className="font-black text-amber-400 text-sm mt-0.5">
                ₺{province.currentBid}
              </div>
            </div>
            <div>
              <div className="text-gray-400 text-[10px] uppercase font-bold">Son Sahip</div>
              <div className="font-bold text-gray-200 truncate mt-0.5">
                @{province.lastBidder || 'Anonim'}
              </div>
            </div>
          </div>
        </div>

        {/* Success Conquered Screen (Viral Share Popup) */}
        {conqueredState ? (
          <div className="p-8 text-center space-y-6">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500 text-4xl shadow-xl shadow-emerald-500/20 animate-bounce">
              {conqueredState.teamBadge}
            </div>

            <div>
              <h3 className="text-2xl font-black text-white">
                ŞEHİR SENİN TAKIMINA GEÇTİ! 🎉
              </h3>
              <p className="text-sm text-gray-300 mt-1">
                <b>{conqueredState.provinceName}</b> artık <b>{conqueredState.teamName}</b> renklerinde ve tüm Türkiye'ye canlı yayınlandı!
              </p>
            </div>

            {/* Viral Social Share Buttons */}
            <div className="space-y-3 pt-2">
              <button
                onClick={handleShareTwitter}
                className="w-full py-3.5 px-4 rounded-2xl bg-black hover:bg-gray-900 border border-gray-700 font-black text-xs uppercase tracking-wider text-white shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>𝕏</span>
                <span>X (Twitter)'da Meydan Oku & Paylaş</span>
              </button>

              <button
                onClick={handleShareWhatsApp}
                className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 font-black text-xs uppercase tracking-wider text-white shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
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
            <div className="flex border-b border-gray-800 bg-gray-950 px-6">
              <button
                onClick={() => setActiveTab('bid')}
                className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
                  activeTab === 'bid'
                    ? 'border-amber-400 text-amber-400'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                <Flame className="w-4 h-4" /> Şehri Ele Geçir
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
                  activeTab === 'history'
                    ? 'border-amber-400 text-amber-400'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                <History className="w-4 h-4" /> İhale Geçmişi ({province.bidHistory?.length || 0})
              </button>
            </div>

            {/* Tab 1: Teklif Verme Formu */}
            {activeTab === 'bid' && (
              <form onSubmit={handleSubmitBid} className="p-6 space-y-5 max-h-[65vh] overflow-y-auto">
                
                {errorMsg && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-red-950/60 border border-red-800 text-red-300 text-xs font-semibold animate-shake">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* 1. Takım Seçimi */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-black text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-amber-400" />
                      1. Şehri Yapmak İstediğin Takım
                    </label>

                    <div className="flex items-center gap-1 bg-gray-900 p-0.5 rounded-lg border border-gray-800 text-[10px]">
                      {['ALL', 'Süper Lig', '1. Lig'].map((l) => (
                        <button
                          key={l}
                          type="button"
                          onClick={() => setLeagueFilter(l)}
                          className={`px-2 py-0.5 rounded-md font-bold transition-all ${
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
                    placeholder="Takım ara (GS, FB, BJK, TS, Amed, Göztepe...)"
                    value={teamSearch}
                    onChange={(e) => setTeamSearch(e.target.value)}
                    className="w-full mb-2 bg-gray-900/90 border border-gray-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
                  />

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto p-1 bg-gray-950 rounded-2xl border border-gray-800/80">
                    {filteredTeams.map((team) => {
                      const isSelected = selectedTeamId === team.id;
                      return (
                        <button
                          key={team.id}
                          type="button"
                          onClick={() => setSelectedTeamId(team.id)}
                          className={`flex items-center gap-2 p-2 rounded-xl border text-left transition-all relative ${
                            isSelected
                              ? 'border-amber-400 bg-amber-950/40 text-white shadow-md shadow-amber-500/10'
                              : 'border-gray-800/80 bg-gray-900/60 hover:bg-gray-800 text-gray-300'
                          }`}
                        >
                          <span className="text-base">{team.badge}</span>
                          <div className="truncate">
                            <div className="text-xs font-bold truncate">{team.name}</div>
                            <div className="text-[10px] text-gray-400">{team.league}</div>
                          </div>
                          {isSelected && (
                            <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-400 animate-ping"></div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Teklif Tutarı */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-black text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Coins className="w-3.5 h-3.5 text-amber-400" />
                      2. Teklif Tutarı (TL)
                    </label>
                    <span className="text-[11px] text-amber-400 font-bold">
                      Min Gereken: ₺{minRequiredBid}
                    </span>
                  </div>

                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-lg">₺</span>
                    <input
                      type="number"
                      min={minRequiredBid}
                      value={bidAmount}
                      onChange={(e) => setBidAmount(Number(e.target.value))}
                      className="w-full bg-gray-900 border border-gray-700 focus:border-amber-400 rounded-2xl pl-9 pr-4 py-2.5 text-lg font-black text-white focus:outline-none transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-5 gap-1.5 mt-2">
                    {[1, 5, 10, 25, 50].map((inc) => (
                      <button
                        key={inc}
                        type="button"
                        onClick={() => handleQuickAdd(inc)}
                        className="bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200 text-xs font-bold py-1.5 rounded-xl transition-all"
                      >
                        +{inc} ₺
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Nickname & Slogan */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-gray-300 mb-1 block flex items-center gap-1">
                      <User className="w-3 h-3 text-amber-400" /> Nickname (Zorunlu)
                    </label>
                    <input
                      type="text"
                      placeholder="Örn: ultrAslan1905, BoğaKadıköy"
                      value={bidderName}
                      onChange={(e) => setBidderName(e.target.value)}
                      maxLength={25}
                      required
                      className="w-full bg-gray-900 border border-gray-700 focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-300 mb-1 block flex items-center gap-1">
                      <MessageSquare className="w-3 h-3 text-amber-400" /> Slogan / Mesaj
                    </label>
                    <input
                      type="text"
                      placeholder="Örn: Diyarbakır bizimdir!"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      maxLength={60}
                      className="w-full bg-gray-900 border border-gray-700 focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 px-6 rounded-2xl font-black text-sm bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black shadow-lg shadow-amber-500/25 transition-all transform active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  <Flame className="w-5 h-5 fill-current" />
                  <span>
                    {isSubmitting ? 'İşleniyor...' : `${province.name}'ı ${selectedTeamObj.name || 'Seçilen Takım'} Yap (₺${bidAmount})`}
                  </span>
                </button>

              </form>
            )}

            {/* Tab 2: İhale Geçmişi */}
            {activeTab === 'history' && (
              <div className="p-6 max-h-[65vh] overflow-y-auto space-y-3">
                {(!province.bidHistory || province.bidHistory.length === 0) ? (
                  <div className="text-center py-8 text-gray-500 text-xs">
                    Henüz bu il için bir teklif geçmişi yok.
                  </div>
                ) : (
                  province.bidHistory.map((item, idx) => {
                    const itemTeam = teams.find(t => t.id === item.teamId) || { name: item.teamId, badge: '⚽' };
                    const timeAgo = new Date(item.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

                    return (
                      <div
                        key={item.id || idx}
                        className="flex items-center justify-between p-3 rounded-xl bg-gray-950 border border-gray-800/80 text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{itemTeam.badge}</span>
                          <div>
                            <div className="font-bold text-white flex items-center gap-1.5">
                              <span>{itemTeam.name}</span>
                              <span className="text-[10px] text-gray-400 font-normal">@{item.bidder}</span>
                            </div>
                            {item.note && (
                              <div className="text-[11px] text-amber-300/80 italic mt-0.5">
                                "{item.note}"
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="font-black text-amber-400 text-sm">
                            ₺{item.amount}
                          </div>
                          <div className="text-[10px] text-gray-500">
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
