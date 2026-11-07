import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { MediaItem } from '../types';
import { fetchHuakaiCatalog } from '../services/api';
import { MovieCard } from './MovieCard';
import { useI18n } from '../i18n';

interface HuakaiPageProps {
  onPlay: (movie: MediaItem) => void;
  onOpenDetail: (movie: MediaItem) => void;
  watchlistIds: Set<string>;
  onToggleFavorite: (movie: MediaItem) => void;
}

export const HuakaiPage: React.FC<HuakaiPageProps> = ({
  onPlay,
  onOpenDetail,
  watchlistIds,
  onToggleFavorite,
}) => {
  const { t } = useI18n();
  const [page, setPage] = useState<number>(1);
  const [selectedType, setSelectedType] = useState<number | undefined>(undefined);
  const [keyword, setKeyword] = useState<string>('');
  const [searchInput, setSearchInput] = useState<string>('');
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [pageCount, setPageCount] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const subCategories = [
    { id: undefined, label: '全部' },
    { id: 7, label: '卡通动漫' },
    { id: 1, label: '无码专区' },
    { id: 2, label: '麻豆传媒' },
    { id: 3, label: '制服诱惑' },
    { id: 6, label: '中文字幕' },
    { id: 11, label: '熟女人妻' },
    { id: 8, label: '欧美系列' },
    { id: 35, label: '网红头条' },
  ];

  // Load first page on filter change
  useEffect(() => {
    let isCancelled = false;
    const loadFirst = async () => {
      setLoading(true);
      setPage(1);
      const res = await fetchHuakaiCatalog(1, selectedType, keyword);
      if (!isCancelled) {
        setItems(res.items);
        setPageCount(res.pagecount || 1);
        setTotalCount(res.total || 0);
        setHasMore((res.pagecount || 1) > 1);
        setLoading(false);
      }
    };
    loadFirst();
    return () => {
      isCancelled = true;
    };
  }, [selectedType, keyword]);

  // Load more function
  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !hasMore) return;
    const nextPage = page + 1;
    if (nextPage > pageCount) {
      setHasMore(false);
      return;
    }
    setLoadingMore(true);
    const res = await fetchHuakaiCatalog(nextPage, selectedType, keyword);
    if (res.items.length > 0) {
      setItems((prev) => {
        const existingIds = new Set(prev.map((i) => i.id));
        const filteredNew = res.items.filter((i) => !existingIds.has(i.id));
        return [...prev, ...filteredNew];
      });
      setPage(nextPage);
      setHasMore(nextPage < (res.pagecount || pageCount));
    } else {
      setHasMore(false);
    }
    setLoadingMore(false);
  }, [page, pageCount, selectedType, keyword, loading, loadingMore, hasMore]);

  // Intersection Observer for infinite scrolling
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: '400px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setKeyword(searchInput.trim());
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setKeyword('');
  };

  const handleSelectCategory = (typeId?: number) => {
    setSelectedType(typeId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="safe-page-top pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto min-h-screen">
      {/* Header Banner */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl sm:text-4xl font-black mb-2 flex items-center">
              {t('huakaiPortalTitle')}
              <span className="ml-3 text-xs bg-[#E50914] text-white px-2 py-0.5 rounded font-mono">
                155动漫专线
              </span>
            </h1>
            <p className="text-sm text-gray-400 max-w-2xl">
              {t('huakaiPortalSub')}
            </p>
          </div>

          {/* Quick Search */}
          <form onSubmit={handleSearchSubmit} className="relative w-full md:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t('huakaiSearchPlaceholder')}
              className="w-full bg-[#202020] text-white pl-10 pr-9 py-2.5 rounded-xl text-sm outline-none border border-white/10 focus:border-[#E50914] transition-all placeholder-gray-500 shadow-md"
            />
            {searchInput && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs"
              >
                ✕
              </button>
            )}
          </form>
        </div>

        {/* Subcategories Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/10">
          {subCategories.map((cat) => {
            const isActive = selectedType === cat.id;
            return (
              <button
                key={cat.label}
                onClick={() => handleSelectCategory(cat.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-[#E50914] text-white shadow-md'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
          {totalCount > 0 && (
            <span className="ml-auto text-xs text-gray-500 font-mono hidden sm:inline">
              共 {totalCount} 部影片 · 无限滚动浏览
            </span>
          )}
        </div>
      </div>

      {/* Video Grid or Initial Loader */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-28 text-gray-400">
          <Loader2 className="w-10 h-10 animate-spin text-[#E50914] mb-3" />
          <p className="text-sm">正在加载花开专区内容...</p>
        </div>
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

          {/* Infinite Scroll Sentinel & Loader */}
          <div ref={sentinelRef} className="py-10 flex justify-center items-center text-gray-500 text-xs">
            {loadingMore ? (
              <div className="flex items-center space-x-2 text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin text-[#E50914]" />
                <span>正在加载更多影片...</span>
              </div>
            ) : hasMore ? (
              <span className="opacity-40">继续向下滑动加载更多内容</span>
            ) : (
              <span className="opacity-40">已加载完当前分类全部内容</span>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-24 text-gray-400">
          <p className="text-lg mb-2">未找到相关内容</p>
          <p className="text-sm text-gray-500">建议尝试其他筛选标签或清空搜索关键词。</p>
        </div>
      )}
    </div>
  );
};
