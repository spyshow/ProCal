"use client";

import React, { useState, useEffect } from "react";
import {
  ClipboardCheck,
  Plus,
  X,
  AlertTriangle,
  Info,
  AlertOctagon,
  CheckCircle2,
  Clock,
  Send,
  Trash2,
} from "lucide-react";
import { useProject } from "@/context/ProjectContext";
import { useTranslation } from "@/i18n";
import type { ProjectReviewItem } from "@/types";

interface QAReviewDrawerProps {
  pageKey: string;
  pageTitle?: string;
}

export function QAReviewDrawer({ pageKey, pageTitle }: QAReviewDrawerProps) {
  const { selectedProjectId, currentMemberRole, isQA, isProjectManager } = useProject();
  const { t, isRtl } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<ProjectReviewItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<"CRITICAL" | "WARNING" | "NOTE">("WARNING");
  const [formOpen, setFormOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadItems = async () => {
    if (!selectedProjectId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${selectedProjectId}/review-items?pageKey=${pageKey}`);
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
    if (isOpen && selectedProjectId) {
      loadItems();
    }
  }, [isOpen, selectedProjectId, pageKey]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !selectedProjectId) return;

    setCreating(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/projects/${selectedProjectId}/review-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageKey,
          title: title.trim(),
          description: description.trim(),
          severity,
        }),
      });

      if (res.ok) {
        setTitle("");
        setDescription("");
        setFormOpen(false);
        await loadItems();
      } else {
        const err = await res.json();
        setMessage(err.error || "Failed to create QA review note");
      }
    } catch {
      setMessage("Failed to create QA review note");
    } finally {
      setCreating(false);
    }
  };

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
      console.error("Failed to toggle QA item status:", err);
    }
  };

  const handleDelete = async (itemId: string) => {
    if (!selectedProjectId) return;
    try {
      const res = await fetch(`/api/projects/${selectedProjectId}/review-items/${itemId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await loadItems();
      }
    } catch (err) {
      console.error("Failed to delete QA item:", err);
    }
  };

  if (!selectedProjectId) return null;

  const openCount = items.filter((i) => i.status === "OPEN").length;

  return (
    <>
      {/* Floating Trigger Button */}
      <div
        className={`fixed bottom-5 z-40 ${
          isRtl ? "left-5" : "right-5"
        }`}
      >
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-slate-900/95 hover:bg-slate-800 text-slate-200 border border-slate-700/80 shadow-2xl hover:shadow-orange-500/10 hover:border-orange-500/50 transition-all duration-200 text-xs font-semibold backdrop-blur-md group"
          title={t("rbac.qaReviewNotes", "QA Review Notes")}
        >
          <ClipboardCheck size={16} className="text-orange-400 group-hover:scale-110 transition-transform" />
          <span className="hidden sm:inline">{t("rbac.qaNotes", "QA Notes")}</span>
          {openCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
              {openCount}
            </span>
          )}
        </button>
      </div>

      {/* Slide-out Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs flex justify-end">
          <div
            className={`w-full max-w-md bg-slate-950 border-s border-slate-800 h-full flex flex-col shadow-2xl animate-in slide-in-from-${
              isRtl ? "left" : "right"
            } duration-200`}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/50">
              <div className="flex items-center gap-2.5">
                <ClipboardCheck size={18} className="text-orange-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {t("qa.drawerTitle", "QA Compliance & Punch List")}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {pageTitle || pageKey} • {openCount} {t("qa.open", "open notes")}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {formOpen ? (
                <form onSubmit={handleCreate} className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Plus size={14} className="text-orange-400" />
                      {t("qa.addNote", "New QA Review Note")}
                    </span>
                    <button
                      type="button"
                      onClick={() => setFormOpen(false)}
                      className="text-slate-400 hover:text-white text-xs"
                    >
                      {t("common.cancel", "Cancel")}
                    </button>
                  </div>

                  {message && (
                    <div className="p-2 text-xs rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                      {message}
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">
                      {t("qa.noteSeverity", "Severity Level")}
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(["CRITICAL", "WARNING", "NOTE"] as const).map((sev) => (
                        <button
                          key={sev}
                          type="button"
                          onClick={() => setSeverity(sev)}
                          className={`px-2 py-1.5 rounded text-[11px] font-bold border transition-colors ${
                            severity === sev
                              ? sev === "CRITICAL"
                                ? "bg-rose-500/20 text-rose-300 border-rose-500/50"
                                : sev === "WARNING"
                                ? "bg-amber-500/20 text-amber-300 border-amber-500/50"
                                : "bg-blue-500/20 text-blue-300 border-blue-500/50"
                              : "bg-slate-800/80 text-slate-400 border-slate-700/60"
                          }`}
                        >
                          {sev}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">
                      {t("qa.noteTitle", "Title / Item Tag")}
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder={t("qa.noteTitlePlaceholder", "e.g., Feeder F1 voltage drop exceeds 3%")}
                      className="dense-input w-full rounded text-xs"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">
                      {t("qa.noteDesc", "Description & Recommendations")}
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder={t("qa.noteDescPlaceholder", "Describe the discrepancy and requested engineering correction...")}
                      className="dense-input w-full rounded text-xs h-20 resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={creating || !title.trim()}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold disabled:opacity-50 transition-colors"
                  >
                    <Send size={12} />
                    {creating ? t("qa.saving", "Saving...") : t("qa.saveNote", "Post Review Note")}
                  </button>
                </form>
              ) : (
                <button
                  onClick={() => setFormOpen(true)}
                  className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl border border-dashed border-slate-700 hover:border-orange-500/60 hover:bg-orange-500/5 text-slate-300 hover:text-orange-300 text-xs font-medium transition-all"
                >
                  <Plus size={14} className="text-orange-400" />
                  {t("qa.addNote", "+ Add Note for this Module")}
                </button>
              )}

              {loading ? (
                <div className="py-8 text-center text-xs text-slate-500 animate-pulse">
                  {t("common.loading", "Loading notes...")}
                </div>
              ) : items.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500">
                  {t("qa.noNotes", "No QA review notes logged for this module.")}
                </div>
              ) : (
                items.map((item) => {
                  const isResolved = item.status === "RESOLVED";
                  return (
                    <div
                      key={item.id}
                      className={`p-3.5 rounded-xl border transition-all ${
                        isResolved
                          ? "bg-slate-950/40 border-slate-900 opacity-60"
                          : item.severity === "CRITICAL"
                          ? "bg-rose-950/20 border-rose-800/40"
                          : item.severity === "WARNING"
                          ? "bg-amber-950/20 border-amber-800/40"
                          : "bg-slate-900/60 border-slate-800"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${
                              item.severity === "CRITICAL"
                                ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                                : item.severity === "WARNING"
                                ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                                : "bg-blue-500/20 text-blue-300 border-blue-500/40"
                            }`}
                          >
                            {item.severity}
                          </span>
                          <span className="text-xs font-semibold text-slate-200 line-clamp-1">
                            {item.title}
                          </span>
                        </div>

                        <button
                          onClick={() => handleToggleStatus(item)}
                          className={`text-[10px] font-bold flex items-center gap-1 px-2 py-0.5 rounded-full border transition-colors ${
                            isResolved
                              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-slate-800"
                              : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-emerald-500/20 hover:text-emerald-300"
                          }`}
                          title={isResolved ? t("qa.reopen", "Click to Reopen") : t("qa.markResolved", "Click to Resolve")}
                        >
                          <CheckCircle2 size={11} className={isResolved ? "text-emerald-400" : "text-slate-500"} />
                          {isResolved ? t("qa.resolved", "Resolved") : t("qa.open", "Open")}
                        </button>
                      </div>

                      {item.description && (
                        <p className="text-xs text-slate-400 mb-2 leading-relaxed whitespace-pre-wrap">
                          {item.description}
                        </p>
                      )}

                      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-2 border-t border-slate-800/60">
                        <span>By {item.createdBy?.name || item.createdBy?.username || "QA"}</span>
                        <div className="flex items-center gap-2">
                          <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                          {(isProjectManager || isQA) && (
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="text-slate-600 hover:text-rose-400 p-0.5"
                              title={t("common.delete", "Delete Note")}
                            >
                              <Trash2 size={11} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
