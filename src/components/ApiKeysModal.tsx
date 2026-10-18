'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Key,
  Plus,
  Trash2,
  Copy,
  Check,
  AlertTriangle,
  Bot,
  ExternalLink,
  ShieldCheck,
  Terminal,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ApiKeyItem {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

interface ApiKeysModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ApiKeysModal({ isOpen, onClose }: ApiKeysModalProps) {
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Creation form state
  const [newKeyName, setNewKeyName] = useState('Claude Desktop');
  const [creating, setCreating] = useState(false);
  const [createdRawKey, setCreatedRawKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Config tab state
  const [configFormat, setConfigFormat] = useState<'claude' | 'cursor' | 'http'>('claude');
  const [copiedConfig, setCopiedConfig] = useState(false);

  // Revocation state
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/api-keys', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setKeys(data.keys || []);
    } catch (err: unknown) {
      console.error('Failed to load API keys:', err);
      setError('Could not load API keys');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchKeys();
      setCreatedRawKey(null);
      setCopiedKey(false);
      setCopiedConfig(false);
    }
  }, [isOpen, fetchKeys]);

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim() || creating) return;

    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create API key');
      }

      setCreatedRawKey(data.rawKey);
      setNewKeyName('');
      await fetchKeys();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create API key';
      setError(msg);
    } finally {
      setCreating(false);
    }
  };

  const handleRevokeKey = async (id: string) => {
    if (!confirm('Are you sure you want to revoke this API key? External agents using it will immediately lose access.')) {
      return;
    }

    setRevokingId(id);
    try {
      const res = await fetch(`/api/api-keys?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to revoke key');
      }
      await fetchKeys();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to revoke key';
      setError(msg);
    } finally {
      setRevokingId(null);
    }
  };

  const copyToClipboard = (text: string, type: 'key' | 'config') => {
    navigator.clipboard.writeText(text);
    if (type === 'key') {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } else {
      setCopiedConfig(true);
      setTimeout(() => setCopiedConfig(false), 2000);
    }
  };

  const activeKeyForConfig = createdRawKey || (keys.find((k) => !k.revokedAt)?.keyPrefix.replace(/\.\.\.$/, '') ?? 'YOUR_PROCAL_API_KEY');
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://procal.example.com';

  const generateConfigSnippet = () => {
    if (configFormat === 'claude') {
      return JSON.stringify(
        {
          mcpServers: {
            procal: {
              command: 'npx',
              args: ['-y', 'tsx', 'scripts/procal-mcp-stdio.ts'],
              env: {
                PROCAL_API_KEY: activeKeyForConfig,
                PROCAL_URL: origin,
              },
            },
          },
        },
        null,
        2
      );
    }

    if (configFormat === 'cursor') {
      return JSON.stringify(
        {
          mcpServers: {
            procal: {
              url: `${origin}/api/mcp`,
              headers: {
                Authorization: `Bearer ${activeKeyForConfig}`,
              },
            },
          },
        },
        null,
        2
      );
    }

    return `# Remote Streamable HTTP Endpoint\nPOST ${origin}/api/mcp\nAuthorization: Bearer ${activeKeyForConfig}\nContent-Type: application/json`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl bg-[var(--card-bg,#0b0f19)] border-[var(--border-color,#1f2937)] text-[var(--foreground-color,#f8fafc)] shadow-2xl p-6 max-h-[90vh] overflow-y-auto custom-scrollbar">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-lg font-bold flex items-center gap-2 text-white">
            <Bot className="w-5 h-5 text-orange-500" />
            AI Agent & Model Context Protocol (MCP) Keys
          </DialogTitle>
          <DialogDescription className="text-xs text-[var(--table-header-color,#9ca3af)]">
            Connect external multimodal AI agents (Claude Desktop, Cursor) to ProCal to automatically inspect drawing schedules, run IEC/NEMA calculations, and generate stamped SLDs and reports.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Newly Created Key Alert Box */}
        {createdRawKey && (
          <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/40 space-y-2.5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-orange-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                New Secret API Key Generated
              </span>
              <span className="text-[10px] text-orange-300/80 font-medium uppercase tracking-wider">
                Copy now — will never be shown again
              </span>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-black/60 px-3 py-2 rounded-lg text-xs font-mono text-orange-200 border border-orange-500/30 break-all select-all">
                {createdRawKey}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyToClipboard(createdRawKey, 'key')}
                className="bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 border-orange-500/40 shrink-0 h-9"
              >
                {copiedKey ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span className="ml-1 text-xs">{copiedKey ? 'Copied' : 'Copy'}</span>
              </Button>
            </div>
          </div>
        )}

        {/* Generate Key Form */}
        <form onSubmit={handleCreateKey} className="flex items-center gap-2 pt-1">
          <Input
            placeholder="Key name (e.g. Claude Desktop, Cursor, CI/CD)"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            className="text-xs bg-slate-900/60 border-slate-800 text-white placeholder:text-slate-500 focus:border-orange-500"
            maxLength={50}
          />
          <Button
            type="submit"
            size="sm"
            disabled={creating || !newKeyName.trim()}
            className="bg-orange-600 hover:bg-orange-500 text-white font-medium text-xs shrink-0 h-9 px-4"
          >
            {creating ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Plus className="w-4 h-4 mr-1" />
                Create API Key
              </>
            )}
          </Button>
        </form>

        {/* Existing Keys Table */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--table-header-color,#9ca3af)]">
            Active & Revoked Keys
          </h4>
          <div className="border border-[var(--border-color,#1f2937)] rounded-xl overflow-hidden bg-slate-950/40">
            {loading ? (
              <div className="p-8 text-center text-xs text-slate-400">Loading API keys...</div>
            ) : keys.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No API keys generated yet. Create one above to connect your AI agent.
              </div>
            ) : (
              <div className="divide-y divide-[var(--border-color,#1f2937)] text-xs">
                {keys.map((k) => (
                  <div key={k.id} className="p-3 flex items-center justify-between gap-3 hover:bg-slate-900/40 transition-colors">
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white truncate">{k.name}</span>
                        {k.revokedAt ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            Revoked
                          </span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                        <span>{k.keyPrefix}</span>
                        <span>•</span>
                        <span>Created {new Date(k.createdAt).toLocaleDateString()}</span>
                        {k.lastUsedAt && (
                          <>
                            <span>•</span>
                            <span>Used {new Date(k.lastUsedAt).toLocaleDateString()}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {!k.revokedAt && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRevokeKey(k.id)}
                        disabled={revokingId === k.id}
                        className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 h-8 px-2.5 text-xs"
                      >
                        {revokingId === k.id ? (
                          <div className="w-3.5 h-3.5 border-2 border-rose-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <Trash2 className="w-3.5 h-3.5 mr-1" />
                            Revoke
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 1-Click Client Configuration Snippet */}
        <div className="space-y-2 pt-2 border-t border-[var(--border-color,#1f2937)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white flex items-center gap-1.5">
              <Terminal className="w-4 h-4 text-orange-400" />
              1-Click MCP Client Configuration
            </span>
            <div className="flex rounded-lg bg-slate-900/80 p-0.5 border border-slate-800 text-[11px]">
              <button
                type="button"
                onClick={() => setConfigFormat('claude')}
                className={`px-2 py-1 rounded-md transition-colors ${
                  configFormat === 'claude' ? 'bg-orange-600 text-white font-medium' : 'text-slate-400 hover:text-white'
                }`}
              >
                Claude Desktop
              </button>
              <button
                type="button"
                onClick={() => setConfigFormat('cursor')}
                className={`px-2 py-1 rounded-md transition-colors ${
                  configFormat === 'cursor' ? 'bg-orange-600 text-white font-medium' : 'text-slate-400 hover:text-white'
                }`}
              >
                Cursor
              </button>
              <button
                type="button"
                onClick={() => setConfigFormat('http')}
                className={`px-2 py-1 rounded-md transition-colors ${
                  configFormat === 'http' ? 'bg-orange-600 text-white font-medium' : 'text-slate-400 hover:text-white'
                }`}
              >
                HTTP
              </button>
            </div>
          </div>

          <div className="relative">
            <pre className="p-3 rounded-xl bg-black/80 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto">
              <code>{generateConfigSnippet()}</code>
            </pre>
            <Button
              size="sm"
              variant="outline"
              onClick={() => copyToClipboard(generateConfigSnippet(), 'config')}
              className="absolute top-2 right-2 bg-slate-900/90 hover:bg-slate-800 text-slate-200 border-slate-700 h-7 px-2 text-[10px]"
            >
              {copiedConfig ? <Check className="w-3.5 h-3.5 text-emerald-400 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
              {copiedConfig ? 'Copied' : 'Copy Config'}
            </Button>
          </div>
          <p className="text-[11px] text-slate-500">
            {configFormat === 'claude'
              ? 'Paste into your claude_desktop_config.json (%APPDATA%\\Claude\\claude_desktop_config.json or ~/Library/Application Support/Claude/claude_desktop_config.json).'
              : configFormat === 'cursor'
              ? 'Paste into your project’s .cursor/mcp.json file.'
              : 'Direct endpoint for custom MCP clients or Streamable HTTP POST calls.'}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ApiKeysModal;
