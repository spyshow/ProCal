'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n';

export interface BrandSloganProps {
  className?: string;
  prefixClassName?: string;
  solvedClassName?: string;
  forceEnglish?: boolean;
}

/**
 * ProCal official brand slogan:
 * Low-voltage Electrical design, Solved
 * Renders the prefix and the word Solved in an accent color.
 */
export function BrandSlogan({
  className = '',
  prefixClassName = 'text-slate-400',
  solvedClassName = 'text-orange-400 font-semibold',
  forceEnglish = false,
}: BrandSloganProps) {
  const { isRtl } = useTranslation();

  if (!forceEnglish && isRtl) {
    return (
      <span className={cn('inline-flex items-center gap-1 font-medium tracking-normal', className)}>
        <span className={prefixClassName}>تصميم كهربائي للجهد المنخفض،</span>
        <span className={solvedClassName}>محلول</span>
      </span>
    );
  }

  return (
    <span className={cn('inline-flex items-center gap-1 font-medium tracking-normal', className)}>
      <span className={prefixClassName}>Low-voltage Electrical design,</span>
      <span className={solvedClassName}>Solved</span>
    </span>
  );
}

export default BrandSlogan;