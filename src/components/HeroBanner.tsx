import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Play, Info, Plus, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { MediaItem } from '../types';
import { useI18n } from '../i18n';
import { prefetchVideo, hasValidCover } from '../services/api';

interface HeroBannerProps {
  movies?: MediaItem[];
  movie?: MediaItem | null;
  onPlay: (movie: MediaItem) => void;
  onOpenDetail: (movie: MediaItem) => void;
  watchlistIds?: Set<string>;
  isFavorite?: boolean;
  onToggleFavorite: (movie: MediaItem) => void;
}

// Automatically ensure image URLs use high-definition Douban posters
const getHighResCover = (url?: string): string => {
  if (!url) {
    return 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=1600&auto=format&fit=crop&q=80';
  }
  return url
    .replace('/s_ratio_poster/', '/l_ratio_poster/')
    .replace('/m_ratio_poster/', '/l_ratio_poster/')
    .replace('/photo/s/', '/photo/l/')
    .replace('/photo/m/', '/photo/l/');
};

export const HeroBanner: React.FC<HeroBannerProps> = ({
  movies,
  movie,
  onPlay,
  onOpenDetail,
  watchlistIds,
  isFavorite: directFavorite,
  onToggleFavorite,
}) => {
  const { t } = useI18n();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartRef = useRef<number | null>(null);

  // Normalize list of featured movies - items with valid covers are prioritized first
  const displayMovies = (movies && movies.length > 0 ? movies : movie ? [movie] : [])
    .filter(Boolean)
    .sort((a, b) => {
      const aHas = hasValidCover(a.cover) ? 1 : 0;
      const bHas = hasValidCover(b.cover) ? 1 : 0;
      return bHas - aHas;
    }) as MediaItem[];

  // Keep index in valid bounds
  const safeIndex = displayMovies.length > 0 ? currentIndex % displayMovies.length : 0;
  const activeMovie = displayMovies[safeIndex];

  // Prefetch video streams for instant playback
  useEffect(() => {
    if (!activeMovie?.title) return;
    prefetchVideo(activeMovie.title);

    // Also prefetch next slide candidate
    if (displayMovies.length > 1) {
      const nextMovie = displayMovies[(safeIndex + 1) % displayMovies.length];
      if (nextMovie?.title) {
        prefetchVideo(nextMovie.title);
      }
    }
  }, [safeIndex, activeMovie, displayMovies]);

  // Next / Prev slide handlers
  const handleNext = useCallback(() => {
    if (displayMovies.length <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % displayMovies.length);
  }, [displayMovies.length]);

  const handlePrev = useCallback(() => {
    if (displayMovies.length <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + displayMovies.length) % displayMovies.length);
  }, [displayMovies.length]);

  // Netflix-style auto carousel (every 7 seconds, pauses on hover / interaction)
  useEffect(() => {
    if (displayMovies.length <= 1 || isPaused) return;

    const timer = setInterval(() => {
      handleNext();
    }, 7000);

    return () => clearInterval(timer);
  }, [displayMovies.length, isPaused, handleNext]);

  // Mobile Touch Gestures for horizontal swiping
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = e.touches[0].clientX;
    setIsPaused(true);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartRef.current === null) return;
    const diff = touchStartRef.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) {
        handleNext();
      } else {
        handlePrev();
      }
    }
    touchStartRef.current = null;
    setIsPaused(false);
  };

  if (!activeMovie) {
    return (
      <div className="relative h-[65vh] sm:h-[80vh] w-full bg-[#181818] animate-pulse flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#E50914] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isFav =
    watchlistIds && activeMovie
      ? watchlistIds.has(activeMovie.id)
      : directFavorite !== undefined
      ? directFavorite
      : false;

  return (
    <div
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="group relative h-[65vh] sm:h-[75vh] md:h-[85vh] w-full select-none overflow-hidden"
    >
      {/* Background Poster Stack with Smooth Cross-Fade and Cinematic Zoom */}
      <div className="absolute inset-0">
        {displayMovies.map((item, idx) => {
          const isCurrent = idx === safeIndex;
          const bgUrl = getHighResCover(item.cover);

          return (
            <div
              key={item.id || idx}
              className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                isCurrent ? 'opacity-100 z-0 pointer-events-auto' : 'opacity-0 -z-10 pointer-events-none'
              }`}
            >
              <img
                src={bgUrl}
                alt={item.title}
                className={`w-full h-full object-cover object-center filter brightness-[0.78] transition-transform duration-[7000ms] ease-out ${
                  isCurrent ? 'scale-105' : 'scale-100'
                }`}
              />
            </div>
          );
        })}

        {/* Cinematic Netflix Gradients */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/60 to-transparent w-full md:w-4/5" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-[#141414]/30 to-transparent" />
      </div>

      {/* Hero Content with Smooth Slide Transition */}
      <div
        key={activeMovie.id}
        className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex flex-col justify-end pb-16 sm:pb-24 max-w-2xl animate-in fade-in slide-in-from-bottom-2 duration-500"
      >
        {/* Netflix Original / Series Pill */}
        <div className="flex items-center space-x-2 mb-3">
          <span className="text-[#E50914] font-black tracking-widest text-xs uppercase bg-black/60 px-2.5 py-0.5 rounded border border-[#E50914]/40 shadow">
            {t('featured')}
          </span>
          {activeMovie.rate && (
            <span className="text-yellow-400 font-bold text-xs bg-black/60 px-2 py-0.5 rounded border border-yellow-400/40">
              ★ {activeMovie.rate}
            </span>
          )}
          {activeMovie.remarks && (
            <span className="text-xs text-gray-300 bg-white/10 px-2 py-0.5 rounded font-mono">
              {activeMovie.remarks}
            </span>
          )}
        </div>

        {/* Title */}
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-white tracking-tight drop-shadow-2xl mb-3 sm:mb-4">
          {activeMovie.title}
        </h1>

        {/* Synopsis / Remarks */}
        <p className="text-sm sm:text-base text-gray-300 line-clamp-3 mb-6 drop-shadow leading-relaxed">
          {activeMovie.overview ||
            activeMovie.remarks ||
            `${activeMovie.title} - NETFLEX 精选热门作品，现已同步上线。`}
        </p>

        {/* Action Buttons */}
        <div className="flex items-center space-x-3 sm:space-x-4">
          <button
            onClick={() => onPlay(activeMovie)}
            className="flex items-center justify-center bg-white hover:bg-white/90 text-black font-bold px-6 sm:px-8 py-2.5 sm:py-3 rounded-md transition-transform duration-200 hover:scale-105 active:scale-95 shadow-xl text-sm sm:text-base cursor-pointer"
          >
            <Play className="w-5 h-5 mr-2 fill-black" />
            {t('play')}
          </button>

          <button
            onClick={() => onOpenDetail(activeMovie)}
            className="flex items-center justify-center bg-gray-600/70 hover:bg-gray-600/90 text-white font-semibold px-5 sm:px-7 py-2.5 sm:py-3 rounded-md backdrop-blur-md transition-transform duration-200 hover:scale-105 active:scale-95 shadow-xl text-sm sm:text-base cursor-pointer"
          >
            <Info className="w-5 h-5 mr-2" />
            {t('moreInfo')}
          </button>

          <button
            onClick={() => onToggleFavorite(activeMovie)}
            className="p-2.5 sm:p-3 rounded-full border-2 border-white/40 hover:border-white bg-black/40 hover:bg-black/60 transition-all text-white cursor-pointer hover:scale-105 active:scale-95"
            title={isFav ? t('removeFromList') : t('addToList')}
          >
            {isFav ? <Check className="w-5 h-5 text-[#E50914]" /> : <Plus className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Left Navigation Chevron Button (Desktop Hover) */}
      {displayMovies.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handlePrev();
          }}
          aria-label="Previous Featured Movie"
          className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/40 hover:bg-black/80 text-white/70 hover:text-white flex items-center justify-center backdrop-blur-md border border-white/10 opacity-0 group-hover:opacity-100 transition-all hover:scale-110 active:scale-95 cursor-pointer shadow-2xl"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}

      {/* Right Navigation Chevron Button (Desktop Hover) */}
      {displayMovies.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleNext();
          }}
          aria-label="Next Featured Movie"
          className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/40 hover:bg-black/80 text-white/70 hover:text-white flex items-center justify-center backdrop-blur-md border border-white/10 opacity-0 group-hover:opacity-100 transition-all hover:scale-110 active:scale-95 cursor-pointer shadow-2xl"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}

      {/* Bottom Right Controls: Rating Badge & Netflix-Style Carousel Dots */}
      <div className="absolute right-4 sm:right-8 bottom-16 sm:bottom-24 z-20 flex items-center space-x-3 sm:space-x-4">
        {/* Carousel Indicators */}
        {displayMovies.length > 1 && (
          <div className="flex items-center space-x-1.5 sm:space-x-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
            {displayMovies.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                aria-label={`Go to featured movie ${idx + 1}`}
                className={`transition-all duration-300 rounded-full cursor-pointer ${
                  idx === safeIndex
                    ? 'w-6 sm:w-8 h-1.5 sm:h-2 bg-[#E50914] shadow-[0_0_8px_rgba(229,9,20,0.8)]'
                    : 'w-1.5 sm:w-2 h-1.5 sm:h-2 bg-white/40 hover:bg-white/80'
                }`}
              />
            ))}
          </div>
        )}

        {/* Age Rating Badge */}
        <div className="hidden sm:flex items-center bg-black/60 backdrop-blur-md border-l-4 border-white/80 py-1 px-3 text-xs font-semibold text-gray-200">
          {t('ratingBadge')}
        </div>
      </div>
    </div>
  );
};
