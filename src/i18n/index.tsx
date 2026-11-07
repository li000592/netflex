import React, { createContext, useContext, useState, useEffect } from 'react';
import { Globe } from 'lucide-react';
import { Language, translations, TranslationKey } from './translations';

interface I18nContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nContextType>({
  lang: 'en',
  setLang: () => {},
  t: (key) => translations.en[key] || key,
});

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Default to English ('en') as requested by user
  const [lang, setLangState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('netflex_lang');
      if (saved === 'en' || saved === 'zh') return saved;
    } catch {}
    return 'en';
  });

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    try {
      localStorage.setItem('netflex_lang', newLang);
      document.documentElement.lang = newLang === 'zh' ? 'zh-CN' : 'en';
    } catch {}
  };

  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  }, [lang]);

  const t = (key: TranslationKey): string => {
    const dict = translations[lang] || translations.en;
    return dict[key] || translations.en[key] || (key as string);
  };

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => useContext(I18nContext);

// Reusable Netflix-style Language Selector Component
export const LanguageSelector: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { lang, setLang } = useI18n();

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <Globe className="absolute left-2 sm:left-2.5 w-3.5 h-3.5 text-gray-300 pointer-events-none" />
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value as Language)}
        className="bg-black/60 hover:bg-black/80 text-white text-[11px] sm:text-xs font-semibold pl-6 sm:pl-8 pr-5 sm:pr-6 py-1 sm:py-1.5 rounded border border-white/20 hover:border-white/40 outline-none cursor-pointer appearance-none transition-colors"
        aria-label="Select Language"
      >
        <option value="en">English</option>
        <option value="zh">中文</option>
      </select>
      <div className="absolute right-1.5 sm:right-2 pointer-events-none text-[8px] sm:text-[9px] text-gray-400">▼</div>
    </div>
  );
};
