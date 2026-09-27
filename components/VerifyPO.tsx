import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { formatDateDDMMYYYY } from '../utils/dateUtils';
import { ShieldCheck, AlertTriangle, CheckCircle, Package, Calendar, Building, DollarSign, Printer, ArrowLeft, ArrowRight, RefreshCw } from 'lucide-react';

interface POItem {
  id: string;
  item_name_ar: string;
  item_name_en: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  received_quantity?: number;
}

interface SupplierInfo {
  id: string;
  name_ar?: string;
  name_en?: string;
  phone?: string;
  contact_person?: string;
}

interface PODetail {
  id: string;
  po_number: string;
  status: string;
  expected_delivery?: string;
  total_amount: number;
  notes?: string;
  created_by: string;
  created_at: string;
  location_id: string;
  purchase_order_items: POItem[];
  suppliers?: SupplierInfo;
}

export const VerifyPO: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [po, setPo] = useState<PODetail | null>(null);
  const [lang, setLang] = useState<'ar' | 'en'>('ar');
  const isAr = lang === 'ar';

  const fetchPO = async () => {
    setLoading(true);
    setError(null);
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const id = urlParams.get('id');
      const poNum = urlParams.get('po') || urlParams.get('po_number');

      if (!id && !poNum) {
        setError(isAr ? 'لم يتم تحديد رقم طلب الشراء في الرابط.' : 'No Purchase Order ID specified in the link.');
        setLoading(false);
        return;
      }

      let query = supabase
        .from('purchase_orders')
        .select('*, purchase_order_items(*), suppliers(*)');

      if (id) {
        query = query.eq('id', id);
      } else if (poNum) {
        query = query.eq('po_number', poNum);
      }

      const { data, error: sbError } = await query.single();

      if (sbError || !data) {
        setError(isAr ? 'طلب الشراء غير موجود أو تم إلغاؤه.' : 'Purchase Order not found or has been removed.');
      } else {
        setPo(data as PODetail);
      }
    } catch (err: any) {
      setError(err?.message || (isAr ? 'حدث خطأ أثناء فحص الطلب.' : 'An error occurred while verifying the PO.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPO();
  }, []);

  const getStatusBadge = (status: string) => {
    const s = (status || '').toUpperCase();
    if (s === 'APPROVED' || s === 'DELIVERED') {
      return {
        bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300',
        text: isAr ? (s === 'APPROVED' ? 'معتمد رسمياً' : 'تم التسليم بالكامل') : (s === 'APPROVED' ? 'Officially Approved' : 'Delivered'),
        icon: <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
      };
    }
    if (s === 'PENDING') {
      return {
        bg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300',
        text: isAr ? 'قيد المراجعة والاعتماد' : 'Pending Review',
        icon: <RefreshCw className="w-4 h-4 text-amber-600 dark:text-amber-400" />
      };
    }
    if (s === 'CANCELLED' || s === 'REJECTED') {
      return {
        bg: 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-300',
        text: isAr ? 'ملغي أو مرفوض' : 'Cancelled / Rejected',
        icon: <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
      };
    }
    return {
      bg: 'bg-slate-50 dark:bg-slate-800 border-slate-300 text-slate-700 dark:text-slate-300',
      text: status,
      icon: <CheckCircle className="w-4 h-4 text-slate-500" />
    };
  };

  const getLocationName = (locId: string) => {
    const map: Record<string, { ar: string; en: string }> = {
      warehouse: { ar: 'المستودع المركزي', en: 'Central Warehouse' },
      mammal: { ar: 'المعمل المركزي', en: 'Mammal Central Kitchen' },
      b01: { ar: 'فرع الجوافة', en: 'Jawafa Branch' },
      b02: { ar: 'فرع الجامعة', en: 'Jamia Branch' },
      b03: { ar: 'فرع حبونا', en: 'Habuna Branch' },
    };
    if (map[locId]) {
      return isAr ? map[locId].ar : map[locId].en;
    }
    return locId;
  };

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col items-center p-3 sm:p-6 font-sans transition-colors"
    >
      {/* Top Navbar */}
      <div className="w-full max-w-xl flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-orange-600 flex items-center justify-center font-black text-white text-base shadow-sm">
            DS
          </div>
          <div>
            <span className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
              {isAr ? 'مؤسسة دوار السعادة للوجبات السريعة' : 'Dawar Al-Saada Fast Food Establishment'}
            </span>
            <span className="block text-[10px] text-slate-500 dark:text-slate-400 font-medium">
              {isAr ? 'بوابة التحقق الرقمي من طلبات الشراء' : 'Purchase Order Verification Portal'}
            </span>
          </div>
        </div>

        <button
          onClick={() => setLang(isAr ? 'en' : 'ar')}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition"
        >
          {isAr ? 'English' : 'العربية'}
        </button>
      </div>

      {/* Main Container */}
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Banner */}
        <div className="h-2 bg-gradient-to-r from-orange-600 via-amber-500 to-orange-500"></div>

        {/* Loading State */}
        {loading && (
          <div className="p-12 text-center flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-3 border-orange-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {isAr ? 'جاري التحقق من صحة وصلاحية طلب الشراء...' : 'Verifying Purchase Order authenticity...'}
            </p>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="p-8 text-center flex flex-col items-center">
            <div className="w-14 h-14 rounded-full bg-rose-100 dark:bg-rose-950/60 border-2 border-rose-500 flex items-center justify-center mb-3">
              <AlertTriangle className="w-7 h-7 text-rose-600 dark:text-rose-400" />
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white mb-1">
              {isAr ? 'تعذر التحقق من المستند' : 'Document Verification Failed'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mb-6">
              {error}
            </p>
            <div className="flex gap-2">
              <button
                onClick={fetchPO}
                className="px-4 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl text-xs font-bold shadow hover:opacity-90 transition flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                {isAr ? 'إعادة المحاولة' : 'Try Again'}
              </button>
              <a
                href="/"
                className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                {isAr ? 'الرئيسية' : 'Home'}
              </a>
            </div>
          </div>
        )}

        {/* Success Verified View */}
        {!loading && po && (
          <div>
            {/* Authenticity Seal Header */}
            <div className="p-6 pb-4 text-center border-b border-slate-100 dark:border-slate-800/80 bg-gradient-to-b from-orange-50/50 dark:from-orange-950/20 to-transparent">
              <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950/70 border-2 border-emerald-500 flex items-center justify-center mx-auto mb-3 shadow-xs">
                <ShieldCheck className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <span className="inline-block text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-900/40 px-3 py-1 rounded-full border border-emerald-300/50 dark:border-emerald-700/50 mb-1.5">
                {isAr ? '✓ مستند رسمي موثق بقاعدة البيانات' : '✓ Verified Official Document'}
              </span>
              <h1 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {po.po_number}
              </h1>
              <div className="mt-2 flex justify-center">
                {(() => {
                  const badge = getStatusBadge(po.status);
                  return (
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold ${badge.bg}`}>
                      {badge.icon}
                      {badge.text}
                    </span>
                  );
                })()}
              </div>
            </div>

            {/* Metadata Summary */}
            <div className="p-4 sm:p-6 space-y-4">
              <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 border border-slate-200/70 dark:border-slate-700/60 space-y-2.5 text-xs">
                <div className="flex justify-between items-center pb-2 border-b border-slate-200/50 dark:border-slate-700/40">
                  <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-orange-600" />
                    {isAr ? 'المورد:' : 'Supplier:'}
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {po.suppliers ? (isAr ? (po.suppliers.name_ar || po.suppliers.name_en) : (po.suppliers.name_en || po.suppliers.name_ar)) : (isAr ? 'مورد معتمد' : 'Authorized Supplier')}
                  </span>
                </div>

                <div className="flex justify-between items-center pb-2 border-b border-slate-200/50 dark:border-slate-700/40">
                  <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-orange-600" />
                    {isAr ? 'جهة التوريد / الوجهة:' : 'Target Destination:'}
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {getLocationName(po.location_id)}
                  </span>
                </div>

                <div className="flex justify-between items-center pb-2 border-b border-slate-200/50 dark:border-slate-700/40">
                  <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-orange-600" />
                    {isAr ? 'تاريخ الإنشاء:' : 'Date Created:'}
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white font-mono">
                    {formatDateDDMMYYYY(po.created_at)}
                  </span>
                </div>

                {po.expected_delivery && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-orange-600" />
                      {isAr ? 'تاريخ التسليم المتوقع:' : 'Expected Delivery:'}
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white font-mono">
                      {formatDateDDMMYYYY(po.expected_delivery)}
                    </span>
                  </div>
                )}
              </div>

              {/* Items List */}
              <div>
                <div className="flex justify-between items-center mb-2 px-1">
                  <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-orange-600" />
                    {isAr ? `الأصناف المصرح بها (${po.purchase_order_items?.length || 0})` : `Authorized Items (${po.purchase_order_items?.length || 0})`}
                  </h3>
                  <span className="text-[10px] text-slate-400">
                    {isAr ? 'الكمية المعتمدة' : 'Approved Qty'}
                  </span>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/70 dark:border-slate-700/60 divide-y divide-slate-200/60 dark:divide-slate-700/40 overflow-hidden">
                  {po.purchase_order_items?.map((item, idx) => (
                    <div key={item.id || idx} className="p-3.5 flex justify-between items-center hover:bg-slate-100/50 dark:hover:bg-slate-800 transition-colors">
                      <div className="flex-1 pr-2">
                        <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                          {isAr ? (item.item_name_ar || item.item_name_en) : (item.item_name_en || item.item_name_ar)}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                          {isAr ? item.item_name_en : item.item_name_ar}
                        </div>
                      </div>
                      <div className="text-left font-mono">
                        <span className="inline-block bg-orange-100 dark:bg-orange-950/70 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800/60 font-bold px-2.5 py-1 rounded-lg text-xs">
                          {item.quantity}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total Banner */}
              <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl p-4 flex justify-between items-center shadow-md">
                <div>
                  <div className="text-xs text-slate-400 font-medium">
                    {isAr ? 'الإجمالي الكلي المعتمد' : 'Total Approved Amount'}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {isAr ? 'شامل الرسوم والضريبة' : 'Including Applicable Taxes'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg sm:text-xl font-black font-mono text-orange-400">
                    {Number(po.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-xs text-white">SAR</span>
                  </div>
                </div>
              </div>

              {/* Bottom Actions & Digital Seal */}
              <div className="pt-2 flex flex-col gap-3">
                <button
                  onClick={() => window.print()}
                  className="w-full py-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl transition flex items-center justify-center gap-2"
                >
                  <Printer className="w-3.5 h-3.5" />
                  {isAr ? 'طباعة تقرير التحقق' : 'Print Verification Report'}
                </button>

                <div className="text-center pt-2 border-t border-slate-200 dark:border-slate-800 text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed">
                  🔒 {isAr ? 'هذا المستند مشفر ومسجل مركزياً في خوادم مؤسسة دوار السعادة للوجبات السريعة. يمنع تداول أي مستند ورقي لا يطابق هذه البيانات.' : 'This document is cryptographically verified against Dawar Al-Saada Fast Food Establishment central database.'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Return Link */}
      <div className="mt-6 text-center">
        <a
          href="/"
          className="text-xs text-slate-500 hover:text-orange-600 dark:text-slate-400 dark:hover:text-orange-400 font-semibold inline-flex items-center gap-1 transition"
        >
          {isAr ? <ArrowRight className="w-3.5 h-3.5" /> : <ArrowLeft className="w-3.5 h-3.5" />}
          {isAr ? 'الانتقال إلى نظام المخزون المركزي' : 'Back to Central Inventory Portal'}
        </a>
      </div>
    </div>
  );
};

export default VerifyPO;
