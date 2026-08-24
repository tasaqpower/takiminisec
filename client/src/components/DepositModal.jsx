import React, { useState } from 'react';
import { X, CreditCard, Wallet, CheckCircle, ShieldCheck, Zap, ArrowRight, ExternalLink, QrCode, AlertCircle, Copy } from 'lucide-react';
import confetti from 'canvas-confetti';
import { playCoinSound } from '../utils/audio';

export default function DepositModal({ isOpen, onClose, currentBalance, onDepositSuccess, nickname }) {
  if (!isOpen) return null;

  const [selectedAmount, setSelectedAmount] = useState(50);
  const [customAmount, setCustomAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('card'); // 'card' | 'papara' | 'iban' | 'test'
  const [isProcessing, setIsProcessing] = useState(false);
  const [copiedText, setCopiedText] = useState(null);
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

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedText(key);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleDeposit = async (e) => {
    e.preventDefault();
    if (effectiveAmount < 5) return;

    setIsProcessing(true);

    try {
      // 1. If Test/Instant Mode:
      if (paymentMethod === 'test') {
        setTimeout(() => {
          setIsProcessing(false);
          onDepositSuccess(effectiveAmount);
          confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
          playCoinSound();
          onClose();
        }, 600);
        return;
      }

      // 2. Real Payment / Order generation
      const res = await fetch('/api/payment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: effectiveAmount,
          bidder: nickname || 'Anonim Taraftar',
          paymentMethod
        })
      });
      const data = await res.json();
      setIsProcessing(false);

      if (data.success) {
        setOrderCreated(data);
        if (paymentMethod === 'card' && data.paymentUrl) {
          window.open(data.paymentUrl, '_blank');
        }
      }
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
        <div className="p-6 bg-gradient-to-r from-emerald-950/80 via-[#0f172a] to-emerald-950/60 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Taraftar Cüzdanı</div>
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
              <h4 className="text-xl font-black text-white">Ödeme Emri Oluşturuldu!</h4>
              <p className="text-xs text-gray-400 mt-1">
                Referans No: <b className="text-amber-400">{orderCreated.orderId}</b>
              </p>
            </div>

            {paymentMethod === 'card' && (
              <div className="p-4 bg-gray-900 rounded-2xl border border-gray-800 text-xs space-y-3">
                <p className="text-gray-300">
                  Shopier / Kart ödeme sayfası açıldı. Ödemeyi tamamladığınızda bakiyeniz otomatik yüklenecektir.
                </p>
                <a
                  href={orderCreated.paymentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-black font-bold rounded-xl text-xs"
                >
                  <span>Ödeme Sayfasını Tekrar Aç</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}

            {paymentMethod === 'papara' && (
              <div className="p-4 bg-gray-900 rounded-2xl border border-gray-800 text-left text-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Papara No:</span>
                  <button
                    onClick={() => handleCopy('1234567890', 'papara')}
                    className="font-bold text-white flex items-center gap-1 hover:text-amber-400"
                  >
                    <span>1234567890</span>
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Açıklama (Zorunlu):</span>
                  <button
                    onClick={() => handleCopy(orderCreated.orderId, 'ref')}
                    className="font-black text-amber-400 flex items-center gap-1"
                  >
                    <span>{orderCreated.orderId}</span>
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
                <p className="text-[11px] text-gray-400 italic">
                  Papara transferinin açıklama kısmına referans kodunuzu yazınız. 1-2 dakika içinde bakiye tanımlanır.
                </p>
              </div>
            )}

            <button
              onClick={() => {
                onDepositSuccess(effectiveAmount);
                onClose();
              }}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold text-xs cursor-pointer"
            >
              Tamamla & Kapat
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
                          ? 'border-emerald-400 bg-emerald-950/40 text-white shadow-lg shadow-emerald-500/10'
                          : 'border-gray-800 bg-gray-900/60 hover:bg-gray-800 text-gray-300'
                      }`}
                    >
                      {pkg.bonus && (
                        <span className="absolute -top-2 right-2 text-[9px] font-black bg-amber-500 text-black px-1.5 py-0.2 rounded-full shadow-sm">
                          {pkg.bonus}
                        </span>
                      )}
                      <div className="text-base font-black text-emerald-400">₺{pkg.amount}</div>
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
                  className="w-full bg-gray-900 border border-gray-800 focus:border-emerald-400 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none"
                />
              </div>
            </div>

            {/* 2. Ödeme Yöntemi */}
            <div>
              <label className="text-xs font-black text-gray-300 uppercase tracking-wider block mb-2">
                2. Ödeme Yöntemi Seç
              </label>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('card')}
                  className={`p-3 rounded-2xl border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                    paymentMethod === 'card'
                      ? 'border-emerald-400 bg-emerald-950/40 text-white'
                      : 'border-gray-800 bg-gray-900/60 text-gray-400 hover:text-white'
                  }`}
                >
                  <CreditCard className="w-5 h-5 text-amber-400" />
                  <span className="text-xs font-bold">Kredi Kartı</span>
                  <span className="text-[9px] text-gray-400">Shopier 3D</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('papara')}
                  className={`p-3 rounded-2xl border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                    paymentMethod === 'papara'
                      ? 'border-emerald-400 bg-emerald-950/40 text-white'
                      : 'border-gray-800 bg-gray-900/60 text-gray-400 hover:text-white'
                  }`}
                >
                  <span className="text-lg">📱</span>
                  <span className="text-xs font-bold">Papara</span>
                  <span className="text-[9px] text-gray-400">Anında FAST</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('test')}
                  className={`p-3 rounded-2xl border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                    paymentMethod === 'test'
                      ? 'border-amber-400 bg-amber-950/40 text-white'
                      : 'border-gray-800 bg-gray-900/60 text-gray-400 hover:text-white'
                  }`}
                >
                  <Zap className="w-5 h-5 text-amber-400" />
                  <span className="text-xs font-bold">Hızlı Test</span>
                  <span className="text-[9px] text-emerald-400">Anında Demo</span>
                </button>
              </div>
            </div>

            {/* Güvenlik Rozeti */}
            <div className="flex items-center gap-2 p-3 bg-gray-950 rounded-2xl border border-gray-800/80 text-xs text-gray-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>256-bit SSL Güvenli Ödeme Altyapısı</span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isProcessing || effectiveAmount < 5}
              className="w-full py-3.5 px-6 rounded-2xl font-black text-sm bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-500 text-black shadow-lg shadow-emerald-500/25 transition-all transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <span>{isProcessing ? 'İşleniyor...' : `₺${effectiveAmount} Yükle ve Şehirleri Ele Geçir`}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
