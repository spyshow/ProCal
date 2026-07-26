import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import AdminSidebar from "@/components/AdminSidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/");

  return (
    <div className="flex h-screen overflow-hidden print:h-auto print:overflow-visible">
      <div className="print:hidden flex-shrink-0">
        <AdminSidebar />
      </div>
      <main className="flex-1 overflow-y-auto bg-gray-950 print:overflow-visible print:w-full print:h-auto print:m-0 md:ml-[240px]">
        {children}
      </main>
    </div>
  );
}
