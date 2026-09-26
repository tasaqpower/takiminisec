'use client';

import React from 'react';
import { Files, Film, ShieldCheck, ArrowRight, Sparkles, FileText, CheckCircle2 } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

interface ModeSelectionProps {
  onSelectDocument: () => void;
  onSelectVideo: () => void;
}

export const ModeSelectionScreen: React.FC<ModeSelectionProps> = ({
  onSelectDocument,
  onSelectVideo,
}) => {
  return (
    <div className="min-h-screen w-full bg-[#090d13] text-gray-100 flex flex-col justify-between selection:bg-indigo-500 selection:text-white relative overflow-hidden">
      {/* Background subtle ambient glows */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 -right-40 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header */}
      <header className="h-16 px-6 sm:px-12 flex items-center justify-between border-b border-[#21262d] bg-[#0d1117]/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-600/20">
            <Files className="w-4 h-4 text-white" />
          </div>
          <span className="font-extrabold text-lg tracking-tight text-white">
            forma<span className="text-indigo-400">.</span>
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#161b22] border border-[#30363d] text-xs text-gray-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>%100 Cihazında & Güvenli</span>
          </div>
          <ThemeToggle showLabel={false} />
        </div>
      </header>

      {/* Hero Body */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 z-10 max-w-5xl mx-auto w-full">
        {/* Title & Eyebrow */}
        <div className="text-center max-w-2xl mb-12 space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-950/60 border border-indigo-800/40 text-xs font-semibold text-indigo-300">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
            <span>FORMA ÇALIŞMA ALANI</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white">
            Ne düzenlemek istiyorsun?
          </h1>
          <p className="text-sm sm:text-base text-gray-400">
            İster resmî belgelerinizi ve sözleşmelerinizi düzenleyin, ister çok kanallı stüdyoda profesyonel videolar kurgulayın.
          </p>
        </div>

        {/* The Two Main Workspace Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
          {/* Card 1: Belge Düzenle */}
          <div
            onClick={onSelectDocument}
            className="group relative p-8 rounded-2xl bg-gradient-to-b from-[#161b22] to-[#0d1117] border border-[#30363d] hover:border-indigo-500/80 hover:shadow-2xl hover:shadow-indigo-500/10 cursor-pointer transition-all duration-300 flex flex-col justify-between"
          >
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="w-14 h-14 rounded-2xl bg-indigo-600/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 group-hover:scale-110 group-hover:bg-indigo-600/25 transition-all">
                  <FileText className="w-7 h-7" />
                </div>
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#21262d] text-gray-300 border border-[#30363d]">
                  PDF · DOCX · OCR
                </span>
              </div>

              <div>
                <h2 className="text-2xl font-bold text-white group-hover:text-indigo-300 transition-colors">
                  Belge Düzenle
                </h2>
                <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                  PDF ve Word belgelerini düzenleyin, filigranları ve mühürleri sıfır hasarla kaldırın, sayfaları sıralayın ve Forma AI ile dönüştürün.
                </p>
              </div>

              <div className="space-y-2 pt-2 border-t border-[#21262d]">
                {[
                  'PDF & Word (.docx) çift yönlü düzenleme',
                  'Kusursuz filigran, damga ve sansür kaldırma',
                  'Taranmış belgelerde OCR ve netleştirme',
                  'Resmi kaşe basma, imza ve sayfa organizatörü',
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs text-gray-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-8">
              <button
                className="w-full py-3 px-4 rounded-xl bg-[#21262d] group-hover:bg-indigo-600 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                <span>Belge Düzenleyiciyi Başlat</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>

          {/* Card 2: Video Düzenle */}
          <div
            onClick={onSelectVideo}
            className="group relative p-8 rounded-2xl bg-gradient-to-b from-[#161b22] to-[#0d1117] border border-[#30363d] hover:border-violet-500/80 hover:shadow-2xl hover:shadow-violet-500/10 cursor-pointer transition-all duration-300 flex flex-col justify-between"
          >
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="w-14 h-14 rounded-2xl bg-violet-600/15 border border-violet-500/30 flex items-center justify-center text-violet-400 group-hover:scale-110 group-hover:bg-violet-600/25 transition-all">
                  <Film className="w-7 h-7" />
                </div>
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-violet-950/50 text-violet-300 border border-violet-800/40">
                  YENİ ÇALIŞMA ALANI
                </span>
              </div>

              <div>
                <h2 className="text-2xl font-bold text-white group-hover:text-violet-300 transition-colors">
                  Video Düzenle
                </h2>
                <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                  Çok kanallı zaman çizelgesiyle klipleri kesin, biçin, geçiş efektleri, filtreler, ses mikseri ve Türkçe karakter garantili metinler ekleyin.
                </p>
              </div>

              <div className="space-y-2 pt-2 border-t border-[#21262d]">
                {[
                  'Çok kanallı profesyonel zaman çizelgesi (Timeline)',
                  'Hassas kesme, jiletle bölme ve boşluksuz silme (Ripple)',
                  '8 geçiş efekti, renk filtreleri ve canlı dönüştürme',
                  'MP4, WebM, GIF, MP3 ve 4K/Reels dışa aktarma',
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs text-gray-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-8">
              <button
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
              >
                <span>Video Düzenleyiciyi Başlat</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Privacy & Security Footer */}
      <footer className="h-14 px-6 border-t border-[#21262d] bg-[#0d1117]/80 flex items-center justify-center text-xs text-gray-500 gap-2 z-10">
        <ShieldCheck className="w-4 h-4 text-emerald-400" />
        <span>Tüm işlemler tarayıcınızda ve cihazınızda yerel olarak çalışır. Hiçbir dosya veya video sunucuya gönderilmez.</span>
      </footer>
    </div>
  );
};
