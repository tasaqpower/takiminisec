// IndexedDB storage for Forma document drafts
export interface FormaDraft {
  id: string;
  name: string;
  type: "pdf" | "word";
  fileData: ArrayBuffer;
  timestamp: number;
  intent: string;
  marks?: any[];
  removals?: any[];
  wordContent?: string;
  pageRotations?: Record<number, number>;
  currentPage?: number;
  formFields?: any[];
  pageImages?: any[];
  pageOrder?: number[];
  zoom?: number;
  isDirty?: boolean;
}

const DB_NAME = "forma_drafts_db";
const STORE_NAME = "drafts";
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      return reject(new Error("IndexedDB is not supported in this environment"));
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveDraft(draft: FormaDraft): Promise<boolean> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(draft);
      req.onsuccess = () => resolve(true);
      req.onerror = () => {
        if (req.error && req.error.name === "QuotaExceededError") {
          console.warn("Forma: IndexedDB quota exceeded, draft not saved.");
        }
        reject(req.error);
      };
      tx.oncomplete = () => db.close();
    });
  } catch (err) {
    console.error("Failed to save draft:", err);
    return false;
  }
}

export async function getLatestDraft(): Promise<FormaDraft | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const list = req.result as FormaDraft[];
        if (!list || list.length === 0) {
          resolve(null);
        } else {
          list.sort((a, b) => b.timestamp - a.timestamp);
          resolve(list[0]);
        }
      };
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  } catch (err) {
    console.error("Failed to read draft:", err);
    return null;
  }
}

export async function deleteDraft(id = "current_draft"): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  } catch (err) {
    console.error("Failed to delete draft:", err);
  }
}

export async function clearAllDrafts(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  } catch (err) {
    console.error("Failed to clear drafts:", err);
  }
}

export async function getStorageEstimate(): Promise<{ usage: number; quota: number } | null> {
  if (typeof navigator !== "undefined" && navigator.storage && navigator.storage.estimate) {
    try {
      const est = await navigator.storage.estimate();
      return { usage: est.usage || 0, quota: est.quota || 0 };
    } catch {
      return null;
    }
  }
  return null;
}
