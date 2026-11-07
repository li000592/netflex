import React, { useState, useEffect } from 'react';
import { NavTab, MediaItem, Episode } from './types';
import { Navbar } from './components/Navbar';
import { HeroBanner } from './components/HeroBanner';
import { MovieRow } from './components/MovieRow';
import { DetailModal } from './components/DetailModal';
import { PlayerModal } from './components/PlayerModal';
import { SearchPage } from './components/SearchPage';
import { MyListPage } from './components/MyListPage';
import {
  fetchDoubanCatalog,
  fetchBangumiCalendar,
  getWatchlist,
  toggleWatchlist,
  searchVideos,
  fetchVideoDetail,
} from './services/api';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<NavTab>('home');
  const [searchQuery, setSearchQuery] = useState('');

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

  // Load Watchlist IDs on start
  useEffect(() => {
    const list = getWatchlist();
    setWatchlistIds(new Set(list.map((w) => w.id)));
  }, []);

  const handleToggleFavorite = (movie: MediaItem) => {
    toggleWatchlist({
      id: movie.id,
      title: movie.title,
      cover: movie.cover,
      rate: movie.rate,
      remarks: movie.remarks,
      addedAt: Date.now(),
    });
    const updated = getWatchlist();
    setWatchlistIds(new Set(updated.map((w) => w.id)));
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
    // 1. If video already has sourceUrl and vod_id
    if (movie.sourceUrl && movie.vod_id) {
      const detail = await fetchVideoDetail(movie.sourceUrl, movie.vod_id);
      if (detail && detail.groups.length > 0 && detail.groups[0].episodes.length > 0) {
        setPlayerMovie(movie);
        setPlayerEpisode(detail.groups[0].episodes[0]);
        setIsPlayerOpen(true);
        return;
      }
    }

    // 2. Otherwise auto-search 31 sources
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

    // Fallback: open detail modal so user can pick source
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
          if (query && currentTab !== 'home') {
            // Keep on search page
          }
        }}
        searchQuery={searchQuery}
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
                🌸 日本新番周历
                <span className="ml-3 text-xs bg-[#E50914] text-white px-2 py-0.5 rounded font-mono">
                  每日同步更新
                </span>
              </h1>
              <p className="text-sm text-gray-400">
                涵盖魔都动漫、樱花动漫、155动漫等专线，极速秒播超清无删减。
              </p>
            </div>
            {animeRows.map((row) => (
              <MovieRow
                key={row.day}
                title={`${row.day} 更新`}
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
              <h1 className="text-2xl sm:text-4xl font-black mb-2">🎬 电影殿堂</h1>
              <p className="text-sm text-gray-400">院线大片、奈飞独播、经典影史精选</p>
            </div>
            <MovieRow
              title="热门公映大片"
              movies={hotMovies}
              onPlay={handleDirectPlay}
              onOpenDetail={handleOpenDetail}
              watchlistIds={watchlistIds}
              onToggleFavorite={handleToggleFavorite}
            />
            <MovieRow
              title="今日电影 Top 10"
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
              <h1 className="text-2xl sm:text-4xl font-black mb-2">📺 连载热播剧集</h1>
              <p className="text-sm text-gray-400">美剧、韩剧、华语高分大剧一网打尽</p>
            </div>
            <MovieRow
              title="热播剧集排行榜"
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
              <h1 className="text-2xl sm:text-4xl font-black mb-2">✨ 热门爆笑综艺</h1>
              <p className="text-sm text-gray-400">中外王牌真人秀、脱口秀持续跟播</p>
            </div>
            <MovieRow
              title="王牌热播综艺"
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
                title="今日热播 Top 10"
                movies={top10}
                isTop10
                onPlay={handleDirectPlay}
                onOpenDetail={handleOpenDetail}
                watchlistIds={watchlistIds}
                onToggleFavorite={handleToggleFavorite}
              />

              <MovieRow
                title="公映热门电影"
                movies={hotMovies}
                onPlay={handleDirectPlay}
                onOpenDetail={handleOpenDetail}
                watchlistIds={watchlistIds}
                onToggleFavorite={handleToggleFavorite}
              />

              <MovieRow
                title="人气热播剧集"
                movies={hotTv}
                onPlay={handleDirectPlay}
                onOpenDetail={handleOpenDetail}
                watchlistIds={watchlistIds}
                onToggleFavorite={handleToggleFavorite}
              />

              {animeRows.length > 0 && (
                <MovieRow
                  title="🌸 日本新番热播推荐"
                  movies={animeRows[0]?.items || []}
                  onPlay={handleDirectPlay}
                  onOpenDetail={handleOpenDetail}
                  watchlistIds={watchlistIds}
                  onToggleFavorite={handleToggleFavorite}
                />
              )}

              {varietyShows.length > 0 && (
                <MovieRow
                  title="爆笑高分综艺"
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

      {/* Netflix Footer */}
      <footer className="border-t border-white/10 py-10 px-4 sm:px-6 lg:px-8 bg-black/60 text-gray-500 text-xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <span className="text-[#E50914] font-black text-lg">NETFLEX</span>
            <span>• 31路极速高清流媒体聚合系统</span>
          </div>
          <p>© 2024 NETFLEX. Powered by 31 High-Speed Stream Endpoints, Bangumi & Douban API.</p>
        </div>
      </footer>
    </div>
  );
};
