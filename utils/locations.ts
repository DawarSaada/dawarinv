import type { Language, LocationData } from '../types';

/**
 * The display name of a location, in the interface language.
 *
 * Location names are rows in the `locations` table (`useLocationsQuery`), not
 * constants, so every screen that renders one has to pick `name_ar` for Arabic.
 * Several read `location.name` only, which is why branch names like "Habuna" and
 * "Warehouse" appeared on Arabic pages.
 *
 * Falls back to the raw id when the location is unknown, so a stale id stays
 * visible instead of rendering as a blank cell.
 */
/**
 * The ledger does not only name locations: it also names the two non-locations a
 * movement can be recorded against. They are stored as English words in
 * `transactions.from_location` / `to_location`, so they need translating too —
 * otherwise an Arabic log shows "External Supplier" and "Consumed" forever.
 */
const SENTINEL_LABELS: Record<string, [string, string]> = {
  'External Supplier': ['External Supplier', 'مورد خارجي'],
  Consumed: ['Consumed', 'مستهلك'],
  unknown: ['Unknown', 'غير معروف'],
};

export const locationLabel = (
  locations: LocationData[] | null | undefined,
  id: string | null | undefined,
  language: Language
): string => {
  if (!id) return '';
  const location = (locations || []).find((entry) => entry.id === id);
  if (location) return language === 'ar' ? location.nameAr || location.name : location.name;

  const sentinel = SENTINEL_LABELS[id];
  if (sentinel) return language === 'ar' ? sentinel[1] : sentinel[0];

  return id;
};
