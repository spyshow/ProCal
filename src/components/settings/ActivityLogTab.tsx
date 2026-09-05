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
} from "lucide-react";
import { useProject } from "@/context/ProjectContext";
import { useTranslation } from "@/i18n";
import type { ProjectAuditLog } from "@/types";

interface ActivityLogTabProps {
  projectId?: string;
}

export function ActivityLogTab({ projectId: propProjectId }: ActivityLogTabProps = {}) {
  const { selectedProjectId: ctxProjectId, selectedProject } = useProject();
  const selectedProjectId = propProjectId || ctxProjectId;
  const { t } = useTranslation();

  const [logs, setLogs] = useState<ProjectAuditLog[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [activeUsers, setActiveUsers] = useState<{ userId: string; userName: string }[]>([]);
  const [loading, setLoading] = useState(true);

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
      case "QA_NOTE":
        return <Shield size={14} className="text-rose-400" />;
      default:
        return <Zap size={14} className="text-orange-400" />;
    }
  };

  const getActionBadgeClass = (action: string) => {
    switch (action) {
      case "CREATE":
        return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
      case "UPDATE":
        return "bg-blue-500/15 text-blue-300 border-blue-500/30";
      case "DELETE":
      case "MEMBER_REMOVE":
        return "bg-rose-500/15 text-rose-300 border-rose-500/30";
      case "INVITE":
      case "MEMBER_ROLE":
        return "bg-amber-500/15 text-amber-300 border-amber-500/30";
      default:
        return "bg-slate-800 text-slate-400 border-slate-700";
    }
  };

  if (!selectedProjectId) {
    return (
      <div className="p-8 text-center text-sm text-slate-500 rounded-xl border border-slate-800 bg-slate-900/30">
        {t('team.selectProjectPrompt', 'Please select an active project to view its activity log.')}
      </div>
    );
  }

  return (
    <div className="space-y-4 w-full">
      {/* Top Controls: Search, Filters & Export */}
      <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <form onSubmit={handleSearchSubmit} className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('activity.searchPlaceholder', 'Search activity log by keyword, circuit tag, or description...')}
              className="dense-input w-full pl-9 pr-3 rounded-xl text-xs"
            />
          </form>

          <button
            onClick={handleExportCsv}
            className="flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors shrink-0"
            title={t('activity.exportCsv', 'Export to CSV')}
          >
            <Download size={13} />
            {t('activity.exportCsv', 'Export CSV')}
          </button>
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Filter size={12} />
            <span>{t('activity.filters', 'Filters')}:</span>
          </div>

          <select
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
            className="dense-input rounded-lg text-[11px] py-1 bg-slate-950/80 border-slate-800"
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
            className="dense-input rounded-lg text-[11px] py-1 bg-slate-950/80 border-slate-800"
          >
            <option value="">{t('activity.allCategories', 'All Categories')}</option>
            <option value="PROJECT">{t('nav.settings', 'Project Settings')}</option>
            <option value="CABLE">{t('nav.cableSchedule', 'Cable Schedule')}</option>
            <option value="BREAKER">{t('nav.breakerSchedule', 'Breakers & Protection')}</option>
            <option value="PANEL">{t('nav.panelDesigner', 'Panel Layout')}</option>
            <option value="SLD">{t('nav.sldDesigner', 'Single Line Diagram')}</option>
            <option value="TEAM">{t('settings.team', 'Team & Permissions')}</option>
            <option value="QA_NOTE">{t('settings.qa', 'QA Punch List')}</option>
          </select>

          <select
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
            className="dense-input rounded-lg text-[11px] py-1 bg-slate-950/80 border-slate-800"
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
              className="text-[11px] text-orange-400 hover:text-orange-300 ml-auto"
            >
              {t('settings.reset', 'Reset Filters')}
            </button>
          )}
        </div>
      </div>

      {/* Log Feed */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span className="font-semibold uppercase tracking-wider text-[11px]">
            {t('activity.title', 'Activity History')} ({totalCount} {t('activity.totalEvents', 'recorded events')})
          </span>
          <button onClick={() => loadLogs(true)} className="hover:text-white p-1" title={t('common.refresh', 'Refresh')}>
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        <div className="divide-y divide-slate-800/60">
          {logs.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-500">
              {loading ? t('common.loading', 'Loading activity log...') : t('activity.noLogsFound', 'No activity events match your filter criteria.')}
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className="p-3.5 flex items-start gap-3 hover:bg-slate-900/60 transition-colors text-xs"
              >
                <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                  {getEntityIcon(log.entityType)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-200">{log.userName}</span>
                    <span className="text-[10px] text-slate-500 font-mono">({log.userRole})</span>
                    <span
                      className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded border ${getActionBadgeClass(
                        log.action
                      )}`}
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
                    <span className="text-[10px] font-medium text-slate-400 uppercase bg-slate-800/80 px-1.5 py-0.2 rounded">
                      {log.entityType}
                    </span>
                  </div>

                  <p className="text-slate-300 mt-1 leading-relaxed">{log.description}</p>
                </div>

                <div className="text-[10px] text-slate-500 shrink-0 flex items-center gap-1">
                  <Clock size={11} />
                  <span>{new Date(log.createdAt).toLocaleString()}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Load More Pagination */}
        {logs.length < totalCount && (
          <div className="p-3 border-t border-slate-800 text-center">
            <button
              onClick={() => {
                setOffset((prev) => prev + limit);
                loadLogs(false);
              }}
              disabled={loading}
              className="text-xs font-semibold text-orange-400 hover:text-orange-300 py-1 px-3 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700 transition-colors"
            >
              {loading ? t('common.loading', 'Loading more...') : t('activity.loadMore', 'Load Older Activity')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
