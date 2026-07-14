import React from 'react';
import { Audit, Language, UserRole } from '../../types';
import { TRANSLATIONS } from '../../constants';
import { X, AlertCircle, CheckCircle, ArrowRight } from 'lucide-react';

interface ReviewAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  audit: Audit | null;
  userRole: UserRole;
  onApplyAudit: (auditId: string) => void;
}

const ReviewAuditModal: React.FC<ReviewAuditModalProps> = ({
  isOpen, onClose, language, audit, userRole, onApplyAudit
}) => {
  const t = TRANSLATIONS[language];

  if (!isOpen || !audit) return null;

  const isAdmin = userRole === 'admin';
  const isPending = audit.status === 'pending_review';

  const itemsWithVariance = audit.items?.filter(i => (i.variance || 0) !== 0) || [];
  const itemsMatched = audit.items?.filter(i => i.variance === 0) || [];

  const handleApply = () => {
    if (window.confirm(language === 'ar' ? 'تحذير: سيؤدي هذا إلى إنشاء حركات تسوية لتحديث المخزون بشكل دائم لتطابق الجرد. هل أنت متأكد؟' : 'WARNING: This will generate adjustment transactions to permanently update inventory quantities to match the physical count. Are you sure?')) {
      onApplyAudit(audit.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        
        <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <AlertCircle className={`w-6 h-6 ${isPending ? 'text-yellow-500' : 'text-green-500'}`} />
              {language === 'ar' ? 'نتائج الجرد' : 'Audit Results'} - {audit.title}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {isPending 
                ? (language === 'ar' ? 'يرجى مراجعة التباينات قبل تطبيق التسويات' : 'Please review variances before applying adjustments')
                : (language === 'ar' ? 'تم تطبيق التسويات لهذا الجرد' : 'Adjustments have been applied for this audit')}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          
          {itemsWithVariance.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-orange-200 dark:border-orange-900/50 overflow-hidden">
              <div className="bg-orange-50 dark:bg-orange-900/20 p-4 border-b border-orange-200 dark:border-orange-900/50 flex justify-between items-center">
                <h3 className="font-bold text-orange-800 dark:text-orange-400">
                  {language === 'ar' ? 'عناصر غير متطابقة (تباين)' : 'Items with Variances'}
                </h3>
                <span className="bg-orange-200 text-orange-800 dark:bg-orange-800 dark:text-orange-200 text-xs font-bold px-2.5 py-1 rounded-full">
                  {itemsWithVariance.length}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse whitespace-nowrap min-w-[600px]">
                  <thead>
                    <tr className="bg-gray-50/50 dark:bg-gray-900/30 border-b border-gray-100 dark:border-gray-800 text-xs text-gray-500 uppercase tracking-wider">
                      <th className="p-3 font-medium">{language === 'ar' ? 'العنصر' : 'Item'}</th>
                      <th className="p-3 font-medium text-center">{language === 'ar' ? 'النظام' : 'System'}</th>
                      <th className="p-3 font-medium text-center"></th>
                      <th className="p-3 font-medium text-center">{language === 'ar' ? 'الفعلي' : 'Counted'}</th>
                      <th className="p-3 font-medium text-center">{language === 'ar' ? 'التباين' : 'Variance'}</th>
                      <th className="p-3 font-medium">{language === 'ar' ? 'ملاحظات' : 'Notes'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {itemsWithVariance.map(item => (
                      <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                        <td className="p-3 font-bold text-gray-900 dark:text-white">
                          {language === 'ar' ? item.itemNameAr : item.itemNameEn}
                        </td>
                        <td className="p-3 text-center text-gray-500">{item.expectedQuantity}</td>
                        <td className="p-3 text-center text-gray-300"><ArrowRight className="w-4 h-4 mx-auto" /></td>
                        <td className="p-3 text-center font-bold text-gray-900 dark:text-white">{item.countedQuantity}</td>
                        <td className="p-3 text-center">
                          <span className={`inline-block px-2 py-1 rounded font-bold text-sm ${item.variance! > 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                            {item.variance! > 0 ? '+' : ''}{item.variance}
                          </span>
                        </td>
                        <td className="p-3 text-sm text-gray-500 max-w-xs truncate" title={item.notes || ''}>
                          {item.notes || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {itemsMatched.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-green-200 dark:border-green-900/30 overflow-hidden">
              <div className="bg-green-50 dark:bg-green-900/10 p-4 border-b border-green-200 dark:border-green-900/30 flex justify-between items-center">
                <h3 className="font-bold text-green-800 dark:text-green-400 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  {language === 'ar' ? 'عناصر متطابقة' : 'Matched Items'}
                </h3>
                <span className="bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-200 text-xs font-bold px-2.5 py-1 rounded-full">
                  {itemsMatched.length}
                </span>
              </div>
              <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {itemsMatched.map(item => (
                  <div key={item.id} className="text-sm border border-gray-100 dark:border-gray-700 rounded-lg p-3">
                    <div className="font-bold text-gray-900 dark:text-white truncate" title={language === 'ar' ? item.itemNameAr : item.itemNameEn}>
                      {language === 'ar' ? item.itemNameAr : item.itemNameEn}
                    </div>
                    <div className="text-gray-500 text-xs mt-1">الكمية: {item.expectedQuantity}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 rounded-lg transition-colors font-medium">
            {isPending ? t.cancel : (language === 'ar' ? 'إغلاق' : 'Close')}
          </button>
          
          {isPending && isAdmin && (
            <button 
              onClick={handleApply}
              className="px-6 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors font-bold flex items-center gap-2 shadow-sm"
            >
              <CheckCircle className="w-5 h-5" />
              {language === 'ar' ? 'تطبيق التسويات (تحديث المخزون)' : 'Apply Adjustments'}
            </button>
          )}

          {isPending && !isAdmin && (
            <div className="px-4 py-2 text-sm text-yellow-700 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {language === 'ar' ? 'فقط المشرف يمكنه تطبيق التسويات' : 'Only Admins can apply adjustments'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReviewAuditModal;
