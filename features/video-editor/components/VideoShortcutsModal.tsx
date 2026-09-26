import React from 'react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VideoShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const SHORTCUT_GROUPS = [
    {
      title: '🎬 Oynatma & Gezinme',
      items: [
        { keys: ['Boşluk'], desc: 'Videoyu Oynat / Duraklat' },
        { keys: ['←', '→'], desc: '1 Kare Geri / İleri Git' },
        { keys: ['Shift', '← / →'], desc: '1 Saniye Hızlı Geri / İleri Git' },
        { keys: ['Home'], desc: 'Zaman Çizelgesinin En Başına Git (00:00)' },
        { keys: ['End'], desc: 'Zaman Çizelgesinin Sonuna Git' },
      ],
    },
    {
      title: '✂️ Kurgu & Klip İşlemleri',
      items: [
        { keys: ['S'], desc: 'Seçili Klibi Oynatma Çizgisinden Böl (Split)' },
        { keys: ['Delete'], desc: 'Seçili Klibi Zaman Çizelgesinden Sil' },
        { keys: ['Shift', 'Delete'], desc: 'Boşluğu Kapatıp Sil (Ripple Delete)' },
        { keys: ['Ctrl', 'D'], desc: 'Seçili Klibin Birebir Kopyasını Oluştur' },
        { keys: ['Esc'], desc: 'Klip Seçimini Temizle' },
      ],
    },
    {
      title: '↩️ Geçmiş & Düzenleme',
      items: [
        { keys: ['Ctrl', 'Z'], desc: 'Son Yapılan Değişikliği Geri Al (Undo)' },
        { keys: ['Ctrl', 'Y'], desc: 'Geri Alınan Değişikliği Yinele (Redo)' },
        { keys: ['M'], desc: 'Tüm Proje Sesini Aç / Kapat' },
      ],
    },
    {
      title: '💡 Profesyonel İpuçları',
      items: [
        { keys: ['Sağ Tık'], desc: 'Klip üzerinde: Hızlı bölme, ses ayırma, hız ve silme menüsü' },
        { keys: ['Sürükle'], desc: 'Klibin sol ve sağ kenarından tutup çekerek kırpma yapın' },
        { keys: ['Mıknatıs'], desc: 'Kliplerin ve oynatma kafasının birbirine tam yapışmasını sağlar' },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="bg-[#0d1117] border border-[#30363d] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 px-6 border-b border-[#21262d] flex items-center justify-between bg-[#161b22]/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 font-bold">
              ⌨️
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">Klavye Kısayolları & Hızlı İşlemler</h3>
              <p className="text-[11px] text-gray-400">
                Kurgu hızınızı artırmak için tasarlanmış profesyonel kısayollar
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#21262d] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto space-y-6">
          {SHORTCUT_GROUPS.map((group, gIdx) => (
            <div key={gIdx} className="space-y-2.5">
              <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                {group.title}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {group.items.map((item, iIdx) => (
                  <div
                    key={iIdx}
                    className="p-2.5 rounded-lg bg-[#161b22] border border-[#30363d]/70 flex items-center justify-between gap-3"
                  >
                    <span className="text-xs text-gray-300 font-medium">{item.desc}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {item.keys.map((k, kIdx) => (
                        <kbd
                          key={kIdx}
                          className="px-2 py-0.5 rounded bg-[#090d13] border border-[#30363d] text-[11px] font-mono font-semibold text-indigo-300 shadow-sm"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-3 px-6 border-t border-[#21262d] bg-[#161b22]/30 flex items-center justify-between text-xs text-gray-400">
          <span>Forma Video Studio • %100 Yerel Tarayıcı Kurgusu</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition-colors"
          >
            Anladım
          </button>
        </div>
      </div>
    </div>
  );
};
