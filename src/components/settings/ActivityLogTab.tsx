"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  History,
  Search,
  Filter,
  Download,
  User,
  Zap,
  Cable,
  CircuitBoard,
  Cpu,
  GitBranch,
  Shield,
  FileText,
  Users,
  RefreshCw,
  Clock,
  Layers,
  ChevronDown,
  ChevronUp,
  ArrowRight,
} from "lucide-react";
import { useProject } from "@/context/ProjectContext";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";
import type { ProjectAuditLog } from "@/types";

interface ActivityLogTabProps {
  projectId?: string;
}

interface ParsedDetails {
  changes?: Array<{
    field: string;
    label: string;
    oldDisplay?: string;
    newDisplay?: string;
    oldValue?: any;
    newValue?: any;
  }>;
  raw?: Record<string, any>;
  hasDetails: boolean;
}

function parseLogDetails(detailsStr: string | null | undefined): ParsedDetails {
  if (!detailsStr) return { hasDetails: false };
  try {
    const parsed = JSON.parse(detailsStr);
    if (!parsed || typeof parsed !== "object") return { hasDetails: false };
    if (parsed.changes && Array.isArray(parsed.changes) && parsed.changes.length > 0) {
      return {
        changes: parsed.changes,
        raw: parsed.raw || parsed,
        hasDetails: true,
      };
    }
    const keys = Object.keys(parsed);
    if (keys.length > 0) {
      return {
        raw: parsed,
        hasDetails: true,
      };
    }
    return { hasDetails: false };
  } catch {
    return { hasDetails: false };
  }
}

