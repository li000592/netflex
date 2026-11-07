import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { NavTab, MediaItem, Episode, User, UserProfile } from './types';
import { Navbar } from './components/Navbar';
import { HeroBanner } from './components/HeroBanner';
import { MovieRow } from './components/MovieRow';
import { DetailModal } from './components/DetailModal';
import { PlayerModal } from './components/PlayerModal';
import { SearchPage } from './components/SearchPage';
import { MyListPage } from './components/MyListPage';
import { HuakaiPage } from './components/HuakaiPage';
import { InfiniteCatalogView } from './components/InfiniteCatalogView';
import { AuthModal } from './components/AuthModal';
import { ProfileModal } from './components/ProfileModal';
import { SettingsModal } from './components/SettingsModal';
import { useI18n, LanguageSelector } from './i18n';
import {
  fetchDoubanCatalog,
  fetchBangumiCalendar,
  fetchHuakaiCatalog,
  getWatchlist,
  getWatchHistory,
  toggleWatchlist,
  searchVideos,
  fetchVideoDetail,
  syncCloudData,
} from './services/api';
import {
  getCurrentUser,
  getCurrentProfile,
  logout,
  switchProfile,
} from './services/auth';

const MOVIE_TAGS = [
  { id: '热门', label: '全部热门' },
  { id: '最新', label: '最新公映' },
  { id: '经典', label: '豆瓣高分' },
  { id: '华语', label: '华语经典' },
  { id: '欧美', label: '欧美大片' },
  { id: '动作', label: '动作热血' },
  { id: '喜剧', label: '爆笑喜剧' },
  { id: '科幻', label: '科幻视效' },
  { id: '悬疑', label: '悬疑烧脑' },
  { id: '恐怖', label: '惊悚怪兽' },
  { id: '动画', label: '院线动画' },
];

const TV_TAGS = [
  { id: '热门', label: '全部热播' },
  { id: '国产剧', label: '华语大剧' },
  { id: '美剧', label: '欧美剧集' },
  { id: '韩剧', label: '高分韩剧' },
  { id: '日剧', label: '日剧精选' },
  { id: '悬疑', label: '悬疑破案' },
  { id: '动作', label: '动作冒险' },
  { id: '科幻', label: '科幻脑洞' },
  { id: '喜剧', label: '轻松搞笑' },
];

const VARIETY_TAGS = [
  { id: '综艺', label: '全部综艺' },
  { id: '热门', label: '人气榜单' },
  { id: '国内综艺', label: '王牌真人秀' },
  { id: '国外综艺', label: '海外娱乐' },
  { id: '脱口秀', label: '脱口秀/喜剧' },
];

const ANIME_TAGS = [
  { id: '日本动画', label: '全部动画' },
  { id: '热门', label: '当季热度' },
  { id: '剧场版', label: '剧场版/电影' },
  { id: '经典', label: '童年神作' },
  { id: '奇幻', label: '异世界/奇幻' },
  { id: '动作', label: '热血战斗' },
  { id: '搞笑', label: '日常萌系' },
];

interface ExtraRowDef {
  id: string;
  title: string;
  type: 'movie' | 'tv';
  tag: string;
  tab: NavTab;
}

const HOME_EXTRA_ROW_DEFS: ExtraRowDef[] = [
  { id: 'scifi', title: '🚀 硬核科幻与时空奇幻', type: 'movie', tag: '科幻', tab: 'movies' },
  { id: 'action', title: '🔥 动作极限视觉大片', type: 'movie', tag: '动作', tab: 'movies' },
  { id: 'ustv', title: '🗽 欧美高分王牌美剧', type: 'tv', tag: '美剧', tab: 'tv' },
  { id: 'koreatv', title: '🍿 人气韩剧心动剧场', type: 'tv', tag: '韩剧', tab: 'tv' },
  { id: 'comedy', title: '🎭 爆笑高分解压喜剧', type: 'movie', tag: '喜剧', tab: 'movies' },
  { id: 'suspense', title: '🔎 烧脑悬疑惊天反转', type: 'movie', tag: '悬疑', tab: 'movies' },
  { id: 'romance', title: '💖 浪漫爱情心动影院', type: 'movie', tag: '爱情', tab: 'movies' },
  { id: 'animation', title: '🎨 院线爆款巅峰动画', type: 'movie', tag: '动画', tab: 'movies' },
];

