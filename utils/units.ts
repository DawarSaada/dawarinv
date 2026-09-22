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
};

/**
 * Formats and translates a unit of measurement.
 * When language is 'ar', returns the corresponding Arabic unit term.
 * When language is 'en' or untranslated, returns the original unit string.
 */
export const formatUnit = (unit: string | undefined | null, language: Language = 'en'): string => {
  if (!unit) return '';
  if (language !== 'ar') return unit;

  const normalized = unit.trim().toLowerCase();
  const match = UNIT_TRANSLATIONS[normalized];
  if (match) return match.ar;

  // Handle plural / compound patterns if any
  for (const [key, val] of Object.entries(UNIT_TRANSLATIONS)) {
    if (normalized.startsWith(key)) {
      return val.ar;
    }
  }

  return unit;
};
