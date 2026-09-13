"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  Stamp,
  Download,
  Building2,
  Calendar,
  Save,
  CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';
import {
  getDefaultStampConfig,
  renderStampSvg,
  stampSvgToPngDataUrl,
  STAMP_PRESETS,
  STAMP_COLORS,
  type StampConfig
} from './stampEngine';

interface StampGeneratorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplyStampToDocument?: (stampDataUrl: string, width: number, height: number) => void;
}

export function StampGeneratorModal({
  open,
  onOpenChange,
  onApplyStampToDocument
}: StampGeneratorModalProps) {
  const [config, setConfig] = useState<StampConfig>(getDefaultStampConfig());
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('forma_stamp_pref');
        if (saved) {
          const parsed = JSON.parse(saved);
          setConfig(prev => ({
            ...prev,
            companyName: parsed.companyName || prev.companyName,
            subtitle: parsed.subtitle || prev.subtitle,
            signerName: parsed.signerName || prev.signerName,
            color: parsed.color || prev.color
          }));
        }
      } catch (e) {
        // ignore
      }
    }
  }, []);

  const svgCode = renderStampSvg(config);

  const handlePresetSelect = (presetId: string) => {
    const p = STAMP_PRESETS.find(item => item.id === presetId);
    if (p) {
      setConfig(prev => ({
        ...prev,
        preset: p.id,
        statusText: p.status,
        color: p.defaultColor
      }));
    }
  };

  const handleSaveDefault = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('forma_stamp_pref', JSON.stringify({
        companyName: config.companyName,
        subtitle: config.subtitle,
        signerName: config.signerName,
        color: config.color
      }));
      setSavedSuccess(true);
      toast.success('Şirket bilgileri ve kaşe profili kaydedildi.');
      setTimeout(() => setSavedSuccess(false), 2500);
    }
  };

  const handleDownloadPng = async () => {
    try {
      const isCircle = config.type === 'circle';
      const w = isCircle ? 600 : 760;
      const h = isCircle ? 600 : 360;
      const pngUrl = await stampSvgToPngDataUrl(svgCode, w, h);

      const a = document.createElement('a');
      a.href = pngUrl;
      a.download = `kase_${config.preset}_${config.date.replace(/\./g, '-')}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success('Şeffaf yüksek çözünürlüklü kaşe PNG olarak indirildi.');
    } catch (e) {
      toast.error('Kaşe indirilirken bir hata oluştu.');
    }
  };

  const handleApplyToDoc = async () => {
    if (!onApplyStampToDocument) {
      toast.info('Lütfen önce bir belge açın.');
      return;
    }
    try {
      const isCircle = config.type === 'circle';
      const w = isCircle ? 500 : 640;
      const h = isCircle ? 500 : 300;
      const pngUrl = await stampSvgToPngDataUrl(svgCode, w, h);

      const stampDocWidth = isCircle ? 130 : 160;
      const stampDocHeight = isCircle ? 130 : 75;

      onApplyStampToDocument(pngUrl, stampDocWidth, stampDocHeight);
      toast.success('Kaşe belgeye damgalandı! Sayfa üzerinde istediğiniz yere sürükleyebilirsiniz.');
      onOpenChange(false);
    } catch (e) {
      toast.error('Belgeye uygulanırken hata oluştu.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden bg-slate-900 border-slate-700 text-slate-100 shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
              <Stamp className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                Kurumsal Kaşe &amp; Mühür Atölyesi
                <span className="text-[11px] bg-red-500/20 text-red-300 font-semibold px-2 py-0.5 rounded-full border border-red-500/30">
                  Resmi Standart
                </span>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Türkiye resmi standartlarında yuvarlak mühür veya dikdörtgen şirket kaşesi üretin ve belgeye basın.
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden">
          <div className="md:col-span-7 p-6 overflow-y-auto space-y-5 border-r border-slate-800 bg-slate-900/50">
            <div>
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-2">
                Kaşe Geometrisi
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setConfig(prev => ({ ...prev, type: 'circle' }))}
                  className={`p-3 rounded-xl border flex items-center gap-3 transition-all ${
                    config.type === 'circle'
                      ? 'bg-red-500/10 border-red-500/50 text-white shadow-lg shadow-red-500/5'
                      : 'bg-slate-800/40 border-slate-700/50 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="w-8 h-8 rounded-full border-2 border-current flex items-center justify-center font-bold text-xs">
                    ●
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-bold">Yuvarlak / Dairesel</div>
                    <div className="text-[10px] opacity-75">Resmi Mühür &amp; Kurum</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setConfig(prev => ({ ...prev, type: 'rectangle' }))}
                  className={`p-3 rounded-xl border flex items-center gap-3 transition-all ${
                    config.type === 'rectangle'
                      ? 'bg-red-500/10 border-red-500/50 text-white shadow-lg shadow-red-500/5'
                      : 'bg-slate-800/40 border-slate-700/50 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="w-8 h-6 rounded border-2 border-current flex items-center justify-center font-bold text-xs">
                    ▬
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-bold">Dikdörtgen Kaşe</div>
                    <div className="text-[10px] opacity-75">Şirket &amp; Yetkili İmza</div>
                  </div>
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-2">
                Hazır Kaşe Şablonları
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {STAMP_PRESETS.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handlePresetSelect(p.id)}
                    className={`px-2.5 py-2 rounded-lg text-xs font-medium border text-center transition-all ${
                      config.preset === p.id
                        ? 'bg-slate-800 border-red-500 text-white shadow-sm'
                        : 'bg-slate-800/30 border-slate-700/40 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Şirket Unvanı / Kurum Adı
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                  <input
                    type="text"
                    value={config.companyName}
                    onChange={e => setConfig(prev => ({ ...prev, companyName: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-red-500"
                    placeholder="Örn: ANADOLU TEKNOLOJİ A.Ş."
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">
                    Kaşe Durum Metni
                  </label>
                  <input
                    type="text"
                    value={config.statusText}
                    onChange={e => setConfig(prev => ({ ...prev, statusText: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 font-bold focus:outline-none focus:border-red-500"
                    placeholder="Örn: ASLI GİBİDİR"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">
                    Tarih
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                    <input
                      type="text"
                      value={config.date}
                      onChange={e => setConfig(prev => ({ ...prev, date: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-red-500"
                      placeholder="14.09.2026"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Vergi No / Mersis / Alt Metin
                </label>
                <input
                  type="text"
                  value={config.subtitle}
                  onChange={e => setConfig(prev => ({ ...prev, subtitle: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-red-500"
                  placeholder="KADIKÖY V.D. 1234567890 • MERSİS: 0123456789"
                />
              </div>

              {config.type === 'rectangle' && (
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">
                    Yetkili / İmza Bilgisi
                  </label>
                  <input
                    type="text"
                    value={config.signerName || ''}
                    onChange={e => setConfig(prev => ({ ...prev, signerName: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-red-500"
                    placeholder="Yetkili İmza &amp; Kaşe"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-2">
                  Mürekkep Rengi
                </label>
                <div className="flex items-center gap-2">
                  {STAMP_COLORS.map(c => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setConfig(prev => ({ ...prev, color: c.hex }))}
                      className={`w-7 h-7 rounded-full transition-transform ${
                        config.color === c.hex ? 'scale-125 ring-2 ring-white shadow-lg' : 'hover:scale-110 opacity-80'
                      }`}
                      style={{ backgroundColor: c.hex }}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Otantik Eğim Açısı: {config.angle}°
                </label>
                <input
                  type="range"
                  min="-10"
                  max="10"
                  step="0.5"
                  value={config.angle}
                  onChange={e => setConfig(prev => ({ ...prev, angle: parseFloat(e.target.value) }))}
                  className="w-full accent-red-500 cursor-pointer"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={handleSaveDefault}
                className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5 transition-colors"
              >
                {savedSuccess ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Save className="w-3.5 h-3.5" />}
                <span>{savedSuccess ? 'Kaydedildi' : 'Şirket Bilgilerimi Kaydet'}</span>
              </button>
            </div>
          </div>

          <div className="md:col-span-5 p-6 bg-slate-950 flex flex-col items-center justify-between space-y-6">
            <div className="w-full flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Canlı Belge Önizlemesi
              </span>
              <span className="text-[11px] text-emerald-400 bg-emerald-950/50 border border-emerald-800/40 px-2 py-0.5 rounded">
                Vektör Keskinliği
              </span>
            </div>

            <div className="w-full max-w-[320px] aspect-square rounded-2xl bg-slate-100 shadow-2xl p-6 flex items-center justify-center border border-slate-300/40 relative overflow-hidden select-none">
              <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:16px_16px] opacity-40 pointer-events-none" />
              <div
                className="w-full h-full flex items-center justify-center"
                dangerouslySetInnerHTML={{ __html: svgCode }}
              />
            </div>

            <div className="w-full space-y-2">
              {onApplyStampToDocument && (
                <button
                  type="button"
                  onClick={handleApplyToDoc}
                  className="w-full py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-xs transition-all shadow-lg shadow-red-600/20 flex items-center justify-center gap-2"
                >
                  <Stamp className="w-4 h-4" />
                  <span>Belgeye Damgala</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleDownloadPng}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs border border-slate-700 transition-all flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>Şeffaf PNG Olarak İndir</span>
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
