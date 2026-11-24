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
      {/* Row Header (Authentic Netflix Typography & Explore Link) */}
      <div className="flex items-center justify-between mb-2 sm:mb-3">
        <h2
          onClick={onExplore}
          className={`text-lg sm:text-xl md:text-2xl font-bold text-[#e5e5e5] hover:text-white tracking-wide transition-colors flex items-baseline group/header ${
            onExplore ? 'cursor-pointer' : ''
          }`}
        >
          <span>{title}</span>
          {onExplore && (
            <span className="text-xs sm:text-sm text-[#54b9c5] font-semibold ml-2.5 opacity-0 group-hover/header:opacity-100 group-hover/header:translate-x-1 transition-all inline-flex items-center">
              {t('exploreAll')} &gt;
            </span>
          )}
        </h2>
      </div>

      {/* Row Carousel */}
      <div className="relative">
        {/* Left Chevron Handle (Authentic Netflix Full-Height Slider Handle) */}
        {showLeftArrow && (
          <button
            onClick={() => scroll('left')}
            className="hidden sm:flex absolute left-0 top-0 bottom-0 z-30 w-10 sm:w-12 bg-black/60 hover:bg-black/85 items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all cursor-pointer rounded-r-[4px]"
            aria-label="向左滚动"
          >
            <ChevronLeft className="w-8 h-8 hover:scale-125 transition-transform" />
          </button>
        )}

        {/* Scrollable Container */}
        <div
          ref={rowRef}
          onScroll={handleScroll}
          className="flex items-center space-x-2.5 sm:space-x-3.5 overflow-x-auto no-scrollbar scroll-smooth py-3"
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

        {/* Right Chevron Handle (Authentic Netflix Full-Height Slider Handle) */}
        {showRightArrow && (
          <button
            onClick={() => scroll('right')}
            className="hidden sm:flex absolute right-0 top-0 bottom-0 z-30 w-10 sm:w-12 bg-black/60 hover:bg-black/85 items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all cursor-pointer rounded-l-[4px]"
            aria-label="向右滚动"
          >
            <ChevronRight className="w-8 h-8 hover:scale-125 transition-transform" />
          </button>
        )}
      </div>
    </div>
  );
};
