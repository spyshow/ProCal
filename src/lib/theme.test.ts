import { describe, it, expect } from 'vitest';
import {
  isValidTheme,
  resolveTheme,
  DEFAULT_THEME,
  THEME_COOKIE_NAME,
  VALID_THEMES,
} from './theme';

describe('Theme utilities', () => {
  it('validates correct theme modes', () => {
    expect(isValidTheme('dark')).toBe(true);
    expect(isValidTheme('blueprint')).toBe(true);
    expect(isValidTheme('warm')).toBe(true);
    expect(isValidTheme('system')).toBe(true);
    expect(isValidTheme('neon')).toBe(false);
    expect(isValidTheme(null)).toBe(false);
    expect(isValidTheme(undefined)).toBe(false);
  });

  it('resolves explicit themes directly', () => {
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('dark', true)).toBe('dark');
    expect(resolveTheme('blueprint', false)).toBe('blueprint');
    expect(resolveTheme('blueprint', true)).toBe('blueprint');
    expect(resolveTheme('warm', false)).toBe('warm');
    expect(resolveTheme('warm', true)).toBe('warm');
  });

  it('resolves system mode based on OS preference', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('blueprint');
  });

  it('falls back to default theme for unrecognized inputs', () => {
    expect(resolveTheme('invalid' as any, false)).toBe(DEFAULT_THEME);
  });

  it('exports expected constants', () => {
    expect(DEFAULT_THEME).toBe('dark');
    expect(THEME_COOKIE_NAME).toBe('procal_theme');
    expect(VALID_THEMES).toEqual(['dark', 'blueprint', 'warm', 'system']);
  });
});