export const App: React.FC = () => {
  const { t } = useI18n();
  const [currentTab, setCurrentTab] = useState<NavTab>('home');
  const [searchQuery, setSearchQuery] = useState('');

  // User & Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(() => getCurrentUser());
  const [currentProfile, setCurrentProfile] = useState<UserProfile | null>(() => getCurrentProfile());
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  // Huakai Mode (Default: false / OFF)
  const [huakaiEnabled, setHuakaiEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('netflex_huakai_enabled') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleHuakai = (enabled: boolean) => {
    setHuakaiEnabled(enabled);
    try {
      localStorage.setItem('netflex_huakai_enabled', enabled ? 'true' : 'false');
    } catch {}
    if (!enabled && currentTab === 'huakai') {
      setCurrentTab('home');
    }
  };

  // Row Data State
  const [heroMovies, setHeroMovies] = useState<MediaItem[]>([]);
  const [heroMovie, setHeroMovie] = useState<MediaItem | null>(null);
  const [hotMovies, setHotMovies] = useState<MediaItem[]>([]);
  const [hotTv, setHotTv] = useState<MediaItem[]>([]);
  const [top10, setTop10] = useState<MediaItem[]>([]);
  const [animeRows, setAnimeRows] = useState<{ day: string; items: MediaItem[] }[]>([]);
  const [varietyShows, setVarietyShows] = useState<MediaItem[]>([]);
  const [huakaiMovies, setHuakaiMovies] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Home Page Infinite Rows State
  const [homeExtraRows, setHomeExtraRows] = useState<{ id: string; title: string; movies: MediaItem[]; tab: NavTab }[]>([]);
  const [loadingHomeRow, setLoadingHomeRow] = useState(false);
  const homeSentinelRef = useRef<HTMLDivElement | null>(null);

  // Watchlist State
  const [watchlistIds, setWatchlistIds] = useState<Set<string>>(new Set());

  // Modal State
  const [detailMovie, setDetailMovie] = useState<MediaItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const [playerMovie, setPlayerMovie] = useState<MediaItem | null>(null);
  const [playerEpisode, setPlayerEpisode] = useState<Episode | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);

  // Reload Watchlist IDs whenever active user or profile changes
  const reloadWatchlist = () => {
    const list = getWatchlist();
    setWatchlistIds(new Set(list.map((w) => w.id)));
  };

  useEffect(() => {
    reloadWatchlist();
    if (currentUser) {
      syncCloudData().then(() => reloadWatchlist());
    }
  }, [currentUser, currentProfile]);

  const handleToggleFavorite = (movie: MediaItem) => {
    if (!currentUser) {
      setAuthModalOpen(true);
      return;
    }
    toggleWatchlist({
      id: movie.id,
      title: movie.title,
      cover: movie.cover,
      rate: movie.rate,
      remarks: movie.remarks,
      addedAt: Date.now(),
      sourceUrl: movie.sourceUrl,
      vod_id: movie.vod_id,
    });
    reloadWatchlist();
  };

  const handleAuthSuccess = (user: User) => {
    setCurrentUser(user);
    setCurrentProfile(getCurrentProfile(user));
    reloadWatchlist();
  };

  const handleLogout = () => {
    logout();
    setCurrentUser(null);
    setCurrentProfile(null);
    if (currentTab === 'mylist') {
      setCurrentTab('home');
    }
    reloadWatchlist();
  };

  const handleSwitchProfile = (profileId: string) => {
    const updated = switchProfile(profileId);
    if (updated) {
      setCurrentUser({ ...updated });
      setCurrentProfile(getCurrentProfile(updated));
      reloadWatchlist();
    }
  };

  // Initial Content Fetching
  useEffect(() => {
    const loadContent = async () => {
      setLoading(true);
      try {
        const [moviesRes, tvRes, bangumiRes, huakaiRes] = await Promise.all([
          fetchDoubanCatalog('movie', '热门', 24),
          fetchDoubanCatalog('tv', '热门', 24),
          fetchBangumiCalendar(),
          fetchHuakaiCatalog(1).catch(() => ({ page: 1, pagecount: 1, total: 0, items: [] })),
        ]);

        if (moviesRes.length > 0) {
          setHeroMovie(moviesRes[0]);
          setHeroMovies(moviesRes.slice(0, 6));
          setHotMovies(moviesRes.slice(1, 16));
          setTop10(moviesRes.slice(0, 10));
        }

        if (tvRes.length > 0) {
          setHotTv(tvRes);
        }

        if (bangumiRes.length > 0) {
          setAnimeRows(bangumiRes);
        }

        // Fetch high-rated variety
        const varietyRes = await fetchDoubanCatalog('tv', '综艺', 16);
        setVarietyShows(varietyRes);

        if (huakaiRes && huakaiRes.items.length > 0) {
          setHuakaiMovies(huakaiRes.items.slice(0, 18));
        }
      } catch (err) {
        console.error('Failed to load initial catalog:', err);
      } finally {
        setLoading(false);
      }
    };

    loadContent();
  }, []);

  // Home Page Lazy Infinite Row Loader
  const loadMoreHomeRow = useCallback(async () => {
    if (loadingHomeRow || currentTab !== 'home' || searchQuery.trim()) return;
    const nextIdx = homeExtraRows.length;
    if (nextIdx >= HOME_EXTRA_ROW_DEFS.length) return;
    setLoadingHomeRow(true);
    const def = HOME_EXTRA_ROW_DEFS[nextIdx];
    try {
      const res = await fetchDoubanCatalog(def.type, def.tag, 16);
      if (res.length > 0) {
        setHomeExtraRows((prev) => [...prev, { id: def.id, title: def.title, movies: res, tab: def.tab }]);
      }
    } catch (e) {
      console.error('Failed to load extra home row:', e);
    } finally {
      setLoadingHomeRow(false);
    }
  }, [loadingHomeRow, currentTab, searchQuery, homeExtraRows.length]);

  useEffect(() => {
    const sentinel = homeSentinelRef.current;
    if (!sentinel || currentTab !== 'home') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMoreHomeRow();
        }
      },
      { rootMargin: '600px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMoreHomeRow, currentTab]);

  // Handler for direct play click
  const handleDirectPlay = async (movie: MediaItem) => {
    // Check if user previously watched an episode of this title
    const historyList = getWatchHistory();
    const movieTitle = movie.title?.trim().toLowerCase();
    const existing = historyList.find(
      (h) => h.id === movie.id || (movieTitle && h.title?.trim().toLowerCase() === movieTitle)
    );

    if (movie.sourceUrl && movie.vod_id) {
      const detail = await fetchVideoDetail(movie.sourceUrl, movie.vod_id);
      if (detail && detail.groups.length > 0 && detail.groups[0].episodes.length > 0) {
        setPlayerMovie(movie);
        let targetEp = detail.groups[0].episodes[0];
        if (existing) {
          for (const grp of detail.groups) {
            const found = grp.episodes.find(
              (ep) => ep.url === existing.episodeUrl || ep.name === existing.episodeName
            );
            if (found) {
              targetEp = found;
              break;
            }
          }
        }
        setPlayerEpisode(targetEp);
        setIsPlayerOpen(true);
        return;
      }
    }

    const results = await searchVideos(movie.title);
    if (results.length > 0) {
      const best = results[0];
      if (best.sourceUrl && best.vod_id) {
        const detail = await fetchVideoDetail(best.sourceUrl, best.vod_id);
        if (detail && detail.groups.length > 0 && detail.groups[0].episodes.length > 0) {
          setPlayerMovie(best);
          let targetEp = detail.groups[0].episodes[0];
          if (existing) {
            for (const grp of detail.groups) {
              const found = grp.episodes.find(
                (ep) => ep.url === existing.episodeUrl || ep.name === existing.episodeName
              );
              if (found) {
                targetEp = found;
                break;
              }
            }
          }
          setPlayerEpisode(targetEp);
          setIsPlayerOpen(true);
          return;
        }
      }
    }

    setDetailMovie(movie);
    setIsDetailOpen(true);
  };

  const handleOpenDetail = (movie: MediaItem) => {
    setDetailMovie(movie);
    setIsDetailOpen(true);
  };

  const handlePlayEpisode = (
    movie: MediaItem,
    episode: Episode,
    _groupIndex: number,
    _episodeIndex: number
  ) => {
    setIsDetailOpen(false);
    setPlayerMovie(movie);
    setPlayerEpisode(episode);
    setIsPlayerOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#141414] text-white flex flex-col">
      {/* Sticky Header */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setCurrentTab(tab);
          setSearchQuery('');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onSearch={(query) => {
          setSearchQuery(query);
        }}
        searchQuery={searchQuery}
        currentUser={currentUser}
        currentProfile={currentProfile}
        onOpenAuth={() => setAuthModalOpen(true)}
        onOpenProfileModal={() => setProfileModalOpen(true)}
        onOpenSettings={() => setSettingsModalOpen(true)}
        onLogout={handleLogout}
        onSwitchProfile={handleSwitchProfile}
        huakaiEnabled={huakaiEnabled}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {searchQuery.trim() ? (
          /* Search Results View */
          <SearchPage
            initialQuery={searchQuery}
            onPlay={handleDirectPlay}
            onOpenDetail={handleOpenDetail}
            watchlistIds={watchlistIds}
            onToggleFavorite={handleToggleFavorite}
            huakaiEnabled={huakaiEnabled}
          />
        ) : currentTab === 'mylist' ? (
          /* My List & History View */
          <MyListPage
            currentUser={currentUser}
            currentProfile={currentProfile}
            onOpenAuth={() => setAuthModalOpen(true)}
            onPlay={handleDirectPlay}
            onOpenDetail={handleOpenDetail}
            watchlistIds={watchlistIds}
            onToggleFavorite={handleToggleFavorite}
            onPlayEpisode={handlePlayEpisode}
          />
        ) : currentTab === 'anime' ? (
          /* Dedicated Anime Portal with Infinite Scroll Catalog */
          <InfiniteCatalogView
            type="tv"
            initialTag="日本动画"
            tags={ANIME_TAGS}
            title={t('animePortalTitle')}
            subtitle={t('animePortalSub')}
            headerSlot={
              animeRows.length > 0 ? (
                <div className="mb-10">
                  <h2 className="text-xl sm:text-2xl font-bold mb-4 flex items-center">
                    🌸 每日新番周历连载
                    <span className="ml-3 text-xs bg-[#E50914] text-white px-2 py-0.5 rounded font-mono">
                      周一至周日同步连载
                    </span>
                  </h2>
                  {animeRows.map((row) => (
                    <MovieRow
                      key={row.day}
                      title={`${row.day} ${t('updatedDay')}`}
                      movies={row.items}
                      onPlay={handleDirectPlay}
                      onOpenDetail={handleOpenDetail}
                      watchlistIds={watchlistIds}
                      onToggleFavorite={handleToggleFavorite}
                    />
                  ))}
                </div>
              ) : undefined
            }
            onPlay={handleDirectPlay}
            onOpenDetail={handleOpenDetail}
            watchlistIds={watchlistIds}
            onToggleFavorite={handleToggleFavorite}
          />
        ) : currentTab === 'movies' ? (
          /* Movies Tab with Infinite Scroll Catalog */
          <InfiniteCatalogView
            type="movie"
            initialTag="热门"
            tags={MOVIE_TAGS}
            title={t('moviesPageTitle')}
            subtitle={t('moviesPageSub')}
            onPlay={handleDirectPlay}
            onOpenDetail={handleOpenDetail}
            watchlistIds={watchlistIds}
            onToggleFavorite={handleToggleFavorite}
          />
        ) : currentTab === 'tv' ? (
          /* TV Shows Tab with Infinite Scroll Catalog */
          <InfiniteCatalogView
            type="tv"
            initialTag="热门"
            tags={TV_TAGS}
            title={t('tvPageTitle')}
            subtitle={t('tvPageSub')}
            onPlay={handleDirectPlay}
            onOpenDetail={handleOpenDetail}
            watchlistIds={watchlistIds}
            onToggleFavorite={handleToggleFavorite}
          />
        ) : currentTab === 'huakai' && huakaiEnabled ? (
          /* Dedicated Huakai Special Zone (Infinite Scrolling) */
          <HuakaiPage
            onPlay={handleDirectPlay}
            onOpenDetail={handleOpenDetail}
            watchlistIds={watchlistIds}
            onToggleFavorite={handleToggleFavorite}
          />
        ) : currentTab === 'variety' ? (
          /* Variety Shows Tab with Infinite Scroll Catalog */
          <InfiniteCatalogView
            type="tv"
            initialTag="综艺"
            tags={VARIETY_TAGS}
            title={t('varietyPageTitle')}
            subtitle={t('varietyPageSub')}
            onPlay={handleDirectPlay}
            onOpenDetail={handleOpenDetail}
            watchlistIds={watchlistIds}
            onToggleFavorite={handleToggleFavorite}
          />
        ) : (
          /* Home Netflix Stream */
          <>
            {/* Billboard Hero Banner */}
            <HeroBanner
              movies={heroMovies}
              movie={heroMovie}
              onPlay={handleDirectPlay}
              onOpenDetail={handleOpenDetail}
              watchlistIds={watchlistIds}
              onToggleFavorite={handleToggleFavorite}
            />

            {/* Netflix Rows */}
            <div className="relative -mt-16 sm:-mt-24 z-20 space-y-2 sm:space-y-4 pb-20">
              <MovieRow
                title={t('top10Today')}
                movies={top10}
                isTop10
                onPlay={handleDirectPlay}
                onOpenDetail={handleOpenDetail}
                watchlistIds={watchlistIds}
                onToggleFavorite={handleToggleFavorite}
                onExplore={() => {
                  setCurrentTab('movies');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              />

              <MovieRow
                title={t('trendingMovies')}
                movies={hotMovies}
                onPlay={handleDirectPlay}
                onOpenDetail={handleOpenDetail}
                watchlistIds={watchlistIds}
                onToggleFavorite={handleToggleFavorite}
                onExplore={() => {
                  setCurrentTab('movies');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              />

              <MovieRow
                title={t('popularTV')}
                movies={hotTv}
                onPlay={handleDirectPlay}
                onOpenDetail={handleOpenDetail}
                watchlistIds={watchlistIds}
                onToggleFavorite={handleToggleFavorite}
                onExplore={() => {
                  setCurrentTab('tv');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              />

              {animeRows.length > 0 && (
                <MovieRow
                  title={t('animeWeekly')}
                  movies={animeRows[0]?.items || []}
                  onPlay={handleDirectPlay}
                  onOpenDetail={handleOpenDetail}
                  watchlistIds={watchlistIds}
                  onToggleFavorite={handleToggleFavorite}
                  onExplore={() => {
                    setCurrentTab('anime');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                />
              )}

              {varietyShows.length > 0 && (
                <MovieRow
                  title={t('varietyShows')}
                  movies={varietyShows}
                  onPlay={handleDirectPlay}
                  onOpenDetail={handleOpenDetail}
                  watchlistIds={watchlistIds}
                  onToggleFavorite={handleToggleFavorite}
                  onExplore={() => {
                    setCurrentTab('variety');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                />
              )}

              {huakaiEnabled && huakaiMovies.length > 0 && (
                <MovieRow
                  title={t('huakaiPortalTitle')}
                  movies={huakaiMovies}
                  onPlay={handleDirectPlay}
                  onOpenDetail={handleOpenDetail}
                  watchlistIds={watchlistIds}
                  onToggleFavorite={handleToggleFavorite}
                  onExplore={() => {
                    setCurrentTab('huakai');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                />
              )}

              {/* Lazy-Loaded Infinite Recommended Rows on Home */}
              {homeExtraRows.map((extra) => (
                <MovieRow
                  key={extra.id}
                  title={extra.title}
                  movies={extra.movies}
                  onPlay={handleDirectPlay}
                  onOpenDetail={handleOpenDetail}
                  watchlistIds={watchlistIds}
                  onToggleFavorite={handleToggleFavorite}
                  onExplore={() => {
                    setCurrentTab(extra.tab);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                />
              ))}

              {/* Home Page Infinite Scroll Sentinel */}
              <div ref={homeSentinelRef} className="py-8 flex justify-center items-center text-gray-500 text-xs">
                {loadingHomeRow ? (
                  <div className="flex items-center space-x-2 text-gray-400">
                    <Loader2 className="w-5 h-5 animate-spin text-[#E50914]" />
                    <span>正在为您发现更多精彩专区...</span>
                  </div>
                ) : homeExtraRows.length < HOME_EXTRA_ROW_DEFS.length ? (
                  <span className="opacity-40">继续向下滑动探索更多影片专区</span>
                ) : (
                  <span className="opacity-40">已经为您呈现全部热榜专区</span>
                )}
              </div>
            </div>
          </>
        )}
      </main>

      {/* Detail Dialog Modal */}
      <DetailModal
        movie={detailMovie}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        onPlayEpisode={handlePlayEpisode}
        isFavorite={detailMovie ? watchlistIds.has(detailMovie.id) : false}
        onToggleFavorite={handleToggleFavorite}
      />

      {/* Cinema Player Modal */}
      <PlayerModal
        movie={playerMovie}
        episode={playerEpisode}
        isOpen={isPlayerOpen}
        onClose={() => {
          setIsPlayerOpen(false);
          reloadWatchlist();
        }}
      />

      {/* Netflix Auth Modal (Sign In / Sign Up) */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
      />

      {/* Netflix Profile Switcher Modal ("Who's watching?") */}
      <ProfileModal
        user={currentUser}
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        onSelectProfile={(p) => handleSwitchProfile(p.id)}
      />

      {/* Settings Modal (Huakai Mode, Preferences) */}
      <SettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        huakaiEnabled={huakaiEnabled}
        onToggleHuakai={handleToggleHuakai}
      />

      {/* Netflix Footer with Language Selector */}
      <footer className="border-t border-white/10 py-12 px-4 sm:px-6 lg:px-8 bg-black/60 text-gray-500 text-xs">
        <div className="max-w-7xl mx-auto flex flex-col space-y-6">
          <div className="flex items-center space-x-2">
            <span className="text-[#E50914] font-black text-lg">NETFLEX</span>
          </div>
          <div>
            <LanguageSelector />
          </div>
          <p>{t('copyright')}</p>
        </div>
      </footer>
    </div>
  );
};
