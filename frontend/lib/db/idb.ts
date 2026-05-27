import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'zha-offline';
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

export const initDB = () => {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
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
