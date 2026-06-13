import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'zha-offline';
const DB_VERSION = 31;
const STORE_META = 'zha-downloads-meta';
const STORE_AUDIO = 'zha-downloads-audio';

export interface DownloadMeta {
  videoId: string;
  downloadedAt: number;
  lastPlayedAt: number;
  title: string;
  artist: string;
  thumbnail: string;
}

let dbPromise: Promise<IDBPDatabase<any>>;

export const initDB = async () => {
  if (!dbPromise) {
    // Get the current version from the browser first to avoid VersionError
    const currentVersion = await new Promise<number>((resolve) => {
      if (typeof indexedDB === 'undefined') {
        resolve(0);
        return;
      }
      const req = indexedDB.open(DB_NAME);
      req.onsuccess = () => {
        const version = req.result.version;
        req.result.close();
        resolve(version);
      };
      req.onerror = () => resolve(0);
    });

    // Use whichever is higher — never downgrade
    const targetVersion = Math.max(currentVersion, DB_VERSION);

    dbPromise = openDB(DB_NAME, targetVersion, {
      upgrade(db, oldVersion, newVersion) {
        console.log(`Upgrading IndexedDB from ${oldVersion} to ${newVersion}`);
        if (!db.objectStoreNames.contains(STORE_META)) {
          const metaStore = db.createObjectStore(STORE_META, { keyPath: 'videoId' });
          metaStore.createIndex('downloadedAt', 'downloadedAt');
          metaStore.createIndex('lastPlayedAt', 'lastPlayedAt');
        }
        if (!db.objectStoreNames.contains(STORE_AUDIO)) {
          db.createObjectStore(STORE_AUDIO, { keyPath: 'videoId' });
        }
      },
    });
  }
  return dbPromise;
};

export const getQuotaInfo = async () => {
  if (navigator.storage && navigator.storage.estimate) {
    return await navigator.storage.estimate();
  }
  return { usage: 0, quota: 0 };
};
