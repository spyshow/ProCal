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

  it('switches between Antigravity, Codex, Hermes, Claude, Cursor, Windsurf, and HTTP formats', async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ keys: [] }),
    });

    render(<ApiKeysModal isOpen={true} onClose={vi.fn()} />);

    // Default is Antigravity
    expect(screen.getByText(/antigravity\\mcp_config\.json/i)).toBeInTheDocument();

    // Switch to Codex (TOML format)
    const codexBtn = screen.getByRole('button', { name: /^Codex$/i });
    fireEvent.click(codexBtn);
    expect(screen.getByText(/\[mcp_servers\.procal\]/i)).toBeInTheDocument();
    expect(screen.getByText(/\.codex\\config\.toml/i)).toBeInTheDocument();

    // Switch to Hermes (YAML format)
    const hermesBtn = screen.getByRole('button', { name: /^Hermes$/i });
    fireEvent.click(hermesBtn);
    expect(screen.getAllByText(/mcp_servers:/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/\.hermes\\config\.yaml/i)).toBeInTheDocument();

    // Switch to Claude Desktop
    const claudeBtn = screen.getByRole('button', { name: /^Claude Desktop$/i });
    fireEvent.click(claudeBtn);
    expect(screen.getByText(/claude_desktop_config\.json/i)).toBeInTheDocument();

    // Switch to Cursor
    const cursorBtn = screen.getByRole('button', { name: /^Cursor$/i });
    fireEvent.click(cursorBtn);
    expect(screen.getByText(/\.cursor\/mcp\.json/i)).toBeInTheDocument();

    // Switch to Windsurf
    const windsurfBtn = screen.getByRole('button', { name: /^Windsurf$/i });
    fireEvent.click(windsurfBtn);
    expect(screen.getByText(/windsurf\\mcp_config\.json/i)).toBeInTheDocument();

    // Switch to Gemini Apps
    const geminiBtn = screen.getByRole('button', { name: /^Gemini Apps$/i });
    fireEvent.click(geminiBtn);
    expect(screen.getByText(/gemini\.google\.com -> Settings -> Connected Apps/i)).toBeInTheDocument();
    expect(screen.getByText(/MCP Server URL:/i)).toBeInTheDocument();

    // Switch to cURL / HTTP
    const httpBtn = screen.getByRole('button', { name: /^cURL \/ HTTP$/i });
    fireEvent.click(httpBtn);
    expect(screen.getByText(/curl -X POST/i)).toBeInTheDocument();
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

