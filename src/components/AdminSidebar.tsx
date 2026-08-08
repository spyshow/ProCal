"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "@/i18n";
import { LanguageSelector } from "@/components/LanguageSelector";
import {
  LayoutDashboard,
  Users,
  Database,
  FolderOpen,
  CreditCard,
  Shield,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AdminNavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ElementType;
}

export default function AdminSidebar() {
  const pathname = usePathname();
  const { t, isRtl } = useTranslation();

  const navItems: AdminNavItem[] = [
    { id: "dashboard", label: t('nav.dashboard', 'Dashboard'), href: "/admin", icon: LayoutDashboard },
    { id: "users", label: "Users", href: "/admin/users", icon: Users },
    { id: "breakers", label: "Breaker Catalog", href: "/admin/breakers", icon: Database },
    { id: "leads", label: "Billing Leads", href: "/admin/leads", icon: CreditCard },
  ];

  return (
    <aside
      style={{ width: "240px" }}
      className={cn(
        "fixed top-0 h-screen flex flex-col bg-slate-950/95 backdrop-blur-xl z-40 select-none shadow-2xl transition-all duration-200",
        isRtl ? "right-0 border-l border-slate-800/80" : "left-0 border-r border-slate-800/80"
      )}
    >
      {/* Brand Header */}
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-slate-800/80">
        <div className="w-8 h-8 rounded-lg bg-orange-600/20 border border-orange-500/40 flex items-center justify-center text-orange-400 shadow-[0_0_12px_rgba(234,88,12,0.3)]">
          <Shield size={18} />
        </div>
        <span className="text-xl font-bold tracking-tight text-white">{t('nav.adminDashboard', 'Admin Portal')}</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5 custom-scrollbar" aria-label="Admin navigation">
        <p className="px-1 pb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          {t('common.actions', 'Management')}
        </p>
        {navItems.map(({ label, href, icon: Icon }) => {
          const isActive =
            pathname === href || (href !== "/admin" && pathname.startsWith(`${href}/`));
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-200 outline-none",
                isActive
                  ? isRtl
                    ? "bg-gradient-to-l from-orange-600/25 to-amber-600/10 text-orange-300 border-r-2 border-orange-500 shadow-[0_0_15px_rgba(234,88,12,0.15)] font-semibold"
                    : "bg-gradient-to-r from-orange-600/25 to-amber-600/10 text-orange-300 border-l-2 border-orange-500 shadow-[0_0_15px_rgba(234,88,12,0.15)] font-semibold"
                  : isRtl
                  ? "text-slate-400 hover:text-slate-100 hover:bg-slate-900/80 border-r-2 border-transparent"
                  : "text-slate-400 hover:text-slate-100 hover:bg-slate-900/80 border-l-2 border-transparent"
              )}
            >
              <Icon
                size={17}
                className={cn(
                  "flex-shrink-0 transition-colors duration-200",
                  isActive ? "text-orange-400" : "text-slate-500"
                )}
              />
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Language Selector and return to main app */}
      <div className="border-t border-slate-800/80 p-3 space-y-2">
        <LanguageSelector variant="compact" />
        <Link
          href="/dashboard"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-900/80 transition-colors duration-150"
        >
          {isRtl ? (
            <ArrowRight size={16} className="flex-shrink-0 text-orange-400" />
          ) : (
            <ArrowLeft size={16} className="flex-shrink-0 text-orange-400" />
          )}
          <span>{t('common.back', 'Back to Main App')}</span>
        </Link>
      </div>
    </aside>
  );
}

