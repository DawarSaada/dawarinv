import React, { useState, useEffect } from 'react';
import { Audit, Language } from '../../types';
import { TRANSLATIONS } from '../../constants';
import { X, Play, CheckCircle, Save } from 'lucide-react';

interface PerformAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  audit: Audit | null;
  onSaveCounts: (items: any[]) => void;
  onSubmitAudit: (auditId: string) => void;
}

const PerformAuditModal: React.FC<PerformAuditModalProps> = ({
  isOpen, onClose, language, audit, onSaveCounts, onSubmitAudit
}) => {
  const t = TRANSLATIONS[language];
  const [counts, setCounts] = useState<Record<string, { count: number | string, notes: string }>>({});

  useEffect(() => {
    if (audit && audit.items) {
      const initial: Record<string, { count: number | string, notes: string }> = {};
      audit.items.forEach(item => {
        initial[item.id] = {
          count: item.countedQuantity !== undefined ? item.countedQuantity : '',
          notes: item.notes || ''
        };
      });
      setCounts(initial);
    } else {
      setCounts({});
    }
  }, [audit, isOpen]);

  if (!isOpen || !audit) return null;

  const handleCountChange = (itemId: string, val: string) => {
    setCounts(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], count: val }
    }));
  };

  const handleNotesChange = (itemId: string, val: string) => {
    setCounts(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], notes: val }
    }));
  };

  const handleSave = () => {
    const itemsToSave = Object.entries(counts).map(([id, data]) => ({
      id,
      counted_quantity: data.count === '' ? null : Number(data.count),
      notes: data.notes
    }));
    onSaveCounts(itemsToSave);
  };

  const handleSubmit = () => {
    // Ensure all items have been counted
    const uncounted = Object.values(counts).filter(data => data.count === '');
    if (uncounted.length > 0) {
      alert(language === 'ar' ? 'يرجى إدخال الجرد لجميع العناصر قبل الإرسال للمراجعة.' : 'Please enter counts for all items before submitting for review.');
      return;
    }

    if (window.confirm(language === 'ar' ? 'هل أنت متأكد من إرسال هذا الجرد للمراجعة؟ لا يمكن تعديل الجرد بعد الإرسال.' : 'Are you sure you want to submit this audit for review? Counts cannot be changed after submission.')) {
      handleSave(); // Save final state just in case
      onSubmitAudit(audit.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <Play className="w-6 h-6 text-brand-500" />
              {language === 'ar' ? 'تنفيذ الجرد' : 'Perform Audit'} - {audit.title}
            </h2>
            <p className="text-sm text-gray-500 mt-1">{language === 'ar' ? 'أدخل الكمية الفعلية لكل عنصر' : 'Enter the actual physical count for each item'}</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800 text-sm text-gray-500 dark:text-gray-400">
                  <th className="p-4 font-medium">{language === 'ar' ? 'العنصر' : 'Item'}</th>
                  <th className="p-4 font-medium">{language === 'ar' ? 'الكمية المتوقعة' : 'Expected'}</th>
                  <th className="p-4 font-medium w-40">{language === 'ar' ? 'الكمية الفعلية' : 'Counted'}</th>
                  <th className="p-4 font-medium">{language === 'ar' ? 'ملاحظات (اختياري)' : 'Notes (Optional)'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {audit.items?.map(item => {
                  const currentCountStr = counts[item.id]?.count;
                  const currentCountNum = currentCountStr === '' ? undefined : Number(currentCountStr);
                  const isCounted = currentCountNum !== undefined;
                  const variance = isCounted ? currentCountNum! - item.expectedQuantity : null;
                  
                  return (
                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-gray-900 dark:text-white">
                          {language === 'ar' ? item.itemNameAr : item.itemNameEn}
                        </div>
                        <div className="text-xs text-gray-500">{item.category}</div>
                      </td>
                      <td className="p-4 text-gray-600 dark:text-gray-300">
                        {item.expectedQuantity} <span className="text-xs">{item.unit}</span>
                      </td>
                      <td className="p-4">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={currentCountStr !== undefined ? currentCountStr : ''}
                          onChange={(e) => handleCountChange(item.id, e.target.value)}
                          className={`w-full px-3 py-2 bg-white dark:bg-gray-900 border rounded-lg focus:ring-2 focus:ring-brand-500 font-bold ${
                            isCounted && variance !== 0 ? 'border-orange-300 text-orange-700 bg-orange-50 dark:border-orange-500/30 dark:bg-orange-900/20 dark:text-orange-400' 
                            : isCounted && variance === 0 ? 'border-green-300 text-green-700 bg-green-50 dark:border-green-500/30 dark:bg-green-900/20 dark:text-green-400' 
                            : 'border-gray-200 dark:border-gray-800'
                          }`}
                        />
                      </td>
                      <td className="p-4">
                        <input
                          type="text"
                          value={counts[item.id]?.notes || ''}
                          onChange={(e) => handleNotesChange(item.id, e.target.value)}
                          placeholder={language === 'ar' ? 'سبب التباين...' : 'Reason for variance...'}
                          className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg text-sm"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 flex justify-between items-center">
          <div className="text-sm text-gray-500">
            {language === 'ar' ? 'تم جرد' : 'Counted'}: {Object.values(counts).filter(c => c.count !== '').length} / {audit.items?.length || 0}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 rounded-lg transition-colors font-medium">
              {t.cancel}
            </button>
            <button 
              onClick={handleSave}
              className="px-4 py-2 bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 rounded-lg transition-colors font-medium flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {language === 'ar' ? 'حفظ مؤقت' : 'Save Draft'}
            </button>
            <button 
              onClick={handleSubmit}
              className="px-6 py-2 bg-brand-700 hover:bg-brand-800 text-white rounded-lg transition-colors font-bold flex items-center gap-2 shadow-sm"
            >
              <CheckCircle className="w-5 h-5" />
              {language === 'ar' ? 'إرسال للمراجعة' : 'Submit for Review'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerformAuditModal;
