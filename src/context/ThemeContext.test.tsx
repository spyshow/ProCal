// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ThemeProvider, useTheme } from './ThemeContext';
import { UserProvider, CurrentUser } from './UserContext';
import { THEME_COOKIE_NAME, ThemeMode } from '@/lib/theme';

describe('ThemeContext', () => {
  const originalFetch = global.fetch;
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};
    const storageMock = {
      getItem: vi.fn((key: string) => mockStorage[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        mockStorage[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete mockStorage[key];
      }),
      clear: vi.fn(() => {
        mockStorage = {};
      }),
      key: vi.fn(),
      length: 0,
    };
    Object.defineProperty(window, 'localStorage', {
      value: storageMock,
      writable: true,
      configurable: true,
    });

    document.documentElement.dataset.theme = '';
    document.documentElement.className = '';
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('initializes with default theme or initialTheme', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <UserProvider user={null}>
        <ThemeProvider initialTheme="dark">{children}</ThemeProvider>
      </UserProvider>
    );

    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe('dark');
    expect(result.current.resolvedTheme).toBe('dark');
    expect(result.current.isDark).toBe(true);
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('initializes from localStorage when valid saved theme exists', () => {
    mockStorage[THEME_COOKIE_NAME] = 'warm';

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <UserProvider user={null}>
        <ThemeProvider initialTheme="dark">{children}</ThemeProvider>
      </UserProvider>
    );

    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe('warm');
    expect(result.current.resolvedTheme).toBe('warm');
    expect(result.current.isDark).toBe(false);
    expect(document.documentElement.dataset.theme).toBe('warm');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('changes theme without reverting when user is logged in (anti-reversion guard)', async () => {
    const dummyUser: CurrentUser = {
      id: 'user-1',
      username: 'admin',
      name: 'Admin User',
      role: 'ADMIN',
      credits: 100,
      email: 'admin@example.com',
      theme: 'dark',
    };

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <UserProvider user={dummyUser}>
        <ThemeProvider initialTheme="dark">{children}</ThemeProvider>
      </UserProvider>
    );

    const { result, rerender } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe('dark');

    // Change to blueprint (light)
    await act(async () => {
      result.current.setTheme('blueprint');
    });

    // Force re-renders to ensure no asynchronous effect snaps the theme back
    rerender();
    rerender();

    expect(result.current.theme).toBe('blueprint');
    expect(result.current.resolvedTheme).toBe('blueprint');
    expect(result.current.isDark).toBe(false);
    expect(document.documentElement.dataset.theme).toBe('blueprint');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(window.localStorage.getItem(THEME_COOKIE_NAME)).toBe('blueprint');

    // Change to warm (parchment)
    await act(async () => {
      result.current.setTheme('warm');
    });

    rerender();

    expect(result.current.theme).toBe('warm');
    expect(result.current.resolvedTheme).toBe('warm');
    expect(result.current.isDark).toBe(false);
    expect(document.documentElement.dataset.theme).toBe('warm');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(window.localStorage.getItem(THEME_COOKIE_NAME)).toBe('warm');
  });

  it('cycles smoothly through all supported themes: dark -> blueprint -> warm -> system -> dark', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <UserProvider user={null}>
        <ThemeProvider initialTheme="dark">{children}</ThemeProvider>
      </UserProvider>
    );

    const { result } = renderHook(() => useTheme(), { wrapper });

    const testThemes: ThemeMode[] = ['blueprint', 'warm', 'system', 'dark'];

    for (const targetTheme of testThemes) {
      await act(async () => {
        result.current.setTheme(targetTheme);
      });

      expect(result.current.theme).toBe(targetTheme);
      expect(window.localStorage.getItem(THEME_COOKIE_NAME)).toBe(targetTheme);
      expect(document.cookie).toContain(`${THEME_COOKIE_NAME}=${targetTheme}`);

      if (targetTheme === 'dark') {
        expect(document.documentElement.dataset.theme).toBe('dark');
        expect(document.documentElement.classList.contains('dark')).toBe(true);
      } else if (targetTheme === 'blueprint') {
        expect(document.documentElement.dataset.theme).toBe('blueprint');
        expect(document.documentElement.classList.contains('dark')).toBe(false);
      } else if (targetTheme === 'warm') {
        expect(document.documentElement.dataset.theme).toBe('warm');
        expect(document.documentElement.classList.contains('dark')).toBe(false);
      }
    }
  });

  it('persists theme to cookie, localStorage, and /api/auth/me PATCH when authenticated', async () => {
    const dummyUser: CurrentUser = {
      id: 'user-1',
      username: 'admin',
      name: 'Admin User',
      role: 'ADMIN',
      credits: 100,
      email: 'admin@example.com',
      theme: 'dark',
    };
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <UserProvider user={dummyUser}>
        <ThemeProvider initialTheme="dark">{children}</ThemeProvider>
      </UserProvider>
    );

    const { result } = renderHook(() => useTheme(), { wrapper });

    await act(async () => {
      result.current.setTheme('blueprint');
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/auth/me',
      expect.objectContaining({
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: 'blueprint' }),
      })
    );
  });

  it('persists theme locally without calling /api/auth/me PATCH when unauthenticated', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <UserProvider user={null}>
        <ThemeProvider initialTheme="dark">{children}</ThemeProvider>
      </UserProvider>
    );

    const { result } = renderHook(() => useTheme(), { wrapper });

    await act(async () => {
      result.current.setTheme('blueprint');
    });

    expect(result.current.theme).toBe('blueprint');
    expect(window.localStorage.getItem(THEME_COOKIE_NAME)).toBe('blueprint');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('synchronizes theme from storage event across multiple browser tabs', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <UserProvider user={null}>
        <ThemeProvider initialTheme="dark">{children}</ThemeProvider>
      </UserProvider>
    );

    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe('dark');

    // Simulate another browser tab saving 'warm' into localStorage
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: THEME_COOKIE_NAME,
          newValue: 'warm',
        })
      );
    });

    expect(result.current.theme).toBe('warm');
    expect(result.current.resolvedTheme).toBe('warm');
    expect(document.documentElement.dataset.theme).toBe('warm');
  });

  it('rejects invalid theme strings and preserves current state', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <UserProvider user={null}>
        <ThemeProvider initialTheme="dark">{children}</ThemeProvider>
      </UserProvider>
    );

    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe('dark');

    await act(async () => {
      // Cast invalid string to ThemeMode
      result.current.setTheme('cyberpunk-neon' as unknown as ThemeMode);
    });

    // Theme remains dark and fetch is not dispatched
    expect(result.current.theme).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
