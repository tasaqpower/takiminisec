import React, { useState } from 'react';
import { Trophy, Flame, Coins, Award, TrendingUp, ArrowRight, Shield } from 'lucide-react';

export default function Leaderboard({ stats, teams = [], onSelectProvince }) {
  const [activeTab, setActiveTab] = useState('teams'); // 'teams' | 'provinces'

  const teamLeaderboard = stats?.teamLeaderboard || [];
  const topProvinces = stats?.topProvinces || [];

  const getTeam = (teamId) => {
    return teams.find(t => t.id === teamId) || {
      name: teamId,
      shortName: teamId,
      primaryColor: '#444',
      badge: '⚽'
    };
  };

  return (
    <div className="bg-[#0d131f] rounded-2xl border border-gray-800 p-4 lg:p-6 shadow-2xl text-white">
      
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-gray-800/80 pb-4 mb-6">
        <div>
          <h2 className="text-xl font-black flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            LİDERLİK & İSTATİSTİKLER
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Türkiye genelinde takımların il hakimiyeti ve en çekişmeli arenalar
          </p>
        </div>

        <div className="flex items-center bg-gray-900 p-1 rounded-xl border border-gray-800 text-xs">
          <button
            onClick={() => setActiveTab('teams')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'teams'
                ? 'bg-amber-500 text-black shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Shield className="w-3.5 h-3.5" /> Takım Hakimiyeti
          </button>
          <button
            onClick={() => setActiveTab('provinces')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'provinces'
                ? 'bg-amber-500 text-black shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Flame className="w-3.5 h-3.5" /> En Çekişmeli İller
          </button>
        </div>
      </div>

      {/* Tab 1: Takım Liderliği */}
      {activeTab === 'teams' && (
        <div className="space-y-4">
          
          {/* Top 3 Podium Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
            {teamLeaderboard.slice(0, 3).map((item, index) => {
              const medals = ['🥇 1. Sırada', '🥈 2. Sırada', '🥉 3. Sırada'];
              const borderColors = ['border-amber-500/50 bg-amber-950/20', 'border-gray-400/50 bg-gray-900/40', 'border-amber-700/50 bg-amber-950/10'];

              return (
                <div
                  key={item.teamId}
                  className={`p-4 rounded-2xl border ${borderColors[index]} relative overflow-hidden flex flex-col justify-between`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase text-amber-400">
                      {medals[index]}
                    </span>
                    <span className="text-2xl">{item.badge}</span>
                  </div>

                  <div className="my-3">
                    <h4 className="text-lg font-black text-white">{item.name}</h4>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-2xl font-black text-amber-400">{item.count} İl</span>
                      <span className="text-xs text-gray-400 font-bold">({item.percentage}%)</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-white/5">
                    <span>Toplam Yatırım:</span>
                    <span className="font-bold text-emerald-400">₺{item.totalMoney?.toLocaleString('tr-TR')}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Full Teams Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-900/80 text-gray-400 uppercase font-black tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3 rounded-l-xl">Sıra</th>
                  <th className="px-4 py-3">Takım</th>
                  <th className="px-4 py-3">İl Sayısı</th>
                  <th className="px-4 py-3">Harita Payı</th>
                  <th className="px-4 py-3">Toplam Havuz</th>
                  <th className="px-4 py-3 rounded-r-xl text-right">Durum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {teamLeaderboard.map((team, idx) => (
                  <tr key={team.teamId} className="hover:bg-gray-900/50 transition-colors">
                    <td className="px-4 py-3.5 font-black text-gray-400">
                      #{idx + 1}
                    </td>
                    <td className="px-4 py-3.5 font-bold text-white flex items-center gap-2">
                      <span className="text-base">{team.badge}</span>
                      <span>{team.name}</span>
                    </td>
                    <td className="px-4 py-3.5 font-black text-amber-400 text-sm">
                      {team.count} İl
                    </td>
                    <td className="px-4 py-3.5 w-1/4">
                      <div className="flex items-center gap-2">
                        <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${team.percentage}%`,
                              backgroundColor: team.primaryColor || '#f59e0b'
                            }}
                          ></div>
                        </div>
                        <span className="text-[11px] font-bold text-gray-300 min-w-[35px]">
                          %{team.percentage}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-bold text-emerald-400">
                      ₺{team.totalMoney?.toLocaleString('tr-TR')}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span 
                        className="px-2 py-0.5 rounded text-[10px] font-bold text-white"
                        style={{ backgroundColor: team.primaryColor || '#333' }}
                      >
                        {team.shortName}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* Tab 2: En Çekişmeli İller */}
      {activeTab === 'provinces' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {topProvinces.map((prov, index) => {
              const team = getTeam(prov.currentTeamId);

              return (
                <div
                  key={prov.id}
                  className="p-4 rounded-2xl bg-gray-900/60 border border-gray-800 hover:border-amber-500/50 transition-all flex items-center justify-between gap-4 group"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gray-800 border border-gray-700 font-black text-amber-400 text-sm">
                      #{index + 1}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-black text-base text-white">{prov.name}</h4>
                        <span className="text-[10px] text-gray-400">({prov.region})</span>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs mt-1">
                        <span className="text-gray-400">Hakim:</span>
                        <span 
                          className="font-bold px-1.5 py-0.5 rounded text-white text-[10px] flex items-center gap-1"
                          style={{ backgroundColor: team.primaryColor || '#333' }}
                        >
                          <span>{team.badge}</span>
                          <span>{team.name}</span>
                        </span>
                        <span className="text-gray-400 text-[10px]">by @{prov.lastBidder}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-[10px] text-gray-400 uppercase font-bold">Mevcut Teklif</div>
                      <div className="text-base font-black text-amber-400">₺{prov.currentBid}</div>
                    </div>

                    <button
                      onClick={() => onSelectProvince(prov.id)}
                      className="p-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold transition-all shadow-md group-hover:scale-105 cursor-pointer"
                      title="Teklif Ver"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
