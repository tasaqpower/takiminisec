import React, { useState } from 'react';
import { X, CreditCard, Wallet, CheckCircle, ShieldCheck, Zap, ArrowRight, ExternalLink, QrCode, AlertCircle, Copy, Sparkles, KeyRound } from 'lucide-react';
import confetti from 'canvas-confetti';
import { playCoinSound } from '../utils/audio';

const SHOPIER_CHECKOUT_URL = 'https://www.shopier.com/takiminisec/50191149';

export default function DepositModal({ isOpen, onClose, currentBalance, onDepositSuccess, nickname }) {
  if (!isOpen) return null;

  const [selectedAmount, setSelectedAmount] = useState(50);
  const [customAmount, setCustomAmount] = useState('');
  const [paymentProvider, setPaymentProvider] = useState('shopier');
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderCreated, setOrderCreated] = useState(null);
  const [orderCode, setOrderCode] = useState('');
  const [verifyError, setVerifyError] = useState('');
  const [verifySuccess, setVerifySuccess] = useState(false);

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

    const generatedOrderId = 'TS_' + Date.now().toString(36).toUpperCase() + '_' + Math.random().toString(36).substr(2, 3).toUpperCase();

    setTimeout(() => {
      setIsProcessing(false);
      setOrderCreated({
        orderId: generatedOrderId,
        amount: effectiveAmount,
        providerName: paymentProvider === 'paytr' ? 'PayTR Sanal POS' : 'Shopier Güvenli Ödeme',
        paymentUrl: SHOPIER_CHECKOUT_URL
      });
      window.open(SHOPIER_CHECKOUT_URL, '_blank');
    }, 250);
  };

  // Kod / Sipariş Numarası Doğrulama (Hilesiz & Güvenli)
  const handleVerifyPayment = async (e) => {
    e.preventDefault();
    setVerifyError('');

    if (!orderCode.trim()) {
      setVerifyError('Lütfen Shopier/PayTR sipariş numaranızı veya bakiye kodunuzu girin.');
      return;
    }

    setIsProcessing(true);

    try {
      const res = await fetch('/api/payment/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: orderCode.trim(),
          amount: orderCreated ? orderCreated.amount : effectiveAmount,
          bidder: nickname || 'Taraftar'
        })
      });
      const data = await res.json();
      setIsProcessing(false);

      if (data.success) {
        setVerifySuccess(true);
        onDepositSuccess(data.amount || effectiveAmount);
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
        playCoinSound();
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setVerifyError(data.error || 'Geçersiz veya onaylanmamış sipariş kodu! Lütfen önce ödemeyi tamamlayın.');
      }
    } catch (err) {
      setIsProcessing(false);
      setVerifyError('Doğrulama hatası: ' + err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-lg bg-[#0f172a] rounded-3xl border border-gray-800 text-white shadow-2xl overflow-hidden my-4 sm:my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-6 bg-gradient-to-r from-blue-950/80 via-[#0f172a] to-emerald-950/60 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
              <Wallet className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="text-[10px] sm:text-xs font-bold text-emerald-400 uppercase tracking-wider">Taraftar Cüzdanı</div>
              <h3 className="text-lg sm:text-xl font-black text-white">Bakiye Yükle</h3>
            </div>
          </div>

          <div className="text-right">
            <div className="text-[9px] sm:text-[10px] text-gray-400 uppercase font-bold">Mevcut Bakiye</div>
            <div className="text-sm sm:text-base font-black text-emerald-400">
              ₺{Number(currentBalance || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
            </div>
          </div>

          <button
            onClick={onClose}
            className="absolute top-3 right-3 sm:top-4 sm:right-4 p-2 rounded-full bg-gray-800/80 text-gray-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {orderCreated ? (
          <div className="p-5 sm:p-6 space-y-4">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center mx-auto text-xl border border-blue-500/40">
                🔒
              </div>
              <h4 className="text-base sm:text-lg font-black text-white">{orderCreated.providerName} Açıldı</h4>
              <p className="text-xs text-gray-300">
                Lütfen açılan sekmede <b>₺{orderCreated.amount}</b> tutarındaki ödemenizi tamamlayın.
              </p>
            </div>

            <div className="p-3.5 bg-gray-900 rounded-2xl border border-gray-800 text-xs space-y-2 text-center">
              <span className="text-[11px] text-gray-400">Ödeme penceresi açılmadıysa:</span>
              <div>
                <a
                  href={orderCreated.paymentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-black font-black rounded-xl text-xs shadow-lg shadow-emerald-500/20 hover:brightness-110"
                >
                  <span>Ödeme Sayfasına Git</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Güvenli Onay Formu */}
            <form onSubmit={handleVerifyPayment} className="space-y-3 pt-1">
              <div>
                <label className="text-[11px] font-bold text-gray-300 block mb-1">
                  Ödeme Tamamlandıktan Sonra:
                </label>
                <input
                  type="text"
                  placeholder="Shopier Sipariş No veya Bakiye Kodunuz"
                  value={orderCode}
                  onChange={(e) => setOrderCode(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 focus:border-emerald-400 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none"
                />
              </div>

              {verifyError && (
                <div className="p-2.5 rounded-xl bg-red-950/60 border border-red-800 text-red-300 text-xs flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  <span>{verifyError}</span>
                </div>
              )}

              {verifySuccess && (
                <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Ödeme onaylandı! Bakiyeniz hesabınıza yüklendi.</span>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-black font-black rounded-xl text-xs cursor-pointer shadow-lg shadow-emerald-600/20 active:scale-98 transition-all disabled:opacity-50"
                >
                  {isProcessing ? 'Kontrol Ediliyor...' : 'Ödemeyi Doğrula & Yükle'}
                </button>
                <button
                  type="button"
                  onClick={() => setOrderCreated(null)}
                  className="px-4 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold rounded-xl text-xs cursor-pointer"
                >
                  Geri
                </button>
              </div>
            </form>
          </div>
        ) : (
          <form onSubmit={handleDeposit} className="p-4 sm:p-6 space-y-4 sm:space-y-5">
            
            {/* 1. Paket Seçimi */}
            <div>
              <label className="text-[11px] sm:text-xs font-black text-gray-300 uppercase tracking-wider block mb-2">
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
                      className={`p-2.5 sm:p-3 rounded-2xl border text-center transition-all relative cursor-pointer ${
                        isSelected
                          ? 'border-emerald-400 bg-emerald-950/40 text-white shadow-lg shadow-emerald-500/10'
                          : 'border-gray-800 bg-gray-900/60 hover:bg-gray-800 text-gray-300'
                      }`}
                    >
                      {pkg.bonus && (
                        <span className="absolute -top-2 right-1.5 text-[8px] sm:text-[9px] font-black bg-amber-500 text-black px-1.5 py-0.2 rounded-full shadow-sm">
                          {pkg.bonus}
                        </span>
                      )}
                      <div className="text-sm sm:text-base font-black text-emerald-400">₺{pkg.amount}</div>
                      <div className="text-[9px] sm:text-[10px] text-gray-400 font-bold">{pkg.label}</div>
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
              <label className="text-[11px] sm:text-xs font-black text-gray-300 uppercase tracking-wider block mb-2">
                2. Güvenli Ödeme Altyapısı
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                
                {/* Shopier */}
                <button
                  type="button"
                  onClick={() => setPaymentProvider('shopier')}
                  className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                    paymentProvider === 'shopier'
                      ? 'border-emerald-400 bg-emerald-950/40 text-white shadow-md shadow-emerald-500/10'
                      : 'border-gray-800 bg-gray-900/60 text-gray-400 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-black text-white flex items-center gap-1.5">
                      <span>🛍️</span> <span>Shopier</span>
                    </span>
                    {paymentProvider === 'shopier' && <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />}
                  </div>
                  <div className="text-[10px] text-gray-400 mt-1">
                    Tüm Banka/Kredi Kartları • Troy • Anında Onay
                  </div>
                </button>

                {/* PayTR */}
                <button
                  type="button"
                  onClick={() => setPaymentProvider('paytr')}
                  className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                    paymentProvider === 'paytr'
                      ? 'border-blue-400 bg-blue-950/40 text-white shadow-md shadow-blue-500/10'
                      : 'border-gray-800 bg-gray-900/60 text-gray-400 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-black text-white flex items-center gap-1.5">
                      <span>🏛️</span> <span>PayTR Sanal POS</span>
                    </span>
                    {paymentProvider === 'paytr' && <CheckCircle className="w-3.5 h-3.5 text-blue-400" />}
                  </div>
                  <div className="text-[10px] text-gray-400 mt-1">
                    BDDK Lisanslı • 3D Secure • Güvenli Ödeme
                  </div>
                </button>

              </div>
            </div>

            {/* Bakiye Kodu ile Yükle (Admin / Promosyon / Manuel Kod) */}
            <div className="p-3 bg-gray-950/80 rounded-2xl border border-gray-800 text-xs">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold text-gray-300 flex items-center gap-1">
                  <KeyRound className="w-3 h-3 text-amber-400" /> Bakiye Kodu / Promosyon Kodu
                </span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Kupon veya Sipariş Kodunuz"
                  value={orderCode}
                  onChange={(e) => setOrderCode(e.target.value)}
                  className="flex-1 bg-gray-900 border border-gray-800 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleVerifyPayment}
                  className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-xl text-xs cursor-pointer"
                >
                  Uygula
                </button>
              </div>
            </div>

            {/* Güvenlik Rozeti */}
            <div className="flex items-center gap-2 p-2.5 bg-gray-950 rounded-2xl border border-gray-800/80 text-[11px] text-gray-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>256-bit SSL & 3D Secure Korumalı Güvenli Ödeme</span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isProcessing || effectiveAmount < 5}
              className="w-full py-3.5 px-6 rounded-2xl font-black text-xs sm:text-sm text-black bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 shadow-lg shadow-emerald-500/25 transition-all transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 hover:brightness-110"
            >
              <span>{isProcessing ? 'İşleniyor...' : `₺${effectiveAmount} Yükle (${paymentProvider === 'shopier' ? 'Shopier' : 'PayTR'})`}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
