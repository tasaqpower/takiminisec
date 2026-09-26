/**
 * FORMA Video Editor — Persistent Storage Layer
 * IndexedDB for project state & OPFS with IndexedDB fallback for media blobs
 */

import type { VideoProject } from './types';

const DB_NAME = 'forma_video_editor_db';
const DB_VERSION = 1;
const STORE_PROJECTS = 'projects';
const STORE_MEDIA = 'media_blobs';

let dbPromise: Promise<IDBDatabase> | null = null;

function getDb(): Promise<IDBDatabase> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('IndexedDB only available in browser'));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
          db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_MEDIA)) {
          db.createObjectStore(STORE_MEDIA, { keyPath: 'assetId' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

// ---------------------------------------------------------------------------
// OPFS (Origin Private File System) with IDB Fallback
// ---------------------------------------------------------------------------

async function getOpfsDirectory(): Promise<FileSystemDirectoryHandle | null> {
  if (typeof navigator !== 'undefined' && 'storage' in navigator && navigator.storage.getDirectory) {
    try {
      const root = await navigator.storage.getDirectory();
      return await root.getDirectoryHandle('forma_video_media', { create: true });
    } catch {
      return null;
    }
  }
  return null;
}

export async function saveMediaBlob(assetId: string, blob: Blob): Promise<void> {
  try {
    const opfsDir = await getOpfsDirectory();
    if (opfsDir) {
      const fileHandle = await opfsDir.getFileHandle(assetId, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    }
  } catch (err) {
    console.warn('OPFS save failed, falling back to IndexedDB:', err);
  }

  // Fallback to IndexedDB
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MEDIA, 'readwrite');
    const store = tx.objectStore(STORE_MEDIA);
    const req = store.put({ assetId, blob, updatedAt: Date.now() });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function loadMediaBlob(assetId: string): Promise<Blob | null> {
  try {
    const opfsDir = await getOpfsDirectory();
    if (opfsDir) {
      try {
        const fileHandle = await opfsDir.getFileHandle(assetId);
        const file = await fileHandle.getFile();
        if (file && file.size > 0) return file;
      } catch {
        // File may be in IndexedDB fallback
      }
    }
  } catch (err) {
    console.warn('OPFS read failed, falling back to IndexedDB:', err);
  }

  // Fallback to IndexedDB
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MEDIA, 'readonly');
    const store = tx.objectStore(STORE_MEDIA);
    const req = store.get(assetId);
    req.onsuccess = () => {
      const record = req.result;
      resolve(record ? record.blob : null);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteMediaBlob(assetId: string): Promise<void> {
  try {
    const opfsDir = await getOpfsDirectory();
    if (opfsDir) {
      try {
        await opfsDir.removeEntry(assetId);
      } catch {}
    }
  } catch {}

  try {
    const db = await getDb();
    const tx = db.transaction(STORE_MEDIA, 'readwrite');
    tx.objectStore(STORE_MEDIA).delete(assetId);
  } catch {}
}

// ---------------------------------------------------------------------------
// Project State Storage
// ---------------------------------------------------------------------------

export async function saveVideoProject(project: VideoProject): Promise<void> {
  const db = await getDb();
  const serializableProject = {
    ...project,
    updatedAt: Date.now(),
    // Strip in-memory File objects before storing in project JSON
    assets: Object.fromEntries(
      Object.entries(project.assets || {}).map(([k, v]) => [
        k,
        {
          ...v,
          file: undefined, // File object is saved separately via saveMediaBlob
        },
      ])
    ),
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PROJECTS, 'readwrite');
    const store = tx.objectStore(STORE_PROJECTS);
    const req = store.put(serializableProject);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function loadVideoProject(id: string): Promise<VideoProject | null> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PROJECTS, 'readonly');
    const store = tx.objectStore(STORE_PROJECTS);
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function getLatestVideoProject(): Promise<VideoProject | null> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PROJECTS, 'readonly');
    const store = tx.objectStore(STORE_PROJECTS);
    const req = store.getAll();
    req.onsuccess = () => {
      const list = req.result as VideoProject[];
      if (!list || list.length === 0) {
        resolve(null);
        return;
      }
      list.sort((a, b) => b.updatedAt - a.updatedAt);
      resolve(list[0]);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteVideoProject(id: string): Promise<void> {
  const db = await getDb();
  const proj = await loadVideoProject(id);
  if (proj && proj.assets) {
    for (const assetId of Object.keys(proj.assets)) {
      await deleteMediaBlob(assetId).catch(() => {});
    }
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PROJECTS, 'readwrite');
    const store = tx.objectStore(STORE_PROJECTS);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// Aliases
export const saveProjectMetadata = saveVideoProject;
export const loadLatestProject = getLatestVideoProject;
export const deleteProjectMetadata = deleteVideoProject;
export const saveAssetBlob = saveMediaBlob;
export const getAssetBlob = loadMediaBlob;
