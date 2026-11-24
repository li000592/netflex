import React, { useState, useEffect } from 'react';
import { Bookmark, History, Trash2, Play, Lock, User as UserIcon, Calendar, Sparkles, Film } from 'lucide-react';
import { MediaItem, WatchHistoryItem, WatchlistItem, Episode, User, UserProfile } from '../types';
import { getWatchHistory, getWatchlist, clearWatchHistory, getAnimeSchedule } from '../services/api';
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
  const [watchlistSubTab, setWatchlistSubTab] = useState<'all' | 'anime'>('all');
  const [animeViewMode, setAnimeViewMode] = useState<'cards' | 'weekly'>('cards');
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [history, setHistory] = useState<WatchHistoryItem[]>([]);

  const reloadData = () => {
    setWatchlist(getWatchlist());
    setHistory(getWatchHistory());
  };

  useEffect(() => {
    reloadData();
  }, [watchlistIds, currentUser, currentProfile, activeTab]);

  const todayChineseDay = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][new Date().getDay()];

  // Followed anime items
  const followedAnime = watchlist.filter((item) => {
    return (
      item.isAnime ||
      item.category === '动漫' ||
      item.sourceCategory === 'anime' ||
      item.id.startsWith('bangumi_') ||
      Boolean(item.airDay) ||
      Boolean(getAnimeSchedule(item.title, item.airDay, item.airWeekday, item.remarks)?.airDay)
    );
  });

  // Anime airing today
  const todayAiringAnime = followedAnime.filter((item) => {
    const sched = getAnimeSchedule(item.title, item.airDay, item.airWeekday, item.remarks);
    return sched?.isToday;
  });

  const displayedWatchlist = watchlistSubTab === 'anime' ? followedAnime : watchlist;

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
          {/* Today Airing Anime Alert Banner */}
          {todayAiringAnime.length > 0 && (
            <div className="mb-6 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-pink-950/70 via-red-950/50 to-zinc-900 border border-pink-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
              <div className="flex items-center space-x-3.5">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-pink-600/30 border border-pink-500/50 flex items-center justify-center flex-shrink-0 animate-bounce">
                  <Sparkles className="w-5 h-5 text-pink-400" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-white font-bold text-sm sm:text-base">
                      {t('airingTodayNotice')} · {todayChineseDay}
                    </h3>
                    <span className="bg-[#E50914] text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
                      TODAY
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-pink-200/90 mt-0.5">
                    你追的 {todayAiringAnime.map((a) => `《${a.title}》`).join('、')} {t('airingTodayDesc')}
                  </p>
                </div>
              </div>

              {watchlistSubTab !== 'anime' && (
                <button
                  onClick={() => setWatchlistSubTab('anime')}
                  className="self-start sm:self-auto text-xs bg-pink-600 hover:bg-pink-500 text-white font-bold px-4 py-2 rounded-lg transition-transform hover:scale-105 shadow flex items-center cursor-pointer"
                >
                  <span>查看追番列表</span>
                </button>
              )}
            </div>
          )}

          {/* Sub-tabs: All vs Followed Anime */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setWatchlistSubTab('all')}
                className={`text-xs px-3.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  watchlistSubTab === 'all'
                    ? 'bg-white text-black shadow'
                    : 'bg-white/10 hover:bg-white/15 text-gray-300'
                }`}
              >
                {t('allWatchlist')} ({watchlist.length})
              </button>

              <button
                onClick={() => setWatchlistSubTab('anime')}
                className={`text-xs px-3.5 py-1.5 rounded-lg font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                  watchlistSubTab === 'anime'
                    ? 'bg-pink-600 text-white shadow-md shadow-pink-900/40'
                    : 'bg-white/10 hover:bg-white/15 text-gray-300'
                }`}
              >
                <span>🌸</span>
                <span>{t('followedAnimeList')}</span>
                <span className="ml-1 bg-black/30 px-1.5 py-0.2 rounded-full text-[10px]">
                  {followedAnime.length}
                </span>
              </button>
            </div>

            {watchlistSubTab === 'anime' && followedAnime.length > 0 && (
              <div className="flex items-center space-x-1 bg-white/5 p-1 rounded-lg border border-white/10 self-start sm:self-auto">
                <button
                  onClick={() => setAnimeViewMode('cards')}
                  className={`text-xs px-3 py-1 rounded font-medium transition-all cursor-pointer ${
                    animeViewMode === 'cards' ? 'bg-pink-600 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  海报网格
                </button>
                <button
                  onClick={() => setAnimeViewMode('weekly')}
                  className={`text-xs px-3 py-1 rounded font-medium transition-all cursor-pointer ${
                    animeViewMode === 'weekly' ? 'bg-pink-600 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  📅 每周放送日程
                </button>
              </div>
            )}
          </div>

          {/* Watchlist Items Display */}
          {displayedWatchlist.length > 0 ? (
            watchlistSubTab === 'anime' && animeViewMode === 'weekly' ? (
              /* Weekly Schedule Grouping View */
              <div className="space-y-6">
                {['周一', '周二', '周三', '周四', '周五', '周六', '周日'].map((weekday) => {
                  const dayItems = followedAnime.filter((item) => {
                    const sched = getAnimeSchedule(item.title, item.airDay, item.airWeekday, item.remarks);
                    return sched?.airDay === weekday;
                  });
                  if (dayItems.length === 0) return null;
                  const isToday = todayChineseDay === weekday;

                  return (
                    <div
                      key={weekday}
                      className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                        isToday
                          ? 'bg-pink-950/20 border-pink-500/40 ring-1 ring-pink-500/20'
                          : 'bg-white/5 border-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-2.5">
                          <span className="text-base sm:text-lg font-black text-white">{weekday} 放送</span>
                          {isToday && (
                            <span className="text-[10px] bg-red-600 text-white font-bold px-2 py-0.5 rounded-full animate-pulse">
                              今日放送
                            </span>
                          )}
                          <span className="text-xs text-gray-400">
                            共 {dayItems.length} 部 · 约 23:30 极速同步
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                        {dayItems.map((item) => {
                          const sched = getAnimeSchedule(item.title, item.airDay, item.airWeekday, item.remarks);
                          const mediaItem: MediaItem = {
                            id: item.id,
                            title: item.title,
                            cover: item.cover,
                            rate: item.rate,
                            remarks: item.remarks,
                            sourceUrl: item.sourceUrl,
                            vod_id: item.vod_id,
                            category: item.category || '动漫',
                            sourceCategory: item.sourceCategory || 'anime',
                            airDay: sched?.airDay || item.airDay,
                            airWeekday: sched?.airWeekday || item.airWeekday,
                            airTime: sched?.airTime || item.airTime,
                          };

                          return (
                            <div key={item.id} className="flex flex-col">
                              <MovieCard
                                movie={mediaItem}
                                onPlay={onPlay}
                                onOpenDetail={onOpenDetail}
                                isFavorite={watchlistIds.has(item.id)}
                                onToggleFavorite={onToggleFavorite}
                              />
                              <div className="mt-1 px-1">
                                <span className={`text-[11px] font-medium block truncate ${
                                  sched?.isToday ? 'text-red-400 font-bold' : 'text-pink-300'
                                }`}>
                                  {sched?.displayText || item.remarks || '连载中'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {/* Other/Finished anime that didn't match a specific weekday */}
                {(() => {
                  const unassignedItems = followedAnime.filter((item) => {
                    const sched = getAnimeSchedule(item.title, item.airDay, item.airWeekday, item.remarks);
                    return !sched?.airDay;
                  });
                  if (unassignedItems.length === 0) return null;
                  return (
                    <div className="p-4 sm:p-5 rounded-2xl bg-white/5 border border-white/10">
                      <h4 className="text-sm font-bold text-gray-300 mb-3">其他/已完结番剧 ({unassignedItems.length})</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                        {unassignedItems.map((item) => {
                          const mediaItem: MediaItem = {
                            id: item.id,
                            title: item.title,
                            cover: item.cover,
                            rate: item.rate,
                            remarks: item.remarks,
                            sourceUrl: item.sourceUrl,
                            vod_id: item.vod_id,
                            category: item.category || '动漫',
                            sourceCategory: item.sourceCategory || 'anime',
                          };
                          return (
                            <div key={item.id} className="flex flex-col">
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
                    </div>
                  );
                })()}
              </div>
            ) : (
              /* Grid View (Cards) */
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 md:gap-5">
                {displayedWatchlist.map((item) => {
                  const sched = getAnimeSchedule(item.title, item.airDay, item.airWeekday, item.remarks);
                  const isAnime = Boolean(
                    item.isAnime ||
                    item.category === '动漫' ||
                    item.sourceCategory === 'anime' ||
                    item.id.startsWith('bangumi_') ||
                    sched?.airDay
                  );

                  const mediaItem: MediaItem = {
                    id: item.id,
                    title: item.title,
                    cover: item.cover,
                    rate: item.rate,
                    remarks: item.remarks,
                    sourceUrl: item.sourceUrl,
                    vod_id: item.vod_id,
                    category: item.category || (isAnime ? '动漫' : undefined),
                    sourceCategory: item.sourceCategory || (isAnime ? 'anime' : undefined),
                    airDay: sched?.airDay || item.airDay,
                    airWeekday: sched?.airWeekday || item.airWeekday,
                    airTime: sched?.airTime || item.airTime,
                  };

                  return (
                    <div key={item.id} className="flex flex-col">
                      <MovieCard
                        movie={mediaItem}
                        onPlay={onPlay}
                        onOpenDetail={onOpenDetail}
                        isFavorite={watchlistIds.has(item.id)}
                        onToggleFavorite={onToggleFavorite}
                      />
                      {isAnime && sched && (
                        <div className="mt-1.5 px-0.5">
                          <span
                            className={`text-[11px] font-medium block truncate ${
                              sched.isToday ? 'text-red-400 font-bold' : 'text-pink-300'
                            }`}
                          >
                            {sched.displayText}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            <div className="text-center py-24 text-gray-400">
              <Bookmark className="w-16 h-16 mx-auto mb-4 text-gray-600" />
              <p className="text-lg font-semibold mb-1">
                {watchlistSubTab === 'anime' ? t('noFollowedAnimeTitle') : t('emptyListTitle')}
              </p>
              <p className="text-sm text-gray-500 max-w-sm mx-auto">
                {watchlistSubTab === 'anime' ? t('noFollowedAnimeDesc') : t('emptyListDesc')}
              </p>
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
