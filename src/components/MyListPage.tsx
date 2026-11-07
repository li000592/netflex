import React, { useState, useEffect } from 'react';
import { Bookmark, History, Trash2, Play, Film } from 'lucide-react';
import { MediaItem, WatchHistoryItem, WatchlistItem, Episode } from '../types';
import { getWatchHistory, getWatchlist, clearWatchHistory } from '../services/api';
import { MovieCard } from './MovieCard';

interface MyListPageProps {
  onPlay: (movie: MediaItem) => void;
  onOpenDetail: (movie: MediaItem) => void;
  watchlistIds: Set<string>;
  onToggleFavorite: (movie: MediaItem) => void;
  onPlayEpisode: (movie: MediaItem, episode: Episode, groupIndex: number, episodeIndex: number) => void;
}

export const MyListPage: React.FC<MyListPageProps> = ({
  onPlay,
  onOpenDetail,
  watchlistIds,
  onToggleFavorite,
  onPlayEpisode,
}) => {
  const [activeTab, setActiveTab] = useState<'watchlist' | 'history'>('watchlist');
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [history, setHistory] = useState<WatchHistoryItem[]>([]);

  const reloadData = () => {
    setWatchlist(getWatchlist());
    setHistory(getWatchHistory());
  };

  useEffect(() => {
    reloadData();
  }, [watchlistIds]);

  const handleClearHistory = () => {
    if (window.confirm('确定要清空全部播放历史记录吗？')) {
      clearWatchHistory();
      setHistory([]);
    }
  };

  return (
    <div className="min-h-screen pt-24 sm:pt-28 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Tab Switcher */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-8">
        <div className="flex items-center space-x-6">
          <button
            onClick={() => setActiveTab('watchlist')}
            className={`flex items-center text-lg sm:text-xl font-bold transition-colors pb-1 relative ${
              activeTab === 'watchlist' ? 'text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Bookmark className="w-5 h-5 mr-2" />
            我的片单
            <span className="ml-2 text-xs bg-white/10 text-gray-300 px-2 py-0.5 rounded-full font-mono">
              {watchlist.length}
            </span>
            {activeTab === 'watchlist' && (
              <div className="absolute bottom-[-17px] left-0 right-0 h-1 bg-[#E50914] rounded-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center text-lg sm:text-xl font-bold transition-colors pb-1 relative ${
              activeTab === 'history' ? 'text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            <History className="w-5 h-5 mr-2" />
            观看历史
            <span className="ml-2 text-xs bg-white/10 text-gray-300 px-2 py-0.5 rounded-full font-mono">
              {history.length}
            </span>
            {activeTab === 'history' && (
              <div className="absolute bottom-[-17px] left-0 right-0 h-1 bg-[#E50914] rounded-full" />
            )}
          </button>
        </div>

        {activeTab === 'history' && history.length > 0 && (
          <button
            onClick={handleClearHistory}
            className="flex items-center text-xs text-gray-400 hover:text-[#E50914] transition-colors"
          >
            <Trash2 className="w-4 h-4 mr-1" />
            清空历史
          </button>
        )}
      </div>

      {/* Watchlist Tab Content */}
      {activeTab === 'watchlist' && (
        <>
          {watchlist.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 md:gap-5">
              {watchlist.map((item) => {
                const mediaItem: MediaItem = {
                  id: item.id,
                  title: item.title,
                  cover: item.cover,
                  rate: item.rate,
                  remarks: item.remarks,
                };
                return (
                  <div key={item.id} className="flex justify-center">
                    <MovieCard
                      movie={mediaItem}
                      onPlay={onPlay}
                      onOpenDetail={onOpenDetail}
                      isFavorite={watchlistIds.has(item.id)}
                      onToggleFavorite={onToggleFavorite}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-24 text-gray-400">
              <Bookmark className="w-16 h-16 mx-auto mb-4 text-gray-600" />
              <p className="text-lg font-semibold mb-1">您的片单还是空的</p>
              <p className="text-sm text-gray-500">浏览时点击「+ 加入片单」，随时在此重温精彩大片。</p>
            </div>
          )}
        </>
      )}

      {/* History Tab Content */}
      {activeTab === 'history' && (
        <>
          {history.length > 0 ? (
            <div className="space-y-3">
              {history.map((item) => {
                const percent = Math.min(100, Math.round((item.currentTime / (item.duration || 1)) * 100));
                return (
                  <div
                    key={`${item.id}_${item.updatedAt}`}
                    className="flex items-center justify-between p-3 sm:p-4 rounded-xl bg-[#1c1c1c] hover:bg-[#252525] border border-white/5 transition-all group"
                  >
                    <div className="flex items-center space-x-3 sm:space-x-4 overflow-hidden">
                      {/* Thumbnail with progress indicator */}
                      <div className="relative w-20 sm:w-28 aspect-video rounded-lg overflow-hidden bg-black flex-none">
                        <img
                          src={item.cover}
                          alt={item.title}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                          <div
                            className="h-full bg-[#E50914]"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>

                      {/* Info */}
                      <div className="overflow-hidden">
                        <h3 className="text-sm sm:text-base font-bold text-white truncate group-hover:text-[#E50914] transition-colors">
                          {item.title}
                        </h3>
                        <p className="text-xs text-gray-400 mt-0.5 truncate">
                          {item.episodeName} • 已看至 {percent}%
                        </p>
                        <p className="text-[11px] text-gray-500 mt-1">
                          {new Date(item.updatedAt).toLocaleDateString()} {new Date(item.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>

                    {/* Action */}
                    <button
                      onClick={() => {
                        const mediaItem: MediaItem = {
                          id: item.id,
                          title: item.title,
                          cover: item.cover,
                          sourceUrl: item.sourceUrl,
                          vod_id: item.vodId,
                        };
                        onPlayEpisode(
                          mediaItem,
                          { name: item.episodeName, url: item.episodeUrl },
                          0,
                          item.episodeIndex
                        );
                      }}
                      className="flex items-center bg-[#E50914] hover:bg-[#b80710] text-white px-3 sm:px-4 py-2 rounded-lg text-xs font-bold transition-all shadow hover:scale-105 flex-none"
                    >
                      <Play className="w-3.5 h-3.5 fill-current mr-1.5" />
                      继续观看
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-24 text-gray-400">
              <History className="w-16 h-16 mx-auto mb-4 text-gray-600" />
              <p className="text-lg font-semibold mb-1">暂无播放记录</p>
              <p className="text-sm text-gray-500">播放过的影片和观影进度将自动同步记录在此。</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};
