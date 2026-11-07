import React, { useEffect, useRef, useState } from 'react';
import { X, Play, Plus, Check, Star, Layers, Film, Loader2 } from 'lucide-react';
import { MediaItem, VideoDetail, EpisodeGroup, Episode } from '../types';
import { fetchVideoDetail, searchVideos } from '../services/api';

interface DetailModalProps {
  movie: MediaItem | null;
  isOpen: boolean;
  onClose: () => void;
  onPlayEpisode: (movie: MediaItem, episode: Episode, groupIndex: number, episodeIndex: number) => void;
  isFavorite: boolean;
  onToggleFavorite: (movie: MediaItem) => void;
}

export const DetailModal: React.FC<DetailModalProps> = ({
  movie,
  isOpen,
  onClose,
  onPlayEpisode,
  isFavorite,
  onToggleFavorite,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [detail, setDetail] = useState<VideoDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeGroupIndex, setActiveGroupIndex] = useState(0);
  const [sourceCandidates, setSourceCandidates] = useState<MediaItem[]>([]);
  const [activeSourceIndex, setActiveSourceIndex] = useState(0);

  // Sync native <dialog> with isOpen
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [isOpen]);

  // Load details when movie changes
  useEffect(() => {
    if (!movie || !isOpen) {
      setDetail(null);
      setSourceCandidates([]);
      return;
    }

    let isMounted = true;
    setLoading(true);

    const loadData = async () => {
      // 1. If movie already has sourceUrl and vod_id, fetch directly
      if (movie.sourceUrl && movie.vod_id) {
        const res = await fetchVideoDetail(movie.sourceUrl, movie.vod_id);
        if (isMounted && res) {
          setDetail(res);
          setLoading(false);
          return;
        }
      }

      // 2. Otherwise search across our 31 sources using movie.title
      const searchResults = await searchVideos(movie.title);
      if (!isMounted) return;

      if (searchResults.length > 0) {
        setSourceCandidates(searchResults);
        const bestMatch = searchResults[0];
        if (bestMatch.sourceUrl && bestMatch.vod_id) {
          const res = await fetchVideoDetail(bestMatch.sourceUrl, bestMatch.vod_id);
          if (isMounted) {
            setDetail(res);
          }
        }
      } else {
        // Fallback detail if no API source matched
        setDetail({
          title: movie.title,
          pic: movie.cover,
          actor: '全网公映演员阵容',
          director: '精选导演',
          year: movie.year || '2024',
          area: '全球',
          remarks: movie.remarks || '1080P/4K超清',
          content: movie.overview || `${movie.title} 是当前热门流媒体内容。请点击播放或切换备用线路。`,
          groups: [],
        });
      }
      setLoading(false);
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [movie, isOpen]);

  // Switch between discovered source candidates
  const handleSelectSource = async (index: number) => {
    setActiveSourceIndex(index);
    const candidate = sourceCandidates[index];
    if (candidate && candidate.sourceUrl && candidate.vod_id) {
      setLoading(true);
      const res = await fetchVideoDetail(candidate.sourceUrl, candidate.vod_id);
      if (res) {
        setDetail(res);
        setActiveGroupIndex(0);
      }
      setLoading(false);
    }
  };

  if (!isOpen || !movie) return null;

  const currentGroup: EpisodeGroup | undefined = detail?.groups[activeGroupIndex];

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="fixed inset-0 z-50 w-full max-w-4xl max-h-[90vh] my-auto bg-[#181818] text-white rounded-xl shadow-2xl overflow-y-auto no-scrollbar border border-white/10"
    >
      {/* Hero Header in Modal */}
      <div className="relative h-64 sm:h-96 w-full bg-[#141414] select-none">
        <img
          src={detail?.pic || movie.cover}
          alt={movie.title}
          className="w-full h-full object-cover filter brightness-[0.75]"
        />
        {/* Gradient Fades */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#181818] via-[#181818]/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#181818]/80 via-transparent to-transparent" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 rounded-full bg-black/70 hover:bg-black text-white border border-white/20 transition-all hover:scale-110"
          aria-label="关闭详情"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header Controls */}
        <div className="absolute bottom-6 left-6 right-6 z-10">
          <h1 className="text-2xl sm:text-4xl font-black drop-shadow-lg mb-3">
            {detail?.title || movie.title}
          </h1>

          <div className="flex flex-wrap items-center gap-3">
            {/* Play Button */}
            <button
              onClick={() => {
                if (currentGroup && currentGroup.episodes.length > 0) {
                  onPlayEpisode(movie, currentGroup.episodes[0], activeGroupIndex, 0);
                } else if (sourceCandidates.length > 0) {
                  const candidate = sourceCandidates[0];
                  if (candidate.sourceUrl && candidate.vod_id) {
                    onPlayEpisode(candidate, { name: '正片', url: '' }, 0, 0);
                  }
                }
              }}
              disabled={loading || (!currentGroup?.episodes.length && !sourceCandidates.length)}
              className="flex items-center bg-[#E50914] hover:bg-[#b80710] text-white font-bold px-6 py-2.5 rounded-md transition-all shadow-lg hover:scale-105 disabled:opacity-50"
            >
              <Play className="w-5 h-5 mr-2 fill-white" />
              立即播放第1集
            </button>

            {/* Watchlist Button */}
            <button
              onClick={() => onToggleFavorite(movie)}
              className="flex items-center bg-white/10 hover:bg-white/20 text-white font-semibold px-4 py-2.5 rounded-md border border-white/20 transition-all hover:scale-105"
            >
              {isFavorite ? (
                <>
                  <Check className="w-5 h-5 mr-1.5 text-[#E50914]" />
                  已在片单
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5 mr-1.5" />
                  加入片单
                </>
              )}
            </button>

            {/* Quality pill */}
            <span className="text-xs bg-black/60 px-2.5 py-1 rounded font-mono border border-white/20">
              4K 杜比视界
            </span>
          </div>
        </div>
      </div>

      {/* Modal Content Body */}
      <div className="p-6 sm:p-8 space-y-8">
        {/* Meta info & Synopsis */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center space-x-3 text-sm">
              <span className="text-emerald-400 font-bold">98% 推荐匹配</span>
              <span className="text-gray-400">{detail?.year || movie.year || '2024'}</span>
              <span className="border border-white/30 text-gray-300 text-[10px] px-1.5 py-0.5 rounded">
                16+
              </span>
              <span className="text-gray-400">{detail?.remarks || movie.remarks || '超清完结'}</span>
            </div>

            <p className="text-sm sm:text-base text-gray-300 leading-relaxed">
              {detail?.content?.replace(/<[^>]+>/g, '') || movie.overview || '暂无详细简介。'}
            </p>
          </div>

          <div className="space-y-2 text-xs text-gray-400 bg-white/5 p-4 rounded-lg border border-white/5">
            {detail?.actor && (
              <p>
                <span className="text-gray-200 font-semibold">主演：</span>
                <span className="text-gray-300">{detail.actor}</span>
              </p>
            )}
            {detail?.director && (
              <p>
                <span className="text-gray-200 font-semibold">导演：</span>
                <span className="text-gray-300">{detail.director}</span>
              </p>
            )}
            {detail?.area && (
              <p>
                <span className="text-gray-200 font-semibold">地区：</span>
                <span className="text-gray-300">{detail.area}</span>
              </p>
            )}
          </div>
        </div>

        {/* 31 Source Multi-Line Selection */}
        {sourceCandidates.length > 1 && (
          <div className="border-t border-white/10 pt-6">
            <div className="flex items-center space-x-2 mb-3">
              <Layers className="w-4 h-4 text-[#E50914]" />
              <h3 className="text-base font-bold text-white">聚合片源切换 ({sourceCandidates.length}条线路)</h3>
            </div>
            <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar py-1">
              {sourceCandidates.map((src, idx) => (
                <button
                  key={`${src.id}_${idx}`}
                  onClick={() => handleSelectSource(idx)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all border ${
                    activeSourceIndex === idx
                      ? 'bg-[#E50914] text-white border-[#E50914] shadow-md'
                      : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10'
                  }`}
                >
                  ⚡ {src.sourceName || `片源 ${idx + 1}`}
                  {src.remarks ? ` (${src.remarks})` : ''}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Episode Groups / Lines */}
        {detail && detail.groups.length > 0 && (
          <div className="border-t border-white/10 pt-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Film className="w-4 h-4 text-[#E50914]" />
                <h3 className="text-base font-bold text-white">选集播放</h3>
              </div>

              {/* Group tabs if multiple lines in source */}
              {detail.groups.length > 1 && (
                <div className="flex items-center space-x-2">
                  {detail.groups.map((grp, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveGroupIndex(idx)}
                      className={`text-xs px-2.5 py-1 rounded transition-colors ${
                        activeGroupIndex === idx
                          ? 'bg-white text-black font-bold'
                          : 'bg-white/10 text-gray-300 hover:bg-white/20'
                      }`}
                    >
                      {grp.from}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Episode Grid */}
            {loading ? (
              <div className="py-12 flex justify-center items-center text-gray-400">
                <Loader2 className="w-6 h-6 animate-spin mr-2 text-[#E50914]" />
                加载集数中...
              </div>
            ) : currentGroup && currentGroup.episodes.length > 0 ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5 max-h-72 overflow-y-auto no-scrollbar p-1">
                {currentGroup.episodes.map((ep, idx) => (
                  <button
                    key={idx}
                    onClick={() => onPlayEpisode(movie, ep, activeGroupIndex, idx)}
                    className="group relative flex flex-col items-center justify-center py-3 px-2 rounded-lg bg-white/5 hover:bg-[#E50914] hover:text-white text-gray-300 text-xs font-medium border border-white/10 transition-all hover:scale-105"
                  >
                    <span className="line-clamp-1">{ep.name}</span>
                    <Play className="w-3 h-3 mt-1 opacity-0 group-hover:opacity-100 fill-current transition-opacity" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-400 py-6 text-center">
                当前线路暂无解析出分集，建议在上方切换其他片源。
              </div>
            )}
          </div>
        )}
      </div>
    </dialog>
  );
};
