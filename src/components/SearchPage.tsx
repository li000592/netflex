import React, { useState, useEffect } from 'react';
import { Search, Filter, Loader2, Sparkles, Layers } from 'lucide-react';
import { MediaItem } from '../types';
import { searchVideos } from '../services/api';
import { MovieCard } from './MovieCard';
import { VIDEO_SOURCES } from '../config/sources';
import { useI18n } from '../i18n';

interface SearchPageProps {
  initialQuery: string;
  onPlay: (movie: MediaItem) => void;
  onOpenDetail: (movie: MediaItem) => void;
  watchlistIds: Set<string>;
  onToggleFavorite: (movie: MediaItem) => void;
}

export const SearchPage: React.FC<SearchPageProps> = ({
  initialQuery,
  onPlay,
  onOpenDetail,
  watchlistIds,
  onToggleFavorite,
}) => {
  const { t } = useI18n();
  const [query, setQuery] = useState(initialQuery);
  const [selectedSource, setSelectedSource] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [results, setResults] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      const res = await searchVideos(query, selectedSource || undefined);
      setResults(res);
      setLoading(false);
    }, 350);

    return () => clearTimeout(timer);
  }, [query, selectedSource]);

  const categories = [
    { id: 'all', label: t('allCategories') },
    { id: 'anime', label: t('catAnime') },
    { id: 'netflix', label: t('catNetflix') },
    { id: 'speed', label: t('catSpeed') },
    { id: 'general', label: t('catClassics') },
  ];

  const filteredSources =
    selectedCategory === 'all'
      ? VIDEO_SOURCES
      : VIDEO_SOURCES.filter((s) => s.category === selectedCategory);

  return (
    <div className="min-h-screen pt-24 sm:pt-28 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Search Header & Filter Controls */}
      <div className="mb-8 space-y-4">
        {/* Main Search Bar */}
        <div className="relative max-w-2xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('searchTitle')}
            className="w-full bg-[#202020] text-white pl-13 pr-10 py-3.5 sm:py-4 rounded-xl text-base sm:text-lg outline-none border border-white/10 focus:border-[#E50914] focus:ring-2 focus:ring-[#E50914]/40 transition-all placeholder-gray-500 shadow-2xl"
            autoFocus
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-sm"
            >
              ✕
            </button>
          )}
        </div>

        {/* Category Pills & Specific Source Selector */}
        <div className="flex flex-wrap items-center gap-2 pt-2">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                setSelectedCategory(cat.id);
                setSelectedSource('');
              }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                selectedCategory === cat.id
                  ? 'bg-[#E50914] text-white shadow-md'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              {cat.label}
            </button>
          ))}

          {/* Specific Source Dropdown */}
          <div className="flex items-center ml-auto">
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              className="bg-[#202020] text-gray-300 text-xs rounded-lg px-3 py-1.5 border border-white/10 outline-none focus:border-[#E50914]"
            >
              <option value="">{t('smartRoute')}</option>
              {filteredSources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Results Section */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-gray-400">
          <Loader2 className="w-10 h-10 animate-spin text-[#E50914] mb-3" />
          <p className="text-sm">
            {t('searchingFor')} 「{query}」...
          </p>
        </div>
      ) : results.length > 0 ? (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center">
              {t('searchResults')}
              <span className="text-xs bg-white/10 text-gray-300 ml-3 px-2 py-0.5 rounded-full font-mono">
                {results.length} {t('titlesFound')}
              </span>
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 md:gap-5">
            {results.map((movie, idx) => (
              <div key={`${movie.id}_${idx}`} className="flex justify-center">
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
        </div>
      ) : query.trim() ? (
        <div className="text-center py-24 text-gray-400">
          <p className="text-lg mb-2">
            {t('noResults')} 「{query}」
          </p>
          <p className="text-sm text-gray-500">{t('noResultsSuggestion')}</p>
        </div>
      ) : (
        /* Empty Query Suggestion Billboard */
        <div className="space-y-6 pt-4">
          <div className="flex items-center space-x-2 text-gray-400">
            <Sparkles className="w-4 h-4 text-[#E50914]" />
            <h3 className="text-sm font-semibold text-white">{t('popularSearches')}</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              'Arcane',
              'Game of Thrones',
              'Stranger Things',
              'Interstellar',
              'Attack on Titan',
              'Demon Slayer',
              'Breaking Bad',
              'Black Mirror',
              'One Piece',
              'Naruto',
            ].map((keyword) => (
              <button
                key={keyword}
                onClick={() => setQuery(keyword)}
                className="bg-white/5 hover:bg-[#E50914] hover:text-white text-gray-300 text-xs sm:text-sm px-4 py-2 rounded-lg transition-all border border-white/5"
              >
                {keyword}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
