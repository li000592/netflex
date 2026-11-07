import React, { useState, useEffect } from 'react';
import { Search, Loader2, Sparkles, ChevronLeft, ChevronRight, Flower2 } from 'lucide-react';
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
  const [pageCount, setPageCount] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);

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

  useEffect(() => {
    let isCancelled = false;
    const load = async () => {
      setLoading(true);
      const res = await fetchHuakaiCatalog(page, selectedType, keyword);
      if (!isCancelled) {
        setItems(res.items);
        setPageCount(res.pagecount || 1);
        setTotalCount(res.total || 0);
        setLoading(false);
      }
    };
    load();
    return () => {
      isCancelled = true;
    };
  }, [page, selectedType, keyword]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setKeyword(searchInput.trim());
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setKeyword('');
    setPage(1);
  };

  const handleSelectCategory = (typeId?: number) => {
    setSelectedType(typeId);
    setPage(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pageCount) {
      setPage(newPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="pt-20 sm:pt-24 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto min-h-screen">
      {/* Header Banner */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl sm:text-4xl font-black mb-2 flex items-center">
              <span className="text-[#E50914] mr-2">
                <Flower2 className="w-7 h-7 sm:w-9 sm:h-9 inline" />
              </span>
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
              共 {totalCount} 部影片
            </span>
          )}
        </div>
      </div>

      {/* Video Grid or Loader */}
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

          {/* Pagination Controls */}
          <div className="flex items-center justify-center space-x-3 mt-12 pt-6 border-t border-white/10">
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 1}
              className={`flex items-center px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                page <= 1
                  ? 'bg-white/5 text-gray-600 cursor-not-allowed'
                  : 'bg-white/10 text-white hover:bg-[#E50914]'
              }`}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              {t('prevPage')}
            </button>

            <span className="text-xs text-gray-400 font-mono px-3">
              {t('pageIndicator')} <span className="text-white font-bold">{page}</span> / {pageCount}
            </span>

            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= pageCount}
              className={`flex items-center px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                page >= pageCount
                  ? 'bg-white/5 text-gray-600 cursor-not-allowed'
                  : 'bg-white/10 text-white hover:bg-[#E50914]'
              }`}
            >
              {t('nextPage')}
              <ChevronRight className="w-4 h-4 ml-1" />
            </button>
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
