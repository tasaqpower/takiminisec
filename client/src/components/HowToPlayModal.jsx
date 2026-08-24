import React from 'react';
import { X, Flame, Shield, Coins, Zap, Trophy } from 'lucide-react';

export default function HowToPlayModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div 
        className="relative w-full max-w-lg bg-[#0f172a] rounded-3xl border border-gray-800 text-white shadow-2xl p-6 my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-gray-800 text-gray-400 hover:text-white transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <span className="text-3xl">🇹🇷</span>
          <div>
            <h3 className="text-xl font-black text-white">Outbid Türkiye Nedir?</h3>
            <p className="text-xs text-amber-400 font-bold">Oyun Mantığı & Kurallar</p>
          </div>
        </div>

        <div className="space-y-4 text-xs text-gray-300">
          
          <div className="flex items-start gap-3 p-3 rounded-2xl bg-gray-900/80 border border-gray-800">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-extrabold text-white text-sm mb-0.5">1. Teklifi Geç (Outbid)</h4>
              <p>
                Herhangi bir ili kendi takımına geçirmek için, o ildeki mevcut en yüksek tekliften en az <b>+1 ₺</b> daha fazla teklif vermelisin.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-2xl bg-gray-900/80 border border-gray-800">
            <div className="p-2 rounded-xl bg-red-500/20 text-red-400 shrink-0">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-extrabold text-white text-sm mb-0.5">2. Anlık Canlı Harita</h4>
              <p>
                Teklif verdiğin anda haritada o il senin takımının renklerine boyanır, takımının arması yerleşir ve tüm Türkiye'deki kullanıcıların ekranında canlı güncellenir!
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-2xl bg-gray-900/80 border border-gray-800">
            <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 shrink-0">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-extrabold text-white text-sm mb-0.5">3. Şampiyonluk & Liderlik</h4>
              <p>
                En çok ile sahip olan takım Türkiye'nin lideri olur. Takımını zirveye taşımak için taraftarlarını topla ve şehirleri ele geçir!
              </p>
            </div>
          </div>

        </div>

        <div className="mt-6">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 text-black font-black text-xs uppercase tracking-wider transition-all hover:brightness-110 shadow-lg cursor-pointer"
          >
            Anladım, Takımımı Seçeyim! ⚽
          </button>
        </div>

      </div>
    </div>
  );
}
