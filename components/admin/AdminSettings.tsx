import React from 'react';
import { History, Save, Trash2 } from 'lucide-react';
import { Language } from '../../types';

interface AdminSettingsProps {
    retentionMonths: number;
    setRetentionMonths: (months: number) => void;
    onSaveSettings: () => void;
    onManualCleanUp: () => void;
    language: Language;
}

const AdminSettings: React.FC<AdminSettingsProps> = ({
    retentionMonths,
    setRetentionMonths,
    onSaveSettings,
    onManualCleanUp,
    language
}) => {
    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="mb-8">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{language === 'ar' ? 'الإعدادات' : 'Settings'}</h2>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{language === 'ar' ? 'إدارة إعدادات النظام' : 'Manage system settings'}</p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 max-w-2xl">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <History className="w-5 h-5 text-brand-500" />
                    {language === 'ar' ? 'الاحتفاظ بالبيانات' : 'Data Retention'}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                    {language === 'ar' 
                        ? 'حدد المدة التي تريد الاحتفاظ فيها بسجلات العمليات. سيتم حذف السجلات الأقدم من هذه المدة تلقائياً.' 
                        : 'Select how long you want to keep transaction logs. Logs older than this period will be deleted automatically.'}
                </p>

                <div className="flex flex-col sm:flex-row gap-4 items-end mb-6">
                    <div className="flex-1 w-full">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            {language === 'ar' ? 'مدة الاحتفاظ' : 'Retention Period'}
                        </label>
                        <select 
                            value={retentionMonths}
                            onChange={(e) => setRetentionMonths(parseInt(e.target.value, 10))}
                            className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                        >
                            <option value={0}>{language === 'ar' ? 'أبداً (الاحتفاظ بكل شيء)' : 'Never (Keep everything)'}</option>
                            <option value={1}>{language === 'ar' ? 'شهر واحد' : '1 Month'}</option>
                            <option value={3}>{language === 'ar' ? '3 أشهر' : '3 Months'}</option>
                            <option value={4}>{language === 'ar' ? '4 أشهر' : '4 Months'}</option>
                            <option value={6}>{language === 'ar' ? '6 أشهر' : '6 Months'}</option>
                            <option value={12}>{language === 'ar' ? '12 شهر' : '12 Months'}</option>
                        </select>
                    </div>
                    <button 
                        onClick={onSaveSettings}
                        className="w-full sm:w-auto px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                        <Save className="w-4 h-4" />
                        {language === 'ar' ? 'حفظ' : 'Save'}
                    </button>
                </div>

                <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-2">
                        {language === 'ar' ? 'تنظيف يدوي' : 'Manual Cleanup'}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                        {language === 'ar' 
                            ? 'يمكنك تشغيل عملية التنظيف الآن لحذف السجلات القديمة بناءً على الإعداد أعلاه.' 
                            : 'You can run the cleanup process now to delete old records based on the setting above.'}
                    </p>
                    <button 
                        onClick={onManualCleanUp}
                        disabled={retentionMonths === 0}
                        className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 font-medium rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Trash2 className="w-4 h-4" />
                        {language === 'ar' ? 'تنظيف الآن' : 'Clean Up Now'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AdminSettings;
