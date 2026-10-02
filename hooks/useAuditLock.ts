import { useMemo } from 'react';
import { Audit } from '../types';
import { useAuditsQuery } from './useQueries';

/**
 * An audit locks its location's inventory while it is being counted.
 *
 * The rule lives here rather than inside the hook because more than one screen
 * needs it: the dashboard greys out its write actions (`useAuditLock`), and the
 * schedule dialog warns which locations are already locked and what choosing a
 * free one will do. Both reading the same predicate is what keeps the warning
 * honest.
 *
 * `admin` is the one role the lock does not stop — see `useAuditLock` — but that
 * bypass is a write permission, not a fact about the audit, so the list of
 * *locked* locations below deliberately ignores it.
 */
export const auditHoldsLocation = (audit: Audit): boolean => {
  if (audit.status === 'in_progress') return true;
  if (audit.status !== 'scheduled') return false;

  // Scheduled for today or earlier: the count is due, so the location is held.
  const today = new Date().toISOString().split('T')[0];
  if (!audit.scheduledDate) return true;
  return audit.scheduledDate <= today;
};

export interface AuditLock {
  locationId: string;
  title: string;
}

/** Every location currently held by an audit, with the audit holding it. */
export const auditLocks = (audits: Audit[] = []): AuditLock[] =>
  audits
    .filter(auditHoldsLocation)
    .map((audit) => ({ locationId: audit.locationId, title: audit.title }));

export const useAuditLock = (userRole?: string, locationId?: string) => {
  const { data: audits = [] } = useAuditsQuery();

  return useMemo(() => {
    // Admin bypasses the lock
    if (userRole === 'admin') {
      return { isInventoryLocked: false };
    }

    const activeLock = auditLocks(audits).find(
      (lock) => !locationId || lock.locationId === locationId
    );

    if (activeLock) {
      return {
        isInventoryLocked: true,
        lockedByAuditTitle: activeLock.title,
        lockedLocationId: activeLock.locationId,
      };
    }

    return { isInventoryLocked: false };
  }, [audits, userRole, locationId]);
};
