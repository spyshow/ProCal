'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  MessageSquareWarning,
  Bug,
  Calculator,
  Lightbulb,
  HelpCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Mail,
  Search,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Monitor,
  FolderGit2,
  FileCode2,
  AlertTriangle,
  Send,
} from 'lucide-react';
import { useTranslation } from '@/i18n';

type LeadUser = { id: string; username: string; name: string; email: string | null };

type Lead = {
  id: string;
  userId: string;
  email: string | null;
  message: string;
  requestedCredits: number | null;
  status: string;
  createdAt: string;
  closedAt: string | null;
  user: LeadUser;
};

type StatusFilter = 'OPEN' | 'CLOSED' | 'ALL';
type CategoryFilter = 'ALL' | 'BUG' | 'CALCULATION' | 'FEATURE' | 'GENERAL' | 'BILLING';

interface ParsedFeedback {
  category: 'BUG' | 'CALCULATION' | 'FEATURE' | 'GENERAL' | 'BILLING';
  subject: string;
  cleanMessage: string;
  pageUrl?: string;
  projectId?: string;
  projectName?: string;
  errorDetails?: string;
  systemInfo?: string;
}

function parseMessageContent(raw: string, requestedCredits: number | null): ParsedFeedback {
  if (requestedCredits != null && !raw.includes('[FEEDBACK')) {
    return {
      category: 'BILLING',
      subject: `Credit Request (${requestedCredits} credits)`,
      cleanMessage: raw,
    };
  }

  // Check for [FEEDBACK / CATEGORY] tag
  const feedbackMatch = raw.match(/\[FEEDBACK\s*(?:\/\s*([^\]]+))?\]/i);
  let category: ParsedFeedback['category'] = 'GENERAL';
  if (feedbackMatch) {
    const catStr = (feedbackMatch[1] || '').toUpperCase();
    if (catStr.includes('BUG') || catStr.includes('ERROR')) category = 'BUG';
    else if (catStr.includes('CALC')) category = 'CALCULATION';
    else if (catStr.includes('FEATURE') || catStr.includes('SUGGEST')) category = 'FEATURE';
    else category = 'GENERAL';
  } else if (raw.toLowerCase().includes('error') || raw.toLowerCase().includes('bug') || raw.toLowerCase().includes('fail')) {
    category = 'BUG';
  } else if (raw.toLowerCase().includes('calc') || raw.toLowerCase().includes('voltage') || raw.toLowerCase().includes('breaker')) {
    category = 'CALCULATION';
  }

  // Extract metadata tags if present
  let urlMatch: string | undefined;
  const urlRegex = /(?:📍 URL:|URL:)\s*([^\n\r]+)/i;
  const uMatch = raw.match(urlRegex);
  if (uMatch) urlMatch = uMatch[1].trim();

  let projectMatch: string | undefined;
  let projectIdMatch: string | undefined;
  const projRegex = /(?:📁 Project:|Project:)\s*([^\n\r(]+)(?:\(([^)]+)\))?/i;
  const pMatch = raw.match(projRegex);
  if (pMatch) {
    projectMatch = pMatch[1].trim();
    if (pMatch[2]) projectIdMatch = pMatch[2].trim();
  }

  let errorDetailsMatch: string | undefined;
  const errRegex = /(?:⚠️ Technical Error:|Errors:|Technical Details:)\s*([\s\S]*?)(?=(?:💻 Diagnostics:|System:|$))/i;
  const eMatch = raw.match(errRegex);
  if (eMatch) errorDetailsMatch = eMatch[1].trim();

  let systemMatch: string | undefined;
  const sysRegex = /(?:💻 Diagnostics:|System:)\s*([^\n\r]+)/i;
  const sMatch = raw.match(sysRegex);
  if (sMatch) systemMatch = sMatch[1].trim();

  // Clean the main message body by stripping out the metadata lines
  let clean = raw
    .replace(/\[FEEDBACK\s*(?:\/[^\]]+)?\]\s*/i, '')
    .replace(/(?:📍 URL:|URL:)\s*[^\n\r]+/gi, '')
    .replace(/(?:📁 Project:|Project:)\s*[^\n\r]+/gi, '')
    .replace(/(?:⚠️ Technical Error:|Errors:|Technical Details:)\s*[\s\S]*?(?=(?:💻 Diagnostics:|System:|$))/gi, '')
    .replace(/(?:💻 Diagnostics:|System:)\s*[^\n\r]+/gi, '')
    .trim();

  let subject = '';
  const dashSplit = clean.split(/\s*—\s*/);
  if (dashSplit.length > 1 && dashSplit[0].length < 120) {
    subject = dashSplit[0].trim();
    clean = dashSplit.slice(1).join(' — ').trim();
  }

  return {
    category,
    subject: subject || (category === 'BUG' ? 'Error Report' : category === 'CALCULATION' ? 'Calculation Issue' : 'Feedback Message'),
    cleanMessage: clean || raw,
    pageUrl: urlMatch,
    projectId: projectIdMatch,
    projectName: projectMatch,
    errorDetails: errorDetailsMatch,
    systemInfo: systemMatch,
  };
}

