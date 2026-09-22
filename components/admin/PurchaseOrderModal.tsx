import React, { useState, useEffect } from 'react';
import { PurchaseOrder, Language, Supplier, CatalogItem, PurchaseOrderItem } from '../../types';
import { TRANSLATIONS } from '../../constants';
import { X, Plus, Trash2, Save, ShoppingCart, Info, Download } from 'lucide-react';
import { exportPOToPDF } from '../../utils/pdfExport';
import { useCurrency } from '../AppSettingsProvider';
import { formatMoney } from '../../utils/money';

interface PurchaseOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  suppliers: Supplier[];
  catalog: CatalogItem[];
  purchaseOrder?: PurchaseOrder;
  onSave: (po: Omit<PurchaseOrder, 'id' | 'createdAt' | 'updatedAt' | 'poNumber'>, items: Omit<PurchaseOrderItem, 'id' | 'poId' | 'totalPrice'>[]) => void;
  onEdit?: (id: string, po: Omit<PurchaseOrder, 'id' | 'createdAt' | 'updatedAt' | 'poNumber'>, items: Omit<PurchaseOrderItem, 'id' | 'poId' | 'totalPrice'>[]) => void;
  onUpdateStatus?: (id: string, status: string) => void;
  /**
   * False when the viewer may only read the location this order belongs to.
   * Approval, cancellation and editing all write that location, so the controls
   * are withheld instead of failing on submit. Defaults to true for callers that
   * have already established access.
   */
  canManage?: boolean;
  /**
   * True for a branch manager: their order is approved as it is created, so the
   * draft/submit choice is replaced by a single create action.
   */
  autoApprove?: boolean;
  userName: string;
}

