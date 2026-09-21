import fs from 'fs';

// 1. Patch ProductCatalogManagement.tsx
let catalogCode = fs.readFileSync('components/admin/ProductCatalogManagement.tsx', 'utf8');

if (!catalogCode.includes('hidden md:table')) {
  catalogCode = catalogCode.replace('<table className="w-full text-left rtl:text-right">', '<table className="hidden md:table w-full text-left rtl:text-right">');
  
  const tableEndMatch = catalogCode.indexOf('</table>');
  if (tableEndMatch !== -1) {
    const insertPos = tableEndMatch + '</table>'.length;
    
    const mobileLayout = `
            {/* Mobile Card Layout */}
            <div className="md:hidden flex flex-col gap-4 mt-4">
                {filteredCatalog.map(item => (
                    <div key={item.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 rounded-xl shadow-sm flex flex-col gap-3">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="font-bold text-gray-900 dark:text-white">{item.nameEn}</h3>
                                <h3 className="font-bold text-gray-900 dark:text-white font-arabic mt-1">{item.nameAr}</h3>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => handleOpenModal(item)} className="p-2 text-brand-600 bg-brand-50 dark:bg-brand-900/30 rounded-lg">
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleDelete(item.id)} className="p-2 text-red-600 bg-red-50 dark:bg-red-900/30 rounded-lg">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        <div className="flex gap-4 border-t border-gray-100 dark:border-gray-700 pt-3 mt-1">
                            <div>
                                <div className="text-xs text-gray-500">{t.category || 'Category'}</div>
                                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">{item.category}</div>
                            </div>
                            <div>
                                <div className="text-xs text-gray-500">{t.unit || 'Unit'}</div>
                                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">{item.unit}</div>
                            </div>
                        </div>
                    </div>
                ))}
                {filteredCatalog.length === 0 && (
                    <div className="text-center py-8 text-gray-500 bg-gray-50 dark:bg-gray-900 rounded-xl">
                        No products found in catalog.
                    </div>
                )}
            </div>
`;
    catalogCode = catalogCode.substring(0, insertPos) + mobileLayout + catalogCode.substring(insertPos);
    fs.writeFileSync('components/admin/ProductCatalogManagement.tsx', catalogCode, 'utf8');
    console.log('Patched ProductCatalogManagement.tsx');
  }
}

// 2. Patch AdminReports.tsx
let reportsCode = fs.readFileSync('components/admin/AdminReports.tsx', 'utf8');

if (!reportsCode.includes('hidden md:table')) {
  reportsCode = reportsCode.replace('<table className="w-full text-left rtl:text-right text-xs sm:text-sm">', '<table className="hidden md:table w-full text-left rtl:text-right text-xs sm:text-sm">');
  
  const tableEndMatch = reportsCode.indexOf('</table>');
  if (tableEndMatch !== -1) {
    const insertPos = tableEndMatch + '</table>'.length;
    
    const mobileLayout = `
            {/* Mobile Card Layout */}
            <div className="md:hidden flex flex-col divide-y divide-gray-100 dark:divide-gray-800 border-t border-gray-200 dark:border-gray-800">
                {filteredReportTx.map(tx => (
                    <div key={tx.id} className="p-4 flex flex-col gap-2 bg-white dark:bg-gray-900">
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-500">
                                {new Date(tx.date).toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US', {hour: '2-digit', minute:'2-digit'})}
                            </span>
                            <span className={\`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase \${tx.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}\`}>
                                {t[tx.status]}
                            </span>
                        </div>
                        
                        <div className="font-bold text-gray-900 dark:text-white text-base mt-1">
                            {language === 'ar' ? tx.itemNameAr : tx.itemNameEn}
                        </div>
                        
                        <div className="flex justify-between items-center mt-1">
                            <span className={\`flex items-center gap-1.5 text-sm font-bold \${tx.type === 'transfer' ? 'text-blue-600' : tx.type === 'usage' ? 'text-orange-600' : 'text-green-600'}\`}>
                                {t[tx.type]}
                            </span>
                            <span className="font-bold text-gray-700 dark:text-gray-300">
                                {tx.quantity} <span className="text-xs font-normal">{tx.unit}</span>
                            </span>
                        </div>
                    </div>
                ))}
                {filteredReportTx.length === 0 && (
                    <div className="px-6 py-12 text-center text-gray-400 italic">
                        {t.noTransactionsFound}
                    </div>
                )}
            </div>
`;
    reportsCode = reportsCode.substring(0, insertPos) + mobileLayout + reportsCode.substring(insertPos);
    fs.writeFileSync('components/admin/AdminReports.tsx', reportsCode, 'utf8');
    console.log('Patched AdminReports.tsx');
  }
}
