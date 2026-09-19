import React, { useCallback, useEffect, useState } from 'react';
import {
    AlertTriangle,
    ArrowRightLeft,
    Camera,
    Check,
    Clock,
    Coins,
    History,
    Info,
    Pen,
    RefreshCw,
    Save,
    Server,
    ShieldCheck,
    Sparkles,
    Trash2,
    X,
} from 'lucide-react';
import { CURRENCIES } from '../../constants';
import { Language, SubscriptionDetails, TransferSettings } from '../../types';
import { getAiStatus, AiStatus } from '../../services/aiClient';
import { APP_VERSION } from '../../config';
import { useAppSettingsContext } from '../AppSettingsProvider';
import { useToast } from '../Toast';

/**
 * Administrator settings.
 *
 * Everything here is either a *business* setting — currency, transfer rules, data
 * retention — which is stored centrally and applies to every user, or a *report* about
 * the deployment (licence, AI wiring, version). Language and theme deliberately stay
 * per-browser: they are personal preferences, and forcing one on every member of staff
 * would be wrong.
 *
 * Until phase10_app_settings.sql is applied the business settings fall back to
 * localStorage, and this screen says so at the top rather than implying that staff will
 * receive them.
 */

interface AdminSettingsProps {
    retentionMonths: number;
    setRetentionMonths: (months: number) => void;
    onSaveSettings: () => void;
    onManualCleanUp: () => void;
    language: Language;
    transferSettings?: TransferSettings;
    onTransferSettingsChange?: (settings: TransferSettings) => void;
    subDetails?: SubscriptionDetails;
    /** Re-checks the licence against the billing provider immediately. */
    onRefreshSubscription?: () => void;
    /** False when this deployment has no central settings store yet. */
    settingsAreShared?: boolean;
    /** Recorded against whatever is saved, so a change can be traced to a person. */
    updatedBy?: string;
}

const Section: React.FC<{
    icon: React.ReactNode;
    title: string;
    description?: string;
    action?: React.ReactNode;
    children: React.ReactNode;
}> = ({ icon, title, description, action, children }) => (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
            <div className="flex items-start gap-3">
                <span className="rounded-lg bg-gray-100 p-2 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                    {icon}
                </span>
                <div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h3>
                    {description && (
                        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{description}</p>
                    )}
                </div>
            </div>
            {action}
        </header>
        <div className="px-5 py-4">{children}</div>
    </section>
);

