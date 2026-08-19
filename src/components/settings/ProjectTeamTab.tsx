"use client";

import React, { useState, useEffect } from "react";
import {
  Users,
  UserPlus,
  User,
  Search,
  Mail,
  Shield,
  Trash2,
  RefreshCw,
  X,
  Check,
  AlertCircle,
  Clock,
  Send,
  Edit2,
  Lock,
} from "lucide-react";
import { useProject } from "@/context/ProjectContext";
import { useTranslation } from "@/i18n";
import {
  PROJECT_PAGE_KEYS,
  PAGE_LABELS,
  DEFAULT_ROLE_PERMISSIONS,
  type ProjectRole,
  type ProjectPageKey,
  type PermissionAction,
} from "@/lib/project-permissions";
import type { ProjectMember, ProjectInvite } from "@/types";

export function ProjectTeamTab() {
  const { selectedProjectId, selectedProject, isProjectManager } = useProject();
  const { t } = useTranslation();

  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [invites, setInvites] = useState<ProjectInvite[]>([]);
  const [totalSeats, setTotalSeats] = useState(5);
  const [usedSeats, setUsedSeats] = useState(1);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Invite Modal State
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteUsername, setInviteUsername] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<ProjectRole>("ENGINEER");
  const [invitePerms, setInvitePerms] = useState<Record<ProjectPageKey, PermissionAction>>(
    DEFAULT_ROLE_PERMISSIONS.ENGINEER
  );
  const [sendingInvite, setSendingInvite] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupMatch, setLookupMatch] = useState<{ name?: string; email?: string } | null>(null);

  const handleUsernameLookup = async (uname: string) => {
    const clean = uname.trim();
    if (!clean || clean.length < 2) {
      setLookupMatch(null);
      return;
    }
    setLookupLoading(true);
    try {
      const res = await fetch(`/api/users/lookup?username=${encodeURIComponent(clean)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.found && data.user) {
          setLookupMatch({ name: data.user.name, email: data.user.email });
          if (data.user.name) setInviteName(data.user.name);
          if (data.user.email) setInviteEmail(data.user.email);
        } else {
          setLookupMatch(null);
        }
      } else {
        setLookupMatch(null);
      }
    } catch {
      setLookupMatch(null);
    } finally {
      setLookupLoading(false);
    }
  };

  // Edit Permissions Modal State
  const [editingMember, setEditingMember] = useState<ProjectMember | null>(null);
  const [editRole, setEditRole] = useState<ProjectRole>("ENGINEER");
  const [editPerms, setEditPerms] = useState<Record<ProjectPageKey, PermissionAction>>(
    DEFAULT_ROLE_PERMISSIONS.ENGINEER
  );
  const [savingEdit, setSavingEdit] = useState(false);

  const loadTeam = async () => {
    if (!selectedProjectId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${selectedProjectId}/members`);
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members || []);
        setInvites(data.invites || []);
        setTotalSeats(data.totalSeats || 5);
        setUsedSeats(data.usedSeats || 1);
      }
    } catch (err) {
      console.error("Error loading project team:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeam();
  }, [selectedProjectId]);

  const handleRoleChange = (role: ProjectRole, isEditing = false) => {
    if (isEditing) {
      setEditRole(role);
      setEditPerms(DEFAULT_ROLE_PERMISSIONS[role]);
    } else {
      setInviteRole(role);
      setInvitePerms(DEFAULT_ROLE_PERMISSIONS[role]);
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !inviteEmail.trim() || !inviteName.trim()) return;

    setSendingInvite(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/projects/${selectedProjectId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: inviteUsername.trim() || undefined,
          name: inviteName.trim(),
          email: inviteEmail.trim(),
          role: inviteRole,
          permissions: inviteRole === "ENGINEER" ? invitePerms : undefined,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({
          type: "success",
          text: data.emailDelivered
            ? `Invitation sent successfully to ${inviteEmail}`
            : `Invitation created. (Link: ${data.invite?.acceptUrl})`,
        });
        setInviteModalOpen(false);
        setInviteUsername("");
        setInviteName("");
        setInviteEmail("");
        setLookupMatch(null);
        setInviteRole("ENGINEER");
        setInvitePerms(DEFAULT_ROLE_PERMISSIONS.ENGINEER);
        await loadTeam();
      } else {
        setMessage({ type: "error", text: data.error || "Failed to send invitation" });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to send invitation" });
    } finally {
      setSendingInvite(false);
    }
  };

  const handleSaveMemberEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !editingMember) return;

    setSavingEdit(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/projects/${selectedProjectId}/members/${editingMember.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: editRole,
          permissions: editRole === "ENGINEER" ? editPerms : undefined,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: "Member permissions updated successfully" });
        setEditingMember(null);
        await loadTeam();
      } else {
        setMessage({ type: "error", text: data.error || "Failed to update member" });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to update member" });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!selectedProjectId) return;
    if (!confirm(`Are you sure you want to remove ${memberName} from this project?`)) return;

    try {
      const res = await fetch(`/api/projects/${selectedProjectId}/members/${memberId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setMessage({ type: "success", text: `${memberName} removed from project` });
        await loadTeam();
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Failed to remove member" });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to remove member" });
    }
  };

  const handleResendInvite = async (inviteId: string) => {
    if (!selectedProjectId) return;
    try {
      const res = await fetch(`/api/projects/${selectedProjectId}/invites/${inviteId}`, {
        method: "POST",
      });
      if (res.ok) {
        setMessage({ type: "success", text: "Invitation resent successfully" });
        await loadTeam();
      }
    } catch {
      setMessage({ type: "error", text: "Failed to resend invitation" });
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    if (!selectedProjectId) return;
    if (!confirm("Are you sure you want to revoke this invitation?")) return;

    try {
      const res = await fetch(`/api/projects/${selectedProjectId}/invites/${inviteId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setMessage({ type: "success", text: "Invitation revoked" });
        await loadTeam();
      }
    } catch {
      setMessage({ type: "error", text: "Failed to revoke invitation" });
    }
  };

  if (!selectedProjectId) {
    return (
      <div className="p-8 text-center text-sm text-slate-500 rounded-xl border border-slate-800 bg-slate-900/30">
        {t('team.selectProjectPrompt', 'Please select an active project to manage its team.')}
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      {/* Header & Seat Pill */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-slate-800 bg-slate-900/40">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Users size={18} className="text-orange-500" />
            {selectedProject?.name ? `${selectedProject.name} — ` : ""}{t('team.title', 'Team & Access Control')}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {t('team.subtitle', 'Manage project members, roles, and granular page permissions.')}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-xs">
            <span className="text-slate-400">{t('team.seats', 'Seats')}:</span>
            <span className="font-bold text-orange-400">
              {usedSeats} / {totalSeats}
            </span>
          </div>

          {isProjectManager && (
            <button
              onClick={() => setInviteModalOpen(true)}
              disabled={usedSeats >= totalSeats}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold shadow-lg shadow-orange-600/20 disabled:opacity-50 transition-all"
            >
              <UserPlus size={14} />
              {t('team.inviteMember', 'Invite Member')}
            </button>
          )}
        </div>
      </div>

      {/* Status Message */}
      {message && (
        <div
          className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
            message.type === "success"
              ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"
              : "bg-rose-500/10 border border-rose-500/20 text-rose-300"
          }`}
        >
          <AlertCircle size={14} />
          <span>{message.text}</span>
        </div>
      )}

      {/* Active Members Card */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            {t('team.activeMembers', 'Active Members')} ({members.length})
          </h3>
          <button onClick={loadTeam} className="text-slate-400 hover:text-white p-1" title={t('common.refresh', 'Refresh')}>
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        <div className="divide-y divide-slate-800/60">
          {members.map((m) => {
            const roleBadgeClass =
              m.role === "PROJECT_MANAGER"
                ? "bg-orange-500/15 text-orange-300 border-orange-500/30"
                : m.role === "QA"
                ? "bg-blue-500/15 text-blue-300 border-blue-500/30"
                : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";

            return (
              <div key={m.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-900/60 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-sm font-bold text-orange-400 shrink-0">
                    {m.name?.[0]?.toUpperCase() || m.username?.[0]?.toUpperCase() || "U"}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">{m.name || m.username}</span>
                      <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${roleBadgeClass}`}>
                        {m.role === "PROJECT_MANAGER" ? t('team.roles.pm', 'Project Manager') : m.role === "QA" ? t('team.roles.qa', 'QA Reviewer') : t('team.roles.engineer', 'Engineer')}
                      </span>
                      {m.isOwner && (
                        <span className="text-[9px] font-bold text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                          Creator
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{m.email || `@${m.username}`}</p>
                  </div>
                </div>

                {isProjectManager && (
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      onClick={() => {
                        setEditingMember(m);
                        setEditRole(m.role as ProjectRole);
                        setEditPerms(
                          (m.permissions as Record<ProjectPageKey, PermissionAction>) ||
                            DEFAULT_ROLE_PERMISSIONS[m.role as ProjectRole]
                        );
                      }}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
                    >
                      <Edit2 size={12} />
                      {t('team.permissions', 'Permissions')}
                    </button>

                    {!m.isOwner && (
                      <button
                        onClick={() => handleRemoveMember(m.id, m.name || m.username || "Member")}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title={t('team.removeMember', 'Remove Member')}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Pending Invites Card */}
      {invites.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Clock size={14} className="text-amber-400" />
              {t('team.pendingInvites', 'Pending Invitations')} ({invites.length})
            </h3>
          </div>

          <div className="divide-y divide-slate-800/60">
            {invites.map((inv) => (
              <div key={inv.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">{inv.name}</span>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                      {inv.role === "PROJECT_MANAGER" ? t('team.roles.pm', 'PM') : inv.role === "QA" ? t('team.roles.qa', 'QA') : t('team.roles.engineer', 'Engineer')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {inv.email} • {t('team.invitedBy', 'Invited by')} {inv.invitedBy || "PM"}
                  </p>
                </div>

                {isProjectManager && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleResendInvite(inv.id)}
                      className="text-xs text-orange-400 hover:text-orange-300 font-medium px-2.5 py-1 rounded bg-orange-500/10 border border-orange-500/20"
                    >
                      {t('team.resendInvite', 'Resend')}
                    </button>
                    <button
                      onClick={() => handleRevokeInvite(inv.id)}
                      className="text-xs text-slate-400 hover:text-rose-400 p-1"
                    >
                      {t('team.revokeInvite', 'Revoke')}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite Member Modal */}
      {inviteModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <UserPlus size={18} className="text-orange-500" />
                {t('team.inviteModalTitle', 'Invite Team Member')}
              </h3>
              <button
                onClick={() => setInviteModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSendInvite} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-300">
                    {t('team.username', 'Username')} <span className="text-slate-500 font-normal">({t('common.optional', 'optional')})</span>
                  </label>
                  {lookupLoading && (
                    <span className="text-[10px] text-orange-400 animate-pulse flex items-center gap-1">
                      <RefreshCw size={10} className="animate-spin" />
                      {t('common.searching', 'Searching...')}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={inviteUsername}
                    onChange={(e) => {
                      setInviteUsername(e.target.value);
                      setLookupMatch(null);
                    }}
                    onBlur={() => {
                      if (inviteUsername.trim()) {
                        handleUsernameLookup(inviteUsername);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (inviteUsername.trim()) {
                          handleUsernameLookup(inviteUsername);
                        }
                      }
                    }}
                    placeholder={t('team.usernamePlaceholder', 'e.g., engineer_ahmad')}
                    className="dense-input w-full rounded-xl text-xs pl-8"
                  />
                  <User className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                {lookupMatch && (
                  <div className="mt-1.5 p-2 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-[11px] text-emerald-300 flex items-center justify-between">
                    <span>✓ {t('team.userFound', 'Account found')}: <strong>{lookupMatch.name || inviteUsername}</strong> ({lookupMatch.email})</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">{t('team.fullName', 'Full Name')}</label>
                <input
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder={t('team.fullNamePlaceholder', 'e.g., Samer Al-Khatib')}
                  className="dense-input w-full rounded-xl text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">{t('team.emailAddress', 'Email Address')}</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder={t('team.emailPlaceholder', 'samer@company.com')}
                  className="dense-input w-full rounded-xl text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">{t('team.selectRole', 'Project Role')}</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["PROJECT_MANAGER", "ENGINEER", "QA"] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => handleRoleChange(r, false)}
                      className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all ${
                        inviteRole === r
                          ? "bg-orange-500/20 border-orange-500 text-orange-300 shadow-[0_0_12px_rgba(234,88,12,0.2)]"
                          : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      {r === "PROJECT_MANAGER" ? t('team.roles.pm', 'PM') : r === "QA" ? t('team.roles.qa', 'QA') : t('team.roles.engineer', 'Engineer')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Granular Permissions Matrix for Engineer */}
              {inviteRole === "ENGINEER" && (
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      {t('team.customPermissions', 'Module Access Matrix')}
                    </label>
                  </div>

                  <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar p-1">
                    {PROJECT_PAGE_KEYS.map((key) => {
                      const perm = invitePerms[key] || "EDIT";
                      return (
                        <div
                          key={key}
                          className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800/80 text-xs"
                        >
                          <span className="text-slate-300 font-medium">{t(PAGE_LABELS[key].labelKey, PAGE_LABELS[key].defaultLabel)}</span>
                          <div className="flex items-center gap-1">
                            {(["EDIT", "VIEW", "NONE"] as const).map((action) => (
                              <button
                                key={action}
                                type="button"
                                onClick={() =>
                                  setInvitePerms({
                                    ...invitePerms,
                                    [key]: action,
                                  })
                                }
                                className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                                  perm === action
                                    ? action === "EDIT"
                                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                                      : action === "VIEW"
                                      ? "bg-blue-500/20 text-blue-300 border-blue-500/40"
                                      : "bg-rose-500/20 text-rose-300 border-rose-500/40"
                                    : "bg-slate-800/60 text-slate-500 border-transparent hover:text-slate-300"
                                }`}
                              >
                                {action === "EDIT" ? t('team.permEdit', 'EDIT') : action === "VIEW" ? t('team.permView', 'VIEW') : t('team.permNone', 'NONE')}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setInviteModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={sendingInvite}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold disabled:opacity-50"
                >
                  <Send size={13} />
                  {sendingInvite ? t('team.sending', 'Sending...') : t('team.sendInvite', 'Send Invitation')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Permissions Modal */}
      {editingMember && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Shield size={18} className="text-orange-500" />
                {t('team.editModalTitle', 'Edit Permissions')}: {editingMember.name || editingMember.username}
              </h3>
              <button
                onClick={() => setEditingMember(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveMemberEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">{t('team.role', 'Role')}</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["PROJECT_MANAGER", "ENGINEER", "QA"] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => handleRoleChange(r, true)}
                      className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all ${
                        editRole === r
                          ? "bg-orange-500/20 border-orange-500 text-orange-300 shadow-[0_0_12px_rgba(234,88,12,0.2)]"
                          : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      {r === "PROJECT_MANAGER" ? t('team.roles.pm', 'PM') : r === "QA" ? t('team.roles.qa', 'QA') : t('team.roles.engineer', 'Engineer')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Granular Permissions Matrix */}
              {editRole === "ENGINEER" && (
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                    {t('team.customPermissions', 'Module Access Matrix')}
                  </label>

                  <div className="space-y-1.5 max-h-56 overflow-y-auto custom-scrollbar p-1">
                    {PROJECT_PAGE_KEYS.map((key) => {
                      const perm = editPerms[key] || "EDIT";
                      return (
                        <div
                          key={key}
                          className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800/80 text-xs"
                        >
                          <span className="text-slate-300 font-medium">{t(PAGE_LABELS[key].labelKey, PAGE_LABELS[key].defaultLabel)}</span>
                          <div className="flex items-center gap-1">
                            {(["EDIT", "VIEW", "NONE"] as const).map((action) => (
                              <button
                                key={action}
                                type="button"
                                onClick={() =>
                                  setEditPerms({
                                    ...editPerms,
                                    [key]: action,
                                  })
                                }
                                className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                                  perm === action
                                    ? action === "EDIT"
                                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                                      : action === "VIEW"
                                      ? "bg-blue-500/20 text-blue-300 border-blue-500/40"
                                      : "bg-rose-500/20 text-rose-300 border-rose-500/40"
                                    : "bg-slate-800/60 text-slate-500 border-transparent hover:text-slate-300"
                                }`}
                              >
                                {action === "EDIT" ? t('team.permEdit', 'EDIT') : action === "VIEW" ? t('team.permView', 'VIEW') : t('team.permNone', 'NONE')}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold disabled:opacity-50"
                >
                  {savingEdit ? t('team.saving', 'Saving...') : t('team.saveChanges', 'Save Changes')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
