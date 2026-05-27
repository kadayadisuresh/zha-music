import { openDB } from 'idb';

const DB_NAME = 'zha-offline';
const STORE_META = 'zha-downloads-meta';
const STORE_AUDIO = 'zha-downloads-audio';

let db = null;
let queue = [];
let isProcessing = false;
let currentController = null;

async function getDB() {
  if (!db) {
    db = await openDB(DB_NAME, 1);
  }
  return db;
}

self.onmessage = async (e) => {
  const { type, payload } = e.data;

  if (type === 'ADD_TO_QUEUE') {
    queue.push(payload);
    processQueue();
  } else if (type === 'CANCEL') {
    if (currentController) {
      currentController.abort();
    }
  }
};

async function processQueue() {
  if (isProcessing || queue.length === 0) return;
  isProcessing = true;

  while (queue.length > 0) {
    const task = queue.shift();
    currentController = new AbortController();
    
    try {
      await downloadTask(task, currentController.signal);
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Download failed', err);
      }
    }
  }

  isProcessing = false;
  currentController = null;
}

async function downloadTask(task, signal) {
  const { videoId, url, meta } = task;
  const dbInstance = await getDB();
  
  const response = await fetch(url, { signal });
  const reader = response.body.getReader();
  const contentLength = +response.headers.get('Content-Length');
  let receivedLength = 0;
  let chunks = [];
  let lastProgress = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    receivedLength += value.length;
    
    const progress = Math.round((receivedLength / contentLength) * 100);
    if (progress - lastProgress >= 5) {
      lastProgress = progress;
      self.postMessage({ type: 'PROGRESS', videoId, progress });
    }
  }

  const blob = new Blob(chunks);
  
  const tx = dbInstance.transaction([STORE_META, STORE_AUDIO], 'readwrite');
  await Promise.all([
    tx.objectStore(STORE_META).put({ ...meta, videoId, downloadedAt: Date.now(), lastPlayedAt: 0 }),
    tx.objectStore(STORE_AUDIO).put({ videoId, data: blob }),
    tx.done
  ]);
  
  self.postMessage({ type: 'COMPLETE', videoId });
}
