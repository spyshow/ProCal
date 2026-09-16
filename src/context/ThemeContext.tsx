'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { ThemeMode, ResolvedTheme, THEME_COOKIE_NAME, DEFAULT_THEME, resolveTheme, isValidTheme } from '@/lib/theme';
import { useOptionalUser } from '@/context/UserContext';

interface ThemeContextValue {
  theme: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemeMode) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  initialTheme?: string;
}

export function ThemeProvider({ children, initialTheme }: ThemeProviderProps) {
  const userContext = useOptionalUser();
  const user = userContext?.user;

  const validatedInitial: ThemeMode = useMemo(() => {
    if (isValidTheme(initialTheme)) return initialTheme;
    return DEFAULT_THEME;
  }, [initialTheme]);

  const [theme, setThemeState] = useState<ThemeMode>(validatedInitial);
  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(true);

  // Sync with system preference changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemPrefersDark(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setSystemPrefersDark(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Compute resolved theme
  const resolvedTheme = useMemo(() => {
    return resolveTheme(theme, systemPrefersDark);
  }, [theme, systemPrefersDark]);

  // Apply theme to DOM data-theme attribute
  const applyThemeToDom = useCallback((resolved: ResolvedTheme) => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.dataset.theme = resolved;
    if (resolved === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, []);

  // Sync DOM whenever resolvedTheme changes
  useEffect(() => {
    applyThemeToDom(resolvedTheme);
  }, [resolvedTheme, applyThemeToDom]);

  // If user profile has a saved theme different from initial, adopt it once loaded
  useEffect(() => {
    if (user?.theme && isValidTheme(user.theme) && user.theme !== theme) {
      setThemeState(user.theme);
    }
  }, [user?.theme, theme]);

  const setTheme = useCallback((newTheme: ThemeMode) => {
    if (!isValidTheme(newTheme)) return;

    setThemeState(newTheme);

    // Persist to cookie (for 0ms SSR flash prevention)
    if (typeof document !== 'undefined') {
      document.cookie = `${THEME_COOKIE_NAME}=${newTheme}; path=/; max-age=31536000; SameSite=Lax`;
      try {
        localStorage.setItem(THEME_COOKIE_NAME, newTheme);
      } catch {
        // ignore localStorage quota errors
      }
    }

    // Persist to user profile in database in background if logged in
    fetch('/api/auth/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: newTheme }),
    }).catch(() => {
      // background sync silently ignores offline or unauthorized states
    });
  }, []);

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
      isDark: resolvedTheme === 'dark',
    }),
    [theme, resolvedTheme, setTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
