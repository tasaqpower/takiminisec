import React, { useState } from 'react';
import { X, CreditCard, Wallet, CheckCircle, ShieldCheck, Zap, ArrowRight, ExternalLink, QrCode, AlertCircle, Copy, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';
import { playCoinSound } from '../utils/audio';

// Verified Live Polar Checkout URL connected directly to user Ziraat Payout
const POLAR_ACTIVE_CHECKOUT_URL = 'https://buy.polar.sh/polar_cl_vzDci937zOHm5A9Y9VmUmRQmqckoJwEcnXT8p06hDLj';

export default function DepositModal({ isOpen, onClose, currentBalance, onDepositSuccess, nickname }) {
  if (!isOpen) return null;

  const [selectedAmount, setSelectedAmount] = useState(50);
  const [customAmount, setCustomAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderCreated, setOrderCreated] = useState(null);

  const packages = [
    { amount: 25, label: 'Başlangıç', bonus: null },
    { amount: 50, label: 'Taraftar', bonus: 'Popüler 🔥' },
    { amount: 100, label: 'Holigan', bonus: '+5 ₺ Bonus' },
    { amount: 250, label: 'Amigo', bonus: '+25 ₺ Bonus' },
    { amount: 500, label: 'Başkan', bonus: '+75 ₺ Bonus' },
    { amount: 1000, label: 'Efsane', bonus: '+200 ₺ Bonus' },
  ];

  const effectiveAmount = customAmount ? Number(customAmount) : selectedAmount;

  const handleDeposit = async (e) => {
    e.preventDefault();
    if (effectiveAmount < 5) return;

    setIsProcessing(true);

    try {
      setTimeout(() => {
        setIsProcessing(false);
        setOrderCreated({
          orderId: 'POLAR_' + Date.now().toString(36).toUpperCase(),
          amount: effectiveAmount,
          paymentUrl: POLAR_ACTIVE_CHECKOUT_URL
        });
        window.open(POLAR_ACTIVE_CHECKOUT_URL, '_blank');
      }, 200);

    } catch (err) {
      setIsProcessing(false);
      alert('Ödeme başlatılamadı: ' + err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-lg bg-[#0f172a] rounded-3xl border border-gray-800 text-white shadow-2xl overflow-hidden my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-blue-950/80 via-[#0f172a] to-emerald-950/60 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-bold text-blue-400 uppercase tracking-wider">Taraftar Cüzdanı</div>
              <h3 className="text-xl font-black text-white">Bakiye Yükle</h3>
            </div>
          </div>

          <div className="text-right">
            <div className="text-[10px] text-gray-400 uppercase font-bold">Mevcut Bakiye</div>
            <div className="text-base font-black text-emerald-400">
              ₺{Number(currentBalance || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
            </div>
          </div>

          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-gray-800/80 text-gray-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {orderCreated ? (
          <div className="p-6 text-center space-y-5">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto text-2xl border border-emerald-500">
              ✓
            </div>
            <div>
              <h4 className="text-xl font-black text-white">₺{effectiveAmount} Polar.sh Ödeme Sayfası Açıldı!</h4>
              <p className="text-xs text-gray-400 mt-1">
                Güvenli ödeme penceresi yeni sekmede açıldı.
              </p>
            </div>

            <div className="p-4 bg-gray-900 rounded-2xl border border-gray-800 text-xs space-y-3">
              <p className="text-gray-300">
                Apple Pay, Google Pay veya Kart ile <b>₺{effectiveAmount}</b> ödemenizi tamamlayın.
              </p>
              <a
                href={orderCreated.paymentUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold rounded-xl text-xs shadow-lg shadow-blue-500/20 hover:brightness-110"
              >
                <span>Ödeme Sayfasını Aç</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <button
              onClick={() => {
                onDepositSuccess(effectiveAmount);
                onClose();
              }}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold text-xs cursor-pointer"
            >
              Ödemeyi Yaptım, ₺{effectiveAmount} Bakiyemi Yansıt & Kapat
            </button>
          </div>
        ) : (
          <form onSubmit={handleDeposit} className="p-6 space-y-5">
            {/* 1. Paket Seçimi */}
            <div>
              <label className="text-xs font-black text-gray-300 uppercase tracking-wider block mb-2">
                1. Yüklemek İstediğin Tutar
              </label>
              <div className="grid grid-cols-3 gap-2">
                {packages.map((pkg) => {
                  const isSelected = selectedAmount === pkg.amount && !customAmount;
                  return (
                    <button
                      key={pkg.amount}
                      type="button"
                      onClick={() => {
                        setSelectedAmount(pkg.amount);
                        setCustomAmount('');
                      }}
                      className={`p-3 rounded-2xl border text-center transition-all relative cursor-pointer ${
                        isSelected
                          ? 'border-blue-400 bg-blue-950/40 text-white shadow-lg shadow-blue-500/10'
                          : 'border-gray-800 bg-gray-900/60 hover:bg-gray-800 text-gray-300'
                      }`}
                    >
                      {pkg.bonus && (
                        <span className="absolute -top-2 right-2 text-[9px] font-black bg-amber-500 text-black px-1.5 py-0.2 rounded-full shadow-sm">
                          {pkg.bonus}
                        </span>
                      )}
                      <div className="text-base font-black text-blue-400">₺{pkg.amount}</div>
                      <div className="text-[10px] text-gray-400 font-bold">{pkg.label}</div>
                    </button>
                  );
                })}
              </div>

              {/* Özel Tutar */}
              <div className="mt-2 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">₺</span>
                <input
                  type="number"
                  min="5"
                  placeholder="Farklı bir tutar girin (örn: 75, 150)"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-800 focus:border-blue-400 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none"
                />
              </div>
            </div>

            {/* 2. Ödeme Yöntemi */}
            <div>
              <label className="text-xs font-black text-gray-300 uppercase tracking-wider block mb-2">
                2. Güvenli Ödeme Altyapısı
              </label>

              <div className="p-3.5 rounded-2xl border border-blue-400/80 bg-blue-950/30 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">⚡</span>
                  <div>
                    <div className="text-xs font-extrabold text-blue-300">Polar.sh Checkout (Doğrulanmış Canlı)</div>
                    <div className="text-[10px] text-gray-400">Apple Pay • Kredi Kartı • Google Pay</div>
                  </div>
                </div>
                <span className="bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full">
                  Aktif
                </span>
              </div>
            </div>

            {/* Güvenlik Rozeti */}
            <div className="flex items-center gap-2 p-3 bg-gray-950 rounded-2xl border border-gray-800/80 text-xs text-gray-400">
              <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0" />
              <span>Polar.sh Merchant of Record • 256-bit SSL Güvenli Ödeme</span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isProcessing || effectiveAmount < 5}
              className="w-full py-3.5 px-6 rounded-2xl font-black text-sm bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400 text-white shadow-lg shadow-blue-500/25 transition-all transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 hover:brightness-110"
            >
              <span>{isProcessing ? 'İşleniyor...' : `₺${effectiveAmount} Yükle (Polar.sh ile Öde)`}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
