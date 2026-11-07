import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  FastForward,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  ArrowLeft,
  ListVideo,
  Gauge,
  Layers,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Episode, MediaItem, VideoDetail } from '../types';
import { saveWatchHistory, fetchVideoDetail } from '../services/api';

interface PlayerModalProps {
  movie: MediaItem | null;
  episode: Episode | null;
  isOpen: boolean;
  onClose: () => void;
  onNextEpisode?: () => void;
}

export const PlayerModal: React.FC<PlayerModalProps> = ({
  movie,
  episode,
  isOpen,
  onClose,
  onNextEpisode,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const hideControlsTimer = useRef<NodeJS.Timeout | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [speedMenuOpen, setSpeedMenuOpen] = useState(false);
  const [epMenuOpen, setEpMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Detailed episode list & groups for in-player episode switching
  const [detailData, setDetailData] = useState<VideoDetail | null>(null);
  const [activeEp, setActiveEp] = useState<Episode | null>(episode);

  // Sync active episode
  useEffect(() => {
    setActiveEp(episode);
  }, [episode]);

  // Load detail data for full episode list if needed
  useEffect(() => {
    if (!movie || !isOpen) return;
    if (movie.sourceUrl && movie.vod_id) {
      fetchVideoDetail(movie.sourceUrl, movie.vod_id).then((res) => {
        if (res) setDetailData(res);
      });
    }
  }, [movie, isOpen]);

  // Initialize Video & HLS
  useEffect(() => {
    if (!isOpen || !activeEp || !activeEp.url) return;

    const video = videoRef.current;
    if (!video) return;

    setIsLoading(true);
    setHasError(false);

    const playUrl = activeEp.url;

    // Clean up previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (Hls.isSupported() && playUrl.includes('.m3u8')) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
      });
      hlsRef.current = hls;

      hls.loadSource(playUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => setIsPlaying(false));
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        console.warn('HLS Error:', data);
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              setHasError(true);
              setErrorMessage('视频加载失败，请尝试切换其他片源或集数');
              hls.destroy();
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl') || playUrl.endsWith('.mp4')) {
      // Native Safari / MP4 support
      video.src = playUrl;
      video.play().catch(() => setIsPlaying(false));
    } else {
      video.src = playUrl;
      video.play().catch(() => setIsPlaying(false));
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [isOpen, activeEp]);

  // Save history periodically
  useEffect(() => {
    if (!isOpen || !movie || !activeEp) return;

    const interval = setInterval(() => {
      if (currentTime > 5 && duration > 0) {
        saveWatchHistory({
          id: movie.id,
          title: movie.title,
          cover: movie.cover,
          sourceUrl: movie.sourceUrl || '',
          vodId: movie.vod_id || '',
          sourceName: movie.sourceName,
          episodeIndex: 0,
          episodeName: activeEp.name,
          episodeUrl: activeEp.url,
          currentTime,
          duration,
          updatedAt: Date.now(),
        });
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [isOpen, movie, activeEp, currentTime, duration]);

  // Handle Controls Visibility on Idle
  const handleUserActivity = () => {
    setControlsVisible(true);
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    hideControlsTimer.current = setTimeout(() => {
      if (isPlaying) {
        setControlsVisible(false);
        setSpeedMenuOpen(false);
        setEpMenuOpen(false);
      }
    }, 3500);
  };

  // Keyboard Shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      handleUserActivity();
      const video = videoRef.current;
      if (!video) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          if (video.paused) video.play();
          else video.pause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          video.currentTime = Math.max(0, video.currentTime - 10);
          break;
        case 'ArrowRight':
          e.preventDefault();
          video.currentTime = Math.min(video.duration, video.currentTime + 10);
          break;
        case 'ArrowUp':
          e.preventDefault();
          video.volume = Math.min(1, video.volume + 0.1);
          setVolume(video.volume);
          break;
        case 'ArrowDown':
          e.preventDefault();
          video.volume = Math.max(0, video.volume - 0.1);
          setVolume(video.volume);
          break;
        case 'KeyF':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'KeyM':
          e.preventDefault();
          toggleMute();
          break;
        case 'Escape':
          if (!document.fullscreenElement) {
            onClose();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isPlaying]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play();
    else video.pause();
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const handleVolumeChange = (newVol: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = newVol;
    setVolume(newVol);
    video.muted = newVol === 0;
    setIsMuted(newVol === 0);
  };

  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;
    if (!document.fullscreenElement) {
      container.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const handleSeek = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = seconds;
    setCurrentTime(seconds);
  };

  const handleSetSpeed = (speed: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = speed;
    setPlaybackSpeed(speed);
    setSpeedMenuOpen(false);
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '00:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleUserActivity}
      onClick={handleUserActivity}
      className="fixed inset-0 z-50 bg-black flex items-center justify-center select-none overflow-hidden"
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain cursor-pointer"
        onClick={togglePlay}
        playsInline
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onWaiting={() => setIsLoading(true)}
        onPlaying={() => setIsLoading(false)}
        onTimeUpdate={() => {
          if (videoRef.current) {
            setCurrentTime(videoRef.current.currentTime);
          }
        }}
        onLoadedMetadata={() => {
          if (videoRef.current) {
            setDuration(videoRef.current.duration);
            setIsLoading(false);
          }
        }}
        onEnded={() => {
          if (onNextEpisode) onNextEpisode();
        }}
      />

      {/* Loading Spinner */}
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none bg-black/40">
          <Loader2 className="w-14 h-14 text-[#E50914] animate-spin mb-3" />
          <span className="text-white text-sm font-semibold tracking-wider">正在缓冲 4K 流媒体...</span>
        </div>
      )}

      {/* Error State */}
      {hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 p-6 text-center z-40">
          <AlertCircle className="w-16 h-16 text-[#E50914] mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">播放异常</h2>
          <p className="text-gray-400 text-sm max-w-md mb-6">{errorMessage}</p>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-[#E50914] text-white rounded-md font-bold hover:bg-[#b80710]"
          >
            返回片源选择
          </button>
        </div>
      )}

      {/* Top Overlay Bar */}
      <div
        className={`absolute top-0 left-0 right-0 p-4 sm:p-6 bg-gradient-to-b from-black/90 via-black/40 to-transparent flex items-center justify-between transition-opacity duration-300 z-30 ${
          controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center space-x-4">
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/20 text-white transition-all hover:scale-110"
            aria-label="返回"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-white leading-tight">
              {movie?.title}
            </h1>
            <p className="text-xs text-gray-300">
              {activeEp?.name} • 31源聚合极速专线
            </p>
          </div>
        </div>

        {/* Top Right Info Badge */}
        <div className="flex items-center space-x-2">
          <span className="bg-[#E50914] text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase">
            HLS 4K Ultra
          </span>
        </div>
      </div>

      {/* Bottom Control Bar */}
      <div
        className={`absolute bottom-0 left-0 right-0 p-4 sm:p-6 bg-gradient-to-t from-black/95 via-black/60 to-transparent transition-opacity duration-300 z-30 ${
          controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Scrubber Progress Slider */}
        <div className="relative mb-3 flex items-center group">
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={(e) => handleSeek(Number(e.target.value))}
            className="w-full h-1.5 sm:h-2 rounded-lg cursor-pointer accent-[#E50914]"
          />
        </div>

        {/* Controls Row */}
        <div className="flex items-center justify-between text-white">
          {/* Left Controls */}
          <div className="flex items-center space-x-3 sm:space-x-5">
            <button
              onClick={togglePlay}
              className="p-1 hover:text-[#E50914] transition-colors"
              aria-label={isPlaying ? '暂停' : '播放'}
            >
              {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current" />}
            </button>

            {/* -10s */}
            <button
              onClick={() => handleSeek(Math.max(0, currentTime - 10))}
              className="p-1 hover:text-[#E50914] transition-colors"
              title="后退10秒"
            >
              <RotateCcw className="w-5 h-5" />
            </button>

            {/* +10s */}
            <button
              onClick={() => handleSeek(Math.min(duration, currentTime + 10))}
              className="p-1 hover:text-[#E50914] transition-colors"
              title="前进10秒"
            >
              <RotateCw className="w-5 h-5" />
            </button>

            {/* Skip Intro (+90s) */}
            <button
              onClick={() => handleSeek(Math.min(duration, currentTime + 90))}
              className="hidden sm:flex items-center text-xs font-semibold bg-white/20 hover:bg-white/30 px-2.5 py-1 rounded transition-colors"
              title="跳过片头90秒"
            >
              <FastForward className="w-3.5 h-3.5 mr-1" />
              跳过片头
            </button>

            {/* Volume Control */}
            <div className="flex items-center space-x-2 group/vol">
              <button onClick={toggleMute} className="hover:text-[#E50914] transition-colors">
                {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={(e) => handleVolumeChange(Number(e.target.value))}
                className="w-16 sm:w-20 h-1 accent-[#E50914]"
              />
            </div>

            {/* Time Stamp */}
            <span className="text-xs text-gray-300 font-mono">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          {/* Right Controls */}
          <div className="flex items-center space-x-3 sm:space-x-5">
            {/* Speed Selector */}
            <div className="relative">
              <button
                onClick={() => setSpeedMenuOpen(!speedMenuOpen)}
                className="flex items-center text-xs font-semibold hover:text-[#E50914] transition-colors"
              >
                <Gauge className="w-4 h-4 mr-1" />
                {playbackSpeed}x
              </button>
              {speedMenuOpen && (
                <div className="absolute bottom-8 right-0 bg-[#181818] border border-white/20 rounded-lg p-1.5 shadow-2xl flex flex-col space-y-1 z-50">
                  {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((s) => (
                    <button
                      key={s}
                      onClick={() => handleSetSpeed(s)}
                      className={`text-xs px-3 py-1 rounded text-left transition-colors ${
                        playbackSpeed === s ? 'bg-[#E50914] text-white font-bold' : 'hover:bg-white/10 text-gray-300'
                      }`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Episode Drawer Button (if episodes exist) */}
            {detailData && detailData.groups.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setEpMenuOpen(!epMenuOpen)}
                  className="flex items-center text-xs font-semibold hover:text-[#E50914] transition-colors"
                  title="选集"
                >
                  <ListVideo className="w-5 h-5" />
                </button>
                {epMenuOpen && (
                  <div className="absolute bottom-8 right-0 bg-[#181818] border border-white/20 rounded-lg p-3 shadow-2xl w-64 max-h-80 overflow-y-auto no-scrollbar z-50">
                    <h4 className="text-xs font-bold text-gray-400 mb-2">选集切换</h4>
                    <div className="grid grid-cols-3 gap-2">
                      {detailData.groups[0]?.episodes.map((ep, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setActiveEp(ep);
                            setEpMenuOpen(false);
                          }}
                          className={`text-xs p-1.5 rounded truncate transition-colors ${
                            activeEp?.url === ep.url
                              ? 'bg-[#E50914] text-white font-bold'
                              : 'bg-white/10 text-gray-300 hover:bg-white/20'
                          }`}
                        >
                          {ep.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Fullscreen Toggle */}
            <button
              onClick={toggleFullscreen}
              className="hover:text-[#E50914] transition-colors"
              aria-label={isFullscreen ? '退出全屏' : '全屏'}
            >
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
