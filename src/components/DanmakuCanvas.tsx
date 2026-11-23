import React, { useEffect, useRef } from 'react';
import { DanmakuItem, DanmakuSettings } from '../services/danmaku';

interface DanmakuCanvasProps {
  comments: DanmakuItem[];
  currentTime: number;
  isPlaying: boolean;
  playbackRate?: number;
  settings: DanmakuSettings;
}

interface ActiveDanmaku {
  item: DanmakuItem;
  x: number;
  y: number;
  width: number;
  speed: number; // pixels per second for scrolling
  channel: number;
  spawnTime: number; // in seconds
  duration: number; // seconds for fixed top/bottom
}

export const DanmakuCanvas: React.FC<DanmakuCanvasProps> = ({
  comments,
  currentTime,
  isPlaying,
  playbackRate = 1,
  settings,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeDanmakusRef = useRef<ActiveDanmaku[]>([]);
  const lastTimeRef = useRef<number>(currentTime);
  const commentIndexRef = useRef<number>(0);
  const channelEndsRef = useRef<{ [channel: number]: number }>({}); // track rightmost x coordinate
  const topOccupiedRef = useRef<{ [channel: number]: number }>({});
  const bottomOccupiedRef = useRef<{ [channel: number]: number }>({});

  // Reset index and active danmakus on major seek
  useEffect(() => {
    const diff = Math.abs(currentTime - lastTimeRef.current);
    if (diff > 1.5) {
      activeDanmakusRef.current = [];
      channelEndsRef.current = {};
      topOccupiedRef.current = {};
      bottomOccupiedRef.current = {};

      // Binary search or linear scan for the next comment index
      let idx = 0;
      while (idx < comments.length && comments[idx].time < currentTime) {
        idx++;
      }
      commentIndexRef.current = idx;
    }
    lastTimeRef.current = currentTime;
  }, [currentTime, comments]);

  // Main Animation & Rendering Loop
  useEffect(() => {
    let animId: number;
    let lastTimestamp = performance.now();

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI displays
    const handleResize = () => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    const render = (now: number) => {
      const deltaSec = Math.min((now - lastTimestamp) / 1000, 0.1);
      lastTimestamp = now;

      if (!settings.enabled || !canvas) {
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        animId = requestAnimationFrame(render);
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      if (width === 0 || height === 0) {
        animId = requestAnimationFrame(render);
        return;
      }

      const dpr = window.devicePixelRatio || 1;
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const fontSize = settings.fontSize;
      const channelHeight = fontSize * 1.35;
      let maxChannels = Math.floor(height / channelHeight) - 1;
      if (settings.area === 'half') {
        maxChannels = Math.floor((height * 0.5) / channelHeight);
      } else if (settings.area === 'top') {
        maxChannels = Math.floor((height * 0.3) / channelHeight);
      }
      maxChannels = Math.max(1, maxChannels);

      // Measure font
      ctx.font = `bold ${fontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`;
      ctx.textBaseline = 'top';
      ctx.globalAlpha = Math.max(0.1, Math.min(1.0, settings.opacity));

      // 1. Spawn new comments matching current time window
      if (isPlaying) {
        while (
          commentIndexRef.current < comments.length &&
          comments[commentIndexRef.current].time <= currentTime
        ) {
          const item = comments[commentIndexRef.current];
          commentIndexRef.current++;

          // Filtering
          if (item.mode === 'top' && settings.blockTop) continue;
          if (item.mode === 'bottom' && settings.blockBottom) continue;
          if (item.mode === 'right' && settings.blockScroll) continue;

          const textWidth = ctx.measureText(item.text).width;

          if (item.mode === 'top') {
            // Find top channel
            let targetChannel = 0;
            for (let ch = 0; ch < maxChannels; ch++) {
              if (!topOccupiedRef.current[ch] || topOccupiedRef.current[ch] < currentTime) {
                targetChannel = ch;
                break;
              }
            }
            topOccupiedRef.current[targetChannel] = currentTime + 3.5;
            activeDanmakusRef.current.push({
              item,
              x: (width - textWidth) / 2,
              y: targetChannel * channelHeight + 12,
              width: textWidth,
              speed: 0,
              channel: targetChannel,
              spawnTime: currentTime,
              duration: 3.5,
            });
          } else if (item.mode === 'bottom') {
            // Find bottom channel
            let targetChannel = 0;
            for (let ch = 0; ch < maxChannels; ch++) {
              if (!bottomOccupiedRef.current[ch] || bottomOccupiedRef.current[ch] < currentTime) {
                targetChannel = ch;
                break;
              }
            }
            bottomOccupiedRef.current[targetChannel] = currentTime + 3.5;
            activeDanmakusRef.current.push({
              item,
              x: (width - textWidth) / 2,
              y: height - (targetChannel + 1) * channelHeight - 40,
              width: textWidth,
              speed: 0,
              channel: targetChannel,
              spawnTime: currentTime,
              duration: 3.5,
            });
          } else {
            // Scroll from right to left
            // Speed based on width + textWidth / standard 6s
            const baseDuration = 6.5 / Math.max(0.5, settings.speed * playbackRate);
            const speed = (width + textWidth) / baseDuration;

            // Pick channel with least collision
            let bestChannel = 0;
            let minConflictX = Infinity;

            for (let ch = 0; ch < maxChannels; ch++) {
              const lastX = channelEndsRef.current[ch];
              if (lastX === undefined || lastX < width - 60) {
                bestChannel = ch;
                minConflictX = 0;
                break;
              }
              if (lastX < minConflictX) {
                minConflictX = lastX;
                bestChannel = ch;
              }
            }

            channelEndsRef.current[bestChannel] = width + textWidth;
            activeDanmakusRef.current.push({
              item,
              x: width,
              y: bestChannel * channelHeight + 12,
              width: textWidth,
              speed,
              channel: bestChannel,
              spawnTime: currentTime,
              duration: 0,
            });
          }
        }
      }

      // 2. Update and draw active danmakus
      const remaining: ActiveDanmaku[] = [];

      for (const dm of activeDanmakusRef.current) {
        if (dm.item.mode === 'top' || dm.item.mode === 'bottom') {
          // Fixed display
          if (currentTime - dm.spawnTime < dm.duration && currentTime >= dm.spawnTime - 1) {
            // Draw text shadow / stroke
            ctx.fillStyle = dm.item.color || '#ffffff';
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
            ctx.lineWidth = 3.5;
            ctx.strokeText(dm.item.text, dm.x, dm.y);
            ctx.fillText(dm.item.text, dm.x, dm.y);
            remaining.push(dm);
          }
        } else {
          // Scrolling
          if (isPlaying) {
            dm.x -= dm.speed * deltaSec;
          }
          channelEndsRef.current[dm.channel] = dm.x + dm.width;

          if (dm.x + dm.width > 0) {
            ctx.fillStyle = dm.item.color || '#ffffff';
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
            ctx.lineWidth = 3.5;
            ctx.strokeText(dm.item.text, dm.x, dm.y);
            ctx.fillText(dm.item.text, dm.x, dm.y);
            remaining.push(dm);
          }
        }
      }

      activeDanmakusRef.current = remaining;
      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [comments, isPlaying, playbackRate, settings]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-15"
      style={{
        zIndex: 15,
        display: settings.enabled ? 'block' : 'none',
      }}
    />
  );
};
