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
    <header className="sticky top-0 z-40 bg-[#070a12]/95 backdrop-blur-md border-b border-gray-800/80 px-3 sm:px-6 py-2.5 sm:py-3.5 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
        
        {/* Left: Brand Logo */}
        <div className="flex items-center gap-2 sm:gap-3 cursor-pointer shrink-0" onClick={() => setActiveView('map')}>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-red-600 flex items-center justify-center text-black font-black text-base sm:text-xl shadow-lg shadow-amber-500/20">
            🇹🇷
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="font-black text-sm sm:text-lg tracking-tight text-white flex items-center gap-1">
                <span>TAKIMINI SEÇ</span>
                <span className="text-[9px] sm:text-[10px] font-extrabold bg-red-600 text-white px-1.5 py-0.2 rounded-full uppercase tracking-wider">
                  CANLI
                </span>
              </h1>
            </div>
            <p className="text-[10px] text-gray-400 font-medium hidden sm:block">
              81 İl Canlı Futbol Meydanı
            </p>
          </div>
        </div>

        {/* Center: View Switcher Tabs */}
        <div className="flex items-center bg-gray-900/90 border border-gray-800 p-1 rounded-xl sm:rounded-2xl shrink-0">
          <button
            onClick={() => setActiveView('map')}
            className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-lg sm:rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeView === 'map'
                ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20 font-black'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Map className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Harita</span>
          </button>

          <button
            onClick={() => setActiveView('grid')}
            className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-lg sm:rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeView === 'grid'
                ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20 font-black'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">81 İl</span>
          </button>

          <button
            onClick={() => setActiveView('leaderboard')}
            className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-lg sm:rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeView === 'leaderboard'
                ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20 font-black'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Liderlik</span>
          </button>
        </div>

        {/* Right: Wallet + Pool + Sound */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          
          {/* User Wallet Pill */}
          <button
            onClick={onOpenWallet}
            className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-950/80 to-emerald-900/60 border border-emerald-500/40 hover:border-emerald-400 px-2 sm:px-3 py-1.5 rounded-xl text-xs font-bold text-white transition-all cursor-pointer shadow-lg shadow-emerald-950/40 active:scale-95 shrink-0"
          >
            <Wallet className="w-3.5 h-3.5 text-emerald-400" />
            <div className="text-left leading-none">
              <div className="text-[9px] text-gray-400 uppercase font-semibold hidden sm:block">Cüzdan</div>
              <div className="text-emerald-400 font-black text-[11px] sm:text-xs">
                ₺{Number(userBalance || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center ml-0.5">
              <Plus className="w-3 h-3" />
            </div>
          </button>

          {/* Total Pool Counter */}
          <div className="hidden md:flex items-center gap-2 bg-gray-900/90 border border-gray-800 px-3 py-1.5 rounded-xl text-xs">
            <Flame className="w-3.5 h-3.5 text-amber-400 fill-current animate-pulse" />
            <div>
              <div className="text-[9px] text-gray-400 uppercase font-bold">Toplam Havuz</div>
              <div className="font-black text-amber-400 text-xs">
                ₺{stats?.totalMoneySpent || 0}
              </div>
            </div>
          </div>

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
            className="p-1.5 sm:p-2 rounded-xl bg-gray-900/80 border border-gray-800 text-gray-400 hover:text-white transition-all cursor-pointer"
            title="Nasıl Oynanır?"
          >
            <HelpCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-300" />
          </button>

        </div>

      </div>
    </header>
  );
}
