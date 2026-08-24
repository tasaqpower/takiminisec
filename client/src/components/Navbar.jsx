import React, { useState } from 'react';
import { Flame, Volume2, VolumeX, HelpCircle, Trophy, Coins, Radio, Zap, Wallet, PlusCircle } from 'lucide-react';
import { isSoundEnabled, toggleSound } from '../utils/audio';

export default function Navbar({ stats, onOpenHowToPlay, onOpenWallet, userBalance, nickname, activeView, setActiveView }) {
  const [soundOn, setSoundOn] = useState(isSoundEnabled());

  const handleToggleSound = () => {
    const nextState = !soundOn;
    toggleSound(nextState);
    setSoundOn(nextState);
  };

  return (
    <header className="bg-[#111827]/90 backdrop-blur-md border-b border-gray-800 sticky top-0 z-40 px-4 lg:px-8 py-3">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        
        {/* Brand / Logo */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-red-500 to-yellow-400 p-0.5 shadow-lg shadow-amber-500/20">
            <div className="w-full h-full bg-[#0d131f] rounded-[10px] flex items-center justify-center font-black text-xl text-amber-400">
              🇹🇷
            </div>
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-1.5">
                TAKIMINI <span className="bg-gradient-to-r from-amber-400 to-red-500 bg-clip-text text-transparent">SEÇ</span>
              </h1>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-red-950 text-red-400 border border-red-800/50 flex items-center gap-1">
                <Radio className="w-2.5 h-2.5 animate-pulse text-red-500" /> CANLI
              </span>
            </div>
            <p className="text-xs text-gray-400 font-medium hidden sm:block">
              81 İli Takımının Renklerine Boya • takiminisec.lol
            </p>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center bg-[#1a2333] p-1 rounded-xl border border-gray-700/60 shadow-inner">
          <button
            onClick={() => setActiveView('map')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeView === 'map'
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            🗺️ Harita
          </button>
          <button
            onClick={() => setActiveView('grid')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeView === 'grid'
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            📋 İller (81)
          </button>
          <button
            onClick={() => setActiveView('leaderboard')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeView === 'leaderboard'
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" /> Liderlik
          </button>
        </div>

        {/* Right Controls, Wallet & Bakiye */}
        <div className="flex items-center gap-2 sm:gap-3">
          
          {/* User Wallet Balance Pill */}
          <button
            onClick={onOpenWallet}
            className="flex items-center gap-2 bg-gradient-to-r from-emerald-950/80 to-emerald-900/60 hover:from-emerald-900 hover:to-emerald-800 border border-emerald-500/40 px-3 py-1.5 rounded-xl transition-all shadow-md group cursor-pointer"
          >
            <Wallet className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
            <div className="text-left">
              <div className="text-[9px] text-emerald-300/80 uppercase font-bold">Cüzdan</div>
              <div className="text-xs font-black text-emerald-400">
                ₺{Number(userBalance || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <PlusCircle className="w-4 h-4 text-emerald-400 ml-1" />
          </button>

          {/* Total Pool Badge */}
          <div className="hidden xl:flex items-center gap-2 bg-[#1f293d]/80 px-3 py-1.5 rounded-xl border border-amber-500/20">
            <Coins className="w-4 h-4 text-amber-400" />
            <div className="text-left">
              <div className="text-[9px] text-gray-400 uppercase font-semibold">Toplam Havuz</div>
              <div className="text-xs font-black text-amber-400">
                ₺{stats?.totalMoneySpent?.toLocaleString('tr-TR') || '0'}
              </div>
            </div>
          </div>

          {/* Sound Toggle */}
          <button
            onClick={handleToggleSound}
            title={soundOn ? "Sesi Kapat" : "Sesi Aç"}
            className={`p-2 rounded-xl border transition-all cursor-pointer ${
              soundOn 
                ? 'bg-gray-800/80 border-gray-700 text-amber-400 hover:bg-gray-700' 
                : 'bg-red-950/40 border-red-900/50 text-gray-500 hover:text-gray-300'
            }`}
          >
            {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* How to play button */}
          <button
            onClick={onOpenHowToPlay}
            className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 px-3 py-1.5 rounded-xl border border-gray-700 text-xs font-semibold transition-all cursor-pointer"
          >
            <HelpCircle className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Kurallar</span>
          </button>

        </div>

      </div>
    </header>
  );
}
