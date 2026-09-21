import fs from 'fs';

let content = fs.readFileSync('components/admin/AdminInventoryView.tsx', 'utf8');

if (!content.includes('mobileCard={')) {
  const dataTablePos = content.indexOf('<DataTable');
  if (dataTablePos !== -1) {
    const mobileCardCode = `
          mobileCard={(item) => {
            const isLow = item.quantity <= item.lowStockThreshold;
            return (
              <div className="flex flex-col gap-3 py-1">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                      {isAr ? item.nameAr : item.nameEn}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {item.category}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-baseline justify-end gap-1 font-mono font-bold">
                      <span className={isLow ? 'text-danger-600 dark:text-danger-500' : 'text-gray-900 dark:text-gray-100'}>
                        {item.quantity}
                      </span>
                      <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                        {item.unit}
                      </span>
                    </div>
                    {isLow && (
                      <span className="text-2xs font-semibold uppercase text-danger-600 dark:text-danger-500">
                        {t.lowStock}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-2 dark:border-gray-800">
                  <button
                    onClick={() => onManageLocation(selectedInventoryLocation as any)}
                    className="flex h-8 items-center justify-center rounded-lg bg-gray-50 px-3 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                  >
                    {t.manageLocation}
                  </button>
                  {canWriteSelected && (
                    <button
                      onClick={() => onDeleteItem(item)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-danger-600 hover:bg-danger-50 dark:text-danger-500 dark:hover:bg-danger-900/25"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                    </button>
                  )}
                </div>
              </div>
            );
          }}`;
    
    // Insert just before sort={sort}
    content = content.replace('sort={sort}', mobileCardCode + '\n          sort={sort}');
    fs.writeFileSync('components/admin/AdminInventoryView.tsx', content, 'utf8');
    console.log('Patched AdminInventoryView.tsx');
  }
}