const PurchaseOrderModal: React.FC<PurchaseOrderModalProps> = ({
  isOpen, onClose, language, suppliers, catalog, purchaseOrder, onSave, onEdit, onUpdateStatus, canManage = true, autoApprove = false, userName
}) => {
  const currency = useCurrency();
  const t = TRANSLATIONS[language];
  
  const [supplierId, setSupplierId] = useState('');
  const [expectedDelivery, setExpectedDelivery] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<{ catalogId: string, nameEn: string, nameAr: string, quantity: number, unitPrice: number }[]>([]);

  const [isEditing, setIsEditing] = useState(false);

  const isViewMode = !!purchaseOrder && !isEditing;

  const selectedSupplier = suppliers.find(s => s.id === supplierId);
  const availableCatalog = selectedSupplier && selectedSupplier.suppliedItems && selectedSupplier.suppliedItems.length > 0
    ? catalog.filter(c => selectedSupplier.suppliedItems!.includes(c.id))
    : [];

  useEffect(() => {
    if (purchaseOrder) {
      setSupplierId(purchaseOrder.supplierId);
      setExpectedDelivery(purchaseOrder.expectedDelivery || '');
      setNotes(purchaseOrder.notes || '');
      setItems(purchaseOrder.items?.map(item => ({
        catalogId: '', // We don't necessarily have catalogId tracked, but we have names
        nameEn: item.itemNameEn,
        nameAr: item.itemNameAr,
        quantity: item.quantity,
        unitPrice: item.unitPrice
      })) || []);
    } else {
      setSupplierId('');
      setExpectedDelivery('');
      setNotes('');
      setItems([]);
    }
    setIsEditing(false);
  }, [purchaseOrder, isOpen]);

  if (!isOpen) return null;

  const handleAddItem = () => {
    setItems([...items, { catalogId: '', nameEn: '', nameAr: '', quantity: 1, unitPrice: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...items];
    if (field === 'catalogId') {
      const selected = catalog.find(c => c.id === value);
      if (selected) {
        newItems[index] = { ...newItems[index], catalogId: value, nameEn: selected.nameEn, nameAr: selected.nameAr, unitPrice: selected.defaultPrice || 0 };
      }
    } else {
      (newItems[index] as any)[field] = value;
    }
    setItems(newItems);
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  };

  const handleSubmit = (status: 'draft' | 'pending' | 'approved') => {
    if (!supplierId || items.length === 0 || items.some(i => !i.nameEn || i.quantity <= 0 || i.unitPrice < 0)) {
      alert(language === 'ar' ? 'يرجى تعبئة جميع الحقول المطلوبة' : 'Please fill all required fields');
      return;
    }

    const payload = {
      supplierId,
      status,
      expectedDelivery: expectedDelivery || undefined,
      notes,
      totalAmount: calculateTotal(),
      createdBy: userName
    };

    const payloadItems = items.map(i => ({
      itemNameEn: i.nameEn,
      itemNameAr: i.nameAr || i.nameEn,
      quantity: Number(i.quantity),
      receivedQuantity: purchaseOrder?.items?.find(pi => pi.itemNameEn === i.nameEn)?.receivedQuantity || 0,
      unitPrice: Number(i.unitPrice)
    }));

    if (isEditing && purchaseOrder && onEdit) {
      onEdit(purchaseOrder.id, payload, payloadItems);
    } else {
      onSave(payload, payloadItems);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 pb-4 pt-[max(env(safe-area-inset-top,1rem),1rem)] bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[95vh]">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <ShoppingCart className="w-6 h-6 text-brand-500" />
            {isViewMode 
              ? `${language === 'ar' ? 'أمر شراء' : 'Purchase Order'} #${purchaseOrder.poNumber}`
              : (language === 'ar' ? 'إنشاء أمر شراء جديد' : 'Create New Purchase Order')}
          </h2>
          <div className="flex gap-2">
            {purchaseOrder && (
              <button 
                onClick={() => exportPOToPDF(purchaseOrder, language, catalog, suppliers, currency)}
                className="p-2 text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 rounded-lg transition-colors"
                title={language === 'ar' ? 'تحميل PDF' : 'Download PDF'}
              >
                <Download className="w-5 h-5" />
              </button>
            )}
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          
          {/* PO Details Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {language === 'ar' ? 'المورد' : 'Supplier'} *
              </label>
              <select
                disabled={isViewMode}
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg focus:ring-2 focus:ring-brand-500 disabled:opacity-50 text-gray-900 dark:text-white"
              >
                <option value="">{language === 'ar' ? 'اختر المورد...' : 'Select Supplier...'}</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{language === 'ar' ? s.nameAr : s.nameEn}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {language === 'ar' ? 'تاريخ التسليم المتوقع' : 'Expected Delivery Date'}
              </label>
              <input
                type="date"
                disabled={isViewMode}
                value={expectedDelivery}
                onChange={(e) => setExpectedDelivery(e.target.value)}
                className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg disabled:opacity-50 text-gray-900 dark:text-white"
              />
            </div>

            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {language === 'ar' ? 'ملاحظات' : 'Notes'}
              </label>
              <textarea
                disabled={isViewMode}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg disabled:opacity-50 resize-none text-gray-900 dark:text-white"
              />
            </div>
          </div>

          {/* Items Section */}
          <div className="mt-8">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {language === 'ar' ? 'عناصر الطلب' : 'Order Items'}
              </h3>
              {!isViewMode && (
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="px-4 py-2 bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 font-medium rounded-lg hover:bg-brand-100 transition-colors flex items-center gap-2 text-sm"
                >
                  <Plus className="w-4 h-4" />
                  {language === 'ar' ? 'إضافة عنصر' : 'Add Item'}
                </button>
              )}
            </div>

            <div className="hidden md:block overflow-x-auto border border-gray-200 dark:border-gray-800 rounded-xl">

              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{language === 'ar' ? 'العنصر' : 'Item'}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{language === 'ar' ? 'الوحدة' : 'Unit'}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{language === 'ar' ? 'الكمية' : 'Qty'}</th>
                    <th className="px-4 py-3 font-medium w-40">{language === 'ar' ? 'سعر الوحدة' : 'Unit Price'}</th>
                    <th className="px-4 py-3 font-medium w-32 text-right">{language === 'ar' ? 'الإجمالي' : 'Total'}</th>
                    {!isViewMode && <th className="px-4 py-3 w-16"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {items.map((item, index) => (
                    <tr key={index} className="bg-white dark:bg-gray-900">
                      <td className="px-4 py-3">
                        {isViewMode ? (
                          <div className="font-medium text-gray-900 dark:text-white">
                            {language === 'ar' ? item.nameAr : item.nameEn}
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2">
                            <select
                              value={item.catalogId}
                              onChange={(e) => handleItemChange(index, 'catalogId', e.target.value)}
                              className="w-full px-3 py-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg text-xs text-gray-900 dark:text-white"
                            >
                              <option value="">{language === 'ar' ? 'اختر من الكتالوج...' : 'Select from catalog...'}</option>
                              {availableCatalog.map(c => (
                                <option key={c.id} value={c.id}>{language === 'ar' ? c.nameAr : c.nameEn}</option>
                              ))}
                            </select>
                            <input
                              type="text"
                              placeholder={language === 'ar' ? 'أو اكتب الاسم' : 'Or type name EN'}
                              value={item.nameEn}
                              onChange={(e) => handleItemChange(index, 'nameEn', e.target.value)}
                              className="w-full px-3 py-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg text-xs text-gray-900 dark:text-white"
                            />
                            {language === 'ar' && (
                              <input
                                type="text"
                                placeholder="الاسم بالعربي"
                                value={item.nameAr}
                                onChange={(e) => handleItemChange(index, 'nameAr', e.target.value)}
                                className="w-full px-3 py-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg text-xs text-right text-gray-900 dark:text-white"
                                dir="rtl"
                              />
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                          {catalog.find(c => c.nameEn === item.nameEn || c.id === item.catalogId)?.unit || 'PCS'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {isViewMode ? (
                          <div className="text-gray-900 dark:text-white font-medium">{item.quantity}</div>
                        ) : (
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                            className="w-full px-3 py-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white"
                          />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isViewMode ? (
                          <div className="text-gray-900 dark:text-white font-medium">{formatMoney(item.unitPrice, currency, { language })}</div>
                        ) : (
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">{currency}</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unitPrice}
                              onChange={(e) => handleItemChange(index, 'unitPrice', e.target.value)}
                              className="w-full pl-10 pr-3 py-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white"
                            />
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900 dark:text-white">
                        {formatMoney(item.quantity * item.unitPrice, currency, { language })}
                      </td>
                      {!isViewMode && (
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={isViewMode ? 4 : 5} className="px-4 py-8 text-center text-gray-500">
                        {language === 'ar' ? 'لا توجد عناصر. أضف عناصر لطلب الشراء.' : 'No items added yet.'}
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="bg-gray-50 dark:bg-gray-900 font-bold text-lg">
                  <tr>
                    <td colSpan={4} className="px-4 py-4 text-right text-gray-700 dark:text-gray-300">
                      {language === 'ar' ? 'الإجمالي الكلي' : 'Grand Total'}
                    </td>
                    <td className="px-4 py-4 text-right text-brand-600 dark:text-brand-400">
                      {formatMoney(calculateTotal(), currency, { language })}
                    </td>
                    {!isViewMode && <td></td>}
                  </tr>
                </tfoot>
              </table>
            </div>
            
            {/* Mobile Card Layout */}
            <div className="md:hidden space-y-4">
              {items.map((item, index) => (
                <div key={index} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 flex flex-col gap-4 relative">
                  {!isViewMode && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      className="absolute top-4 right-4 rtl:right-auto rtl:left-4 p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  
                  <div className="flex flex-col gap-2 pr-10 rtl:pr-0 rtl:pl-10">
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400">{language === 'ar' ? 'العنصر' : 'Item'}</label>
                    {isViewMode ? (
                      <div className="font-medium text-gray-900 dark:text-white">
                        {language === 'ar' ? item.nameAr : item.nameEn}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <select
                          value={item.catalogId}
                          onChange={(e) => handleItemChange(index, 'catalogId', e.target.value)}
                          className="w-full px-3 py-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg text-sm text-gray-900 dark:text-white"
                        >
                          <option value="">{language === 'ar' ? 'اختر من الكتالوج...' : 'Select from catalog...'}</option>
                          {availableCatalog.map(c => (
                            <option key={c.id} value={c.id}>{language === 'ar' ? c.nameAr : c.nameEn}</option>
                          ))}
                        </select>
                        <input
                          type="text"
                          placeholder={language === 'ar' ? 'أو اكتب الاسم' : 'Or type name EN'}
                          value={item.nameEn}
                          onChange={(e) => handleItemChange(index, 'nameEn', e.target.value)}
                          className="w-full px-3 py-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg text-sm text-gray-900 dark:text-white"
                        />
                        {language === 'ar' && (
                          <input
                            type="text"
                            placeholder="الاسم بالعربي"
                            value={item.nameAr}
                            onChange={(e) => handleItemChange(index, 'nameAr', e.target.value)}
                            className="w-full px-3 py-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg text-sm text-right text-gray-900 dark:text-white"
                            dir="rtl"
                          />
                        )}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        {language === 'ar' ? 'الكمية' : 'Qty'} ({catalog.find(c => c.nameEn === item.nameEn || c.id === item.catalogId)?.unit || 'PCS'})
                      </label>
                      {isViewMode ? (
                        <div className="text-gray-900 dark:text-white font-medium text-sm">{item.quantity}</div>
                      ) : (
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                          className="w-full px-3 py-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg text-sm text-gray-900 dark:text-white"
                        />
                      )}
                    </div>
                    
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400">{language === 'ar' ? 'سعر الوحدة' : 'Unit Price'}</label>
                      {isViewMode ? (
                        <div className="text-gray-900 dark:text-white font-medium text-sm">{formatMoney(item.unitPrice, currency, { language })}</div>
                      ) : (
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">{currency}</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(e) => handleItemChange(index, 'unitPrice', e.target.value)}
                            className="w-full pl-10 pr-3 py-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg text-sm text-gray-900 dark:text-white"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-3 border-t border-gray-100 dark:border-gray-800">
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{language === 'ar' ? 'الإجمالي' : 'Total'}</span>
                    <span className="text-base font-bold text-gray-900 dark:text-white">
                      {formatMoney(item.quantity * item.unitPrice, currency, { language })}
                    </span>
                  </div>
                </div>
              ))}
              
              {items.length === 0 && (
                <div className="py-8 text-center text-gray-500 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
                  {language === 'ar' ? 'لا توجد عناصر. أضف عناصر لطلب الشراء.' : 'No items added yet.'}
                </div>
              )}

              <div className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
                <span className="font-bold text-gray-700 dark:text-gray-300">{language === 'ar' ? 'الإجمالي الكلي' : 'Grand Total'}</span>
                <span className="text-xl font-bold text-brand-600 dark:text-brand-400">
                  {formatMoney(calculateTotal(), currency, { language })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 flex flex-wrap justify-between items-center gap-4">
          
          {/* Status Controls for View Mode */}
          {/* Editing stays available to whoever may write the order's location. The
              status controls are not: a branch manager's order is approved on creation,
              so there is nothing for them to submit or approve. */}
          {isViewMode && canManage && purchaseOrder.status !== 'received' && purchaseOrder.status !== 'cancelled' ? (
            <div className="flex gap-2">
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-950 dark:text-gray-300 rounded-lg font-medium transition-colors"
              >
                {language === 'ar' ? 'تعديل الطلب' : 'Edit Order'}
              </button>
              {!autoApprove && onUpdateStatus && purchaseOrder.status === 'draft' && (
                <button
                  onClick={() => onUpdateStatus(purchaseOrder.id, 'pending')}
                  className="px-4 py-2 bg-yellow-100 text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 rounded-lg font-medium transition-colors"
                >
                  {language === 'ar' ? 'إرسال للموافقة' : 'Submit for Approval'}
                </button>
              )}
              {!autoApprove && onUpdateStatus && purchaseOrder.status === 'pending' && (
                <button
                  onClick={() => onUpdateStatus(purchaseOrder.id, 'approved')}
                  className="px-4 py-2 bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 rounded-lg font-medium transition-colors"
                >
                  {language === 'ar' ? 'موافقة' : 'Approve Order'}
                </button>
              )}
              {onUpdateStatus && (
                <button
                  onClick={() => {
                    if (window.confirm(language === 'ar' ? 'هل أنت متأكد من الإلغاء؟' : 'Are you sure you want to cancel?')) {
                      onUpdateStatus(purchaseOrder.id, 'cancelled');
                    }
                  }}
                  className="px-4 py-2 bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 rounded-lg font-medium transition-colors"
                >
                  {language === 'ar' ? 'إلغاء الطلب' : 'Cancel Order'}
                </button>
              )}
            </div>
          ) : <div></div>}

          <div className="flex gap-3 ml-auto">
            <button onClick={onClose} className="px-6 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 rounded-lg transition-colors font-medium">
              {isViewMode ? (language === 'ar' ? 'إغلاق' : 'Close') : t.cancel}
            </button>
            {!isViewMode && (
              <>
                {isEditing ? (
                  <button 
                    onClick={() => handleSubmit(purchaseOrder!.status as any)}
                    className="px-6 py-2 bg-brand-700 hover:bg-brand-800 text-white rounded-lg transition-colors font-medium"
                  >
                    {language === 'ar' ? 'حفظ التعديلات' : 'Save Changes'}
                  </button>
                ) : (
                  <>
                    {/* A branch orders for its own shelf, so there is no separate
                        approver in that flow: the order is approved on creation
                        rather than sitting in a queue nobody reviews. */}
                    {autoApprove ? (
                      <button
                        onClick={() => handleSubmit('approved')}
                        className="px-6 py-2 bg-brand-700 hover:bg-brand-800 text-white rounded-lg transition-colors font-medium"
                      >
                        {language === 'ar' ? 'إنشاء أمر الشراء (معتمد)' : 'Create Order (approved)'}
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => handleSubmit('draft')}
                          className="px-6 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-950 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg transition-colors font-medium flex items-center gap-2"
                        >
                          <Save className="w-4 h-4" />
                          {language === 'ar' ? 'حفظ كمسودة' : 'Save Draft'}
                        </button>
                        <button
                          onClick={() => handleSubmit('pending')}
                          className="px-6 py-2 bg-brand-700 hover:bg-brand-800 text-white rounded-lg transition-colors font-medium"
                        >
                          {language === 'ar' ? 'إنشاء وإرسال' : 'Create & Submit'}
                        </button>
                      </>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default PurchaseOrderModal;
