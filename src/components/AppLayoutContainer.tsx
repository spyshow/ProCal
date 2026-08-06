'use client';

import React from 'react';
import { SidebarProvider, useSidebar } from '@/context/SidebarContext';
import Sidebar from '@/components/Sidebar';
import { OnboardingTour } from '@/components/OnboardingTour';

function LayoutInner({ children }: { children: React.ReactNode }) {
  const { isCollapsed } = useSidebar();

  return (
    <div className="flex h-screen overflow-hidden print:h-auto print:overflow-visible">
      <div className="print:hidden flex-shrink-0">
        <Sidebar />
      </div>
      <main
        className={`flex-1 overflow-y-auto bg-slate-950 print:overflow-visible print:w-full print:h-auto print:m-0 transition-all duration-200 ${
          isCollapsed ? 'md:ml-[64px]' : 'md:ml-[240px]'
        }`}
      >
        {children}
      </main>
      <OnboardingTour />
    </div>
  );
}

export function AppLayoutContainer({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <LayoutInner>{children}</LayoutInner>
    </SidebarProvider>
  );
}
