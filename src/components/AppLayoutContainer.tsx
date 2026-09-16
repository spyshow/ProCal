'use client';

import React from 'react';
import { SidebarProvider, useSidebar } from '@/context/SidebarContext';
import { useTranslation } from '@/i18n';
import Sidebar from '@/components/Sidebar';
import { TopHeader } from '@/components/TopHeader';
import { OnboardingTour } from '@/components/OnboardingTour';
import { FeedbackFloatingButton } from '@/components/FeedbackFloatingButton';

function LayoutInner({ children }: { children: React.ReactNode }) {
  const { isCollapsed } = useSidebar();
  const { isRtl } = useTranslation();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div id="procal-app-root" className="flex h-screen overflow-hidden print:h-auto print:overflow-visible">
      <div className="print:hidden flex-shrink-0">
        <Sidebar />
      </div>
      <div
        className={`flex-1 flex flex-col min-w-0 h-screen overflow-hidden bg-[var(--background-color,#030712)] text-[var(--foreground-color,#f8fafc)] transition-colors duration-200 print:overflow-visible print:w-full print:h-auto print:m-0 ${
          mounted ? 'transition-[margin] duration-200' : ''
        } ${
          isRtl
            ? isCollapsed
              ? 'md:mr-[64px] md:ml-0'
              : 'md:mr-[240px] md:ml-0'
            : isCollapsed
            ? 'md:ml-[64px] md:mr-0'
            : 'md:ml-[240px] md:mr-0'
        }`}
      >
        <TopHeader />
        <main
          id="procal-main-content"
          className="flex-1 overflow-y-auto bg-[var(--background-color,#030712)] text-[var(--foreground-color,#f8fafc)] transition-colors duration-200 print:overflow-visible print:w-full print:h-auto print:m-0 custom-scrollbar"
        >
          {children}
        </main>
      </div>
      <OnboardingTour />
      <FeedbackFloatingButton />
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
