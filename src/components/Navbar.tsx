import React, { useState, useEffect } from 'react';
import { Search, Bell, Bookmark, History, Menu, X, Film, Tv, PlaySquare, Sparkles } from 'lucide-react';
import { NavTab } from '../types';

interface NavbarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onSearch: (query: string) => void;
  searchQuery: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  onSearch,
  searchQuery,
}) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 25);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems: { tab: NavTab; label: string; icon: React.ReactNode }[] = [
    { tab: 'home', label: '首页', icon: <Sparkles className="w-4 h-4 mr-1.5" /> },
    { tab: 'movies', label: '电影', icon: <Film className="w-4 h-4 mr-1.5" /> },
    { tab: 'tv', label: '电视剧', icon: <Tv className="w-4 h-4 mr-1.5" /> },
    { tab: 'anime', label: '新番动漫', icon: <PlaySquare className="w-4 h-4 mr-1.5" /> },
    { tab: 'variety', label: '热门综艺', icon: <Sparkles className="w-4 h-4 mr-1.5" /> },
    { tab: 'mylist', label: '我的片单', icon: <Bookmark className="w-4 h-4 mr-1.5" /> },
  ];

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-40 transition-colors duration-300 ${
          isScrolled ? 'bg-[#141414]/95 backdrop-blur-md shadow-2xl border-b border-white/5' : 'bg-gradient-to-b from-black/80 via-black/40 to-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
          {/* Left Brand & Navigation */}
          <div className="flex items-center space-x-4 lg:space-x-8">
            {/* Mobile menu trigger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-gray-300 hover:text-white"
              aria-label="菜单"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>

            {/* Netflix Logo */}
            <div
              onClick={() => {
                onSelectTab('home');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="flex items-center cursor-pointer select-none group"
            >
              <span className="text-[#E50914] font-black tracking-wider text-2xl sm:text-3xl font-sans drop-shadow-md group-hover:scale-105 transition-transform">
                NETFLEX
              </span>
              <span className="ml-2 px-1.5 py-0.5 text-[10px] font-semibold bg-[#E50914]/20 text-[#E50914] border border-[#E50914]/40 rounded hidden sm:inline-block">
                31源聚合
              </span>
            </div>

            {/* Desktop Nav Links */}
            <nav className="hidden lg:flex items-center space-x-6 text-sm font-medium">
              {navItems.map((item) => (
                <button
                  key={item.tab}
                  onClick={() => onSelectTab(item.tab)}
                  className={`transition-colors duration-200 hover:text-white ${
                    currentTab === item.tab ? 'text-white font-bold' : 'text-gray-300'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Right Actions: Search, Notifications, Profile */}
          <div className="flex items-center space-x-3 sm:space-x-5">
            {/* Expandable Search Input */}
            <div className="relative flex items-center">
              <div
                className={`flex items-center transition-all duration-300 rounded-full ${
                  searchOpen || searchQuery
                    ? 'w-48 sm:w-64 bg-black/80 border border-white/20 px-3 py-1.5'
                    : 'w-10 bg-transparent'
                }`}
              >
                <button
                  onClick={() => setSearchOpen(!searchOpen)}
                  className="text-gray-300 hover:text-white transition-colors"
                  aria-label="搜索"
                >
                  <Search className="w-5 h-5" />
                </button>
                {(searchOpen || searchQuery) && (
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => onSearch(e.target.value)}
                    placeholder="片名、演员、导演..."
                    autoFocus
                    className="ml-2 bg-transparent text-sm text-white placeholder-gray-400 outline-none w-full"
                  />
                )}
                {searchQuery && (
                  <button
                    onClick={() => onSearch('')}
                    className="text-gray-400 hover:text-white text-xs ml-1"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Quick Watchlist Shortcut */}
            <button
              onClick={() => onSelectTab('mylist')}
              className={`p-2 transition-colors relative ${
                currentTab === 'mylist' ? 'text-[#E50914]' : 'text-gray-300 hover:text-white'
              }`}
              title="我的片单与播放历史"
            >
              <Bookmark className="w-5 h-5" />
            </button>

            {/* User Profile Avatar */}
            <div className="relative group cursor-pointer">
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces"
                alt="Profile"
                className="w-8 h-8 sm:w-9 sm:h-9 rounded object-cover border border-white/20 group-hover:border-white transition-all shadow-md"
              />
            </div>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-[#141414]/98 border-b border-white/10 px-4 py-4 space-y-2 backdrop-blur-xl">
            {navItems.map((item) => (
              <button
                key={item.tab}
                onClick={() => {
                  onSelectTab(item.tab);
                  setMobileMenuOpen(false);
                }}
                className={`flex items-center w-full px-3 py-2.5 rounded-lg text-sm transition-all ${
                  currentTab === item.tab
                    ? 'bg-[#E50914] text-white font-semibold'
                    : 'text-gray-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Mobile Bottom Navigation Bar for Native App Feel */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#141414]/95 backdrop-blur-lg border-t border-white/10 px-2 py-1.5 flex justify-around">
        <button
          onClick={() => onSelectTab('home')}
          className={`flex flex-col items-center py-1 px-2 text-[10px] ${
            currentTab === 'home' ? 'text-[#E50914]' : 'text-gray-400'
          }`}
        >
          <Sparkles className="w-5 h-5 mb-0.5" />
          首页
        </button>
        <button
          onClick={() => onSelectTab('movies')}
          className={`flex flex-col items-center py-1 px-2 text-[10px] ${
            currentTab === 'movies' ? 'text-[#E50914]' : 'text-gray-400'
          }`}
        >
          <Film className="w-5 h-5 mb-0.5" />
          电影
        </button>
        <button
          onClick={() => onSelectTab('tv')}
          className={`flex flex-col items-center py-1 px-2 text-[10px] ${
            currentTab === 'tv' ? 'text-[#E50914]' : 'text-gray-400'
          }`}
        >
          <Tv className="w-5 h-5 mb-0.5" />
          剧集
        </button>
        <button
          onClick={() => onSelectTab('anime')}
          className={`flex flex-col items-center py-1 px-2 text-[10px] ${
            currentTab === 'anime' ? 'text-[#E50914]' : 'text-gray-400'
          }`}
        >
          <PlaySquare className="w-5 h-5 mb-0.5" />
          新番
        </button>
        <button
          onClick={() => onSelectTab('mylist')}
          className={`flex flex-col items-center py-1 px-2 text-[10px] ${
            currentTab === 'mylist' ? 'text-[#E50914]' : 'text-gray-400'
          }`}
        >
          <Bookmark className="w-5 h-5 mb-0.5" />
          片单
        </button>
      </nav>
    </>
  );
};
