import Sidebar from '@/components/Sidebar';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden print:h-auto print:overflow-visible">
      <div className="print:hidden">
        <Sidebar />
      </div>
      <main className="flex-1 overflow-y-auto bg-gray-950 print:overflow-visible print:w-full print:h-auto print:m-0" style={{ marginLeft: '240px' }}>
        {children}
      </main>
    </div>
  );
}
