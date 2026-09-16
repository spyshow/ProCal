"use client";

import React from "react";
import { Eye, Shield } from "lucide-react";
import { useProject } from "@/context/ProjectContext";
import { useTranslation } from "@/i18n";

interface ReadOnlyBannerProps {
  pageKey: string;
}

export function ReadOnlyBanner({ pageKey }: ReadOnlyBannerProps) {
  const { isQA, canEdit } = useProject();
  const { t } = useTranslation();

  // If user can edit, do not show banner
  if (canEdit(pageKey)) return null;

  return (
    <div className="mb-4 flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs shadow-xs backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <Eye size={16} className="text-amber-700 dark:text-amber-400 shrink-0" />
        <div>
          <span className="font-semibold">
            {isQA ? t("rbac.qaModeNotice", "QA Review Mode (Read-Only)") : t("rbac.viewOnlyNotice", "View-Only Mode")}
          </span>
          <span className="text-amber-800/80 dark:text-amber-300/70 hidden sm:inline ml-1.5">
            — {isQA ? t("rbac.qaModeDesc", "QA Review mode active. Use floating button to post review notes.") : t("rbac.viewOnlyDesc", "Calculations and schedules are displayed in read-only mode. Edits are disabled.")}
          </span>
        </div>
      </div>
      <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-900 dark:text-amber-200 px-2 py-0.5 rounded border border-amber-500/40 shrink-0">
        {isQA ? t("team.roles.qa", "QA") : t("team.permView", "VIEW ONLY")}
      </span>
    </div>
  );
}
