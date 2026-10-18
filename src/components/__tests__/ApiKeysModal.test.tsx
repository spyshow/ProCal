// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ApiKeysModal } from '../ApiKeysModal';

describe('ApiKeysModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('renders modal and loads existing API keys', async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        keys: [
          {
            id: 'key-1',
            name: 'Production Claude Agent',
            keyPrefix: 'procal_sk_abcdef12...',
            createdAt: '2026-10-18T00:00:00.000Z',
            lastUsedAt: null,
            revokedAt: null,
          },
        ],
      }),
    });

    render(<ApiKeysModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText(/AI Agent & Model Context Protocol/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Production Claude Agent')).toBeInTheDocument();
      expect(screen.getByText('procal_sk_abcdef12...')).toBeInTheDocument();
    });
  });

  it('generates a new key and displays the secret key with copy button', async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ keys: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          apiKey: {
            id: 'new-key',
            name: 'Cursor Bot',
            keyPrefix: 'procal_sk_new12345...',
            createdAt: '2026-10-18T00:00:00.000Z',
          },
          rawKey: 'procal_sk_new1234567890abcdef1234567890abcdef12345678',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          keys: [
            {
              id: 'new-key',
              name: 'Cursor Bot',
              keyPrefix: 'procal_sk_new12345...',
              createdAt: '2026-10-18T00:00:00.000Z',
              lastUsedAt: null,
              revokedAt: null,
            },
          ],
        }),
      });

    render(<ApiKeysModal isOpen={true} onClose={vi.fn()} />);

    const input = screen.getByPlaceholderText(/Key name/i);
    fireEvent.change(input, { target: { value: 'Cursor Bot' } });

    const createBtn = screen.getByRole('button', { name: /Create API Key/i });
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(screen.getByText('procal_sk_new1234567890abcdef1234567890abcdef12345678')).toBeInTheDocument();
      expect(screen.getByText(/Copy now — will never be shown again/i)).toBeInTheDocument();
    });
  });

  it('switches between Claude Desktop and Cursor config formats', async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ keys: [] }),
    });

    render(<ApiKeysModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText(/claude_desktop_config.json/i)).toBeInTheDocument();

    const cursorBtn = screen.getByRole('button', { name: /^Cursor$/i });
    fireEvent.click(cursorBtn);

    expect(screen.getByText(/\.cursor\/mcp\.json/i)).toBeInTheDocument();
  });

  it('uses theme CSS variables and avoids hardcoded text-white on title', async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ keys: [] }),
    });

    render(<ApiKeysModal isOpen={true} onClose={vi.fn()} />);

    const title = screen.getByText(/AI Agent & Model Context Protocol/i);
    expect(title.className).toContain('text-[var(--foreground-color,#f8fafc)]');
    expect(title.className).not.toContain('text-white');
  });
});

