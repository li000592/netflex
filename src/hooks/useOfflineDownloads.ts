import { useState, useEffect } from 'react';
import { OfflineDownloadItem } from '../types';
import { offlineDownloader } from '../services/offlineDownloader';
import { getAllDownloads, getStorageUsage } from '../services/offlineStorage';

export function useOfflineDownloads() {
  const [downloads, setDownloads] = useState<OfflineDownloadItem[]>([]);
  const [storageInfo, setStorageInfo] = useState<{
    usedBytes: number;
    quotaBytes: number;
    formattedUsed: string;
    formattedQuota: string;
    percent: number;
  }>({
    usedBytes: 0,
    quotaBytes: 0,
    formattedUsed: '0 MB',
    formattedQuota: '0 GB',
    percent: 0,
  });

  const refreshStorage = () => {
    getStorageUsage().then(setStorageInfo);
  };

  useEffect(() => {
    // Initial fetch
    getAllDownloads().then((items) => {
      setDownloads(items);
      refreshStorage();
    });

    // Subscribe to live download progress updates
    const unsubscribe = offlineDownloader.subscribe((items) => {
      setDownloads(items);
      refreshStorage();
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const startDownload = (
    movie: any,
    episode: any,
    episodeIndex = 0
  ) => {
    offlineDownloader.startDownload(movie, episode, episodeIndex);
  };

  const cancelDownload = (id: string) => {
    offlineDownloader.cancelDownload(id);
  };

  const deleteDownload = (id: string) => {
    offlineDownloader.deleteDownloadedItem(id);
  };

  const getDownloadState = (id: string): OfflineDownloadItem | undefined => {
    return downloads.find((d) => d.id === id);
  };

  return {
    downloads,
    storageInfo,
    startDownload,
    cancelDownload,
    deleteDownload,
    getDownloadState,
    refreshStorage,
  };
}
