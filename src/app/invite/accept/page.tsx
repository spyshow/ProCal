"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Shield,
  Building2,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  User,
  Mail,
  Zap,
} from "lucide-react";

import { useTranslation } from "@/i18n";

function InviteAcceptContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(true);
  const [inviteData, setInviteData] = useState<{
    id: string;
    email: string;
    name: string;
    role: string;
    projectId: string;
    projectName: string;
    invitedBy: string;
    isExistingUser: boolean;
    isLoggedIn: boolean;
    isLoggedInAsInvitee: boolean;
  } | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setError(t("invite.invalidTokenDesc", "No invitation token was provided in the link."));
      setVerifying(false);
      setLoading(false);
      return;
    }

    const verifyToken = async () => {
      try {
        const res = await fetch(`/api/invites/verify?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (res.ok && data.valid) {
          setInviteData(data.invite);
          setName(data.invite.name || "");
          setUsername(data.invite.username || data.invite.email?.split("@")[0] || "");
        } else {
          setError(data.error || t("invite.invalidTokenDesc", "Invalid or expired invitation link."));
        }
      } catch {
        setError(t("invite.invalidTokenDesc", "Failed to verify invitation. Please check your network connection."));
      } finally {
        setVerifying(false);
        setLoading(false);
      }
    };

    verifyToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (!inviteData?.isExistingUser) {
      if (!password || password.length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          name: name.trim(),
          username: username.trim(),
          password,
          confirmPassword,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (data.projectId) {
          localStorage.setItem("selected_project_id", data.projectId);
        }
        window.location.href = "/dashboard";
      } else {
        setError(data.error || "Failed to accept invitation.");
        setSubmitting(false);
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setSubmitting(false);
    }
  };

  if (loading || verifying) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400 font-medium">{t("common.loading", "Verifying invitation...")}</p>
        </div>
      </div>
    );
  }

  if (error && !inviteData) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md p-8 rounded-2xl border border-slate-800 bg-slate-900/90 shadow-2xl text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 mx-auto flex items-center justify-center">
            <AlertCircle size={28} />
          </div>
          <h2 className="text-xl font-bold text-white">{t("invite.invalidToken", "Invitation Issue")}</h2>
          <p className="text-sm text-slate-400 leading-relaxed">{error}</p>
          <div className="pt-4">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold shadow-lg transition-all"
            >
              {t("invite.backToLogin", "Go to Login")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const roleLabel =
    inviteData?.role === "PROJECT_MANAGER"
      ? t("team.roles.pm", "Project Manager")
      : inviteData?.role === "QA"
      ? t("team.roles.qa", "QA Reviewer")
      : t("team.roles.engineer", "Engineer");

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900/90 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header Branding */}
        <div className="p-6 border-b border-slate-800/80 bg-slate-950/60 text-center relative">
          <div className="w-12 h-12 rounded-xl bg-orange-600/20 border border-orange-500/30 flex items-center justify-center mx-auto mb-3 shadow-[0_0_15px_rgba(234,88,12,0.2)]">
            <Zap size={24} className="text-orange-500" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">{t("invite.acceptTitle", "Project Invitation")}</h1>
          <p className="text-xs text-slate-400 mt-1">
            {t("invite.acceptSubtitle", "You have been invited to collaborate on")} <strong>{inviteData?.projectName}</strong>
          </p>
        </div>

        {/* Invitation Context Card */}
        <div className="p-6 space-y-5">
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-medium">{t("team.roles.pm", "Invited by")}:</span>
              <span className="font-semibold text-slate-200">{inviteData?.invitedBy}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-medium">{t("invite.invitedTo", "Target Project")}:</span>
              <span className="font-semibold text-orange-400">{inviteData?.projectName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-medium">{t("invite.assignedRole", "Assigned Role")}:</span>
              <span className="font-bold uppercase tracking-wider text-[10px] px-2 py-0.5 rounded bg-orange-500/20 text-orange-300 border border-orange-500/30">
                {roleLabel}
              </span>
            </div>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field (Disabled) */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">{t("invite.yourEmail", "Email Address")}</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  value={inviteData?.email || ""}
                  disabled
                  className="dense-input w-full pl-9 rounded-xl text-xs bg-slate-950 border-slate-800 text-slate-400 cursor-not-allowed"
                />
              </div>
            </div>

            {/* If New User: Prompt for Full Name & Set Password */}
            {!inviteData?.isExistingUser && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">{t("invite.yourName", "Full Name")}</label>
                  <div className="relative">
                    <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t("team.fullNamePlaceholder", "Your Full Name")}
                      className="dense-input w-full pl-9 rounded-xl text-xs"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">{t("team.username", "Username")}</label>
                  <div className="relative">
                    <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="e.g., samer99"
                      className="dense-input w-full pl-9 rounded-xl text-xs"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">{t("invite.password", "Create Password")}</label>
                  <div className="relative">
                    <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      className="dense-input w-full pl-9 pr-9 rounded-xl text-xs"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">{t("invite.confirmPassword", "Confirm Password")}</label>
                  <div className="relative">
                    <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter your password"
                      className="dense-input w-full pl-9 pr-9 rounded-xl text-xs"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      {showConfirmPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* If Existing User but not logged in: Prompt for Account Password */}
            {inviteData?.isExistingUser && !inviteData?.isLoggedInAsInvitee && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {t("invite.password", "Enter Your Password to Verify & Join")}
                </label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your existing account password"
                    className="dense-input w-full pl-9 pr-9 rounded-xl text-xs"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  {t("invite.alreadyHaveAccount", "An account with this email already exists on ProCal.")}
                </p>
              </div>
            )}

            {/* If Already Logged In as that email: Simple Confirm button */}
            {inviteData?.isLoggedInAsInvitee && (
              <p className="text-xs text-emerald-400 bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20">
                You are currently signed in as <strong>{inviteData.email}</strong>. Click below to accept the invitation and enter the workspace.
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-orange-600 hover:bg-orange-500 active:scale-[0.99] text-white text-xs font-bold shadow-lg shadow-orange-600/30 disabled:opacity-50 transition-all cursor-pointer"
            >
              <span>{submitting ? t("invite.joining", "Joining Workspace...") : t("invite.joinProject", "Accept Invitation & Enter Project")}</span>
              <ArrowRight size={14} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function InviteAcceptPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
          <div className="w-10 h-10 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <InviteAcceptContent />
    </Suspense>
  );
}
