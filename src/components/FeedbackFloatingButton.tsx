'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  MessageSquareWarning,
  Bug,
  Lightbulb,
  HelpCircle,
  Calculator,
  X,
  Send,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Monitor,
  FolderGit2,
  FileCode2,
  Camera,
  Upload,
  Maximize2,
} from 'lucide-react';
import { useTranslation } from '@/i18n';
import { useUser } from '@/context/UserContext';
import { useProject } from '@/context/ProjectContext';
import {
  captureScreen,
  uploadScreenshot,
  extractImageFromClipboard,
} from '@/lib/screenshot';

type FeedbackCategory = 'BUG' | 'CALCULATION' | 'FEATURE' | 'GENERAL';

export function FeedbackFloatingButton() {
  const { t, isRtl } = useTranslation();
  const userContext = useUser();
  const projectContext = useProject();

  const user = userContext?.user;
  const project = projectContext?.selectedProject;

  const [isOpen, setIsOpen] = useState(false);
  const [category, setCategory] = useState<FeedbackCategory>('BUG');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [errorDetails, setErrorDetails] = useState('');
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true);
  const [showDiagnosticsDetail, setShowDiagnosticsDetail] = useState(false);

  // Screenshot State
  const [includeScreenshot, setIncludeScreenshot] = useState(false);
  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Diagnostic state captured from browser
  const [pageUrl, setPageUrl] = useState('');
  const [systemInfo, setSystemInfo] = useState('');

  // Pre-fill email when user profile loads
  useEffect(() => {
    if (user?.email && !email) {
      setEmail(user.email);
    }
  }, [user?.email, email]);

  // Capture client environment on open
  useEffect(() => {
    if (isOpen && typeof window !== 'undefined') {
      setPageUrl(window.location.pathname + window.location.search);
      const ua = navigator.userAgent;
      const screenRes = `${window.screen.width}x${window.screen.height}`;
      const vp = `${window.innerWidth}x${window.innerHeight}`;
      const lang = navigator.language;
      setSystemInfo(`Screen: ${screenRes} | Viewport: ${vp} | Lang: ${lang} | UA: ${ua}`);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Listen for clipboard paste when feedback modal is open
  useEffect(() => {
    if (!isOpen) return;
    const handlePaste = (e: ClipboardEvent) => {
      const file = extractImageFromClipboard(e);
      if (file) {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            setScreenshotDataUrl(reader.result);
            setIncludeScreenshot(true);
          }
        };
        reader.readAsDataURL(file);
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen]);

  const handleCaptureScreen = async () => {
    setIsCapturing(true);
    setErrorMessage(null);
    try {
      const dataUrl = await captureScreen();
      if (dataUrl) {
        setScreenshotDataUrl(dataUrl);
        setIncludeScreenshot(true);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to capture screen';
      setErrorMessage(msg);
    } finally {
      setIsCapturing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please select a valid image file');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setScreenshotDataUrl(reader.result);
        setIncludeScreenshot(true);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleOpen = () => {
    setIsOpen(true);
    setErrorMessage(null);
  };

  const handleClose = () => {
    setIsOpen(false);
    if (submitted) {
      // Reset form after closing on success
      setSubmitted(false);
      setSubject('');
      setMessage('');
      setErrorDetails('');
      setScreenshotDataUrl(null);
      setIncludeScreenshot(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || message.trim().length < 3) {
      setErrorMessage(t('feedback.messageMinLength', 'Please enter at least 3 characters in the message.'));
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    const categoryLabels: Record<FeedbackCategory, string> = {
      BUG: 'Bug / Error Report',
      CALCULATION: 'Calculation Discrepancy',
      FEATURE: 'Feature Request',
      GENERAL: 'General Inquiry',
    };

    try {
      let finalScreenshot: string | undefined = undefined;
      if (includeScreenshot && screenshotDataUrl) {
        if (user) {
          try {
            finalScreenshot = await uploadScreenshot(screenshotDataUrl);
          } catch {
            finalScreenshot = screenshotDataUrl;
          }
        } else {
          finalScreenshot = screenshotDataUrl;
        }
      }

      const payload = {
        category: categoryLabels[category],
        subject: subject.trim(),
        message: message.trim(),
        email: (user?.email || email || '').trim(),
        pageUrl: includeDiagnostics ? pageUrl : undefined,
        projectId: includeDiagnostics && project?.id ? project.id : undefined,
        projectName: includeDiagnostics && project?.name ? project.name : undefined,
        errorDetails: errorDetails.trim() || undefined,
        systemInfo: includeDiagnostics ? systemInfo : undefined,
        screenshot: finalScreenshot,
      };

      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to submit feedback');
      }

      setSubmitted(true);
    } catch (err: unknown) {
      const errStr = err instanceof Error ? err.message : 'Error sending report';
      setErrorMessage(errStr);
    } finally {
      setSubmitting(false);
    }
  };

  const categories: { id: FeedbackCategory; labelKey: string; defaultLabel: string; icon: React.ReactNode; color: string }[] = [
    {
      id: 'BUG',
      labelKey: 'feedback.categoryBug',
      defaultLabel: 'Error / Bug',
      icon: <Bug size={15} />,
      color: 'text-red-400 border-red-500/40 bg-red-950/30 hover:bg-red-900/40',
    },
    {
      id: 'CALCULATION',
      labelKey: 'feedback.categoryCalc',
      defaultLabel: 'Calculation',
      icon: <Calculator size={15} />,
      color: 'text-amber-400 border-amber-500/40 bg-amber-950/30 hover:bg-amber-900/40',
    },
    {
      id: 'FEATURE',
      labelKey: 'feedback.categoryFeature',
      defaultLabel: 'Feature',
      icon: <Lightbulb size={15} />,
      color: 'text-cyan-400 border-cyan-500/40 bg-cyan-950/30 hover:bg-cyan-900/40',
    },
    {
      id: 'GENERAL',
      labelKey: 'feedback.categoryGeneral',
      defaultLabel: 'Question',
      icon: <HelpCircle size={15} />,
      color: 'text-purple-400 border-purple-500/40 bg-purple-950/30 hover:bg-purple-900/40',
    },
  ];

  return (
    <>
      {/* Floating Action Button (FAB) */}
      <aside
        data-qa-ignore="true"
        aria-label={t('feedback.title', 'Send Feedback to Admin')}
        className={`qa-feedback-trigger fixed bottom-5 ${isRtl ? 'left-5' : 'right-5'} z-40 print:hidden`}
      >
        <button
          onClick={handleOpen}
          className="group flex items-center justify-center gap-2 w-[142px] h-[40px] px-3.5 py-2 rounded-full bg-slate-900/95 hover:bg-slate-800 text-slate-200 border border-slate-700/80 shadow-lg shadow-black/40 hover:shadow-orange-500/10 hover:border-orange-500/50 transition-all duration-200 transform hover:scale-105 active:scale-95 text-xs font-semibold backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-orange-400"
          title={t('feedback.tooltip', 'Report an Error or Send Feedback to Admin')}
        >
          <MessageSquareWarning size={17} className="text-orange-400 group-hover:scale-110 transition-transform shrink-0" />
          <span className="whitespace-nowrap font-medium text-xs">{t('feedback.buttonLabel', 'Feedback')}</span>
        </button>
      </aside>

      {/* Feedback & Error Reporting Modal Dialog */}
      {isOpen && (
        <div
          data-qa-ignore="true"
          role="dialog"
          aria-modal="true"
          aria-labelledby="feedback-dialog-title"
          className="qa-feedback-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleClose();
          }}
        >
          <div className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl shadow-black/80 overflow-hidden text-slate-100 my-8">
            {/* Header */}
            <div className="flex items-start justify-between p-5 border-b border-slate-800 bg-slate-950/60">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-orange-600/20 border border-orange-500/30 text-orange-400">
                  <MessageSquareWarning size={20} />
                </div>
                <div>
                  <h2 id="feedback-dialog-title" className="text-base font-bold text-slate-100">
                    {t('feedback.title', 'Send Feedback to Admin')}
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {t('feedback.subtitle', 'Encountered an error or have a suggestion? Let our engineering team know.')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors focus:outline-none focus:ring-1 focus:ring-slate-500"
                aria-label={t('feedback.close', 'Close')}
              >
                <X size={18} />
              </button>
            </div>

            {/* Content Body */}
            {submitted ? (
              /* Success View */
              <div className="p-8 text-center space-y-4">
                <div className="mx-auto w-14 h-14 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center text-green-400 shadow-inner">
                  <CheckCircle2 size={32} className="animate-in zoom-in-50 duration-300" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-slate-100">
                    {t('feedback.successTitle', 'Message Sent Successfully!')}
                  </h3>
                  <p className="text-xs text-slate-300 max-w-sm mx-auto leading-relaxed">
                    {t('feedback.successMessage', 'Thank you for helping us improve ProCal! The engineering and administration team has received your report.')}
                  </p>
                </div>
                <div className="pt-4 flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSubmitted(false);
                      setSubject('');
                      setMessage('');
                      setErrorDetails('');
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-700 transition-colors"
                  >
                    {t('feedback.sendAnother', 'Send Another Message')}
                  </button>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-5 py-2 rounded-xl text-xs font-bold text-slate-950 bg-orange-500 hover:bg-orange-400 shadow-md shadow-orange-950/40 transition-colors"
                  >
                    {t('feedback.close', 'Close')}
                  </button>
                </div>
              </div>
            ) : (
              /* Feedback Form */
              <form onSubmit={handleSubmit} className="p-5 space-y-4">
                {errorMessage && (
                  <div role="alert" className="p-3 rounded-xl bg-red-950/50 border border-red-500/50 text-red-300 text-xs flex items-center gap-2">
                    <AlertTriangle size={15} className="shrink-0 text-red-400" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Category Pills */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    {t('feedback.categoryLabel', 'Category')}
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {categories.map((c) => {
                      const isSelected = category === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setCategory(c.id)}
                          className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-medium border transition-all ${
                            isSelected
                              ? 'border-orange-500 bg-orange-600/30 text-orange-200 ring-1 ring-orange-500/50 font-semibold'
                              : 'border-slate-700 bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:border-slate-600'
                          }`}
                        >
                          {c.icon}
                          <span className="truncate">{t(c.labelKey, c.defaultLabel)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Subject Input */}
                <div>
                  <label htmlFor="feedback-subject" className="block text-xs font-medium text-slate-300 mb-1">
                    {t('feedback.subjectLabel', 'Subject')}
                  </label>
                  <input
                    id="feedback-subject"
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder={t('feedback.subjectPlaceholder', 'Brief summary of the issue...')}
                    maxLength={150}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950/80 border border-slate-700 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-slate-100 text-xs placeholder:text-slate-500 outline-none transition-colors"
                  />
                </div>

                {/* Message Input */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="feedback-message" className="text-xs font-medium text-slate-300">
                      {t('feedback.messageLabel', 'Description & Steps to Reproduce')} <span className="text-orange-400">*</span>
                    </label>
                    <span className="text-[10px] text-slate-400">{message.length}/2000</span>
                  </div>
                  <textarea
                    id="feedback-message"
                    required
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={
                      category === 'BUG' || category === 'CALCULATION'
                        ? t('feedback.messagePlaceholder', 'Describe what calculation or UI went wrong, the input parameters, and what was expected...')
                        : t('feedback.messagePlaceholderFeature', 'Describe the feature, standard, or calculation method you would like to see in ProCal...')
                    }
                    maxLength={2000}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-slate-100 text-xs placeholder:text-slate-500 outline-none transition-colors resize-none custom-scrollbar"
                  />
                </div>

                {/* User Email & Account Binding */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="feedback-email" className="text-xs font-medium text-slate-300">
                      {t('feedback.emailLabel', 'Your Email (for updates)')}
                    </label>
                    {user?.name && (
                      <span className="text-[11px] text-slate-400">
                        {t('feedback.reportingAs', 'User')}: <span className="font-semibold text-slate-200">{user.name}</span>
                      </span>
                    )}
                  </div>
                  <input
                    id="feedback-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={user?.email || "engineer@company.com"}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950/80 border border-slate-700 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-slate-100 text-xs placeholder:text-slate-500 outline-none transition-colors"
                  />
                  {user?.email && email === user.email && (
                    <p className="text-[10px] text-green-400/90 mt-1 flex items-center gap-1">
                      <CheckCircle2 size={11} /> {t('feedback.emailFromProfile', 'Email automatically filled from your user account profile')}
                    </p>
                  )}
                </div>

                {/* Diagnostics & Screenshot Options */}
                <div className="rounded-xl bg-slate-950/60 border border-slate-800 p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-300">
                      <input
                        type="checkbox"
                        checked={includeDiagnostics}
                        onChange={(e) => setIncludeDiagnostics(e.target.checked)}
                        className="rounded border-slate-700 text-orange-500 focus:ring-orange-500 bg-slate-900 h-3.5 w-3.5"
                      />
                      <span>{t('feedback.diagnosticsToggle', 'Include System Diagnostics')}</span>
                    </label>
                    {includeDiagnostics && (
                      <button
                        type="button"
                        onClick={() => setShowDiagnosticsDetail(!showDiagnosticsDetail)}
                        className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1"
                      >
                        <span>{showDiagnosticsDetail ? t('common.hide', 'Hide') : t('common.details', 'Details')}</span>
                        {showDiagnosticsDetail ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </button>
                    )}
                  </div>

                  {includeDiagnostics && showDiagnosticsDetail && (
                    <div className="pt-2 border-t border-slate-800/80 space-y-1.5 text-[11px] text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <FileCode2 size={12} className="text-orange-400 shrink-0" />
                        <span className="font-mono text-slate-300 truncate">{pageUrl || '/'}</span>
                      </div>
                      {project && (
                        <div className="flex items-center gap-1.5">
                          <FolderGit2 size={12} className="text-cyan-400 shrink-0" />
                          <span className="text-slate-300 truncate">{project.name} ({project.id.slice(0, 8)}…)</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <Monitor size={12} className="text-purple-400 shrink-0" />
                        <span className="text-slate-400 truncate">{systemInfo}</span>
                      </div>
                    </div>
                  )}

                  {/* Include a screenshot toggle */}
                  <div className="pt-2 border-t border-slate-800/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-300 select-none">
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
                          className="rounded border-slate-700 text-orange-500 focus:ring-orange-500 bg-slate-900 h-3.5 w-3.5"
                        />
                        <span className="flex items-center gap-1.5">
                          <Camera size={13} className="text-orange-400" />
                          {t('feedback.includeScreenshot', 'Include a screenshot')}
                        </span>
                      </label>

                      {includeScreenshot && screenshotDataUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            setScreenshotDataUrl(null);
                            setIncludeScreenshot(false);
                            if (fileInputRef.current) fileInputRef.current.value = '';
                          }}
                          className="text-[11px] text-rose-400 hover:text-rose-300 transition-colors"
                        >
                          {t('feedback.removeScreenshot', 'Remove')}
                        </button>
                      )}
                    </div>

                    {includeScreenshot && (
                      <div className="pt-1">
                        {screenshotDataUrl ? (
                          <div className="relative group rounded-lg overflow-hidden border border-slate-700 bg-slate-950">
                            <img
                              src={screenshotDataUrl}
                              alt="Captured Screenshot"
                              className="w-full max-h-32 object-cover object-top"
                            />
                            <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => setZoomImageUrl(screenshotDataUrl)}
                                className="px-2 py-1 rounded bg-slate-800/90 text-white text-[11px] font-medium hover:bg-slate-700 flex items-center gap-1"
                              >
                                <Maximize2 size={11} />
                                {t('common.preview', 'Preview')}
                              </button>
                              <button
                                type="button"
                                onClick={handleCaptureScreen}
                                disabled={isCapturing}
                                className="px-2 py-1 rounded bg-orange-600/90 text-white text-[11px] font-medium hover:bg-orange-500 flex items-center gap-1"
                              >
                                <Camera size={11} />
                                {isCapturing ? t('feedback.capturing', 'Capturing...') : t('feedback.retake', 'Retake')}
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
                                className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
                              >
                                {isCapturing ? (
                                  <>
                                    <Loader2 size={12} className="animate-spin text-orange-400" />
                                    <span>{t('feedback.capturing', 'Capturing...')}</span>
                                  </>
                                ) : (
                                  <>
                                    <Camera size={12} className="text-orange-400" />
                                    <span>{t('feedback.captureScreen', 'Capture Screen')}</span>
                                  </>
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
                              >
                                <Upload size={12} className="text-cyan-400" />
                                <span>{t('feedback.uploadImage', 'Upload Image')}</span>
                              </button>
                            </div>
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept="image/*"
                              onChange={handleFileUpload}
                              className="hidden"
                            />
                            <p className="text-[10px] text-slate-500 text-center">
                              {t('feedback.pasteHint', 'Tip: You can also paste an image from clipboard (Ctrl + V)')}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Submit button bar */}
                <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={submitting}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                  >
                    {t('common.cancel', 'Cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || message.trim().length < 3}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 shadow-md shadow-orange-950/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {submitting ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>{t('feedback.submitting', 'Sending...')}</span>
                      </>
                    ) : (
                      <>
                        <Send size={14} />
                        <span>{t('feedback.submit', 'Send to Admin')}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Full-Screen Screenshot Lightbox Modal */}
      {zoomImageUrl && (
        <div
          data-qa-ignore="true"
          role="dialog"
          aria-modal="true"
          className="qa-lightbox-modal fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-150"
          onClick={() => setZoomImageUrl(null)}
        >
          <div className="relative max-w-5xl max-h-[90vh] flex flex-col items-center">
            <button
              onClick={() => setZoomImageUrl(null)}
              className="absolute -top-10 right-0 p-1.5 text-white/80 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-full transition-colors"
              title={t('common.close', 'Close')}
            >
              <X size={18} />
            </button>
            <img
              src={zoomImageUrl}
              alt="Expanded Screenshot"
              className="max-w-full max-h-[85vh] rounded-lg shadow-2xl border border-slate-700 object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </>
  );
}