export function ActivityLogTab({ projectId: propProjectId }: ActivityLogTabProps = {}) {
  const { selectedProjectId: ctxProjectId, selectedProject } = useProject();
  const selectedProjectId = propProjectId || ctxProjectId;
  const { t, isRtl } = useTranslation();

  const [logs, setLogs] = useState<ProjectAuditLog[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [activeUsers, setActiveUsers] = useState<{ userId: string; userName: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedLogIds, setExpandedLogIds] = useState<Set<string>>(new Set());

  // Filter States
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedEntity, setSelectedEntity] = useState("");
  const [selectedAction, setSelectedAction] = useState("");
  const [offset, setOffset] = useState(0);
  const limit = 40;

  const loadLogs = useCallback(
    async (resetOffset = false) => {
      if (!selectedProjectId) return;
      setLoading(true);
      const currentOffset = resetOffset ? 0 : offset;
      if (resetOffset) setOffset(0);

      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (selectedUser) params.set("userId", selectedUser);
      if (selectedEntity) params.set("entityType", selectedEntity);
      if (selectedAction) params.set("action", selectedAction);
      params.set("limit", String(limit));
      params.set("offset", String(currentOffset));

      try {
        const res = await fetch(`/api/projects/${selectedProjectId}/audit-logs?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          if (resetOffset) {
            setLogs(data.logs || []);
          } else {
            setLogs((prev) => (currentOffset === 0 ? data.logs : [...prev, ...data.logs]));
          }
          setTotalCount(data.totalCount || 0);
          if (data.activeUsers) setActiveUsers(data.activeUsers);
        }
      } catch (err) {
        console.error("Error loading project audit logs:", err);
      } finally {
        setLoading(false);
      }
    },
    [selectedProjectId, search, selectedUser, selectedEntity, selectedAction, offset]
  );

  useEffect(() => {
    loadLogs(true);
  }, [selectedProjectId, selectedUser, selectedEntity, selectedAction]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadLogs(true);
  };

  const handleExportCsv = () => {
    if (!selectedProjectId) return;
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (selectedUser) params.set("userId", selectedUser);
    if (selectedEntity) params.set("entityType", selectedEntity);
    if (selectedAction) params.set("action", selectedAction);
    params.set("format", "csv");

    window.open(`/api/projects/${selectedProjectId}/audit-logs?${params.toString()}`, "_blank");
  };

  const toggleLogExpanded = (id: string) => {
    setExpandedLogIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleExpandAll = () => {
    if (expandedLogIds.size > 0) {
      setExpandedLogIds(new Set());
    } else {
      setExpandedLogIds(new Set(logs.map((l) => l.id)));
    }
  };

  const getEntityIcon = (entityType: string) => {
    switch (entityType) {
      case "CABLE":
        return <Cable size={14} className="text-amber-400" />;
      case "BREAKER":
        return <CircuitBoard size={14} className="text-cyan-400" />;
      case "PANEL":
        return <Cpu size={14} className="text-purple-400" />;
      case "SLD":
      case "BUILDING":
      case "FLOOR":
        return <GitBranch size={14} className="text-indigo-400" />;
      case "TEAM":
        return <Users size={14} className="text-emerald-400" />;
      case "LOAD":
        return <Zap size={14} className="text-amber-400" />;
      case "BUILDING_LOAD":
        return <Layers size={14} className="text-teal-400" />;
      case "QA_NOTE":
        return <Shield size={14} className="text-rose-400" />;
      default:
        return <Zap size={14} className="text-orange-400" />;
    }
  };

  const getActionBadgeClass = (action: string) => {
    switch (action) {
      case "CREATE":
        return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
      case "UPDATE":
        return "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30";
      case "DELETE":
      case "MEMBER_REMOVE":
        return "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30";
      case "INVITE":
      case "MEMBER_ROLE":
        return "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30";
      default:
        return "bg-[var(--card-bg-subtle,rgba(17,24,39,0.8))] text-[var(--table-header-color,#9ca3af)] border-[var(--border-color,#1f2937)]";
    }
  };

  if (!selectedProjectId) {
    return (
      <div className="p-8 text-center text-sm text-[var(--table-header-color,#9ca3af)] rounded-xl border border-[var(--border-color,#1f2937)] bg-[var(--card-bg,#0b0f19)]">
        {t('team.selectProjectPrompt', 'Please select an active project to view its activity log.')}
      </div>
    );
  }

  return (
    <div className="space-y-4 w-full">
      {/* Top Controls: Search, Filters & Export */}
      <div className="p-4 rounded-xl border border-[var(--border-color,#1f2937)] bg-[var(--card-bg,#0b0f19)] shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <form onSubmit={handleSearchSubmit} className="relative flex-1">
            <Search
              size={14}
              className={cn(
                "absolute top-1/2 -translate-y-1/2 text-[var(--table-header-color,#9ca3af)] pointer-events-none z-10",
                isRtl ? "right-3.5" : "left-3.5"
              )}
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('activity.searchPlaceholder', 'Search audit logs (action, description, user)...')}
              className={cn(
                "w-full py-1.5 text-xs rounded-lg transition-all outline-none",
                "bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--foreground-color)] placeholder:text-[var(--table-header-color)]",
                "focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30",
                isRtl ? "!pr-10 !pl-3.5" : "!pl-10 !pr-3.5"
              )}
            />
          </form>

          <div className="flex items-center gap-2">
            <button
              onClick={() => loadLogs(true)}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--card-bg-subtle)] hover:bg-[var(--card-bg)] text-[var(--foreground-color)] text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw size={13} className={loading ? "animate-spin text-orange-400" : ""} />
              <span>{t('activity.refresh', 'Refresh')}</span>
            </button>
            <button
              onClick={handleExportCsv}
              className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
            >
              <Download size={13} />
              <span>{t('activity.exportCsv', 'Export CSV')}</span>
            </button>
          </div>
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--border-color,#1f2937)]/60">
          <div className="flex items-center gap-1.5 text-xs text-[var(--table-header-color,#9ca3af)]">
            <Filter size={12} />
            <span>{t('activity.filters', 'Filters')}:</span>
          </div>

          <select
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
            className="rounded-lg text-[11px] py-1 px-2.5 bg-[var(--input-bg)] border border-[var(--border-color)] text-[var(--foreground-color)] outline-none focus:border-orange-500 cursor-pointer"
          >
            <option value="">{t('activity.allUsers', 'All Users')}</option>
            {activeUsers.map((u) => (
              <option key={u.userId} value={u.userId}>
                {u.userName}
              </option>
            ))}
          </select>

          <select
            value={selectedEntity}
            onChange={(e) => setSelectedEntity(e.target.value)}
            className="rounded-lg text-[11px] py-1 px-2.5 bg-[var(--input-bg)] border border-[var(--border-color)] text-[var(--foreground-color)] outline-none focus:border-orange-500 cursor-pointer"
          >
            <option value="">{t('activity.allCategories', 'All Categories')}</option>
            <option value="PROJECT">{t('nav.settings', 'Project Settings')}</option>
            <option value="LOAD">{t('activity.load', 'Loads & Panels')}</option>
            <option value="BUILDING_LOAD">{t('activity.buildingLoad', 'Building Central Loads')}</option>
            <option value="CABLE">{t('nav.cableSchedule', 'Cable Schedule')}</option>
            <option value="BREAKER">{t('nav.breakerSchedule', 'Breakers & Protection')}</option>
            <option value="BUILDING">{t('activity.building', 'Buildings & Towers')}</option>
            <option value="FLOOR">{t('activity.floor', 'Floors')}</option>
            <option value="PANEL">{t('nav.panelDesigner', 'Panel Layout')}</option>
            <option value="SLD">{t('nav.sldDesigner', 'Single Line Diagram')}</option>
            <option value="TEAM">{t('settings.team', 'Team & Permissions')}</option>
            <option value="QA_NOTE">{t('settings.qa', 'QA Punch List')}</option>
          </select>

          <select
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
            className="rounded-lg text-[11px] py-1 px-2.5 bg-[var(--input-bg)] border border-[var(--border-color)] text-[var(--foreground-color)] outline-none focus:border-orange-500 cursor-pointer"
          >
            <option value="">{t('activity.allActions', 'All Actions')}</option>
            <option value="CREATE">{t('activity.create', 'Create')}</option>
            <option value="UPDATE">{t('activity.update', 'Update')}</option>
            <option value="DELETE">{t('activity.delete', 'Delete')}</option>
            <option value="INVITE">{t('activity.invite', 'Invite')}</option>
            <option value="REVISION">{t('activity.revision', 'Revision')}</option>
          </select>

          {(search || selectedUser || selectedEntity || selectedAction) && (
            <button
              onClick={() => {
                setSearch("");
                setSelectedUser("");
                setSelectedEntity("");
                setSelectedAction("");
              }}
              className="text-[11px] text-orange-500 hover:text-orange-400 ml-auto cursor-pointer font-medium"
            >
              {t('settings.reset', 'Reset Filters')}
            </button>
          )}
        </div>
      </div>

      {/* Log Feed */}
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] overflow-hidden shadow-xs">
        <div className="px-4 py-2.5 border-b border-[var(--border-color)] bg-[var(--card-bg-subtle)] flex items-center justify-between text-xs text-[var(--table-header-color)]">
          <span className="font-semibold uppercase tracking-wider text-[11px] text-[var(--foreground-color)]">
            {t('activity.title', 'Project Activity & Audit Trail')} ({totalCount} {t('activity.totalEvents', 'total events')})
          </span>
          <div className="flex items-center gap-2">
            {logs.length > 0 && (
              <button
                type="button"
                onClick={toggleExpandAll}
                className="text-[11px] font-medium text-[var(--table-header-color)] hover:text-[var(--foreground-color)] px-2 py-0.5 rounded bg-[var(--card-bg-subtle)] hover:bg-[var(--card-bg)] border border-[var(--border-color)] transition-colors cursor-pointer"
              >
                {expandedLogIds.size > 0 ? t('activity.collapseAll', 'Collapse all') : t('activity.expandAll', 'Expand all')}
              </button>
            )}
            <button onClick={() => loadLogs(true)} className="hover:text-orange-500 p-1 text-[var(--table-header-color)] transition-colors cursor-pointer" title={t('common.refresh', 'Refresh')}>
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        <div className="divide-y divide-[var(--border-color)]/60">
          {logs.length === 0 ? (
            <div className="p-12 text-center text-xs text-[var(--table-header-color)]">
              {loading ? t('common.loading', 'Loading activity log...') : t('activity.noLogsFound', 'No activity events match your filter criteria.')}
            </div>
          ) : (
            logs.map((log, idx) => {
              const detailsInfo = parseLogDetails(log.details);
              const isExpanded = expandedLogIds.has(log.id);

              return (
                <div
                  key={log.id}
                  className="p-3.5 flex items-start gap-3 hover:bg-[var(--card-bg-subtle)] transition-colors text-xs"
                >
                  <div className="w-7 h-7 rounded-lg bg-[var(--card-bg-subtle)] border border-[var(--border-color)] flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                    {getEntityIcon(log.entityType)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-[var(--foreground-color)]">{log.userName}</span>
                      <span className="text-[10px] text-[var(--table-header-color)] font-mono">({log.userRole})</span>
                      <span
                        className={cn(
                          "text-[9px] font-bold uppercase px-1.5 py-0.2 rounded border",
                          getActionBadgeClass(log.action)
                        )}
                      >
                        {log.action === "CREATE"
                          ? t('activity.create', 'CREATE')
                          : log.action === "UPDATE"
                          ? t('activity.update', 'UPDATE')
                          : log.action === "DELETE"
                          ? t('activity.delete', 'DELETE')
                          : log.action === "INVITE"
                          ? t('activity.invite', 'INVITE')
                          : log.action === "REVISION"
                          ? t('activity.revision', 'REVISION')
                          : log.action}
                      </span>
                      <span className="text-[10px] font-medium text-[var(--table-header-color)] uppercase bg-[var(--card-bg-subtle)] border border-[var(--border-color)] px-1.5 py-0.2 rounded">
                        {log.entityType}
                      </span>
                    </div>

                    <p className="text-[var(--foreground-color)]/90 mt-1 leading-relaxed font-normal">{log.description}</p>

                    {/* Change Badges and Expandable Details */}
                    {detailsInfo.hasDetails && (
                      <div className="mt-2 space-y-2">
                        {detailsInfo.changes && detailsInfo.changes.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {detailsInfo.changes.map((c, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--card-bg-subtle)] border border-[var(--border-color)] text-[11px]"
                              >
                                <span className="text-[var(--table-header-color)] font-medium">{c.label}:</span>
                                {c.oldDisplay && c.oldDisplay !== "None" && c.oldDisplay !== "Previously Set" && (
                                  <>
                                    <span className="text-rose-600 dark:text-rose-400 line-through text-[10px] font-mono">{c.oldDisplay}</span>
                                    <ArrowRight size={10} className="text-[var(--table-header-color)] shrink-0" />
                                  </>
                                )}
                                <span className="text-emerald-700 dark:text-emerald-300 font-semibold font-mono">{c.newDisplay || String(c.newValue ?? "")}</span>
                              </span>
                            ))}

                            <button
                              type="button"
                              onClick={() => toggleLogExpanded(log.id)}
                              className="inline-flex items-center gap-1 text-[11px] text-[var(--table-header-color)] hover:text-[var(--foreground-color)] px-1.5 py-0.5 rounded hover:bg-[var(--card-bg-subtle)] transition-colors ml-1 font-medium cursor-pointer"
                            >
                              {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                              <span>{isExpanded ? t('activity.hideDetails', 'Hide details') : t('activity.viewDetails', 'Details')}</span>
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => toggleLogExpanded(log.id)}
                            className="inline-flex items-center gap-1 text-[11px] text-[var(--table-header-color)] hover:text-[var(--foreground-color)] px-1.5 py-0.5 rounded hover:bg-[var(--card-bg-subtle)] transition-colors font-medium cursor-pointer"
                          >
                            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            <span>{isExpanded ? t('activity.hideDetails', 'Hide details') : t('activity.viewDetails', 'Details')}</span>
                          </button>
                        )}

                        {/* Expanded Table */}
                        {isExpanded && (
                          <div className="p-3 rounded-xl bg-[var(--card-bg-subtle)] border border-[var(--border-color)] text-[11px] space-y-2">
                            {detailsInfo.changes && detailsInfo.changes.length > 0 ? (
                              <>
                                <div className="font-semibold text-[var(--table-header-color)] uppercase tracking-wider text-[10px] flex items-center justify-between">
                                  <span>{t('activity.changedParameters', 'Changed Parameters')}</span>
                                  <span className="text-[10px] text-[var(--table-header-color)] lowercase font-normal">({detailsInfo.changes.length} fields)</span>
                                </div>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-left">
                                    <thead>
                                      <tr className="border-b border-[var(--border-color)] text-[var(--table-header-color)] text-[10px] uppercase">
                                        <th className="pb-1.5 font-medium">{t('activity.parameter', 'Parameter')}</th>
                                        <th className="pb-1.5 font-medium">{t('activity.previousValue', 'Previous Value')}</th>
                                        <th className="pb-1.5 font-medium">{t('activity.newValue', 'New Value')}</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--border-color)]/40 font-mono">
                                      {detailsInfo.changes.map((c, i) => (
                                        <tr key={i} className="hover:bg-[var(--card-bg)] transition-colors">
                                          <td className="py-1.5 pr-3 text-[var(--foreground-color)] font-sans font-medium">{c.label}</td>
                                          <td className="py-1.5 pr-3 text-rose-600 dark:text-rose-400 line-through">
                                            {c.oldDisplay || "—"}
                                          </td>
                                          <td className="py-1.5 text-emerald-700 dark:text-emerald-400 font-semibold">
                                            {c.newDisplay || "—"}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </>
                            ) : (
                              <pre className="text-[var(--foreground-color)] font-mono text-[11px] overflow-x-auto max-h-48 whitespace-pre-wrap">
                                {JSON.stringify(detailsInfo.raw, null, 2)}
                              </pre>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="text-[10px] text-[var(--table-header-color)] shrink-0 flex items-center gap-1">
                    <Clock size={11} />
                    <span>{new Date(log.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Load More Pagination */}
        {logs.length < totalCount && (
          <div className="p-3 border-t border-[var(--border-color)] text-center bg-[var(--card-bg-subtle)]">
            <button
              onClick={() => {
                setOffset((prev) => prev + limit);
                loadLogs(false);
              }}
              disabled={loading}
              className="text-xs font-semibold text-orange-500 hover:text-orange-400 py-1.5 px-4 rounded-lg bg-[var(--card-bg-subtle)] hover:bg-[var(--card-bg)] border border-[var(--border-color)] transition-colors cursor-pointer"
            >
              {loading ? t('common.loading', 'Loading more...') : t('activity.loadMore', 'Load Older Activity')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
