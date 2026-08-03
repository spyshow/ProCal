"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Database,
  FolderOpen,
  CreditCard,
  Shield,
  ArrowLeft,
} from "lucide-react";

interface AdminNavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const NAV_ITEMS: AdminNavItem[] = [
  { label: "Dashboard",       href: "/admin",          icon: LayoutDashboard },
  { label: "Users",           href: "/admin/users",    icon: Users },
  { label: "Breaker Catalog", href: "/admin/breakers", icon: Database },
  { label: "Billing Leads",   href: "/admin/leads",    icon: CreditCard },
];

// ponytail: Projects has no admin page or backend yet — shown as a non-link
// "Soon" row so the menu shape exists without a 404 link. Convert to a real
// link when it ships.
const COMING_SOON: { label: string; icon: React.ElementType }[] = [
  { label: "Projects", icon: FolderOpen },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside
      style={{ width: "240px" }}
      className="fixed top-0 left-0 h-screen flex flex-col bg-gray-900 border-r border-gray-800 z-40 select-none"
    >
      {/* ── Brand ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-gray-800/80">
        <Shield size={20} className="text-orange-500" />
        <span className="text-xl font-bold tracking-tight text-orange-500">Admin</span>
      </div>

      {/* ── Navigation ───────────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5" aria-label="Admin navigation">
        <p className="px-1 pb-2 text-[10px] font-semibold uppercase tracking-widest text-gray-500">
          Management
        </p>
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          // /admin only matches exactly; sub-routes match startsWith so their
          // nested pages keep the parent entry active.
          const isActive =
            pathname === href || (href !== "/admin" && pathname.startsWith(`${href}/`));
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={[
                "flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium",
                "transition-colors duration-150 outline-none",
                "focus-visible:ring-2 focus-visible:ring-orange-500",
                isActive
                  ? "bg-orange-600/20 text-orange-400 border-l-2 border-orange-500 pl-[14px]"
                  : "text-gray-400 hover:text-white hover:bg-gray-800 border-l-2 border-transparent",
              ].join(" ")}
            >
              <Icon
                size={17}
                className={[
                  "flex-shrink-0 transition-colors duration-150",
                  isActive ? "text-orange-500" : "text-gray-500",
                ].join(" ")}
              />
              <span className="truncate">{label}</span>
            </Link>
          );
        })}

        {/* Coming-soon rows — visible in the menu, not yet routable */}
        {COMING_SOON.map(({ label, icon: Icon }) => (
          <div
            key={label}
            className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-600 border-l-2 border-transparent cursor-not-allowed select-none"
          >
            <Icon size={17} className="flex-shrink-0 text-gray-700" />
            <span className="truncate">{label}</span>
            <span className="ml-auto text-[9px] font-semibold uppercase tracking-wider text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded">
              Soon
            </span>
          </div>
        ))}
      </nav>

      {/* ── Bottom — leave admin ─────────────────────────────────────────── */}
      <div className="border-t border-gray-800/80 p-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-colors duration-150"
        >
          <ArrowLeft size={16} className="flex-shrink-0" />
          Go to App
        </Link>
      </div>
    </aside>
  );
}
