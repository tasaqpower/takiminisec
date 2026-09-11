import React, { useState, useEffect } from 'react';
import {
  Camera,
  Stamp,
  MessageSquare,
  GitCompare,
  Layers3,
  Bookmark,
  Crop,
  FileSpreadsheet,
  KeyRound,
  CheckCheck,
  Search,
  Sparkles,
} from 'lucide-react';

export type ProfessionalToolId =
  | 'scanner'
  | 'decoration'
  | 'annotations'
  | 'compare'
  | 'batch'
  | 'navigation'
  | 'page-sizing'
  | 'conversion'
  | 'signature'
  | 'compliance';

interface ToolHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTool: (toolId: ProfessionalToolId) => void;
}

interface ToolDefinition {
  id: ProfessionalToolId;
  title: string;
  category: 'Tara & Biçim' | 'İnceleme & Düzenleme' | 'Dönüşüm & Otomasyon' | 'Güvenlik & Standartlar';
  description: string;
  badge?: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const TOOLS: ToolDefinition[] = [
  {
    id: 'scanner',
    title: 'Belge Tarayıcı & İyileştirme',
    category: 'Tara & Biçim',
    description: 'Kamera veya görselden 4 noktalı köşe düzeltme, perspektif yamukluk giderme, gölge temizleme ve kontrast filtreleri.',
    badge: 'Paket 1',
    icon: Camera,
  },
  {
    id: 'decoration',
    title: 'Filigran, Sayfa No & Üst/Alt Bilgi',
    category: 'Tara & Biçim',
    description: 'Metin/görsel filigran, Romen rakamları (i, ii) veya alfabetik sayfa numaralandırma, 9 konumlu üst ve alt bilgiler.',
    badge: 'Paket 2',
    icon: Stamp,
  },
  {
    id: 'page-sizing',
    title: 'Sayfa Kırpma & Yeniden Boyutlandırma',
    category: 'Tara & Biçim',
    description: 'ISO 32000 /CropBox kırpma, otomatik beyaz boşluk kırpma, A3/A4/A5/Letter orantılı vektör ölçekleme.',
    badge: 'Paket 7',
    icon: Crop,
  },
  {
    id: 'navigation',
    title: 'İçindekiler, Yer İmleri & Bağlantılar',
    category: 'Tara & Biçim',
    description: 'Tıklanabilir PDF içindekiler tablosu (TOC), hiyerarşik PDF Outlines yer imleri ağacı ve güvenli dış link doğrulayıcı.',
    badge: 'Paket 6',
    icon: Bookmark,
  },
  {
    id: 'annotations',
    title: 'Yorum & İnceleme Araçları',
    category: 'İnceleme & Düzenleme',
    description: 'Acrobat uyumlu metin notları, fosforlu sarı vurgular, alt/üst çizgi, çizim damgaları ve yorum özeti dışa aktarma.',
    badge: 'Paket 3',
    icon: MessageSquare,
  },
  {
    id: 'compare',
    title: 'İki PDF Belgesini Karşılaştır',
    category: 'İnceleme & Düzenleme',
    description: 'LCS metin farkları, piksel tamponu görsel bindirme ve yan yana karşılaştırmalı HTML/PDF raporu.',
    badge: 'Paket 4',
    icon: GitCompare,
  },
  {
    id: 'conversion',
    title: 'Gelişmiş Format Dönüşümleri',
    category: 'Dönüşüm & Otomasyon',
    description: 'PDF → Çok sayfalı Görsel ZIP (PNG/JPG), Görsellerden PDF üretimi, OpenXML Excel (.xlsx) ve PowerPoint (.pptx).',
    badge: 'Paket 8',
    icon: FileSpreadsheet,
  },
  {
    id: 'batch',
    title: 'Toplu Dosya İşlemleri (Batch)',
    category: 'Dönüşüm & Otomasyon',
    description: 'Birden çok PDF dosyasını eşzamanlı dönüştürün, sıkıştırın, filigranlayın; hata izolasyonu ve ZIP paketi.',
    badge: 'Paket 5',
    icon: Layers3,
  },
  {
    id: 'signature',
    title: 'Sertifika Tabanlı Dijital İmza',
    category: 'Güvenlik & Standartlar',
    description: 'ISO 32000-1 PPKLite PKCS#7 ayrılmış dijital imza, PKCS#12 (.p12/.pfx) sertifika, kriptografik bütünlük doğrulama.',
    badge: 'Paket 9',
    icon: KeyRound,
  },
  {
    id: 'compliance',
    title: 'PDF/A Arşiv & Erişilebilirlik (WCAG)',
    category: 'Güvenlik & Standartlar',
    description: 'ISO 19005-2 PDF/A-2b sRGB profil dönüştürücü, WCAG 2.1 AA erişilebilirlik skoru (0-100) ve tek tıkla düzeltme.',
    badge: 'Paket 10',
    icon: CheckCheck,
  },
];

export const ToolHubModal: React.FC<ToolHubModalProps> = ({
  isOpen,
  onClose,
  onSelectTool,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Handle ESC or Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredTools = TOOLS.filter((tool) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      tool.title.toLowerCase().includes(query) ||
      tool.description.toLowerCase().includes(query) ||
      tool.category.toLowerCase().includes(query)
    );
  });

  const categories = Array.from(new Set(filteredTools.map((t) => t.category)));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
      <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header & Search */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
                <Sparkles size={16} />
              </div>
              <h2 className="text-base font-semibold text-white">Forma Profesyonel Atölye Araçları</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-block text-[11px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded border border-slate-700">
                ESC ile kapat
              </span>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Araç veya özellik ara (örn. 'İmza', 'Filigran', 'Excel', 'Kırpma', 'PDF/A')..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
        </div>

        {/* Tools Grid */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {filteredTools.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-sm">
              Aranan terime uygun araç bulunamadı.
            </div>
          ) : (
            categories.map((category) => (
              <div key={category} className="space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {category}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredTools
                    .filter((t) => t.category === category)
                    .map((tool) => {
                      const Icon = tool.icon;
                      return (
                        <button
                          key={tool.id}
                          onClick={() => {
                            onSelectTool(tool.id);
                            onClose();
                          }}
                          className="flex items-start gap-3.5 p-3.5 bg-slate-950/60 hover:bg-blue-950/20 border border-slate-800 hover:border-blue-500/50 rounded-xl text-left transition-all group"
                        >
                          <div className="p-2.5 rounded-lg bg-slate-800/80 group-hover:bg-blue-600/20 text-slate-300 group-hover:text-blue-400 transition-colors flex-shrink-0">
                            <Icon size={18} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="text-sm font-medium text-white group-hover:text-blue-300 transition-colors truncate">
                                {tool.title}
                              </span>
                              {tool.badge && (
                                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 font-mono">
                                  {tool.badge}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                              {tool.description}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-800 bg-slate-950/90 text-xs text-slate-400">
          <span>Tüm işlemler %100 yerel ve gizli çalışır (Sıfır Bulut Sızıntısı)</span>
          <span className="font-mono text-slate-500">10 / 10 Paket Aktif</span>
        </div>
      </div>
    </div>
  );
};
