import React, { useState, useEffect } from 'react';
import { PurchaseOrder, Language } from '../../types';
import { TRANSLATIONS } from '../../constants';
import { X, CheckCircle, Package } from 'lucide-react';

interface ReceivePOModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  purchaseOrder: PurchaseOrder | null;
  onReceive: (poId: string, items: { id: string, received_quantity: number }[], performedBy: string) => void;
  userName: string;
}

const ReceivePOModal: React.FC<ReceivePOModalProps> = ({
  isOpen, onClose, language, purchaseOrder, onReceive, userName
}) => {
  const t = TRANSLATIONS[language];
  const [receivedItems, setReceivedItems] = useState<Record<string, number | string>>({});

  useEffect(() => {
    if (purchaseOrder && purchaseOrder.items) {
      const initial: Record<string, number> = {};
      purchaseOrder.items.forEach(item => {
        // Default to receiving the full remaining quantity
        initial[item.id] = Math.max(0, item.quantity - item.receivedQuantity);
      });
      setReceivedItems(initial);
    } else {
      setReceivedItems({});
    }
  }, [purchaseOrder, isOpen]);

  if (!isOpen || !purchaseOrder) return null;

  const handleQuantityChange = (id: string, value: string) => {
    setReceivedItems({
      ...receivedItems,
      [id]: value === '' ? '' : Number(value)
    });
  };

  const handleSubmit = () => {
    const itemsToReceive = Object.entries(receivedItems)
      .map(([id, qty]) => ({ id, received_quantity: Number(qty) || 0 }))
      .filter(item => item.received_quantity > 0);

    if (itemsToReceive.length === 0) {
      alert(language === 'ar' ? 'يرجى إدخال كميات الاستلام' : 'Please enter received quantities');
      return;
    }

    if (window.confirm(language === 'ar' ? 'هل أنت متأكد من استلام هذه العناصر؟ سيتم إضافتها إلى المستودع الرئيسي.' : 'Are you sure you want to receive these items? They will be added to the Warehouse inventory.')) {
      onReceive(purchaseOrder.id, itemsToReceive, userName);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col">
        
        <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Package className="w-6 h-6 text-brand-500" />
            {language === 'ar' ? 'استلام أمر الشراء' : 'Receive Purchase Order'} #{purchaseOrder.poNumber}
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 rounded-xl text-sm leading-relaxed">
            {language === 'ar' 
              ? 'أدخل الكميات المستلمة الفعلية لكل عنصر. سيتم إضافة هذه الكميات تلقائيًا إلى مخزون "المستودع الرئيسي".'
              : 'Enter the actual received quantities for each item. These quantities will be automatically added to the "Warehouse" inventory.'}
          </div>

          <div className="space-y-4">
            {purchaseOrder.items?.map(item => (
              <div key={item.id} className="flex items-center gap-4 p-4 border border-gray-200 dark:border-gray-700 rounded-xl">
                <div className="flex-1">
                  <h4 className="font-bold text-gray-900 dark:text-white">
                    {language === 'ar' ? item.itemNameAr : item.itemNameEn}
                  </h4>
                  <div className="text-sm text-gray-500 flex gap-4 mt-1">
                    <span>{language === 'ar' ? 'الكمية المطلوبة:' : 'Ordered:'} {item.quantity}</span>
                    <span className="text-brand-600 dark:text-brand-400">{language === 'ar' ? 'مستلم مسبقاً:' : 'Previously Received:'} {item.receivedQuantity}</span>
                  </div>
                </div>
                <div className="w-32">
                  <label className="block text-xs text-gray-500 mb-1">{language === 'ar' ? 'الكمية المستلمة الآن' : 'Receiving Now'}</label>
                  <input 
                    type="number"
                    min="0"
                    max={item.quantity - item.receivedQuantity}
                    value={receivedItems[item.id] === undefined ? 0 : receivedItems[item.id]}
                    onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-brand-500 font-bold"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 rounded-lg transition-colors font-medium">
            {t.cancel}
          </button>
          <button 
            onClick={handleSubmit}
            className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-bold flex items-center gap-2 shadow-sm shadow-green-500/20"
          >
            <CheckCircle className="w-5 h-5" />
            {language === 'ar' ? 'تأكيد الاستلام' : 'Confirm Receipt'}
          </button>
        </div>

      </div>
    </div>
  );
};

export default ReceivePOModal;
