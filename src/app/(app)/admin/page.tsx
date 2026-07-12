'use client';

import Link from "next/link";
import { Shield, Database } from "lucide-react";

const ADMIN_LINKS = [
  {
    label: "Breaker Library",
    href: "/admin/breakers",
    icon: Database,
    description: "Manage breaker families, models, and bulk import manufacturer CSVs.",
  },
];

export default function AdminPage() {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Shield size={22} className="text-orange-500" />
          Admin
        </h1>
        <p className="text-sm text-gray-400 mt-1">Management tools for the ProCal catalog.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ADMIN_LINKS.map(({ label, href, icon: Icon, description }) => (
          <Link
            key={href}
            href={href}
            className="rounded-xl border border-gray-800 bg-gray-900/40 p-5 hover:border-orange-500/50 hover:bg-gray-800/40 transition-colors"
          >
            <div className="flex items-center gap-3 mb-2">
              <Icon size={20} className="text-orange-500" />
              <h2 className="text-base font-semibold text-gray-200">{label}</h2>
            </div>
            <p className="text-sm text-gray-500">{description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
