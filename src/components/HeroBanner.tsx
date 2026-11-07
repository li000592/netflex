import React from 'react';
import { Play, Info, Plus, Check } from 'lucide-react';
import { MediaItem } from '../types';

interface HeroBannerProps {
  movie: MediaItem | null;
  onPlay: (movie: MediaItem) => void;
  onOpenDetail: (movie: MediaItem) => void;
  isFavorite: boolean;
  onToggleFavorite: (movie: MediaItem) => void;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({
  movie,
  onPlay,
  onOpenDetail,
  isFavorite,
  onToggleFavorite,
}) => {
  if (!movie) {
    return (
      <div className="relative h-[65vh] sm:h-[80vh] w-full bg-[#181818] animate-pulse flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#E50914] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Backdrop image or cover fallback
  const bgImage = movie.cover || 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=1600&auto=format&fit=crop&q=80';

  return (
    <div className="relative h-[65vh] sm:h-[75vh] md:h-[85vh] w-full select-none overflow-hidden">
      {/* Background Poster / Backdrop */}
      <div className="absolute inset-0">
        <img
          src={bgImage}
          alt={movie.title}
          className="w-full h-full object-cover object-center filter brightness-[0.8] scale-105 transition-transform duration-1000"
        />
        {/* Gradients */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/50 to-transparent w-full md:w-3/4" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-[#141414]/30 to-transparent" />
      </div>

      {/* Hero Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex flex-col justify-end pb-16 sm:pb-24 max-w-2xl">
        {/* Netflix Original / Series Pill */}
        <div className="flex items-center space-x-2 mb-3">
          <span className="text-[#E50914] font-black tracking-widest text-xs uppercase bg-black/40 px-2 py-0.5 rounded border border-[#E50914]/40">
            NETFLEX 首播
          </span>
          {movie.rate && (
            <span className="text-yellow-400 font-bold text-xs bg-black/60 px-2 py-0.5 rounded border border-yellow-400/40">
              ★ {movie.rate}
            </span>
          )}
          <span className="text-xs text-gray-300 bg-white/10 px-2 py-0.5 rounded font-mono">
            4K 超高清
          </span>
        </div>

        {/* Title */}
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-white tracking-tight drop-shadow-2xl mb-3 sm:mb-4">
          {movie.title}
        </h1>

        {/* Synopsis / Remarks */}
        <p className="text-sm sm:text-base text-gray-300 line-clamp-3 mb-6 drop-shadow leading-relaxed">
          {movie.overview || movie.remarks || `${movie.title} - 全网高分甄选，超清无缝流畅畅享。`}
        </p>

        {/* Action Buttons */}
        <div className="flex items-center space-x-3 sm:space-x-4">
          <button
            onClick={() => onPlay(movie)}
            className="flex items-center justify-center bg-white hover:bg-white/90 text-black font-bold px-6 sm:px-8 py-2.5 sm:py-3 rounded-md transition-transform duration-200 hover:scale-105 shadow-xl text-sm sm:text-base"
          >
            <Play className="w-5 h-5 mr-2 fill-black" />
            立即播放
          </button>

          <button
            onClick={() => onOpenDetail(movie)}
            className="flex items-center justify-center bg-gray-600/70 hover:bg-gray-600/90 text-white font-semibold px-5 sm:px-7 py-2.5 sm:py-3 rounded-md backdrop-blur-md transition-transform duration-200 hover:scale-105 shadow-xl text-sm sm:text-base"
          >
            <Info className="w-5 h-5 mr-2" />
            更多信息
          </button>

          <button
            onClick={() => onToggleFavorite(movie)}
            className="p-2.5 sm:p-3 rounded-full border-2 border-white/40 hover:border-white bg-black/40 hover:bg-black/60 transition-all text-white"
            title={isFavorite ? '从片单移除' : '加入我的片单'}
          >
            {isFavorite ? <Check className="w-5 h-5 text-[#E50914]" /> : <Plus className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Right side age rating badge */}
      <div className="absolute right-0 bottom-24 hidden sm:flex items-center bg-black/50 border-l-4 border-white/70 py-1 px-4 text-xs font-semibold text-gray-200">
        16+ 全网高分甄选
      </div>
    </div>
  );
};
