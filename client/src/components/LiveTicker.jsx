import React from 'react';
import { Flame, ArrowRight, TrendingUp } from 'lucide-react';

export default function LiveTicker({ activity = [], teams = [], onSelectProvince }) {
  if (!activity || activity.length === 0) return null;

  const getTeam = (teamId) => {
    return teams.find(t => t.id === teamId) || { name: teamId, badge: '⚽', primaryColor: '#444' };
  };

  return (
    <div className="bg-gradient-to-r from-gray-950 via-[#131b2e] to-gray-950 border-b border-gray-800/80 py-2 overflow-hidden shadow-inner relative z-30">
      <div className="max-w-7xl mx-auto px-4 flex items-center gap-3">
        
        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-red-600/20 border border-red-500/30 text-red-400 text-xs font-black uppercase tracking-wider shrink-0 shadow-sm">
          <Flame className="w-3.5 h-3.5 text-red-500 animate-bounce" />
          <span>CANLI AKIŞ</span>
        </div>

        {/* Scrolling Ticker Strip */}
        <div className="flex items-center gap-4 overflow-x-auto no-scrollbar py-0.5 scroll-smooth">
          {activity.slice(0, 10).map((act, index) => {
            const team = getTeam(act.teamId);
            const prevTeam = act.prevTeamId ? getTeam(act.prevTeamId) : null;

            return (
              <button
                key={act.id || index}
                onClick={() => onSelectProvince(act.provinceId)}
                className="flex items-center gap-2 px-3 py-1 rounded-lg bg-gray-900/80 hover:bg-gray-800 border border-gray-800 hover:border-amber-500/40 transition-all text-xs shrink-0 group cursor-pointer shadow-sm"
              >
                <span className="font-bold text-amber-300">
                  {act.provinceName}
                </span>

                <div className="flex items-center gap-1 text-[11px] text-gray-400">
                  {prevTeam && (
                    <span className="opacity-70 line-through text-gray-500 flex items-center gap-0.5">
                      {prevTeam.badge} {prevTeam.shortName || prevTeam.name}
                    </span>
                  )}
                  {prevTeam && <ArrowRight className="w-3 h-3 text-amber-500 group-hover:translate-x-0.5 transition-transform" />}
                  
                  <span 
                    className="font-bold px-1.5 py-0.5 rounded text-white flex items-center gap-1 shadow-sm"
                    style={{ backgroundColor: team.primaryColor || '#333' }}
                  >
                    <span>{team.badge}</span>
                    <span>{team.shortName || team.name}</span>
                  </span>
                </div>

                <span className="font-black text-emerald-400 bg-emerald-950/50 border border-emerald-800/40 px-1.5 py-0.2 rounded text-[11px]">
                  ₺{act.amount}
                </span>

                <span className="text-[10px] text-gray-400 font-medium">
                  by <b className="text-gray-200">@{act.bidder}</b>
                </span>
              </button>
            );
          })}
        </div>

      </div>
    </div>
  );
}
