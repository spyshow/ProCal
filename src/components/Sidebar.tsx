import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useProject } from "@/context/ProjectContext";
import { useUser } from "@/context/UserContext";
import { useSidebar } from "@/context/SidebarContext";
import { useTranslation } from "@/i18n";
import { LanguageSelector } from "@/components/LanguageSelector";
import {
  LayoutDashboard,
  FolderOpen,
  Zap,
  Cable,
  CircuitBoard,
  Cpu,
  GitBranch,
  Shield,
  FileText,
  Settings,
  LogOut,
  ChevronDown,
  Building2,
  PanelLeftClose,
  PanelLeftOpen,
  HelpCircle,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Project {
  id: string;
  name: string;
  clientName?: string;
}

interface NavItem {
  id: string;
  labelKey: string;
  href: string;
  icon: React.ElementType;
  stepNumber?: number;
}

const NAV_ITEMS: NavItem[] = [
  { id: "dashboard",       labelKey: "nav.dashboard",       href: "/dashboard",        icon: LayoutDashboard },
  { id: "projects",        labelKey: "nav.projects",        href: "/projects",         icon: FolderOpen      },
  { id: "calculator",      labelKey: "nav.calculator",      href: "/calculator",       icon: Zap,             stepNumber: 1 },
  { id: "breakerSchedule", labelKey: "nav.breakerSchedule", href: "/breaker-schedule", icon: CircuitBoard,   stepNumber: 2 },
  { id: "coordination",    labelKey: "nav.coordination",    href: "/coordination",     icon: Shield,          stepNumber: 3 },
  { id: "cableSchedule",   labelKey: "nav.cableSchedule",   href: "/cable-schedule",   icon: Cable,           stepNumber: 4 },
  { id: "panelDesigner",   labelKey: "nav.panelDesigner",   href: "/panel",            icon: Cpu,             stepNumber: 5 },
  { id: "riserDiagram",    labelKey: "nav.riserDiagram",    href: "/riser",            icon: GitBranch,       stepNumber: 6 },
  { id: "sldDesigner",     labelKey: "nav.sldDesigner",     href: "/sld",              icon: GitBranch,       stepNumber: 7 },
  { id: "reports",         labelKey: "nav.reports",         href: "/reports",          icon: FileText,        stepNumber: 8 },
  { id: "settings",        labelKey: "nav.settings",        href: "/settings",         icon: Settings        },
];

function LogoMark() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="flex-shrink-0"
    >
      <path
        d="M13 2L4.5 13.5H11L10 22L19.5 10H13L13 2Z"
        fill="#ea580c"
        stroke="#ea580c"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ProjectSelector({ isCollapsed }: { isCollapsed?: boolean }) {
  const { selectedProject, selectProject } = useProject();
  const { toggleSidebar } = useSidebar();
  const { t, isRtl } = useTranslation();
  const [open, setOpen]         = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [fetching, setFetching] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const dropdownRef             = useRef<HTMLDivElement>(null);

  const loadProjects = useCallback(async () => {
    if (projects.length > 0 || fetching) return;
    setFetching(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setProjects(Array.isArray(data) ? data : (data.projects ?? []));
    } catch (err) {
      console.error("Failed to load projects:", err);
      setError("Could not load projects");
    } finally {
      setFetching(false);
    }
  }, [projects.length, fetching]);

  const handleToggle = () => {
    if (isCollapsed) {
      toggleSidebar();
      return;
    }
    if (!open) loadProjects();
    setOpen((prev) => !prev);
  };

  const handleSelect = (id: string) => {
    selectProject(id);
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative px-2 mb-3" ref={dropdownRef}>
      <button
        onClick={handleToggle}
        className={cn(
          "w-full flex items-center rounded-lg border bg-slate-900/90 text-start text-xs transition-all duration-150 outline-none focus:ring-1 focus:ring-orange-500",
          open
            ? "border-orange-500/50 shadow-[0_0_12px_rgba(234,88,12,0.15)]"
            : "border-slate-800 hover:border-slate-700 hover:bg-slate-900",
          isCollapsed ? "justify-center p-2" : "gap-2 px-2.5 py-2"
        )}
        title={isCollapsed ? (selectedProject ? selectedProject.name : t('nav.selectProject')) : undefined}
      >
        <Building2
          size={14}
          className={cn(
            "flex-shrink-0",
            selectedProject ? "text-orange-400" : "text-slate-500"
          )}
        />
        {!isCollapsed && (
          <>
            <span className="flex-1 truncate font-medium text-slate-200">
              {selectedProject ? selectedProject.name : t('nav.selectProject')}
            </span>
            <ChevronDown
              size={12}
              className={cn(
                "text-slate-400 flex-shrink-0 transition-transform duration-150",
                open && "rotate-180"
              )}
            />
          </>
        )}
      </button>

      {open && !isCollapsed && (
        <div className={cn(
          "absolute top-full mt-1 w-[calc(100%-16px)] z-50 rounded-lg border border-slate-700/80 bg-slate-900/95 shadow-xl backdrop-blur-md overflow-hidden",
          isRtl ? "right-2" : "left-2"
        )}>
          <div className="p-1 max-h-48 overflow-y-auto custom-scrollbar">
            {fetching ? (
              <div className="px-3 py-2 text-xs text-slate-400 animate-pulse">
                {t('common.loading')}
              </div>
            ) : error ? (
              <div className="px-3 py-2 text-xs text-rose-400">
                {error}
              </div>
            ) : projects.length === 0 ? (
              <div className="px-3 py-2 text-xs text-slate-500">
                {t('nav.noProjects')}
              </div>
            ) : (
              projects.map((p) => {
                const isSelected = selectedProject?.id === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => handleSelect(p.id)}
                    className={cn(
                      "w-full text-start px-2.5 py-1.5 rounded-md text-xs transition-colors duration-100 flex items-center justify-between",
                      isSelected
                        ? "bg-orange-500/15 text-orange-300 font-semibold"
                        : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
                    )}
                  >
                    <span className="truncate">{p.name}</span>
                    {isSelected && (
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
          <div className="border-t border-slate-800 p-1 bg-slate-950/40">
            <Link
              href="/projects"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-400 hover:text-orange-400 transition-colors duration-150"
            >
              <FolderOpen size={12} />
              <span>{t('nav.allProjects')}</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function MarqueeText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    const checkOverflow = () => {
      if (containerRef.current && textRef.current) {
        setIsOverflowing(textRef.current.scrollWidth > containerRef.current.clientWidth + 4);
      }
    };
    checkOverflow();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(checkOverflow) : null;
    if (ro && containerRef.current) ro.observe(containerRef.current);
    window.addEventListener('resize', checkOverflow);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', checkOverflow);
    };
  }, [text]);

  if (!isOverflowing) {
    return (
      <div ref={containerRef} className={cn("overflow-hidden whitespace-nowrap min-w-0 flex-1", className)}>
        <span ref={textRef} className="truncate block">
          {text}
        </span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "overflow-hidden whitespace-nowrap min-w-0 flex-1 relative group/marquee",
        className
      )}
    >
      <div className="inline-flex whitespace-nowrap animate-sidebar-marquee group-hover/marquee:[animation-play-state:paused] will-change-transform">
        <span ref={textRef} className="pr-5">
          {text}
        </span>
        <span className="pr-5 text-orange-400/60 font-mono select-none">•</span>
        <span className="pr-5" aria-hidden="true">
          {text}
        </span>
        <span className="pr-5 text-orange-400/60 font-mono select-none" aria-hidden="true">•</span>
      </div>
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const { user: currentUser } = useUser();
  const { isCollapsed, toggleSidebar } = useSidebar();
  const { selectedProject, currentMemberRole, canView } = useProject();
  const { t, isRtl } = useTranslation();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      localStorage.removeItem("selected_project_id");
      localStorage.removeItem("preferred_manufacturer");
      window.location.href = "/";
    }
  };

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <aside
      style={{ width: isCollapsed ? "64px" : "240px" }}
      className={cn(
        "fixed top-0 h-screen flex flex-col bg-slate-950/95 backdrop-blur-xl z-40 select-none shadow-2xl",
        mounted && "transition-all duration-200",
        isRtl ? "right-0 border-l border-slate-800/80" : "left-0 border-r border-slate-800/80"
      )}
    >
      {/* Logo Header */}
      <div data-tour="brand-logo" className="flex items-center gap-2.5 px-3.5 py-4 border-b border-slate-800/80">
        <div className="w-8 h-8 rounded-lg bg-orange-600/20 border border-orange-500/30 flex items-center justify-center shadow-[0_0_12px_rgba(234,88,12,0.3)] shrink-0 mx-auto md:mx-0">
          <LogoMark />
        </div>
        {!isCollapsed && (
          <>
            <span className="text-xl font-bold tracking-tight text-white flex items-center gap-1">
              {t('common.appName', 'ProCal')}
            </span>
            <span className={cn(
              "text-[9px] font-bold uppercase tracking-wider text-orange-400 bg-orange-500/10 border border-orange-500/20 px-1.5 py-0.5 rounded",
              isRtl ? "mr-auto" : "ml-auto"
            )}>
              v1.0
            </span>
          </>
        )}
      </div>

      {/* Active Project */}
      <div data-tour="project-selector" className="pt-3">
        {!isCollapsed && (
          <p className="px-4 mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            {t('nav.selectProject', 'Active Project')}
          </p>
        )}
        <ProjectSelector isCollapsed={isCollapsed} />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 space-y-0.5 custom-scrollbar" aria-label="Main navigation">
        {!isCollapsed && (
          <div className="flex items-center justify-between px-2 pt-1 pb-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              {t('common.actions', 'Navigation')}
            </p>
            {selectedProject && (
              <span className={cn(
                "text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border",
                currentMemberRole === "PROJECT_MANAGER"
                  ? "bg-orange-500/10 text-orange-400 border-orange-500/30"
                  : currentMemberRole === "QA"
                  ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                  : "bg-slate-800 text-slate-400 border-slate-700"
              )}>
                {currentMemberRole === "PROJECT_MANAGER" ? t('team.roles.pm', 'PM') : currentMemberRole === "QA" ? t('team.roles.qa', 'QA') : t('team.roles.engineer', 'Engineer')}
              </span>
            )}
          </div>
        )}
        {NAV_ITEMS.map(({ id, labelKey, href, icon: Icon, stepNumber }) => {
          const isProjectsItem = id === "projects";
          const isActive = isProjectsItem
            ? pathname === "/projects"
            : pathname === href || pathname.startsWith(`${href}/`);
          const tourKey = `tour-${href.replace("/", "")}`;
          const label = t(labelKey);
          const isRestricted = id !== "dashboard" && id !== "projects" && id !== "settings" && !canView(id);

          const isSelectedProjectActive = selectedProject && (
            pathname === `/projects/${selectedProject.id}` ||
            pathname.startsWith(`/projects/${selectedProject.id}/`)
          );

          return (
            <div key={href} className="space-y-0.5">
              <Link
                href={isRestricted ? "#" : href}
                onClick={(e) => {
                  if (isRestricted) {
                    e.preventDefault();
                    e.stopPropagation();
                  }
                }}
                aria-disabled={isRestricted}
                tabIndex={isRestricted ? -1 : undefined}
                data-tour={tourKey}
                title={isCollapsed ? (isRestricted ? `${label} (${t('rbac.accessRestricted', 'Restricted')})` : label) : isRestricted ? `${label} (${t('rbac.accessRestricted', 'Restricted')})` : undefined}
                className={cn(
                  "group flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 outline-none",
                  isCollapsed ? "justify-center px-0 py-2.5" : "",
                  isRestricted
                    ? "opacity-50 text-slate-600 hover:text-slate-600 bg-transparent cursor-not-allowed select-none"
                    : isActive
                    ? isRtl
                      ? "bg-gradient-to-l from-orange-600/25 to-amber-600/10 text-orange-300 border-r-2 border-orange-500 shadow-[0_0_15px_rgba(234,88,12,0.15)] font-semibold"
                      : "bg-gradient-to-r from-orange-600/25 to-amber-600/10 text-orange-300 border-l-2 border-orange-500 shadow-[0_0_15px_rgba(234,88,12,0.15)] font-semibold"
                    : isRtl
                    ? "text-slate-400 hover:text-slate-100 hover:bg-slate-900/80 border-r-2 border-transparent"
                    : "text-slate-400 hover:text-slate-100 hover:bg-slate-900/80 border-l-2 border-transparent"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon
                  size={18}
                  className={cn(
                    "flex-shrink-0 transition-colors duration-200",
                    isRestricted ? "text-slate-600" : isActive ? "text-orange-400" : "text-slate-500"
                  )}
                />
                {!isCollapsed && (
                  <span className={cn("truncate flex-1", isRestricted && "text-slate-500")}>
                    {label}
                  </span>
                )}
                {!isCollapsed && isRestricted && (
                  <Lock size={12} className="text-slate-500 shrink-0" />
                )}
                {!isCollapsed && !isRestricted && stepNumber && (
                  <span className={cn(
                    "text-[10px] font-mono font-bold w-4 h-4 rounded flex items-center justify-center shrink-0 transition-colors",
                    isActive
                      ? "bg-orange-500/20 text-orange-300 border border-orange-500/40"
                      : "bg-slate-800/80 text-slate-500 group-hover:text-slate-300 group-hover:bg-slate-800"
                  )}>
                    {stepNumber}
                  </span>
                )}
                {!isCollapsed && !isRestricted && isActive && !stepNumber && (
                  <span className={cn(
                    "w-1.5 h-1.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(234,88,12,0.9)] flex-shrink-0",
                    isRtl ? "mr-auto" : "ml-auto"
                  )} />
                )}
              </Link>

              {/* Selected Project Quick Navigation button under Projects */}
              {isProjectsItem && selectedProject && (
                <Link
                  href={`/projects/${selectedProject.id}`}
                  title={isCollapsed ? `${selectedProject.name} (${t('projects.buildingsAndSettings', 'Buildings & Settings')})` : selectedProject.name}
                  data-tour="selected-project-nav"
                  className={cn(
                    "group flex items-center rounded-lg text-xs font-medium transition-all duration-200 outline-none relative overflow-hidden",
                    isCollapsed
                      ? "justify-center p-2 mx-auto my-0.5 w-10 h-8"
                      : isRtl
                      ? "mr-3 pr-2.5 pl-2 py-1.5 gap-2 my-0.5 border-r-2 border-slate-800/80 hover:border-orange-500/40"
                      : "ml-3 pl-2.5 pr-2 py-1.5 gap-2 my-0.5 border-l-2 border-slate-800/80 hover:border-orange-500/40",
                    isSelectedProjectActive
                      ? isRtl
                        ? "bg-gradient-to-l from-orange-600/20 to-amber-600/10 text-orange-200 border-r-2 border-orange-500 shadow-[0_0_12px_rgba(234,88,12,0.12)] font-semibold"
                        : "bg-gradient-to-r from-orange-600/20 to-amber-600/10 text-orange-200 border-l-2 border-orange-500 shadow-[0_0_12px_rgba(234,88,12,0.12)] font-semibold"
                      : "text-slate-400 hover:text-slate-100 hover:bg-slate-900/70"
                  )}
                  aria-current={isSelectedProjectActive ? "page" : undefined}
                >
                  <Building2
                    size={14}
                    className={cn(
                      "flex-shrink-0 transition-colors",
                      isSelectedProjectActive ? "text-orange-400" : "text-slate-500 group-hover:text-orange-400/80"
                    )}
                  />
                  {!isCollapsed && (
                    <MarqueeText
                      text={selectedProject.name}
                      className={cn(
                        "text-xs",
                        isSelectedProjectActive ? "text-orange-200 font-semibold" : "text-slate-300 group-hover:text-white"
                      )}
                    />
                  )}
                  {!isCollapsed && isSelectedProjectActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shadow-[0_0_6px_rgba(234,88,12,0.9)] flex-shrink-0" />
                  )}
                </Link>
              )}
            </div>
          );
        })}
      </nav>

      {/* Bottom Section */}
      <div className="border-t border-slate-800/80 pt-2 pb-3 space-y-2 px-2">
        {/* Language Selector in Bottom Section */}
        <div data-tour="language-selector" className="w-full">
          <LanguageSelector isCollapsed={isCollapsed} variant="compact" />
        </div>

        {/* Help & Product Tour Button */}
        <div className={cn("flex", isCollapsed ? "justify-center" : "justify-end")}>
          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent('trigger-procal-tour'));
            }}
            className={cn(
              "flex items-center gap-2 p-1.5 rounded-lg text-slate-400 hover:text-orange-300 hover:bg-slate-900 border border-slate-800/80 hover:border-orange-500/30 transition-all duration-150 text-xs w-full",
              isCollapsed ? "justify-center w-9 h-9 p-0" : "justify-between px-3 py-1.5"
            )}
            title={t('nav.helpTour', 'Help & Product Tour')}
          >
            {isCollapsed ? (
              <HelpCircle size={16} className="text-orange-400" />
            ) : (
              <>
                <span className="text-[11px] font-medium text-slate-300 flex items-center gap-1.5">
                  <HelpCircle size={14} className="text-orange-400" />
                  {t('nav.helpTour', 'Help & Tour')}
                </span>
                <span className="text-[9px] font-bold text-orange-400 bg-orange-500/10 border border-orange-500/20 px-1 py-0.2 rounded">
                  {t('nav.guide', 'Guide')}
                </span>
              </>
            )}
          </button>
        </div>

        {/* Toggle Collapse/Expand Button */}
        <div data-tour="sidebar-toggle" className={cn("flex", isCollapsed ? "justify-center" : "justify-end")}>
          <button
            onClick={toggleSidebar}
            className={cn(
              "flex items-center gap-2 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 border border-slate-800/80 transition-all duration-150 text-xs w-full",
              isCollapsed ? "justify-center w-9 h-9 p-0" : "justify-between px-3 py-1.5"
            )}
            title={isCollapsed ? t('nav.expandSidebar') : t('nav.collapseSidebar')}
          >
            {isCollapsed ? (
              <PanelLeftOpen size={16} className={cn("text-orange-400", isRtl && "scale-x-[-1]")} />
            ) : (
              <>
                <span className="text-[11px] font-medium text-slate-400">
                  {t('nav.collapseSidebar', 'Collapse Sidebar')}
                </span>
                <PanelLeftClose size={15} className={cn("text-slate-400", isRtl && "scale-x-[-1]")} />
              </>
            )}
          </button>
        </div>

        {currentUser?.role === "ADMIN" && (
          <Link
            href="/admin"
            title={t('nav.adminDashboard', 'Admin Dashboard')}
            className={cn(
              "flex items-center gap-2.5 rounded-lg text-xs font-medium text-orange-300 bg-orange-500/10 border border-orange-500/20 hover:bg-orange-500/20 transition-all duration-150",
              isCollapsed ? "justify-center p-2" : "px-3 py-2"
            )}
          >
            <Shield size={16} className="flex-shrink-0 text-orange-400" />
            {!isCollapsed && <span>{t('nav.adminDashboard', 'Admin Dashboard')}</span>}
          </Link>
        )}

        {/* User profile & logout */}
        <div className={cn("flex items-center gap-2 pt-1 border-t border-slate-800/60", isCollapsed ? "flex-col justify-center" : "justify-between")}>
          <Link
            href="/settings?tab=account"
            title={t('settings.account', 'Account & Security')}
            className={cn(
              "flex items-center gap-2 min-w-0 group rounded-lg transition-colors duration-150 p-1 -m-1 hover:bg-slate-900/80 outline-none focus:ring-1 focus:ring-orange-500",
              isCollapsed ? "justify-center" : "flex-1"
            )}
          >
            <div
              className="w-8 h-8 rounded-lg bg-orange-600/20 border border-orange-500/40 flex items-center justify-center flex-shrink-0 group-hover:border-orange-400 group-hover:shadow-[0_0_10px_rgba(234,88,12,0.3)] transition-all"
            >
              <span className="text-xs font-bold text-orange-300 group-hover:text-orange-200">
                {currentUser?.name?.[0]?.toUpperCase() ?? "?"}
              </span>
            </div>

            {!isCollapsed && (
              <div className="flex-1 min-w-0 text-start">
                <p className="text-xs font-semibold text-slate-200 truncate leading-tight group-hover:text-orange-300 transition-colors">
                  {currentUser?.name ?? "Engineer"}
                </p>
                <p className="text-[10px] text-slate-400 truncate leading-tight">
                  {currentUser?.role === "ADMIN" ? "Administrator" : "ProCal Member"}
                </p>
              </div>
            )}
          </Link>

          <button
            onClick={handleLogout}
            disabled={loggingOut}
            title={t('nav.signOut', 'Sign out')}
            aria-label={t('nav.signOut', 'Sign out')}
            className={cn(
              "flex-shrink-0 p-1.5 rounded-md transition-colors duration-150 outline-none focus:ring-2 focus:ring-orange-500",
              loggingOut
                ? "text-slate-600 cursor-not-allowed"
                : "text-slate-400 hover:text-rose-400 hover:bg-rose-500/10"
            )}
          >
            {loggingOut ? (
              <svg
                className="animate-spin h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
            ) : (
              <LogOut size={16} className={cn(isRtl && "scale-x-[-1]")} />
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}
