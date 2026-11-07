import React, { useState } from 'react';
import { X, Sparkles, Eye, EyeOff, Mail, User as UserIcon } from 'lucide-react';
import { login, register, quickDemoLogin } from '../services/auth';
import { User } from '../types';
import { useI18n, LanguageSelector } from '../i18n';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: User) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { t } = useI18n();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [account, setAccount] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (mode === 'login') {
      const res = login(account, password);
      if (res.success && res.user) {
        onSuccess(res.user);
        onClose();
      } else {
        setError(res.error || t('accountNotFound'));
      }
    } else {
      const res = register(account, username, password);
      if (res.success && res.user) {
        onSuccess(res.user);
        onClose();
      } else {
        setError(res.error || t('fillAllFields'));
      }
    }
  };

  const handleQuickDemo = () => {
    const demoUser = quickDemoLogin();
    onSuccess(demoUser);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none">
      {/* Blurred Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity"
      />

      {/* Netflix Sign In Box */}
      <div className="relative z-10 w-full max-w-[450px] bg-black/85 border border-white/10 rounded-xl p-8 sm:p-12 shadow-2xl backdrop-blur-xl">
        {/* Top Controls: Language + Close */}
        <div className="absolute top-5 right-5 flex items-center space-x-2">
          <LanguageSelector />
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Logo / Header */}
        <div className="text-center sm:text-left mb-6 mt-2">
          <span className="text-[#E50914] font-black tracking-wider text-2xl font-sans inline-block mb-3">
            NETFLEX
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-white">
            {mode === 'login' ? t('authSignInTitle') : t('authSignUpTitle')}
          </h2>
        </div>

        {/* Error notification */}
        {error && (
          <div className="mb-4 p-3 bg-[#E50914]/20 border border-[#E50914]/50 rounded-lg text-xs text-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <div className="relative">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t('username')}
                  required
                  className="w-full bg-[#333333] text-white px-4 py-3.5 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#E50914] focus:bg-[#404040] transition-all placeholder-gray-400"
                />
                <UserIcon className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>
            </div>
          )}

          <div>
            <div className="relative">
              <input
                type="text"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                placeholder={mode === 'login' ? t('emailOrUsername') : t('email')}
                required
                className="w-full bg-[#333333] text-white px-4 py-3.5 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#E50914] focus:bg-[#404040] transition-all placeholder-gray-400"
              />
              <Mail className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            </div>
          </div>

          <div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('password')}
                required
                className="w-full bg-[#333333] text-white px-4 py-3.5 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#E50914] focus:bg-[#404040] transition-all placeholder-gray-400"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Primary Submit Button */}
          <button
            type="submit"
            className="w-full bg-[#E50914] hover:bg-[#b80710] text-white font-bold py-3.5 rounded-lg text-base transition-transform active:scale-[0.98] shadow-lg mt-2"
          >
            {mode === 'login' ? t('authSignInTitle') : t('authSignUpTitle')}
          </button>

          {/* Quick Demo Button */}
          <button
            type="button"
            onClick={handleQuickDemo}
            className="w-full bg-white/10 hover:bg-white/20 text-white font-semibold py-3 rounded-lg text-xs sm:text-sm transition-all border border-white/20 flex items-center justify-center"
          >
            <Sparkles className="w-4 h-4 text-[#E50914] mr-2" />
            {t('quickDemo')}
          </button>

          {/* Extra Row */}
          <div className="flex items-center justify-between text-xs text-gray-400 pt-1">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded accent-[#E50914] w-3.5 h-3.5"
              />
              <span>{t('rememberMe')}</span>
            </label>
            <a href="#help" onClick={(e) => e.preventDefault()} className="hover:underline">
              {t('needHelp')}
            </a>
          </div>
        </form>

        {/* Footer Toggle Mode */}
        <div className="mt-8 pt-6 border-t border-white/10 text-sm text-gray-400">
          {mode === 'login' ? (
            <p>
              {t('newToNetflex')}{' '}
              <button
                onClick={() => {
                  setMode('register');
                  setError('');
                }}
                className="text-white hover:underline font-semibold ml-1"
              >
                {t('signUpNow')}
              </button>
            </p>
          ) : (
            <p>
              {t('alreadyHaveAccount')}{' '}
              <button
                onClick={() => {
                  setMode('login');
                  setError('');
                }}
                className="text-white hover:underline font-semibold ml-1"
              >
                {t('signInNow')}
              </button>
            </p>
          )}

          <p className="text-[11px] text-gray-500 mt-4 leading-relaxed">
            {t('recaptchaNote')}
          </p>
        </div>
      </div>
    </div>
  );
};
