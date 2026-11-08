import React, { useEffect, useRef, useState, useCallback } from 'react';
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
  Sun,
  Airplay,
  Tv,
  Copy,
  ExternalLink,
  Check,
  ChevronRight,
  Info,
  X,
} from 'lucide-react';
import { Episode, MediaItem, VideoDetail } from '../types';
import { saveWatchHistory, fetchVideoDetail, getWatchHistory } from '../services/api';
import { useI18n } from '../i18n';

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
  const { t } = useI18n();
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

  // Apple AirPlay & TV Cast State
  const [isAirPlaySupported, setIsAirPlaySupported] = useState(false);
  const [isAirPlayAvailable, setIsAirPlayAvailable] = useState(false);
  const [isAirPlayActive, setIsAirPlayActive] = useState(false);
  const [castMenuOpen, setCastMenuOpen] = useState(false);
  const [copiedToast, setCopiedToast] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  // Netflix Mobile Gestures State (iPhone / iPad)
  const [brightness, setBrightness] = useState(1);
  const [aspectMode, setAspectMode] = useState<'contain' | 'cover'>('contain');
  const [gestureIndicator, setGestureIndicator] = useState<{
    type: 'volume' | 'brightness' | 'seek' | 'ripple_left' | 'ripple_right' | 'aspect';
    value?: number;
    text?: string;
  } | null>(null);

  const indicatorTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchRef = useRef<{
    startX: number;
    startY: number;
    startTime: number;
    initialTime: number;
    initialVol: number;
    initialBright: number;
    initialPinchDist: number;
    mode: 'none' | 'volume' | 'brightness' | 'seek' | 'pinch';
    targetSeekTime: number;
  }>({
    startX: 0,
    startY: 0,
    startTime: 0,
    initialTime: 0,
    initialVol: 1,
    initialBright: 1,
    initialPinchDist: 0,
    mode: 'none',
    targetSeekTime: 0,
  });

  const lastTapRef = useRef<{ time: number; x: number; y: number }>({ time: 0, x: 0, y: 0 });
  const singleTapTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showIndicator = (
    info: {
      type: 'volume' | 'brightness' | 'seek' | 'ripple_left' | 'ripple_right' | 'aspect';
      value?: number;
      text?: string;
    },
    autoHideMs = 800
  ) => {
    setGestureIndicator(info);
    if (indicatorTimerRef.current) clearTimeout(indicatorTimerRef.current);
    if (autoHideMs > 0) {
      indicatorTimerRef.current = setTimeout(() => {
        setGestureIndicator(null);
      }, autoHideMs);
    }
  };

  // Detailed episode list & groups for in-player episode switching
  const [detailData, setDetailData] = useState<VideoDetail | null>(null);
  const [activeGroupIndex, setActiveGroupIndex] = useState(0);
  const [activeEp, setActiveEp] = useState<Episode | null>(episode);

  const allGroups = detailData?.groups || movie?.groups || [];

  // Auto-Resume State & References
  const resumeTimeRef = useRef<number>(0);
  const hasResumedRef = useRef<boolean>(false);
  const [resumeToast, setResumeToast] = useState<{ show: boolean; time: number } | null>(null);
  const resumeToastTimer = useRef<NodeJS.Timeout | null>(null);

  // Sync active episode
  useEffect(() => {
    setActiveEp(episode);
  }, [episode]);

  // Find previously saved watch progress
  const findSavedProgress = useCallback(
    (currMovie: MediaItem | null, currEp: Episode | null): number => {
      if (!currMovie) return 0;
      const historyList = getWatchHistory();
      const movieTitle = currMovie.title?.trim().toLowerCase();

      // 1. Exact ID & episode URL
      let match = historyList.find(
        (h) => h.id === currMovie.id && currEp && h.episodeUrl === currEp.url
      );
      // 2. Exact ID & episode Name
      if (!match && currEp) {
        match = historyList.find(
          (h) => h.id === currMovie.id && h.episodeName === currEp.name
        );
      }
      // 3. Title & Episode Name or URL
      if (!match && movieTitle) {
        match = historyList.find((h) => {
          if (h.title?.trim().toLowerCase() !== movieTitle) return false;
          if (!currEp) return true;
          return h.episodeName === currEp.name || h.episodeUrl === currEp.url;
        });
      }
      // 4. Movie ID or Title fallback
      if (!match) {
        match = historyList.find(
          (h) =>
            h.id === currMovie.id ||
            (movieTitle && h.title?.trim().toLowerCase() === movieTitle)
        );
      }

      if (match && match.currentTime > 5) {
        // If watched to near the end (> 95% or within 20s of end), start over
        if (match.duration > 30 && match.currentTime >= match.duration - 20) {
          return 0;
        }
        return match.currentTime;
      }
      return 0;
    },
    []
  );

  // Compute resume time and show Netflix-style toast
  useEffect(() => {
    if (!isOpen || !activeEp) {
      resumeTimeRef.current = 0;
      hasResumedRef.current = false;
      setResumeToast(null);
      return;
    }

    const saved = findSavedProgress(movie, activeEp);
    resumeTimeRef.current = saved;
    hasResumedRef.current = false;

    if (saved > 5) {
      setResumeToast({ show: true, time: saved });
      if (resumeToastTimer.current) clearTimeout(resumeToastTimer.current);
      resumeToastTimer.current = setTimeout(() => {
        setResumeToast(null);
      }, 4500);
    } else {
      setResumeToast(null);
    }
  }, [isOpen, activeEp, movie, findSavedProgress]);

  // Load detail data for full episode list if needed
  useEffect(() => {
    if (!movie || !isOpen) {
      setDetailData(null);
      setActiveGroupIndex(0);
      return;
    }
    if (movie.groups && movie.groups.length > 0) {
      setDetailData({
        title: movie.title,
        pic: movie.cover,
        actor: movie.actor || '',
        director: movie.director || '',
        year: movie.year || '',
        area: movie.area || '',
        remarks: movie.remarks || '',
        content: movie.overview || '',
        groups: movie.groups,
      });
    }
    if (movie.sourceUrl && movie.vod_id) {
      fetchVideoDetail(movie.sourceUrl, movie.vod_id).then((res) => {
        if (res && res.groups && res.groups.length > 0) {
          setDetailData(res);
        }
      });
    }
  }, [movie, isOpen]);

  // Keep activeGroupIndex in sync with activeEp
  useEffect(() => {
    if (allGroups.length > 0 && activeEp) {
      const idx = allGroups.findIndex((grp) =>
        grp.episodes.some((e) => e.url === activeEp.url || e.name === activeEp.name)
      );
      if (idx !== -1) setActiveGroupIndex(idx);
    }
  }, [allGroups, activeEp]);

  // WebKit AirPlay API & Wireless Target Detection
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isOpen) return;

    // Detect if WebKit AirPlay API is supported
    const hasAirPlayAPI =
      !!(window as any).WebKitPlaybackTargetAvailabilityEvent ||
      typeof (video as any).webkitShowPlaybackTargetPicker === 'function';

    if (hasAirPlayAPI) {
      setIsAirPlaySupported(true);

      const handleAvailabilityChanged = (event: any) => {
        setIsAirPlayAvailable(event.availability === 'available');
      };

      const handleWirelessChanged = () => {
        const isWireless = !!(video as any).webkitCurrentPlaybackTargetIsWireless;
        setIsAirPlayActive(isWireless);
      };

      video.addEventListener('webkitplaybacktargetavailabilitychanged', handleAvailabilityChanged);
      video.addEventListener('webkitcurrentplaybacktargetiswirelesschanged', handleWirelessChanged);

      return () => {
        video.removeEventListener('webkitplaybacktargetavailabilitychanged', handleAvailabilityChanged);
        video.removeEventListener('webkitcurrentplaybacktargetiswirelesschanged', handleWirelessChanged);
      };
    } else {
      setIsAirPlaySupported(false);
    }
  }, [isOpen]);

  // Launch AirPlay picker or remote playback
  const handleLaunchAirPlay = () => {
    const video = videoRef.current;
    if (!video) return;

    // 1. WebKit AirPlay API (Safari on iOS / iPadOS / macOS)
    if (typeof (video as any).webkitShowPlaybackTargetPicker === 'function') {
      try {
        (video as any).webkitShowPlaybackTargetPicker();
        return;
      } catch (err) {
        console.warn('WebKit AirPlay picker invocation error:', err);
      }
    }

    // 2. W3C Remote Playback API (e.g. Chrome / Edge Cast)
    if ('remote' in video && (video as any).remote && typeof (video as any).remote.prompt === 'function') {
      (video as any).remote.prompt().catch((err: any) => {
        console.warn('Remote prompt failed:', err);
      });
      return;
    }

    // 3. Fallback: Show guide
    setShowGuide(true);
  };

  // Copy m3u8 direct stream link
  const handleCopyStreamLink = () => {
    if (!activeEp?.url) return;
    navigator.clipboard.writeText(activeEp.url).then(() => {
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 3000);
    });
  };

  // Initialize Video & HLS
  useEffect(() => {
    if (!isOpen || !activeEp || !activeEp.url) return;

    const video = videoRef.current;
    if (!video) return;

    setIsLoading(true);
    setHasError(false);
    setErrorMessage('');

    const playUrl = activeEp.url;
    const targetStart = resumeTimeRef.current;

    // Clean up previous HLS instance & reset native video element
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    try {
      video.pause();
      video.removeAttribute('src');
      video.load();
    } catch {}

    const applyResumeSeek = () => {
      const seekTo = resumeTimeRef.current;
      if (seekTo > 5 && video) {
        if (Math.abs(video.currentTime - seekTo) > 2) {
          video.currentTime = seekTo;
          setCurrentTime(seekTo);
        }
        hasResumedRef.current = true;
      }
    };

    const isAppleSafari =
      /Safari/i.test(navigator.userAgent) &&
      !/Chrome|CriOS|Android/i.test(navigator.userAgent);
    const canPlayAppleHls = video.canPlayType('application/vnd.apple.mpegurl');
    const isM3u8 = playUrl.includes('.m3u8');
    const isMp4 = playUrl.includes('.mp4');

    // On Apple Safari (macOS & iOS/iPadOS), using native HLS playback (video.src = playUrl)
    // is essential so Apple AirPlay can stream the actual HTTP/HLS URL directly to Apple TV / AirPlay 2 TVs.
    if ((isAppleSafari && canPlayAppleHls && isM3u8) || isMp4 || (!Hls.isSupported() && canPlayAppleHls && isM3u8)) {
      video.src = playUrl;
      const onLoaded = () => {
        applyResumeSeek();
        video.removeEventListener('loadedmetadata', onLoaded);
      };
      video.addEventListener('loadedmetadata', onLoaded);
      video.play().catch((err) => {
        console.warn('Native play() error caught:', err);
        setIsPlaying(false);
      });
    } else if (Hls.isSupported() && isM3u8) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
        startPosition: targetStart > 5 ? targetStart : -1,
      });
      hlsRef.current = hls;

      hls.loadSource(playUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        applyResumeSeek();
        video.play().catch((err) => {
          console.warn('HLS play() error caught:', err);
          setIsPlaying(false);
        });
      });

      let recoveryAttempted = false;
      hls.on(Hls.Events.ERROR, (_event, data) => {
        console.warn('HLS Error:', data);
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              if (!recoveryAttempted) {
                recoveryAttempted = true;
                hls.startLoad();
              } else {
                setIsLoading(false);
                setHasError(true);
                setErrorMessage(t('playbackErrorMsg'));
                hls.destroy();
              }
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              setIsLoading(false);
              setHasError(true);
              setErrorMessage(t('playbackErrorMsg'));
              hls.destroy();
              break;
          }
        }
      });
    } else {
      video.src = playUrl;
      const onLoaded = () => {
        applyResumeSeek();
        video.removeEventListener('loadedmetadata', onLoaded);
      };
      video.addEventListener('loadedmetadata', onLoaded);
      video.play().catch((err) => {
        console.warn('Fallback play() error caught:', err);
        setIsPlaying(false);
      });
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [isOpen, activeEp]);

  // References for reliable real-time progress saving without timer teardown bugs
  const lastSavedRef = useRef<number>(0);
  const movieRef = useRef(movie);
  const epRef = useRef(activeEp);
  movieRef.current = movie;
  epRef.current = activeEp;

  // Solid, reliable progress save function
  const saveProgress = useCallback((explicitTime?: number, explicitDur?: number) => {
    const currentMovie = movieRef.current;
    const currentEp = epRef.current;
    if (!currentMovie || !currentEp) return;

    const video = videoRef.current;
    let cur = explicitTime !== undefined ? explicitTime : (video ? video.currentTime : 0);

    // Guard against overwriting resume timestamp with 0 on player startup
    if (!hasResumedRef.current && resumeTimeRef.current > 5 && cur < 3) {
      cur = resumeTimeRef.current;
    } else if (cur >= 3) {
      hasResumedRef.current = true;
    }

    const dur =
      explicitDur !== undefined && explicitDur > 0
        ? explicitDur
        : (video && !isNaN(video.duration) && video.duration > 0 ? video.duration : (cur > 0 ? cur + 60 : 1));

    saveWatchHistory({
      id: currentMovie.id,
      title: currentMovie.title,
      cover: currentMovie.cover,
      sourceUrl: currentMovie.sourceUrl || '',
      vodId: currentMovie.vod_id || '',
      sourceName: currentMovie.sourceName,
      episodeIndex: 0,
      episodeName: currentEp.name,
      episodeUrl: currentEp.url,
      currentTime: Math.floor(cur),
      duration: Math.floor(dur),
      updatedAt: Date.now(),
    });
    lastSavedRef.current = Date.now();
  }, []);

  // Save progress when user closes or exits
  const handleClose = () => {
    saveProgress();
    onClose();
  };

  // Immediate save on open + periodic background save every 4 seconds + tab exit listeners
  useEffect(() => {
    if (!isOpen || !movie || !activeEp) return;

    // Immediately save record so it appears in history right away
    saveProgress();

    const interval = setInterval(() => {
      saveProgress();
    }, 4000);

    // Guaranteed save on browser tab close, refresh, tab switch, or app minimize (iOS/iPad/Desktop)
    const handleTabExit = () => {
      saveProgress();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        saveProgress();
      }
    };

    window.addEventListener('beforeunload', handleTabExit);
    window.addEventListener('pagehide', handleTabExit);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleTabExit);
      window.removeEventListener('pagehide', handleTabExit);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      saveProgress();
    };
  }, [isOpen, activeEp, movie, saveProgress]);

  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  const castMenuOpenRef = useRef(castMenuOpen);
  castMenuOpenRef.current = castMenuOpen;
  const speedMenuOpenRef = useRef(speedMenuOpen);
  speedMenuOpenRef.current = speedMenuOpen;
  const epMenuOpenRef = useRef(epMenuOpen);
  epMenuOpenRef.current = epMenuOpen;
  const lastTouchTimeRef = useRef(0);

  // Handle Controls Visibility on Idle
  const resetHideTimer = useCallback(() => {
    setControlsVisible(true);
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    hideControlsTimer.current = setTimeout(() => {
      if (
        isPlayingRef.current &&
        !speedMenuOpenRef.current &&
        !epMenuOpenRef.current &&
        !castMenuOpenRef.current
      ) {
        setControlsVisible(false);
      }
    }, 4000);
  }, []);

  const handleUserActivity = () => {
    resetHideTimer();
  };

  const handleContainerClick = () => {
    // Ignore synthetic click right after touch on mobile
    if (Date.now() - lastTouchTimeRef.current < 450) return;

    setControlsVisible((prevVisible) => {
      if (!prevVisible) {
        resetHideTimer();
        return true;
      } else {
        if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
        setSpeedMenuOpen(false);
        setEpMenuOpen(false);
        setCastMenuOpen(false);
        return false;
      }
    });
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
          if (video.paused) {
            video.play().catch(() => setIsPlaying(false));
          } else {
            video.pause();
          }
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
            handleClose();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isPlaying]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video || hasError) return;
    if (video.paused) {
      video.play().catch(() => setIsPlaying(false));
    } else {
      video.pause();
    }
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
    hasResumedRef.current = true;
    resumeTimeRef.current = seconds;
    saveProgress(seconds);
  };

  const handleRewind10s = () => {
    const video = videoRef.current;
    if (!video) return;
    const target = Math.max(0, video.currentTime - 10);
    handleSeek(target);
    saveProgress(target);
    showIndicator({ type: 'ripple_left' }, 650);
  };

  const handleForward10s = () => {
    const video = videoRef.current;
    if (!video) return;
    const maxDur = !isNaN(video.duration) && video.duration > 0 ? video.duration : 1000;
    const target = Math.min(maxDur, video.currentTime + 10);
    handleSeek(target);
    saveProgress(target);
    showIndicator({ type: 'ripple_right' }, 650);
  };

  // Netflix Mobile Gestures Handlers (iPhone / iPad)
  const handleTouchStart = (e: React.TouchEvent) => {
    lastTouchTimeRef.current = Date.now();

    // 1. Two-finger pinch to toggle zoom/fill
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchRef.current.mode = 'pinch';
      touchRef.current.initialPinchDist = Math.hypot(dx, dy);
      return;
    }

    // 2. Single finger start
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const video = videoRef.current;
      touchRef.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        startTime: Date.now(),
        initialTime: video ? video.currentTime : 0,
        initialVol: video ? video.volume : volume,
        initialBright: brightness,
        initialPinchDist: 0,
        mode: 'none',
        targetSeekTime: video ? video.currentTime : 0,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    // Two-finger pinch zoom
    if (e.touches.length === 2 && touchRef.current.mode === 'pinch') {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const diff = dist - touchRef.current.initialPinchDist;

      if (Math.abs(diff) > 40) {
        if (diff > 0 && aspectMode !== 'cover') {
          setAspectMode('cover');
          showIndicator({ type: 'aspect', text: t('aspectCover') });
        } else if (diff < 0 && aspectMode !== 'contain') {
          setAspectMode('contain');
          showIndicator({ type: 'aspect', text: t('aspectContain') });
        }
      }
      return;
    }

    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchRef.current.startX;
    const deltaY = touch.clientY - touchRef.current.startY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    // Identify gesture mode if not decided yet
    if (touchRef.current.mode === 'none') {
      if (absX > 20 && absX > absY) {
        touchRef.current.mode = 'seek';
        if (singleTapTimeoutRef.current) {
          clearTimeout(singleTapTimeoutRef.current);
          singleTapTimeoutRef.current = null;
        }
      } else if (absY > 20 && absY > absX) {
        if (singleTapTimeoutRef.current) {
          clearTimeout(singleTapTimeoutRef.current);
          singleTapTimeoutRef.current = null;
        }
        const isLeft = touchRef.current.startX < window.innerWidth / 2;
        touchRef.current.mode = isLeft ? 'brightness' : 'volume';
      }
    }

    // Execute gesture
    if (touchRef.current.mode === 'seek') {
      const video = videoRef.current;
      const maxDur = video && !isNaN(video.duration) && video.duration > 0 ? video.duration : 1000;
      const seekDelta = (deltaX / window.innerWidth) * 90; // swipe across full screen = 90s
      const target = Math.max(0, Math.min(maxDur, touchRef.current.initialTime + seekDelta));
      touchRef.current.targetSeekTime = target;

      showIndicator({
        type: 'seek',
        value: target,
        text: `${formatTime(target)} / ${formatTime(maxDur)} (${seekDelta >= 0 ? '+' : ''}${Math.round(seekDelta)}s)`,
      }, 0);
    } else if (touchRef.current.mode === 'volume') {
      const step = -deltaY / 200;
      const newVol = Math.max(0, Math.min(1, touchRef.current.initialVol + step));
      handleVolumeChange(newVol);
      showIndicator({ type: 'volume', value: Math.round(newVol * 100) }, 0);
    } else if (touchRef.current.mode === 'brightness') {
      const step = -deltaY / 200;
      const newBright = Math.max(0.3, Math.min(1.5, touchRef.current.initialBright + step));
      setBrightness(newBright);
      showIndicator({ type: 'brightness', value: Math.round((newBright / 1.5) * 100) }, 0);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    lastTouchTimeRef.current = Date.now();

    // 1. Finish seek gesture
    if (touchRef.current.mode === 'seek') {
      handleSeek(touchRef.current.targetSeekTime);
      saveProgress(touchRef.current.targetSeekTime);
      setTimeout(() => setGestureIndicator(null), 800);
      touchRef.current.mode = 'none';
      resetHideTimer();
      return;
    }

    // 2. Finish volume or brightness or pinch
    if (
      touchRef.current.mode === 'volume' ||
      touchRef.current.mode === 'brightness' ||
      touchRef.current.mode === 'pinch'
    ) {
      setTimeout(() => setGestureIndicator(null), 800);
      touchRef.current.mode = 'none';
      resetHideTimer();
      return;
    }

    // 3. Single / Double Tap Detection
    if (e.changedTouches.length === 1) {
      const touch = e.changedTouches[0];
      const now = Date.now();
      const prev = lastTapRef.current;
      const isDouble =
        now - prev.time < 320 &&
        Math.abs(touch.clientX - prev.x) < 60 &&
        Math.abs(touch.clientY - prev.y) < 60;

      if (isDouble) {
        if (singleTapTimeoutRef.current) {
          clearTimeout(singleTapTimeoutRef.current);
          singleTapTimeoutRef.current = null;
        }

        const screenW = window.innerWidth;
        if (touch.clientX < screenW * 0.38) {
          // Double Tap Left: Rewind 10s
          handleRewind10s();
        } else if (touch.clientX > screenW * 0.62) {
          // Double Tap Right: Forward 10s
          handleForward10s();
        } else {
          // Double Tap Center: Toggle Play/Pause
          togglePlay();
        }
        lastTapRef.current = { time: 0, x: 0, y: 0 };
        resetHideTimer();
      } else {
        lastTapRef.current = { time: now, x: touch.clientX, y: touch.clientY };
        singleTapTimeoutRef.current = setTimeout(() => {
          setControlsVisible((prevVisible) => {
            if (!prevVisible) {
              resetHideTimer();
              return true;
            } else {
              if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
              setSpeedMenuOpen(false);
              setEpMenuOpen(false);
              setCastMenuOpen(false);
              return false;
            }
          });
          singleTapTimeoutRef.current = null;
        }, 280);
      }
    }
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
      onClick={handleContainerClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="fixed inset-0 z-50 bg-black flex items-center justify-center select-none overflow-hidden touch-none"
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        className={`w-full h-full cursor-pointer transition-all duration-300 ${
          aspectMode === 'cover' ? 'object-cover' : 'object-contain'
        }`}
        style={{ filter: `brightness(${brightness})` }}
        playsInline
        {...({
          'x-webkit-airplay': 'allow',
          airplay: 'allow',
          'webkit-playsinline': 'true',
        } as any)}
        onPlay={() => {
          setIsPlaying(true);
          saveProgress();
        }}
        onPause={() => {
          setIsPlaying(false);
          saveProgress();
        }}
        onWaiting={() => setIsLoading(true)}
        onPlaying={() => setIsLoading(false)}
        onTimeUpdate={() => {
          if (videoRef.current) {
            const cur = videoRef.current.currentTime;
            setCurrentTime(cur);
            if (cur > 3) {
              hasResumedRef.current = true;
            }
            if (Date.now() - lastSavedRef.current > 3500) {
              saveProgress(cur);
            }
          }
        }}
        onLoadedMetadata={() => {
          if (videoRef.current) {
            const dur = videoRef.current.duration;
            setDuration(dur);
            setIsLoading(false);

            if (resumeTimeRef.current > 5 && Math.abs(videoRef.current.currentTime - resumeTimeRef.current) > 2) {
              videoRef.current.currentTime = resumeTimeRef.current;
              setCurrentTime(resumeTimeRef.current);
              hasResumedRef.current = true;
            }
            saveProgress();
          }
        }}
        onEnded={() => {
          if (videoRef.current) {
            saveProgress(videoRef.current.duration, videoRef.current.duration);
          }
          if (onNextEpisode) onNextEpisode();
        }}
        onError={() => {
          console.warn('Native video element onError triggered');
          setIsLoading(false);
          setHasError(true);
          setErrorMessage(t('playbackErrorMsg'));
        }}
      />

      {/* Loading Spinner */}
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none bg-black/40">
          <Loader2 className="w-14 h-14 text-[#E50914] animate-spin mb-3" />
          <span className="text-white text-sm font-semibold tracking-wider">{t('buffering')}</span>
        </div>
      )}

      {/* 🎬 Netflix-Style Auto-Resume Notification */}
      {resumeToast?.show && (
        <div className="absolute top-[calc(4.5rem+env(safe-area-inset-top,0px))] sm:top-[calc(5.5rem+env(safe-area-inset-top,0px))] left-1/2 -translate-x-1/2 z-50 flex items-center space-x-3 bg-black/85 backdrop-blur-md border border-white/20 px-4 py-2 sm:py-2.5 rounded-full shadow-2xl transition-all animate-in fade-in zoom-in-95 duration-200 pointer-events-auto">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#E50914] animate-pulse inline-block" />
            <span className="text-white text-xs sm:text-sm font-medium whitespace-nowrap">
              {t('resumedFrom')} <span className="font-bold text-[#E50914]">{formatTime(resumeToast.time)}</span>
            </span>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleSeek(0);
              setResumeToast(null);
            }}
            className="text-xs bg-white/15 hover:bg-[#E50914] text-white font-bold px-3 py-1 rounded-full border border-white/15 transition-all hover:scale-105 active:scale-95 cursor-pointer whitespace-nowrap"
          >
            {t('restart')}
          </button>
        </div>
      )}

      {/* 📺 Apple AirPlay Active Floating Indicator */}
      {isAirPlayActive && (
        <div className="absolute top-[calc(4.5rem+env(safe-area-inset-top,0px))] sm:top-[calc(5.5rem+env(safe-area-inset-top,0px))] right-4 sm:right-8 z-40 bg-black/85 backdrop-blur-md border border-[#E50914]/50 px-4 py-2 sm:py-2.5 rounded-2xl flex items-center space-x-3 shadow-2xl animate-in fade-in duration-300">
          <div className="w-8 h-8 rounded-full bg-[#E50914]/20 flex items-center justify-center text-[#E50914]">
            <Airplay className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="text-white text-xs sm:text-sm font-bold flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block animate-ping" />
              <span>{t('airplayActive')}</span>
            </div>
            <p className="text-[10px] sm:text-xs text-gray-400">{t('airplayStreamingTo')}</p>
          </div>
        </div>
      )}

      {/* 📋 Stream Link Copied Toast */}
      {copiedToast && (
        <div className="absolute top-[calc(4.5rem+env(safe-area-inset-top,0px))] sm:top-[calc(5.5rem+env(safe-area-inset-top,0px))] left-1/2 -translate-x-1/2 z-50 bg-black/90 backdrop-blur-md border border-white/20 text-white text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-full shadow-2xl flex items-center space-x-2 animate-in fade-in zoom-in-95 duration-200">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{t('linkCopiedToast')}</span>
        </div>
      )}

      {/* 📱 Netflix Gesture Feedbacks (iPhone / iPad) */}

      {/* 1. Double-Tap Left Ripple (-10s) */}
      {gestureIndicator?.type === 'ripple_left' && (
        <div className="absolute left-[12%] sm:left-[18%] top-1/2 -translate-y-1/2 pointer-events-none z-40 flex flex-col items-center justify-center bg-black/70 backdrop-blur-md rounded-full w-24 h-24 border border-white/20 animate-in zoom-in-75 duration-200 shadow-2xl">
          <RotateCcw className="w-8 h-8 text-white mb-1" />
          <span className="text-white text-xs font-black tracking-wider">-10s</span>
        </div>
      )}

      {/* 2. Double-Tap Right Ripple (+10s) */}
      {gestureIndicator?.type === 'ripple_right' && (
        <div className="absolute right-[12%] sm:right-[18%] top-1/2 -translate-y-1/2 pointer-events-none z-40 flex flex-col items-center justify-center bg-black/70 backdrop-blur-md rounded-full w-24 h-24 border border-white/20 animate-in zoom-in-75 duration-200 shadow-2xl">
          <RotateCw className="w-8 h-8 text-white mb-1" />
          <span className="text-white text-xs font-black tracking-wider">+10s</span>
        </div>
      )}

      {/* 3. Left-Side Vertical Brightness Slider */}
      {gestureIndicator?.type === 'brightness' && (
        <div className="absolute left-6 sm:left-12 top-1/2 -translate-y-1/2 pointer-events-none z-40 flex flex-col items-center bg-black/80 backdrop-blur-md px-3.5 py-4 rounded-2xl border border-white/15 shadow-2xl animate-in fade-in duration-150">
          <Sun className="w-5 h-5 text-yellow-400 mb-3" />
          <div className="w-2 h-28 bg-white/20 rounded-full relative overflow-hidden mb-2">
            <div
              className="w-full bg-yellow-400 absolute bottom-0 transition-all rounded-full"
              style={{ height: `${gestureIndicator.value}%` }}
            />
          </div>
          <span className="text-[10px] font-bold text-white font-mono">{gestureIndicator.value}%</span>
        </div>
      )}

      {/* 4. Right-Side Vertical Volume Slider */}
      {gestureIndicator?.type === 'volume' && (
        <div className="absolute right-6 sm:right-12 top-1/2 -translate-y-1/2 pointer-events-none z-40 flex flex-col items-center bg-black/80 backdrop-blur-md px-3.5 py-4 rounded-2xl border border-white/15 shadow-2xl animate-in fade-in duration-150">
          {gestureIndicator.value && gestureIndicator.value > 0 ? (
            <Volume2 className="w-5 h-5 text-white mb-3" />
          ) : (
            <VolumeX className="w-5 h-5 text-red-500 mb-3" />
          )}
          <div className="w-2 h-28 bg-white/20 rounded-full relative overflow-hidden mb-2">
            <div
              className="w-full bg-[#E50914] absolute bottom-0 transition-all rounded-full"
              style={{ height: `${gestureIndicator.value}%` }}
            />
          </div>
          <span className="text-[10px] font-bold text-white font-mono">{gestureIndicator.value}%</span>
        </div>
      )}

      {/* 5. Center Seek Progress Indicator */}
      {gestureIndicator?.type === 'seek' && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-40 flex items-center space-x-2.5 bg-black/85 backdrop-blur-md px-5 py-3 rounded-full border border-white/20 shadow-2xl">
          <FastForward className="w-5 h-5 text-[#E50914]" />
          <span className="text-white text-xs sm:text-sm font-bold tracking-wide font-mono">
            {gestureIndicator.text}
          </span>
        </div>
      )}

      {/* 6. Aspect Ratio Pinch Toast */}
      {gestureIndicator?.type === 'aspect' && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 pointer-events-none z-40 bg-black/85 backdrop-blur-md px-4 py-2 rounded-full border border-white/20 text-white text-xs font-bold shadow-2xl">
          {gestureIndicator.text}
        </div>
      )}

      {/* Error State */}
      {hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 p-6 text-center z-40">
          <AlertCircle className="w-16 h-16 text-[#E50914] mb-4 animate-bounce" />
          <h2 className="text-xl font-bold text-white mb-2">{t('playbackError')}</h2>
          <p className="text-gray-400 text-sm max-w-md mb-6">{errorMessage || t('playbackErrorMsg')}</p>
          <div className="flex items-center space-x-3">
            {allGroups.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  const nextGroupIdx = (activeGroupIndex + 1) % allGroups.length;
                  setActiveGroupIndex(nextGroupIdx);
                  const nextGroup = allGroups[nextGroupIdx];
                  if (nextGroup && nextGroup.episodes.length > 0) {
                    const sameEp =
                      nextGroup.episodes.find((e) => e.name === activeEp?.name) || nextGroup.episodes[0];
                    setActiveEp(sameEp);
                    setHasError(false);
                    setIsLoading(true);
                  }
                }}
                className="px-5 py-2.5 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-bold border border-white/20 transition-all hover:scale-105 cursor-pointer flex items-center space-x-1.5"
              >
                <span>⚡ {t('switchingLine')}</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleClose}
              className="px-6 py-2.5 bg-[#E50914] text-white rounded-xl text-xs font-bold hover:bg-[#b80710] transition-all hover:scale-105 cursor-pointer"
            >
              {t('returnToSelection')}
            </button>
          </div>
        </div>
      )}

      {/* Top Overlay Bar */}
      <div
        onClick={(e) => {
          e.stopPropagation();
          resetHideTimer();
        }}
        onTouchStart={(e) => {
          e.stopPropagation();
          resetHideTimer();
        }}
        onTouchEnd={(e) => {
          e.stopPropagation();
          resetHideTimer();
        }}
        className={`absolute top-0 left-0 right-0 pt-[calc(1rem+env(safe-area-inset-top,0px))] sm:pt-[calc(1.5rem+env(safe-area-inset-top,0px))] pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] pb-4 sm:pb-6 bg-gradient-to-b from-black/90 via-black/40 to-transparent flex items-center justify-between transition-opacity duration-300 z-30 ${
          controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center space-x-4">
          <button
            onClick={handleClose}
            className="p-2 rounded-full hover:bg-white/20 text-white transition-all hover:scale-110 cursor-pointer"
            aria-label={t('back')}
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-white leading-tight">
              {movie?.title}
            </h1>
            <p className="text-xs text-gray-300">
              {activeEp?.name} • {t('ultraFastLine')}
            </p>
          </div>
        </div>

        {/* Top Right Info Badge */}
        <div className="flex items-center space-x-2">
          <span className="bg-[#E50914] text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase">
            HLS STREAM
          </span>
        </div>
      </div>

      {/* Bottom Control Bar */}
      <div
        onClick={(e) => {
          e.stopPropagation();
          resetHideTimer();
        }}
        onTouchStart={(e) => {
          e.stopPropagation();
          resetHideTimer();
        }}
        onTouchEnd={(e) => {
          e.stopPropagation();
          resetHideTimer();
        }}
        className={`absolute bottom-0 left-0 right-0 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] pt-4 sm:pt-6 bg-gradient-to-t from-black/95 via-black/60 to-transparent transition-opacity duration-300 z-30 ${
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
              className="p-1 hover:text-[#E50914] transition-colors cursor-pointer"
              aria-label={isPlaying ? t('pauseLabel') : t('playLabel')}
            >
              {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current" />}
            </button>

            {/* -10s */}
            <button
              onClick={handleRewind10s}
              className="p-1 hover:text-[#E50914] transition-colors"
              title={t('rewind10s')}
            >
              <RotateCcw className="w-5 h-5" />
            </button>

            {/* +10s */}
            <button
              onClick={handleForward10s}
              className="p-1 hover:text-[#E50914] transition-colors"
              title={t('forward10s')}
            >
              <RotateCw className="w-5 h-5" />
            </button>

            {/* Skip Intro (+90s) */}
            <button
              onClick={() => handleSeek(Math.min(duration, currentTime + 90))}
              className="hidden sm:flex items-center text-xs font-semibold bg-white/20 hover:bg-white/30 px-2.5 py-1 rounded transition-colors"
              title={`${t('skipIntro')} (+90s)`}
            >
              <FastForward className="w-3.5 h-3.5 mr-1" />
              {t('skipIntro')}
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
            <div
              className="relative"
              onClick={(e) => {
                e.stopPropagation();
                resetHideTimer();
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                resetHideTimer();
              }}
              onTouchEnd={(e) => {
                e.stopPropagation();
                resetHideTimer();
              }}
            >
              <button
                onClick={() => setSpeedMenuOpen(!speedMenuOpen)}
                className="flex items-center text-xs font-semibold hover:text-[#E50914] transition-colors cursor-pointer"
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
                      className={`text-xs px-3 py-1 rounded text-left transition-colors cursor-pointer ${
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
            {allGroups.length > 0 && (
              <div
                className="relative"
                onClick={(e) => {
                  e.stopPropagation();
                  resetHideTimer();
                }}
                onTouchStart={(e) => {
                  e.stopPropagation();
                  resetHideTimer();
                }}
                onTouchEnd={(e) => {
                  e.stopPropagation();
                  resetHideTimer();
                }}
              >
                <button
                  type="button"
                  onClick={() => setEpMenuOpen(!epMenuOpen)}
                  className="flex items-center text-xs font-semibold hover:text-[#E50914] transition-colors cursor-pointer"
                  title={t('selectEpisode')}
                >
                  <ListVideo className="w-5 h-5" />
                </button>
                {epMenuOpen && (
                  <div className="absolute bottom-8 right-0 bg-[#181818] border border-white/20 rounded-xl p-3 shadow-2xl w-72 max-h-80 overflow-y-auto no-scrollbar z-50">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-bold text-gray-300">{t('selectEpisode')}</h4>
                      {allGroups.length > 1 && (
                        <span className="text-[10px] text-gray-400 font-mono">
                          {allGroups[activeGroupIndex]?.from || `线路 ${activeGroupIndex + 1}`}
                        </span>
                      )}
                    </div>

                    {/* Group/Line Tabs if multiple lines exist */}
                    {allGroups.length > 1 && (
                      <div className="flex items-center space-x-1.5 mb-2.5 overflow-x-auto no-scrollbar pb-1">
                        {allGroups.map((grp, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setActiveGroupIndex(idx)}
                            className={`text-[10px] px-2.5 py-1 rounded-md font-medium whitespace-nowrap transition-colors cursor-pointer ${
                              activeGroupIndex === idx
                                ? 'bg-[#E50914] text-white font-bold'
                                : 'bg-white/10 text-gray-300 hover:bg-white/20'
                            }`}
                          >
                            {grp.from}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-2">
                      {allGroups[activeGroupIndex]?.episodes.map((ep, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setActiveEp(ep);
                            setEpMenuOpen(false);
                          }}
                          className={`text-xs p-1.5 rounded truncate transition-colors cursor-pointer ${
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

            {/* Apple AirPlay & Cast Button */}
            <div
              className="relative"
              onClick={(e) => {
                e.stopPropagation();
                resetHideTimer();
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                resetHideTimer();
              }}
              onTouchEnd={(e) => {
                e.stopPropagation();
                resetHideTimer();
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setCastMenuOpen(!castMenuOpen);
                  setSpeedMenuOpen(false);
                  setEpMenuOpen(false);
                }}
                className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  isAirPlayActive
                    ? 'bg-[#E50914] text-white shadow-lg ring-2 ring-[#E50914]/50 animate-pulse'
                    : 'text-gray-300 hover:text-white hover:bg-white/10'
                }`}
                title={t('castAppleEcosystem')}
                aria-label={t('castAppleEcosystem')}
              >
                <Airplay className={`w-4 h-4 ${isAirPlayActive ? 'text-white' : ''}`} />
                <span className="hidden sm:inline">
                  {isAirPlayActive ? t('airplayActive') : t('airplay')}
                </span>
              </button>

              {/* AirPlay & Apple TV Casting Popover */}
              {castMenuOpen && (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    resetHideTimer();
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                    resetHideTimer();
                  }}
                  onTouchEnd={(e) => {
                    e.stopPropagation();
                    resetHideTimer();
                  }}
                  className="absolute bottom-10 right-0 bg-[#181818]/95 backdrop-blur-xl border border-white/20 rounded-2xl p-4 shadow-2xl w-80 sm:w-96 max-h-[80vh] overflow-y-auto no-scrollbar z-50 animate-in fade-in zoom-in-95"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 rounded-md bg-[#E50914] flex items-center justify-center text-white">
                        <Airplay className="w-3.5 h-3.5" />
                      </div>
                      <h4 className="text-sm font-bold text-white tracking-wide">
                        {t('castAppleEcosystem')}
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCastMenuOpen(false)}
                      className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-white/10 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Primary Action: Direct AirPlay Launch */}
                  <button
                    type="button"
                    onClick={() => {
                      handleLaunchAirPlay();
                    }}
                    className="w-full mb-3 flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-[#E50914] to-[#B20710] hover:brightness-110 text-white font-bold transition-all shadow-lg hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center">
                        <Airplay className="w-5 h-5 text-white" />
                      </div>
                      <div className="text-left">
                        <div className="text-sm font-bold flex items-center space-x-1.5">
                          <span>{t('launchAirPlay')}</span>
                          {isAirPlayActive && (
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          )}
                        </div>
                        <div className="text-[11px] text-white/80 font-normal">
                          {t('castAppleTvSupport')}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-white/70" />
                  </button>

                  {/* Secondary: Apple TV Dedicated Players (Infuse / VLC) */}
                  <div className="space-y-2 mb-3">
                    <div className="text-[11px] font-semibold text-gray-400 px-0.5">
                      {t('appleTvDedicatedPlayer')}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (activeEp?.url) {
                            window.open(
                              'infuse://control/open?url=' + encodeURIComponent(activeEp.url),
                              '_blank'
                            );
                          }
                        }}
                        className="flex items-center justify-center space-x-1.5 py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-all border border-white/10 hover:border-white/20 cursor-pointer"
                        title={t('openWithInfuse')}
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-orange-400" />
                        <span>{t('openInInfuse')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (activeEp?.url) {
                            window.open('vlc://' + activeEp.url, '_blank');
                          }
                        }}
                        className="flex items-center justify-center space-x-1.5 py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-all border border-white/10 hover:border-white/20 cursor-pointer"
                        title={t('openWithVlc')}
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-amber-500" />
                        <span>{t('openInVlc')}</span>
                      </button>
                    </div>

                    {/* Copy Stream Link */}
                    <button
                      type="button"
                      onClick={handleCopyStreamLink}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl bg-white/5 hover:bg-white/15 text-white text-xs transition-all border border-white/10 cursor-pointer"
                    >
                      <div className="flex items-center space-x-2 truncate mr-2">
                        {copiedToast ? (
                          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <Copy className="w-4 h-4 text-gray-300 shrink-0" />
                        )}
                        <span className="font-medium truncate">
                          {copiedToast ? t('linkCopiedToast') : t('copyStreamLink')}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-400 bg-white/10 px-2 py-0.5 rounded font-mono shrink-0">
                        .m3u8
                      </span>
                    </button>
                  </div>

                  {/* Cast Guide Accordion */}
                  <div className="pt-2 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => setShowGuide(!showGuide)}
                      className="w-full flex items-center justify-between text-[11px] text-gray-400 hover:text-white transition-colors cursor-pointer"
                    >
                      <span className="flex items-center space-x-1.5">
                        <Info className="w-3.5 h-3.5 text-blue-400" />
                        <span>{t('appleEcosystemGuide')}</span>
                      </span>
                      <span className="text-[10px] text-gray-400 hover:underline">
                        {showGuide ? t('collapseGuide') : t('viewGuide')}
                      </span>
                    </button>

                    {showGuide && (
                      <div className="mt-2 text-[11px] text-gray-300 space-y-1.5 bg-black/40 p-3 rounded-xl border border-white/10 leading-relaxed animate-in fade-in duration-200">
                        <div className="flex items-start space-x-1.5">
                          <span className="text-[#E50914] font-bold">1.</span>
                          <span>{t('guideStep1')}</span>
                        </div>
                        <div className="flex items-start space-x-1.5">
                          <span className="text-[#E50914] font-bold">2.</span>
                          <span>{t('guideStep2')}</span>
                        </div>
                        <div className="flex items-start space-x-1.5">
                          <span className="text-[#E50914] font-bold">3.</span>
                          <span>{t('guideStep3')}</span>
                        </div>
                        <div className="flex items-start space-x-1.5">
                          <span className="text-[#E50914] font-bold">4.</span>
                          <span>{t('guideStep4')}</span>
                        </div>
                        <div className="pt-1 text-[10px] text-gray-400 border-t border-white/10 italic">
                          💡 {t('safariRecommended')}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Fullscreen Toggle */}
            <button
              onClick={toggleFullscreen}
              className="hover:text-[#E50914] transition-colors cursor-pointer"
              aria-label={isFullscreen ? t('exitFullscreen') : t('fullscreen')}
              title={isFullscreen ? t('exitFullscreen') : t('fullscreen')}
            >
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
