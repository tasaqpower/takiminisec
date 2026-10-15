import React, { useState, useEffect, useMemo } from 'react';
import { VideoProject } from '../../types';
import { assetCatalog, CatalogAssetItem } from '../../engine/assetCatalog';
import { deleteMediaBlob } from '../../db';
import {
  HardDrive,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  X,
  RefreshCw,
  Search,
  Layers,
  Database,
  Info,
} from 'lucide-react';

export interface StorageManagementModalProps {
  isOpen: boolean;
  project: VideoProject;
  onClose: () => void;
}

interface StoredAssetItem {
  id: string;
  size: number;
  inTimeline: boolean;
  catalogItem?: CatalogAssetItem;
}

export const StorageManagementModal: React.FC<StorageManagementModalProps> = ({
  isOpen,
  project,
  onClose,
}) => {
  const [storedAssets, setStoredAssets] = useState<StoredAssetItem[]>([]);
  const [totalStorageUsed, setTotalStorageUsed] = useState<number>(0);
  const [storageQuota, setStorageQuota] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isClearingUnused, setIsClearingUnused] = useState(false);

  // Compute set of asset IDs currently used in timeline
  const timelineAssetIds = useMemo(() => {
    const ids = new Set<string>();
    for (const track of project.tracks || []) {
      for (const clip of track.clips || []) {
        if (clip.assetId) ids.add(clip.assetId);
      }
    }
    return ids;
  }, [project]);

  // Load storage details
  const refreshStorage = async () => {
    setLoading(true);
    try {
      // 1. Storage quota and usage estimation
      if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
        const est = await navigator.storage.estimate();
        setTotalStorageUsed(est.usage || 0);
        setStorageQuota(est.quota || 0);
      }

      // 2. Fetch downloaded asset IDs from assetCatalog
      const downloadedIds = assetCatalog.getDownloadedAssetIds();
      const items: StoredAssetItem[] = [];

      for (const id of downloadedIds) {
        const catItem = assetCatalog.getAssetById(id);
        const inTimeline = timelineAssetIds.has(id);
        const size = catItem?.fileSize || 1024 * 500; // fallback approx size
        items.push({
          id,
          size,
          inTimeline,
          catalogItem: catItem,
        });
      }

      setStoredAssets(items);
    } catch (err) {
      console.error('[StorageManagement] Error querying storage:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshStorage();
    }
  }, [isOpen, timelineAssetIds]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleDeleteAsset = async (assetId: string) => {
    try {
      await deleteMediaBlob(assetId);
      assetCatalog.markAsRemoved(assetId);
      setStoredAssets((prev) => prev.filter((a) => a.id !== assetId));
      setConfirmDeleteId(null);
    } catch (err) {
      console.error('[StorageManagement] Failed to delete asset:', err);
    }
  };

  const handleClearUnused = async () => {
    setIsClearingUnused(true);
    try {
      const unused = storedAssets.filter((a) => !a.inTimeline);
      for (const item of unused) {
        await deleteMediaBlob(item.id);
        assetCatalog.markAsRemoved(item.id);
      }
      await refreshStorage();
    } finally {
      setIsClearingUnused(false);
    }
  };

  const filteredItems = useMemo(() => {
    if (!search.trim()) return storedAssets;
    const q = search.toLowerCase();
    return storedAssets.filter(
      (a) =>
        a.catalogItem?.name.toLowerCase().includes(q) ||
        a.catalogItem?.localizedName.toLowerCase().includes(q) ||
        a.catalogItem?.category.toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q)
    );
  }, [storedAssets, search]);

  if (!isOpen) return null;

  const usagePercent = storageQuota > 0 ? Math.min(100, Math.round((totalStorageUsed / storageQuota) * 100)) : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150 select-none"
      onClick={onClose}
    >
      <div
        className="bg-[#111419] border border-[#292F39] rounded-[6px] shadow-2xl max-w-2xl w-full flex flex-col max-h-[85vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#292F39] bg-[#0B0D10]">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Depolama & Önbellek Yönetimi</h2>
              <p className="text-[11px] text-[#94A3B8]">
                İndirilen medya ve çevrimdışı paketlerin cihazdaki yerel kullanımını yönetin
              </p>
            </div>
          </div>
          <button
            type="button"
            data-testid="close-storage-modal"
            onClick={onClose}
            className="text-[#94A3B8] hover:text-white p-1 rounded hover:bg-[#202631] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Storage Bar Overview */}
        <div className="p-5 border-b border-[#292F39] bg-[#0E1015] space-y-3">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-[#94A3B8]" />
              <span className="text-[#E2E8F0] font-medium">Toplam Tarayıcı Depolama Alanı</span>
            </div>
            <div className="text-right">
              <span className="font-semibold text-white">{formatBytes(totalStorageUsed)}</span>
              {storageQuota > 0 && (
                <span className="text-[#64748B] text-[11px]"> / {formatBytes(storageQuota)}</span>
              )}
            </div>
          </div>

          <div className="w-full bg-[#1A1F29] rounded-full h-2 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                usagePercent > 80 ? 'bg-red-500' : usagePercent > 50 ? 'bg-amber-500' : 'bg-indigo-500'
              }`}
              style={{ width: `${Math.max(1, usagePercent)}%` }}
            />
          </div>

          <div className="flex items-center justify-between pt-1 text-[11px] text-[#94A3B8]">
            <span>İndirilen Öğe Sayısı: <strong className="text-white">{storedAssets.length}</strong></span>
            <span>Kullanım Oranı: <strong className="text-white">%{usagePercent}</strong></span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="px-5 py-3 border-b border-[#292F39] flex items-center justify-between gap-3 bg-[#111419]">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#64748B]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="İndirilenlerde ara..."
              className="w-full bg-[#0E1014] border border-[#292F39] rounded px-8 py-1.5 text-xs text-white placeholder-[#64748B] focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={refreshStorage}
              disabled={loading}
              title="Yenile"
              className="p-1.5 rounded bg-[#1A1F29] border border-[#292F39] text-[#94A3B8] hover:text-white hover:bg-[#202631] transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={handleClearUnused}
              disabled={isClearingUnused || storedAssets.filter((a) => !a.inTimeline).length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#202631] hover:bg-[#2E3747] text-xs text-[#CBD5E1] border border-[#292F39] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5 text-amber-400" />
              <span>Kullanılmayanları Sil</span>
            </button>
          </div>
        </div>

        {/* Stored Items List */}
        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar space-y-2">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-[#94A3B8] text-xs">
              <RefreshCw className="w-6 h-6 animate-spin mb-2 text-indigo-400" />
              Depolama önbelleği taranıyor...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-[#64748B] text-xs text-center">
              <HardDrive className="w-8 h-8 mb-2 stroke-1 opacity-60" />
              <p className="font-medium text-[#94A3B8]">Henüz indirilmiş medya bulunmuyor</p>
              <p className="text-[11px] mt-1 max-w-xs">
                Kütüphaneden veya çevrimdışı paketlerden asset indirdiğinizde burada listelenir.
              </p>
            </div>
          ) : (
            filteredItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-2.5 rounded bg-[#0E1015] border border-[#202631] hover:border-[#2E3747] transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {item.catalogItem?.thumbnailPath ? (
                    <img
                      src={item.catalogItem.thumbnailPath}
                      alt=""
                      className="w-10 h-10 rounded object-cover bg-black/40 border border-[#292F39] shrink-0"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-10 h-10 rounded bg-[#1A1F29] flex items-center justify-center text-[#64748B] border border-[#292F39] shrink-0">
                      <Layers className="w-4 h-4" />
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-white truncate max-w-[280px]">
                        {item.catalogItem?.localizedName || item.catalogItem?.name || item.id}
                      </span>
                      {item.inTimeline ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-medium shrink-0">
                          Zaman Çizelgesinde
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#1A1F29] text-[#94A3B8] border border-[#292F39] shrink-0">
                          Kullanılmıyor
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-[#64748B] mt-0.5">
                      <span>{item.catalogItem?.category || 'Medya'}</span>
                      <span>•</span>
                      <span>{formatBytes(item.size)}</span>
                      <span>•</span>
                      <span className="uppercase">{item.catalogItem?.type || 'ASSET'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {confirmDeleteId === item.id ? (
                    <div className="flex items-center gap-1.5 bg-red-950/40 border border-red-800/50 p-1 rounded">
                      {item.inTimeline && (
                        <span className="text-[10px] text-red-300 px-1 font-medium" title="Zaman çizelgesinde aktif!">
                          ⚠️ Kullanımda!
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteAsset(item.id)}
                        className="px-2 py-0.5 bg-red-600 hover:bg-red-500 text-white rounded text-[11px] font-medium"
                      >
                        Evet, Sil
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-2 py-0.5 bg-[#202631] text-[#94A3B8] hover:text-white rounded text-[11px]"
                      >
                        İptal
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(item.id)}
                      className="p-1.5 rounded text-[#64748B] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title={item.inTimeline ? 'Uyarı: Zaman çizelgesinde kullanılmaktadır' : 'Cihazdan sil'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#292F39] bg-[#0B0D10] flex items-center justify-between text-xs text-[#64748B]">
          <div className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-indigo-400" />
            <span>Silinen varlıklar gerekirse kütüphaneden tekrar indirilebilir.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-[#202631] hover:bg-[#2E3747] text-white rounded text-xs font-medium transition-colors"
          >
            Tamam
          </button>
        </div>
      </div>
    </div>
  );
};
