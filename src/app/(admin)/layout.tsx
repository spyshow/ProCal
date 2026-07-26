import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import Link from "next/link";
import { Shield } from "lucide-react";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/");

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800 bg-gray-900/60 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield size={18} className="text-orange-500" />
          <span className="font-semibold text-sm text-gray-200">Admin</span>
        </div>
        <Link href="/dashboard" className="text-xs text-gray-400 hover:text-gray-200 transition-colors">
          ← Back to Dashboard
        </Link>
      </header>
      <main>{children}</main>
    </div>
  );
}
