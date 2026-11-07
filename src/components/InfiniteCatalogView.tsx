import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { MediaItem } from '../types';
import { fetchDoubanCatalog } from '../services/api';
import { MovieCard } from './MovieCard';

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

export const InfiniteCatalogView: React.FC<InfiniteCatalogViewProps> = ({
  type,
  initialTag = '热门',
  tags,
  title,
  subtitle,
  badge = '4K Ultra HD',
  headerSlot,
  onPlay,
  onOpenDetail,
  watchlistIds,
  onToggleFavorite,
}) => {
  const [selectedTag, setSelectedTag] = useState<string>(initialTag);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [start, setStart] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(true);

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Load first batch when tag changes
  useEffect(() => {
    let isCancelled = false;
    const loadFirstBatch = async () => {
      setLoading(true);
      setStart(0);
      const res = await fetchDoubanCatalog(type, selectedTag, PAGE_SIZE, 0);
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
  }, [type, selectedTag]);

  // Load next batch
  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextStart = items.length;
    const res = await fetchDoubanCatalog(type, selectedTag, PAGE_SIZE, nextStart);

    if (res.length > 0) {
      setItems((prev) => {
        const existingIds = new Set(prev.map((i) => i.id));
        const filteredNew = res.filter((i) => !existingIds.has(i.id));
        return [...prev, ...filteredNew];
      });
      setStart(nextStart);
      setHasMore(res.length >= PAGE_SIZE);
    } else {
      setHasMore(false);
    }
    setLoadingMore(false);
  }, [type, selectedTag, items.length, loading, loadingMore, hasMore]);

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

  const handleSelectTag = (tagId: string) => {
    if (tagId !== selectedTag) {
      setSelectedTag(tagId);
    }
  };

  return (
    <div className="pt-20 sm:pt-24 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto min-h-screen">
      {/* Optional Top Slot (e.g. Bangumi calendar for Anime) */}
      {headerSlot}

      {/* Catalog Title & Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl sm:text-4xl font-black flex items-center">
            {title}
            {badge && (
              <span className="ml-3 text-xs bg-[#E50914] text-white px-2 py-0.5 rounded font-mono">
                {badge}
              </span>
            )}
          </h1>
        </div>
        <p className="text-sm text-gray-400 mb-4">{subtitle}</p>

        {/* Tag Filters */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/10">
          {tags.map((t) => {
            const isActive = selectedTag === t.id;
            return (
              <button
                key={t.id}
                onClick={() => handleSelectTag(t.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-[#E50914] text-white shadow-md'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-28 text-gray-400">
          <Loader2 className="w-10 h-10 animate-spin text-[#E50914] mb-3" />
          <p className="text-sm">正在加载精彩影视...</p>
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

          {/* Infinite Scroll Sentinel */}
          <div ref={sentinelRef} className="py-12 flex justify-center items-center text-gray-500 text-xs">
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
          <p className="text-lg mb-2">暂无该分类内容</p>
          <p className="text-sm text-gray-500">建议尝试点击其他分类标签。</p>
        </div>
      )}
    </div>
  );
};
