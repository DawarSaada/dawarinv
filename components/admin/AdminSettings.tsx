import React from 'react';
import { History, Save, Trash2, Pen, Camera, Clock, ArrowRightLeft } from 'lucide-react';
import { Language, TransferSettings } from '../../types';

interface AdminSettingsProps {
    retentionMonths: number;
    setRetentionMonths: (months: number) => void;
    onSaveSettings: () => void;
    onManualCleanUp: () => void;
    language: Language;
    transferSettings?: TransferSettings;
    onTransferSettingsChange?: (settings: TransferSettings) => void;
}

const AdminSettings: React.FC<AdminSettingsProps> = ({
    retentionMonths,
    setRetentionMonths,
    onSaveSettings,
    onManualCleanUp,
    language,
    transferSettings = { enableSignatureCapture: false, enablePhotoEvidence: false, enableAutoReject: false, autoRejectDays: 7 },
    onTransferSettingsChange
}) => {
    const t = {
        transferSettings: language === 'ar' ? 'إعدادات التحويل' : 'Transfer Settings',
        transferSettingsDesc: language === 'ar' ? 'تحكم في ميزات التحويل المتقدمة' : 'Control advanced transfer features',
        enableSignature: language === 'ar' ? 'طلب توقيع عند الاستلام' : 'Require Signature on Receipt',
        enableSignatureDesc: language === 'ar' ? 'يجب على مدير الفرع التوقيع رقمياً عند استلام التحويل' : 'Branch manager must sign digitally when receiving a transfer',
        enablePhoto: language === 'ar' ? 'السماح بإرفاق صور' : 'Allow Photo Evidence',
        enablePhotoDesc: language === 'ar' ? 'يمكن للمستلمين إرفاق صور للعناصر التالفة أو الناقصة' : 'Recipients can attach photos of damaged or missing items',
        enableAutoReject: language === 'ar' ? 'رفض تلقائي للتحويلات المعلقة' : 'Auto-Reject Pending Transfers',
        enableAutoRejectDesc: language === 'ar' ? 'رفض التحويلات التي لم يتم التصرف بها خلال المدة المحددة' : 'Reject transfers not acted upon within the specified time',
        autoRejectDays: language === 'ar' ? 'أيام قبل الرفض التلقائي' : 'Days before auto-reject',
        saved: language === 'ar' ? 'تم حفظ الإعدادات' : 'Settings saved',
    };

    const handleToggle = (key: keyof TransferSettings, value: any) => {
        if (onTransferSettingsChange) {
            onTransferSettingsChange({ ...transferSettings, [key]: value });
        }
    };

    const ToggleSwitch = ({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) => (
        <button
            onClick={() => onChange(!enabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${enabled ? 'bg-brand-600' : 'bg-gray-300 dark:bg-gray-600'}`}
        >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
    );

    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="mb-8">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{language === 'ar' ? 'الإعدادات' : 'Settings'}</h2>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{language === 'ar' ? 'إدارة إعدادات النظام' : 'Manage system settings'}</p>
            </div>

            {/* Data Retention Section */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 max-w-2xl mb-6">
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

            {/* Transfer Settings Section — NEW */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 max-w-2xl">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                    <ArrowRightLeft className="w-5 h-5 text-brand-500" />
                    {t.transferSettings}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{t.transferSettingsDesc}</p>

                <div className="space-y-5">
                    {/* Signature Capture Toggle */}
                    <div className="flex items-center justify-between gap-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
                        <div className="flex items-start gap-3 min-w-0">
                            <div className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg shrink-0 mt-0.5">
                                <Pen className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-bold text-gray-900 dark:text-white">{t.enableSignature}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t.enableSignatureDesc}</p>
                            </div>
                        </div>
                        <ToggleSwitch 
                            enabled={transferSettings.enableSignatureCapture} 
                            onChange={(v) => handleToggle('enableSignatureCapture', v)} 
                        />
                    </div>

                    {/* Photo Evidence Toggle */}
                    <div className="flex items-center justify-between gap-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
                        <div className="flex items-start gap-3 min-w-0">
                            <div className="p-2 bg-green-50 dark:bg-green-900/30 rounded-lg shrink-0 mt-0.5">
                                <Camera className="w-4 h-4 text-green-600 dark:text-green-400" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-bold text-gray-900 dark:text-white">{t.enablePhoto}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t.enablePhotoDesc}</p>
                            </div>
                        </div>
                        <ToggleSwitch 
                            enabled={transferSettings.enablePhotoEvidence} 
                            onChange={(v) => handleToggle('enablePhotoEvidence', v)} 
                        />
                    </div>

                    {/* Auto-Reject Timer Toggle */}
                    <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl space-y-3">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-start gap-3 min-w-0">
                                <div className="p-2 bg-orange-50 dark:bg-orange-900/30 rounded-lg shrink-0 mt-0.5">
                                    <Clock className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-bold text-gray-900 dark:text-white">{t.enableAutoReject}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t.enableAutoRejectDesc}</p>
                                </div>
                            </div>
                            <ToggleSwitch 
                                enabled={transferSettings.enableAutoReject} 
                                onChange={(v) => handleToggle('enableAutoReject', v)} 
                            />
                        </div>
                        {transferSettings.enableAutoReject && (
                            <div className="flex items-center gap-3 pl-11">
                                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">{t.autoRejectDays}:</label>
                                <input 
                                    type="number" 
                                    min="1" 
                                    max="90"
                                    value={transferSettings.autoRejectDays}
                                    onChange={(e) => handleToggle('autoRejectDays', Math.max(1, Math.min(90, parseInt(e.target.value, 10) || 7)))}
                                    className="w-20 px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500"
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminSettings;
