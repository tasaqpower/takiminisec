import React from 'react';
import { Trophy, HelpCircle, Map, Grid, Volume2, VolumeX, Flame, Wallet, Plus, Shield } from 'lucide-react';
import { isSoundEnabled, toggleSound } from '../utils/audio';

export default function Navbar({
  stats,
  onOpenHowToPlay,
  onOpenWallet,
  userBalance = 0,
  nickname,
  activeView,
  setActiveView
}) {
  const [sound, setSound] = React.useState(isSoundEnabled());

  const handleToggleSound = () => {
    const next = !sound;
    setSound(next);
    toggleSound(next);
  };

  return (
    <header className="sticky top-0 z-40 bg-[#070a12]/95 backdrop-blur-md border-b border-gray-800/80 px-2.5 sm:px-6 py-2 sm:py-3 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
        
        {/* Left: Brand Logo */}
        <div className="flex items-center gap-1.5 sm:gap-3 cursor-pointer shrink-0" onClick={() => setActiveView('map')}>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-red-600 flex items-center justify-center text-black font-black text-base sm:text-xl shadow-lg shadow-amber-500/20">
            🇹🇷
          </div>
          <div>
            <div className="flex items-center gap-1">
              <h1 className="font-black text-xs sm:text-base tracking-tight text-white flex items-center gap-1">
                <span>TAKIMINI SEÇ</span>
                <span className="text-[8px] sm:text-[9px] font-extrabold bg-red-600 text-white px-1 sm:px-1.5 py-0.2 rounded-full uppercase">
                  CANLI
                </span>
              </h1>
            </div>
          </div>
        </div>

        {/* Center: Live Total Pool (Always Visible on Mobile & Desktop!) */}
        <div className="flex items-center gap-1.5 bg-gray-900/90 border border-amber-500/30 px-2 sm:px-3 py-1 rounded-xl shadow-sm shrink-0">
          <Flame className="w-3.5 h-3.5 text-amber-400 fill-current animate-pulse shrink-0" />
          <div className="leading-none text-left">
            <div className="text-[8px] sm:text-[9px] text-gray-400 uppercase font-bold">Havuz</div>
            <div className="font-black text-amber-400 text-xs sm:text-sm">
              ₺{Number(stats?.totalMoneySpent || 0).toLocaleString('tr-TR')}
            </div>
          </div>
        </div>

        {/* Right: Wallet + Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          
          {/* User Wallet Pill */}
          <button
            onClick={onOpenWallet}
            className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-950/80 to-emerald-900/60 border border-emerald-500/40 hover:border-emerald-400 px-2 sm:px-3 py-1.5 rounded-xl text-xs font-bold text-white transition-all cursor-pointer shadow-lg shadow-emerald-950/40 active:scale-95 shrink-0"
          >
            <Wallet className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <div className="text-left leading-none">
              <div className="text-[8px] text-gray-400 uppercase font-semibold hidden sm:block">Cüzdan</div>
              <div className="text-emerald-400 font-black text-[11px] sm:text-xs">
                ₺{Number(userBalance || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Plus className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
            </div>
          </button>

          {/* Sound Toggle */}
          <button
            onClick={handleToggleSound}
            className="p-1.5 sm:p-2 rounded-xl bg-gray-900/80 border border-gray-800 text-gray-400 hover:text-white transition-all cursor-pointer"
            title={sound ? "Sesi Kapat" : "Sesi Aç"}
          >
            {sound ? <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" /> : <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
          </button>

          {/* How to play */}
          <button
            onClick={onOpenHowToPlay}
            className="p-1.5 sm:p-2 rounded-xl bg-gray-900/80 border border-gray-800 text-gray-400 hover:text-white transition-all cursor-pointer hidden xs:block"
            title="Nasıl Oynanır?"
          >
            <HelpCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-300" />
          </button>

        </div>

      </div>
    </header>
  );
}
