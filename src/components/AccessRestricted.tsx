"use client";

import React from "react";
import Link from "next/link";
import { Lock, ArrowLeft, ShieldAlert } from "lucide-react";
import { useTranslation } from "@/i18n";

interface AccessRestrictedProps {
  pageTitle?: string;
}

export function AccessRestricted({ pageTitle }: AccessRestrictedProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4 shadow-[0_0_20px_rgba(245,158,11,0.15)]">
        <Lock size={32} />
      </div>

      <h2 className="text-xl font-bold text-white mb-2">
        {t("rbac.accessRestricted", "Access Restricted")}
      </h2>

      <p className="text-sm text-slate-400 max-w-md mb-6 leading-relaxed">
        {t("rbac.accessRestrictedDesc", "You do not have permission to view or edit this module in the active project. Please contact your Project Manager to request access.")}
      </p>

      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
        >
          <ArrowLeft size={14} />
          {t("rbac.backToDashboard", "Back to Dashboard")}
        </Link>
      </div>
    </div>
  );
}
