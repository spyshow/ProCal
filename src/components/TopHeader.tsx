'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useProject } from '@/context/ProjectContext';
import { useUser } from '@/context/UserContext';
import { useTranslation } from '@/i18n';
import { LanguageSelector } from '@/components/LanguageSelector';
import { ThemeSelector } from '@/components/ThemeSelector';
import {
  Building2,
  ChevronDown,
  Search,
  FolderOpen,
  HelpCircle,
  LogOut,
  Settings,
  Shield,
  Check,
  SlidersHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Project {
  id: string;
  name: string;
  clientName?: string;
}

export function TopHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { selectedProject, selectProject, currentMemberRole } = useProject();
  const { user: currentUser } = useUser();
  const { t, isRtl } = useTranslation();

  // Project Switcher Dropdown State
  const [projectOpen, setProjectOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [fetchingProjects, setFetchingProjects] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [projectSearch, setProjectSearch] = useState('');
  const projectDropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // User Profile Dropdown State
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Load projects list on demand
  const loadProjects = useCallback(async () => {
    if (projects.length > 0 || fetchingProjects) return;
    setFetchingProjects(true);
    setProjectError(null);
    try {
      const res = await fetch('/api/projects', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setProjects(Array.isArray(data) ? data : (data.projects ?? []));
    } catch (err) {
      console.error('Failed to load projects:', err);
      setProjectError('Could not load projects');
    } finally {
      setFetchingProjects(false);
    }
  }, [projects.length, fetchingProjects]);

  const handleToggleProject = () => {
    if (!projectOpen) {
      loadProjects();
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    setProjectOpen((prev) => !prev);
    setUserMenuOpen(false);
  };

  const handleSelectProject = (id: string) => {
    selectProject(id);
    setProjectOpen(false);
    setProjectSearch('');
    if (pathname.startsWith('/projects/')) {
      router.push(`/projects/${id}`);
    }
  };

  // Close dropdowns on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (projectDropdownRef.current && !projectDropdownRef.current.contains(e.target as Node)) {
        setProjectOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      localStorage.removeItem('selected_project_id');
      localStorage.removeItem('preferred_manufacturer');
      window.location.href = '/';
    }
  };

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(projectSearch.toLowerCase()) ||
    (p.clientName && p.clientName.toLowerCase().includes(projectSearch.toLowerCase()))
  );

  return (
    <header className="h-12 flex-shrink-0 bg-[var(--sidebar-bg,rgba(3,7,18,0.92))] backdrop-blur-md border-b border-[var(--sidebar-border,rgba(31,41,55,0.8))] px-3 sm:px-4 flex items-center justify-between z-30 select-none print:hidden">
      {/* LEFT / START: Active Project Switcher & Role Badge */}
      <div className="flex items-center gap-2 min-w-0" ref={projectDropdownRef}>
        <div className="relative" data-tour="project-selector">
          <button
            type="button"
            onClick={handleToggleProject}
            className={cn(
              "flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all duration-150 outline-none focus:ring-1 focus:ring-orange-500 max-w-[320px] sm:max-w-[420px]",
              "bg-[var(--card-bg-subtle,rgba(17,24,39,0.7))] hover:bg-[var(--card-bg,#0b0f19)]",
              projectOpen
                ? "border-orange-500/50 shadow-[0_0_12px_rgba(234,88,12,0.15)] ring-1 ring-orange-500/30"
                : "border-[var(--border-color,#1f2937)] hover:border-orange-500/30"
            )}
            title={selectedProject ? selectedProject.name : t('nav.selectProject', 'Select Project')}
            aria-expanded={projectOpen}
          >
            <div className="w-5 h-5 rounded flex items-center justify-center bg-orange-500/15 border border-orange-500/30 shrink-0">
              <Building2 size={12} className="text-orange-500 dark:text-orange-400" />
            </div>

            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <span className="truncate text-xs font-semibold text-[var(--foreground-color,#f8fafc)]">
                {selectedProject ? selectedProject.name : t('nav.selectProject', 'Select Project')}
              </span>
            </div>

            <ChevronDown
              size={13}
              className={cn(
                "text-[var(--table-header-color,#9ca3af)] shrink-0 transition-transform duration-150",
                projectOpen && "rotate-180"
              )}
            />
          </button>

          {/* Project Switcher Dropdown Menu */}
          {projectOpen && (
            <div
              className={cn(
                "absolute top-full mt-1.5 w-72 sm:w-80 rounded-xl border border-[var(--border-color,#1f2937)] bg-[var(--card-bg,#0b0f19)] shadow-2xl backdrop-blur-xl z-50 overflow-hidden",
                isRtl ? "right-0" : "left-0"
              )}
            >
              {/* Search Filter Header */}
              <div className="p-2 border-b border-[var(--border-color,#1f2937)] bg-[var(--card-bg-subtle,rgba(17,24,39,0.5))]">
                <div className="relative">
                  <Search size={13} className={cn("absolute top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none", isRtl ? "right-2.5" : "left-2.5")} />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={projectSearch}
                    onChange={(e) => setProjectSearch(e.target.value)}
                    placeholder={t('common.search', 'Search projects...')}
                    className={cn(
                      "w-full bg-[var(--card-bg,#0b0f19)] border border-[var(--border-color,#1f2937)] focus:border-orange-500 rounded-lg py-1.5 text-xs text-[var(--foreground-color,#f8fafc)] placeholder:text-slate-500 outline-none transition-all",
                      isRtl ? "pr-8 pl-2.5" : "pl-8 pr-2.5"
                    )}
                  />
                </div>
              </div>

              {/* Projects List */}
              <div className="p-1 max-h-56 overflow-y-auto custom-scrollbar">
                {fetchingProjects ? (
                  <div className="px-3 py-3 text-xs text-center text-[var(--table-header-color,#9ca3af)] animate-pulse">
                    {t('common.loading', 'Loading projects...')}
                  </div>
                ) : projectError ? (
                  <div className="px-3 py-3 text-xs text-center text-rose-400">
                    {projectError}
                  </div>
                ) : filteredProjects.length === 0 ? (
                  <div className="px-3 py-3 text-xs text-center text-[var(--table-header-color,#9ca3af)]">
                    {t('nav.noProjects', 'No projects found')}
                  </div>
                ) : (
                  filteredProjects.map((p) => {
                    const isSelected = selectedProject?.id === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSelectProject(p.id)}
                        className={cn(
                          "w-full text-start px-2.5 py-2 rounded-lg text-xs transition-colors duration-100 flex items-center justify-between group",
                          isSelected
                            ? "bg-orange-500/15 text-orange-500 dark:text-orange-300 font-semibold"
                            : "text-[var(--foreground-color,#f8fafc)] hover:bg-[var(--card-bg-subtle,rgba(17,24,39,0.8))] hover:text-orange-500"
                        )}
                      >
                        <div className="flex flex-col min-w-0 flex-1 pr-2">
                          <span className="truncate font-medium">{p.name}</span>
                          {p.clientName && (
                            <span className="text-[10px] text-[var(--table-header-color,#9ca3af)] truncate">
                              {p.clientName}
                            </span>
                          )}
                        </div>
                        {isSelected && (
                          <Check size={14} className="text-orange-500 shrink-0" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>

              {/* Dropdown Footer Links */}
              <div className="border-t border-[var(--border-color,#1f2937)] p-1.5 bg-[var(--card-bg-subtle,rgba(17,24,39,0.6))] flex items-center justify-between gap-1">
                {selectedProject && (
                  <Link
                    href={`/projects/${selectedProject.id}`}
                    onClick={() => setProjectOpen(false)}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium text-[var(--table-header-color,#9ca3af)] hover:text-orange-500 hover:bg-[var(--card-bg,#0b0f19)] transition-colors"
                  >
                    <SlidersHorizontal size={12} />
                    <span>{t('projects.buildings', 'Specs & Team')}</span>
                  </Link>
                )}
                <Link
                  href="/projects"
                  onClick={() => setProjectOpen(false)}
                  className={cn(
                    "flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium text-[var(--table-header-color,#9ca3af)] hover:text-orange-500 hover:bg-[var(--card-bg,#0b0f19)] transition-colors",
                    !selectedProject && "w-full justify-center"
                  )}
                >
                  <FolderOpen size={12} />
                  <span>{t('nav.allProjects', 'All Projects')}</span>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT / END: Utility Controls (Help, Language, Theme, User Avatar) */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Help & Product Tour Trigger */}
        <button
          type="button"
          data-tour="tour-help"
          onClick={() => {
            window.dispatchEvent(new CustomEvent('trigger-procal-tour'));
          }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[var(--border-color,#1f2937)] bg-[var(--card-bg-subtle,rgba(17,24,39,0.7))] hover:bg-[var(--card-bg,#0b0f19)] hover:border-orange-500/40 text-[var(--foreground-color,#f8fafc)] text-xs font-medium transition-all shadow-sm outline-none focus:ring-1 focus:ring-orange-500"
          title={t('nav.helpTour', 'Help & Product Tour')}
          aria-label={t('nav.helpTour', 'Help & Product Tour')}
        >
          <HelpCircle size={14} className="text-orange-500 dark:text-orange-400 shrink-0" />
          <span className="hidden md:inline">{t('nav.helpTour', 'Help & Tour')}</span>
        </button>

        {/* Language Selector */}
        <div data-tour="language-selector" className="shrink-0">
          <LanguageSelector variant="select" />
        </div>

        {/* Theme Selector */}
        <div data-tour="theme-toggle" className="shrink-0">
          <ThemeSelector className="w-28 sm:w-32" />
        </div>

        {/* User Profile Avatar & Dropdown */}
        <div className="relative shrink-0" ref={userMenuRef}>
          <button
            type="button"
            onClick={() => {
              setUserMenuOpen((prev) => !prev);
              setProjectOpen(false);
            }}
            className={cn(
              "flex items-center gap-2 p-1 pl-1.5 pr-2 rounded-lg border text-xs transition-all duration-150 outline-none focus:ring-1 focus:ring-orange-500",
              "bg-[var(--card-bg-subtle,rgba(17,24,39,0.7))] hover:bg-[var(--card-bg,#0b0f19)]",
              userMenuOpen
                ? "border-orange-500/50 shadow-[0_0_10px_rgba(234,88,12,0.15)] ring-1 ring-orange-500/30"
                : "border-[var(--border-color,#1f2937)] hover:border-orange-500/40"
            )}
            title={currentUser?.name ?? "User"}
            aria-expanded={userMenuOpen}
          >
            {/* User Initials Avatar */}
            <div className="w-6 h-6 rounded-md bg-orange-500/20 border border-orange-500/35 flex items-center justify-center shrink-0">
              <span className="text-[11px] font-bold text-orange-500 dark:text-orange-400">
                {currentUser?.name?.[0]?.toUpperCase() ?? "U"}
              </span>
            </div>

            <span className="text-xs font-medium text-[var(--foreground-color,#f8fafc)] max-w-[90px] truncate hidden sm:inline-block">
              {currentUser?.name?.split(' ')[0] ?? "User"}
            </span>

            {selectedProject && (
              <span
                className={cn(
                  "text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0 hidden md:inline-block",
                  currentMemberRole === "PROJECT_MANAGER"
                    ? "bg-orange-500/10 text-orange-500 dark:text-orange-400 border-orange-500/30"
                    : currentMemberRole === "QA"
                    ? "bg-blue-500/10 text-blue-500 dark:text-blue-400 border-blue-500/30"
                    : "bg-[var(--card-bg-subtle,rgba(17,24,39,0.8))] text-[var(--table-header-color,#9ca3af)] border-[var(--border-color,#1f2937)]"
                )}
              >
                {currentMemberRole === "PROJECT_MANAGER"
                  ? t('team.roles.pm', 'PM')
                  : currentMemberRole === "QA"
                  ? t('team.roles.qa', 'QA')
                  : t('team.roles.engineer', 'Eng')}
              </span>
            )}

            <ChevronDown
              size={12}
              className={cn(
                "text-[var(--table-header-color,#9ca3af)] shrink-0 transition-transform duration-150",
                userMenuOpen && "rotate-180"
              )}
            />
          </button>

          {/* User Profile Dropdown Menu */}
          {userMenuOpen && (
            <div
              className={cn(
                "absolute top-full mt-1.5 w-56 rounded-xl border border-[var(--border-color,#1f2937)] bg-[var(--card-bg,#0b0f19)] shadow-2xl backdrop-blur-xl z-50 overflow-hidden py-1",
                isRtl ? "left-0" : "right-0"
              )}
            >
              {/* User identity summary */}
              <div className="px-3 py-2.5 border-b border-[var(--border-color,#1f2937)] bg-[var(--card-bg-subtle,rgba(17,24,39,0.5))] flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[var(--foreground-color,#f8fafc)] truncate">
                    {currentUser?.name ?? "Engineer"}
                  </p>
                  <p className="text-[10px] text-[var(--table-header-color,#9ca3af)] truncate">
                    {currentUser?.role === "ADMIN" ? "Administrator" : "ProCal Member"}
                  </p>
                </div>
                {selectedProject && (
                  <span
                    className={cn(
                      "text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0",
                      currentMemberRole === "PROJECT_MANAGER"
                        ? "bg-orange-500/15 text-orange-500 dark:text-orange-400 border-orange-500/30"
                        : currentMemberRole === "QA"
                        ? "bg-blue-500/15 text-blue-500 dark:text-blue-400 border-blue-500/30"
                        : "bg-[var(--card-bg-subtle,rgba(17,24,39,0.8))] text-[var(--table-header-color,#9ca3af)] border-[var(--border-color,#1f2937)]"
                    )}
                  >
                    {currentMemberRole === "PROJECT_MANAGER"
                      ? "PM"
                      : currentMemberRole === "QA"
                      ? "QA"
                      : "Eng"}
                  </span>
                )}
              </div>

              {/* Navigation Items */}
              <div className="p-1 space-y-0.5">
                <Link
                  href="/settings?tab=account"
                  onClick={() => setUserMenuOpen(false)}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-[var(--foreground-color,#f8fafc)] hover:bg-[var(--card-bg-subtle,rgba(17,24,39,0.8))] hover:text-orange-500 transition-colors"
                >
                  <Settings size={14} className="text-[var(--table-header-color,#9ca3af)]" />
                  <span>{t('settings.account', 'Account & Security')}</span>
                </Link>

                {currentUser?.role === "ADMIN" && (
                  <Link
                    href="/admin"
                    onClick={() => setUserMenuOpen(false)}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-orange-500 dark:text-orange-300 hover:bg-orange-500/10 transition-colors font-medium"
                  >
                    <Shield size={14} className="text-orange-500" />
                    <span>{t('nav.adminDashboard', 'Admin Dashboard')}</span>
                  </Link>
                )}
              </div>

              {/* Sign Out */}
              <div className="border-t border-[var(--border-color,#1f2937)] p-1">
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors disabled:opacity-50"
                >
                  {loggingOut ? (
                    <div className="w-3.5 h-3.5 border-2 border-rose-500 border-t-transparent rounded-full animate-spin shrink-0" />
                  ) : (
                    <LogOut size={14} className={cn("shrink-0", isRtl && "scale-x-[-1]")} />
                  )}
                  <span>{t('nav.signOut', 'Sign Out')}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default TopHeader;
