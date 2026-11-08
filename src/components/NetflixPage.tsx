import React, { useState, useEffect } from 'react';
import { Flame, Calendar, Trophy, Globe2, Loader2, Sparkles, Film, Tv, BarChart3 } from 'lucide-react';
import { MediaItem } from '../types';
import { useI18n } from '../i18n';
import { fetchNetflixCatalog, NetflixCatalogItem } from '../services/api';
import { MovieCard } from './MovieCard';

interface NetflixPageProps {
  onPlay: (movie: MediaItem) => void;
  onOpenDetail: (movie: MediaItem) => void;
  watchlistIds: Set<string>;
  onToggleFavorite: (movie: MediaItem) => void;
}

export const NetflixPage: React.FC<NetflixPageProps> = ({
  onPlay,
  onOpenDetail,
  watchlistIds,
  onToggleFavorite,
}) => {
  const { t } = useI18n();
  const [mode, setMode] = useState<'weekly' | 'popular'>('weekly');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [items, setItems] = useState<NetflixCatalogItem[]>([]);
  const [week, setWeek] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setLoading(true);
      const res = await fetchNetflixCatalog(mode, selectedCategory);
      if (isMounted) {
        setItems(res.items);
        if (res.week) setWeek(res.week);
        setLoading(false);
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, [mode, selectedCategory]);

  const categories = [
    { id: 'all', label: t('allCategories'), icon: <Globe2 className="w-3.5 h-3.5 mr-1.5" /> },
    { id: 'films_en', label: t('filmsEn'), icon: <Film className="w-3.5 h-3.5 mr-1.5" /> },
    { id: 'films_non_en', label: t('filmsNonEn'), icon: <Film className="w-3.5 h-3.5 mr-1.5" /> },
    { id: 'tv_en', label: t('tvEn'), icon: <Tv className="w-3.5 h-3.5 mr-1.5" /> },
    { id: 'tv_non_en', label: t('tvNonEn'), icon: <Tv className="w-3.5 h-3.5 mr-1.5" /> },
  ];

  return (
    <div className="min-h-screen pt-20 sm:pt-24 pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-red-950/60 via-black to-zinc-900/60 border border-red-500/20 p-6 sm:p-10 mb-8 shadow-2xl">
        <div className="relative z-10 max-w-3xl">
          <div className="flex items-center space-x-2.5 mb-3">
            <span className="bg-[#E50914] text-white text-xs font-black px-2.5 py-0.5 rounded tracking-widest uppercase shadow-md">
              Netflix
            </span>
            <span className="text-xs text-gray-400 font-mono flex items-center">
              <BarChart3 className="w-3.5 h-3.5 mr-1 text-[#E50914]" />
              {t('officialNetflixData')}
            </span>
            {week && mode === 'weekly' && (
              <span className="hidden sm:inline-block text-[11px] bg-white/10 text-gray-300 px-2 py-0.5 rounded font-mono">
                Week: {week}
              </span>
            )}
          </div>

          <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight mb-2 flex items-center">
            <Flame className="w-7 h-7 sm:w-9 sm:h-9 text-[#E50914] mr-2 flex-shrink-0 animate-pulse" />
            {t('netflixPortalTitle')}
          </h1>
          <p className="text-sm sm:text-base text-gray-300 leading-relaxed max-w-2xl">
            {t('netflixPortalSub')}
          </p>

          {/* Mode Tabs (Weekly Top 10 vs All-Time Most Popular) */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              onClick={() => setMode('weekly')}
              className={`flex items-center px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer ${
                mode === 'weekly'
                  ? 'bg-[#E50914] text-white shadow-lg shadow-red-900/40 scale-105'
                  : 'bg-white/10 hover:bg-white/15 text-gray-300 hover:text-white border border-white/10'
              }`}
            >
              <Calendar className="w-4 h-4 mr-1.5" />
              {t('weeklyTop10')}
            </button>

            <button
              onClick={() => setMode('popular')}
              className={`flex items-center px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer ${
                mode === 'popular'
                  ? 'bg-[#E50914] text-white shadow-lg shadow-red-900/40 scale-105'
                  : 'bg-white/10 hover:bg-white/15 text-gray-300 hover:text-white border border-white/10'
              }`}
            >
              <Trophy className="w-4 h-4 mr-1.5" />
              {t('mostPopularAllTime')}
            </button>
          </div>
        </div>

        {/* Decorative Netflix N watermark */}
        <div className="absolute right-4 -bottom-6 select-none pointer-events-none opacity-10 text-[180px] font-black text-[#E50914] leading-none">
          N
        </div>
      </div>

      {/* Category Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-4 mb-6">
        {categories.map((cat) => {
          const isActive = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex items-center px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all duration-200 whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-white text-black font-extrabold shadow-md scale-105'
                  : 'bg-[#1e1e1e] hover:bg-[#282828] text-gray-300 hover:text-white border border-white/10'
              }`}
            >
              {cat.icon}
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Main Grid Content */}
      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center space-y-4">
          <Loader2 className="w-10 h-10 text-[#E50914] animate-spin" />
          <p className="text-sm text-gray-400 font-medium">Loading Netflix Top 10 data...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="py-20 text-center text-gray-400">
          <p className="text-base">{t('noCategoryContent')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-4 gap-y-8 sm:gap-x-6 sm:gap-y-10">
          {items.map((item, index) => {
            const isFav = watchlistIds.has(item.id);
            return (
              <div key={item.id} className="flex flex-col space-y-2">
                <MovieCard
                  movie={item}
                  rank={item.rank}
                  onPlay={onPlay}
                  onOpenDetail={onOpenDetail}
                  isFavorite={isFav}
                  onToggleFavorite={onToggleFavorite}
                  className="w-full"
                />

                {/* Netflix Metadata Stats Pill */}
                <div className="flex flex-col space-y-1 pt-1">
                  <div className="flex items-center justify-between text-[11px] text-gray-400">
                    <span className="font-semibold text-white/90 truncate mr-1">
                      {item.netflixCategory}
                    </span>
                    {item.season && (
                      <span className="text-[10px] text-gray-400 truncate max-w-[90px]">
                        {item.season}
                      </span>
                    )}
                  </div>

                  {item.viewsFormatted && (
                    <div className="flex items-center text-[10px] text-red-400 font-mono font-medium">
                      <span>{item.viewsFormatted}</span>
                      {item.cumulativeWeeks !== undefined && (
                        <span className="ml-1.5 text-gray-500">• 在榜 {item.cumulativeWeeks} 周</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
