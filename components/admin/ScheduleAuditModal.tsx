import React, { useEffect, useState } from 'react';
import { Language, LocationData, InventoryItem } from '../../types';
import { TRANSLATIONS } from '../../constants';
import { X, CalendarPlus, Lock } from 'lucide-react';
import { locationLabel } from '../../utils/locations';
import { auditLockedNotice, auditLockNotice, auditLockedBadge } from '../../utils/auditText';

interface ScheduledLock {
  locationId: string;
  title: string;
}

interface ScheduleAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  /** Every location this user may audit — not just the ones they can write. */
  locations: LocationData[];
  /** Inventory keyed by location id; the counts snapshot is built from this. */
  inventory: Record<string, InventoryItem[]>;
  onSchedule: (params: any) => void;
  userName: string;
  /** Pre-selects the location the user was looking at when opening the dialog. */
  defaultLocationId?: string;
  /** Locations an active audit is currently holding, so the picker can say so. */
  lockedLocations?: ScheduledLock[];
}

const ScheduleAuditModal: React.FC<ScheduleAuditModalProps> = ({
  isOpen, onClose, language, locations, inventory, onSchedule, userName,
  defaultLocationId, lockedLocations = []
}) => {
  const t = TRANSLATIONS[language];
  const [title, setTitle] = useState('');
  const [locationId, setLocationId] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [recurrence, setRecurrence] = useState<'none'|'weekly'|'monthly'>('none');

  // The dialog stays mounted while it is closed, so without this it reopened
  // showing the previous entry — and the title it kept was already scheduled.
  useEffect(() => {
    if (!isOpen) return;
    setTitle('');
    setLocationId(defaultLocationId || '');
    setScheduledDate(new Date().toISOString().split('T')[0]);
    setRecurrence('none');
  }, [isOpen, defaultLocationId]);

  if (!isOpen) return null;

  const isAr = language === 'ar';

  /**
   * The generated parts of a title follow the interface language.
   *
   * They used to be hardcoded English ("Week 2") and to use the English location
   * name, and because the title is stored in the row, an Arabic screen showed
   * "جرد أسبوعي (Week 2) - Habuna". `localizeAuditTitle` still translates titles
   * that already exist.
   */
  const recurrenceUnit = recurrence === 'weekly'
    ? (isAr ? 'الأسبوع' : 'Week')
    : (isAr ? 'الشهر' : 'Month');
  const locationName = (loc: LocationData) => locationLabel(locations, loc.id, language);

  /** The audit holding this location right now, if any. */
  const lockOf = (id: string) => lockedLocations.find((lock) => lock.locationId === id);
  const selectedLock = locationId && locationId !== 'all' ? lockOf(locationId) : undefined;
  // "All locations" is worth flagging too when any of them is already locked.
  const anyLocked = lockedLocations.length > 0;
  const lockedSummary = lockedLocations
    .map((lock) => `${locationLabel(locations, lock.locationId, language)} — ${lock.title}`)
    .join(' · ');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !locationId) return;

    const baseDate = new Date(scheduledDate || new Date().toISOString().split('T')[0]);

    // Determine how many occurrences to create
    let occurrences = 1;
    if (recurrence === 'weekly') occurrences = 4; // next 4 weeks
    if (recurrence === 'monthly') occurrences = 6; // next 6 months

    // Determine which locations to audit
    const targetLocations = locationId === 'all' ? locations : locations.filter(l => l.id === locationId);

    if (targetLocations.length === 0) return;

    let totalSchedules = 0;

    targetLocations.forEach(loc => {
      const locationItems = inventory[loc.id] || [];
      const items = locationItems.map(item => ({
        itemId: item.id,
        itemNameEn: item.nameEn,
        itemNameAr: item.nameAr || item.nameEn,
        category: item.category,
        unit: item.unit,
        expectedQuantity: item.quantity
      }));

      if (items.length === 0) return; // Skip empty locations

      for (let i = 0; i < occurrences; i++) {
        const d = new Date(baseDate);
        if (recurrence === 'weekly') {
          d.setDate(d.getDate() + (i * 7));
        } else if (recurrence === 'monthly') {
          d.setMonth(d.getMonth() + i);
        }

        const recurrenceTitle = i === 0 ? title : `${title} (${recurrenceUnit} ${i+1})`;
        const finalTitle = locationId === 'all' ? `${recurrenceTitle} - ${locationName(loc)}` : recurrenceTitle;

        onSchedule({
          title: finalTitle,
          locationId: loc.id,
          scheduledDate: d.toISOString().split('T')[0],
          createdBy: userName,
          items
        });
        totalSchedules++;
      }
    });

    if (totalSchedules === 0) {
      alert(language === 'ar' ? 'المواقع المحددة فارغة.' : 'Selected locations have no items to audit.');
      return;
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 pb-4 pt-[max(env(safe-area-inset-top,1rem),1rem)] bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-full">
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <CalendarPlus className="w-6 h-6 text-brand-500" />
            {language === 'ar' ? 'جدولة جرد' : 'Schedule Audit'}
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {/* The consequence of this action, before it is taken rather than after
              a branch complains that nothing can be received. */}
          <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-900/20">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-200">
              {auditLockNotice(language)}
            </p>
          </div>

          {selectedLock && (
            <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-900/20">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
              <p className="text-xs leading-relaxed text-red-800 dark:text-red-200">
                {auditLockedNotice(language, selectedLock.title)}
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {language === 'ar' ? 'عنوان الجرد' : 'Audit Title'} *
            </label>
            <input
              required
              type="text"
              placeholder={language === 'ar' ? 'مثال: جرد الربع الأول' : 'e.g., Q1 Inventory Count'}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg focus:ring-2 focus:ring-brand-500 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {language === 'ar' ? 'الموقع' : 'Location'} *
            </label>
            <select
              required
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg focus:ring-2 focus:ring-brand-500 text-gray-900 dark:text-white"
            >
              <option value="">{language === 'ar' ? 'اختر الموقع...' : 'Select Location...'}</option>
              <option value="all" className="font-bold">
                {language === 'ar'
                  ? `جميع المواقع (${locations.length} مواقع)${anyLocked ? ' — بعضها مقفل حالياً' : ''}`
                  : `All Locations (${locations.length})${anyLocked ? ' — some locked now' : ''}`}
              </option>
              {locations.map(loc => {
                const lock = lockOf(loc.id);
                return (
                  <option key={loc.id} value={loc.id}>
                    {locationName(loc)}
                    {lock ? ` 🔒 (${auditLockedBadge(language)})` : ''}
                  </option>
                );
              })}
            </select>
            {/* A locked location is not a refusal: a future count is still a
                normal thing to schedule, so the picker explains instead of hides. */}
            {anyLocked && (
              <p className="mt-1.5 text-2xs text-gray-500 dark:text-gray-400">
                🔒 {lockedSummary}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {language === 'ar' ? 'التاريخ المجدول' : 'Scheduled Date'} {recurrence !== 'none' && '*'}
            </label>
            <input
              type="date"
              required={recurrence !== 'none'}
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg focus:ring-2 focus:ring-brand-500 text-gray-900 dark:text-white"
            />
            <p className="mt-1.5 text-2xs text-gray-500 dark:text-gray-400">
              {language === 'ar'
                ? 'القفل يبدأ في هذا التاريخ. الجرد المجدول لمستقبل بعيد لا يعطّل العمل اليوم.'
                : 'The lock starts on this date — a count scheduled for next month does not stop today’s work.'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {language === 'ar' ? 'تكرار الجرد' : 'Recurrence'}
            </label>
            <select
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value as any)}
              className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg focus:ring-2 focus:ring-brand-500 text-gray-900 dark:text-white"
            >
              <option value="none">{language === 'ar' ? 'مرة واحدة فقط' : 'One-time only'}</option>
              <option value="weekly">{language === 'ar' ? 'أسبوعياً (ينشئ 4 أسابيع قادمة)' : 'Weekly (generates next 4 weeks)'}</option>
              <option value="monthly">{language === 'ar' ? 'شهرياً (ينشئ 6 أشهر قادمة)' : 'Monthly (generates next 6 months)'}</option>
            </select>
            {recurrence !== 'none' && (
              <p className="mt-1.5 text-2xs text-gray-500 dark:text-gray-400">
                {language === 'ar'
                  ? `سيتم إنشاء ${recurrence === 'weekly' ? '4' : '6'} جرد، ويُقفل الموقع في كل موعد حتى إتمام ذلك الجرد.`
                  : `Creates ${recurrence === 'weekly' ? '4' : '6'} audits; the location locks on each date until that count is finished.`}
              </p>
            )}
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-gray-200 dark:border-gray-800 mt-6">
            <button type="button" onClick={onClose} className="px-6 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 rounded-lg transition-colors font-medium">
              {t.cancel}
            </button>
            <button type="submit" className="px-6 py-2 bg-brand-700 hover:bg-brand-800 text-white rounded-lg transition-colors font-medium">
              {language === 'ar' ? 'جدولة' : 'Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ScheduleAuditModal;
