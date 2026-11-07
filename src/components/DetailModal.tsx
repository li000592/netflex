import React, { useEffect, useRef, useState } from 'react';
import { X, Play, Plus, Check, Star, Layers, Film, Loader2, ChevronDown, Airplay } from 'lucide-react';
import { MediaItem, VideoDetail, EpisodeGroup, Episode, WatchHistoryItem } from '../types';
import { fetchVideoDetail, searchVideos, getWatchHistory, hasValidCover } from '../services/api';
import { useI18n } from '../i18n';

interface DetailModalProps {
  movie: MediaItem | null;
  isOpen: boolean;
  onClose: () => void;
  onPlayEpisode: (movie: MediaItem, episode: Episode, groupIndex: number, episodeIndex: number) => void;
  isFavorite: boolean;
  onToggleFavorite: (movie: MediaItem) => void;
  huakaiEnabled?: boolean;
}

export const DetailModal: React.FC<DetailModalProps> = ({
  movie,
  isOpen,
  onClose,
  onPlayEpisode,
  isFavorite,
  onToggleFavorite,
  huakaiEnabled = false,
}) => {
  const { t } = useI18n();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [detail, setDetail] = useState<VideoDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeGroupIndex, setActiveGroupIndex] = useState(0);
  const [sourceCandidates, setSourceCandidates] = useState<MediaItem[]>([]);
  const [activeSourceIndex, setActiveSourceIndex] = useState(0);
  const [showAllLines, setShowAllLines] = useState(false);
  const [historyRecord, setHistoryRecord] = useState<WatchHistoryItem | null>(null);

  // Check if movie has watch history
  useEffect(() => {
    if (!movie || !isOpen) {
      setHistoryRecord(null);
      return;
    }
    const historyList = getWatchHistory();
    const movieTitle = movie.title?.trim().toLowerCase();
    const found = historyList.find(
      (h) => h.id === movie.id || (movieTitle && h.title?.trim().toLowerCase() === movieTitle)
    );
    setHistoryRecord(found || null);
  }, [movie, isOpen]);

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
      setActiveSourceIndex(0);
      setShowAllLines(false);
      return;
    }

    setShowAllLines(false);
    setActiveSourceIndex(0);

    let isMounted = true;
    setLoading(true);

    const loadData = async () => {
      // 1. If movie already has pre-parsed groups, display immediately (0ms)
      if (movie.groups && movie.groups.length > 0) {
        setDetail({
          title: movie.title,
          pic: movie.cover,
          actor: movie.actor || '全网公映演员阵容',
          director: movie.director || '精选导演',
          year: movie.year || '2024',
          area: movie.area || '全球',
          remarks: movie.remarks || '1080P/4K超清',
          content: movie.overview || `${movie.title} 是当前热门流媒体内容。请点击播放或切换备用线路。`,
          groups: movie.groups,
        });
        setLoading(false);
        return;
      }

      // 2. Search across sources (cached in api.ts)
      const searchResults = await searchVideos(movie.title, undefined, undefined, huakaiEnabled);
      if (!isMounted) return;

      if (searchResults.length > 0) {
        setSourceCandidates(searchResults);
        const bestMatch = searchResults[0];

        const resolvedPic =
          (hasValidCover(movie.cover) ? movie.cover : '') ||
          (hasValidCover(bestMatch.cover) ? bestMatch.cover : '') ||
          bestMatch.cover ||
          movie.cover;

        // If bestMatch already has parsed groups from search, USE IMMEDIATELY! (Zero second delay!)
        if (bestMatch.groups && bestMatch.groups.length > 0) {
          setDetail({
            title: bestMatch.title || movie.title,
            pic: resolvedPic,
            actor: bestMatch.actor || '全网公映演员阵容',
            director: bestMatch.director || '精选导演',
            year: bestMatch.year || movie.year || '2024',
            area: bestMatch.area || movie.area || '全球',
            remarks: bestMatch.remarks || movie.remarks || '1080P/4K超清',
            content: bestMatch.overview || movie.overview || `${movie.title} 是当前热门流媒体内容。请点击播放或切换备用线路。`,
            groups: bestMatch.groups,
          });
          setLoading(false);
          return;
        }

        // Fallback to fetchVideoDetail only if groups were not pre-parsed
        if (bestMatch.sourceUrl && bestMatch.vod_id) {
          const res = await fetchVideoDetail(bestMatch.sourceUrl, bestMatch.vod_id);
          if (isMounted && res) {
            if (!hasValidCover(res.pic) && hasValidCover(resolvedPic)) {
              res.pic = resolvedPic;
            }
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

  // Switch between discovered source candidates (instant if pre-parsed!)
  const handleSelectSource = async (index: number) => {
    setActiveSourceIndex(index);
    const candidate = sourceCandidates[index];
    if (!candidate) return;

    if (candidate.groups && candidate.groups.length > 0) {
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              remarks: candidate.remarks || prev.remarks,
              groups: candidate.groups!,
            }
          : null
      );
      setActiveGroupIndex(0);
      return;
    }

    if (candidate.sourceUrl && candidate.vod_id) {
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
  const modalCover = hasValidCover(detail?.pic)
    ? detail!.pic
    : hasValidCover(movie.cover)
    ? movie.cover
    : '';

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="fixed inset-0 z-50 w-full max-w-4xl max-h-[90vh] my-auto bg-[#181818] text-white rounded-xl shadow-2xl overflow-y-auto no-scrollbar border border-white/10"
    >
      {/* Hero Header in Modal */}
      <div className="relative h-64 sm:h-96 w-full bg-[#141414] select-none">
        {modalCover ? (
          <img
            src={modalCover}
            alt={movie.title}
            className="w-full h-full object-cover filter brightness-[0.75]"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-[#2a1111] via-[#1a1a1a] to-[#111111]">
            <span className="text-[#E50914] font-black text-6xl mb-2 opacity-80">N</span>
            <span className="text-xl text-gray-300 font-bold max-w-md line-clamp-2">{movie.title}</span>
          </div>
        )}
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
                  // If user has watched an episode previously, prioritize continuing that episode
                  if (historyRecord) {
                    const targetIdx = currentGroup.episodes.findIndex(
                      (ep) =>
                        ep.url === historyRecord.episodeUrl ||
                        ep.name === historyRecord.episodeName
                    );
                    if (targetIdx !== -1) {
                      onPlayEpisode(
                        movie,
                        currentGroup.episodes[targetIdx],
                        activeGroupIndex,
                        targetIdx
                      );
                      return;
                    }
                  }
                  onPlayEpisode(movie, currentGroup.episodes[0], activeGroupIndex, 0);
                } else if (sourceCandidates.length > 0) {
                  const candidate = sourceCandidates[0];
                  if (candidate.sourceUrl && candidate.vod_id) {
                    onPlayEpisode(candidate, { name: '正片', url: '' }, 0, 0);
                  }
                }
              }}
              disabled={loading || (!currentGroup?.episodes.length && !sourceCandidates.length)}
              className="flex items-center bg-[#E50914] hover:bg-[#b80710] text-white font-bold px-6 py-2.5 rounded-md transition-all shadow-lg hover:scale-105 disabled:opacity-50 cursor-pointer"
            >
              <Play className="w-5 h-5 mr-2 fill-white" />
              {historyRecord?.episodeName
                ? `${t('continueWatching')} (${historyRecord.episodeName})`
                : t('playEpisode1')}
            </button>

            {/* Watchlist Button */}
            <button
              onClick={() => onToggleFavorite(movie)}
              className="flex items-center bg-white/10 hover:bg-white/20 text-white font-semibold px-4 py-2.5 rounded-md border border-white/20 transition-all hover:scale-105"
            >
              {isFavorite ? (
                <>
                  <Check className="w-5 h-5 mr-1.5 text-[#E50914]" />
                  {t('inMyList')}
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5 mr-1.5" />
                  {t('addToList')}
                </>
              )}
            </button>

            {/* Apple AirPlay & Cast Button */}
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
              className="flex items-center bg-white/10 hover:bg-white/20 text-white font-semibold px-4 py-2.5 rounded-md border border-white/20 transition-all hover:scale-105 disabled:opacity-50 cursor-pointer"
              title={t('castAppleEcosystem')}
            >
              <Airplay className="w-5 h-5 mr-1.5 text-white" />
              <span>{t('castToTv')}</span>
            </button>

            {/* Quality pill */}
            <span className="text-xs bg-black/60 px-2.5 py-1 rounded font-mono border border-white/20">
              4K Ultra HD
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
              <span className="text-emerald-400 font-bold">{t('matchScore')}</span>
              <span className="text-gray-400">{detail?.year || movie.year || '2024'}</span>
              <span className="border border-white/30 text-gray-300 text-[10px] px-1.5 py-0.5 rounded">
                16+
              </span>
              <span className="text-gray-400">{detail?.remarks || movie.remarks || 'HD'}</span>
            </div>

            <p className="text-sm sm:text-base text-gray-300 leading-relaxed">
              {detail?.content?.replace(/<[^>]+>/g, '') || movie.overview || t('synopsisEmpty')}
            </p>
          </div>

          <div className="space-y-2 text-xs text-gray-400 bg-white/5 p-4 rounded-lg border border-white/5">
            {detail?.actor && (
              <p>
                <span className="text-gray-200 font-semibold">{t('cast')}</span>
                <span className="text-gray-300">{detail.actor}</span>
              </p>
            )}
            {detail?.director && (
              <p>
                <span className="text-gray-200 font-semibold">{t('director')}</span>
                <span className="text-gray-300">{detail.director}</span>
              </p>
            )}
            {detail?.area && (
              <p>
                <span className="text-gray-200 font-semibold">{t('region')}</span>
                <span className="text-gray-300">{detail.area}</span>
              </p>
            )}
          </div>
        </div>

        {/* Subtle Source Line Bar (Default: Best/First Source, Expandable) */}
        {sourceCandidates.length > 1 && (
          <div className="border-t border-white/10 pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs">
                <span className="text-gray-400">{t('currentLine')}:</span>
                <span className="text-white font-medium bg-white/10 px-2.5 py-1 rounded-md border border-white/10 flex items-center space-x-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
                  <span>
                    {sourceCandidates[activeSourceIndex]?.sourceName || `Line ${activeSourceIndex + 1}`}
                    {sourceCandidates[activeSourceIndex]?.remarks ? ` (${sourceCandidates[activeSourceIndex]?.remarks})` : ''}
                  </span>
                </span>
              </div>

              <button
                type="button"
                onClick={() => setShowAllLines(!showAllLines)}
                className="text-xs text-gray-300 hover:text-white flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5 text-[#E50914]" />
                <span>
                  {showAllLines ? t('collapseLines') : `${t('changeLine')} (${sourceCandidates.length})`}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${
                    showAllLines ? 'rotate-180' : ''
                  }`}
                />
              </button>
            </div>

            {/* Expandable Line Selector */}
            {showAllLines && (
              <div className="mt-3 p-3 bg-black/40 rounded-lg border border-white/10">
                <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar py-1">
                  {sourceCandidates.map((src, idx) => (
                    <button
                      key={`${src.id}_${idx}`}
                      onClick={() => {
                        handleSelectSource(idx);
                        setShowAllLines(false);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all border cursor-pointer ${
                        activeSourceIndex === idx
                          ? 'bg-[#E50914] text-white border-[#E50914] shadow-md'
                          : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      ⚡ {src.sourceName || `Line ${idx + 1}`}
                      {src.remarks ? ` (${src.remarks})` : ''}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Episode Groups / Lines */}
        {detail && detail.groups.length > 0 && (
          <div className="border-t border-white/10 pt-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Film className="w-4 h-4 text-[#E50914]" />
                <h3 className="text-base font-bold text-white">{t('episodes')}</h3>
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
                {t('loadingEpisodes')}
              </div>
            ) : currentGroup && currentGroup.episodes.length > 0 ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5 max-h-72 overflow-y-auto no-scrollbar p-1">
                {currentGroup.episodes.map((ep, idx) => {
                  const isCurrentHistory =
                    historyRecord &&
                    (ep.url === historyRecord.episodeUrl || ep.name === historyRecord.episodeName);

                  return (
                    <button
                      key={idx}
                      onClick={() => onPlayEpisode(movie, ep, activeGroupIndex, idx)}
                      className={`group relative flex flex-col items-center justify-center py-3 px-2 rounded-lg text-xs font-medium border transition-all hover:scale-105 cursor-pointer ${
                        isCurrentHistory
                          ? 'bg-[#E50914]/20 border-[#E50914] text-white shadow-[0_0_12px_rgba(229,9,20,0.35)]'
                          : 'bg-white/5 hover:bg-[#E50914] hover:text-white text-gray-300 border-white/10'
                      }`}
                    >
                      <span className="line-clamp-1">{ep.name}</span>
                      {isCurrentHistory ? (
                        <span className="text-[10px] text-[#E50914] group-hover:text-white mt-1 font-bold flex items-center">
                          <Play className="w-2.5 h-2.5 fill-current mr-1" />
                          {t('continueWatching')}
                        </span>
                      ) : (
                        <Play className="w-3 h-3 mt-1 opacity-0 group-hover:opacity-100 fill-current transition-opacity" />
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-sm text-gray-400 py-6 text-center">
                {t('noEpisodes')}
              </div>
            )}
          </div>
        )}
      </div>
    </dialog>
  );
};
