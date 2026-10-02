import type { Language } from '../types';

/**
 * Category names, in the interface language.
 *
 * Categories are free text a user typed into `inventory_items.category` /
 * `product_catalog.category`, so the column holds English values — "Groceries",
 * "Dairy & Cheese" and the eight others. Every screen rendered the raw value, so
 * an Arabic page showed an English word in the table, the filter dropdown, the
 * item card, the analytics legend and the audit sheet.
 *
 * Categories are not normalised in the database (unlike units, which
 * `phase8_product_integrity.sql` rewrote) because they are a grouping key the
 * OMS import and the catalogue matching also rely on, and rewriting 731 rows
 * would mean rewriting them again for every integration. So the translation
 * happens at display time, exactly like `formatUnit`.
 */
export const CATEGORY_TRANSLATIONS: Record<string, { en: string; ar: string }> = {
  groceries: { en: 'Groceries', ar: 'بقالة' },
  packaging: { en: 'Packaging', ar: 'تغليف' },
  'dairy & cheese': { en: 'Dairy & Cheese', ar: 'ألبان وأجبان' },
  'bakery & dough': { en: 'Bakery & Dough', ar: 'مخبوزات وعجائن' },
  'spices & condiments': { en: 'Spices & Condiments', ar: 'بهارات وتوابل' },
  beverages: { en: 'Beverages', ar: 'مشروبات' },
  'restaurant supplies': { en: 'Restaurant Supplies', ar: 'مستلزمات المطعم' },
  'meat & poultry': { en: 'Meat & Poultry', ar: 'لحوم ودواجن' },
  produce: { en: 'Produce', ar: 'خضار وفواكه' },
  'cleaning supplies': { en: 'Cleaning Supplies', ar: 'مواد تنظيف' },
};

/**
 * Single words, so a category nobody has entered yet ("Frozen Foods") still
 * reads in Arabic instead of leaking English into an otherwise Arabic page.
 */
const CATEGORY_WORDS: Record<string, string> = {
  grocery: 'بقالة',
  groceries: 'بقالة',
  packaging: 'تغليف',
  dairy: 'ألبان',
  cheese: 'أجبان',
  bakery: 'مخبوزات',
  dough: 'عجائن',
  bread: 'خبز',
  spices: 'بهارات',
  condiments: 'توابل',
  beverage: 'مشروبات',
  beverages: 'مشروبات',
  drinks: 'مشروبات',
  restaurant: 'مطعم',
  supplies: 'مستلزمات',
  supply: 'مستلزمات',
  equipment: 'معدات',
  tools: 'أدوات',
  meat: 'لحوم',
  poultry: 'دواجن',
  chicken: 'دواجن',
  fish: 'أسماك',
  seafood: 'أسماك',
  produce: 'خضار وفواكه',
  vegetables: 'خضار',
  fruits: 'فواكه',
  cleaning: 'تنظيف',
  hygiene: 'نظافة',
  frozen: 'مجمدات',
  canned: 'معلبات',
  foods: 'أغذية',
  food: 'أغذية',
  stationery: 'قرطاسية',
  paper: 'ورق',
  other: 'أخرى',
  general: 'عام',
  '&': 'و',
};

const normalize = (value: string): string => value.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Translates a category for display. Unknown categories are translated word by
 * word when every word is known; otherwise the original string is returned, so
 * an unrecognised category is never silently mangled.
 */
export const formatCategory = (
  category: string | undefined | null,
  language: Language = 'en'
): string => {
  if (!category) return '';
  if (language !== 'ar') return category;

  const normalized = normalize(category);
  const exact = CATEGORY_TRANSLATIONS[normalized];
  if (exact) return exact.ar;

  const words = normalized.split(' ');
  const translated = words.map((word) => CATEGORY_WORDS[word]);
  if (translated.every(Boolean)) return translated.join(' ');

  return category;
};

/**
 * Whether a category matches a search term, in either language — so searching
 * "بقالة" finds Groceries and searching "grocer" still does too.
 */
export const categoryMatches = (category: string | undefined | null, term: string): boolean => {
  if (!category) return false;
  const query = normalize(term);
  if (!query) return true;
  return (
    normalize(category).includes(query) ||
    normalize(formatCategory(category, 'ar')).includes(query)
  );
};

/**
 * The canonical (English, database) value for an option a user picked from a
 * translated list. Keeps the column English while the picker is Arabic.
 */
export const categoryValue = (label: string, categories: string[]): string => {
  const query = normalize(label);
  const found = categories.find(
    (category) => normalize(category) === query || normalize(formatCategory(category, 'ar')) === query
  );
  return found ?? label;
};
