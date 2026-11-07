import React, { useState, useEffect } from 'react';
import {
  Search,
  Bookmark,
  Menu,
  X,
  Film,
  Tv,
  PlaySquare,
  Sparkles,
  ChevronDown,
  LogOut,
  Users,
  History,
  Check,
  Flower2,
  Settings,
} from 'lucide-react';
import { NavTab, User, UserProfile } from '../types';
import { useI18n, LanguageSelector } from '../i18n';

interface NavbarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onSearch: (query: string) => void;
  searchQuery: string;
  currentUser: User | null;
  currentProfile: UserProfile | null;
  onOpenAuth: () => void;
  onOpenProfileModal: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
  onSwitchProfile: (profileId: string) => void;
  huakaiEnabled: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  onSearch,
  searchQuery,
  currentUser,
  currentProfile,
  onOpenAuth,
  onOpenProfileModal,
  onOpenSettings,
  onLogout,
  onSwitchProfile,
  huakaiEnabled,
}) => {
  const { t } = useI18n();
  const [isScrolled, setIsScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 25);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems: { tab: NavTab; label: string; icon: React.ReactNode }[] = [
    { tab: 'home', label: t('home'), icon: <Sparkles className="w-4 h-4 mr-1.5" /> },
    { tab: 'movies', label: t('movies'), icon: <Film className="w-4 h-4 mr-1.5" /> },
    { tab: 'tv', label: t('tvShows'), icon: <Tv className="w-4 h-4 mr-1.5" /> },
    { tab: 'anime', label: t('anime'), icon: <PlaySquare className="w-4 h-4 mr-1.5" /> },
    { tab: 'variety', label: t('variety'), icon: <Sparkles className="w-4 h-4 mr-1.5" /> },
    { tab: 'huakai', label: t('huakai'), icon: <Flower2 className="w-4 h-4 mr-1.5 text-pink-400" /> },
    { tab: 'mylist', label: t('myList'), icon: <Bookmark className="w-4 h-4 mr-1.5" /> },
  ];

  const visibleNavItems = navItems.filter((item) => item.tab !== 'huakai' || huakaiEnabled);

  const handleMyListClick = () => {
    if (!currentUser) {
      onOpenAuth();
    } else {
      onSelectTab('mylist');
    }
  };

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-40 transition-colors duration-300 ${
          isScrolled
            ? 'bg-[#141414]/95 backdrop-blur-md shadow-2xl border-b border-white/5'
            : 'bg-gradient-to-b from-black/80 via-black/40 to-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
          {/* Left Brand & Navigation */}
          <div className="flex items-center space-x-3 sm:space-x-4 lg:space-x-8">
            {/* Mobile menu trigger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="sm:hidden p-2 text-gray-300 hover:text-white"
              aria-label="Menu"
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
            </div>

            {/* Desktop & Tablet Nav Links */}
            <nav className="hidden sm:flex items-center space-x-3 md:space-x-5 lg:space-x-6 text-xs md:text-sm font-medium">
              {visibleNavItems.map((item) => (
                <button
                  key={item.tab}
                  onClick={() => {
                    if (item.tab === 'mylist' && !currentUser) {
                      onOpenAuth();
                    } else {
                      onSelectTab(item.tab);
                    }
                  }}
                  className={`transition-colors duration-200 flex items-center ${
                    currentTab === item.tab
                      ? 'text-white font-bold'
                      : item.tab === 'huakai'
                      ? 'text-pink-400 hover:text-pink-300 font-semibold'
                      : 'text-gray-300 hover:text-white'
                  }`}
                >
                  {item.tab === 'huakai' && <Flower2 className="w-3.5 h-3.5 mr-1 inline text-pink-400" />}
                  {item.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Right Actions: Language, Search, Watchlist, Profile / Login */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            {/* Language Switcher in Header (Desktop) */}
            <div className="hidden md:block">
              <LanguageSelector />
            </div>

            {/* Expandable Search Input */}
            <div className="relative flex items-center">
              <div
                className={`flex items-center transition-all duration-300 rounded-full ${
                  searchOpen || searchQuery
                    ? 'w-44 sm:w-60 bg-black/80 border border-white/20 px-3 py-1.5'
                    : 'w-10 bg-transparent'
                }`}
              >
                <button
                  onClick={() => setSearchOpen(!searchOpen)}
                  className="text-gray-300 hover:text-white transition-colors"
                  aria-label="Search"
                >
                  <Search className="w-5 h-5" />
                </button>
                {(searchOpen || searchQuery) && (
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => onSearch(e.target.value)}
                    placeholder={t('searchPlaceholder')}
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
              onClick={handleMyListClick}
              className={`p-2 transition-colors relative ${
                currentTab === 'mylist' ? 'text-[#E50914]' : 'text-gray-300 hover:text-white'
              }`}
              title={t('myList')}
            >
              <Bookmark className="w-5 h-5" />
            </button>

            {/* Quick Settings Shortcut */}
            <button
              onClick={onOpenSettings}
              className="p-2 text-gray-300 hover:text-white transition-colors"
              title={t('settings')}
              aria-label={t('settings')}
            >
              <Settings className="w-5 h-5" />
            </button>

            {/* Profile Menu or Netflix Sign In Button */}
            {currentUser ? (
              <div className="relative">
                <button
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className="flex items-center space-x-1.5 focus:outline-none group"
                >
                  <img
                    src={
                      currentProfile?.avatar ||
                      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces'
                    }
                    alt={currentProfile?.name || 'Profile'}
                    className="w-8 h-8 sm:w-9 sm:h-9 rounded object-cover border border-white/20 group-hover:border-white transition-all shadow-md"
                  />
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400 group-hover:text-white transition-transform" />
                </button>

                {/* Netflix Profile Dropdown */}
                {profileDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-30"
                      onClick={() => setProfileDropdownOpen(false)}
                    />
                    <div className="absolute right-0 mt-3 w-56 bg-black/95 border border-white/15 rounded-lg shadow-2xl py-2 z-40 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
                      {/* Current user header */}
                      <div className="px-4 py-2 border-b border-white/10">
                        <p className="text-xs text-gray-400">{t('loggedInAs')}</p>
                        <p className="text-sm font-bold text-white truncate">
                          {currentProfile?.name}
                        </p>
                        <p className="text-[11px] text-gray-500 truncate">{currentUser.email}</p>
                      </div>

                      {/* Profile list switch */}
                      <div className="py-1">
                        {currentUser.profiles.map((p) => {
                          const isActive = p.id === currentUser.currentProfileId;
                          return (
                            <button
                              key={p.id}
                              onClick={() => {
                                onSwitchProfile(p.id);
                                setProfileDropdownOpen(false);
                              }}
                              className={`flex items-center justify-between w-full px-4 py-2 text-xs transition-colors ${
                                isActive
                                  ? 'bg-white/10 text-white font-bold'
                                  : 'text-gray-300 hover:bg-white/5 hover:text-white'
                              }`}
                            >
                              <div className="flex items-center space-x-2.5">
                                <img
                                  src={p.avatar}
                                  alt={p.name}
                                  className="w-6 h-6 rounded object-cover"
                                />
                                <span>{p.name}</span>
                              </div>
                              {isActive && <Check className="w-3.5 h-3.5 text-[#E50914]" />}
                            </button>
                          );
                        })}
                      </div>

                      {/* Action links */}
                      <div className="border-t border-white/10 pt-1">
                        <button
                          onClick={() => {
                            setProfileDropdownOpen(false);
                            onOpenProfileModal();
                          }}
                          className="flex items-center w-full px-4 py-2 text-xs text-gray-300 hover:bg-white/5 hover:text-white"
                        >
                          <Users className="w-3.5 h-3.5 mr-2 text-gray-400" />
                          {t('switchProfile')}
                        </button>

                        <button
                          onClick={() => {
                            setProfileDropdownOpen(false);
                            onSelectTab('mylist');
                          }}
                          className="flex items-center w-full px-4 py-2 text-xs text-gray-300 hover:bg-white/5 hover:text-white"
                        >
                          <History className="w-3.5 h-3.5 mr-2 text-gray-400" />
                          {t('myList')}
                        </button>

                        <button
                          onClick={() => {
                            setProfileDropdownOpen(false);
                            onOpenSettings();
                          }}
                          className="flex items-center w-full px-4 py-2 text-xs text-gray-300 hover:bg-white/5 hover:text-white"
                        >
                          <Settings className="w-3.5 h-3.5 mr-2 text-gray-400" />
                          {t('settings')}
                        </button>
                      </div>

                      {/* Language Switcher in dropdown */}
                      <div className="border-t border-white/10 px-4 py-2 flex items-center justify-between">
                        <span className="text-xs text-gray-400">{t('language')}</span>
                        <LanguageSelector />
                      </div>

                      {/* Sign Out */}
                      <div className="border-t border-white/10 mt-1 pt-1">
                        <button
                          onClick={() => {
                            setProfileDropdownOpen(false);
                            onLogout();
                          }}
                          className="flex items-center w-full px-4 py-2 text-xs text-red-400 hover:bg-red-500/10 hover:text-red-300"
                        >
                          <LogOut className="w-3.5 h-3.5 mr-2" />
                          {t('signOut')}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <button
                onClick={onOpenAuth}
                className="bg-[#E50914] hover:bg-[#b80710] text-white text-xs sm:text-sm font-bold px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-md transition-all shadow-md hover:scale-105 active:scale-95"
              >
                {t('signIn')}
              </button>
            )}
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="sm:hidden bg-[#141414]/98 border-b border-white/10 px-4 py-4 space-y-2 backdrop-blur-xl">
            {visibleNavItems.map((item) => (
              <button
                key={item.tab}
                onClick={() => {
                  if (item.tab === 'mylist' && !currentUser) {
                    onOpenAuth();
                  } else {
                    onSelectTab(item.tab);
                  }
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

            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenSettings();
              }}
              className="flex items-center w-full px-3 py-2.5 rounded-lg text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-all"
            >
              <Settings className="w-4 h-4 mr-2 text-gray-400" />
              {t('settings')}
            </button>

            <div className="pt-2 flex items-center justify-between px-3 py-2 border-t border-white/10">
              <span className="text-xs text-gray-400">{t('language')}</span>
              <LanguageSelector />
            </div>

            {!currentUser && (
              <div className="pt-2">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenAuth();
                  }}
                  className="w-full bg-[#E50914] text-white font-bold py-2 rounded-lg text-sm"
                >
                  {t('signIn')}
                </button>
              </div>
            )}
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
          {t('home')}
        </button>
        <button
          onClick={() => onSelectTab('movies')}
          className={`flex flex-col items-center py-1 px-2 text-[10px] ${
            currentTab === 'movies' ? 'text-[#E50914]' : 'text-gray-400'
          }`}
        >
          <Film className="w-5 h-5 mb-0.5" />
          {t('movies')}
        </button>
        <button
          onClick={() => onSelectTab('tv')}
          className={`flex flex-col items-center py-1 px-2 text-[10px] ${
            currentTab === 'tv' ? 'text-[#E50914]' : 'text-gray-400'
          }`}
        >
          <Tv className="w-5 h-5 mb-0.5" />
          {t('tvShows')}
        </button>
        <button
          onClick={() => onSelectTab('anime')}
          className={`flex flex-col items-center py-1 px-2 text-[10px] ${
            currentTab === 'anime' ? 'text-[#E50914]' : 'text-gray-400'
          }`}
        >
          <PlaySquare className="w-5 h-5 mb-0.5" />
          {t('anime')}
        </button>
        {huakaiEnabled && (
          <button
            onClick={() => onSelectTab('huakai')}
            className={`flex flex-col items-center py-1 px-2 text-[10px] ${
              currentTab === 'huakai' ? 'text-[#E50914]' : 'text-gray-400'
            }`}
          >
            <Flower2 className="w-5 h-5 mb-0.5" />
            {t('huakai')}
          </button>
        )}
        <button
          onClick={handleMyListClick}
          className={`flex flex-col items-center py-1 px-2 text-[10px] ${
            currentTab === 'mylist' ? 'text-[#E50914]' : 'text-gray-400'
          }`}
        >
          <Bookmark className="w-5 h-5 mb-0.5" />
          {t('myList')}
        </button>
      </nav>
    </>
  );
};