export default function AdminFeedbackPage() {
  const { t } = useTranslation();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filter, setFilter] = useState<StatusFilter>('OPEN');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadLeads = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/leads', { cache: 'no-store' });
      if (res.status === 401) { setError('Unauthorized - Please sign in'); return; }
      if (res.status === 403) { setError('Admin access required'); return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setLeads(await res.json());
    } catch {
      setError('Failed to load feedback messages');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadLeads(); }, [loadLeads]);

  const handleToggleClose = async (lead: Lead) => {
    const next = lead.status === 'OPEN' ? 'CLOSED' : 'OPEN';
    setUpdatingId(lead.id);
    try {
      const res = await fetch(`/api/admin/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || 'Could not update status');
        return;
      }
      await loadLeads();
    } catch {
      setError('Network error updating status');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleCopyDiagnostics = (lead: Lead, parsed: ParsedFeedback) => {
    const text = [
      `ProCal Issue Report ID: ${lead.id}`,
      `User: ${lead.user.name} (@${lead.user.username})`,
      `Email: ${lead.email || lead.user.email || 'N/A'}`,
      `Category: ${parsed.category}`,
      `Subject: ${parsed.subject}`,
      parsed.pageUrl ? `URL: ${parsed.pageUrl}` : '',
      parsed.projectName ? `Project: ${parsed.projectName} (${parsed.projectId || ''})` : '',
      parsed.systemInfo ? `System: ${parsed.systemInfo}` : '',
      `Date: ${new Date(lead.createdAt).toISOString()}`,
      `Message:`,
      parsed.cleanMessage,
      parsed.errorDetails ? `\nError Details:\n${parsed.errorDetails}` : '',
    ].filter(Boolean).join('\n');

    navigator.clipboard.writeText(text);
    setCopiedId(lead.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filtered and parsed messages list
  const processedLeads = useMemo(() => {
    return leads.map(lead => ({
      lead,
      parsed: parseMessageContent(lead.message, lead.requestedCredits),
    }));
  }, [leads]);

  const filtered = useMemo(() => {
    return processedLeads.filter(({ lead, parsed }) => {
      if (filter !== 'ALL' && lead.status !== filter) return false;
      if (categoryFilter !== 'ALL' && parsed.category !== categoryFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const userMatch = lead.user.name.toLowerCase().includes(q) || lead.user.username.toLowerCase().includes(q);
        const emailMatch = (lead.email || lead.user.email || '').toLowerCase().includes(q);
        const msgMatch = lead.message.toLowerCase().includes(q);
        const subjMatch = parsed.subject.toLowerCase().includes(q);
        const urlMatch = (parsed.pageUrl || '').toLowerCase().includes(q);
        const projMatch = (parsed.projectName || '').toLowerCase().includes(q);
        if (!userMatch && !emailMatch && !msgMatch && !subjMatch && !urlMatch && !projMatch) return false;
      }
      return true;
    });
  }, [processedLeads, filter, categoryFilter, searchQuery]);

  const openCount = leads.filter(l => l.status === 'OPEN').length;
  const bugsCount = processedLeads.filter(({ parsed, lead }) => lead.status === 'OPEN' && parsed.category === 'BUG').length;
  const calcCount = processedLeads.filter(({ parsed, lead }) => lead.status === 'OPEN' && parsed.category === 'CALCULATION').length;

  const categoryBadges: Record<ParsedFeedback['category'], { label: string; icon: React.ReactNode; badgeClass: string }> = {
    BUG: {
      label: 'Error / Bug',
      icon: <Bug size={13} />,
      badgeClass: 'bg-red-950/60 text-red-300 border-red-500/40 ring-1 ring-red-500/20',
    },
    CALCULATION: {
      label: 'Calculation',
      icon: <Calculator size={13} />,
      badgeClass: 'bg-amber-950/60 text-amber-300 border-amber-500/40 ring-1 ring-amber-500/20',
    },
    FEATURE: {
      label: 'Feature Request',
      icon: <Lightbulb size={13} />,
      badgeClass: 'bg-cyan-950/60 text-cyan-300 border-cyan-500/40 ring-1 ring-cyan-500/20',
    },
    GENERAL: {
      label: 'General Inquiry',
      icon: <HelpCircle size={13} />,
      badgeClass: 'bg-purple-950/60 text-purple-300 border-purple-500/40 ring-1 ring-purple-500/20',
    },
    BILLING: {
      label: 'Credits / Billing',
      icon: <Mail size={13} />,
      badgeClass: 'bg-orange-950/60 text-orange-300 border-orange-500/40 ring-1 ring-orange-500/20',
    },
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header & Overview Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-orange-600/20 border border-orange-500/40 text-orange-400">
              <MessageSquareWarning size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">User Messages & Error Reports</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Review bug reports, calculation discrepancies, and feature requests submitted by engineers.
              </p>
            </div>
          </div>
        </div>

        {/* Live Counters */}
        <div className="flex items-center gap-2">
          <div className="px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-2 text-xs">
            <span className="flex h-2 w-2 relative">
              {openCount > 0 && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${openCount > 0 ? 'bg-amber-400' : 'bg-green-500'}`}></span>
            </span>
            <span className="font-semibold text-slate-200">{openCount}</span>
            <span className="text-slate-400">Open Reports</span>
          </div>

          {bugsCount > 0 && (
            <div className="px-3 py-1.5 rounded-xl bg-red-950/50 border border-red-500/30 text-red-300 flex items-center gap-1.5 text-xs font-semibold">
              <Bug size={13} />
              <span>{bugsCount} Bug{bugsCount !== 1 ? 's' : ''}</span>
            </div>
          )}

          {calcCount > 0 && (
            <div className="px-3 py-1.5 rounded-xl bg-amber-950/50 border border-amber-500/30 text-amber-300 flex items-center gap-1.5 text-xs font-semibold">
              <Calculator size={13} />
              <span>{calcCount} Calc</span>
            </div>
          )}

          <button
            onClick={loadLeads}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors disabled:opacity-50"
            title="Refresh reports"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800">
        {/* Search */}
        <div className="md:col-span-5 relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by user, email, keyword, URL, or project..."
            className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700/80 text-xs text-slate-100 placeholder:text-slate-500 focus:border-orange-500 focus:outline-none"
          />
        </div>

        {/* Category Filter Pills */}
        <div className="md:col-span-4 flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1 md:pb-0">
          {(['ALL', 'BUG', 'CALCULATION', 'FEATURE', 'GENERAL'] as CategoryFilter[]).map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap border ${
                categoryFilter === cat
                  ? 'bg-orange-500 text-slate-950 font-bold border-orange-400 shadow-sm'
                  : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 border-slate-800'
              }`}
            >
              {cat === 'ALL' ? 'All Types' : cat === 'BUG' ? '🐞 Bugs' : cat === 'CALCULATION' ? '⚡ Calc' : cat === 'FEATURE' ? '💡 Feature' : '💬 General'}
            </button>
          ))}
        </div>

        {/* Status Filter */}
        <div className="md:col-span-3 flex items-center justify-end gap-1.5">
          {(['OPEN', 'CLOSED', 'ALL'] as StatusFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors border ${
                filter === f
                  ? 'bg-orange-500 text-slate-950 font-bold border-orange-400 shadow-sm'
                  : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 border-slate-800'
              }`}
            >
              {f === 'OPEN' ? 'Open' : f === 'CLOSED' ? 'Resolved' : 'All'}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div role="alert" className="p-3.5 rounded-xl bg-red-950/60 border border-red-500/50 text-red-300 text-xs flex items-center gap-2">
          <AlertTriangle size={15} className="shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Messages List View */}
      {loading ? (
        <div className="py-20 text-center text-slate-400 space-y-3">
          <Loader2 size={24} className="animate-spin mx-auto text-orange-400" />
          <p className="text-xs">Loading user messages and error reports…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 rounded-2xl border border-slate-800 bg-slate-900/30 space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center mx-auto text-slate-400">
            <Mail size={22} />
          </div>
          <h3 className="text-sm font-semibold text-slate-200">No {filter !== 'ALL' ? filter.toLowerCase() : ''} reports found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {searchQuery
              ? 'No messages matched your search query. Try clearing the search or changing filters.'
              : 'All user feedback and error reports have been resolved!'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(({ lead, parsed }) => {
            const isExpanded = expandedId === lead.id;
            const badge = categoryBadges[parsed.category] || categoryBadges.GENERAL;
            const userEmail = lead.email || lead.user.email;
            const mailtoUrl = userEmail
              ? `mailto:${userEmail}?subject=Re: ProCal - ${encodeURIComponent(parsed.subject)}`
              : null;

            return (
              <div
                key={lead.id}
                className={`rounded-2xl border transition-all overflow-hidden ${
                  lead.status === 'OPEN'
                    ? 'bg-slate-900/80 border-slate-700/80 shadow-lg shadow-black/40'
                    : 'bg-slate-900/30 border-slate-800/80 opacity-80'
                }`}
              >
                {/* Header row */}
                <div className="p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800/60 bg-slate-950/40">
                  <div className="flex flex-wrap items-center gap-2.5">
                    {/* Category badge */}
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border ${badge.badgeClass}`}>
                      {badge.icon}
                      <span>{badge.label}</span>
                    </span>

                    {/* Status badge */}
                    {lead.status === 'OPEN' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-950/50 text-amber-300 border border-amber-500/30">
                        <Clock size={11} /> Open
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-green-950/50 text-green-300 border border-green-500/30">
                        <CheckCircle2 size={11} /> Resolved
                      </span>
                    )}

                    <span className="text-xs text-slate-400 font-mono">
                      {new Date(lead.createdAt).toLocaleDateString()} {new Date(lead.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {/* Actions right */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopyDiagnostics(lead, parsed)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
                      title="Copy diagnostics to clipboard"
                    >
                      {copiedId === lead.id ? (
                        <>
                          <Check size={13} className="text-green-400" />
                          <span className="text-green-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy size={13} />
                          <span>Copy Info</span>
                        </>
                      )}
                    </button>

                    {mailtoUrl && (
                      <a
                        href={mailtoUrl}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
                        title="Send email reply directly to user"
                      >
                        <Send size={13} />
                        <span>Reply</span>
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={() => handleToggleClose(lead)}
                      disabled={updatingId === lead.id}
                      className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                        lead.status === 'OPEN'
                          ? 'bg-green-600/20 text-green-300 hover:bg-green-600/30 border-green-500/40 shadow-sm'
                          : 'bg-slate-800 text-slate-400 hover:text-slate-200 border-slate-700'
                      }`}
                    >
                      {updatingId === lead.id ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : lead.status === 'OPEN' ? (
                        <>
                          <Check size={13} />
                          <span>Mark Resolved</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw size={13} />
                          <span>Reopen</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Content body */}
                <div className="p-4 md:p-5 space-y-4">
                  {/* User info & subject */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 pb-3 border-b border-slate-800/50">
                    <div>
                      <h3 className="text-base font-bold text-slate-100">{parsed.subject}</h3>
                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                        <span className="font-semibold text-slate-200">{lead.user.name}</span>
                        <span className="text-slate-500">(@{lead.user.username})</span>
                        {userEmail && (
                          <span className="text-orange-400/90 font-mono text-[11px] bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800">
                            {userEmail}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Page route tag */}
                    {parsed.pageUrl && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs font-mono text-orange-300/90">
                        <FileCode2 size={13} className="text-orange-400 shrink-0" />
                        <span className="truncate max-w-xs">{parsed.pageUrl}</span>
                      </div>
                    )}
                  </div>

                  {/* Message body */}
                  <div className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed bg-slate-950/50 p-4 rounded-xl border border-slate-800/60 font-sans">
                    {parsed.cleanMessage}
                  </div>

                  {/* Attached Diagnostics and Error Details */}
                  {(parsed.errorDetails || parsed.projectName || parsed.systemInfo) && (
                    <div className="rounded-xl bg-slate-950/70 border border-slate-800 p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                          <Monitor size={14} className="text-orange-400" />
                          <span>System & Error Diagnostics</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setExpandedId(isExpanded ? null : lead.id)}
                          className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1"
                        >
                          <span>{isExpanded ? 'Collapse' : 'Expand Details'}</span>
                          {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-400">
                        {parsed.projectName && (
                          <div className="flex items-center gap-1.5">
                            <FolderGit2 size={13} className="text-cyan-400 shrink-0" />
                            <span className="text-slate-300 truncate">Project: {parsed.projectName}</span>
                          </div>
                        )}
                        {parsed.systemInfo && (
                          <div className="flex items-center gap-1.5 truncate">
                            <Monitor size={13} className="text-purple-400 shrink-0" />
                            <span className="text-slate-400 truncate">{parsed.systemInfo}</span>
                          </div>
                        )}
                      </div>

                      {/* Expandable Technical Trace */}
                      {isExpanded && parsed.errorDetails && (
                        <div className="pt-2 border-t border-slate-800 space-y-1">
                          <span className="text-[10px] uppercase tracking-wider text-red-400 font-semibold flex items-center gap-1">
                            <AlertTriangle size={11} /> Technical Error Log
                          </span>
                          <pre className="p-3 rounded-lg bg-black/60 border border-red-950 text-red-300 font-mono text-[11px] overflow-x-auto whitespace-pre-wrap">
                            {parsed.errorDetails}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
