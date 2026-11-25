'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/context/UserContext';
import { useProject } from '@/context/ProjectContext';

export interface UpgradeTrialProjectOptions {
  onUpgraded?: () => void | Promise<void>;
}

/**
 * Shared client hook to upgrade a Free Trial project to a full project using
 * 1 credit (or free for ADMINs), handling credit checks, confirmation prompts,
 * API mutation, and context refresh across TopHeader and Project Detail views.
 */
export function useUpgradeTrialProject(options?: UpgradeTrialProjectOptions) {
  const router = useRouter();
  const { user, refreshUser } = useUser();
  const { refreshProject } = useProject();
  const [upgrading, setUpgrading] = useState(false);

  const upgradeTrialProject = async (projectId: string): Promise<boolean> => {
    const credits = user?.credits ?? 0;
    const isAdmin = user?.role === 'ADMIN';
    if (credits < 1 && !isAdmin) {
      if (
        confirm(
          'You need 1 project credit to upgrade this Free Trial project.\n\nWould you like to go to the billing page to request or purchase credits?'
        )
      ) {
        router.push('/billing');
      }
      return false;
    }
    if (
      !confirm(
        'Upgrade this project to Full Project using 1 credit?\n\nThis will unlock unlimited buildings, unlimited floors, and remove all watermarks.'
      )
    ) {
      return false;
    }

    setUpgrading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/upgrade`, {
        method: 'POST',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Upgrade failed. Please try again.');
        return false;
      }
      await Promise.all([refreshUser(), refreshProject()]);
      await options?.onUpgraded?.();
      alert('Project successfully upgraded to Full Project!');
      return true;
    } catch (err) {
      console.error(err);
      alert('Unable to reach server. Please try again.');
      return false;
    } finally {
      setUpgrading(false);
    }
  };

  return { upgrading, upgradeTrialProject };
}
