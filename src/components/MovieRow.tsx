import React, { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { MediaItem } from '../types';
import { MovieCard } from './MovieCard';
import { useI18n } from '../i18n';

interface MovieRowProps {
  title: string;
  movies: MediaItem[];
  isTop10?: boolean;
  onPlay: (movie: MediaItem) => void;
  onOpenDetail: (movie: MediaItem) => void;
  watchlistIds: Set<string>;
  onToggleFavorite: (movie: MediaItem) => void;
  onExplore?: () => void;
}

export const MovieRow: React.FC<MovieRowProps> = ({
  title,
  movies,
  isTop10 = false,
  onPlay,
  onOpenDetail,
  watchlistIds,
  onToggleFavorite,
  onExplore,
}) => {
  const { t } = useI18n();
  const rowRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  if (!movies || movies.length === 0) return null;

  const handleScroll = () => {
    if (rowRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = rowRef.current;
      setShowLeftArrow(scrollLeft > 10);
      setShowRightArrow(scrollLeft + clientWidth < scrollWidth - 10);
    }
  };

  const scroll = (direction: 'left' | 'right') => {
    if (rowRef.current) {
      const { clientWidth } = rowRef.current;
      const scrollAmount = direction === 'left' ? -clientWidth * 0.75 : clientWidth * 0.75;
      rowRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <div className="relative group my-6 sm:my-8 px-4 sm:px-6 lg:px-8">
      {/* Row Header */}
      <div className="flex items-center justify-between mb-2 sm:mb-3">
        <h2
          onClick={onExplore}
          className={`text-lg sm:text-2xl font-bold text-white tracking-wide transition-colors flex items-center group/header ${
            onExplore ? 'cursor-pointer hover:text-[#E50914]' : ''
          }`}
        >
          <span>{title}</span>
          {onExplore && (
            <span className="text-xs text-gray-400 font-normal ml-3 inline-flex items-center group-hover/header:text-[#E50914] group-hover/header:translate-x-1 transition-all">
              {t('exploreAll')} &gt;
            </span>
          )}
        </h2>
      </div>

      {/* Row Carousel */}
      <div className="relative">
        {/* Left Chevron Button */}
        {showLeftArrow && (
          <button
            onClick={() => scroll('left')}
            className="hidden sm:flex absolute left-0 top-0 bottom-0 z-20 w-10 sm:w-12 bg-black/60 hover:bg-black/90 items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity rounded-r-md backdrop-blur-sm"
            aria-label="向左滚动"
          >
            <ChevronLeft className="w-8 h-8" />
          </button>
        )}

        {/* Scrollable Container */}
        <div
          ref={rowRef}
          onScroll={handleScroll}
          className="flex items-center space-x-3 sm:space-x-4 overflow-x-auto no-scrollbar scroll-smooth py-3"
        >
          {movies.map((movie, index) => (
            <MovieCard
              key={`${movie.id}_${index}`}
              movie={movie}
              rank={isTop10 ? index + 1 : undefined}
              onPlay={onPlay}
              onOpenDetail={onOpenDetail}
              isFavorite={watchlistIds.has(movie.id)}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </div>

        {/* Right Chevron Button */}
        {showRightArrow && (
          <button
            onClick={() => scroll('right')}
            className="hidden sm:flex absolute right-0 top-0 bottom-0 z-20 w-10 sm:w-12 bg-black/60 hover:bg-black/90 items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity rounded-l-md backdrop-blur-sm"
            aria-label="向右滚动"
          >
            <ChevronRight className="w-8 h-8" />
          </button>
        )}
      </div>
    </div>
  );
};
