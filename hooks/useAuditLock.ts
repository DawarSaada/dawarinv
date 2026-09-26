import { useMemo } from 'react';
import { useAuditsQuery } from './useQueries';

export const useAuditLock = (userRole?: string, locationId?: string) => {
  const { data: audits = [] } = useAuditsQuery();

  return useMemo(() => {
    // Admin bypasses the lock
    if (userRole === 'admin') {
      return { isInventoryLocked: false };
    }

    // Lock: Find an audit that is in_progress, OR scheduled for today (or earlier)
    const today = new Date().toISOString().split('T')[0];
    const activeAudit = audits.find(a => {
      // ONLY check audits for the specific location if a locationId is provided
      if (locationId && a.locationId !== locationId) return false;
      
      if (a.status === 'in_progress') return true;
      if (a.status === 'scheduled') {
        // Lock if it's scheduled for today or earlier
        if (a.scheduledDate && a.scheduledDate <= today) return true;
        // If it has no scheduled date, lock immediately just in case
        if (!a.scheduledDate) return true;
      }
      return false;
    });

    if (activeAudit) {
      return {
        isInventoryLocked: true,
        lockedByAuditTitle: activeAudit.title,
        lockedLocationId: activeAudit.locationId
      };
    }

    return { isInventoryLocked: false };
  }, [audits, userRole, locationId]);
};
