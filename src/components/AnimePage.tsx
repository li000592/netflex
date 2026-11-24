import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Sparkles,
  Calendar,
  Film,
  Flame,
  Swords,
  Wand2,
  HeartHandshake,
  Cpu,
  Compass,
  Trophy,
  Layers,
  LayoutGrid,
  Rows3,
  SlidersHorizontal,
  ChevronRight,
  Clock,
  Star,
  MessageSquare,
  Play,
  Info,
} from 'lucide-react';
import { MediaItem } from '../types';
import { useI18n } from '../i18n';
import {
  fetchBangumiCalendar,
  fetchDoubanCatalog,
  sortMediaByCover,
  DoubanFilterOptions,
} from '../services/api';
import { HeroBanner } from './HeroBanner';
import { MovieRow } from './MovieRow';
import { MovieCard } from './MovieCard';
import { NetflixGridSkeleton, NetflixRowSkeleton } from './NetflixSkeleton';

interface AnimePageProps {
  onPlay: (movie: MediaItem) => void;
  onOpenDetail: (movie: MediaItem) => void;
  watchlistIds: Set<string>;
  onToggleFavorite: (movie: MediaItem) => void;
}

type AnimeCategoryMode =
  | 'all'
  | 'timeline'
  | 'seasons'
  | 'theatrical'
  | 'isekai'
  | 'shonen'
  | 'romance'
  | 'scifi'
  | 'mystery'
  | 'classics';

interface CategoryTab {
  id: AnimeCategoryMode;
  label: string;
  enLabel: string;
  icon: React.ReactNode;
  badge?: string;
}

const CATEGORY_TABS: CategoryTab[] = [
  { id: 'all', label: '🌟 精彩全景', enLabel: 'Overview', icon: <Sparkles className="w-4 h-4 mr-1.5" /> },
  { id: 'timeline', label: '📅 新番时刻表', enLabel: 'Simulcast Schedule', icon: <Calendar className="w-4 h-4 mr-1.5 text-pink-400" />, badge: '每日更新' },
  { id: 'seasons', label: '🍂 季度番剧', enLabel: 'Seasons', icon: <Layers className="w-4 h-4 mr-1.5 text-amber-400" /> },
  { id: 'theatrical', label: '🎬 剧场版 & 电影', enLabel: 'Theatrical Movies', icon: <Film className="w-4 h-4 mr-1.5 text-blue-400" /> },
  { id: 'isekai', label: '🧙 奇幻 & 异世界', enLabel: 'Isekai & Fantasy', icon: <Wand2 className="w-4 h-4 mr-1.5 text-purple-400" /> },
  { id: 'shonen', label: '⚔️ 热血 & 冒险', enLabel: 'Shonen & Action', icon: <Swords className="w-4 h-4 mr-1.5 text-red-500" /> },
  { id: 'romance', label: '☕ 治愈 & 青春恋爱', enLabel: 'Slice of Life & Romance', icon: <HeartHandshake className="w-4 h-4 mr-1.5 text-rose-400" /> },
  { id: 'scifi', label: '🔮 科幻 & 机战', enLabel: 'Sci-Fi & Mecha', icon: <Cpu className="w-4 h-4 mr-1.5 text-cyan-400" /> },
  { id: 'mystery', label: '🕵️ 悬疑 & 推理', enLabel: 'Mystery & Detective', icon: <Compass className="w-4 h-4 mr-1.5 text-emerald-400" /> },
  { id: 'classics', label: '👑 殿堂神作 9.0+', enLabel: 'Classics 9.0+', icon: <Trophy className="w-4 h-4 mr-1.5 text-yellow-400" />, badge: '9.0+' },
];

const SEASONS_LIST = [
  { id: '2026,2026', label: '2026 最新番' },
  { id: '2025,2025', label: '2025 年度热播' },
  { id: '2024,2024', label: '2024 年度精选' },
  { id: '2023,2023', label: '2023 年度回忆' },
  { id: '2020,2022', label: '2020-2022 年代' },
  { id: '2010,2019', label: '2010-2019 黄金十年' },
  { id: '2000,2009', label: '2000 年代经典' },
];

const SORT_OPTIONS = [
  { id: 'U', label: '🍿 近期热门' },
  { id: 'T', label: '⭐ 评分最高' },
  { id: 'S', label: '🕒 最新上映' },
  { id: 'R', label: '💬 评价最多' },
];

