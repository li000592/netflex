import React, { useState } from 'react';
import { X, Sparkles, Eye, EyeOff, Mail, User as UserIcon } from 'lucide-react';
import { login, register, quickDemoLogin, signInWithGoogle } from '../services/auth';
import { User } from '../types';
import { useI18n, LanguageSelector } from '../i18n';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: User) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { t, language } = useI18n();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [account, setAccount] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const res = await login(account, password);
        if (res.success && res.user) {
          onSuccess(res.user);
          onClose();
        } else {
          setError(res.error || t('accountNotFound'));
        }
      } else {
        const res = await register(account, username, password);
        if (res.success && res.user) {
          onSuccess(res.user);
          onClose();
        } else {
          setError(res.error || t('fillAllFields'));
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Authentication failed. Please check network.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await signInWithGoogle();
      if (!res.success && res.error) {
        setError(res.error);
        setLoading(false);
      }
      // If success, browser will be redirected to Google OAuth consent page
    } catch (err: any) {
      setError(err?.message || 'Google Sign-In failed');
      setLoading(false);
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
          <div className="mb-4 p-3 bg-[#E50914]/20 border border-[#E50914]/50 rounded-lg text-xs text-red-200 flex flex-col gap-1.5">
            <div>{error}</div>
            {mode === 'login' && error.includes(t('accountNotFound')) && (
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setUsername(account.split('@')[0] || account);
                  setError('');
                }}
                className="text-left font-bold text-white underline hover:text-red-300 transition-colors"
              >
                👉 {t('signUpNow')}
              </button>
            )}
          </div>
        )}

        {/* Google OAuth Button */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full bg-white hover:bg-gray-100 disabled:opacity-60 text-gray-800 font-bold py-3 px-4 rounded-lg text-sm transition-all shadow-md flex items-center justify-center space-x-3 cursor-pointer mb-5 active:scale-[0.98]"
        >
          <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>{language === 'en' ? 'Continue with Google' : '使用 Google 账号登录'}</span>
        </button>

        {/* Divider */}
        <div className="flex items-center my-4">
          <div className="flex-1 border-t border-white/15" />
          <span className="px-3 text-xs text-gray-400 font-semibold uppercase tracking-wider">
            {language === 'en' ? 'OR' : '或者'}
          </span>
          <div className="flex-1 border-t border-white/15" />
        </div>

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
            disabled={loading}
            className="w-full bg-[#E50914] hover:bg-[#b80710] disabled:opacity-60 text-white font-bold py-3.5 rounded-lg text-base transition-transform active:scale-[0.98] shadow-lg mt-2 flex items-center justify-center space-x-2"
          >
            {loading && (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            <span>{mode === 'login' ? t('authSignInTitle') : t('authSignUpTitle')}</span>
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
