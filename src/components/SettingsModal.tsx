import React from 'react';
import { X, Settings, Flower2, ShieldCheck, Globe } from 'lucide-react';
import { useI18n, LanguageSelector } from '../i18n';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  huakaiEnabled: boolean;
  onToggleHuakai: (enabled: boolean) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  huakaiEnabled,
  onToggleHuakai,
}) => {
  const { t } = useI18n();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none">
      {/* Dimmed backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity"
      />

      {/* Dialog Window */}
      <div className="relative z-10 w-full max-w-lg bg-[#181818] border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 sm:top-6 sm:right-6 p-1.5 text-gray-400 hover:text-white rounded-full hover:bg-white/10 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-white">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-wide">
              {t('settings')}
            </h2>
            <p className="text-xs text-gray-400">NETFLEX Preferences & Display</p>
          </div>
        </div>

        {/* Settings Groups */}
        <div className="space-y-4">
          {/* Section: Display & Privacy */}
          <div>
            <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">
              {t('privacyAndDisplay')}
            </span>

            {/* Huakai Mode Toggle Card */}
            <div className="mt-2 p-4 rounded-xl bg-[#202020] border border-white/10 flex items-center justify-between transition-colors hover:border-white/20">
              <div className="flex items-start space-x-3 pr-4">
                <div
                  className={`p-2 rounded-lg mt-0.5 transition-colors ${
                    huakaiEnabled
                      ? 'bg-pink-500/20 text-pink-400 border border-pink-500/40'
                      : 'bg-white/5 text-gray-400 border border-white/10'
                  }`}
                >
                  <Flower2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-bold text-white">{t('huakaiMode')}</span>
                    {huakaiEnabled ? (
                      <span className="text-[10px] bg-pink-500/20 text-pink-300 px-1.5 py-0.2 rounded font-mono font-bold">
                        ON
                      </span>
                    ) : (
                      <span className="text-[10px] bg-white/10 text-gray-400 px-1.5 py-0.2 rounded font-mono">
                        OFF
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                    {t('huakaiModeDesc')}
                  </p>
                </div>
              </div>

              {/* iOS / Netflix Switch */}
              <button
                type="button"
                onClick={() => onToggleHuakai(!huakaiEnabled)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  huakaiEnabled ? 'bg-[#E50914]' : 'bg-white/20'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    huakaiEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Section: Language */}
          <div className="pt-2">
            <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">
              {t('language')}
            </span>
            <div className="mt-2 p-4 rounded-xl bg-[#202020] border border-white/10 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-white/5 border border-white/10 text-gray-400">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-sm font-bold text-white">{t('language')}</span>
                  <p className="text-xs text-gray-400">English / 中文</p>
                </div>
              </div>
              <LanguageSelector />
            </div>
          </div>

          {/* Privacy Note */}
          <div className="p-3 bg-white/5 rounded-xl border border-white/5 flex items-center space-x-2.5 text-xs text-gray-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>设置将安全保存在当前本地浏览器中，随时可按需开启或关闭。</span>
          </div>
        </div>

        {/* Footer Done */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="w-full sm:w-auto bg-[#E50914] hover:bg-[#b80710] text-white text-xs sm:text-sm font-bold px-6 py-2.5 rounded-lg transition-all shadow-md hover:scale-105 active:scale-95"
          >
            {t('done')}
          </button>
        </div>
      </div>
    </div>
  );
};