const RATING_OPTIONS = [
  { id: 'all', label: '全部评分' },
  { id: '9,10', label: '🏆 9.0+ 影史神作' },
  { id: '8,10', label: '🌟 8.0+ 高分甄选' },
  { id: '7,10', label: '👍 7.0+ 推荐好番' },
];

const WEEKDAY_KEYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

const CACHE_KEY_ROWS = 'netflex_anime_page_rows_v3';

export const AnimePage: React.FC<AnimePageProps> = ({
  onPlay,
  onOpenDetail,
  watchlistIds,
  onToggleFavorite,
}) => {
  const { t, language } = useI18n();

  // Active Category Tab
  const [activeTab, setActiveTab] = useState<AnimeCategoryMode>('all');
  const [viewLayout, setViewLayout] = useState<'rows' | 'grid'>('rows');

  // Multi-Row State for "all" mode
  const [heroAnime, setHeroAnime] = useState<MediaItem[]>([]);
  const [top10Anime, setTop10Anime] = useState<MediaItem[]>([]);
  const [latestAnime, setLatestAnime] = useState<MediaItem[]>([]);
  const [theatricalAnime, setTheatricalAnime] = useState<MediaItem[]>([]);
  const [isekaiAnime, setIsekaiAnime] = useState<MediaItem[]>([]);
  const [shonenAnime, setShonenAnime] = useState<MediaItem[]>([]);
  const [romanceAnime, setRomanceAnime] = useState<MediaItem[]>([]);
  const [scifiAnime, setScifiAnime] = useState<MediaItem[]>([]);
  const [classicsAnime, setClassicsAnime] = useState<MediaItem[]>([]);

  // Bangumi Timeline State
  const [bangumiCalendar, setBangumiCalendar] = useState<{ day: string; items: MediaItem[] }[]>([]);
  const [selectedWeekday, setSelectedWeekday] = useState<string>(() => {
    const dayIdx = new Date().getDay();
    return WEEKDAY_KEYS[dayIdx];
  });

  // Filter & Grid State (for genres / seasons / timeline grid)
  const [selectedSeason, setSelectedSeason] = useState<string>('2026,2026');
  const [sort, setSort] = useState<string>('U');
  const [ratingRange, setRatingRange] = useState<string>('all');
  const [gridItems, setGridItems] = useState<MediaItem[]>([]);
  const [loadingGrid, setLoadingGrid] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [startOffset, setStartOffset] = useState<number>(0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Overall Loading State
  const [loadingRows, setLoadingRows] = useState<boolean>(true);

  // 1. Initial Load of Multi-Row Highlights
  useEffect(() => {
    let isCancelled = false;

    // Fast-boot from sessionStorage cache
    try {
      const cached = sessionStorage.getItem(CACHE_KEY_ROWS);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed) {
          if (parsed.hero) setHeroAnime(parsed.hero);
          if (parsed.top10) setTop10Anime(parsed.top10);
          if (parsed.latest) setLatestAnime(parsed.latest);
          if (parsed.theatrical) setTheatricalAnime(parsed.theatrical);
          if (parsed.isekai) setIsekaiAnime(parsed.isekai);
          if (parsed.shonen) setShonenAnime(parsed.shonen);
          if (parsed.romance) setRomanceAnime(parsed.romance);
          if (parsed.scifi) setScifiAnime(parsed.scifi);
          if (parsed.classics) setClassicsAnime(parsed.classics);
          setLoadingRows(false);
        }
      }
    } catch {}

    // Fetch Bangumi Calendar & Douban Catalog in parallel
    const loadData = async () => {
      try {
        const [
          bgmCal,
          hotList,
          theatricalList,
          isekaiList,
          shonenList,
          romanceList,
          scifiList,
          classList,
        ] = await Promise.all([
          fetchBangumiCalendar().catch(() => []),
          fetchDoubanCatalog({ type: 'tv', tag: '日本动画', sort: 'U', limit: 20 }).catch(() => []),
          fetchDoubanCatalog({ type: 'movie', tag: '动画', genres: '动画', sort: 'U', limit: 18 }).catch(() => []),
          fetchDoubanCatalog({ type: 'tv', tag: '日本动画', genres: '奇幻', sort: 'U', limit: 18 }).catch(() => []),
          fetchDoubanCatalog({ type: 'tv', tag: '日本动画', genres: '动作', sort: 'U', limit: 18 }).catch(() => []),
          fetchDoubanCatalog({ type: 'tv', tag: '日本动画', genres: '爱情', sort: 'U', limit: 18 }).catch(() => []),
          fetchDoubanCatalog({ type: 'tv', tag: '日本动画', genres: '科幻', sort: 'U', limit: 18 }).catch(() => []),
          fetchDoubanCatalog({ type: 'tv', tag: '日本动画', range: '9,10', sort: 'T', limit: 18 }).catch(() => []),
        ]);

        if (isCancelled) return;

        if (bgmCal && bgmCal.length > 0) {
          setBangumiCalendar(bgmCal);
        }

        // Tag all items as category '动漫'
        const tagAnime = (list: MediaItem[]) =>
          list.map((item) => ({ ...item, category: '动漫', sourceCategory: 'anime' }));

        const hotTagged = tagAnime(hotList);
        const theatricalTagged = tagAnime(theatricalList);
        const isekaiTagged = tagAnime(isekaiList);
        const shonenTagged = tagAnime(shonenList);
        const romanceTagged = tagAnime(romanceList);
        const scifiTagged = tagAnime(scifiList);
        const classTagged = tagAnime(classList);

        // Featured heroes from hot + bangumi
        const heroes = hotTagged.slice(0, 6);
        const top10 = hotTagged.slice(0, 10);
        const latest = hotTagged.slice(2, 18);

        setHeroAnime(heroes);
        setTop10Anime(top10);
        setLatestAnime(latest);
        setTheatricalAnime(theatricalTagged);
        setIsekaiAnime(isekaiTagged);
        setShonenAnime(shonenTagged);
        setRomanceAnime(romanceTagged);
        setScifiAnime(scifiTagged);
        setClassicsAnime(classTagged);
        setLoadingRows(false);

        // Cache rows in sessionStorage
        try {
          sessionStorage.setItem(
            CACHE_KEY_ROWS,
            JSON.stringify({
              hero: heroes,
              top10,
              latest,
              theatrical: theatricalTagged,
              isekai: isekaiTagged,
              shonen: shonenTagged,
              romance: romanceTagged,
              scifi: scifiTagged,
              classics: classTagged,
            })
          );
        } catch {}
      } catch (err) {
        console.error('AnimePage load error:', err);
        setLoadingRows(false);
      }
    };

    loadData();

    return () => {
      isCancelled = true;
    };
  }, []);

  // 2. Build Filter Options for Grid / Category Views
  const buildOptions = useCallback(
    (offset: number): DoubanFilterOptions => {
      let type: 'movie' | 'tv' = 'tv';
      let tag: string | undefined = '日本动画';
      let genres: string | undefined = undefined;
      let year_range: string | undefined = undefined;
      let range = ratingRange !== 'all' ? ratingRange : '0,10';

      if (activeTab === 'theatrical') {
        type = 'movie';
        tag = '动画';
        genres = '动画';
      } else if (activeTab === 'isekai') {
        genres = '奇幻';
      } else if (activeTab === 'shonen') {
        genres = '动作';
      } else if (activeTab === 'romance') {
        genres = '爱情';
      } else if (activeTab === 'scifi') {
        genres = '科幻';
      } else if (activeTab === 'mystery') {
        genres = '悬疑';
      } else if (activeTab === 'classics') {
        range = '9,10';
      } else if (activeTab === 'seasons') {
        year_range = selectedSeason;
      }

      return {
        type,
        tag,
        genres,
        year_range,
        range,
        sort,
        limit: 24,
        start: offset,
      };
    },
    [activeTab, selectedSeason, sort, ratingRange]
  );

  // 3. Load Grid Items when tab, season, or filters change
  useEffect(() => {
    if (activeTab === 'all') return;
    if (activeTab === 'timeline') return;

    let isCancelled = false;
    const fetchGrid = async () => {
      setLoadingGrid(true);
      setStartOffset(0);
      try {
        const opts = buildOptions(0);
        const res = await fetchDoubanCatalog(opts);
        if (!isCancelled) {
          const tagged = res.map((item) => ({ ...item, category: '动漫', sourceCategory: 'anime' }));
          setGridItems(sortMediaByCover(tagged));
          setHasMore(res.length >= 24);
          setLoadingGrid(false);
        }
      } catch {
        if (!isCancelled) setLoadingGrid(false);
      }
    };

    fetchGrid();
    return () => {
      isCancelled = true;
    };
  }, [activeTab, selectedSeason, sort, ratingRange, buildOptions]);

  // 4. Load More Grid Items
  const loadMore = useCallback(async () => {
    if (loadingGrid || loadingMore || !hasMore || activeTab === 'all' || activeTab === 'timeline') return;
    setLoadingMore(true);
    const nextOffset = gridItems.length;
    try {
      const opts = buildOptions(nextOffset);
      const res = await fetchDoubanCatalog(opts);
      if (res.length > 0) {
        setGridItems((prev) => {
          const existingIds = new Set(prev.map((i) => i.id));
          const filtered = res.filter((i) => !existingIds.has(i.id));
          const tagged = filtered.map((item) => ({ ...item, category: '动漫', sourceCategory: 'anime' }));
          return sortMediaByCover([...prev, ...tagged]);
        });
        setStartOffset(nextOffset);
        setHasMore(res.length >= 24);
      } else {
        setHasMore(false);
      }
    } catch {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingGrid, loadingMore, hasMore, activeTab, gridItems.length, buildOptions]);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: '450px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  // Current Airing Timeline Row for selected day
  const currentAirRow = useMemo(() => {
    if (!bangumiCalendar || bangumiCalendar.length === 0) return null;
    return (
      bangumiCalendar.find((g) => g.day.includes(selectedWeekday.slice(1))) ||
      bangumiCalendar[0]
    );
  }, [bangumiCalendar, selectedWeekday]);

  return (
    <div className="min-h-screen bg-[#141414] text-white safe-page-top pb-24">
      {/* 1. Netflix Billboard Hero Banner (Only in 'all' view) */}
      {activeTab === 'all' && (
        <div className="relative">
          {heroAnime.length > 0 ? (
            <HeroBanner
              movies={heroAnime}
              onPlay={onPlay}
              onOpenDetail={onOpenDetail}
              watchlistIds={watchlistIds}
              onToggleFavorite={onToggleFavorite}
            />
          ) : (
            <div className="h-[55vh] sm:h-[75vh] w-full bg-[#181818] animate-pulse flex items-center justify-center">
              <div className="w-10 h-10 border-4 border-[#E50914] border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      )}

      {/* 2. Netflix Category Sub-Nav Bar (Sticky under Navbar) */}
      <div
        className={`sticky top-14 sm:top-16 z-40 bg-[#141414]/95 backdrop-blur-md border-b border-white/10 px-4 sm:px-6 lg:px-8 py-3 transition-all duration-200 ${
          activeTab === 'all' ? 'sm:-mt-12' : 'pt-4'
        }`}
      >
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Left: Title & Netflix Anime Category Pill Selector */}
          <div className="flex items-center space-x-3 overflow-x-auto no-scrollbar py-1">
            <div className="flex items-center space-x-1.5 pr-2 border-r border-white/15 flex-shrink-0">
              <span className="w-2.5 h-2.5 rounded-full bg-[#E50914] animate-ping" />
              <span className="text-sm font-black tracking-wider uppercase text-white">
                {language === 'en' ? 'ANIME' : '新番专区'}
              </span>
            </div>

            {CATEGORY_TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    if (tab.id !== 'all' && tab.id !== 'timeline') {
                      setViewLayout('grid');
                    }
                  }}
                  className={`flex items-center text-xs font-bold px-3 py-1.5 rounded-full whitespace-nowrap transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'bg-[#E50914] text-white shadow-lg shadow-red-900/40 scale-105'
                      : 'bg-white/5 hover:bg-white/15 text-gray-300 hover:text-white border border-white/5'
                  }`}
                >
                  {tab.icon}
                  <span>{language === 'en' ? tab.enLabel : tab.label}</span>
                  {tab.badge && (
                    <span className="ml-1.5 text-[9px] bg-white/20 text-white px-1.5 py-0.2 rounded-full font-mono">
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Right: Layout Switcher & Fast Indicators */}
          <div className="flex items-center space-x-2 self-end md:self-auto flex-shrink-0">
            <span className="inline-flex items-center text-[11px] bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 px-2 py-0.5 rounded font-medium">
              💬 弹幕
            </span>

            {/* Layout Toggle (Rows vs Grid) */}
            {activeTab !== 'all' && (
              <div className="flex items-center bg-white/10 rounded-lg p-0.5 border border-white/10">
                <button
                  onClick={() => setViewLayout('grid')}
                  title="网格视图"
                  className={`p-1.5 rounded-md text-xs transition-colors cursor-pointer ${
                    viewLayout === 'grid' ? 'bg-[#E50914] text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setViewLayout('rows')}
                  title="行视图"
                  className={`p-1.5 rounded-md text-xs transition-colors cursor-pointer ${
                    viewLayout === 'rows' ? 'bg-[#E50914] text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Rows3 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. Main Content Views */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
        {/* VIEW A: 'all' (🌟 精彩全景 - Signature Netflix Multi-Row Streaming) */}
        {activeTab === 'all' && (
          <div className="space-y-4 sm:space-y-6 pb-12">
            {loadingRows ? (
              <div className="space-y-8 pt-6">
                <NetflixRowSkeleton />
                <NetflixRowSkeleton />
                <NetflixRowSkeleton />
              </div>
            ) : (
              <>
                {/* Row 1: 🏆 Top 10 今日追番榜 (Top 10 Today) */}
                {top10Anime.length > 0 && (
                  <div className="relative -mt-8 sm:-mt-16 z-20">
                    <MovieRow
                      title={language === 'en' ? '🏆 Top 10 Anime Today' : '🏆 Top 10 今日追番热榜'}
                      movies={top10Anime}
                      isTop10
                      onPlay={onPlay}
                      onOpenDetail={onOpenDetail}
                      watchlistIds={watchlistIds}
                      onToggleFavorite={onToggleFavorite}
                    />
                  </div>
                )}

                {/* Row 2: 🌸 2026 最新季度新番 (Simulcast Hot) */}
                {latestAnime.length > 0 && (
                  <MovieRow
                    title={language === 'en' ? '🌸 2026 Trending Simulcast' : '🌸 2026 最新季度热播新番'}
                    movies={latestAnime}
                    onPlay={onPlay}
                    onOpenDetail={onOpenDetail}
                    watchlistIds={watchlistIds}
                    onToggleFavorite={onToggleFavorite}
                    onExplore={() => setActiveTab('seasons')}
                  />
                )}

                {/* Row 3: 📅 每日追番时刻表 (Interactive Bangumi Weekday Row) */}
                {bangumiCalendar.length > 0 && (
                  <div className="my-6 sm:my-8 bg-zinc-900/60 border border-white/10 rounded-2xl p-4 sm:p-6 shadow-xl">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
                      <div>
                        <div className="flex items-center space-x-2">
                          <Calendar className="w-5 h-5 text-pink-400" />
                          <h2 className="text-lg sm:text-xl font-bold text-white tracking-wide">
                            {language === 'en' ? 'Daily Broadcast Timeline' : '📅 每日放送时间线 (周更表)'}
                          </h2>
                          <span className="text-xs bg-[#E50914] text-white px-2 py-0.5 rounded font-mono font-semibold">
                            LIVE
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          {language === 'en'
                            ? 'Synchronized with Tokyo TV stations & Bangumi. Airing daily.'
                            : '同步日本各大电视台放送时刻，极速直连高清播放与全网弹幕。'}
                        </p>
                      </div>

                      {/* Weekday Switcher Pills */}
                      <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar py-1">
                        {WEEKDAY_KEYS.map((w) => {
                          const isCur = selectedWeekday === w;
                          const isToday = WEEKDAY_KEYS[new Date().getDay()] === w;
                          return (
                            <button
                              key={w}
                              onClick={() => setSelectedWeekday(w)}
                              className={`text-xs px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-all cursor-pointer ${
                                isCur
                                  ? 'bg-pink-600 text-white font-bold shadow-md shadow-pink-900/40'
                                  : 'bg-white/10 hover:bg-white/15 text-gray-300'
                              }`}
                            >
                              {w}
                              {isToday && <span className="ml-1 text-[10px] text-yellow-300 font-bold">·今</span>}
                            </button>
                          );
                        })}

                        <button
                          onClick={() => setActiveTab('timeline')}
                          className="text-xs text-pink-400 hover:text-pink-300 font-medium pl-2 flex items-center whitespace-nowrap cursor-pointer"
                        >
                          <span>全部周历</span>
                          <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                        </button>
                      </div>
                    </div>

                    {/* Airing items for the selected day */}
                    {currentAirRow ? (
                      <div className="overflow-x-auto no-scrollbar flex space-x-3 sm:space-x-4 py-2">
                        {currentAirRow.items.map((anime) => (
                          <div key={anime.id} className="w-32 sm:w-44 flex-shrink-0">
                            <MovieCard
                              movie={{
                                ...anime,
                                airDay: anime.airDay || currentAirRow.day,
                                category: '动漫',
                                sourceCategory: 'anime',
                              }}
                              onPlay={onPlay}
                              onOpenDetail={onOpenDetail}
                              isFavorite={watchlistIds.has(anime.id)}
                              onToggleFavorite={onToggleFavorite}
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-400 text-sm">
                        今日暂无放送更新计划
                      </div>
                    )}
                  </div>
                )}

                {/* Row 4: 🎬 动画剧场版与电影巅峰 (Theatrical Movies) */}
                {theatricalAnime.length > 0 && (
                  <MovieRow
                    title={language === 'en' ? '🎬 Theatrical Anime Movies' : '🎬 剧场版巅峰 & 动画大电影'}
                    movies={theatricalAnime}
                    onPlay={onPlay}
                    onOpenDetail={onOpenDetail}
                    watchlistIds={watchlistIds}
                    onToggleFavorite={onToggleFavorite}
                    onExplore={() => setActiveTab('theatrical')}
                  />
                )}

                {/* Row 5: 🧙 异世界转生与奇幻冒险 (Isekai & Fantasy) */}
                {isekaiAnime.length > 0 && (
                  <MovieRow
                    title={language === 'en' ? '🧙 Isekai & Fantasy Adventures' : '🧙 异世界转生与奇幻物语'}
                    movies={isekaiAnime}
                    onPlay={onPlay}
                    onOpenDetail={onOpenDetail}
                    watchlistIds={watchlistIds}
                    onToggleFavorite={onToggleFavorite}
                    onExplore={() => setActiveTab('isekai')}
                  />
                )}

                {/* Row 6: ⚔️ 少年热血与激斗传奇 (Shonen & Action) */}
                {shonenAnime.length > 0 && (
                  <MovieRow
                    title={language === 'en' ? '⚔️ Shonen & Action Battles' : '⚔️ 少年热血与对决传奇'}
                    movies={shonenAnime}
                    onPlay={onPlay}
                    onOpenDetail={onOpenDetail}
                    watchlistIds={watchlistIds}
                    onToggleFavorite={onToggleFavorite}
                    onExplore={() => setActiveTab('shonen')}
                  />
                )}

                {/* Row 7: ☕ 青春恋爱与日常治愈 (Romance & Slice of Life) */}
                {romanceAnime.length > 0 && (
                  <MovieRow
                    title={language === 'en' ? '☕ Romance & Slice of Life' : '☕ 青春恋爱与日常治愈'}
                    movies={romanceAnime}
                    onPlay={onPlay}
                    onOpenDetail={onOpenDetail}
                    watchlistIds={watchlistIds}
                    onToggleFavorite={onToggleFavorite}
                    onExplore={() => setActiveTab('romance')}
                  />
                )}

                {/* Row 8: 🔮 未来科幻与机战传奇 (Sci-Fi & Mecha) */}
                {scifiAnime.length > 0 && (
                  <MovieRow
                    title={language === 'en' ? '🔮 Sci-Fi & Mecha Legends' : '🔮 未来科幻与机战传奇'}
                    movies={scifiAnime}
                    onPlay={onPlay}
                    onOpenDetail={onOpenDetail}
                    watchlistIds={watchlistIds}
                    onToggleFavorite={onToggleFavorite}
                    onExplore={() => setActiveTab('scifi')}
                  />
                )}

                {/* Row 9: 👑 豆瓣 9.0+ 殿堂神作 (Classics) */}
                {classicsAnime.length > 0 && (
                  <MovieRow
                    title={language === 'en' ? '👑 Top Rated Classics (9.0+)' : '👑 豆瓣 9.0+ 影史殿堂神作'}
                    movies={classicsAnime}
                    onPlay={onPlay}
                    onOpenDetail={onOpenDetail}
                    watchlistIds={watchlistIds}
                    onToggleFavorite={onToggleFavorite}
                    onExplore={() => setActiveTab('classics')}
                  />
                )}
              </>
            )}
          </div>
        )}

        {/* VIEW B: 'timeline' (📅 新番时刻表 - Full Mon to Sun Bangumi Timeline) */}
        {activeTab === 'timeline' && (
          <div className="py-6 space-y-8">
            <div className="bg-gradient-to-r from-pink-950/60 via-black to-zinc-900 border border-pink-500/20 rounded-2xl p-6 sm:p-8">
              <div className="flex items-center space-x-2 text-pink-400 text-xs font-bold uppercase tracking-wider mb-2">
                <Calendar className="w-4 h-4" />
                <span>Simulcast Schedule · 每日连载周历</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white">
                {language === 'en' ? 'Weekly Anime Broadcast Calendar' : '📅 日本新番每日放送表'}
              </h1>
              <p className="text-xs sm:text-sm text-gray-300 mt-2 max-w-2xl leading-relaxed">
                {language === 'en'
                  ? 'Real-time broadcast schedule synchronized with Bangumi and Japanese TV channels. Never miss an episode.'
                  : '实时同步 Bangumi 与东京各大电视频道新番档期，极速无删减秒播，支持弹幕实时互动与切换片源。'}
              </p>
            </div>

            {/* Weekday Switcher / All Tabs */}
            <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar py-2">
              <button
                onClick={() => setSelectedWeekday('all')}
                className={`text-xs px-4 py-2 rounded-xl font-bold transition-all cursor-pointer ${
                  selectedWeekday === 'all'
                    ? 'bg-[#E50914] text-white shadow-md'
                    : 'bg-white/10 hover:bg-white/15 text-gray-300'
                }`}
              >
                全部周历 (Mon-Sun)
              </button>

              {WEEKDAY_KEYS.map((w) => {
                const isSelected = selectedWeekday === w;
                const isToday = WEEKDAY_KEYS[new Date().getDay()] === w;
                return (
                  <button
                    key={w}
                    onClick={() => setSelectedWeekday(w)}
                    className={`text-xs px-4 py-2 rounded-xl font-bold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-pink-600 text-white shadow-md shadow-pink-900/40'
                        : 'bg-white/10 hover:bg-white/15 text-gray-300'
                    }`}
                  >
                    {w}
                    {isToday && <span className="ml-1 text-[10px] text-yellow-300 font-bold">·今日放送</span>}
                  </button>
                );
              })}
            </div>

            {/* Display by day or all rows */}
            {bangumiCalendar.length === 0 ? (
              <NetflixGridSkeleton count={12} />
            ) : selectedWeekday === 'all' ? (
              <div className="space-y-6">
                {bangumiCalendar.map((row) => (
                  <MovieRow
                    key={row.day}
                    title={`${row.day} 更新`}
                    movies={row.items.map((m) => ({
                      ...m,
                      airDay: m.airDay || row.day,
                      category: '动漫',
                      sourceCategory: 'anime',
                    }))}
                    onPlay={onPlay}
                    onOpenDetail={onOpenDetail}
                    watchlistIds={watchlistIds}
                    onToggleFavorite={onToggleFavorite}
                  />
                ))}
              </div>
            ) : (
              <div>
                <h3 className="text-xl font-bold mb-4 flex items-center">
                  <span>{selectedWeekday} 放送番剧</span>
                  <span className="ml-2 text-xs bg-pink-500/20 text-pink-300 border border-pink-500/30 px-2 py-0.5 rounded-full font-mono">
                    {currentAirRow?.items.length || 0} 部
                  </span>
                </h3>

                {currentAirRow && currentAirRow.items.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
                    {currentAirRow.items.map((anime) => (
                      <MovieCard
                        key={anime.id}
                        movie={{
                          ...anime,
                          airDay: anime.airDay || selectedWeekday,
                          category: '动漫',
                          sourceCategory: 'anime',
                        }}
                        onPlay={onPlay}
                        onOpenDetail={onOpenDetail}
                        isFavorite={watchlistIds.has(anime.id)}
                        onToggleFavorite={onToggleFavorite}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16 text-gray-400">该工作日暂无收录番剧</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* VIEW C: 'seasons', 'theatrical', and Genre Views */}
        {activeTab !== 'all' && activeTab !== 'timeline' && (
          <div className="py-6 space-y-6">
            {/* Filter and Controls Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900/60 p-4 sm:p-5 rounded-2xl border border-white/10">
              {/* Category Title & Description */}
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-white flex items-center">
                  {CATEGORY_TABS.find((t) => t.id === activeTab)?.icon}
                  <span className="ml-2">
                    {language === 'en'
                      ? CATEGORY_TABS.find((t) => t.id === activeTab)?.enLabel
                      : CATEGORY_TABS.find((t) => t.id === activeTab)?.label}
                  </span>
                </h1>
                <p className="text-xs text-gray-400 mt-1">
                  {activeTab === 'theatrical'
                    ? '精选动画剧场版、新海诚/吉卜力巅峰大电影、高分经典电影'
                    : activeTab === 'seasons'
                    ? '按年度与季度全景回溯补番，涵盖近年来各大主流档期'
                    : 'Netflix 沉浸式流媒体分类展示，支持高码率切片与多线路切换'}
                </p>
              </div>

              {/* Season Pills (Only if in 'seasons' tab) */}
              {activeTab === 'seasons' && (
                <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar py-1">
                  {SEASONS_LIST.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedSeason(s.id)}
                      className={`text-xs px-3 py-1.5 rounded-lg font-bold whitespace-nowrap transition-all cursor-pointer ${
                        selectedSeason === s.id
                          ? 'bg-[#E50914] text-white shadow-md'
                          : 'bg-white/10 hover:bg-white/15 text-gray-300'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Sort & Rating Filter Dropdowns */}
              <div className="flex items-center space-x-2 flex-wrap">
                {/* Sort */}
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  className="bg-zinc-800 text-xs text-gray-200 border border-white/15 rounded-lg px-2.5 py-1.5 outline-none cursor-pointer focus:border-[#E50914]"
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>

                {/* Rating */}
                {activeTab !== 'classics' && (
                  <select
                    value={ratingRange}
                    onChange={(e) => setRatingRange(e.target.value)}
                    className="bg-zinc-800 text-xs text-gray-200 border border-white/15 rounded-lg px-2.5 py-1.5 outline-none cursor-pointer focus:border-[#E50914]"
                  >
                    {RATING_OPTIONS.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Grid or Row Presentation */}
            {loadingGrid ? (
              <NetflixGridSkeleton count={18} />
            ) : gridItems.length === 0 ? (
              <div className="text-center py-20 text-gray-400">
                暂无匹配该条件的动漫资源
              </div>
            ) : viewLayout === 'rows' ? (
              /* Rows Partitioning */
              <div className="space-y-6">
                <MovieRow
                  title="🔥 热门精选"
                  movies={gridItems.slice(0, 12)}
                  onPlay={onPlay}
                  onOpenDetail={onOpenDetail}
                  watchlistIds={watchlistIds}
                  onToggleFavorite={onToggleFavorite}
                />
                {gridItems.length > 12 && (
                  <MovieRow
                    title="🌟 更多推荐"
                    movies={gridItems.slice(12, 24)}
                    onPlay={onPlay}
                    onOpenDetail={onOpenDetail}
                    watchlistIds={watchlistIds}
                    onToggleFavorite={onToggleFavorite}
                  />
                )}
                {gridItems.length > 24 && (
                  <MovieRow
                    title="🍿 猜你喜欢"
                    movies={gridItems.slice(24)}
                    onPlay={onPlay}
                    onOpenDetail={onOpenDetail}
                    watchlistIds={watchlistIds}
                    onToggleFavorite={onToggleFavorite}
                  />
                )}
              </div>
            ) : (
              /* Infinite Scroll Grid */
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
                {gridItems.map((movie) => (
                  <MovieCard
                    key={movie.id}
                    movie={movie}
                    onPlay={onPlay}
                    onOpenDetail={onOpenDetail}
                    isFavorite={watchlistIds.has(movie.id)}
                    onToggleFavorite={onToggleFavorite}
                  />
                ))}
              </div>
            )}

            {/* Sentinel for Infinite Scroll (when in grid layout) */}
            {viewLayout === 'grid' && (
              <div ref={sentinelRef} className="py-8 flex justify-center">
                {loadingMore && (
                  <div className="flex items-center space-x-2 text-sm text-gray-400">
                    <div className="w-4 h-4 border-2 border-[#E50914] border-t-transparent rounded-full animate-spin" />
                    <span>正在加载更多动漫...</span>
                  </div>
                )}
                {!hasMore && gridItems.length > 0 && (
                  <div className="text-xs text-gray-500 font-mono">
                    已加载全部相关内容
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
