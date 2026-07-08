"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useProject } from "@/context/ProjectContext";
import {
  LayoutDashboard,
  FolderOpen,
  Zap,
  Cpu,
  GitBranch,
  Shield,
  FileText,
  Settings,
  LogOut,
  ChevronDown,
  Building2,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard",      href: "/dashboard",    icon: LayoutDashboard },
  { label: "Projects",       href: "/projects",     icon: FolderOpen      },
  { label: "Load Calculator",href: "/calculator",   icon: Zap             },
  { label: "Panel Designer", href: "/panel",        icon: Cpu             },
  { label: "Riser Diagram",  href: "/riser",        icon: GitBranch       },
  { label: "Coordination",   href: "/coordination", icon: Shield          },
  { label: "SLD Designer",   href: "/sld",          icon: GitBranch       },
  { label: "Reports",        href: "/reports",      icon: FileText        },
  { label: "Settings",       href: "/settings",     icon: Settings        },
];

type Manufacturer = "ABB" | "SCHNEIDER" | "MIXED";

const MFG_OPTIONS: { value: Manufacturer; label: string }[] = [
  { value: "ABB",       label: "ABB"  },
  { value: "SCHNEIDER", label: "SCH"  },
  { value: "MIXED",     label: "MIX"  },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Inline lightning-bolt SVG logo mark */
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

// ---------------------------------------------------------------------------
// ProjectSelector
// ---------------------------------------------------------------------------
function ProjectSelector() {
  const { selectedProject, selectProject } = useProject();
  const [open, setOpen]         = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [fetching, setFetching] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const dropdownRef             = useRef<HTMLDivElement>(null);

  /** Fetch projects once when dropdown opens for the first time */
  const loadProjects = useCallback(async () => {
    if (projects.length > 0 || fetching) return; // already loaded or in-flight
    setFetching(true);
    setError(null);
    try {
      const res = await fetch("/api/projects");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      // Support both { projects: [] } envelope and bare array
      setProjects(Array.isArray(data) ? data : (data.projects ?? []));
    } catch (err) {
      console.error("Failed to load projects:", err);
      setError("Could not load projects");
    } finally {
      setFetching(false);
    }
  }, [projects.length, fetching]);

  const handleToggle = () => {
    if (!open) loadProjects();
    setOpen((prev) => !prev);
  };

  const handleSelect = (id: string) => {
    selectProject(id);
    setOpen(false);
  };

  /** Close on outside click */
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
    <div ref={dropdownRef} className="relative px-3 mb-4">
      <button
        onClick={handleToggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={[
          "w-full flex items-center justify-between gap-2",
          "px-3 py-2.5 rounded-lg text-sm font-medium",
          "bg-gray-800 border transition-colors duration-150",
          open
            ? "border-orange-500/60 text-white"
            : "border-gray-700 text-gray-300 hover:border-gray-600 hover:text-white",
        ].join(" ")}
      >
        <span className="flex items-center gap-2 min-w-0">
          <Building2 size={14} className="flex-shrink-0 text-orange-500" />
          <span className="truncate">
            {selectedProject ? selectedProject.name : "Select Project"}
          </span>
        </span>
        <ChevronDown
          size={14}
          className={[
            "flex-shrink-0 transition-transform duration-200",
            open ? "rotate-180 text-orange-400" : "text-gray-500",
          ].join(" ")}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className={[
            "absolute left-3 right-3 z-50 mt-1.5",
            "bg-gray-800 border border-gray-700 rounded-lg shadow-xl",
            "overflow-hidden",
          ].join(" ")}
        >
          {/* Header row */}
          <div className="px-3 py-2 border-b border-gray-700/60">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">
              Projects
            </p>
          </div>

          {/* Content */}
          <div className="max-h-56 overflow-y-auto custom-scrollbar">
            {fetching && (
              <div className="flex items-center justify-center py-6 gap-2 text-gray-500">
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
              <div className="px-3 py-4 text-xs text-red-400 text-center">
                {error}
              </div>
            )}

            {!fetching && !error && projects.length === 0 && (
              <div className="px-3 py-4 text-xs text-gray-500 text-center">
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
                    className={[
                      "w-full text-left px-3 py-2.5 text-sm transition-colors duration-100",
                      "flex items-start gap-2",
                      isActive
                        ? "bg-orange-600/20 text-orange-300"
                        : "text-gray-300 hover:bg-gray-700/60 hover:text-white",
                    ].join(" ")}
                  >
                    <span className="flex-1 truncate font-medium">
                      {proj.name}
                    </span>
                    {isActive && (
                      <span className="flex-shrink-0 mt-0.5 w-1.5 h-1.5 rounded-full bg-orange-500" />
                    )}
                  </button>
                );
              })}
          </div>

          {/* Footer — quick link to projects page */}
          <div className="border-t border-gray-700/60">
            <Link
              href="/projects"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-xs text-gray-500 hover:text-orange-400 transition-colors duration-100"
            >
              <FolderOpen size={12} />
              Manage projects
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ManufacturerToggle
// ---------------------------------------------------------------------------
function ManufacturerToggle() {
  const { preferredManufacturer, setManufacturer } = useProject();

  return (
    <div className="px-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-2 px-1">
        Manufacturer
      </p>
      <div className="flex rounded-lg overflow-hidden border border-gray-700 bg-gray-800">
        {MFG_OPTIONS.map(({ value, label }) => {
          const active = preferredManufacturer === value;
          return (
            <button
              key={value}
              onClick={() => setManufacturer(value)}
              title={value}
              className={[
                "flex-1 py-2 text-xs font-semibold transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500",
                active
                  ? "bg-orange-600 text-white"
                  : "text-gray-400 hover:text-white hover:bg-gray-700",
              ].join(" ")}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Sidebar
// ---------------------------------------------------------------------------
export default function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      router.push("/login");
    }
  };

  return (
    <aside
      style={{ width: "240px" }}
      className="fixed top-0 left-0 h-screen flex flex-col bg-gray-900 border-r border-gray-800 z-40 select-none"
    >
      {/* ── Logo ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-gray-800/80">
        <LogoMark />
        <span className="text-xl font-bold tracking-tight text-orange-500">
          ProCal
        </span>
        <span className="ml-auto text-[9px] font-semibold uppercase tracking-wider text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded">
          v1
        </span>
      </div>

      {/* ── Project Selector ─────────────────────────────────────────────── */}
      <div className="pt-4">
        <p className="px-4 mb-2 text-[10px] font-semibold uppercase tracking-widest text-gray-500">
          Active Project
        </p>
        <ProjectSelector />
      </div>

      {/* ── Navigation ───────────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto px-3 space-y-0.5" aria-label="Main navigation">
        <p className="px-1 pt-1 pb-2 text-[10px] font-semibold uppercase tracking-widest text-gray-500">
          Navigation
        </p>
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={[
                "flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium",
                "transition-colors duration-150 outline-none",
                "focus-visible:ring-2 focus-visible:ring-orange-500",
                isActive
                  ? "bg-orange-600/20 text-orange-400 border-l-2 border-orange-500 pl-[14px]"
                  : "text-gray-400 hover:text-white hover:bg-gray-800 border-l-2 border-transparent",
              ].join(" ")}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon
                size={17}
                className={[
                  "flex-shrink-0 transition-colors duration-150",
                  isActive ? "text-orange-500" : "text-gray-500",
                ].join(" ")}
              />
              <span className="truncate">{label}</span>
              {isActive && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-orange-500 flex-shrink-0" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* ── Bottom Section ───────────────────────────────────────────────── */}
      <div className="border-t border-gray-800/80 pt-4 pb-4 space-y-4">
        {/* Manufacturer Toggle */}
        <ManufacturerToggle />

        {/* Divider */}
        <div className="mx-3 border-t border-gray-800" />

        {/* User info + logout */}
        <div className="px-3 flex items-center gap-3">
          {/* Avatar placeholder */}
          <div className="w-8 h-8 rounded-lg bg-orange-600/30 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-orange-400">E</span>
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-200 truncate leading-tight">
              Engineer
            </p>
            <p className="text-[10px] text-gray-500 truncate leading-tight">
              ProCal User
            </p>
          </div>

          <button
            onClick={handleLogout}
            disabled={loggingOut}
            title="Sign out"
            aria-label="Sign out"
            className={[
              "flex-shrink-0 p-1.5 rounded-md transition-colors duration-150",
              "focus-visible:ring-2 focus-visible:ring-orange-500 outline-none",
              loggingOut
                ? "text-gray-600 cursor-not-allowed"
                : "text-gray-500 hover:text-red-400 hover:bg-red-500/10",
            ].join(" ")}
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
