import React from 'react';
import { Keyboard, Play, Scissors, Undo2, Lightbulb, X } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VideoShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const SHORTCUT_GROUPS = [
    {
      title: 'Oynatma & Gezinme',
      icon: <Play className="w-3.5 h-3.5 text-blue-400" />,
      items: [
        { keys: ['Boşluk'], desc: 'Videoyu Oynat / Duraklat' },
        { keys: ['←', '→'], desc: '1 Kare Geri / İleri Git' },
        { keys: ['Shift', '← / →'], desc: '1 Saniye Hızlı Geri / İleri Git' },
        { keys: ['Home'], desc: 'Zaman Çizelgesinin En Başına Git (00:00)' },
        { keys: ['End'], desc: 'Zaman Çizelgesinin Sonuna Git' },
      ],
    },
    {
      title: 'Kurgu & Klip İşlemleri',
      icon: <Scissors className="w-3.5 h-3.5 text-amber-400" />,
      items: [
        { keys: ['S'], desc: 'Seçili Klibi Oynatma Çizgisinden Böl (Split)' },
        { keys: ['Delete'], desc: 'Seçili Klibi Zaman Çizelgesinden Sil' },
        { keys: ['Shift', 'Delete'], desc: 'Boşluğu Kapatıp Sil (Ripple Delete)' },
        { keys: ['Ctrl', 'D'], desc: 'Seçili Klibin Birebir Kopyasını Oluştur' },
        { keys: ['Esc'], desc: 'Klip Seçimini Temizle' },
      ],
    },
    {
      title: 'Geçmiş & Düzenleme',
      icon: <Undo2 className="w-3.5 h-3.5 text-purple-400" />,
      items: [
        { keys: ['Ctrl', 'Z'], desc: 'Son Yapılan Değişikliği Geri Al (Undo)' },
        { keys: ['Ctrl', 'Y'], desc: 'Geri Alınan Değişikliği Yinele (Redo)' },
        { keys: ['M'], desc: 'Tüm Proje Sesini Aç / Kapat' },
      ],
    },
    {
      title: 'Profesyonel İpuçları',
      icon: <Lightbulb className="w-3.5 h-3.5 text-emerald-400" />,
      items: [
        { keys: ['Sağ Tık'], desc: 'Klip üzerinde: Hızlı bölme, ses ayırma, hız ve silme menüsü' },
        { keys: ['Sürükle'], desc: 'Klibin sol ve sağ kenarından tutup çekerek kırpma yapın' },
        { keys: ['Mıknatıs'], desc: 'Kliplerin ve oynatma kafasının birbirine tam yapışmasını sağlar' },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="bg-[#0e1014] border border-[#202531] rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 px-5 border-b border-[#191d26] flex items-center justify-between bg-[#13161c]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-[#1c212c] border border-[#2b3342] flex items-center justify-center text-indigo-400">
              <Keyboard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm">Klavye Kısayolları & Hızlı İşlemler</h3>
              <p className="text-[11px] text-gray-400">
                Kurgu hızınızı artırmak için tasarlanmış profesyonel masaüstü kısayollar
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-[#1c212c] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 max-h-[70vh] overflow-y-auto space-y-5 custom-scrollbar">
          {SHORTCUT_GROUPS.map((group, gIdx) => (
            <div key={gIdx} className="space-y-2">
              <h4 className="text-xs font-semibold text-gray-200 uppercase tracking-wider flex items-center gap-1.5">
                {group.icon}
                <span>{group.title}</span>
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {group.items.map((item, iIdx) => (
                  <div
                    key={iIdx}
                    className="p-2 rounded-md bg-[#13161c] border border-[#202531] flex items-center justify-between gap-3"
                  >
                    <span className="text-xs text-gray-300 font-medium">{item.desc}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {item.keys.map((k, kIdx) => (
                        <kbd
                          key={kIdx}
                          className="px-1.5 py-0.5 rounded bg-[#0a0c10] border border-[#202531] text-[10px] font-mono font-medium text-indigo-300 shadow-sm"
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
        <div className="p-3 px-5 border-t border-[#191d26] bg-[#13161c] flex items-center justify-between text-xs text-gray-400">
          <span>Forma Video Studio • %100 Yerel Tarayıcı Kurgusu</span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition-colors"
          >
            Anladım
          </button>
        </div>
      </div>
    </div>
  );
};
