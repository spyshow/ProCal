export type ThemeMode = 'dark' | 'blueprint' | 'warm' | 'system';
export type ResolvedTheme = 'dark' | 'blueprint' | 'warm';

export const THEME_COOKIE_NAME = 'procal_theme';
export const DEFAULT_THEME: ResolvedTheme = 'dark';

export const VALID_THEMES: ThemeMode[] = ['dark', 'blueprint', 'warm', 'system'];

export function isValidTheme(theme: unknown): theme is ThemeMode {
  return typeof theme === 'string' && VALID_THEMES.includes(theme as ThemeMode);
}

export function resolveTheme(theme: ThemeMode, systemPrefersDark: boolean): ResolvedTheme {
  if (theme === 'system') {
    return systemPrefersDark ? 'dark' : 'blueprint';
  }
  if (theme === 'blueprint' || theme === 'warm' || theme === 'dark') {
    return theme;
  }
  return DEFAULT_THEME;
}
