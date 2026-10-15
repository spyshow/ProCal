// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ThemeSelector } from './ThemeSelector';
import { ThemeProvider } from '@/context/ThemeContext';
import { UserProvider } from '@/context/UserContext';

// Mock translation hook
vi.mock('@/i18n', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string) => fallback,
    isRtl: false,
  }),
}));

describe('ThemeSelector Component', () => {
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

    document.documentElement.dataset.theme = 'dark';
    document.documentElement.className = 'dark';
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
  });

  it('renders default variant="select" as interactive dropdown button', () => {
    render(
      <UserProvider user={null}>
        <ThemeProvider initialTheme="dark">
          <ThemeSelector />
        </ThemeProvider>
      </UserProvider>
    );

    const trigger = screen.getByRole('button', { name: /appearance & theme/i });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getAllByText('Dark').length).toBeGreaterThan(0);
  });

  it('opens popup listbox on click and allows selecting CAD Blueprint (Light)', async () => {
    render(
      <UserProvider user={null}>
        <ThemeProvider initialTheme="dark">
          <ThemeSelector variant="select" />
        </ThemeProvider>
      </UserProvider>
    );

    const trigger = screen.getByRole('button', { name: /appearance & theme/i });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    // Click to open dropdown
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    const listbox = screen.getByRole('listbox');
    expect(listbox).toBeInTheDocument();

    // All 4 theme options must be listed
    expect(screen.getByRole('option', { name: /midnight cad/i })).toBeInTheDocument();
    const lightOption = screen.getByRole('option', { name: /cad blueprint/i });
    expect(lightOption).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /drafting warm/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /system auto/i })).toBeInTheDocument();

    // Select CAD Blueprint (Light)
    await act(async () => {
      fireEvent.click(lightOption);
    });

    // Dropdown should close after selection
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    // DOM and active theme should have switched to blueprint
    expect(document.documentElement.dataset.theme).toBe('blueprint');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(screen.getAllByText('Light').length).toBeGreaterThan(0);
  });

  it('closes dropdown when Escape key is pressed', () => {
    render(
      <UserProvider user={null}>
        <ThemeProvider initialTheme="dark">
          <ThemeSelector variant="select" />
        </ThemeProvider>
      </UserProvider>
    );

    const trigger = screen.getByRole('button', { name: /appearance & theme/i });
    fireEvent.click(trigger);
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    // Press Escape
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('closes dropdown when clicking outside', () => {
    render(
      <div>
        <div data-testid="outside-element">Outside</div>
        <UserProvider user={null}>
          <ThemeProvider initialTheme="dark">
            <ThemeSelector variant="select" />
          </ThemeProvider>
        </UserProvider>
      </div>
    );

    const trigger = screen.getByRole('button', { name: /appearance & theme/i });
    fireEvent.click(trigger);
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    // Click outside
    fireEvent.mouseDown(screen.getByTestId('outside-element'));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('renders native select for variant="compact" and triggers theme change', async () => {
    render(
      <UserProvider user={null}>
        <ThemeProvider initialTheme="dark">
          <ThemeSelector variant="compact" />
        </ThemeProvider>
      </UserProvider>
    );

    const select = screen.getByRole('combobox', { name: /appearance & theme/i });
    expect(select).toBeInTheDocument();
    expect(select).toHaveValue('dark');

    await act(async () => {
      fireEvent.change(select, { target: { value: 'warm' } });
    });

    expect(select).toHaveValue('warm');
    expect(document.documentElement.dataset.theme).toBe('warm');
  });

  it('renders collapsed sidebar mode with icon indicator when isCollapsed={true}', () => {
    render(
      <UserProvider user={null}>
        <ThemeProvider initialTheme="dark">
          <ThemeSelector isCollapsed={true} />
        </ThemeProvider>
      </UserProvider>
    );

    const select = screen.getByRole('combobox', { name: /appearance & theme/i });
    expect(select).toBeInTheDocument();
    expect(select).toHaveClass('opacity-0');
  });
});
