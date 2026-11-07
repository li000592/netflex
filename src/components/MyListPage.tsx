import React, { useState, useEffect } from 'react';
import { Bookmark, History, Trash2, Play, Lock, User as UserIcon } from 'lucide-react';
import { MediaItem, WatchHistoryItem, WatchlistItem, Episode, User, UserProfile } from '../types';
import { getWatchHistory, getWatchlist, clearWatchHistory } from '../services/api';
import { MovieCard } from './MovieCard';
import { useI18n } from '../i18n';

interface MyListPageProps {
  currentUser: User | null;
  currentProfile: UserProfile | null;
  onOpenAuth: () => void;
  onPlay: (movie: MediaItem) => void;
  onOpenDetail: (movie: MediaItem) => void;
  watchlistIds: Set<string>;
  onToggleFavorite: (movie: MediaItem) => void;
  onPlayEpisode: (movie: MediaItem, episode: Episode, groupIndex: number, episodeIndex: number) => void;
}

export const MyListPage: React.FC<MyListPageProps> = ({
  currentUser,
  currentProfile,
  onOpenAuth,
  onPlay,
  onOpenDetail,
  watchlistIds,
  onToggleFavorite,
  onPlayEpisode,
}) => {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<'watchlist' | 'history'>('watchlist');
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [history, setHistory] = useState<WatchHistoryItem[]>([]);

  const reloadData = () => {
    setWatchlist(getWatchlist());
    setHistory(getWatchHistory());
  };

  useEffect(() => {
    reloadData();
  }, [watchlistIds, currentUser, currentProfile, activeTab]);

  const handleClearHistory = () => {
    if (window.confirm(t('confirmClearHistory'))) {
      clearWatchHistory();
      setHistory([]);
    }
  };

  // If user is not logged in, show Netflix Sign-In Callout
  if (!currentUser) {
    return (
      <div className="min-h-screen safe-page-top-lg pb-20 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#E50914]/20 border border-[#E50914]/40 flex items-center justify-center mb-6 shadow-2xl">
          <Lock className="w-8 h-8 sm:w-10 sm:h-10 text-[#E50914]" />
        </div>

        <h1 className="text-2xl sm:text-4xl font-black text-white mb-3">
          {t('signInPromptTitle')}
        </h1>

        <p className="text-gray-400 text-sm sm:text-base max-w-lg mb-8 leading-relaxed">
          {t('signInPromptDesc')}
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4 w-full max-w-xs">
          <button
            onClick={onOpenAuth}
            className="w-full bg-[#E50914] hover:bg-[#b80710] text-white font-bold py-3.5 px-8 rounded-lg text-base transition-transform hover:scale-105 shadow-xl"
          >
            {t('signIn')}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-16 max-w-3xl text-left border-t border-white/10 pt-10">
          <div className="bg-white/5 p-4 rounded-xl border border-white/5">
            <Bookmark className="w-6 h-6 text-[#E50914] mb-2" />
            <h3 className="font-bold text-white text-sm mb-1">{t('feature1Title')}</h3>
            <p className="text-xs text-gray-400">{t('feature1Desc')}</p>
          </div>
          <div className="bg-white/5 p-4 rounded-xl border border-white/5">
            <History className="w-6 h-6 text-[#E50914] mb-2" />
            <h3 className="font-bold text-white text-sm mb-1">{t('feature2Title')}</h3>
            <p className="text-xs text-gray-400">{t('feature2Desc')}</p>
          </div>
          <div className="bg-white/5 p-4 rounded-xl border border-white/5">
            <UserIcon className="w-6 h-6 text-[#E50914] mb-2" />
            <h3 className="font-bold text-white text-sm mb-1">{t('feature3Title')}</h3>
            <p className="text-xs text-gray-400">{t('feature3Desc')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen safe-page-top pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Profile Header Badge */}
      <div className="flex items-center space-x-3 mb-6 bg-white/5 border border-white/10 p-3 sm:p-4 rounded-xl">
        <img
          src={currentProfile?.avatar}
          alt={currentProfile?.name}
          className="w-10 h-10 rounded-lg object-cover border border-white/20"
        />
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-sm font-bold text-white">
              {currentProfile?.name}
              {t('profileSpace')}
            </span>
            {currentProfile?.isKids && (
              <span className="text-[10px] bg-[#E50914] text-white px-1.5 py-0.5 rounded font-bold">
                KIDS
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            {t('account')}: {currentUser.email}
          </p>
        </div>
      </div>

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
            {t('myList')}
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
            {t('watchHistory')}
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
            {t('clearHistory')}
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
                  sourceUrl: item.sourceUrl,
                  vod_id: item.vod_id,
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
              <p className="text-lg font-semibold mb-1">{t('emptyListTitle')}</p>
              <p className="text-sm text-gray-500">{t('emptyListDesc')}</p>
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
                      {/* Thumbnail with progress bar */}
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
                          {item.episodeName} • {t('watchedTo')} {percent}%
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
                      {t('continueWatching')}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-24 text-gray-400">
              <History className="w-16 h-16 mx-auto mb-4 text-gray-600" />
              <p className="text-lg font-semibold mb-1">{t('emptyHistoryTitle')}</p>
              <p className="text-sm text-gray-500">{t('emptyHistoryDesc')}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};
