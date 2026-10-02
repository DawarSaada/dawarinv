import type { Language } from '../types';

export const UNIT_TRANSLATIONS: Record<string, { en: string; ar: string }> = {
  piece: { en: 'Piece', ar: 'قطعة' },
  pieces: { en: 'Pieces', ar: 'قطع' },
  pcs: { en: 'pcs', ar: 'قطعة' },
  bag: { en: 'Bag', ar: 'كيس' },
  bags: { en: 'Bags', ar: 'أكياس' },
  pack: { en: 'Pack', ar: 'باكيت' },
  packs: { en: 'Packs', ar: 'باكيت' },
  carton: { en: 'Carton', ar: 'كرتون' },
  cartons: { en: 'Cartons', ar: 'كراتين' },
  box: { en: 'Box', ar: 'صندوق' },
  boxes: { en: 'Boxes', ar: 'صناديق' },
  kg: { en: 'KG', ar: 'كغ' },
  liter: { en: 'Liter', ar: 'لتر' },
  liters: { en: 'Liters', ar: 'لتر' },
  bottle: { en: 'Bottle', ar: 'قارورة' },
  bottles: { en: 'Bottles', ar: 'قوارير' },
  can: { en: 'Can', ar: 'علبة' },
  cans: { en: 'Cans', ar: 'علب' },
  peace: { en: 'Piece', ar: 'قطعة' },
  // Two rows store a pack size in the unit column instead of a plain "Pack".
  // They are matched exactly, before the prefix loop below, so Arabic shows
  // "باكيت (600 غ)" rather than the raw English string.
  '1 pack (600g)': { en: '1 Pack (600g)', ar: 'باكيت (600 غ)' },
  '1 pack (900g)': { en: '1 Pack (900g)', ar: 'باكيت (900 غ)' },
};

/** Space-insensitive view of the map, so "1 pack (600 g)" and "1Pack(600G)" both hit. */
const normalizeUnit = (value: string): string => value.trim().toLowerCase().replace(/\s+/g, '');

const FLAT_UNIT_TRANSLATIONS: Record<string, { en: string; ar: string }> = Object.fromEntries(
  Object.entries(UNIT_TRANSLATIONS).map(([key, value]) => [normalizeUnit(key), value])
);

/**
 * Formats and translates a unit of measurement.
 * When language is 'ar', returns the corresponding Arabic unit term.
 * When language is 'en' or untranslated, returns the original unit string.
 */
export const formatUnit = (unit: string | undefined | null, language: Language = 'en'): string => {
  if (!unit) return '';
  if (language !== 'ar') return unit;

  const normalized = normalizeUnit(unit);
  const match = FLAT_UNIT_TRANSLATIONS[normalized];
  if (match) return match.ar;

  // Handle plural / compound patterns if any
  for (const [key, val] of Object.entries(FLAT_UNIT_TRANSLATIONS)) {
    if (normalized.startsWith(key)) {
      return val.ar;
    }
  }

  return unit;
};
