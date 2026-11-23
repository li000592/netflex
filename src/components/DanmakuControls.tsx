import React, { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  MessageSquareOff,
  Sliders,
  Send,
  Eye,
  Type,
  Gauge,
  LayoutTemplate,
  Palette,
} from 'lucide-react';
import { DanmakuSettings, sendDanmakuComment, DanmakuItem } from '../services/danmaku';

interface DanmakuControlsProps {
  movieTitle: string;
  episodeName: string;
  currentTime: number;
  commentsCount: number;
  settings: DanmakuSettings;
  onUpdateSettings: (newSettings: DanmakuSettings) => void;
  onAddComment: (comment: DanmakuItem) => void;
}

const COLOR_PRESETS = [
  { name: '纯白', value: '#ffffff' },
  { name: '热烈红', value: '#ff3344' },
  { name: '活力橙', value: '#ff9900' },
  { name: '明亮黄', value: '#ffea00' },
  { name: '生机绿', value: '#00e676' },
  { name: '青翠蓝', value: '#00e5ff' },
  { name: '深邃蓝', value: '#2979ff' },
  { name: '浪漫紫', value: '#d500f9' },
];

export const DanmakuControls: React.FC<DanmakuControlsProps> = ({
  movieTitle,
  episodeName,
  currentTime,
  commentsCount,
  settings,
  onUpdateSettings,
  onAddComment,
}) => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [selectedColor, setSelectedColor] = useState('#ffffff');
  const [selectedMode, setSelectedMode] = useState<'right' | 'top' | 'bottom'>('right');
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
        setColorPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = () => {
    onUpdateSettings({ ...settings, enabled: !settings.enabled });
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isSending) return;

    setIsSending(true);
    try {
      const created = await sendDanmakuComment({
        title: movieTitle,
        episode: episodeName,
        text: inputText.trim(),
        time: currentTime,
        color: selectedColor,
        mode: selectedMode,
        size: settings.fontSize,
      });

      if (created) {
        onAddComment(created);
        setInputText('');
      }
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div ref={containerRef} className="relative flex items-center gap-2">
      {/* 1. Toggle Button */}
      <button
        type="button"
        onClick={handleToggle}
        className={`relative flex items-center justify-center p-2 rounded-full transition-all ${
          settings.enabled
            ? 'text-red-500 bg-red-500/10 hover:bg-red-500/20'
            : 'text-zinc-400 hover:text-white bg-zinc-800/60 hover:bg-zinc-800'
        }`}
        title={settings.enabled ? '关闭弹幕' : '开启弹幕'}
      >
        {settings.enabled ? (
          <MessageSquare className="w-5 h-5 fill-current" />
        ) : (
          <MessageSquareOff className="w-5 h-5" />
        )}
        {commentsCount > 0 && settings.enabled && (
          <span className="absolute -top-1 -right-1 text-[9px] font-bold px-1 rounded-full bg-red-600 text-white min-w-4 text-center scale-90">
            {commentsCount > 999 ? '999+' : commentsCount}
          </span>
        )}
      </button>

      {/* 2. Danmaku Settings Trigger */}
      <button
        type="button"
        onClick={() => {
          setSettingsOpen(!settingsOpen);
          setColorPickerOpen(false);
        }}
        className={`p-2 rounded-full transition-all ${
          settingsOpen
            ? 'text-white bg-zinc-700'
            : 'text-zinc-400 hover:text-white bg-zinc-800/60 hover:bg-zinc-800'
        }`}
        title="弹幕设置"
      >
        <Sliders className="w-5 h-5" />
      </button>

      {/* 3. Danmaku Input Box & Send Bar (Desktop / Tablet) */}
      <div className="hidden sm:flex items-center gap-1.5 bg-black/60 backdrop-blur-md rounded-full px-3 py-1 border border-zinc-700/60 focus-within:border-red-500/80 transition-all">
        {/* Color Palette Button */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setColorPickerOpen(!colorPickerOpen)}
            className="w-5 h-5 rounded-full border border-white/40 shadow-sm transition-transform active:scale-95"
            style={{ backgroundColor: selectedColor }}
            title="选择弹幕颜色与样式"
          />

          {colorPickerOpen && (
            <div className="absolute bottom-9 left-0 z-50 w-52 p-3 bg-zinc-900/95 backdrop-blur-xl border border-zinc-700/80 rounded-xl shadow-2xl text-xs space-y-3">
              <div className="font-semibold text-zinc-300 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-red-400" />
                <span>弹幕颜色</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => {
                      setSelectedColor(c.value);
                      setColorPickerOpen(false);
                    }}
                    className={`h-6 rounded-md flex items-center justify-center border transition-all ${
                      selectedColor === c.value
                        ? 'border-white scale-110 shadow-lg ring-2 ring-white/50'
                        : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: c.value }}
                    title={c.name}
                  />
                ))}
              </div>

              <div className="pt-2 border-t border-zinc-800 flex items-center justify-between text-zinc-400">
                <span>弹幕模式</span>
                <div className="flex gap-1 bg-zinc-800 p-0.5 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setSelectedMode('right')}
                    className={`px-2 py-0.5 rounded text-[11px] ${
                      selectedMode === 'right' ? 'bg-red-600 text-white font-medium' : 'hover:text-white'
                    }`}
                  >
                    滚动
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedMode('top')}
                    className={`px-2 py-0.5 rounded text-[11px] ${
                      selectedMode === 'top' ? 'bg-red-600 text-white font-medium' : 'hover:text-white'
                    }`}
                  >
                    顶部
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedMode('bottom')}
                    className={`px-2 py-0.5 rounded text-[11px] ${
                      selectedMode === 'bottom' ? 'bg-red-600 text-white font-medium' : 'hover:text-white'
                    }`}
                  >
                    底部
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <form onSubmit={handleSend} className="flex items-center gap-1">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={settings.enabled ? '发个弹幕见证一下...' : '弹幕已关闭'}
            disabled={!settings.enabled || isSending}
            maxLength={100}
            className="w-40 md:w-56 bg-transparent text-xs text-white placeholder-zinc-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || !settings.enabled || isSending}
            className={`p-1 rounded-full transition-all ${
              inputText.trim() && settings.enabled
                ? 'text-red-500 hover:text-red-400 active:scale-95'
                : 'text-zinc-600 cursor-not-allowed'
            }`}
            title="发送弹幕"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>

      {/* 4. Settings Dropdown Menu */}
      {settingsOpen && (
        <div className="absolute bottom-12 right-0 z-50 w-72 p-4 bg-zinc-900/95 backdrop-blur-2xl border border-zinc-700/80 rounded-2xl shadow-2xl text-xs space-y-4 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
            <span className="font-bold text-white text-sm flex items-center gap-2">
              <Sliders className="w-4 h-4 text-red-500" />
              弹幕参数设置
            </span>
            <span className="text-[11px] text-zinc-400">
              共 {commentsCount} 条弹幕
            </span>
          </div>

          {/* Opacity */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-zinc-300 font-medium">
              <span className="flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-zinc-400" />
                不透明度
              </span>
              <span className="text-red-400 font-mono">{Math.round(settings.opacity * 100)}%</span>
            </div>
            <input
              type="range"
              min={20}
              max={100}
              step={5}
              value={settings.opacity * 100}
              onChange={(e) =>
                onUpdateSettings({ ...settings, opacity: Number(e.target.value) / 100 })
              }
              className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-red-600"
            />
          </div>

          {/* Font Size */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-zinc-300 font-medium">
              <span className="flex items-center gap-1.5">
                <Type className="w-3.5 h-3.5 text-zinc-400" />
                字号大小
              </span>
              <span className="text-zinc-400">
                {settings.fontSize === 20 ? '小' : settings.fontSize === 24 ? '中' : '大'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 bg-zinc-800/80 p-1 rounded-lg">
              {[
                { label: '小', size: 20 },
                { label: '中', size: 24 },
                { label: '大', size: 30 },
              ].map((opt) => (
                <button
                  key={opt.size}
                  type="button"
                  onClick={() => onUpdateSettings({ ...settings, fontSize: opt.size })}
                  className={`py-1 rounded text-center font-medium transition-all ${
                    settings.fontSize === opt.size
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Speed */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-zinc-300 font-medium">
              <span className="flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-zinc-400" />
                飞行速度
              </span>
              <span className="text-zinc-400 font-mono">{settings.speed}x</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 bg-zinc-800/80 p-1 rounded-lg">
              {[
                { label: '慢速', speed: 0.75 },
                { label: '标准', speed: 1.0 },
                { label: '极速', speed: 1.3 },
              ].map((opt) => (
                <button
                  key={opt.speed}
                  type="button"
                  onClick={() => onUpdateSettings({ ...settings, speed: opt.speed })}
                  className={`py-1 rounded text-center font-medium transition-all ${
                    settings.speed === opt.speed
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Area */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-zinc-300 font-medium">
              <span className="flex items-center gap-1.5">
                <LayoutTemplate className="w-3.5 h-3.5 text-zinc-400" />
                显示区域
              </span>
              <span className="text-zinc-400">
                {settings.area === 'all' ? '满屏' : settings.area === 'half' ? '半屏' : '顶部'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 bg-zinc-800/80 p-1 rounded-lg">
              {[
                { label: '满屏', area: 'all' as const },
                { label: '半屏', area: 'half' as const },
                { label: '顶部', area: 'top' as const },
              ].map((opt) => (
                <button
                  key={opt.area}
                  type="button"
                  onClick={() => onUpdateSettings({ ...settings, area: opt.area })}
                  className={`py-1 rounded text-center font-medium transition-all ${
                    settings.area === opt.area
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Shield / Block Filters */}
          <div className="pt-2 border-t border-zinc-800 space-y-2">
            <div className="text-zinc-400 font-medium">按类型屏蔽</div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({ ...settings, blockScroll: !settings.blockScroll })
                }
                className={`flex-1 py-1 rounded text-center border transition-all ${
                  settings.blockScroll
                    ? 'border-red-600 bg-red-600/20 text-red-400 font-medium'
                    : 'border-zinc-800 bg-zinc-800/60 text-zinc-400 hover:text-white'
                }`}
              >
                滚动
              </button>
              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({ ...settings, blockTop: !settings.blockTop })
                }
                className={`flex-1 py-1 rounded text-center border transition-all ${
                  settings.blockTop
                    ? 'border-red-600 bg-red-600/20 text-red-400 font-medium'
                    : 'border-zinc-800 bg-zinc-800/60 text-zinc-400 hover:text-white'
                }`}
              >
                顶部
              </button>
              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({ ...settings, blockBottom: !settings.blockBottom })
                }
                className={`flex-1 py-1 rounded text-center border transition-all ${
                  settings.blockBottom
                    ? 'border-red-600 bg-red-600/20 text-red-400 font-medium'
                    : 'border-zinc-800 bg-zinc-800/60 text-zinc-400 hover:text-white'
                }`}
              >
                底部
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
