import React, { useState } from 'react';
import { Play, Plus, Check, ChevronDown, Star, ThumbsUp } from 'lucide-react';
import { MediaItem } from '../types';
import { useI18n } from '../i18n';
import { prefetchVideo, hasValidCover } from '../services/api';

interface MovieCardProps {
  movie: MediaItem;
  rank?: number;
  aspectRatio?: 'poster' | 'video';
  hideTitleBelow?: boolean;
  onPlay: (movie: MediaItem) => void;
  onOpenDetail: (movie: MediaItem) => void;
  isFavorite: boolean;
  onToggleFavorite: (movie: MediaItem) => void;
  className?: string;
}

export const MovieCard: React.FC<MovieCardProps> = ({
  movie,
  rank,
  aspectRatio = 'poster',
  hideTitleBelow = false,
  onPlay,
  onOpenDetail,
  isFavorite,
  onToggleFavorite,
  className = '',
}) => {
  const { t } = useI18n();
  const [isHovered, setIsHovered] = useState(false);
  const [imgSrc, setImgSrc] = useState(movie.cover);
  const [proxyAttempted, setProxyAttempted] = useState(false);
  const [imgError, setImgError] = useState(false);

  React.useEffect(() => {
    setImgSrc(movie.cover);
    setProxyAttempted(false);
    setImgError(false);
  }, [movie.cover]);

  const handleImageError = () => {
    if (
      !proxyAttempted &&
      movie.cover &&
      movie.cover.startsWith('http') &&
      !movie.cover.startsWith('/api/proxy/image')
    ) {
      setProxyAttempted(true);
      setImgSrc(`/api/proxy/image?url=${encodeURIComponent(movie.cover)}`);
    } else {
      setImgError(true);
    }
  };

  const canShowCover = hasValidCover(imgSrc) && !imgError;

  return (
    <div
      className={`relative select-none transition-all duration-300 ${
        className ? className : 'flex-none'
      }`}
      onMouseEnter={() => {
        setIsHovered(true);
        prefetchVideo(movie.title);
      }}
      onTouchStart={() => prefetchVideo(movie.title)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-end w-full">
        {/* Top 10 Rank Number if provided */}
        {rank !== undefined && (
          <span className="top-10-num -mr-6 sm:-mr-8 z-0 pointer-events-none drop-shadow-lg">
            {rank}
          </span>
        )}

        {/* Card Poster Container */}
        <div
          onClick={() => onOpenDetail(movie)}
          className={`relative z-10 ${
            className.includes('w-full') ? 'w-full flex-1 min-w-0' : 'w-32 sm:w-44 md:w-52'
          } ${
            aspectRatio === 'video' ? 'aspect-[16/9]' : 'aspect-[2/3]'
          } rounded-md overflow-hidden bg-[#202020] cursor-pointer shadow-lg transition-transform duration-300 ${
            isHovered ? 'scale-105 shadow-2xl ring-2 ring-white/30' : ''
          }`}
        >
          {canShowCover ? (
            <img
              src={imgSrc}
              alt={movie.title}
              loading="lazy"
              className="w-full h-full object-cover transition-transform duration-500 hover:scale-110"
              onError={handleImageError}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-[#252525]">
              <span className="text-[#E50914] font-black text-2xl mb-1">N</span>
              <span className="text-xs text-gray-300 font-medium line-clamp-3">{movie.title}</span>
            </div>
          )}

          {/* New / HD / Anime Badges */}
          <div className="absolute top-2 left-2 flex flex-col space-y-1">
            {movie.airDay ? (
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shadow flex items-center gap-0.5 ${
                (movie.airDay === ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][new Date().getDay()] ||
                 (movie.airWeekday && (movie.airWeekday % 7) === new Date().getDay()))
                  ? 'bg-red-600 text-white animate-pulse'
                  : 'bg-pink-600/90 text-white'
              }`}>
                <span>
                  {(movie.airDay === ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][new Date().getDay()] ||
                    (movie.airWeekday && (movie.airWeekday % 7) === new Date().getDay()))
                    ? '🔥 今日放送'
                    : `每周${movie.airDay.replace('周', '')}`}
                </span>
              </span>
            ) : movie.sourceCategory === 'anime' ? (
              <span className="bg-pink-600/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow flex items-center gap-0.5">
                <span>🌸</span>
                <span>动漫</span>
              </span>
            ) : null}
            {movie.isNew && (
              <span className="bg-[#E50914] text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow">
                {t('newBadge')}
              </span>
            )}
            {movie.remarks && (
              <span className="bg-black/70 backdrop-blur-sm text-gray-200 text-[10px] font-semibold px-1.5 py-0.5 rounded border border-white/10 line-clamp-1 max-w-[170px] sm:max-w-[220px]">
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

          {/* Authentic Netflix Mini Card Hover Action Overlay (Desktop) */}
          <div
            className={`absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent p-3 flex flex-col justify-end transition-opacity duration-200 z-20 ${
              isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            <p className="text-white font-bold text-xs sm:text-sm line-clamp-1 mb-2 drop-shadow">
              {movie.title}
            </p>

            {/* Circular Actions Row (Play, Add, Like, More Info) */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-1.5">
                {/* Netflix White Play Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onPlay(movie);
                  }}
                  className="w-8 h-8 rounded-full bg-white hover:bg-white/80 text-black flex items-center justify-center transition-transform hover:scale-110 shadow-lg cursor-pointer"
                  title={t('play')}
                >
                  <Play className="w-4 h-4 fill-black translate-x-0.5" />
                </button>

                {/* Add to List */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(movie);
                  }}
                  className="w-8 h-8 rounded-full bg-[#2a2a2a]/80 hover:bg-[#2a2a2a] border border-white/40 hover:border-white text-white flex items-center justify-center transition-all hover:scale-110 cursor-pointer"
                  title={isFavorite ? t('removeFromList') : t('addToList')}
                >
                  {isFavorite ? <Check className="w-4 h-4 text-[#E50914]" /> : <Plus className="w-4 h-4" />}
                </button>

                {/* Thumbs Up (Like) */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  className="w-8 h-8 rounded-full bg-[#2a2a2a]/80 hover:bg-[#2a2a2a] border border-white/40 hover:border-white text-white flex items-center justify-center transition-all hover:scale-110 cursor-pointer"
                  title="顶 / 喜欢"
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Expand Detail Modal */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenDetail(movie);
                }}
                className="w-8 h-8 rounded-full bg-[#2a2a2a]/80 hover:bg-[#2a2a2a] border border-white/40 hover:border-white text-white flex items-center justify-center transition-all hover:scale-110 cursor-pointer"
                title={t('moreInfo')}
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>

            {/* Netflix Meta Tags (98% Match, Age Rating, HD) */}
            <div className="flex items-center space-x-1.5 text-[10px] font-semibold">
              <span className="text-[#46d369] font-bold">
                {movie.rate ? `${Math.round(parseFloat(movie.rate) * 10)}% 匹配` : '98% 匹配'}
              </span>
              <span className="border border-white/30 text-gray-300 px-1 py-0.2 rounded-[2px]">
                16+
              </span>
              <span className="border border-white/30 text-gray-300 px-1 py-0.2 rounded-[2px] font-bold">
                HD
              </span>
            </div>

            {/* Tags / Remarks */}
            <p className="text-[10px] text-gray-300 line-clamp-1 mt-1 font-medium">
              {movie.remarks || movie.category || '精选 · 高清 · 秒播'}
            </p>
          </div>
        </div>
      </div>

      {/* Title under card on mobile view */}
      {!hideTitleBelow && (
        <div className="sm:hidden mt-1.5 text-[11px] font-medium text-gray-300 truncate w-32">
          {movie.title}
        </div>
      )}
    </div>
  );
};
