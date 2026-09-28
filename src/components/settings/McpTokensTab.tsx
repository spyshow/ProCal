'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Bot,
  Plus,
  Copy,
  Check,
  Trash2,
  AlertCircle,
  Loader2,
  Terminal,
} from 'lucide-react';
import { useTranslation } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import InfoTooltip from '@/components/InfoTooltip';

interface TokenRecord {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

const CARD = 'rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)]';

/**
 * Personal Access Tokens for the MCP server.
 *
 * The raw secret is returned exactly once, by `POST /api/mcp/tokens`, and is
 * never recoverable afterwards — only its SHA-256 hash is stored. So the reveal
 * panel is deliberately hard to miss and disappears on dismiss.
 */
export function McpTokensTab() {
  const { t } = useTranslation();
  const [tokens, setTokens] = useState<TokenRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<{ name: string; token: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/mcp/tokens');
      if (!res.ok) throw new Error('Failed to load tokens');
      const data = await res.json();
      setTokens(data.tokens ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tokens');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Standard fetch-on-mount. The state updates happen after the await, which the
    // rule cannot see through — the same pattern used across this codebase.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const createToken = async () => {
    if (!name.trim() || creating) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/mcp/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create token');
      setRevealed({ name: data.record.name, token: data.token });
      setName('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create token');
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (id: string) => {
    if (revokingId) return;
    setRevokingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/mcp/tokens?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to revoke token');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to revoke token');
    } finally {
      setRevokingId(null);
    }
  };

  const copyToken = async () => {
    if (!revealed) return;
    try {
      await navigator.clipboard.writeText(revealed.token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Clipboard unavailable — select the token and copy it manually.');
    }
  };

  const active = tokens.filter((tk) => !tk.revokedAt);
  const revoked = tokens.filter((tk) => tk.revokedAt);

  return (
    <div className="space-y-5">
      <div className={`${CARD} p-5`}>
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-orange-500/15 border border-orange-500/40 flex items-center justify-center text-orange-400 shrink-0">
            <Bot size={18} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-[var(--foreground-color)] flex items-center gap-2">
              {t('settings.mcp.title', 'AI Agent Access (MCP)')}
              <InfoTooltip
                label="What is this?"
                helper={t('settings.mcp.tooltip', 'Let an AI client such as Claude or Cursor read and edit your ProCal projects through the Model Context Protocol. A token grants the same permissions as your account.')}
              />
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">
              {t(
                'settings.mcp.desc',
                'Create a token, then point your MCP client at the ProCal endpoint. Scopes follow your project roles: a token can only reach what you can reach.'
              )}
            </p>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-[var(--border-color)] flex flex-col sm:flex-row gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void createToken();
            }}
            placeholder={t('settings.mcp.namePlaceholder', 'e.g. Claude Code — laptop')}
            maxLength={80}
            className="dense-input flex-1 rounded-lg px-3 py-2 text-sm bg-[var(--card-bg-subtle)] border border-[var(--border-color)] text-[var(--foreground-color)] outline-none focus:border-orange-500/60"
          />
          <Button
            onClick={() => void createToken()}
            disabled={!name.trim() || creating}
            className="gap-2 text-xs font-semibold"
          >
            {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            {t('settings.mcp.create', 'Create token')}
          </Button>
        </div>
      </div>

      {revealed && (
        <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-5">
          <div className="flex items-start gap-3">
            <Check size={18} className="text-emerald-400 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-bold text-emerald-400">
                {t('settings.mcp.created', 'Token created')}
              </h4>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                {t(
                  'settings.mcp.copyNow',
                  'Copy it now — this is the only time it will be shown.'
                )}
              </p>
              <div className="mt-3 flex flex-col sm:flex-row gap-2">
                <code className="flex-1 px-3 py-2 rounded-lg bg-slate-950 border border-emerald-500/30 text-[11px] font-mono text-emerald-200 break-all">
                  {revealed.token}
                </code>
                <Button onClick={() => void copyToken()} className="gap-2 text-xs shrink-0">
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? t('common.copied', 'Copied') : t('common.copy', 'Copy')}
                </Button>
              </div>
              <Button
                variant="ghost"
                onClick={() => setRevealed(null)}
                className="mt-3 text-xs"
              >
                {t('settings.mcp.dismiss', 'Done — hide this')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-red-500/40 bg-red-500/10 text-xs text-red-400">
          <AlertCircle size={14} className="shrink-0" />
          {error}
        </div>
      )}

      <div className={`${CARD} overflow-hidden`}>
        <div className="px-5 py-3 border-b border-[var(--border-color)] flex items-center gap-2">
          <Terminal size={14} className="text-[var(--text-muted)]" />
          <h4 className="text-xs font-bold text-[var(--foreground-color)] uppercase tracking-wider font-mono">
            {t('settings.mcp.activeTokens', 'Active tokens')}
          </h4>
          <Badge variant="outline" className="text-[10px] font-mono ms-auto">
            {active.length}
          </Badge>
        </div>

        {loading ? (
          <div className="px-5 py-8 flex items-center justify-center gap-2 text-xs text-[var(--text-muted)]">
            <Loader2 size={14} className="animate-spin" />
            {t('common.loading', 'Loading…')}
          </div>
        ) : active.length === 0 ? (
          <div className="px-5 py-8 text-center text-xs text-[var(--text-muted)]">
            {t('settings.mcp.noTokens', 'No tokens yet. Create one above to connect an AI client.')}
          </div>
        ) : (
          <ul className="divide-y divide-[var(--border-color)]">
            {active.map((tk) => (
              <li key={tk.id} className="px-5 py-3 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-[var(--foreground-color)] truncate">
                    {tk.name}
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)] font-mono mt-0.5">
                    {tk.prefix}…
                    {' · '}
                    {tk.lastUsedAt
                      ? `${t('settings.mcp.lastUsed', 'last used')} ${new Date(tk.lastUsedAt).toLocaleString()}`
                      : t('settings.mcp.neverUsed', 'never used')}
                  </div>
                </div>
                <button
                  onClick={() => void revoke(tk.id)}
                  disabled={revokingId === tk.id}
                  title={t('settings.mcp.revoke', 'Revoke')}
                  className="p-2 rounded-lg border border-[var(--border-color)] text-[var(--text-muted)] hover:text-red-400 hover:border-red-500/50 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {revokingId === tk.id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Trash2 size={14} />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}

        {revoked.length > 0 && (
          <>
            <div className="px-5 py-2 border-t border-[var(--border-color)] bg-[var(--card-bg-subtle)]">
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider font-mono">
                {t('settings.mcp.revokedTokens', 'Revoked')}
              </span>
            </div>
            <ul className="divide-y divide-[var(--border-color)] opacity-50">
              {revoked.map((tk) => (
                <li key={tk.id} className="px-5 py-2.5 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-[var(--foreground-color)] truncate line-through">
                      {tk.name}
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">
                      {tk.prefix}… ·{' '}
                      {tk.revokedAt
                        ? `${t('settings.mcp.revokedOn', 'revoked')} ${new Date(tk.revokedAt).toLocaleDateString()}`
                        : ''}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className={`${CARD} p-5`}>
        <h4 className="text-xs font-bold text-[var(--foreground-color)] uppercase tracking-wider font-mono">
          {t('settings.mcp.connectHeading', 'Connect a client')}
        </h4>
        <p className="text-xs text-[var(--text-muted)] mt-1 mb-3">
          {t('settings.mcp.connectDesc', 'Add this to your client config, replacing the token above.')}
        </p>
        <pre className="overflow-x-auto px-3 py-2.5 rounded-lg bg-slate-950 border border-[var(--border-color)] text-[11px] font-mono text-slate-300">
{`{
  "mcpServers": {
    "procal": {
      "type": "http",
      "url": "${typeof window !== 'undefined' ? window.location.origin : 'https://your-procal-domain'}/api/mcp",
      "headers": { "Authorization": "Bearer <your token>" }
    }
  }
}`}
        </pre>
      </div>
    </div>
  );
}

export default McpTokensTab;
