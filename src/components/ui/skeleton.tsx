import React from 'react';
import { cn } from '@/lib/utils';

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-slate-800/60', className)}
      {...props}
    />
  );
}

export function PageSkeleton({
  titleWidth = 'w-64',
  subtitleWidth = 'w-96',
  rowCount = 8,
}: {
  titleWidth?: string;
  subtitleWidth?: string;
  rowCount?: number;
}) {
  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto min-h-[80vh] animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className={`h-8 ${titleWidth}`} />
          <Skeleton className={`h-4 ${subtitleWidth}`} />
        </div>
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>

      {/* Building Tabs Skeleton */}
      <div className="flex items-center gap-2 border-b border-slate-800/80 pb-2">
        <Skeleton className="h-8 w-28 rounded-lg" />
        <Skeleton className="h-8 w-24 rounded-lg" />
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>

      {/* Actions / Setting Bar Skeleton */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/50 p-3.5 rounded-xl border border-slate-800/60">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-44 rounded-lg" />
          <Skeleton className="h-8 w-32 rounded-lg" />
        </div>
        <Skeleton className="h-8 w-28 rounded-lg" />
      </div>

      {/* Table Section Skeleton */}
      <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 overflow-hidden">
        <div className="h-11 bg-slate-800/60 border-b border-slate-800" />
        {Array.from({ length: rowCount }).map((_, i) => (
          <div
            key={i}
            className="h-12 border-b border-slate-800/40 flex items-center px-4 gap-4"
          >
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
