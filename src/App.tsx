import React, { useState, useEffect } from 'react';
import { NavTab, MediaItem, Episode, User, UserProfile } from './types';
import { Navbar } from './components/Navbar';
import { HeroBanner } from './components/HeroBanner';
import { MovieRow } from './components/MovieRow';
import { DetailModal } from './components/DetailModal';
import { PlayerModal } from './components/PlayerModal';
import { SearchPage } from './components/SearchPage';
import { MyListPage } from './components/MyListPage';
import { AuthModal } from './components/AuthModal';
import { ProfileModal } from './components/ProfileModal';
import { useI18n, LanguageSelector } from './i18n';
import {
  fetchDoubanCatalog,
  fetchBangumiCalendar,
  getWatchlist,
  toggleWatchlist,
  searchVideos,
  fetchVideoDetail,
} from './services/api';
import {
  getCurrentUser,
  getCurrentProfile,
  logout,
  switchProfile,
} from './services/auth';

export const App: React.FC = () => {
  const { t } = useI18n();
  const [currentTab, setCurrentTab] = useState<NavTab>('home');
  const [searchQuery, setSearchQuery] = useState('');

  // User & Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(() => getCurrentUser());
  const [currentProfile, setCurrentProfile] = useState<UserProfile | null>(() => getCurrentProfile());
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  // Row Data State
  const [heroMovie, setHeroMovie] = useState<MediaItem | null>(null);
  const [hotMovies, setHotMovies] = useState<MediaItem[]>([]);
  const [hotTv, setHotTv] = useState<MediaItem[]>([]);
  const [top10, setTop10] = useState<MediaItem[]>([]);
  const [animeRows, setAnimeRows] = useState<{ day: string; items: MediaItem[] }[]>([]);
  const [varietyShows, setVarietyShows] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);

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
        const [moviesRes, tvRes, bangumiRes] = await Promise.all([
          fetchDoubanCatalog('movie', '热门', 24),
          fetchDoubanCatalog('tv', '热门', 24),
          fetchBangumiCalendar(),
        ]);

        if (moviesRes.length > 0) {
          setHeroMovie(moviesRes[0]);
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
      } catch (err) {
        console.error('Failed to load initial catalog:', err);
      } finally {
        setLoading(false);
      }
    };

    loadContent();
  }, []);

  // Handler for direct play click
  const handleDirectPlay = async (movie: MediaItem) => {
    if (movie.sourceUrl && movie.vod_id) {
      const detail = await fetchVideoDetail(movie.sourceUrl, movie.vod_id);
      if (detail && detail.groups.length > 0 && detail.groups[0].episodes.length > 0) {
        setPlayerMovie(movie);
        setPlayerEpisode(detail.groups[0].episodes[0]);
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
          setPlayerEpisode(detail.groups[0].episodes[0]);
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
        onLogout={handleLogout}
        onSwitchProfile={handleSwitchProfile}
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
          /* Dedicated Anime Portal */
          <div className="pt-20 sm:pt-24 pb-20">
            <div className="px-4 sm:px-6 lg:px-8 mb-6 max-w-7xl mx-auto">
              <h1 className="text-2xl sm:text-4xl font-black mb-2 flex items-center">
                {t('animePortalTitle')}
                <span className="ml-3 text-xs bg-[#E50914] text-white px-2 py-0.5 rounded font-mono">
                  4K Ultra HD
                </span>
              </h1>
              <p className="text-sm text-gray-400">
                {t('animePortalSub')}
              </p>
            </div>
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
        ) : currentTab === 'movies' ? (
          /* Movies Tab */
          <div className="pt-20 sm:pt-24 pb-20">
            <div className="px-4 sm:px-6 lg:px-8 mb-4 max-w-7xl mx-auto">
              <h1 className="text-2xl sm:text-4xl font-black mb-2">{t('moviesPageTitle')}</h1>
              <p className="text-sm text-gray-400">{t('moviesPageSub')}</p>
            </div>
            <MovieRow
              title={t('trendingMovies')}
              movies={hotMovies}
              onPlay={handleDirectPlay}
              onOpenDetail={handleOpenDetail}
              watchlistIds={watchlistIds}
              onToggleFavorite={handleToggleFavorite}
            />
            <MovieRow
              title={t('top10Today')}
              movies={top10}
              isTop10
              onPlay={handleDirectPlay}
              onOpenDetail={handleOpenDetail}
              watchlistIds={watchlistIds}
              onToggleFavorite={handleToggleFavorite}
            />
          </div>
        ) : currentTab === 'tv' ? (
          /* TV Shows Tab */
          <div className="pt-20 sm:pt-24 pb-20">
            <div className="px-4 sm:px-6 lg:px-8 mb-4 max-w-7xl mx-auto">
              <h1 className="text-2xl sm:text-4xl font-black mb-2">{t('tvPageTitle')}</h1>
              <p className="text-sm text-gray-400">{t('tvPageSub')}</p>
            </div>
            <MovieRow
              title={t('popularTV')}
              movies={hotTv}
              onPlay={handleDirectPlay}
              onOpenDetail={handleOpenDetail}
              watchlistIds={watchlistIds}
              onToggleFavorite={handleToggleFavorite}
            />
          </div>
        ) : currentTab === 'variety' ? (
          /* Variety Shows Tab */
          <div className="pt-20 sm:pt-24 pb-20">
            <div className="px-4 sm:px-6 lg:px-8 mb-4 max-w-7xl mx-auto">
              <h1 className="text-2xl sm:text-4xl font-black mb-2">{t('varietyPageTitle')}</h1>
              <p className="text-sm text-gray-400">{t('varietyPageSub')}</p>
            </div>
            <MovieRow
              title={t('varietyShows')}
              movies={varietyShows}
              onPlay={handleDirectPlay}
              onOpenDetail={handleOpenDetail}
              watchlistIds={watchlistIds}
              onToggleFavorite={handleToggleFavorite}
            />
          </div>
        ) : (
          /* Home Netflix Stream */
          <>
            {/* Billboard Hero Banner */}
            <HeroBanner
              movie={heroMovie}
              onPlay={handleDirectPlay}
              onOpenDetail={handleOpenDetail}
              isFavorite={heroMovie ? watchlistIds.has(heroMovie.id) : false}
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
              />

              <MovieRow
                title={t('trendingMovies')}
                movies={hotMovies}
                onPlay={handleDirectPlay}
                onOpenDetail={handleOpenDetail}
                watchlistIds={watchlistIds}
                onToggleFavorite={handleToggleFavorite}
              />

              <MovieRow
                title={t('popularTV')}
                movies={hotTv}
                onPlay={handleDirectPlay}
                onOpenDetail={handleOpenDetail}
                watchlistIds={watchlistIds}
                onToggleFavorite={handleToggleFavorite}
              />

              {animeRows.length > 0 && (
                <MovieRow
                  title={t('animeWeekly')}
                  movies={animeRows[0]?.items || []}
                  onPlay={handleDirectPlay}
                  onOpenDetail={handleOpenDetail}
                  watchlistIds={watchlistIds}
                  onToggleFavorite={handleToggleFavorite}
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
                />
              )}
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
        onClose={() => setIsPlayerOpen(false)}
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