const Row: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({
    label,
    hint,
    children,
}) => (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 py-3 last:border-0 dark:border-gray-800">
        <div className="min-w-0">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{label}</p>
            {hint && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
        </div>
        {children}
    </div>
);

const Toggle: React.FC<{ enabled: boolean; onChange: (value: boolean) => void; label: string }> = ({
    enabled,
    onChange,
    label,
}) => (
    <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={label}
        onClick={() => onChange(!enabled)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
            enabled ? 'bg-brand-600' : 'bg-gray-300 dark:bg-gray-600'
        }`}
    >
        <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
        />
    </button>
);

const AdminSettings: React.FC<AdminSettingsProps> = ({
    retentionMonths,
    setRetentionMonths,
    onSaveSettings,
    onManualCleanUp,
    language,
    transferSettings = {
        enableSignatureCapture: false,
        enablePhotoEvidence: false,
        enableAutoReject: false,
        autoRejectDays: 7,
    },
    onTransferSettingsChange,
    subDetails,
    onRefreshSubscription,
    settingsAreShared = true,
    updatedBy,
}) => {
    const isAr = language === 'ar';
    const { settings, save } = useAppSettingsContext();
    const { addToast } = useToast();
    const [savingCurrency, setSavingCurrency] = useState(false);

    const t = {
        transferSettings: isAr ? 'إعدادات التحويل' : 'Transfer Settings',
        transferSettingsDesc: isAr
            ? 'قواعد تنطبق على كل عمليات التحويل بين المواقع'
            : 'Rules applied to every transfer between locations',
        enableSignature: isAr ? 'طلب توقيع عند الاستلام' : 'Require Signature on Receipt',
        enableSignatureDesc: isAr
            ? 'يجب على المستلم التوقيع رقمياً عند استلام التحويل'
            : 'The recipient must sign digitally when receiving a transfer',
        enablePhoto: isAr ? 'السماح بإرفاق صور' : 'Allow Photo Evidence',
        enablePhotoDesc: isAr
            ? 'يمكن للمستلمين إرفاق صور للعناصر التالفة أو الناقصة'
            : 'Recipients can attach photos of damaged or missing items',
        enableAutoReject: isAr ? 'رفض تلقائي للتحويلات المعلقة' : 'Auto-Reject Pending Transfers',
        enableAutoRejectDesc: isAr
            ? 'رفض التحويلات التي لم يتم التصرف بها خلال المدة المحددة'
            : 'Reject transfers not acted upon within the specified time',
        autoRejectDays: isAr ? 'عدد الأيام قبل الرفض التلقائي' : 'Days before auto-reject',
    };

    // Read-only probe of the `ai-assistant` edge function, so an admin can confirm AI
    // is wired up without shell access to the project secrets.
    const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);
    const [aiChecking, setAiChecking] = useState(true);

    const checkAiStatus = useCallback(async () => {
        setAiChecking(true);
        setAiStatus(await getAiStatus());
        setAiChecking(false);
    }, []);

    useEffect(() => {
        void checkAiStatus();
    }, [checkAiStatus]);

    const handleTransferToggle = (key: keyof TransferSettings, value: TransferSettings[keyof TransferSettings]) => {
        onTransferSettingsChange?.({ ...transferSettings, [key]: value });
    };

    const handleCurrencyChange = async (code: string) => {
        setSavingCurrency(true);
        try {
            await save({ currency: code as (typeof CURRENCIES)[number]['code'] }, { updatedBy });
            addToast(
                'success',
                isAr ? 'تم تحديث العملة لجميع المستخدمين' : 'Currency updated for all users'
            );
        } catch (error) {
            addToast('error', error instanceof Error ? error.message : String(error));
        } finally {
            setSavingCurrency(false);
        }
    };

    /**
     * Licence health, derived from the enforcement state rather than the raw string.
     *
     * The previous check was `status.includes('active')`, which is true for `inactive`
     * as well as `active` — so a lapsed subscription was shown in green.
     */
    const licence = (() => {
        const state = subDetails?.state;
        const status = (subDetails?.status ?? '').toLowerCase();
        const isActive = state === 'active' || (!state && status === 'active');
        const expiryDate = subDetails?.expiry ? new Date(subDetails.expiry) : null;
        const daysLeft =
            expiryDate && !Number.isNaN(expiryDate.getTime())
                ? Math.ceil((expiryDate.getTime() - Date.now()) / 86_400_000)
                : null;

        return {
            isActive,
            daysLeft,
            expiringSoon: isActive && daysLeft !== null && daysLeft <= 30,
            statusText:
                subDetails?.state === 'unverifiable'
                    ? isAr
                        ? 'تعذّر التحقق'
                        : 'Unverified'
                    : subDetails?.status || subDetails?.reason || 'unknown',
        };
    })();

    const formatDate = (value: string | null | undefined, withTime = false) => {
        if (!value) return null;
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return value;
        return date.toLocaleString(isAr ? 'ar-SA-u-ca-gregory' : 'en-GB',
            withTime
                ? { dateStyle: 'medium', timeStyle: 'short' }
                : { dateStyle: 'medium' });
    };

    return (
        <div className="animate-fade-in space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 className="text-lg font-semibold tracking-tight text-gray-900 sm:text-xl dark:text-white">
                        {isAr ? 'الإعدادات' : 'Settings'}
                    </h2>
                    <p className="mt-0.5 text-xs text-gray-500 sm:text-sm dark:text-gray-400">
                        {isAr
                            ? 'إعدادات النظام التي تنطبق على جميع المستخدمين والمواقع'
                            : 'System settings that apply to every user and location'}
                    </p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 dark:border-gray-700 dark:text-gray-300">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {isAr ? 'للمسؤول فقط' : 'Administrator only'}
                </span>
            </div>

            {!settingsAreShared && (
                <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-900/20">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
                    <div className="text-sm text-amber-800 dark:text-amber-300">
                        <p className="font-medium">
                            {isAr
                                ? 'هذه الإعدادات محفوظة في هذا المتصفح فقط.'
                                : 'These settings are stored in this browser only.'}
                        </p>
                        <p className="mt-1">
                            {isAr
                                ? 'طبّق phase10_app_settings.sql ليستلمها كل مستخدم على كل جهاز.'
                                : 'Apply phase10_app_settings.sql so every user on every device receives them.'}
                        </p>
                    </div>
                </div>
            )}

            {/* ---------------------------------------------------------------- */}
            {/* Licence                                                          */}
            {/* ---------------------------------------------------------------- */}
            <Section
                icon={<History className="h-5 w-5" />}
                title={isAr ? 'حالة الاشتراك' : 'Subscription'}
                description={isAr ? 'ترخيص تشغيل النظام' : 'The licence this system runs on'}
                action={
                    onRefreshSubscription && (
                        <button
                            type="button"
                            onClick={onRefreshSubscription}
                            className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                        >
                            <RefreshCw className="h-3.5 w-3.5" />
                            {isAr ? 'تحديث' : 'Check now'}
                        </button>
                    )
                }
            >
                <Row label={isAr ? 'الحالة' : 'Status'}>
                    <span
                        className={`text-sm font-bold uppercase ${
                            licence.isActive
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-red-600 dark:text-red-400'
                        }`}
                    >
                        {licence.statusText}
                    </span>
                </Row>
                <Row label={isAr ? 'تاريخ الانتهاء' : 'Expiry date'}>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        {formatDate(subDetails?.expiry) ?? (isAr ? 'غير متوفر' : 'N/A')}
                    </span>
                </Row>
                <Row label={isAr ? 'المتبقي' : 'Remaining'}>
                    <span
                        className={`text-sm font-semibold ${
                            licence.daysLeft !== null && licence.daysLeft <= 0
                                ? 'text-red-600 dark:text-red-400'
                                : licence.expiringSoon
                                    ? 'text-amber-600 dark:text-amber-400'
                                    : 'text-gray-900 dark:text-white'
                        }`}
                    >
                        {licence.daysLeft === null
                            ? isAr
                                ? 'غير محدد'
                                : 'Not set'
                            : licence.daysLeft <= 0
                                ? isAr
                                    ? 'منتهي'
                                    : 'Expired'
                                : isAr
                                    ? `${licence.daysLeft} يوم`
                                    : `${licence.daysLeft} days`}
                    </span>
                </Row>
                <Row
                    label={isAr ? 'آخر تحقق' : 'Last checked'}
                    hint={
                        subDetails?.checkedAt
                            ? `${formatDate(subDetails.checkedAt, true)}`
                            : isAr
                                ? 'لم يتم التحقق بعد'
                                : 'Not checked yet'
                    }
                >
                    <span />
                </Row>

                {!licence.isActive && (
                    <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
                        {isAr
                            ? 'الاشتراك غير نشط: التطبيق موقوف لجميع المستخدمين حتى يتم التجديد.'
                            : 'The subscription is not active: the application is stopped for every user until it is renewed.'}
                    </p>
                )}
                {licence.expiringSoon && licence.daysLeft !== null && licence.daysLeft > 0 && (
                    <p className="mt-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        {isAr
                            ? `ينتهي الاشتراك خلال ${licence.daysLeft} يوم. التطبيق سيتوقف تلقائياً عندها.`
                            : `The subscription ends in ${licence.daysLeft} days. The application will stop automatically at that point.`}
                    </p>
                )}
            </Section>

            {/* ---------------------------------------------------------------- */}
            {/* Business: currency and retention                                 */}
            {/* ---------------------------------------------------------------- */}
            <Section
                icon={<Coins className="h-5 w-5" />}
                title={isAr ? 'إعدادات العمل' : 'Business'}
                description={isAr ? 'العملة ومدة الاحتفاظ بالسجلات' : 'Currency and how long records are kept'}
            >
                <Row
                    label={isAr ? 'العملة' : 'Currency'}
                    hint={
                        isAr
                            ? 'تُستخدم في أوامر الشراء والتقارير المصدّرة'
                            : 'Used in purchase orders and exported reports'
                    }
                >
                    <select
                        value={settings.currency}
                        disabled={savingCurrency}
                        onChange={(e) => void handleCurrencyChange(e.target.value)}
                        className="min-w-40 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                    >
                        {CURRENCIES.map((currency) => (
                            <option key={currency.code} value={currency.code}>
                                {currency.code} — {isAr ? currency.nameAr : currency.nameEn}
                            </option>
                        ))}
                    </select>
                </Row>

                <Row
                    label={isAr ? 'مدة الاحتفاظ بالسجلات' : 'Transaction retention'}
                    hint={
                        isAr
                            ? 'تُحذف السجلات الأقدم من هذه المدة تلقائياً عند دخول المسؤول'
                            : 'Logs older than this are deleted automatically when an administrator signs in'
                    }
                >
                    <div className="flex items-center gap-2">
                        <select
                            value={retentionMonths}
                            onChange={(e) => setRetentionMonths(parseInt(e.target.value, 10))}
                            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                        >
                            <option value={0}>{isAr ? 'أبداً (الاحتفاظ بكل شيء)' : 'Never (keep everything)'}</option>
                            <option value={1}>{isAr ? 'شهر واحد' : '1 month'}</option>
                            <option value={3}>{isAr ? '3 أشهر' : '3 months'}</option>
                            <option value={4}>{isAr ? '4 أشهر' : '4 months'}</option>
                            <option value={6}>{isAr ? '6 أشهر' : '6 months'}</option>
                            <option value={12}>{isAr ? '12 شهر' : '12 months'}</option>
                        </select>
                        <button
                            type="button"
                            onClick={onSaveSettings}
                            className="inline-flex items-center gap-2 rounded-lg bg-brand-700 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-800"
                        >
                            <Save className="h-4 w-4" />
                            {isAr ? 'حفظ' : 'Save'}
                        </button>
                    </div>
                </Row>

                <Row
                    label={isAr ? 'تنظيف يدوي' : 'Manual cleanup'}
                    hint={
                        retentionMonths === 0
                            ? isAr
                                ? 'اختر مدة احتفاظ أولاً — لا يوجد حذف تلقائي الآن'
                                : 'Choose a retention period first — nothing is deleted automatically right now'
                            : isAr
                                ? `سيتم حذف كل ما هو أقدم من ${retentionMonths} شهر`
                                : `Everything older than ${retentionMonths} month(s) will be deleted`
                    }
                >
                    <button
                        type="button"
                        onClick={onManualCleanUp}
                        disabled={retentionMonths === 0}
                        className="inline-flex items-center gap-2 rounded-lg bg-red-50 px-3.5 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
                    >
                        <Trash2 className="h-4 w-4" />
                        {isAr ? 'تنظيف الآن' : 'Clean up now'}
                    </button>
                </Row>
            </Section>

            {/* ---------------------------------------------------------------- */}
            {/* Transfers                                                        */}
            {/* ---------------------------------------------------------------- */}
            <Section
                icon={<ArrowRightLeft className="h-5 w-5" />}
                title={t.transferSettings}
                description={t.transferSettingsDesc}
            >
                <Row label={t.enableSignature} hint={t.enableSignatureDesc}>
                    <div className="flex items-center gap-3">
                        <Pen className="h-4 w-4 text-purple-500" />
                        <Toggle
                            label={t.enableSignature}
                            enabled={transferSettings.enableSignatureCapture}
                            onChange={(v) => handleTransferToggle('enableSignatureCapture', v)}
                        />
                    </div>
                </Row>
                <Row label={t.enablePhoto} hint={t.enablePhotoDesc}>
                    <div className="flex items-center gap-3">
                        <Camera className="h-4 w-4 text-green-600 dark:text-green-400" />
                        <Toggle
                            label={t.enablePhoto}
                            enabled={transferSettings.enablePhotoEvidence}
                            onChange={(v) => handleTransferToggle('enablePhotoEvidence', v)}
                        />
                    </div>
                </Row>
                <Row label={t.enableAutoReject} hint={t.enableAutoRejectDesc}>
                    <div className="flex items-center gap-3">
                        <Clock className="h-4 w-4 text-orange-500" />
                        <Toggle
                            label={t.enableAutoReject}
                            enabled={transferSettings.enableAutoReject}
                            onChange={(v) => handleTransferToggle('enableAutoReject', v)}
                        />
                    </div>
                </Row>
                {transferSettings.enableAutoReject && (
                    <Row label={t.autoRejectDays}>
                        <input
                            type="number"
                            min={1}
                            max={90}
                            value={transferSettings.autoRejectDays}
                            onChange={(e) =>
                                handleTransferToggle(
                                    'autoRejectDays',
                                    Math.max(1, Math.min(90, parseInt(e.target.value, 10) || 7))
                                )
                            }
                            className="w-24 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                        />
                    </Row>
                )}
            </Section>

            {/* ---------------------------------------------------------------- */}
            {/* AI                                                               */}
            {/* ---------------------------------------------------------------- */}
            <Section
                icon={<Sparkles className="h-5 w-5" />}
                title={isAr ? 'الذكاء الاصطناعي (OpenRouter)' : 'AI Assistant (OpenRouter)'}
                description={
                    isAr
                        ? 'المساعد الذكي واستيراد التحويلات من PDF'
                        : 'Smart assistant and PDF transfer import'
                }
                action={
                    <button
                        type="button"
                        onClick={() => void checkAiStatus()}
                        className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                    >
                        <RefreshCw className="h-3.5 w-3.5" />
                        {isAr ? 'تحديث' : 'Refresh'}
                    </button>
                }
            >
                {aiChecking ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {isAr ? 'جارٍ الفحص…' : 'Checking…'}
                    </p>
                ) : !aiStatus ? (
                    <div className="flex items-start gap-3 rounded-xl bg-amber-50 p-4 dark:bg-amber-900/20">
                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
                        <p className="text-sm leading-relaxed text-amber-800 dark:text-amber-300">
                            {isAr
                                ? 'تعذّر الوصول إلى دالة ai-assistant. انشر الدالة ثم عيّن OPENROUTER_API_KEY.'
                                : 'Could not reach the ai-assistant function. Deploy it and set OPENROUTER_API_KEY.'}
                        </p>
                    </div>
                ) : (
                    <>
                        <Row label={isAr ? 'الحالة' : 'Status'}>
                            <span
                                className={`inline-flex items-center gap-1.5 text-sm font-bold ${
                                    aiStatus.configured
                                        ? 'text-green-600 dark:text-green-400'
                                        : 'text-red-600 dark:text-red-400'
                                }`}
                            >
                                {aiStatus.configured ? (
                                    <Check className="h-4 w-4" />
                                ) : (
                                    <X className="h-4 w-4" />
                                )}
                                {aiStatus.configured
                                    ? isAr
                                        ? 'مُهيّأ'
                                        : 'Configured'
                                    : isAr
                                        ? 'غير مُهيّأ'
                                        : 'Not configured'}
                            </span>
                        </Row>
                        <Row label={isAr ? 'المزوّد' : 'Provider'}>
                            <span className="font-mono text-sm text-gray-900 dark:text-white">
                                {aiStatus.provider}
                            </span>
                        </Row>
                        <Row label={isAr ? 'الموديل' : 'Model'}>
                            <span className="break-all font-mono text-sm text-gray-900 dark:text-white">
                                {aiStatus.model}
                            </span>
                        </Row>
                        {aiStatus.fallbacks && aiStatus.fallbacks.length > 0 && (
                            <Row label={isAr ? 'بدائل' : 'Fallbacks'}>
                                <span className="break-all font-mono text-sm text-gray-900 dark:text-white">
                                    {aiStatus.fallbacks.join(', ')}
                                </span>
                            </Row>
                        )}
                        {!aiStatus.configured && (
                            <p className="mt-3 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                                {isAr
                                    ? 'شغّل: supabase secrets set OPENROUTER_API_KEY=sk-or-v1-... ثم أعد نشر الدالة.'
                                    : 'Run: supabase secrets set OPENROUTER_API_KEY=sk-or-v1-… then redeploy the function.'}
                            </p>
                        )}
                    </>
                )}
            </Section>

            {/* ---------------------------------------------------------------- */}
            {/* System                                                          */}
            {/* ---------------------------------------------------------------- */}
            <Section
                icon={<Server className="h-5 w-5" />}
                title={isAr ? 'النظام' : 'System'}
                description={isAr ? 'معلومات النشر أعلاه' : 'About this deployment'}
            >
                <Row label={isAr ? 'الإصدار' : 'Version'}>
                    <span className="font-mono text-sm text-gray-900 dark:text-white">{APP_VERSION}</span>
                </Row>
                <Row
                    label={isAr ? 'مكان حفظ الإعدادات' : 'Settings storage'}
                    hint={
                        settingsAreShared
                            ? isAr
                                ? 'مركزي — كل المستخدمين على كل الأجهزة'
                                : 'Central — every user, every device'
                            : isAr
                                ? 'هذا المتصفح فقط — طبّق phase10_app_settings.sql'
                                : 'This browser only — apply phase10_app_settings.sql'
                    }
                >
                    <span
                        className={`inline-flex items-center gap-1.5 text-sm font-semibold ${
                            settingsAreShared
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-amber-600 dark:text-amber-400'
                        }`}
                    >
                        <Info className="h-4 w-4" />
                        {settingsAreShared ? (isAr ? 'مركزي' : 'Central') : isAr ? 'محلي' : 'Local'}
                    </span>
                </Row>
                <Row
                    label={isAr ? 'تفضيلات المستخدم' : 'User preferences'}
                    hint={
                        isAr
                            ? 'اللغة والمظهر يبقى لكل مستخدم على حدة'
                            : 'Language and theme stay per user, on purpose'
                    }
                >
                    <span />
                </Row>
            </Section>
        </div>
    );
};

export default AdminSettings;
