import type { Language, LocationData } from '../types';

/**
 * Renders an audit title in the interface language.
 *
 * The title is free text an administrator typed, so it is shown exactly as it
 * was written. Two parts of it, however, are produced by the app itself: the
 * recurrence marker ("(Week 2)", "(Month 3)") and — when several locations are
 * scheduled at once — the location name appended after a dash. Those used to be
 * written in English whatever the interface was, and because they are stored in
 * the row, an Arabic screen showed "جرد أسبوعي (Week 2) - Habuna".
 *
 * `ScheduleAuditModal` now writes those parts in the language of whoever raised
 * the audit, and this function translates them at display time in both
 * directions so the 30-odd rows that already exist read correctly too. It is
 * deliberately narrow: it only rewrites the two shapes the app generates, never
 * the words the user typed.
 */

const RECURRENCE_PATTERNS: { from: RegExp; to: string }[] = [
  { from: /\(Week\s+(\d+)\)/g, to: '(الأسبوع $1)' },
  { from: /\(Month\s+(\d+)\)/g, to: '(الشهر $1)' },
];

const RECURRENCE_PATTERNS_EN: { from: RegExp; to: string }[] = [
  { from: /\(الأسبوع\s+(\d+)\)/g, to: '(Week $1)' },
  { from: /\(الشهر\s+(\d+)\)/g, to: '(Month $1)' },
];

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Swaps a trailing " - <location>" suffix between the English and Arabic names. */
const translateLocationSuffix = (
  title: string,
  locations: LocationData[],
  language: Language
): string => {
  for (const location of locations) {
    const english = location.name;
    const arabic = location.nameAr || location.name;
    if (!english || !arabic || english === arabic) continue;

    const wanted = language === 'ar' ? arabic : english;
    const other = language === 'ar' ? english : arabic;
    const suffix = new RegExp(`(\\s-\\s)${escapeRegExp(other)}$`);
    if (suffix.test(title)) return title.replace(suffix, `$1${wanted}`);
  }
  return title;
};

/**
 * The label for an audit's status, in the interface language.
 *
 * The audit list and the audit PDF each had their own copy; the PDF's was
 * `status.toUpperCase()`, so an Arabic report read "PENDING_REVIEW".
 */
export const auditStatusLabel = (status: string, language: Language): string => {
  const labels: Record<string, [string, string]> = {
    scheduled: ['Scheduled', 'مجدول'],
    in_progress: ['In Progress', 'قيد الجرد'],
    pending_review: ['Pending Review', 'بانتظار المراجعة'],
    completed: ['Completed', 'مكتمل'],
    cancelled: ['Cancelled', 'ملغى'],
  };

  const entry = labels[status];
  if (entry) return language === 'ar' ? entry[1] : entry[0];
  return status
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

/**
 * What scheduling an audit does to the location being counted.
 *
 * The consequence is not obvious from the button, and it is not reversible from
 * the schedule screen: a scheduled audit for today (or an in-progress one) makes
 * `useAuditLock` refuse every write to that location — usages, item edits, bulk
 * edits, imports and *new* transfers — until the audit is completed and its
 * variances applied, or until the audit is deleted. The copy mirrors that rule,
 * so keep the two together when either changes.
 *
 * The last sentence is not a nicety: starting a count is refused while the
 * location has unresolved transfers, so if the lock also froze the buttons that
 * clear them, a location could neither finish its transfers nor begin its count.
 * An in-flight transfer is therefore still receivable or refusable — see the
 * callbacks in InventoryDashboard and useAuditLock's header.
 */
export const auditLockNotice = (language: Language): string =>
  language === 'ar'
    ? 'جدولة الجرد تقفل مخزون الموقع المستهدف: لن يُقبل أي استهلاك أو تعديل للأصناف أو استيراد أو طلب نقل جديد في ذلك الموقع حتى يُكتمل الجرد وتُعتمد فروقاته، أو يُحذف الجرد. النقل الجاري بالفعل يمكن استلامه أو رفضه حتى يبدأ الجرد.'
    : "Scheduling an audit locks the selected location's inventory: usages, item edits, imports and new transfer requests are refused there until the audit is completed and its variances are applied — or the audit is deleted. Transfers already in flight can still be received or refused so the count can begin.";

/** Shown next to a location that an existing audit is holding right now. */
export const auditLockedNotice = (language: Language, title: string): string =>
  language === 'ar'
    ? `هذا الموقع مقفل حالياً بجرد نشط: ${title}`
    : `This location is already locked by an active audit: ${title}`;

/** Short tag appended to a locked location in the picker. */
export const auditLockedBadge = (language: Language): string =>
  language === 'ar' ? 'مقفل حالياً' : 'locked now';

export const localizeAuditTitle = (
  title: string | null | undefined,
  language: Language,
  locations: LocationData[] = []
): string => {
  if (!title) return title ?? '';

  const patterns = language === 'ar' ? RECURRENCE_PATTERNS : RECURRENCE_PATTERNS_EN;
  let localized = title;
  for (const { from, to } of patterns) localized = localized.replace(from, to);
  return translateLocationSuffix(localized, locations, language);
};
