import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  SlidersHorizontal,
  RotateCcw,
  X,
  ChevronDown,
  Star,
  Globe,
  Calendar,
  Film,
  Sparkles,
} from 'lucide-react';
import { MediaItem } from '../types';
import { fetchDoubanCatalog, sortMediaByCover, DoubanFilterOptions } from '../services/api';
import { MovieCard } from './MovieCard';
import { NetflixGridSkeleton } from './NetflixSkeleton';
import { useI18n } from '../i18n';

interface TagOption {
  id: string;
  label: string;
}

interface InfiniteCatalogViewProps {
  type: 'movie' | 'tv';
  initialTag?: string;
  tags: TagOption[];
  title: string;
  subtitle: string;
  badge?: string;
  headerSlot?: React.ReactNode;
  onPlay: (movie: MediaItem) => void;
  onOpenDetail: (movie: MediaItem) => void;
  watchlistIds: Set<string>;
  onToggleFavorite: (movie: MediaItem) => void;
}

const PAGE_SIZE = 24;

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
  { id: '7,10', label: '👍 7.0+ 推荐好片' },
];

const GENRE_OPTIONS = [
  { id: 'all', label: '全部类型' },
  { id: '动作', label: '动作' },
  { id: '喜剧', label: '喜剧' },
  { id: '科幻', label: '科幻' },
  { id: '爱情', label: '爱情' },
  { id: '悬疑', label: '悬疑' },
  { id: '犯罪', label: '犯罪' },
  { id: '奇幻', label: '奇幻' },
  { id: '动画', label: '动画' },
  { id: '剧情', label: '剧情' },
  { id: '惊悚', label: '惊悚' },
  { id: '恐怖', label: '恐怖' },
  { id: '战争', label: '战争' },
  { id: '冒险', label: '冒险' },
  { id: '纪录片', label: '纪录片' },
  { id: '武侠', label: '武侠' },
];

const COUNTRY_OPTIONS = [
  { id: 'all', label: '全部地区' },
  { id: '中国大陆', label: '华语 (大陆)' },
  { id: '美国', label: '欧美 (美国)' },
  { id: '韩国', label: '韩国' },
  { id: '日本', label: '日本' },
  { id: '中国香港', label: '中国香港' },
  { id: '中国台湾', label: '中国台湾' },
  { id: '英国', label: '英国' },
  { id: '法国', label: '法国' },
  { id: '泰国', label: '泰国' },
  { id: '德国', label: '德国' },
  { id: '意大利', label: '意大利' },
  { id: '西班牙', label: '西班牙' },
  { id: '印度', label: '印度' },
];

const YEAR_OPTIONS = [
  { id: 'all', label: '全部年份' },
  { id: '2025,2025', label: '2025' },
  { id: '2024,2024', label: '2024' },
  { id: '2023,2023', label: '2023' },
  { id: '2022,2022', label: '2022' },
  { id: '2020,2025', label: '2020年代' },
  { id: '2010,2019', label: '2010年代' },
  { id: '2000,2009', label: '2000年代' },
  { id: '1990,1999', label: '90年代' },
  { id: '1,1989', label: '80年代及更早' },
];

