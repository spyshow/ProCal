import Sidebar from '@/components/Sidebar';
import { getSessionUser } from '@/lib/auth';
import { UserProvider } from '@/context/UserContext';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  return (
    <UserProvider user={user}>
      <div className="flex h-screen overflow-hidden print:h-auto print:overflow-visible">
        <div className="print:hidden flex-shrink-0">
          <Sidebar />
        </div>
        <main className="flex-1 overflow-y-auto bg-slate-950 print:overflow-visible print:w-full print:h-auto print:m-0 md:ml-[240px]">
          {children}
        </main>
      </div>
    </UserProvider>
  );
}
