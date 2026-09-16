"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
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
  Camera,
  Upload,
  Maximize2,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { useProject } from "@/context/ProjectContext";
import { useTranslation } from "@/i18n";
import type { ProjectReviewItem } from "@/types";
import {
  captureScreen,
  uploadScreenshot,
  extractImageFromClipboard,
} from "@/lib/screenshot";

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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<"CRITICAL" | "WARNING" | "NOTE">("WARNING");
  const [formOpen, setFormOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Screenshot State
  const [includeScreenshot, setIncludeScreenshot] = useState(false);
  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Listen for clipboard paste events when form is open
  useEffect(() => {
    if (!formOpen) return;
    const handlePaste = (e: ClipboardEvent) => {
      const file = extractImageFromClipboard(e);
      if (file) {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === "string") {
            setScreenshotDataUrl(reader.result);
            setIncludeScreenshot(true);
          }
        };
        reader.readAsDataURL(file);
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [formOpen]);

  const handleCaptureScreen = async () => {
    setIsCapturing(true);
    setMessage(null);
    try {
      const dataUrl = await captureScreen();
      if (dataUrl) {
        setScreenshotDataUrl(dataUrl);
        setIncludeScreenshot(true);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to capture screen";
      setMessage(msg);
    } finally {
      setIsCapturing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMessage("Please select a valid image file (PNG, JPEG, WebP)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setScreenshotDataUrl(reader.result);
        setIncludeScreenshot(true);
      }
    };
    reader.readAsDataURL(file);
  };

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
      let finalScreenshotUrl: string | null = null;
      if (includeScreenshot && screenshotDataUrl) {
        try {
          finalScreenshotUrl = await uploadScreenshot(screenshotDataUrl);
        } catch (uploadErr) {
          console.warn("Could not upload screenshot file, fallback to data url:", uploadErr);
          finalScreenshotUrl = screenshotDataUrl;
        }
      }

      const res = await fetch(`/api/projects/${selectedProjectId}/review-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageKey,
          title: title.trim(),
          description: description.trim(),
          severity,
          screenshotUrl: finalScreenshotUrl,
        }),
      });

      if (res.ok) {
        setTitle("");
        setDescription("");
        setScreenshotDataUrl(null);
        setIncludeScreenshot(false);
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
        data-qa-ignore="true"
        className={`qa-floating-trigger fixed bottom-[66px] z-40 ${
          isRtl ? "left-5" : "right-5"
        } print:hidden`}
      >
        <button
          onClick={() => setIsOpen(true)}
          className="group flex items-center justify-center gap-2 w-[142px] h-[40px] px-3.5 py-2 rounded-full bg-[var(--card-bg)] hover:bg-[var(--card-bg-subtle)] text-[var(--foreground-color)] border border-[var(--border-color)] shadow-lg shadow-black/20 hover:shadow-orange-500/10 hover:border-orange-500/50 transition-all duration-200 transform hover:scale-105 active:scale-95 text-xs font-semibold backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-orange-400 cursor-pointer"
          title={t("qa.qaReviewNotes", "QA Review Notes")}
        >
          <ClipboardCheck size={17} className="text-orange-600 dark:text-orange-400 group-hover:scale-110 transition-transform shrink-0" />
          <span className="whitespace-nowrap font-medium text-xs">{t("qa.qaNotes", "QA Notes")}</span>
          {openCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-orange-600 text-white text-[10px] font-bold flex items-center justify-center animate-pulse shrink-0 ml-0.5">
              {openCount}
            </span>
          )}
        </button>
      </div>

      {/* Slide-out Drawer */}
      {mounted && typeof document !== "undefined" && isOpen && createPortal(
        <div
          data-qa-ignore="true"
          className="qa-drawer-overlay fixed inset-0 w-screen h-screen h-dvh z-50 overflow-hidden bg-black/60 backdrop-blur-xs flex justify-end"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsOpen(false);
          }}
        >
          <div
            className={`w-full max-w-md bg-[var(--card-bg)] border-s border-[var(--border-color)] h-full h-screen h-dvh min-h-screen flex flex-col shadow-2xl animate-in slide-in-from-${
              isRtl ? "left" : "right"
            } duration-200 text-[var(--foreground-color)]`}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)] bg-[var(--card-bg-subtle)] shrink-0">
              <div className="flex items-center gap-2.5">
                <ClipboardCheck size={18} className="text-orange-600 dark:text-orange-400" />
                <div>
                  <h3 className="text-sm font-bold text-[var(--foreground-color)]">
                    {t("qa.drawerTitle", "QA Compliance & Punch List")}
                  </h3>
                  <div className="text-[11px] text-[var(--table-header-color)] flex items-center gap-1.5 flex-wrap">
                    <span>{pageTitle || pageKey} • {openCount} {t("qa.open", "open notes")}</span>
                    {selectedProjectId && (
                      <>
                        <span>•</span>
                        <Link
                          href={`/projects/${selectedProjectId}?tab=qa`}
                          onClick={() => setIsOpen(false)}
                          className="text-[10px] text-orange-700 dark:text-orange-400 hover:underline inline-flex items-center gap-0.5 font-semibold"
                        >
                          {t("qa.viewAllProjectNotes", "Full Project QA")}
                          <ExternalLink size={9} />
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-[var(--table-header-color)] hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-500/10 dark:hover:bg-orange-500/20 border border-transparent hover:border-orange-500/30 transition-all cursor-pointer"
                title={t("common.close", "Close")}
                aria-label={t("common.close", "Close")}
              >
                <X size={16} />
              </button>
            </div>

            {/* Content List */}
            <div className="flex-1 overflow-y-auto p-4 pb-12 space-y-3 custom-scrollbar">
              {formOpen ? (
                <form onSubmit={handleCreate} className="p-4 rounded-xl bg-[var(--card-bg-subtle)] border border-[var(--border-color)] space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between pb-2 border-b border-[var(--border-color)]">
                    <span className="text-xs font-bold text-[var(--foreground-color)] flex items-center gap-1.5">
                      <Plus size={14} className="text-orange-600 dark:text-orange-400" />
                      {t("qa.addNote", "New QA Review Note")}
                    </span>
                    <button
                      type="button"
                      onClick={() => setFormOpen(false)}
                      className="text-[var(--table-header-color)] hover:text-[var(--foreground-color)] text-xs cursor-pointer"
                    >
                      {t("common.cancel", "Cancel")}
                    </button>
                  </div>

                  {message && (
                    <div className="p-2 text-xs rounded bg-rose-500/10 text-rose-800 dark:text-rose-300 border border-rose-500/30">
                      {message}
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] font-semibold text-[var(--table-header-color)] uppercase mb-1">
                      {t("qa.noteSeverity", "Severity Level")}
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(["CRITICAL", "WARNING", "NOTE"] as const).map((sev) => (
                        <button
                          key={sev}
                          type="button"
                          onClick={() => setSeverity(sev)}
                          className={`px-2 py-1.5 rounded text-[11px] font-bold border transition-colors cursor-pointer ${
                            severity === sev
                              ? sev === "CRITICAL"
                                ? "bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-500/50 shadow-2xs"
                                : sev === "WARNING"
                                ? "bg-amber-500/15 text-amber-900 dark:text-amber-300 border-amber-500/50 shadow-2xs"
                                : "bg-sky-500/15 text-sky-800 dark:text-sky-300 border-sky-500/50 shadow-2xs"
                              : "bg-[var(--card-bg)] text-[var(--table-header-color)] hover:text-[var(--foreground-color)] border-[var(--border-color)]"
                          }`}
                        >
                          {sev}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-[var(--table-header-color)] uppercase mb-1">
                      {t("qa.noteTitle", "Title / Item Tag")}
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder={t("qa.noteTitlePlaceholder", "e.g., Feeder F1 voltage drop exceeds 3%")}
                      className="dense-input w-full rounded text-xs bg-[var(--input-bg)] border border-[var(--border-color)] text-[var(--foreground-color)] placeholder:text-[var(--table-header-color)]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-[var(--table-header-color)] uppercase mb-1">
                      {t("qa.noteDesc", "Description & Recommendations")}
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder={t("qa.noteDescPlaceholder", "Describe the discrepancy and requested engineering correction...")}
                      className="dense-input w-full rounded text-xs h-20 resize-none bg-[var(--input-bg)] border border-[var(--border-color)] text-[var(--foreground-color)] placeholder:text-[var(--table-header-color)]"
                    />
                  </div>

                  {/* Include a screenshot section */}
                  <div className="rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)] p-3 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-[var(--foreground-color)] select-none">
                        <input
                          type="checkbox"
                          checked={includeScreenshot}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setIncludeScreenshot(checked);
                            if (checked && !screenshotDataUrl) {
                              handleCaptureScreen();
                            }
                          }}
                          className="rounded border-[var(--border-color)] text-orange-600 focus:ring-orange-500 bg-[var(--input-bg)] h-3.5 w-3.5"
                        />
                        <span className="flex items-center gap-1.5">
                          <Camera size={13} className="text-orange-600 dark:text-orange-400" />
                          {t("qa.includeScreenshot", "Include a screenshot")}
                        </span>
                      </label>

                      {includeScreenshot && screenshotDataUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            setScreenshotDataUrl(null);
                            setIncludeScreenshot(false);
                            if (fileInputRef.current) fileInputRef.current.value = "";
                          }}
                          className="text-[11px] text-rose-700 dark:text-rose-400 hover:underline transition-colors cursor-pointer"
                        >
                          {t("qa.removeScreenshot", "Remove")}
                        </button>
                      )}
                    </div>

                    {includeScreenshot && (
                      <div className="space-y-2 pt-1 border-t border-[var(--border-color)]">
                        {screenshotDataUrl ? (
                          <div className="relative group rounded-lg overflow-hidden border border-[var(--border-color)] bg-[var(--card-bg)]">
                            <img
                              src={screenshotDataUrl}
                              alt="Captured Screenshot"
                              className="w-full max-h-32 object-cover object-top"
                            />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => setZoomImageUrl(screenshotDataUrl)}
                                className="px-2 py-1 rounded bg-[var(--card-bg)] text-[var(--foreground-color)] border border-[var(--border-color)] text-[11px] font-medium hover:border-orange-500/50 flex items-center gap-1 cursor-pointer"
                              >
                                <Maximize2 size={11} />
                                {t("common.preview", "Preview")}
                              </button>
                              <button
                                type="button"
                                onClick={handleCaptureScreen}
                                disabled={isCapturing}
                                className="px-2 py-1 rounded bg-orange-600 text-white text-[11px] font-medium hover:bg-orange-500 flex items-center gap-1 cursor-pointer"
                              >
                                <Camera size={11} />
                                {isCapturing ? t("qa.capturing", "Capturing...") : t("qa.retake", "Retake")}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2">
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={handleCaptureScreen}
                                disabled={isCapturing}
                                className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)] hover:bg-[var(--card-bg-subtle)] text-[var(--foreground-color)] hover:border-orange-500/40 text-xs font-medium transition-colors cursor-pointer"
                              >
                                {isCapturing ? (
                                  <>
                                    <Loader2 size={12} className="animate-spin text-orange-500" />
                                    <span>{t("qa.capturing", "Capturing...")}</span>
                                  </>
                                ) : (
                                  <>
                                    <Camera size={12} className="text-orange-500" />
                                    <span>{t("qa.captureScreen", "Capture Screen")}</span>
                                  </>
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)] hover:bg-[var(--card-bg-subtle)] text-[var(--foreground-color)] hover:border-orange-500/40 text-xs font-medium transition-colors cursor-pointer"
                              >
                                <Upload size={12} className="text-cyan-500" />
                                <span>{t("qa.uploadImage", "Upload Image")}</span>
                              </button>
                            </div>
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept="image/*"
                              onChange={handleFileUpload}
                              className="hidden"
                            />
                            <p className="text-[10px] text-[var(--table-header-color)] text-center">
                              {t("qa.pasteHint", "Tip: You can also paste an image from clipboard (Ctrl + V)")}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
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
                  className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl border border-dashed border-[var(--border-color)] hover:border-orange-500/60 hover:bg-orange-500/5 text-[var(--foreground-color)] hover:text-orange-600 dark:hover:text-orange-400 text-xs font-medium transition-all cursor-pointer"
                >
                  <Plus size={14} className="text-orange-600 dark:text-orange-400" />
                  {t("qa.addNote", "+ Add Note for this Module")}
                </button>
              )}

              {loading ? (
                <div className="py-8 text-center text-xs text-[var(--table-header-color)] animate-pulse">
                  {t("common.loading", "Loading notes...")}
                </div>
              ) : items.length === 0 ? (
                <div className="py-12 text-center text-xs text-[var(--table-header-color)]">
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
                          ? "bg-[var(--card-bg-subtle)]/50 border-[var(--border-color)] opacity-60"
                          : item.severity === "CRITICAL"
                          ? "bg-rose-500/10 border-rose-500/30"
                          : item.severity === "WARNING"
                          ? "bg-amber-500/10 border-amber-500/30"
                          : "bg-[var(--card-bg-subtle)] border-[var(--border-color)]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${
                              item.severity === "CRITICAL"
                                ? "bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-500/40"
                                : item.severity === "WARNING"
                                ? "bg-amber-500/15 text-amber-900 dark:text-amber-300 border-amber-500/40"
                                : "bg-sky-500/15 text-sky-800 dark:text-sky-300 border-sky-500/40"
                            }`}
                          >
                            {item.severity}
                          </span>
                          <span className="text-xs font-semibold text-[var(--foreground-color)] line-clamp-1">
                            {item.title}
                          </span>
                        </div>

                        <button
                          onClick={() => handleToggleStatus(item)}
                          className={`text-[10px] font-bold flex items-center gap-1 px-2 py-0.5 rounded-full border transition-colors cursor-pointer ${
                            isResolved
                              ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/40 hover:bg-[var(--card-bg)]"
                              : "bg-[var(--card-bg)] text-[var(--table-header-color)] border-[var(--border-color)] hover:bg-emerald-500/15 hover:text-emerald-800 dark:hover:text-emerald-300"
                          }`}
                          title={isResolved ? t("qa.reopen", "Click to Reopen") : t("qa.markResolved", "Click to Resolve")}
                        >
                          <CheckCircle2 size={11} className={isResolved ? "text-emerald-600 dark:text-emerald-400" : "text-[var(--table-header-color)]"} />
                          {isResolved ? t("qa.resolved", "Resolved") : t("qa.open", "Open")}
                        </button>
                      </div>

                      {item.description && (
                        <p className="text-xs text-[var(--table-header-color)] mb-2 leading-relaxed whitespace-pre-wrap">
                          {item.description}
                        </p>
                      )}

                      {item.screenshotUrl && (
                        <div className="my-2">
                          <button
                            type="button"
                            onClick={() => setZoomImageUrl(item.screenshotUrl!)}
                            className="group relative block w-full overflow-hidden rounded-lg border border-[var(--border-color)] hover:border-orange-500/50 transition-all text-left bg-[var(--card-bg)]"
                          >
                            <img
                              src={item.screenshotUrl}
                              alt="Review Note Attachment"
                              className="w-full max-h-32 object-cover object-top transition-transform group-hover:scale-[1.02]"
                            />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[11px] font-semibold gap-1.5">
                              <Maximize2 size={12} />
                              <span>{t("qa.viewScreenshot", "View Screenshot")}</span>
                            </div>
                          </button>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-[10px] text-[var(--table-header-color)] pt-2 border-t border-[var(--border-color)]">
                        <span>By {item.createdBy?.name || item.createdBy?.username || "QA"}</span>
                        <div className="flex items-center gap-2">
                          <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                          {(isProjectManager || isQA) && (
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="text-[var(--table-header-color)] hover:text-rose-600 dark:hover:text-rose-400 p-0.5 cursor-pointer"
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
        </div>,
        document.body
      )}

      {/* Full-Screen Screenshot Lightbox Modal */}
      {mounted && typeof document !== "undefined" && zoomImageUrl && createPortal(
        <div
          data-qa-ignore="true"
          role="dialog"
          aria-modal="true"
          className="qa-lightbox-modal fixed inset-0 w-screen h-screen h-dvh z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-150"
          onClick={() => setZoomImageUrl(null)}
        >
          <div className="relative max-w-5xl max-h-[90vh] flex flex-col items-center">
            <button
              type="button"
              onClick={() => setZoomImageUrl(null)}
              className="absolute -top-10 right-0 p-1.5 text-white/90 hover:text-orange-400 bg-black/60 hover:bg-black/80 border border-white/20 hover:border-orange-500/50 rounded-full transition-all cursor-pointer"
              title={t("common.close", "Close")}
              aria-label={t("common.close", "Close")}
            >
              <X size={18} />
            </button>
            <img
              src={zoomImageUrl}
              alt="Expanded Screenshot"
              className="max-w-full max-h-[85vh] rounded-lg shadow-2xl border border-[var(--border-color)] object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
