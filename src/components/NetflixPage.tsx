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
  const [viewMode, setViewMode] = useState<'landscape' | 'portrait'>('landscape');
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

      {/* Category Filter Chips & View Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-6">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
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

        {/* 16:9 Landscape vs 2:3 Portrait Aspect Ratio Switcher */}
        <div className="flex items-center self-end sm:self-auto space-x-1.5 bg-[#181818] p-1 rounded-xl border border-white/10 flex-shrink-0">
          <button
            onClick={() => setViewMode('landscape')}
            title="宽屏海报 (16:9)"
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center transition-all cursor-pointer ${
              viewMode === 'landscape'
                ? 'bg-[#E50914] text-white shadow-md font-bold'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Film className="w-3.5 h-3.5 mr-1.5" />
            16:9 宽屏
          </button>
          <button
            onClick={() => setViewMode('portrait')}
            title="竖版海报 (2:3)"
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center transition-all cursor-pointer ${
              viewMode === 'portrait'
                ? 'bg-[#E50914] text-white shadow-md font-bold'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Tv className="w-3.5 h-3.5 mr-1.5" />
            2:3 竖版
          </button>
        </div>
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
      ) : selectedCategory === 'all' ? (
        /* Grouped Sections When "All" is Selected */
        <div className="space-y-14">
          {[
            {
              id: 'films_en',
              label: t('filmsEn'),
              icon: <Film className="w-5 h-5 text-[#E50914]" />,
              desc: mode === 'weekly' ? '本周英语电影前十' : '历史最受欢迎英语电影',
            },
            {
              id: 'films_non_en',
              label: t('filmsNonEn'),
              icon: <Globe2 className="w-5 h-5 text-[#E50914]" />,
              desc: mode === 'weekly' ? '本周非英语电影前十' : '历史最受欢迎非英语电影',
            },
            {
              id: 'tv_en',
              label: t('tvEn'),
              icon: <Tv className="w-5 h-5 text-[#E50914]" />,
              desc: mode === 'weekly' ? '本周英语剧集前十' : '历史最受欢迎英语剧集',
            },
            {
              id: 'tv_non_en',
              label: t('tvNonEn'),
              icon: <Sparkles className="w-5 h-5 text-[#E50914]" />,
              desc: mode === 'weekly' ? '本周非英语剧集前十' : '历史最受欢迎非英语剧集',
            },
          ].map((sec) => {
            const sectionItems = items.filter((it) => it.catKey === sec.id);
            if (sectionItems.length === 0) return null;
            return (
              <div key={sec.id} className="space-y-5">
                {/* Section Header */}
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center space-x-2.5">
                    {sec.icon}
                    <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                      {sec.label} Top 10
                    </h2>
                    <span className="hidden sm:inline-block text-xs text-gray-400 font-normal ml-2">
                      ({sec.desc})
                    </span>
                  </div>

                  <button
                    onClick={() => setSelectedCategory(sec.id)}
                    className="text-xs sm:text-sm font-semibold text-gray-400 hover:text-white transition-colors cursor-pointer flex items-center group/btn"
                  >
                    <span>查看完整</span>
                    <span className="ml-1 group-hover/btn:translate-x-0.5 transition-transform">→</span>
                  </button>
                </div>

                {/* Section Grid */}
                <div
                  className={
                    viewMode === 'landscape'
                      ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-10'
                      : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-4 gap-y-8 sm:gap-x-6 sm:gap-y-10'
                  }
                >
                  {sectionItems.map((item) => {
                    const isFav = watchlistIds.has(item.id);
                    return (
                      <div key={item.id} className="flex flex-col space-y-2 group">
                        <MovieCard
                          movie={item}
                          rank={item.rank}
                          aspectRatio={viewMode === 'landscape' ? 'video' : 'poster'}
                          hideTitleBelow={true}
                          onPlay={onPlay}
                          onOpenDetail={onOpenDetail}
                          isFavorite={isFav}
                          onToggleFavorite={onToggleFavorite}
                          className="w-full"
                        />

                        {/* Netflix Metadata & Explicit Title */}
                        <div className="flex flex-col space-y-1 pt-1">
                          <h3
                            onClick={() => onOpenDetail(item)}
                            className="font-bold text-sm sm:text-base text-white line-clamp-1 group-hover:text-[#E50914] cursor-pointer transition-colors leading-snug"
                            title={item.title}
                          >
                            {item.title}
                          </h3>

                          <div className="flex items-center justify-between text-xs text-gray-400">
                            <div className="flex items-center space-x-1.5 min-w-0">
                              <span className="text-white/80 font-medium text-[11px] truncate">
                                {item.netflixCategory}
                              </span>
                              {item.season && (
                                <span className="text-[10px] bg-white/10 text-gray-300 px-1.5 py-0.5 rounded font-mono truncate">
                                  {item.season}
                                </span>
                              )}
                            </div>

                            {item.viewsFormatted && (
                              <div className="flex items-center text-[11px] text-red-400 font-mono font-medium flex-shrink-0 ml-2">
                                <span>{item.viewsFormatted}</span>
                                {item.cumulativeWeeks !== undefined && (
                                  <span className="ml-1 text-gray-500 font-sans text-[10px]">
                                    • {item.cumulativeWeeks}周
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Synopsis snippet in landscape mode */}
                          {viewMode === 'landscape' && item.overview && (
                            <p
                              onClick={() => onOpenDetail(item)}
                              className="text-xs text-gray-400 line-clamp-2 leading-relaxed pt-0.5 cursor-pointer hover:text-gray-300 transition-colors"
                            >
                              {item.overview}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Single Selected Category Grid */
        <div
          className={
            viewMode === 'landscape'
              ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-10'
              : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-4 gap-y-8 sm:gap-x-6 sm:gap-y-10'
          }
        >
          {items.map((item) => {
            const isFav = watchlistIds.has(item.id);
            return (
              <div key={item.id} className="flex flex-col space-y-2 group">
                <MovieCard
                  movie={item}
                  rank={item.rank}
                  aspectRatio={viewMode === 'landscape' ? 'video' : 'poster'}
                  hideTitleBelow={true}
                  onPlay={onPlay}
                  onOpenDetail={onOpenDetail}
                  isFavorite={isFav}
                  onToggleFavorite={onToggleFavorite}
                  className="w-full"
                />

                {/* Netflix Metadata & Explicit Title */}
                <div className="flex flex-col space-y-1 pt-1">
                  <h3
                    onClick={() => onOpenDetail(item)}
                    className="font-bold text-sm sm:text-base text-white line-clamp-1 group-hover:text-[#E50914] cursor-pointer transition-colors leading-snug"
                    title={item.title}
                  >
                    {item.title}
                  </h3>

                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <div className="flex items-center space-x-1.5 min-w-0">
                      <span className="text-white/80 font-medium text-[11px] truncate">
                        {item.netflixCategory}
                      </span>
                      {item.season && (
                        <span className="text-[10px] bg-white/10 text-gray-300 px-1.5 py-0.5 rounded font-mono truncate">
                          {item.season}
                        </span>
                      )}
                    </div>

                    {item.viewsFormatted && (
                      <div className="flex items-center text-[11px] text-red-400 font-mono font-medium flex-shrink-0 ml-2">
                        <span>{item.viewsFormatted}</span>
                        {item.cumulativeWeeks !== undefined && (
                          <span className="ml-1 text-gray-500 font-sans text-[10px]">
                            • {item.cumulativeWeeks}周
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Synopsis snippet in landscape mode */}
                  {viewMode === 'landscape' && item.overview && (
                    <p
                      onClick={() => onOpenDetail(item)}
                      className="text-xs text-gray-400 line-clamp-2 leading-relaxed pt-0.5 cursor-pointer hover:text-gray-300 transition-colors"
                    >
                      {item.overview}
                    </p>
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
