import React, { useState } from 'react';
import { Language, LocationData, InventoryItem } from '../../types';
import { TRANSLATIONS } from '../../constants';
import { X, CalendarPlus } from 'lucide-react';

interface ScheduleAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  locations: LocationData[];
  inventory: Record<string, InventoryItem[]>;
  onSchedule: (params: any) => void;
  userName: string;
}

const ScheduleAuditModal: React.FC<ScheduleAuditModalProps> = ({
  isOpen, onClose, language, locations, inventory, onSchedule, userName
}) => {
  const t = TRANSLATIONS[language];
  const [title, setTitle] = useState('');
  const [locationId, setLocationId] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !locationId) return;

    // Fetch items currently in that location to snapshot for the audit
    const locationItems = inventory[locationId] || [];
    
    // Map them to AuditItem format
    const items = locationItems.map(item => ({
      itemId: item.id,
      itemNameEn: item.nameEn,
      itemNameAr: item.nameAr || item.nameEn,
      category: item.category,
      unit: item.unit,
      expectedQuantity: item.quantity
    }));

    if (items.length === 0) {
      alert(language === 'ar' ? 'هذا الموقع فارغ، لا يمكن جدولة جرد.' : 'This location has no items to audit.');
      return;
    }

    onSchedule({
      title,
      locationId,
      scheduledDate,
      createdBy: userName,
      items
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <CalendarPlus className="w-6 h-6 text-brand-500" />
            {language === 'ar' ? 'جدولة جرد' : 'Schedule Audit'}
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
              className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-brand-500 text-gray-900 dark:text-white"
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
              className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-brand-500 text-gray-900 dark:text-white"
            >
              <option value="">{language === 'ar' ? 'اختر الموقع...' : 'Select Location...'}</option>
              {locations.map(loc => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {language === 'ar' ? 'التاريخ المجدول (اختياري)' : 'Scheduled Date (Optional)'}
            </label>
            <input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-brand-500 text-gray-900 dark:text-white"
            />
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 dark:border-gray-700 mt-6">
            <button type="button" onClick={onClose} className="px-6 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 rounded-lg transition-colors font-medium">
              {t.cancel}
            </button>
            <button type="submit" className="px-6 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors font-medium">
              {language === 'ar' ? 'جدولة' : 'Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ScheduleAuditModal;
