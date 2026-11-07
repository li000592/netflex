import React, { useState } from 'react';
import { Play, Plus, Check, ChevronDown, Star } from 'lucide-react';
import { MediaItem } from '../types';
import { useI18n } from '../i18n';

interface MovieCardProps {
  movie: MediaItem;
  rank?: number;
  onPlay: (movie: MediaItem) => void;
  onOpenDetail: (movie: MediaItem) => void;
  isFavorite: boolean;
  onToggleFavorite: (movie: MediaItem) => void;
}

export const MovieCard: React.FC<MovieCardProps> = ({
  movie,
  rank,
  onPlay,
  onOpenDetail,
  isFavorite,
  onToggleFavorite,
}) => {
  const { t } = useI18n();
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="relative flex-none select-none transition-all duration-300"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-end">
        {/* Top 10 Rank Number if provided */}
        {rank !== undefined && (
          <span className="top-10-num -mr-6 sm:-mr-8 z-0 pointer-events-none drop-shadow-lg">
            {rank}
          </span>
        )}

        {/* Card Poster Container */}
        <div
          onClick={() => onOpenDetail(movie)}
          className={`relative z-10 w-32 sm:w-44 md:w-52 aspect-[2/3] rounded-md overflow-hidden bg-[#202020] cursor-pointer shadow-lg transition-transform duration-300 ${
            isHovered ? 'scale-105 shadow-2xl ring-2 ring-white/30' : ''
          }`}
        >
          {movie.cover ? (
            <img
              src={movie.cover}
              alt={movie.title}
              loading="lazy"
              className="w-full h-full object-cover transition-transform duration-500 hover:scale-110"
              onError={(e) => {
                // Fallback placeholder image if poster fails
                (e.target as HTMLImageElement).src =
                  'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400&fit=crop';
              }}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-[#252525]">
              <span className="text-[#E50914] font-black text-2xl mb-1">N</span>
              <span className="text-xs text-gray-300 font-medium line-clamp-3">{movie.title}</span>
            </div>
          )}

          {/* New / HD Badges */}
          <div className="absolute top-2 left-2 flex flex-col space-y-1">
            {movie.isNew && (
              <span className="bg-[#E50914] text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow">
                {t('newBadge')}
              </span>
            )}
            {movie.remarks && (
              <span className="bg-black/70 backdrop-blur-sm text-gray-200 text-[10px] font-semibold px-1.5 py-0.5 rounded border border-white/10 line-clamp-1 max-w-[100px]">
                {movie.remarks}
              </span>
            )}
          </div>

          {/* Bottom rating tag */}
          {movie.rate && (
            <div className="absolute bottom-2 right-2 flex items-center bg-black/80 backdrop-blur-sm px-1.5 py-0.5 rounded text-[11px] font-bold text-yellow-400 border border-yellow-500/20">
              <Star className="w-3 h-3 fill-yellow-400 mr-1 text-yellow-400" />
              {movie.rate}
            </div>
          )}

          {/* Quick Action Overlay on Hover (Desktop) */}
          <div
            className={`absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent p-3 flex flex-col justify-end transition-opacity duration-200 ${
              isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            <p className="text-white font-bold text-xs sm:text-sm line-clamp-1 mb-2">
              {movie.title}
            </p>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onPlay(movie);
                  }}
                  className="p-1.5 sm:p-2 bg-white hover:bg-[#E50914] hover:text-white text-black rounded-full transition-colors shadow"
                  title={t('play')}
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(movie);
                  }}
                  className="p-1.5 sm:p-2 bg-black/60 hover:bg-black/90 border border-white/30 text-white rounded-full transition-colors"
                  title={isFavorite ? t('removeFromList') : t('addToList')}
                >
                  {isFavorite ? <Check className="w-3.5 h-3.5 text-[#E50914]" /> : <Plus className="w-3.5 h-3.5" />}
                </button>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenDetail(movie);
                }}
                className="p-1.5 sm:p-2 bg-black/60 hover:bg-black/90 border border-white/30 text-white rounded-full transition-colors"
                title={t('moreInfo')}
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Title under card on mobile view */}
      <div className="sm:hidden mt-1.5 text-[11px] font-medium text-gray-300 truncate w-32">
        {movie.title}
      </div>
    </div>
  );
};
