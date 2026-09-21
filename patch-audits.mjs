import fs from 'fs';

// 1. Patch PerformAuditModal.tsx
let performCode = fs.readFileSync('components/admin/PerformAuditModal.tsx', 'utf8');

if (!performCode.includes('hidden md:table')) {
  // Replace the table with hidden md:table
  performCode = performCode.replace('<table className="w-full text-left border-collapse">', '<table className="hidden md:table w-full text-left border-collapse">');

  // Find where the table ends to insert mobile layout
  const tableEndMatch = performCode.indexOf('</table>');
  if (tableEndMatch !== -1) {
    const tableEndStr = '</table>';
    const insertPos = tableEndMatch + tableEndStr.length;
    
    const mobileLayout = `
            {/* Mobile Card Layout for Perform Audit */}
            <div className="md:hidden space-y-4 pt-4">
              {audit.items?.map(item => {
                const currentCountStr = counts[item.id]?.count;
                const currentCountNum = currentCountStr === '' ? undefined : Number(currentCountStr);
                const isCounted = currentCountNum !== undefined;
                const variance = isCounted ? currentCountNum - item.expectedQuantity : null;
                
                return (
                  <div key={item.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm flex flex-col gap-3 relative">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-bold text-gray-900 dark:text-white">
                          {language === 'ar' ? item.itemNameAr : item.itemNameEn}
                        </div>
                        <div className="text-xs text-gray-500">{item.category}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-500 mb-1">{language === 'ar' ? 'المتوقع' : 'Expected'}</div>
                        <div className="font-medium text-gray-700 dark:text-gray-300">
                          {item.expectedQuantity} <span className="text-xs">{item.unit}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                        {language === 'ar' ? 'الكمية الفعلية (التي تم عدها)' : 'Actual Count'}
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={currentCountStr !== undefined ? currentCountStr : ''}
                        onChange={(e) => handleCountChange(item.id, e.target.value)}
                        className={\`w-full px-3 py-3 bg-gray-50 dark:bg-gray-900 border rounded-lg focus:ring-2 focus:ring-brand-500 font-bold text-lg \${
                          isCounted && variance !== 0 ? 'border-orange-300 text-orange-700 bg-orange-50 dark:border-orange-500/30 dark:bg-orange-900/20 dark:text-orange-400' 
                          : isCounted && variance === 0 ? 'border-green-300 text-green-700 bg-green-50 dark:border-green-500/30 dark:bg-green-900/20 dark:text-green-400' 
                          : 'border-gray-200 dark:border-gray-700'
                        }\`}
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-gray-500">
                        {language === 'ar' ? 'ملاحظات (اختياري)' : 'Notes (Optional)'}
                      </label>
                      <input
                        type="text"
                        value={counts[item.id]?.notes || ''}
                        onChange={(e) => handleNotesChange(item.id, e.target.value)}
                        placeholder={language === 'ar' ? 'سبب الفرق إن وجد...' : 'Reason for variance...'}
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
`;
    performCode = performCode.substring(0, insertPos) + mobileLayout + performCode.substring(insertPos);
    
    // Fix footer
    performCode = performCode.replace(
      '<div className="p-6 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 flex justify-between items-center">',
      '<div className="p-6 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 flex flex-col md:flex-row justify-between items-center gap-4">'
    );
    performCode = performCode.replace(
      '<div className="flex gap-3">',
      '<div className="flex flex-wrap sm:flex-nowrap gap-3 w-full md:w-auto justify-center">'
    );

    fs.writeFileSync('components/admin/PerformAuditModal.tsx', performCode, 'utf8');
    console.log('Patched PerformAuditModal.tsx');
  }
}

// 2. Patch ReviewAuditModal.tsx (it has TWO tables: itemsWithVariance and itemsMatched)
let reviewCode = fs.readFileSync('components/admin/ReviewAuditModal.tsx', 'utf8');

if (!reviewCode.includes('hidden md:table')) {
  // Table 1: Variances
  reviewCode = reviewCode.replace('<table className="w-full text-left border-collapse whitespace-nowrap min-w-[600px]">', '<table className="hidden md:table w-full text-left border-collapse whitespace-nowrap min-w-[600px]">');
  
  let match = reviewCode.indexOf('</table>');
  if (match !== -1) {
    const insertPos = match + '</table>'.length;
    const varianceMobile = `
              {/* Mobile Variance Cards */}
              <div className="md:hidden flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
                {itemsWithVariance.map(item => (
                  <div key={item.id} className="p-4 bg-white dark:bg-gray-900 flex flex-col gap-3">
                    <div className="font-bold text-gray-900 dark:text-white">
                      {language === 'ar' ? item.itemNameAr : item.itemNameEn}
                    </div>
                    <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                      <div className="text-center">
                        <div className="text-xs text-gray-500 mb-1">{language === 'ar' ? 'النظام' : 'System'}</div>
                        <div className="font-bold text-gray-600 dark:text-gray-400">{item.expectedQuantity}</div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-gray-400 rtl:rotate-180" />
                      <div className="text-center">
                        <div className="text-xs text-gray-500 mb-1">{language === 'ar' ? 'الفعلي' : 'Counted'}</div>
                        <div className="font-bold text-gray-900 dark:text-white">{item.countedQuantity}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-gray-500 mb-1">{language === 'ar' ? 'الفرق' : 'Diff'}</div>
                        <span className={\`inline-block px-2 py-1 rounded font-bold text-xs \${item.variance! > 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}\`}>
                          {item.variance! > 0 ? '+' : ''}{item.variance}
                        </span>
                      </div>
                    </div>
                    {item.notes && (
                      <div className="text-sm text-gray-500 bg-gray-50 dark:bg-gray-800/50 p-2 rounded">
                        <span className="font-medium">{language === 'ar' ? 'ملاحظة:' : 'Note:'}</span> {item.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
`;
    reviewCode = reviewCode.substring(0, insertPos) + varianceMobile + reviewCode.substring(insertPos);
  }

  // Table 2: Matched Items
  reviewCode = reviewCode.replace('<table className="w-full text-left border-collapse whitespace-nowrap min-w-[500px]">', '<table className="hidden md:table w-full text-left border-collapse whitespace-nowrap min-w-[500px]">');
  
  let match2 = reviewCode.lastIndexOf('</table>');
  if (match2 !== -1 && match2 > match) {
    const insertPos2 = match2 + '</table>'.length;
    const matchedMobile = `
              {/* Mobile Matched Cards */}
              <div className="md:hidden flex flex-col divide-y divide-green-100 dark:divide-green-900/30">
                {itemsMatched.map(item => (
                  <div key={item.id} className="p-4 bg-white dark:bg-gray-900 flex justify-between items-center">
                    <div className="font-bold text-gray-900 dark:text-white">
                      {language === 'ar' ? item.itemNameAr : item.itemNameEn}
                    </div>
                    <div className="flex gap-2 items-center">
                      <div className="text-sm text-gray-500">{item.expectedQuantity}</div>
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    </div>
                  </div>
                ))}
              </div>
`;
    reviewCode = reviewCode.substring(0, insertPos2) + matchedMobile + reviewCode.substring(insertPos2);
  }
  
  fs.writeFileSync('components/admin/ReviewAuditModal.tsx', reviewCode, 'utf8');
  console.log('Patched ReviewAuditModal.tsx');
}
