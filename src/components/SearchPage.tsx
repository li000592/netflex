import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Loader2,
  Sparkles,
  Layers,
  ChevronDown,
  Check,
  X,
  Film,
  Flame,
  Clock,
  TrendingUp,
  Compass,
} from 'lucide-react';
import { MediaItem } from '../types';
import { searchVideos, sortMediaByCover } from '../services/api';
import { MovieCard } from './MovieCard';
import { VIDEO_SOURCES } from '../config/sources';
import { useI18n } from '../i18n';

interface SearchPageProps {
  initialQuery: string;
  onQueryChange?: (query: string) => void;
  onPlay: (movie: MediaItem) => void;
  onOpenDetail: (movie: MediaItem) => void;
  watchlistIds: Set<string>;
  onToggleFavorite: (movie: MediaItem) => void;
  huakaiEnabled?: boolean;
}

const TOP_SEARCH_ITEMS = [
  { rank: 1, title: '英雄联盟：双城之战', tag: 'Netflix 9.2' },
  { rank: 2, title: '权力的游戏', tag: 'HBO 经典' },
  { rank: 3, title: '怪奇物语', tag: 'Netflix 独家' },
  { rank: 4, title: '星际穿越', tag: '科幻神作' },
  { rank: 5, title: '进击的巨人', tag: '高分神作' },
  { rank: 6, title: '鬼灭之刃', tag: '人气新番' },
  { rank: 7, title: '绝命毒师', tag: '豆瓣 9.7' },
  { rank: 8, title: '黑镜', tag: '烧脑科幻' },
  { rank: 9, title: '海贼王', tag: '热血连载' },
  { rank: 10, title: '赛博朋克：边缘行者', tag: 'Trigger 燃作' },
];

const GENRE_COLLECTIONS = [
  {
    title: '🍿 豆瓣高分经典',
    desc: '历年殿堂级口碑电影与剧集',
    keyword: '高分',
    gradient: 'from-amber-600/40 via-yellow-900/30 to-black/80',
  },
  {
    title: '💥 4K 震撼好莱坞大片',
    desc: '科幻视觉特效与动作视听盛宴',
    keyword: '科幻',
    gradient: 'from-blue-600/40 via-indigo-950/30 to-black/80',
  },
  {
    title: '🌸 日本连载人气新番',
    desc: '每周日系动漫同步极速追更',
    keyword: '动漫',
    gradient: 'from-pink-600/40 via-rose-950/30 to-black/80',
  },
  {
    title: '🕵️ 烧脑高分悬疑犯罪',
    desc: '剧情反转跌宕伏笔连连',
    keyword: '悬疑',
    gradient: 'from-emerald-600/40 via-teal-950/30 to-black/80',
  },
  {
    title: '🔴 奈飞海外爆款独播',
    desc: '欧美高分剧集与全球热播榜',
    keyword: '美剧',
    gradient: 'from-red-600/40 via-rose-950/30 to-black/80',
  },
  {
    title: '📺 华语经典电视剧集',
    desc: '百看不厌的国民经典佳作',
    keyword: '国产剧',
    gradient: 'from-purple-600/40 via-violet-950/30 to-black/80',
  },
];

