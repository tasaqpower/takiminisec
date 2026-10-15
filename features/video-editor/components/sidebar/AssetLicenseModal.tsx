import React, { useState, useEffect, useMemo } from 'react';
import {
  Scale,
  X,
  Search,
  ExternalLink,
  Copy,
  Check,
  ShieldCheck,
  FileText,
  Filter,
} from 'lucide-react';

export interface AssetLicenseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface LicenseSummary {
  name: string;
  description: string;
  commercialUse: boolean;
  attributionRequired: boolean;
  url: string;
}

interface AssetAttribution {
  id: string;
  name: string;
  author: string;
  license: string;
  licenseUrl: string;
  source: string;
  sourceUrl: string;
  attributionText: string;
}

interface LicenseData {
  version: string;
  generatedAt: string;
  totalAssets: number;
  licenses: Record<string, LicenseSummary>;
  assetAttributions: AssetAttribution[];
}

export const AssetLicenseModal: React.FC<AssetLicenseModalProps> = ({ isOpen, onClose }) => {
  const [data, setData] = useState<LicenseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedLicenseType, setSelectedLicenseType] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetch('/video-assets/ASSET_LICENSES.json')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load ASSET_LICENSES.json');
        return res.json();
      })
      .then((json: any) => {
        setData(json as LicenseData);
      })
      .catch((err) => {
        console.error('[AssetLicenseModal] Error loading licenses:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isOpen]);

  const handleCopyAttribution = (id: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  const filteredAttributions = useMemo(() => {
    if (!data?.assetAttributions) return [];
    let list = data.assetAttributions;

    if (selectedLicenseType !== 'all') {
      list = list.filter((a) => a.license.toLowerCase().includes(selectedLicenseType.toLowerCase()));
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.author.toLowerCase().includes(q) ||
          a.source.toLowerCase().includes(q) ||
          a.attributionText.toLowerCase().includes(q)
      );
    }

    return list;
  }, [data, search, selectedLicenseType]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150 select-none"
      onClick={onClose}
    >
      <div
        className="bg-[#111419] border border-[#292F39] rounded-[6px] shadow-2xl max-w-3xl w-full flex flex-col max-h-[88vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#292F39] bg-[#0B0D10]">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Lisanslar ve Üçüncü Taraf Bildirimleri</h2>
              <p className="text-[11px] text-[#94A3B8]">
                Ticari kullanıma uygun açık kaynak ve kamu malı içerik lisans dökümleri
              </p>
            </div>
          </div>
          <button
            type="button"
            data-testid="close-license-modal"
            onClick={onClose}
            className="text-[#94A3B8] hover:text-white p-1 rounded hover:bg-[#202631] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Legal Notice Banner */}
        <div className="px-5 py-3 bg-[#0E1015] border-b border-[#292F39] flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-xs text-[#94A3B8] space-y-1">
            <p className="text-[#E2E8F0] font-medium">
              Tüm varlıklar ticari kullanım için taranmış ve doğrulanmıştır.
            </p>
            <p className="text-[11px]">
              Forma Video Editörü içerisindeki tüm harici sesler, stok videolar, yazı tipleri ve grafikler; CC0 1.0,
              Public Domain, SIL OFL 1.1, MIT, ISC ve CC-BY lisansları altında temin edilmiştir. CC-BY kapsamındaki
              içerikler için zorunlu atıf metinlerini aşağıdan tek tıkla kopyalayabilirsiniz.
            </p>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="px-5 py-3 border-b border-[#292F39] flex items-center justify-between gap-3 bg-[#111419]">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#64748B]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Varlık adı, sanatçı veya kaynakta ara..."
              className="w-full bg-[#0E1014] border border-[#292F39] rounded px-8 py-1.5 text-xs text-white placeholder-[#64748B] focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-[#64748B]" />
            <select
              value={selectedLicenseType}
              onChange={(e) => setSelectedLicenseType(e.target.value)}
              className="bg-[#0E1014] border border-[#292F39] text-[#CBD5E1] rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-indigo-500"
            >
              <option value="all">Tüm Lisanslar</option>
              <option value="cc0">CC0 (Kamu Malı)</option>
              <option value="sil">SIL OFL (Fontlar)</option>
              <option value="mit">MIT / ISC</option>
              <option value="cc by">CC BY (Atıf Zorunlu)</option>
            </select>
          </div>
        </div>

        {/* Attribution Items List */}
        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-[#94A3B8] text-xs">
              <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-2" />
              Lisanslar yükleniyor...
            </div>
          ) : filteredAttributions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-[#64748B] text-xs text-center">
              <FileText className="w-8 h-8 mb-2 stroke-1 opacity-60" />
              <p className="font-medium text-[#94A3B8]">Eşleşen lisans kaydı bulunamadı</p>
            </div>
          ) : (
            filteredAttributions.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded bg-[#0E1015] border border-[#202631] space-y-2 hover:border-[#2E3747] transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-white">{item.name}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-medium">
                        {item.license}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#94A3B8] mt-0.5">
                      <span>Eser Sahibi: <strong className="text-[#CBD5E1]">{item.author}</strong></span>
                      <span className="mx-2">•</span>
                      <span>Kaynak: {item.source}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {item.licenseUrl && (
                      <a
                        href={item.licenseUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1 rounded text-[#64748B] hover:text-white hover:bg-[#1A1F29] transition-colors"
                        title="Lisans Metnini Görüntüle"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>

                {item.attributionText && (
                  <div className="flex items-center justify-between p-2 rounded bg-[#090A0D] border border-[#1A1F29] text-[11px] font-mono text-[#CBD5E1]">
                    <span className="truncate pr-2">{item.attributionText}</span>
                    <button
                      type="button"
                      onClick={() => handleCopyAttribution(item.id, item.attributionText)}
                      className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#1A1F29] hover:bg-[#252D3B] text-white text-[10px] shrink-0 transition-colors"
                      title="Atıf Metnini Kopyala"
                    >
                      {copiedId === item.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">Kopyalandı</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Kopyala</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#292F39] bg-[#0B0D10] flex items-center justify-between text-xs text-[#64748B]">
          <span>Toplam Doğrulanmış Kayıt: <strong className="text-white">{data?.assetAttributions?.length || 0}</strong></span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-[#202631] hover:bg-[#2E3747] text-white rounded text-xs font-medium transition-colors"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
