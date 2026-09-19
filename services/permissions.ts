import { User, UserRole, LocationData } from '../types';

/**
 * Branch-level access control — the single source of truth.
 *
 * The rules, as agreed:
 *   - `admin` may read and write every location.
 *   - everyone else has full access to their own branch and to any branch they
 *     were granted full access to, and **read-only** access to everything else.
 *   - `readOnlyBranches` always wins: a branch listed there is never writable for
 *     that user, even if their role would otherwise allow it.
 *
 * The grant model already exists in the data: `app_users.branch_code` is the home
 * branch, `accessible_branches` holds full grants, and a `"<branch>:read"` suffix
 * marks a read-only grant (see `useQueries.useUsersQuery` and
 * `hooks/useAuth.ts`, which write the suffix).
 *
 * This module deliberately has no dependencies beyond the types, because it is
 * used by hooks, dashboards and the admin screens alike.
 *
 * Note: this is a UX and integrity boundary, not a security boundary. Without
 * Supabase Auth a caller holding the anon key can still write through the REST
 * API, so enforcement here governs the app, not a determined attacker. See the
 * auth risk in PRODUCTION_AUDIT.md.
 */

export type Access = 'write' | 'read' | 'none';

/** Anything that can be asked about its access: a `User`, or dashboard props. */
export interface AccessSubject {
  role: UserRole;
  branchCode?: string;
  accessibleBranches?: string[];
  readOnlyBranches?: string[];
}

/** The locations managed centrally rather than as customer branches. */
export const CENTRAL_LOCATIONS = ['warehouse', 'mammal'] as const;
/** Sentinel used by the UI for the combined view. */
export const GLOBAL_LOCATION = 'all';

const list = (value?: string[]): string[] => (Array.isArray(value) ? value.filter(Boolean) : []);

export const isAdmin = (subject?: AccessSubject | null): boolean => subject?.role === 'admin';

/** True when the user was granted full control of this location by name. */
const isGrantedFull = (subject: AccessSubject, locationId: string): boolean =>
  list(subject.accessibleBranches).includes(locationId);

/** True when the user's home branch is this location, or they oversee it as a manager. */
const isHomeOrManaged = (subject: AccessSubject, locationId: string): boolean => {
  switch (subject.role) {
    case 'branch_manager':
      return subject.branchCode === locationId;
    case 'warehouse_manager':
      return (CENTRAL_LOCATIONS as readonly string[]).includes(locationId);
    case 'mammal_employee':
      return locationId === 'mammal';
    case 'admin':
      return true;
    default:
      return false;
  }
};

/**
 * Access level for one location.
 *
 * `'none'` means the location should not even be offered to this user.
 */
export const accessFor = (subject: AccessSubject | null | undefined, locationId: string): Access => {
  if (!subject || !locationId) return 'none';
  if (isAdmin(subject)) return 'write';

  // An explicit read-only grant beats every other rule below.
  const readOnly = list(subject.readOnlyBranches).includes(locationId);

  if (isHomeOrManaged(subject, locationId) || isGrantedFull(subject, locationId)) {
    return readOnly ? 'read' : 'write';
  }

  // Granted read-only access to someone else's branch.
  if (readOnly) return 'read';

  // Staff can always see the warehouse and mammal sites; a branch manager sees
  // other branches too, but only to look at them.
  if (subject.role === 'warehouse_manager' || subject.role === 'branch_manager') return 'read';

  return 'none';
};

export const canWriteLocation = (subject: AccessSubject | null | undefined, locationId: string): boolean =>
  accessFor(subject, locationId) === 'write';

export const canReadLocation = (subject: AccessSubject | null | undefined, locationId: string): boolean =>
  accessFor(subject, locationId) !== 'none';

/**
 * Putting a product on a branch's shelf is a branch operation, but only for
 * products that already exist in the catalogue.
 */
export const canAddCatalogItem = (subject: AccessSubject | null | undefined, locationId: string): boolean =>
  canWriteLocation(subject, locationId);

/**
 * Creating a *new product* is central: only an administrator may do it.
 *
 * Branches therefore cannot introduce products, which keeps the catalogue the
 * single list of what the business buys and sells. Cases that must bypass this
 * (receiving a purchase order for an unknown item) are handled server-side by
 * `receive_purchase_order`, which creates the row from the order itself.
 */
export const canCreateProduct = (subject: AccessSubject | null | undefined): boolean => isAdmin(subject);

/** Removing a product from a branch's shelf. Same rule as any other branch write. */
export const canDeleteItem = (subject: AccessSubject | null | undefined, locationId: string): boolean =>
  canWriteLocation(subject, locationId);

/** Whether the combined "all locations" view may be opened. */
export const canViewAllLocations = (subject?: AccessSubject | null): boolean =>
  isAdmin(subject) || subject?.role === 'warehouse_manager';

/** Locations the user may write to. Used for pickers and bulk actions. */
export const writableLocations = (subject: AccessSubject | null | undefined, locations: LocationData[]): string[] =>
  locations.filter((l) => canWriteLocation(subject, l.id)).map((l) => l.id);

/** Locations with the access level for each, for labelling read-only branches. */
export const locationsWithAccess = (
  subject: AccessSubject | null | undefined,
  locations: LocationData[]
): { location: LocationData; access: Access }[] =>
  locations
    .map((location) => ({ location, access: accessFor(subject, location.id) }))
    .filter((entry) => entry.access !== 'none');

/**
 * Guard for a mutation that touches one location.
 *
 * Returns `true` when the write is allowed. Callers should surface the returned
 * access level so the UI can explain a refusal rather than appearing to do nothing.
 */
export const mayWrite = (subject: AccessSubject | null | undefined, locationId: string): boolean =>
  canWriteLocation(subject, locationId);

/**
 * Admin dashboard sections that only an administrator may open.
 *
 * Hiding the nav button is not enough: the active section is also read from
 * `window.location.hash`, so `#users` used to open User Management for a warehouse
 * manager — who could then set their own role to admin. Tab access is therefore a
 * permission decision, checked here and asserted in `permissions-check.html`.
 */
export const ADMIN_ONLY_TABS = ['users', 'settings', 'catalog'] as const;

export const canOpenTab = (subject: AccessSubject | null | undefined, tab: string): boolean =>
  isAdmin(subject) || !(ADMIN_ONLY_TABS as readonly string[]).includes(tab);

/** Copy for a refused write, so callers do not each invent their own wording. */
export const readOnlyMessage = (language: 'en' | 'ar', locationName?: string): string =>
  language === 'ar'
    ? locationName
      ? `لديك صلاحية قراءة فقط على ${locationName}.`
      : 'لديك صلاحية قراءة فقط على هذا الموقع.'
    : locationName
      ? `You have read-only access to ${locationName}.`
      : 'You have read-only access to this location.';

/** Convenience for building an `AccessSubject` from a `User`. */
export const subjectFrom = (user: User | null | undefined): AccessSubject | null =>
  user
    ? {
        role: user.role,
        branchCode: user.branchCode,
        accessibleBranches: user.accessibleBranches,
        readOnlyBranches: user.readOnlyBranches,
      }
    : null;
