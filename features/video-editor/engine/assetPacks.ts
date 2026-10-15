/**
 * FORMA Video Editor — Offline Asset Packs Service
 * Handles loading pack metadata, downloading full offline packages into IndexedDB,
 * pausing, resuming, cancelling, and removing packs.
 */

import { assetCatalog } from './assetCatalog';
import { assetDownloader } from './assetDownloader';
import { deleteAssetBlob } from '../db';

export interface AssetPack {
  id: string;
  name: string;
  category: string;
  description: string;
  assetCount: number;
  totalSizeBytes: number;
  totalSizeFormatted: string;
  sources: string[];
  licenses: string[];
  assetIds: string[];
  version: string;
}

export interface PackDownloadState {
  packId: string;
  status: 'not-installed' | 'downloading' | 'paused' | 'installed';
  completedCount: number;
  totalCount: number;
  percent: number;
}

class AssetPacksService {
  private packs: AssetPack[] = [];
  private isLoaded = false;
  private packStates: Map<string, PackDownloadState> = new Map();
  private activePackAborts: Map<string, boolean> = new Map();
  private listeners: Set<() => void> = new Set();

  public subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify(): void {
    for (const cb of this.listeners) {
      cb();
    }
  }

  public async loadPacks(): Promise<AssetPack[]> {
    if (this.isLoaded) return this.packs;

    try {
      const res = await fetch('/video-assets/ASSET_PACKS.json');
      if (res.ok) {
        this.packs = await res.json();
      }
    } catch (e) {
      console.warn('[AssetPacks] Failed to fetch ASSET_PACKS.json:', e);
      this.packs = [];
    }

    this.isLoaded = true;
    this.notify();
    return this.packs;
  }

  public getPacks(): AssetPack[] {
    return this.packs;
  }

  public getPackById(packId: string): AssetPack | undefined {
    return this.packs.find((p) => p.id === packId);
  }

  public getPackState(packId: string): PackDownloadState {
    const existing = this.packStates.get(packId);
    if (existing) return existing;

    const pack = this.getPackById(packId);
    if (!pack) {
      return {
        packId,
        status: 'not-installed',
        completedCount: 0,
        totalCount: 0,
        percent: 0,
      };
    }

    // Check how many assets are downloaded locally
    let completed = 0;
    for (const id of pack.assetIds) {
      if (assetCatalog.isDownloaded(id)) completed++;
    }

    const isFullyInstalled = pack.assetIds.length > 0 && completed === pack.assetIds.length;
    const state: PackDownloadState = {
      packId,
      status: isFullyInstalled ? 'installed' : 'not-installed',
      completedCount: completed,
      totalCount: pack.assetIds.length,
      percent: pack.assetIds.length > 0 ? Math.round((completed / pack.assetIds.length) * 100) : 0,
    };
    this.packStates.set(packId, state);
    return state;
  }

  /**
   * Start or resume downloading an offline pack
   */
  public async downloadPack(packId: string): Promise<void> {
    const pack = this.getPackById(packId);
    if (!pack) return;

    this.activePackAborts.set(packId, false);

    const state: PackDownloadState = {
      packId,
      status: 'downloading',
      completedCount: 0,
      totalCount: pack.assetIds.length,
      percent: 0,
    };
    this.packStates.set(packId, state);
    this.notify();

    let completed = 0;

    for (const assetId of pack.assetIds) {
      // Check if paused / cancelled
      if (this.activePackAborts.get(packId)) {
        state.status = 'paused';
        this.notify();
        return;
      }

      const asset = assetCatalog.getAssetById(assetId);
      if (asset) {
        if (!assetCatalog.isDownloaded(asset.id)) {
          await assetDownloader.downloadAsset(asset);
        }
        completed++;
        state.completedCount = completed;
        state.percent = Math.round((completed / pack.assetIds.length) * 100);
        this.notify();
      }
    }

    state.status = 'installed';
    state.percent = 100;
    this.notify();
  }

  public pauseDownload(packId: string): void {
    this.activePackAborts.set(packId, true);
    const state = this.packStates.get(packId);
    if (state) {
      state.status = 'paused';
      this.notify();
    }
  }

  public cancelDownload(packId: string): void {
    this.activePackAborts.set(packId, true);
    const state = this.packStates.get(packId);
    if (state) {
      state.status = 'not-installed';
      state.completedCount = 0;
      state.percent = 0;
      this.notify();
    }
  }

  /**
   * Remove pack from local device storage while preserving assets used in active timeline
   */
  public async removePack(packId: string, protectedAssetIds?: Set<string>): Promise<void> {
    const pack = this.getPackById(packId);
    if (!pack) return;

    // Discover currently referenced asset IDs from active project
    const activeProjectAssetIds = new Set<string>(protectedAssetIds || []);
    if (typeof window !== 'undefined' && (window as any).__formaEditor?.project?.tracks) {
      const tracks = (window as any).__formaEditor.project.tracks;
      for (const track of tracks) {
        for (const clip of track.clips || []) {
          if (clip.assetId) activeProjectAssetIds.add(clip.assetId);
        }
      }
    }

    for (const assetId of pack.assetIds) {
      // PRESERVE if referenced by active project timeline
      if (activeProjectAssetIds.has(assetId)) {
        continue;
      }

      const asset = assetCatalog.getAssetById(assetId);
      if (asset && !asset.isBuiltIn) {
        await deleteAssetBlob(assetId);
      }
    }

    const state = this.packStates.get(packId);
    if (state) {
      // Re-evaluate state based on remaining assets
      let remainingCompleted = 0;
      for (const id of pack.assetIds) {
        if (assetCatalog.isDownloaded(id)) remainingCompleted++;
      }
      state.status = remainingCompleted === pack.assetIds.length && pack.assetIds.length > 0 ? 'installed' : 'not-installed';
      state.completedCount = remainingCompleted;
      state.percent = pack.assetIds.length > 0 ? Math.round((remainingCompleted / pack.assetIds.length) * 100) : 0;
    }
    this.notify();
  }
}

export const assetPacks = new AssetPacksService();
