'use client';

import React, { createContext, useContext, useEffect, useState, useTransition, useCallback } from 'react';
import i18n, { SupportedLanguage, LANGUAGE_STORAGE_KEY, getInitialLanguage } from './config';

interface I18nContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  isRtl: boolean;
  t: (key: string, fallback?: string, options?: Record<string, any>) => string;
}

const I18nContext = createContext<I18nContextType>({
  language: 'en',
  setLanguage: () => {},
  isRtl: false,
  t: (key: string, fallback?: string) => fallback || key,
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<SupportedLanguage>('en');
  const [, startTransition] = useTransition();

  useEffect(() => {
    const initial = getInitialLanguage();
    setLanguageState(initial);
    i18n.changeLanguage(initial);
    document.documentElement.dir = initial === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = initial;
    if (initial === 'ar') {
      document.body.classList.add('rtl-arabic');
    } else {
      document.body.classList.remove('rtl-arabic');
    }
  }, []);

  const setLanguage = useCallback((newLang: SupportedLanguage) => {
    startTransition(() => {
      setLanguageState(newLang);
      i18n.changeLanguage(newLang);
      if (typeof window !== 'undefined') {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, newLang);
        document.cookie = `NEXT_LOCALE=${newLang}; path=/; max-age=31536000; SameSite=Lax`;
        document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.lang = newLang;
        if (newLang === 'ar') {
          document.body.classList.add('rtl-arabic');
        } else {
          document.body.classList.remove('rtl-arabic');
        }
      }
    });
  }, []);

  const isRtl = language === 'ar';

  const t = useCallback(
    (key: string, fallback?: string, options?: Record<string, any>) => {
      if (i18n.exists(key, options)) {
        return String(i18n.t(key, options));
      }
      return fallback !== undefined ? fallback : String(i18n.t(key, { ...options, defaultValue: key }));
    },
    // recompute when language changes
    [language]
  );

  return (
    <I18nContext.Provider
      value={{
        language,
        setLanguage,
        isRtl,
        t,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}

export function useTranslation() {
  const { language, isRtl, setLanguage, t } = useI18n();

  return {
    t,
    i18n,
    language,
    isRtl,
    setLanguage,
  };
}

