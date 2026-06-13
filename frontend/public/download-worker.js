const DB_NAME = 'zha-offline';
const STORE_META = 'zha-downloads-meta';
const STORE_AUDIO = 'zha-downloads-audio';
const MAX_CONCURRENT = 2;          // songs downloaded at once
const PARALLEL_CHUNKS = 6;         // connections per song (browser caps ~6/host)
const MIN_CHUNK_BYTES = 256 * 1024; // don't split tiny files

let db = null;
let queue = [];
let activeCount = 0;
let controllers = {}; // videoId -> AbortController

function getDB() {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }
    const request = indexedDB.open(DB_NAME);
    request.onsuccess = (e) => {
      db = e.target.result;
      resolve(db);
    };
    request.onerror = (e) => {
      reject(e.target.error);
    };
    request.onupgradeneeded = (e) => {
      const activeDb = e.target.result;
      if (!activeDb.objectStoreNames.contains(STORE_META)) {
        const metaStore = activeDb.createObjectStore(STORE_META, { keyPath: 'videoId' });
        metaStore.createIndex('downloadedAt', 'downloadedAt', { unique: false });
        metaStore.createIndex('lastPlayedAt', 'lastPlayedAt', { unique: false });
      }
      if (!activeDb.objectStoreNames.contains(STORE_AUDIO)) {
        activeDb.createObjectStore(STORE_AUDIO, { keyPath: 'videoId' });
      }
    };
  });
}

self.onmessage = async (e) => {
  const { type, payload } = e.data;

  if (type === 'ADD_TO_QUEUE') {
    queue.push(payload);
    drainQueue();
  } else if (type === 'CANCEL') {
    const videoId = payload;
    // Remove from pending queue
    queue = queue.filter(task => task.videoId !== videoId);
    // Abort active download
    if (controllers[videoId]) {
      controllers[videoId].abort();
      delete controllers[videoId];
    }
    self.postMessage({ type: 'CANCELLED', videoId });
  }
};

function drainQueue() {
  while (activeCount < MAX_CONCURRENT && queue.length > 0) {
    const task = queue.shift();
    activeCount++;
    runDownload(task).finally(() => {
      activeCount--;
      drainQueue();
    });
  }
}

async function runDownload(task) {
  const { videoId } = task;
  const controller = new AbortController();
  controllers[videoId] = controller;

  try {
    await downloadTask(task, controller.signal);
  } catch (err) {
    if (err.name === 'AbortError') {
      self.postMessage({ type: 'CANCELLED', videoId });
    } else {
      console.error('Download failed', err);
      self.postMessage({ type: 'ERROR', videoId, error: err.message });
    }
  } finally {
    delete controllers[videoId];
  }
}

async function downloadTask(task, signal) {
  const { videoId, url, meta } = task;
  const dbInstance = await getDB();

  self.postMessage({ type: 'PROGRESS', videoId, progress: 0 });

  // 1. Probe: one tiny range request both warms the server-side resolve cache
  //    (yt-dlp) AND tells us the total file size for parallel splitting.
  let totalBytes = 0;
  let rangeSupported = false;
  try {
    const probe = await fetch(url, { headers: { Range: 'bytes=0-0' }, signal });
    if (probe.status === 206) {
      const cr = probe.headers.get('Content-Range'); // e.g. "bytes 0-0/4194304"
      const m = cr && cr.match(/\/(\d+)\s*$/);
      if (m) {
        totalBytes = parseInt(m[1], 10);
        rangeSupported = totalBytes > 0;
      }
    }
    // Drain the 1-byte body so the connection is released.
    await probe.arrayBuffer().catch(() => {});
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    // fall through to single-stream download
  }

  let blob;
  if (rangeSupported && totalBytes > MIN_CHUNK_BYTES) {
    blob = await downloadParallel(videoId, url, totalBytes, signal);
  } else {
    blob = await downloadStreaming(videoId, url, totalBytes, signal);
  }

  // Save to IndexedDB
  await new Promise((resolve, reject) => {
    const tx = dbInstance.transaction([STORE_META, STORE_AUDIO], 'readwrite');
    tx.objectStore(STORE_META).put({ ...meta, videoId, downloadedAt: Date.now(), lastPlayedAt: 0 });
    tx.objectStore(STORE_AUDIO).put({ videoId, data: blob });
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });

  self.postMessage({ type: 'COMPLETE', videoId });
}

// Fetch the file as N parallel byte-ranges. Google's CDN throttles each
// connection independently, so several connections multiply throughput.
async function downloadParallel(videoId, url, totalBytes, signal) {
  const chunkCount = Math.min(PARALLEL_CHUNKS, Math.max(1, Math.ceil(totalBytes / MIN_CHUNK_BYTES)));
  const chunkSize = Math.ceil(totalBytes / chunkCount);

  const parts = new Array(chunkCount);     // assembled in order
  let received = 0;
  let lastReported = -1;

  const reportProgress = () => {
    const p = Math.min(99, Math.round((received / totalBytes) * 100));
    if (p !== lastReported && (p - lastReported >= 2 || p >= 99)) {
      lastReported = p;
      self.postMessage({ type: 'PROGRESS', videoId, progress: p });
    }
  };

  await Promise.all(
    Array.from({ length: chunkCount }, (_, i) => i).map(async (i) => {
      const start = i * chunkSize;
      const end = Math.min(totalBytes - 1, start + chunkSize - 1);
      if (start > end) { parts[i] = new Blob([]); return; }

      const res = await fetch(url, { headers: { Range: `bytes=${start}-${end}` }, signal });
      if (res.status !== 206 && !res.ok) {
        throw new Error(`Chunk ${i} failed with status ${res.status}`);
      }
      const reader = res.body.getReader();
      const buf = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf.push(value);
        received += value.length;
        reportProgress();
      }
      parts[i] = new Blob(buf);
    })
  );

  return new Blob(parts);
}

// Fallback: single streaming connection (used when ranges aren't supported).
async function downloadStreaming(videoId, url, knownTotal, signal) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Fetch failed with status ${response.status}`);

  const reader = response.body.getReader();
  const totalBytes = knownTotal || (+response.headers.get('Content-Length') || 0);
  let received = 0;
  const chunks = [];
  let lastReported = -1;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;

    const progress = totalBytes > 0
      ? Math.min(99, Math.round((received / totalBytes) * 100))
      : Math.min(95, Math.round((received / (4 * 1024 * 1024)) * 100));

    if (progress !== lastReported && (progress - lastReported >= 2 || progress >= 99)) {
      lastReported = progress;
      self.postMessage({ type: 'PROGRESS', videoId, progress });
    }
  }

  return new Blob(chunks);
}
