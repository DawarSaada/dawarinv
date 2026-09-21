import fs from 'fs';

const filePath = 'components/admin/PurchaseOrderModal.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const tableStartString = '<div className="overflow-x-auto border border-gray-200 dark:border-gray-800 rounded-xl">';
const tableEndString = '            </div>\n          </div>\n        </div>\n\n        {/* Footer */}';

const startIndex = content.indexOf(tableStartString);
const endIndex = content.indexOf(tableEndString);

if (startIndex !== -1 && endIndex !== -1) {
  const replacement = `<div className="hidden md:block overflow-x-auto border border-gray-200 dark:border-gray-800 rounded-xl">
` + content.substring(startIndex + tableStartString.length, endIndex) + `            </div>
            
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

        {/* Footer */}`;
  
  const newContent = content.substring(0, startIndex) + replacement + content.substring(endIndex + tableEndString.length);
  fs.writeFileSync(filePath, newContent);
  console.log('Successfully patched PurchaseOrderModal.tsx for mobile layout!');
} else {
  console.log('Could not find the target section.', startIndex, endIndex);
}
