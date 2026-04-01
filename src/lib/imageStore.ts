/**
 * IndexedDB-backed store for generated era images.
 *
 * localStorage can't hold base64 images (5 MB limit for the whole origin).
 * IndexedDB has no practical size limit, so we store heavy image data here
 * and keep only lightweight metadata (place, eras, prompts) in localStorage.
 *
 * Each record is keyed by the era's `id` string (e.g. "41.9028-12.4964-0").
 */

const DB_NAME = "chronoview-images";
const DB_VERSION = 1;
const STORE_NAME = "images";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Save a base64 data URL for an era */
export async function saveImage(eraId: string, base64: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(base64, eraId);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  } catch {
    // Silently fail — worst case the image isn't cached
  }
}

/** Get a base64 data URL for an era, or null if not cached */
export async function getImage(eraId: string): Promise<string | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(eraId);
      req.onsuccess = () => { db.close(); resolve(req.result ?? null); };
      req.onerror = () => { db.close(); reject(req.error); };
    });
  } catch {
    return null;
  }
}

/** Load images for multiple era IDs at once */
export async function getImages(eraIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (eraIds.length === 0) return map;
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      let pending = eraIds.length;

      for (const id of eraIds) {
        const req = store.get(id);
        req.onsuccess = () => {
          if (req.result) map.set(id, req.result);
          if (--pending === 0) { db.close(); resolve(map); }
        };
        req.onerror = () => {
          if (--pending === 0) { db.close(); resolve(map); }
        };
      }

      // Fallback if eraIds is somehow empty after starting
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  } catch {
    return map;
  }
}

/** Delete all cached images */
export async function clearImages(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  } catch {
    // Silently fail
  }
}
