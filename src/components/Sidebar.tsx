import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useProject } from "@/context/ProjectContext";
import { useUser } from "@/context/UserContext";
import { useSidebar } from "@/context/SidebarContext";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Project {
  id: string;
  name: string;
  clientName?: string;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard",        href: "/dashboard",      icon: LayoutDashboard },
  { label: "Projects",         href: "/projects",       icon: FolderOpen      },
  { label: "Load Calculator",  href: "/calculator",     icon: Zap             },
  { label: "Cable Schedule",   href: "/cable-schedule", icon: Cable           },
  { label: "Breaker Schedule", href: "/breaker-schedule", icon: CircuitBoard },
  { label: "Panel Designer",   href: "/panel",          icon: Cpu             },
  { label: "Riser Diagram",    href: "/riser",          icon: GitBranch       },
  { label: "Coordination",     href: "/coordination",   icon: Shield          },
  { label: "SLD Designer",     href: "/sld",            icon: GitBranch       },
  { label: "Reports",          href: "/reports",        icon: FileText        },
  { label: "Settings",         href: "/settings",       icon: Settings        },
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

  if (isCollapsed) {
    return (
      <div className="flex justify-center mb-3">
        <button
          onClick={handleToggle}
          title={selectedProject ? `Project: ${selectedProject.name}` : "Select Project"}
          className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-orange-400 hover:text-white hover:border-slate-700 transition-colors shadow-sm"
        >
          <Building2 size={16} />
        </button>
      </div>
    );
  }

  return (
    <div ref={dropdownRef} className="relative px-3 mb-4">
      <button
        onClick={handleToggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "w-full flex items-center justify-between gap-2",
          "px-3 py-2.5 rounded-lg text-sm font-medium",
          "bg-slate-900/90 border transition-all duration-200 backdrop-blur-md shadow-sm",
          open
            ? "border-orange-500/80 text-white ring-2 ring-orange-500/20"
            : "border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white"
        )}
      >
        <span className="flex items-center gap-2 min-w-0">
          <Building2 size={14} className="flex-shrink-0 text-orange-400" />
          <span className="truncate">
            {selectedProject ? selectedProject.name : "Select Project"}
          </span>
        </span>
        <ChevronDown
          size={14}
          className={cn(
            "flex-shrink-0 transition-transform duration-200",
            open ? "rotate-180 text-orange-400" : "text-slate-500"
          )}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-3 right-3 z-50 mt-1.5 bg-slate-950/95 border border-slate-700/80 rounded-lg shadow-2xl overflow-hidden backdrop-blur-xl animate-in fade-in-0 zoom-in-95"
        >
          <div className="px-3 py-2 border-b border-slate-800 bg-slate-900/50">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              Select Active Project
            </p>
          </div>

          <div className="max-h-56 overflow-y-auto custom-scrollbar">
            {fetching && (
              <div className="flex items-center justify-center py-6 gap-2 text-slate-400">
                <svg
                  className="animate-spin h-4 w-4 text-orange-500"
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
                <span className="text-xs">Loading…</span>
              </div>
            )}

            {!fetching && error && (
              <div className="px-3 py-4 text-xs text-rose-400 text-center">
                {error}
              </div>
            )}

            {!fetching && !error && projects.length === 0 && (
              <div className="px-3 py-4 text-xs text-slate-500 text-center">
                No projects found
              </div>
            )}

            {!fetching &&
              !error &&
              projects.map((proj) => {
                const isActive = selectedProject?.id === proj.id;
                return (
                  <button
                    key={proj.id}
                    role="option"
                    aria-selected={isActive}
                    onClick={() => handleSelect(proj.id)}
                    className={cn(
                      "w-full text-left px-3 py-2.5 text-sm transition-colors duration-150 flex items-start gap-2",
                      isActive
                        ? "bg-orange-600/20 text-orange-300 font-semibold"
                        : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
                    )}
                  >
                    <span className="flex-1 truncate font-medium">
                      {proj.name}
                    </span>
                    {isActive && (
                      <span className="flex-shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(234,88,12,0.8)]" />
                    )}
                  </button>
                );
              })}
          </div>

          <div className="border-t border-slate-800 bg-slate-900/30">
            <Link
              href="/projects"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-xs text-slate-400 hover:text-orange-400 transition-colors duration-150"
            >
              <FolderOpen size={12} />
              Manage all projects
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const { user: currentUser } = useUser();
  const { isCollapsed, toggleSidebar } = useSidebar();
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

  return (
    <aside
      style={{ width: isCollapsed ? "64px" : "240px" }}
      className="fixed top-0 left-0 h-screen flex flex-col bg-slate-950/95 border-r border-slate-800/80 backdrop-blur-xl z-40 select-none shadow-2xl transition-all duration-200"
    >
      {/* Logo Header */}
      {isCollapsed ? (
        <div className="flex flex-col items-center justify-center py-3.5 px-2 border-b border-slate-800/80">
          <button
            onClick={toggleSidebar}
            title="Expand ProCal Menu"
            className="w-9 h-9 rounded-lg bg-orange-600/20 border border-orange-500/30 flex items-center justify-center shadow-[0_0_12px_rgba(234,88,12,0.3)] hover:border-orange-400 hover:bg-orange-600/30 transition-all duration-150 relative group"
          >
            <LogoMark />
            <div className="absolute -bottom-1 -right-1 bg-slate-900 border border-slate-700 rounded-full p-0.5 text-orange-400 group-hover:scale-110 transition-transform">
              <PanelLeftOpen size={10} />
            </div>
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between px-3.5 py-4 border-b border-slate-800/80">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-orange-600/20 border border-orange-500/30 flex items-center justify-center shadow-[0_0_12px_rgba(234,88,12,0.3)] shrink-0">
              <LogoMark />
            </div>
            <span className="text-xl font-bold tracking-tight text-white flex items-center gap-1">
              ProCal
            </span>
            <span className="text-[9px] font-bold uppercase tracking-wider text-orange-400 bg-orange-500/10 border border-orange-500/20 px-1.5 py-0.5 rounded">
              v1.0
            </span>
          </div>

          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition-colors shrink-0"
            title="Collapse Main Menu"
          >
            <PanelLeftClose size={16} />
          </button>
        </div>
      )}

      {/* Active Project */}
      <div className="pt-3">
        {!isCollapsed && (
          <p className="px-4 mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            Active Project
          </p>
        )}
        <ProjectSelector isCollapsed={isCollapsed} />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 space-y-0.5 custom-scrollbar" aria-label="Main navigation">
        {!isCollapsed && (
          <p className="px-2 pt-1 pb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            Navigation
          </p>
        )}
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              title={isCollapsed ? label : undefined}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 outline-none",
                isCollapsed ? "justify-center px-0 py-2.5" : "",
                isActive
                  ? "bg-gradient-to-r from-orange-600/25 to-amber-600/10 text-orange-300 border-l-2 border-orange-500 shadow-[0_0_15px_rgba(234,88,12,0.15)] font-semibold"
                  : "text-slate-400 hover:text-slate-100 hover:bg-slate-900/80 border-l-2 border-transparent"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon
                size={18}
                className={cn(
                  "flex-shrink-0 transition-colors duration-200",
                  isActive ? "text-orange-400" : "text-slate-500"
                )}
              />
              {!isCollapsed && <span className="truncate">{label}</span>}
              {!isCollapsed && isActive && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(234,88,12,0.9)] flex-shrink-0" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Section */}
      <div className="border-t border-slate-800/80 pt-3 pb-3">
        {currentUser?.role === "ADMIN" && (
          <Link
            href="/admin"
            title="Admin dashboard"
            className={cn(
              "mx-2 mb-3 flex items-center gap-2.5 rounded-lg text-xs font-medium text-orange-300 bg-orange-500/10 border border-orange-500/20 hover:bg-orange-500/20 transition-all duration-150",
              isCollapsed ? "justify-center p-2" : "px-3 py-2"
            )}
          >
            <Shield size={16} className="flex-shrink-0 text-orange-400" />
            {!isCollapsed && <span>Admin Dashboard</span>}
          </Link>
        )}

        {/* User profile & logout */}
        <div className={cn("px-2 flex items-center gap-2", isCollapsed ? "flex-col justify-center" : "gap-2.5 px-3")}>
          <div
            title={currentUser?.name ?? "Engineer"}
            className="w-8 h-8 rounded-lg bg-orange-600/20 border border-orange-500/40 flex items-center justify-center flex-shrink-0"
          >
            <span className="text-xs font-bold text-orange-300">
              {currentUser?.name?.[0]?.toUpperCase() ?? "?"}
            </span>
          </div>

          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-200 truncate leading-tight">
                {currentUser?.name ?? "Engineer"}
              </p>
              <p className="text-[10px] text-slate-500 truncate leading-tight">
                {currentUser?.role === "ADMIN" ? "Administrator" : "ProCal Member"}
              </p>
            </div>
          )}

          <button
            onClick={handleLogout}
            disabled={loggingOut}
            title="Sign out"
            aria-label="Sign out"
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
              <LogOut size={16} />
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}

