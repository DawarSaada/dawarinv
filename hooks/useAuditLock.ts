import { useMemo } from 'react';
import { useAuditsQuery } from './useQueries';

export const useAuditLock = (userRole?: string) => {
  const { data: audits = [] } = useAuditsQuery();

  return useMemo(() => {
    // Admin bypasses the lock
    if (userRole === 'admin') {
      return { isInventoryLocked: false };
    }

    // Global Lock: Find ANY audit that is scheduled or in_progress
    const activeAudit = audits.find(a => a.status === 'scheduled' || a.status === 'in_progress');

    if (activeAudit) {
      return {
        isInventoryLocked: true,
        lockedByAuditTitle: activeAudit.title,
        lockedLocationId: activeAudit.locationId
      };
    }

    return { isInventoryLocked: false };
  }, [audits, userRole]);
};
