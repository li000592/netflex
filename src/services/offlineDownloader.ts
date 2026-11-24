import { Episode, MediaItem, OfflineDownloadItem } from '../types';
import { saveDownload, deleteDownload, getDownload, getAllDownloads } from './offlineStorage';

type DownloadListener = (items: OfflineDownloadItem[]) => void;

class OfflineDownloaderService {
  private activeControllers = new Map<string, AbortController>();
  private activeItems = new Map<string, OfflineDownloadItem>();
  private listeners = new Set<DownloadListener>();

  constructor() {
    // Attempt to request persistent storage on browser if supported
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
      navigator.storage.persist().catch(() => {});
    }
  }

  public subscribe(listener: DownloadListener): () => void {
    this.listeners.add(listener);
    // Immediately emit current state
    this.emitChange();
    return () => {
      this.listeners.delete(listener);
    };
  }

  private async emitChange(): Promise<void> {
    const all = await getAllDownloads();
    // Merge any memory-active downloading items that might have more recent progress
    const merged = all.map((item) => {
      if (this.activeItems.has(item.id)) {
        return this.activeItems.get(item.id)!;
      }
      return item;
    });

    for (const listener of this.listeners) {
      try {
        listener(merged);
      } catch (err) {
        console.error('Download listener error:', err);
      }
    }
  }

  public getActiveItem(id: string): OfflineDownloadItem | undefined {
    return this.activeItems.get(id);
  }

  public isDownloading(id: string): boolean {
    return this.activeControllers.has(id);
  }

  public async startDownload(
    movie: MediaItem,
    episode: Episode,
    episodeIndex = 0
  ): Promise<void> {
    const downloadId = `${movie.id}_${episode.name || 'ep_' + episodeIndex}`;

    // Check if already downloading
    if (this.activeControllers.has(downloadId)) {
      return;
    }

    // Check if already completed in DB
    const existing = await getDownload(downloadId);
    if (existing && existing.status === 'completed' && existing.blob) {
      return;
    }

    const abortController = new AbortController();
    this.activeControllers.set(downloadId, abortController);

    const initialItem: OfflineDownloadItem = {
      id: downloadId,
      movieId: movie.id,
      movieTitle: movie.title,
      movieCover: movie.cover,
      category: movie.category,
      sourceCategory: movie.sourceCategory,
      episodeName: episode.name || `第 ${episodeIndex + 1} 集`,
      episodeIndex,
      sourceUrl: movie.sourceUrl,
      vodId: movie.vod_id,
      playUrl: episode.url,
      status: 'pending',
      progress: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      downloadedSegments: 0,
      totalSegments: 0,
      downloadedAt: Date.now(),
    };

    this.activeItems.set(downloadId, initialItem);
    await saveDownload(initialItem);
    this.emitChange();

    try {
      initialItem.status = 'downloading';
      this.activeItems.set(downloadId, initialItem);
      this.emitChange();

      // 1. Resolve M3U8 Playlist (Handles Master Playlist redirects if needed)
      let playlistUrl = episode.url;
      const m3u8Res = await fetch(playlistUrl, { signal: abortController.signal });
      if (!m3u8Res.ok) throw new Error(`HTTP ${m3u8Res.status} fetching playlist`);
      let m3u8Text = await m3u8Res.text();

      // Check if Master Playlist
      if (m3u8Text.includes('#EXT-X-STREAM-INF')) {
        const lines = m3u8Text.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes('#EXT-X-STREAM-INF')) {
            const next = lines[i + 1]?.trim();
            if (next && !next.startsWith('#')) {
              playlistUrl = new URL(next, playlistUrl).href;
              const subRes = await fetch(playlistUrl, { signal: abortController.signal });
              if (subRes.ok) {
                m3u8Text = await subRes.text();
              }
              break;
            }
          }
        }
      }

      // 2. Extract all TS Segments
      const segmentUrls: string[] = [];
      const lines = m3u8Text.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('#EXTINF')) {
          const next = lines[i + 1]?.trim();
          if (next && !next.startsWith('#')) {
            try {
              const fullUrl = new URL(next, playlistUrl).href;
              segmentUrls.push(fullUrl);
            } catch {
              // Ignore malformed URL
            }
          }
        }
      }

      if (segmentUrls.length === 0) {
        throw new Error('No video segments found in stream playlist');
      }

      initialItem.totalSegments = segmentUrls.length;
      this.activeItems.set(downloadId, initialItem);
      await saveDownload(initialItem);
      this.emitChange();

      // 3. Concurrent Segment Downloader Pool
      const concurrency = 4;
      const chunks: ArrayBuffer[] = new Array(segmentUrls.length);
      let downloadedCount = 0;
      let totalBytesCount = 0;
      let nextIndex = 0;
      let lastSaveTime = Date.now();

      const downloadWorker = async (): Promise<void> => {
        while (nextIndex < segmentUrls.length) {
          if (abortController.signal.aborted) throw new Error('Download aborted by user');

          const currentIndex = nextIndex++;
          const segUrl = segmentUrls[currentIndex];

          let attempts = 0;
          let success = false;
          while (attempts < 3 && !success) {
            if (abortController.signal.aborted) throw new Error('Download aborted by user');
            attempts++;
            try {
              const res = await fetch(segUrl, { signal: abortController.signal });
              if (!res.ok) throw new Error(`Segment HTTP ${res.status}`);
              const buffer = await res.arrayBuffer();
              chunks[currentIndex] = buffer;
              totalBytesCount += buffer.byteLength;
              downloadedCount++;
              success = true;
            } catch (err: any) {
              if (abortController.signal.aborted) throw err;
              if (attempts >= 3) throw err;
              await new Promise((r) => setTimeout(r, 600));
            }
          }

          // Update Progress
          const currentProgress = Math.min(
            99,
            Math.round((downloadedCount / segmentUrls.length) * 100)
          );
          initialItem.progress = currentProgress;
          initialItem.downloadedSegments = downloadedCount;
          initialItem.downloadedBytes = totalBytesCount;
          initialItem.totalBytes = totalBytesCount;
          this.activeItems.set(downloadId, initialItem);

          // Throttle database persistence to every 1.5 seconds
          if (Date.now() - lastSaveTime > 1500) {
            lastSaveTime = Date.now();
            await saveDownload({ ...initialItem });
            this.emitChange();
          }
        }
      };

      // Launch concurrency workers
      const workers = Array.from({ length: Math.min(concurrency, segmentUrls.length) }, () =>
        downloadWorker()
      );
      await Promise.all(workers);

      // 4. Combine all TS Segments into a unified video Blob
      // Typed as video/mp4 (or video/mp2t) so browser video element can play seamlessly
      const combinedBlob = new Blob(chunks, { type: 'video/mp4' });

      initialItem.status = 'completed';
      initialItem.progress = 100;
      initialItem.downloadedSegments = segmentUrls.length;
      initialItem.downloadedBytes = combinedBlob.size;
      initialItem.totalBytes = combinedBlob.size;
      initialItem.blob = combinedBlob;
      initialItem.downloadedAt = Date.now();

      await saveDownload(initialItem);
      this.activeItems.delete(downloadId);
      this.activeControllers.delete(downloadId);
      this.emitChange();
    } catch (err: any) {
      if (abortController.signal.aborted) {
        console.log(`Download ${downloadId} was cancelled`);
        await deleteDownload(downloadId);
        this.activeItems.delete(downloadId);
        this.activeControllers.delete(downloadId);
        this.emitChange();
        return;
      }

      console.error(`Download error for ${downloadId}:`, err);
      initialItem.status = 'failed';
      initialItem.error = err.message || 'Download failed';
      this.activeItems.delete(downloadId);
      this.activeControllers.delete(downloadId);
      await saveDownload(initialItem);
      this.emitChange();
    }
  }

  public cancelDownload(id: string): void {
    const controller = this.activeControllers.get(id);
    if (controller) {
      controller.abort();
      this.activeControllers.delete(id);
    }
    this.activeItems.delete(id);
    deleteDownload(id).then(() => {
      this.emitChange();
    });
  }

  public async deleteDownloadedItem(id: string): Promise<void> {
    this.cancelDownload(id);
    await deleteDownload(id);
    await this.emitChange();
  }
}

// Global Singleton Instance
export const offlineDownloader = new OfflineDownloaderService();
