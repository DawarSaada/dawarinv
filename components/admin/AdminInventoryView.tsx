import React from 'react';
import { 
  FileSpreadsheet, 
  FileText, 
  AlertTriangle, 
  ExternalLink,
  Trash2 
} from 'lucide-react';
import { InventoryItem, LocationData, Language, LocationId } from '../../types';

interface AdminInventoryViewProps {
  currentInventory: InventoryItem[];
  availableLocations: LocationData[];
  selectedInventoryLocation: string;
  setSelectedInventoryLocation: (id: string) => void;
  t: any;
  language: Language;
  onExportExcel: () => void;
  onExportPDF: () => void;
  onManageLocation: (locationId: LocationId) => void;
  onDeleteItem: (item: InventoryItem) => void;
}

const AdminInventoryView: React.FC<AdminInventoryViewProps> = ({
  currentInventory,
  availableLocations,
  selectedInventoryLocation,
  setSelectedInventoryLocation,
  t,
  language,
  onExportExcel,
  onExportPDF,
  onManageLocation,
  onDeleteItem
}) => {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-8">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{t.inventory}</h2>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{t.selectLocationSub}</p>
        </div>
        <div className="flex gap-2 w-full xl:w-auto overflow-x-auto scrollbar-hide pb-2 sm:pb-0">
          <button onClick={onExportExcel} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 transition-colors text-xs sm:text-sm whitespace-nowrap">
            <FileSpreadsheet className="w-4 h-4" /> {t.exportExcel}
          </button>
          <button onClick={onExportPDF} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 transition-colors text-xs sm:text-sm whitespace-nowrap">
            <FileText className="w-4 h-4" /> {t.exportPDF}
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm mb-8 overflow-hidden">
        <div className="p-3 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700 flex flex-wrap gap-2 overflow-x-auto scrollbar-hide">
          {availableLocations.map(loc => (
            <button
              key={loc.id}
              onClick={() => setSelectedInventoryLocation(loc.id)}
              className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${selectedInventoryLocation === loc.id ? 'bg-brand-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100'}`}
            >
              {loc.id === 'warehouse' ? t.warehouse : loc.id === 'mammal' ? t.mammal : (language === 'ar' ? (loc.nameAr || loc.name) : loc.name)}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left rtl:text-right text-xs sm:text-sm">
            <thead>
              <tr className="bg-gray-50/30 dark:bg-gray-900/30 border-b border-gray-100 dark:border-gray-700">
                <th className="px-4 sm:px-6 py-3 sm:py-4 font-bold text-gray-400 uppercase tracking-tighter sm:tracking-normal">{t.itemName}</th>
                <th className="hidden sm:table-cell px-6 py-4 font-bold text-gray-400 uppercase">{t.category}</th>
                <th className="px-4 sm:px-6 py-3 sm:py-4 font-bold text-gray-400 uppercase">{t.stockLevel}</th>
                <th className="hidden md:table-cell px-6 py-4 font-bold text-gray-400 uppercase">{t.status}</th>
                <th className="px-4 sm:px-6 py-3 sm:py-4 font-bold text-gray-400 uppercase text-right rtl:text-left">{t.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {currentInventory.map(item => (
                <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/50">
                  <td className="px-4 sm:px-6 py-3 sm:py-4 font-medium text-gray-900 dark:text-white truncate max-w-[120px] sm:max-w-none">
                    {language === 'ar' ? item.nameAr : item.nameEn}
                    <div className="text-[9px] text-gray-400 font-normal mt-1 block sm:hidden">
                      {item.category}
                    </div>
                  </td>
                  <td className="hidden sm:table-cell px-6 py-4 text-gray-500">{item.category}</td>
                  <td className="px-4 sm:px-6 py-3 sm:py-4 font-bold">{item.quantity} <span className="text-[10px] font-medium text-gray-400">{item.unit}</span></td>
                  <td className="hidden md:table-cell px-6 py-4">
                    {item.quantity <= item.minThreshold ? (
                      <span className="text-red-600 flex items-center gap-1 text-xs font-bold"><AlertTriangle className="w-3 h-3" /> {t.lowStock}</span>
                    ) : (
                      <span className="text-green-600 text-xs font-bold">{t.inStock}</span>
                    )}
                  </td>
                  <td className="px-4 sm:px-6 py-3 sm:py-4 text-right rtl:text-left">
                    <div className="flex items-center gap-1 justify-end">
                      <button 
                        onClick={() => onManageLocation(selectedInventoryLocation as LocationId)}
                        className="text-brand-600 p-2 hover:bg-brand-50 rounded-lg transition-colors"
                        title={t.manageLocation}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => onDeleteItem(item)}
                        className="text-red-400 p-2 hover:bg-red-50 rounded-lg transition-colors"
                        title={t.delete}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {currentInventory.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-400 italic">{t.noItemsInList}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminInventoryView;
