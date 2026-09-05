"use client";

import React, { useState, useEffect } from "react";
import {
  ClipboardCheck,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Info,
  Trash2,
  RefreshCw,
  Filter,
  Plus,
  Maximize2,
  X,
} from "lucide-react";
import { useProject } from "@/context/ProjectContext";
import { useTranslation } from "@/i18n";
import type { ProjectReviewItem } from "@/types";

interface QAReviewTabProps {
  projectId?: string;
}

export function QAReviewTab({ projectId: propProjectId }: QAReviewTabProps = {}) {
  const { selectedProjectId: ctxProjectId, selectedProject, isProjectManager, isQA } = useProject();
  const selectedProjectId = propProjectId || ctxProjectId;
  const { t } = useTranslation();

  const [items, setItems] = useState<ProjectReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [pageFilter, setPageFilter] = useState<string>("ALL");
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);

  const loadItems = async () => {
    if (!selectedProjectId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${selectedProjectId}/review-items`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch (err) {
      console.error("Error loading QA review items:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, [selectedProjectId]);

  const handleToggleStatus = async (item: ProjectReviewItem) => {
    if (!selectedProjectId) return;
    const nextStatus = item.status === "OPEN" ? "RESOLVED" : "OPEN";
    try {
      const res = await fetch(`/api/projects/${selectedProjectId}/review-items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        await loadItems();
      }
    } catch (err) {
      console.error("Error toggling QA item status:", err);
    }
  };

  const handleDelete = async (itemId: string) => {
    if (!selectedProjectId) return;
    if (!confirm("Are you sure you want to delete this QA note?")) return;

    try {
      const res = await fetch(`/api/projects/${selectedProjectId}/review-items/${itemId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await loadItems();
      }
    } catch (err) {
      console.error("Error deleting QA item:", err);
    }
  };

  if (!selectedProjectId) {
    return (
      <div className="p-8 text-center text-sm text-slate-500 rounded-xl border border-slate-800 bg-slate-900/30">
        {t('team.selectProjectPrompt', 'Please select an active project to view QA compliance notes.')}
      </div>
    );
  }

  const openCritical = items.filter((i) => i.status === "OPEN" && i.severity === "CRITICAL").length;
  const openWarning = items.filter((i) => i.status === "OPEN" && i.severity === "WARNING").length;
  const resolved = items.filter((i) => i.status === "RESOLVED").length;

  const filteredItems = items.filter((item) => {
    if (statusFilter !== "ALL" && item.status !== statusFilter) return false;
    if (pageFilter !== "ALL" && item.pageKey !== pageFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6 w-full">
      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">{t('qa.totalNotes', 'Total Notes')}</span>
          <span className="text-xl font-bold text-white mt-1 block">{items.length}</span>
        </div>

        <div className="p-4 rounded-xl border border-rose-900/40 bg-rose-950/10">
          <span className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider block">{t('qa.criticalNotes', 'Critical Issues')}</span>
          <span className="text-xl font-bold text-rose-400 mt-1 block">{openCritical}</span>
        </div>

        <div className="p-4 rounded-xl border border-amber-900/40 bg-amber-950/10">
          <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider block">{t('qa.warningNotes', 'Warnings')}</span>
          <span className="text-xl font-bold text-amber-400 mt-1 block">{openWarning}</span>
        </div>

        <div className="p-4 rounded-xl border border-emerald-900/40 bg-emerald-950/10">
          <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider block">{t('qa.resolvedNotes', 'Resolved')}</span>
          <span className="text-xl font-bold text-emerald-400 mt-1 block">{resolved}</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-slate-800 bg-slate-900/40">
        <div className="flex items-center gap-2">
          <Filter size={13} className="text-slate-400" />
          <span className="text-xs text-slate-300 font-medium">{t('common.status', 'Status')}:</span>
          {(["ALL", "OPEN", "RESOLVED"] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                statusFilter === st
                  ? "bg-orange-500/20 text-orange-300 border-orange-500/40"
                  : "bg-slate-800/80 text-slate-400 border-slate-700/60 hover:text-slate-200"
              }`}
            >
              {st === "ALL" ? t('activity.allActions', 'ALL') : st === "OPEN" ? t('qa.open', 'OPEN') : t('qa.resolved', 'RESOLVED')}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button onClick={loadItems} className="text-slate-400 hover:text-white p-1" title={t('common.refresh', 'Refresh')}>
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Review Notes Feed */}
      <div className="space-y-3">
        {filteredItems.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500 rounded-xl border border-slate-800 bg-slate-900/30">
            {loading ? t('common.loading', 'Loading QA review notes...') : t('qa.noNotes', 'No QA review notes match the selected filters.')}
          </div>
        ) : (
          filteredItems.map((item) => {
            const isResolved = item.status === "RESOLVED";
            return (
              <div
                key={item.id}
                className={`p-4 rounded-xl border transition-all ${
                  isResolved
                    ? "bg-slate-950/40 border-slate-900 opacity-60"
                    : item.severity === "CRITICAL"
                    ? "bg-rose-950/20 border-rose-800/40"
                    : item.severity === "WARNING"
                    ? "bg-amber-950/20 border-amber-800/40"
                    : "bg-slate-900/60 border-slate-800"
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                        item.severity === "CRITICAL"
                          ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                          : item.severity === "WARNING"
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                          : "bg-blue-500/20 text-blue-300 border-blue-500/40"
                      }`}
                    >
                      {item.severity}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase bg-slate-800 px-2 py-0.5 rounded">
                      {item.pageKey}
                    </span>
                    <h4 className="text-sm font-bold text-white">{item.title}</h4>
                  </div>

                  <button
                    onClick={() => handleToggleStatus(item)}
                    className={`text-xs font-bold flex items-center gap-1.5 px-3 py-1 rounded-full border transition-colors shrink-0 ${
                      isResolved
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-slate-800"
                        : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-emerald-500/20 hover:text-emerald-300"
                    }`}
                  >
                    <CheckCircle2 size={13} className={isResolved ? "text-emerald-400" : "text-slate-500"} />
                    {isResolved ? t('qa.resolved', 'Resolved') : t('qa.markResolved', 'Mark Resolved')}
                  </button>
                </div>

                {item.description && (
                  <p className="text-xs text-slate-300 mb-3 whitespace-pre-wrap leading-relaxed">
                    {item.description}
                  </p>
                )}

                {item.screenshotUrl && (
                  <div className="mb-3">
                    <button
                      type="button"
                      onClick={() => setZoomImageUrl(item.screenshotUrl!)}
                      className="group relative block overflow-hidden rounded-lg border border-slate-800 hover:border-orange-500/50 transition-all text-left bg-slate-950/80 max-w-sm"
                    >
                      <img
                        src={item.screenshotUrl}
                        alt="QA Finding Screenshot"
                        className="w-full max-h-36 object-cover object-top transition-transform group-hover:scale-[1.02]"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-semibold gap-1.5">
                        <Maximize2 size={13} />
                        <span>{t("qa.viewScreenshot", "View Screenshot")}</span>
                      </div>
                    </button>
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-800/60">
                  <span>Logged by {item.createdBy?.name || item.createdBy?.username || "QA Reviewer"}</span>
                  <div className="flex items-center gap-3">
                    <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                    {(isProjectManager || isQA) && (
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="text-slate-500 hover:text-rose-400 p-1"
                        title={t('common.delete', 'Delete')}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Full-Screen Screenshot Lightbox Modal */}
      {zoomImageUrl && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-150"
          onClick={() => setZoomImageUrl(null)}
        >
          <div className="relative max-w-5xl max-h-[90vh] flex flex-col items-center">
            <button
              onClick={() => setZoomImageUrl(null)}
              className="absolute -top-10 right-0 p-1.5 text-white/80 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-full transition-colors"
              title={t("common.close", "Close")}
            >
              <X size={18} />
            </button>
            <img
              src={zoomImageUrl}
              alt="Expanded QA Screenshot"
              className="max-w-full max-h-[85vh] rounded-lg shadow-2xl border border-slate-700 object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}