export const InfiniteCatalogView: React.FC<InfiniteCatalogViewProps> = ({
  type,
  initialTag = '热门',
  tags,
  title,
  subtitle,
  badge,
  headerSlot,
  onPlay,
  onOpenDetail,
  watchlistIds,
  onToggleFavorite,
}) => {
  const { t } = useI18n();
  const [selectedTag, setSelectedTag] = useState<string>(initialTag);
  const [sort, setSort] = useState<string>('U');
  const [ratingRange, setRatingRange] = useState<string>('all');
  const [genre, setGenre] = useState<string>('all');
  const [country, setCountry] = useState<string>('all');
  const [yearRange, setYearRange] = useState<string>('all');
  const [filterPanelOpen, setFilterPanelOpen] = useState<boolean>(false);

  const [items, setItems] = useState<MediaItem[]>([]);
  const [start, setStart] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(true);

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const hasAdvancedFilters =
    sort !== 'U' ||
    ratingRange !== 'all' ||
    genre !== 'all' ||
    country !== 'all' ||
    yearRange !== 'all';

  const activeFilterCount =
    (sort !== 'U' ? 1 : 0) +
    (ratingRange !== 'all' ? 1 : 0) +
    (genre !== 'all' ? 1 : 0) +
    (country !== 'all' ? 1 : 0) +
    (yearRange !== 'all' ? 1 : 0);

  const handleResetFilters = () => {
    setSort('U');
    setRatingRange('all');
    setGenre('all');
    setCountry('all');
    setYearRange('all');
    setSelectedTag(initialTag);
  };

  // Build filter options
  const buildFilterOptions = useCallback(
    (offset: number): DoubanFilterOptions => ({
      type,
      sort,
      range: ratingRange !== 'all' ? ratingRange : '0,10',
      genres: genre !== 'all' ? genre : undefined,
      countries: country !== 'all' ? country : undefined,
      year_range: yearRange !== 'all' ? yearRange : undefined,
      tag: !hasAdvancedFilters ? selectedTag : undefined,
      limit: PAGE_SIZE,
      start: offset,
    }),
    [type, sort, ratingRange, genre, country, yearRange, hasAdvancedFilters, selectedTag]
  );

  // Load first batch when any filter or tag changes
  useEffect(() => {
    let isCancelled = false;
    const loadFirstBatch = async () => {
      setLoading(true);
      setStart(0);
      const options = buildFilterOptions(0);
      const res = await fetchDoubanCatalog(options);
      if (!isCancelled) {
        setItems(res);
        setHasMore(res.length >= PAGE_SIZE);
        setLoading(false);
      }
    };

    loadFirstBatch();
    return () => {
      isCancelled = true;
    };
  }, [buildFilterOptions]);

  // Load next batch
  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextStart = items.length;
    const options = buildFilterOptions(nextStart);
    const res = await fetchDoubanCatalog(options);

    if (res.length > 0) {
      setItems((prev) => {
        const existingIds = new Set(prev.map((i) => i.id));
        const filteredNew = res.filter((i) => !existingIds.has(i.id));
        return sortMediaByCover([...prev, ...filteredNew]);
      });
      setStart(nextStart);
      setHasMore(res.length >= PAGE_SIZE);
    } else {
      setHasMore(false);
    }
    setLoadingMore(false);
  }, [loading, loadingMore, hasMore, items.length, buildFilterOptions]);

  // Infinite Scroll IntersectionObserver
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: '500px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  const handleSelectQuickTag = (tagId: string) => {
    if (hasAdvancedFilters) {
      // Clear advanced filters when picking a quick preset tag
      setSort('U');
      setRatingRange('all');
      setGenre('all');
      setCountry('all');
      setYearRange('all');
    }
    setSelectedTag(tagId);
  };

  return (
    <div className="safe-page-top pb-28 sm:pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto min-h-[100dvh]">
      {/* Optional Top Slot (e.g. Bangumi calendar for Anime) */}
      {headerSlot}

      {/* Catalog Title & Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-2">
          <div>
            <h1 className="text-2xl sm:text-4xl font-black flex items-center">
              {title}
              {badge && (
                <span className="ml-3 text-xs bg-[#E50914] text-white px-2 py-0.5 rounded font-mono">
                  {badge}
                </span>
              )}
            </h1>
            <p className="text-sm text-gray-400 mt-1">{subtitle}</p>
          </div>

          {/* Action Buttons: Filter & Sort Toggle */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setFilterPanelOpen(!filterPanelOpen)}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                filterPanelOpen || hasAdvancedFilters
                  ? 'bg-[#E50914] text-white border-[#E50914] shadow-lg shadow-red-900/30'
                  : 'bg-white/10 hover:bg-white/20 text-gray-200 border-white/10'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>{t('sortAndFilter')}</span>
              {activeFilterCount > 0 && (
                <span className="bg-white text-black font-black text-[10px] w-4 h-4 rounded-full flex items-center justify-center ml-1">
                  {activeFilterCount}
                </span>
              )}
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  filterPanelOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {hasAdvancedFilters && (
              <button
                onClick={handleResetFilters}
                className="flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/15 text-gray-300 hover:text-white border border-white/10 transition-all cursor-pointer"
                title={t('clearFilters')}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t('clearFilters')}</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Tag Pills (When filter panel is closed or as default shortcuts) */}
        <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar py-2 border-t border-white/10">
          {tags.map((tItem) => {
            const isActive = !hasAdvancedFilters && selectedTag === tItem.id;
            return (
              <button
                key={tItem.id}
                onClick={() => handleSelectQuickTag(tItem.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#E50914] text-white shadow-md'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                {tItem.label}
              </button>
            );
          })}
        </div>

        {/* Netflix-Style Expandable Filter & Sort Matrix Panel */}
        {filterPanelOpen && (
          <div className="mt-4 p-4 sm:p-5 rounded-xl bg-[#181818]/95 backdrop-blur-md border border-white/10 shadow-2xl space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
            {/* 1. Sort Dimension */}
            <div>
              <div className="flex items-center space-x-1.5 text-xs text-gray-400 font-semibold mb-2">
                <Sparkles className="w-3.5 h-3.5 text-[#E50914]" />
                <span>{t('sortBy')}</span>
              </div>
              <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar py-1">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setSort(opt.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border ${
                      sort === opt.id
                        ? 'bg-[#E50914] text-white border-[#E50914] shadow-md'
                        : 'bg-white/5 hover:bg-white/10 text-gray-300 border-white/10'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Rating Filter */}
            <div>
              <div className="flex items-center space-x-1.5 text-xs text-gray-400 font-semibold mb-2">
                <Star className="w-3.5 h-3.5 text-yellow-500" />
                <span>评分区间 (Rating)</span>
              </div>
              <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar py-1">
                {RATING_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setRatingRange(opt.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border ${
                      ratingRange === opt.id
                        ? 'bg-[#E50914] text-white border-[#E50914] shadow-md'
                        : 'bg-white/5 hover:bg-white/10 text-gray-300 border-white/10'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Genres / Category Filter */}
            <div>
              <div className="flex items-center space-x-1.5 text-xs text-gray-400 font-semibold mb-2">
                <Film className="w-3.5 h-3.5 text-emerald-400" />
                <span>影视分类 (Genre)</span>
              </div>
              <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar py-1">
                {GENRE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setGenre(opt.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border ${
                      genre === opt.id
                        ? 'bg-[#E50914] text-white border-[#E50914] shadow-md'
                        : 'bg-white/5 hover:bg-white/10 text-gray-300 border-white/10'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 4. Country / Region Filter */}
            <div>
              <div className="flex items-center space-x-1.5 text-xs text-gray-400 font-semibold mb-2">
                <Globe className="w-3.5 h-3.5 text-sky-400" />
                <span>国家与地区 (Region)</span>
              </div>
              <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar py-1">
                {COUNTRY_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setCountry(opt.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border ${
                      country === opt.id
                        ? 'bg-[#E50914] text-white border-[#E50914] shadow-md'
                        : 'bg-white/5 hover:bg-white/10 text-gray-300 border-white/10'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 5. Year Filter */}
            <div>
              <div className="flex items-center space-x-1.5 text-xs text-gray-400 font-semibold mb-2">
                <Calendar className="w-3.5 h-3.5 text-purple-400" />
                <span>上映年份 (Year)</span>
              </div>
              <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar py-1">
                {YEAR_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setYearRange(opt.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border ${
                      yearRange === opt.id
                        ? 'bg-[#E50914] text-white border-[#E50914] shadow-md'
                        : 'bg-white/5 hover:bg-white/10 text-gray-300 border-white/10'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Active Filters Summary Bar */}
            {hasAdvancedFilters && (
              <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-gray-400 mr-1">{t('activeFilters')}:</span>
                  {sort !== 'U' && (
                    <span className="inline-flex items-center bg-[#E50914]/20 border border-[#E50914]/40 text-red-200 px-2 py-0.5 rounded-full text-[11px]">
                      {SORT_OPTIONS.find((s) => s.id === sort)?.label}
                      <button onClick={() => setSort('U')} className="ml-1 hover:text-white">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {ratingRange !== 'all' && (
                    <span className="inline-flex items-center bg-yellow-500/20 border border-yellow-500/40 text-yellow-200 px-2 py-0.5 rounded-full text-[11px]">
                      {RATING_OPTIONS.find((r) => r.id === ratingRange)?.label}
                      <button onClick={() => setRatingRange('all')} className="ml-1 hover:text-white">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {genre !== 'all' && (
                    <span className="inline-flex items-center bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 px-2 py-0.5 rounded-full text-[11px]">
                      {genre}
                      <button onClick={() => setGenre('all')} className="ml-1 hover:text-white">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {country !== 'all' && (
                    <span className="inline-flex items-center bg-sky-500/20 border border-sky-500/40 text-sky-200 px-2 py-0.5 rounded-full text-[11px]">
                      {COUNTRY_OPTIONS.find((c) => c.id === country)?.label || country}
                      <button onClick={() => setCountry('all')} className="ml-1 hover:text-white">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {yearRange !== 'all' && (
                    <span className="inline-flex items-center bg-purple-500/20 border border-purple-500/40 text-purple-200 px-2 py-0.5 rounded-full text-[11px]">
                      {YEAR_OPTIONS.find((y) => y.id === yearRange)?.label || yearRange}
                      <button onClick={() => setYearRange('all')} className="ml-1 hover:text-white">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                </div>

                <button
                  onClick={handleResetFilters}
                  className="text-xs text-gray-400 hover:text-white underline underline-offset-4 cursor-pointer"
                >
                  全部重置
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Grid Content */}
      {loading ? (
        <NetflixGridSkeleton count={18} />
      ) : items.length > 0 ? (
        <div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 md:gap-5">
            {items.map((movie) => (
              <div key={movie.id} className="flex justify-center">
                <MovieCard
                  movie={movie}
                  onPlay={onPlay}
                  onOpenDetail={onOpenDetail}
                  isFavorite={watchlistIds.has(movie.id)}
                  onToggleFavorite={onToggleFavorite}
                />
              </div>
            ))}
          </div>

          {/* Infinite Scroll Sentinel */}
          <div ref={sentinelRef} className="py-12 flex justify-center items-center text-gray-500 text-xs">
            {loadingMore ? (
              <div className="w-full pt-4">
                <NetflixGridSkeleton count={6} />
              </div>
            ) : hasMore ? (
              <span className="opacity-40">{t('loadMoreContent')}</span>
            ) : (
              <span className="opacity-40">{t('allContentLoaded')}</span>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-24 text-gray-400">
          <p className="text-lg mb-2">{t('noCategoryContent')}</p>
          <p className="text-sm text-gray-500">{t('tryOtherTags')}</p>
          {hasAdvancedFilters && (
            <button
              onClick={handleResetFilters}
              className="mt-4 px-4 py-2 rounded-lg bg-[#E50914] text-white font-semibold text-xs transition-all shadow-lg hover:scale-105"
            >
              重置筛选条件
            </button>
          )}
        </div>
      )}
    </div>
  );
};