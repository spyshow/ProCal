import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useProject } from "@/context/ProjectContext";
import { useSidebar } from "@/context/SidebarContext";
import { useTranslation } from "@/i18n";
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
  ChevronDown,
  Building2,
  PanelLeftClose,
  PanelLeftOpen,
  Lock,
  Users,
  ClipboardCheck,
  History,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  id: string;
  labelKey: string;
  href: string;
  icon: React.ElementType;
  stepNumber?: number;
}

const OVERVIEW_ITEMS: NavItem[] = [
  { id: "dashboard", labelKey: "nav.dashboard", href: "/dashboard", icon: LayoutDashboard },
  { id: "projects",  labelKey: "nav.projects",  href: "/projects",  icon: FolderOpen },
];

const WORKFLOW_STEPS: NavItem[] = [
  { id: "calculator",      labelKey: "nav.calculator",      href: "/calculator",       icon: Zap,          stepNumber: 1 },
  { id: "breakerSchedule", labelKey: "nav.breakerSchedule", href: "/breaker-schedule", icon: CircuitBoard, stepNumber: 2 },
  { id: "coordination",    labelKey: "nav.coordination",    href: "/coordination",     icon: Shield,       stepNumber: 3 },
  { id: "cableSchedule",   labelKey: "nav.cableSchedule",   href: "/cable-schedule",   icon: Cable,        stepNumber: 4 },
  { id: "panelDesigner",   labelKey: "nav.panelDesigner",   href: "/panel",            icon: Cpu,          stepNumber: 5 },
  { id: "riserDiagram",    labelKey: "nav.riserDiagram",    href: "/riser",            icon: GitBranch,    stepNumber: 6 },
  { id: "sldDesigner",     labelKey: "nav.sldDesigner",     href: "/sld",              icon: GitBranch,    stepNumber: 7 },
  { id: "reports",         labelKey: "nav.reports",         href: "/reports",          icon: FileText,     stepNumber: 8 },
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
  const { isCollapsed, toggleSidebar } = useSidebar();
  const { selectedProject, canView } = useProject();
  const { t, isRtl } = useTranslation();

  // Active Project Collapsible Sub-Navigation State
  const [projectSubnavOpen, setProjectSubnavOpen] = useState(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('procal-project-subnav-open');
      if (saved !== null) {
        setProjectSubnavOpen(saved === 'true');
      }
    } catch {}
  }, []);

  // Auto-expand subnav when user navigates to the active project page
  useEffect(() => {
    if (selectedProject && pathname.startsWith(`/projects/${selectedProject.id}`)) {
      setProjectSubnavOpen(true);
    }
  }, [pathname, selectedProject]);

  const toggleProjectSubnav = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setProjectSubnavOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('procal-project-subnav-open', String(next));
      } catch {}
      return next;
    });
  };

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isSelectedProjectActive = selectedProject && (
    pathname === `/projects/${selectedProject.id}` ||
    pathname.startsWith(`/projects/${selectedProject.id}/`)
  );

  return (
    <aside
      style={{ width: isCollapsed ? "64px" : "240px" }}
      className={cn(
        "fixed top-0 h-screen flex flex-col bg-[var(--sidebar-bg,rgba(3,7,18,0.95))] backdrop-blur-xl z-40 select-none shadow-2xl transition-colors duration-200",
        mounted && "transition-all duration-200",
        isRtl ? "right-0 border-l border-[var(--sidebar-border,rgba(31,41,55,0.8))]" : "left-0 border-r border-[var(--sidebar-border,rgba(31,41,55,0.8))]"
      )}
    >
      {/* Logo Header */}
      <div data-tour="brand-logo" className="flex items-center gap-2.5 px-3.5 py-3.5 border-b border-[var(--sidebar-border,rgba(31,41,55,0.8))] shrink-0">
        <div className="w-8 h-8 rounded-lg bg-[var(--brand-mark-bg,rgba(234,88,12,0.2))] border border-[var(--brand-mark-border,rgba(234,88,12,0.3))] flex items-center justify-center shadow-[0_0_12px_rgba(234,88,12,0.3)] shrink-0 mx-auto md:mx-0">
          <LogoMark />
        </div>
        {!isCollapsed && (
          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold tracking-tight text-[var(--foreground-color,#ffffff)] flex items-center gap-1">
                {t('common.appName', 'ProCal')}
              </span>
              <span className={cn(
                "text-[9px] font-bold uppercase tracking-wider text-orange-400 bg-orange-500/10 border border-orange-500/20 px-1.5 py-0.5 rounded",
                isRtl ? "mr-auto" : "ml-auto"
              )}>
                v1.4.5
              </span>
            </div>
            <p className="text-[9px] text-[var(--table-header-color,#94a3b8)] tracking-tight font-medium truncate mt-0.5">
              {isRtl ? (
                <>تصميم كهربائي للجهد المنخفض، <span className="text-orange-400 font-semibold">محلول</span></>
              ) : (
                <>Low-voltage Electrical design, <span className="text-orange-400 font-semibold">Solved</span></>
              )}
            </p>
          </div>
        )}
      </div>

      {/* Navigation Body */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4 custom-scrollbar" aria-label="Main navigation">
        {/* SECTION 1: OVERVIEW */}
        <div className="space-y-1">
          {!isCollapsed && (
            <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--table-header-color,#9ca3af)]">
              {t('common.overview', 'Overview')}
            </p>
          )}
          {OVERVIEW_ITEMS.map(({ id, labelKey, href, icon: Icon }) => {
            const isProjectsItem = id === "projects";
            const isActive = isProjectsItem
              ? pathname === "/projects"
              : pathname === href || pathname.startsWith(`${href}/`);
            const tourKey = `tour-${href.replace("/", "")}`;
            const label = t(labelKey);

            return (
              <div key={href} className="space-y-0.5">
                <Link
                  href={href}
                  data-tour={tourKey}
                  title={isCollapsed ? label : undefined}
                  className={cn(
                    "group flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all duration-150 outline-none",
                    isCollapsed ? "justify-center px-0 py-2.5" : "",
                    isActive
                      ? isRtl
                        ? "sidebar-active-item border-r-2 shadow-[0_0_12px_rgba(234,88,12,0.12)] font-bold"
                        : "sidebar-active-item border-l-2 shadow-[0_0_12px_rgba(234,88,12,0.12)] font-bold"
                      : isRtl
                      ? "text-[var(--table-header-color,#9ca3af)] hover:text-[var(--foreground-color,#f8fafc)] hover:bg-[var(--card-bg-subtle,rgba(17,24,39,0.8))] border-r-2 border-transparent"
                      : "text-[var(--table-header-color,#9ca3af)] hover:text-[var(--foreground-color,#f8fafc)] hover:bg-[var(--card-bg-subtle,rgba(17,24,39,0.8))] border-l-2 border-transparent"
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon
                    size={16}
                    className={cn(
                      "flex-shrink-0 transition-colors duration-150",
                      isActive ? "text-orange-500" : "text-[var(--table-header-color,#9ca3af)] group-hover:text-orange-500"
                    )}
                  />
                  {!isCollapsed && (
                    <span className={cn("truncate flex-1 sidebar-item-label", isActive && "font-bold")}>{label}</span>
                  )}
                  {!isCollapsed && isActive && (
                    <span className={cn(
                      "w-1.5 h-1.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(234,88,12,0.9)] flex-shrink-0",
                      isRtl ? "mr-auto" : "ml-auto"
                    )} />
                  )}
                </Link>

                {/* Selected Project Collapsible Sub-Navigation */}
                {isProjectsItem && selectedProject && (
                  <div className="my-1" data-tour="selected-project-nav">
                    {/* Project Header Row */}
                    <div
                      className={cn(
                        "group flex items-center justify-between rounded-lg text-xs font-semibold transition-all duration-150 outline-none relative overflow-hidden",
                        isCollapsed
                          ? "justify-center p-2 mx-auto w-9 h-8"
                          : isRtl
                          ? "mr-2 pr-2.5 pl-1.5 py-1.5 gap-1.5 border-r-2"
                          : "ml-2 pl-2.5 pr-1.5 py-1.5 gap-1.5 border-l-2",
                        isSelectedProjectActive
                          ? "sidebar-active-item border-orange-500 shadow-[0_0_10px_rgba(234,88,12,0.15)] font-bold"
                          : "border-[var(--border-color,#1f2937)] text-[var(--foreground-color,#f8fafc)] bg-[var(--card-bg-subtle,rgba(17,24,39,0.5))] hover:bg-[var(--card-bg-subtle,rgba(17,24,39,0.8))] hover:border-orange-500/40"
                      )}
                    >
                      <Link
                        href={`/projects/${selectedProject.id}`}
                        title={isCollapsed ? `${selectedProject.name} (${t('projects.buildingsAndSettings', 'Buildings & Settings')})` : selectedProject.name}
                        className="flex items-center gap-2 flex-1 min-w-0"
                      >
                        <Building2
                          size={13}
                          className="flex-shrink-0 transition-colors text-orange-500"
                        />
                        {!isCollapsed && (
                          <MarqueeText
                            text={selectedProject.name}
                            className={cn(
                              "text-xs font-semibold sidebar-item-label",
                              isSelectedProjectActive ? "font-bold" : "text-[var(--foreground-color,#f8fafc)] group-hover:text-orange-400"
                            )}
                          />
                        )}
                      </Link>

                      {!isCollapsed && (
                        <button
                          type="button"
                          onClick={toggleProjectSubnav}
                          title={projectSubnavOpen ? t('common.collapse', 'Collapse') : t('common.expand', 'Expand')}
                          className="p-1 rounded hover:bg-[var(--card-bg-subtle,rgba(17,24,39,0.8))] text-[var(--foreground-color,#f8fafc)] hover:text-orange-400 transition-colors shrink-0"
                          aria-expanded={projectSubnavOpen}
                        >
                          <ChevronDown
                            size={12}
                            className={cn(
                              "transition-transform duration-200",
                              !projectSubnavOpen && (isRtl ? "rotate-90" : "-rotate-90")
                            )}
                          />
                        </button>
                      )}
                    </div>

                    {/* Collapsible Sub-Items */}
                    {!isCollapsed && projectSubnavOpen && (
                      <div
                        className={cn(
                          "space-y-0.5 mt-1 pt-1 pb-0.5",
                          isRtl
                            ? "mr-3 pr-2.5 border-r border-[var(--border-color,#1f2937)]"
                            : "ml-3 pl-2.5 border-l border-[var(--border-color,#1f2937)]"
                        )}
                      >
                        {[
                          {
                            id: 'buildings',
                            label: t('projects.buildings', 'Buildings & Specs'),
                            href: `/projects/${selectedProject.id}`,
                            icon: Building2,
                            isActive: isSelectedProjectActive && (!pathname.includes('?') || pathname.endsWith(selectedProject.id)),
                          },
                          {
                            id: 'team',
                            label: t('settings.team', 'Project Team'),
                            href: `/projects/${selectedProject.id}?tab=team`,
                            icon: Users,
                            isActive: isSelectedProjectActive && pathname.includes('tab=team'),
                          },
                          {
                            id: 'qa',
                            label: t('settings.qa', 'QA & Compliance'),
                            href: `/projects/${selectedProject.id}?tab=qa`,
                            icon: ClipboardCheck,
                            isActive: isSelectedProjectActive && (pathname.includes('tab=qa') || pathname.includes('tab=review')),
                          },
                          {
                            id: 'activity',
                            label: t('settings.activity', 'Activity Log'),
                            href: `/projects/${selectedProject.id}?tab=activity`,
                            icon: History,
                            isActive: isSelectedProjectActive && (pathname.includes('tab=activity') || pathname.includes('tab=audit')),
                          },
                        ].map((sub) => {
                          const SubIcon = sub.icon;
                          return (
                            <Link
                              key={sub.id}
                              href={sub.href}
                              className={cn(
                                "flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] font-medium transition-all duration-150 group/sub",
                                sub.isActive
                                  ? "sidebar-active-item font-bold shadow-sm"
                                  : "text-[var(--table-header-color,#9ca3af)] hover:text-[var(--foreground-color,#f8fafc)] hover:bg-[var(--card-bg-subtle,rgba(17,24,39,0.6))]"
                              )}
                            >
                              <SubIcon
                                size={12}
                                className={cn(
                                  "flex-shrink-0 transition-colors",
                                  sub.isActive ? "text-orange-500" : "text-[var(--table-header-color,#9ca3af)] group-hover/sub:text-orange-400"
                                )}
                              />
                              <span className={cn("truncate flex-1 sidebar-item-label", sub.isActive && "font-bold")}>{sub.label}</span>
                              {sub.isActive && (
                                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shadow-[0_0_6px_rgba(234,88,12,0.8)] flex-shrink-0" />
                              )}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* SECTION 2: ENGINEERING PIPELINE STEPPER */}
        <div className="space-y-1 relative">
          {!isCollapsed && (
            <div className="flex items-center justify-between px-2 pb-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-orange-500/90 dark:text-orange-400/90 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                {t('workflow.pipeline', 'Engineering Workflow')}
              </p>
              <span className="text-[9px] font-mono text-[var(--table-header-color,#9ca3af)]">
                1–8
              </span>
            </div>
          )}

          {/* Stepper Container */}
          <div className={cn(
            "relative space-y-1",
            !isCollapsed && (isRtl ? "pr-1" : "pl-1")
          )}>
            {/* Connecting Vertical Line */}
            {!isCollapsed && (
              <div
                className={cn(
                  "absolute top-4 bottom-4 w-[1px] bg-[var(--border-color,#1f2937)] pointer-events-none z-0",
                  isRtl ? "right-[19px]" : "left-[19px]"
                )}
              />
            )}

            {WORKFLOW_STEPS.map(({ id, labelKey, href, icon: Icon, stepNumber }) => {
              const isActive = pathname === href || pathname.startsWith(`${href}/`);
              const tourKey = `tour-${href.replace("/", "")}`;
              const label = t(labelKey);
              const isRestricted = !canView(id);

              return (
                <div key={href} className="relative z-10">
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
                    title={isCollapsed ? (isRestricted ? `${stepNumber}. ${label} (${t('rbac.accessRestricted', 'Restricted')})` : `${stepNumber}. ${label}`) : isRestricted ? `${label} (${t('rbac.accessRestricted', 'Restricted')})` : undefined}
                    className={cn(
                      "group flex items-center rounded-lg text-xs font-medium transition-all duration-150 outline-none relative",
                      isCollapsed ? "justify-center p-2.5" : "gap-2.5 px-2 py-2",
                      isRestricted
                        ? "opacity-40 text-slate-500 cursor-not-allowed select-none"
                        : isActive
                        ? isRtl
                          ? "sidebar-active-item border-r-2 shadow-[0_0_12px_rgba(234,88,12,0.12)] font-bold"
                          : "sidebar-active-item border-l-2 shadow-[0_0_12px_rgba(234,88,12,0.12)] font-bold"
                        : isRtl
                        ? "text-[var(--table-header-color,#9ca3af)] hover:text-[var(--foreground-color,#f8fafc)] hover:bg-[var(--card-bg-subtle,rgba(17,24,39,0.8))] border-r-2 border-transparent"
                        : "text-[var(--table-header-color,#9ca3af)] hover:text-[var(--foreground-color,#f8fafc)] hover:bg-[var(--card-bg-subtle,rgba(17,24,39,0.8))] border-l-2 border-transparent"
                    )}
                    aria-current={isActive ? "page" : undefined}
                  >
                    {/* Collapsed view: Icon with mini step number badge */}
                    {isCollapsed ? (
                      <div className="relative flex items-center justify-center">
                        <Icon
                          size={18}
                          className={cn(
                            "transition-colors duration-150",
                            isRestricted ? "text-slate-600" : isActive ? "text-orange-500" : "text-[var(--table-header-color,#9ca3af)] group-hover:text-orange-500"
                          )}
                        />
                        <span className={cn(
                          "absolute -top-1.5 -right-2 text-[9px] font-mono font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center border",
                          isActive
                            ? "bg-orange-500 text-white border-orange-400 shadow-[0_0_6px_rgba(234,88,12,0.8)]"
                            : "bg-[var(--card-bg,#0b0f19)] text-[var(--table-header-color,#9ca3af)] border-[var(--border-color,#1f2937)]"
                        )}>
                          {stepNumber}
                        </span>
                      </div>
                    ) : (
                      /* Expanded view: Numbered Stepper Pill + Icon + Label */
                      <>
                        <span
                          className={cn(
                            "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold transition-all duration-150 shrink-0 border z-10",
                            isActive
                              ? "bg-orange-500 text-white border-orange-400 shadow-[0_0_10px_rgba(234,88,12,0.6)] ring-2 ring-orange-500/20"
                              : "bg-[var(--card-bg,#0b0f19)] text-[var(--table-header-color,#9ca3af)] border-[var(--border-color,#1f2937)] group-hover:border-orange-500/50 group-hover:text-[var(--foreground-color,#f8fafc)]"
                          )}
                        >
                          {stepNumber}
                        </span>

                        <Icon
                          size={15}
                          className={cn(
                            "flex-shrink-0 transition-colors duration-150",
                            isRestricted ? "text-slate-600" : isActive ? "text-orange-500" : "text-[var(--table-header-color,#9ca3af)] group-hover:text-orange-500"
                          )}
                        />

                        <span className={cn(
                          "truncate flex-1 text-xs sidebar-item-label",
                          isRestricted ? "text-slate-500" : isActive ? "font-bold" : "text-inherit"
                        )}>
                          {label}
                        </span>

                        {isRestricted && (
                          <Lock size={12} className="text-slate-500 shrink-0" />
                        )}

                        {isActive && !isRestricted && (
                          <span className={cn(
                            "w-1.5 h-1.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(234,88,12,0.9)] flex-shrink-0",
                            isRtl ? "mr-auto" : "ml-auto"
                          )} />
                        )}
                      </>
                    )}
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </nav>

      {/* SECTION 3: MINIMALIST FOOTER (Settings & Collapse Toggle Only) */}
      <div className="border-t border-[var(--sidebar-border,rgba(31,41,55,0.8))] p-2 space-y-1 shrink-0 bg-[var(--sidebar-bg,rgba(3,7,18,0.98))]">
        {/* Settings Button */}
        <Link
          href="/settings"
          data-tour="tour-settings"
          title={isCollapsed ? t('nav.settings', 'Settings') : undefined}
          className={cn(
            "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all duration-150 outline-none",
            isCollapsed ? "justify-center px-0 py-2.5" : "",
            pathname === "/settings" || pathname.startsWith("/settings/")
              ? "sidebar-active-item border-l-2 font-bold"
              : "text-[var(--table-header-color,#9ca3af)] hover:text-[var(--foreground-color,#f8fafc)] hover:bg-[var(--card-bg-subtle,rgba(17,24,39,0.8))]"
          )}
        >
          <Settings
            size={16}
            className={cn(
              "flex-shrink-0 transition-colors duration-150",
              pathname.startsWith("/settings") ? "text-orange-500" : "text-[var(--table-header-color,#9ca3af)]"
            )}
          />
          {!isCollapsed && <span className={cn("sidebar-item-label", pathname.startsWith("/settings") && "font-bold")}>{t('nav.settings', 'Settings')}</span>}
        </Link>

        {/* Sidebar Collapse / Expand Button */}
        <button
          type="button"
          data-tour="sidebar-toggle"
          onClick={toggleSidebar}
          className={cn(
            "flex items-center rounded-lg transition-all duration-150 text-xs w-full outline-none",
            "text-[var(--table-header-color,#9ca3af)] hover:text-[var(--foreground-color,#f8fafc)] hover:bg-[var(--card-bg-subtle,rgba(17,24,39,0.8))]",
            isCollapsed ? "justify-center p-2.5" : "justify-between px-2.5 py-2"
          )}
          title={isCollapsed ? t('nav.expandSidebar', 'Expand Sidebar') : t('nav.collapseSidebar', 'Collapse Sidebar')}
          aria-label={isCollapsed ? t('nav.expandSidebar', 'Expand Sidebar') : t('nav.collapseSidebar', 'Collapse Sidebar')}
        >
          {isCollapsed ? (
            <PanelLeftOpen size={16} className={cn("text-orange-500 dark:text-orange-400", isRtl && "scale-x-[-1]")} />
          ) : (
            <>
              <span className="text-xs font-medium text-[var(--table-header-color,#9ca3af)]">
                {t('nav.collapseSidebar', 'Collapse')}
              </span>
              <PanelLeftClose size={15} className={cn("text-[var(--table-header-color,#9ca3af)]", isRtl && "scale-x-[-1]")} />
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
