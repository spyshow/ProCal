'use client';

import { MotionIcon as BaseMotionIcon, type MotionIconProps } from 'motion-icons-react';

export type { MotionIconProps };

export function MotionIcon(props: MotionIconProps) {
  return <BaseMotionIcon {...props} />;
}
