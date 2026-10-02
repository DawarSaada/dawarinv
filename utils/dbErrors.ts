import { Language } from '../types';

/**
 * Postgres errors, in the user's language.
 *
 * Every mutation used to hand `error.message` straight to a toast, so vendor text
 * reached the screen. The one that prompted this was:
 *
 *   duplicate key value violates unique constraint "inventory_items_location_name_en_ci"
 *
 * which tells a warehouse manager nothing, and hides the only useful fact — the
 * product is already on that shelf, spelled slightly differently.
 *
 * The mapping is deliberately narrow: only shapes we have actually seen are
 * translated, and anything else falls through to the original message, so a new
 * failure is never silently swallowed behind a friendly sentence.
 */

interface PostgresLike {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
}

const asRecord = (error: unknown): PostgresLike =>
  typeof error === 'object' && error !== null ? (error as PostgresLike) : { message: String(error ?? '') };

/** The case/whitespace-insensitive product-name indexes (phase8_product_integrity.sql). */
const NAME_UNIQUE_INDEXES = ['inventory_items_location_name_en_ci', 'inventory_items_location_name_ar_ci'];

/**
 * True when a write was refused because that location already holds a product
 * whose name matches once case and extra whitespace are ignored.
 *
 * Callers can pre-empt the refusal with this instead of catching it: finding the
 * existing row is almost always what the user meant to do.
 */
export const isDuplicateNameError = (error: unknown): boolean => {
  const { message = '', details = '', code } = asRecord(error);
  const haystack = `${message} ${details}`.toLowerCase();

  if (NAME_UNIQUE_INDEXES.some((index) => haystack.includes(index))) return true;
  // PostgREST sometimes reports the bare code without naming the index.
  return code === '23505' && haystack.includes('inventory_items');
};

export const databaseErrorMessage = (error: unknown, language: Language): string => {
  const { message = '', details = '', code } = asRecord(error);
  const haystack = `${message} ${details}`.toLowerCase();
  const isArabic = language === 'ar';

  if (isDuplicateNameError(error)) {
    return isArabic
      ? 'يوجد بالفعل صنف بالاسم نفسه في هذا الموقع. المقارنة تتجاهل حالة الأحرف والمسافات الزائدة، لذا عدّل الصنف الموجود بدلاً من إضافة صنف جديد.'
      : "That product is already on this location's shelf. The name check ignores letter case and extra spaces, so update the existing product instead of adding a second one.";
  }

  if (code === '23505' || haystack.includes('duplicate key value')) {
    return isArabic
      ? 'هذه القيمة مستخدمة بالفعل. عدّل السجل الموجود بدلاً من إنشاء سجل جديد.'
      : 'That value is already taken. Update the existing record instead of creating a new one.';
  }

  return message || (isArabic ? 'حدث خطأ غير متوقع. حاول مرة أخرى.' : 'Something went wrong. Please try again.');
};