export const SearchPage: React.FC<SearchPageProps> = ({
  initialQuery,
  onQueryChange,
  onPlay,
  onOpenDetail,
  watchlistIds,
  onToggleFavorite,
  huakaiEnabled = false,
}) => {
  const { t } = useI18n();
  const [query, setQuery] = useState(initialQuery);
  const [selectedSource, setSelectedSource] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'default' | 'rating' | 'latest'>('default');
  const [results, setResults] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [sourceDropdownOpen, setSourceDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Recent Searches in LocalStorage
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('netflex_recent_searches');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const saveRecentSearch = (kw: string) => {
    const trimmed = kw.trim();
    if (!trimmed) return;
    setRecentSearches((prev) => {
      const filtered = prev.filter((item) => item.toLowerCase() !== trimmed.toLowerCase());
      const updated = [trimmed, ...filtered].slice(0, 8);
      try {
        localStorage.setItem('netflex_recent_searches', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    try {
      localStorage.removeItem('netflex_recent_searches');
    } catch {}
  };

  // Sync with initialQuery prop if it changes externally
  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setSourceDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Search API fetcher
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      const res = await searchVideos(query, selectedSource || undefined, selectedCategory, huakaiEnabled);
      setResults(res);
      setLoading(false);
      saveRecentSearch(query);
    }, 320);

    return () => clearTimeout(timer);
  }, [query, selectedSource, selectedCategory, huakaiEnabled]);

  // Reset huakai selection if mode turns off
  useEffect(() => {
    if (!huakaiEnabled) {
      if (selectedCategory === 'huakai') {
        setSelectedCategory('all');
      }
      const huakaiSourceIds = ['155zy', 'didi', 'yutu', 'lebo'];
      if (huakaiSourceIds.includes(selectedSource)) {
        setSelectedSource('');
      }
    }
  }, [huakaiEnabled, selectedCategory, selectedSource]);

  const handleUpdateQuery = (newQuery: string) => {
    setQuery(newQuery);
    if (onQueryChange) {
      onQueryChange(newQuery);
    }
  };

  const categories = [
    { id: 'all', label: t('allCategories') },
    { id: 'anime', label: t('catAnime') },
    { id: 'netflix', label: t('catNetflix') },
    { id: 'speed', label: t('catSpeed') },
    { id: 'general', label: t('catClassics') },
    ...(huakaiEnabled ? [{ id: 'huakai', label: t('catHuakai') }] : []),
  ];

  const filteredSources =
    selectedCategory === 'all'
      ? huakaiEnabled
        ? VIDEO_SOURCES
        : VIDEO_SOURCES.filter((s) => s.category !== 'huakai')
      : VIDEO_SOURCES.filter((s) => s.category === selectedCategory);

  const selectedSourceName =
    filteredSources.find((s) => s.id === selectedSource)?.name || t('smartRoute');

  const isHuakaiItem = (item: MediaItem) => {
    if (item.sourceCategory === 'huakai' || item.category === 'huakai' || item.category === '花开') return true;
    if (item.sourceId === '155zy' || item.sourceId === 'didi' || item.sourceId === 'yutu' || item.sourceId === 'lebo') return true;
    const adultRegex = /(伦理|倫理|理论片|情色|三级|福利|里番|无码|有码|麻豆|自拍|人妻|乱伦|性爱|色情|福利姬|调教|偷拍|探花|主播秀色|巨乳|萝莉|av解说|换脸|91制片|蜜桃影像|天美传媒|精东影业|星空无限|swag|糖心)/i;
    if (item.type_name && adultRegex.test(item.type_name)) return true;
    return false;
  };

  const baseResults = huakaiEnabled ? results : results.filter((m) => !isHuakaiItem(m));

  // Sorting
  const sortedResults = React.useMemo(() => {
    const list = [...baseResults];
    if (sortBy === 'rating') {
      list.sort((a, b) => {
        const rateA = parseFloat(a.rate || '0') || 0;
        const rateB = parseFloat(b.rate || '0') || 0;
        return rateB - rateA;
      });
    } else if (sortBy === 'latest') {
      list.sort((a, b) => {
        const yearA = parseInt(a.year || '0', 10) || 0;
        const yearB = parseInt(b.year || '0', 10) || 0;
        return yearB - yearA;
      });
    }
    return sortMediaByCover(list);
  }, [baseResults, sortBy]);

  return (
    <div className="min-h-screen safe-page-top pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Netflix Cinematic Search Ambient Header */}
      <div className="relative mb-8 pt-2 sm:pt-4">
        {/* Soft Radial Ambient Lighting */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-36 bg-gradient-to-b from-[#E50914]/10 via-[#E50914]/3 to-transparent blur-3xl pointer-events-none -z-10" />

        {/* Unified Search Input Container */}
        <div className="relative max-w-3xl mx-auto">
          <div className="relative flex items-center bg-[#181818]/90 backdrop-blur-xl border border-white/10 hover:border-white/25 focus-within:border-[#E50914] focus-within:ring-4 focus-within:ring-[#E50914]/20 rounded-full transition-all duration-300 shadow-2xl overflow-hidden px-4 sm:px-5 py-2.5 sm:py-3.5">
            <Search className="w-5 h-5 sm:w-6 sm:h-6 text-[#E50914] flex-shrink-0 transition-transform duration-300 group-focus-within:scale-110 mr-3" />
            <input
              type="text"
              value={query}
              onChange={(e) => handleUpdateQuery(e.target.value)}
              placeholder={t('searchTitle')}
              className="w-full bg-transparent text-white placeholder-gray-400 text-sm sm:text-base outline-none font-medium"
              autoFocus
            />
            {query && (
              <button
                onClick={() => handleUpdateQuery('')}
                className="flex items-center justify-center w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-colors ml-2 flex-shrink-0 text-xs"
                title={t('clearSearch')}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Filter Navigation Bar (Netflix Category Chips + Custom Source Selector) */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-4">
          {/* Netflix Pills */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            {categories.map((cat) => {
              const isActive = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    setSelectedCategory(cat.id);
                    setSelectedSource('');
                  }}
                  className={`px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-all duration-200 whitespace-nowrap ${
                    isActive
                      ? 'bg-white text-black font-extrabold shadow-lg scale-105'
                      : 'bg-[#222]/80 hover:bg-[#303030] text-gray-300 hover:text-white border border-white/5'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Custom Netflix Source Popover Dropdown */}
          <div className="relative ml-auto" ref={dropdownRef}>
            <button
              onClick={() => setSourceDropdownOpen(!sourceDropdownOpen)}
              className="flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-[#202020] hover:bg-[#282828] border border-white/10 hover:border-white/25 text-xs text-gray-200 hover:text-white transition-all shadow-md"
            >
              <Layers className="w-3.5 h-3.5 text-[#E50914]" />
              <span className="max-w-[120px] sm:max-w-[160px] truncate font-medium">
                {selectedSourceName}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${
                  sourceDropdownOpen ? 'rotate-180 text-white' : ''
                }`}
              />
            </button>

            {sourceDropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 max-h-72 overflow-y-auto bg-[#181818]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-50 py-2 custom-scrollbar animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-gray-400 font-bold border-b border-white/5 mb-1">
                  {t('smartRoute')}
                </div>
                <button
                  onClick={() => {
                    setSelectedSource('');
                    setSourceDropdownOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2 text-xs text-left transition-colors ${
                    selectedSource === ''
                      ? 'bg-[#E50914]/15 text-[#E50914] font-bold'
                      : 'text-gray-300 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span>{t('smartRoute')}</span>
                  {selectedSource === '' && <Check className="w-3.5 h-3.5 text-[#E50914]" />}
                </button>
                {filteredSources.map((s) => {
                  const isSelected = selectedSource === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => {
                        setSelectedSource(s.id);
                        setSourceDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3.5 py-2 text-xs text-left transition-colors ${
                        isSelected
                          ? 'bg-[#E50914]/15 text-[#E50914] font-bold'
                          : 'text-gray-300 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <span className="truncate mr-2">{s.name}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-[#E50914] flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Results or States */}
      {loading ? (
        /* Netflix Shimmer Loading Skeleton Grid */
        <div className="space-y-6">
          <div className="flex items-center space-x-2 text-gray-400 text-xs sm:text-sm">
            <Loader2 className="w-4 h-4 animate-spin text-[#E50914]" />
            <span>
              {t('searchingNodes')} 「{query}」
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 md:gap-5">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="w-full aspect-[2/3] rounded-md bg-gradient-to-br from-[#1a1a1a] via-[#242424] to-[#181818] animate-pulse border border-white/5 flex flex-col justify-between p-3 relative overflow-hidden"
              >
                <div className="w-full flex justify-between items-center">
                  <span className="w-10 h-3 bg-white/10 rounded" />
                  <span className="w-6 h-3 bg-white/10 rounded" />
                </div>
                <div className="absolute inset-0 flex items-center justify-center opacity-10">
                  <span className="text-[#E50914] font-black text-5xl">N</span>
                </div>
                <div className="space-y-1.5 z-10">
                  <div className="w-3/4 h-3 bg-white/20 rounded" />
                  <div className="w-1/2 h-2.5 bg-white/10 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : sortedResults.length > 0 ? (
        /* Netflix Search Results View */
        <div className="space-y-6">
          {/* Header Bar: "Explore titles related to: query" + Sort controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-4">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white flex items-center flex-wrap gap-2">
                <span className="text-gray-400 font-normal">{t('exploreTitlesRelatedTo')}</span>
                <span className="text-white border-b-2 border-[#E50914] pb-0.5 font-black">
                  {query}
                </span>
                <span className="text-xs bg-white/10 text-gray-300 px-2.5 py-0.5 rounded-full font-mono ml-1">
                  {sortedResults.length} {t('titlesFound')}
                </span>
              </h2>
            </div>

            {/* Quick Sorting Filter */}
            <div className="flex items-center space-x-1 bg-[#1c1c1c] p-1 rounded-lg border border-white/5 text-xs text-gray-400">
              <button
                onClick={() => setSortBy('default')}
                className={`px-2.5 py-1 rounded transition-colors ${
                  sortBy === 'default'
                    ? 'bg-[#2a2a2a] text-white font-bold shadow-sm'
                    : 'hover:text-white'
                }`}
              >
                {t('sortByDefault')}
              </button>
              <button
                onClick={() => setSortBy('rating')}
                className={`px-2.5 py-1 rounded transition-colors ${
                  sortBy === 'rating'
                    ? 'bg-[#2a2a2a] text-white font-bold shadow-sm'
                    : 'hover:text-white'
                }`}
              >
                {t('sortByRating')}
              </button>
              <button
                onClick={() => setSortBy('latest')}
                className={`px-2.5 py-1 rounded transition-colors ${
                  sortBy === 'latest'
                    ? 'bg-[#2a2a2a] text-white font-bold shadow-sm'
                    : 'hover:text-white'
                }`}
              >
                {t('sortByLatest')}
              </button>
            </div>
          </div>

          {/* Results Grid (using responsive full-width MovieCards) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 md:gap-5">
            {sortedResults.map((movie, idx) => (
              <div key={`${movie.id}_${idx}`} className="w-full flex justify-center">
                <MovieCard
                  movie={movie}
                  onPlay={onPlay}
                  onOpenDetail={onOpenDetail}
                  isFavorite={watchlistIds.has(movie.id)}
                  onToggleFavorite={onToggleFavorite}
                  className="w-full"
                />
              </div>
            ))}
          </div>
        </div>
      ) : query.trim() ? (
        /* Netflix Authentic "No Results" State */
        <div className="py-16 sm:py-24 max-w-xl mx-auto text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-[#1e1e1e] border border-white/10 flex items-center justify-center mx-auto text-[#E50914] shadow-xl">
            <Film className="w-8 h-8 opacity-80" />
          </div>

          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
              {t('noResults')} 「{query}」
            </h2>
            <p className="text-xs sm:text-sm text-gray-400">{t('noResultsSuggestion')}</p>
          </div>

          <div className="bg-[#181818]/80 border border-white/10 rounded-2xl p-5 text-left text-xs sm:text-sm space-y-2 text-gray-300">
            <p className="font-bold text-white text-sm mb-1">{t('noResultsSuggestionsTitle')}</p>
            <p className="flex items-start text-gray-400">
              <span className="text-[#E50914] mr-2">•</span>
              {t('noResultsTip1')}
            </p>
            <p className="flex items-start text-gray-400">
              <span className="text-[#E50914] mr-2">•</span>
              {t('noResultsTip2')}
            </p>
            <p className="flex items-start text-gray-400">
              <span className="text-[#E50914] mr-2">•</span>
              {t('noResultsTip3')}
            </p>
          </div>

          <div className="pt-2">
            <button
              onClick={() => handleUpdateQuery('')}
              className="bg-[#E50914] hover:bg-[#b80710] text-white font-bold text-xs sm:text-sm px-6 py-2.5 rounded-full transition-all shadow-lg hover:shadow-red-900/30"
            >
              {t('clearSearch')}
            </button>
          </div>

          {/* Quick Recommendations */}
          <div className="pt-8 border-t border-white/5">
            <p className="text-xs text-gray-400 font-semibold mb-3">{t('recommendedForYou')}</p>
            <div className="flex flex-wrap justify-center gap-2">
              {['Arcane', 'Stranger Things', 'Interstellar', 'Demon Slayer', 'Breaking Bad'].map(
                (item) => (
                  <button
                    key={item}
                    onClick={() => handleUpdateQuery(item)}
                    className="px-3.5 py-1.5 rounded-full bg-white/5 hover:bg-white/15 text-xs text-gray-300 hover:text-white transition-all border border-white/5"
                  >
                    {item}
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Netflix Empty Query State: Recent Searches + Top 10 Searches Today + Collections */
        <div className="space-y-12 pt-2">
          {/* 1. Recent Searches (if available) */}
          {recentSearches.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-gray-300">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <h3 className="text-sm font-bold text-white">{t('recentSearches')}</h3>
                </div>
                <button
                  onClick={clearRecentSearches}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {t('clearRecent')}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((kw) => (
                  <button
                    key={kw}
                    onClick={() => handleUpdateQuery(kw)}
                    className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full bg-[#1f1f1f] hover:bg-white/10 text-xs text-gray-200 hover:text-white transition-all border border-white/5 shadow"
                  >
                    <span>{kw}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 2. Netflix Top 10 Searches Today */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Flame className="w-5 h-5 text-[#E50914]" />
              <h3 className="text-base sm:text-lg font-black text-white tracking-wide">
                {t('topSearches')}
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {TOP_SEARCH_ITEMS.map((item) => (
                <button
                  key={item.rank}
                  onClick={() => handleUpdateQuery(item.title)}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-[#1c1c1c]/90 hover:bg-[#252525] border border-white/5 hover:border-white/20 transition-all duration-200 group text-left shadow-lg"
                >
                  <div className="flex items-center space-x-3 overflow-hidden">
                    <span
                      className={`text-xl font-black w-6 text-center ${
                        item.rank <= 3
                          ? 'text-[#E50914] drop-shadow-[0_2px_8px_rgba(229,9,20,0.5)]'
                          : 'text-gray-500 group-hover:text-gray-300'
                      }`}
                    >
                      {item.rank}
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-gray-200 group-hover:text-white truncate">
                      {item.title}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-gray-400 bg-white/5 px-2 py-0.5 rounded ml-2 flex-shrink-0">
                    {item.tag}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* 3. Netflix Curated Genre & Mood Collections */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Compass className="w-5 h-5 text-[#E50914]" />
              <h3 className="text-base sm:text-lg font-black text-white tracking-wide">
                {t('exploreGenres')}
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {GENRE_COLLECTIONS.map((col, idx) => (
                <div
                  key={idx}
                  onClick={() => handleUpdateQuery(col.keyword)}
                  className={`p-5 rounded-2xl bg-gradient-to-br ${col.gradient} border border-white/10 hover:border-white/30 cursor-pointer transition-all duration-300 hover:scale-[1.02] shadow-xl group relative overflow-hidden`}
                >
                  <div className="relative z-10 flex flex-col justify-between h-24">
                    <div>
                      <h4 className="text-base sm:text-lg font-black text-white group-hover:text-[#E50914] transition-colors">
                        {col.title}
                      </h4>
                      <p className="text-xs text-gray-300 mt-1 line-clamp-1">{col.desc}</p>
                    </div>
                    <div className="flex items-center text-xs font-bold text-white/80 group-hover:text-white group-hover:translate-x-1 transition-all">
                      <span>立即探索</span>
                      <span className="ml-1">→</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
