import React from 'react';
import { 
  Search, 
  Plus, 
  Filter, 
  Download, 
  FileText, 
  ArrowUpDown, 
  LayoutGrid, 
  List as ListIcon, 
  Grid3X3, 
  ChevronDown, 
  ArrowRightLeft,
  Loader2,
  Camera
} from 'lucide-react';
import { Language } from '../../types';

interface InventoryToolbarProps {
  t: any;
  search: string;
  setSearch: (val: string) => void;
  selectedCategory: string;
  setSelectedCategory: (val: string) => void;
  categories: string[];
  stockStatusFilter: 'all' | 'inStock' | 'lowStock';
  setStockStatusFilter: (val: 'all' | 'inStock' | 'lowStock') => void;
  sortBy: 'name' | 'quantity' | 'lastUpdated';
  setSortBy: (val: 'name' | 'quantity' | 'lastUpdated') => void;
  sortOrder: 'asc' | 'desc';
  setSortOrder: (val: 'asc' | 'desc') => void;
  viewMode: 'grid' | 'list' | 'compact';
  setViewMode: (val: 'grid' | 'list' | 'compact') => void;
  isGlobalView: boolean;
  selectedItemIds: Set<string>;
  toggleSelectAll: () => void;
  filteredItemsCount: number;
  onExportExcel: () => void;
  onSmartUpload: () => void;
  onOpenTransfer: () => void;
  onAddItem: () => void;
  canEditItem: boolean;
  isProcessingPdf: boolean;
  activeDropdown: 'view' | 'sort' | 'filter' | null;
  setActiveDropdown: (val: 'view' | 'sort' | 'filter' | null) => void;
  lowStockCount: number;
  language: Language;
  onScanClick: () => void;
}

const InventoryToolbar: React.FC<InventoryToolbarProps> = ({
  t,
  search,
  setSearch,
  selectedCategory,
  setSelectedCategory,
  categories,
  stockStatusFilter,
  setStockStatusFilter,
  sortBy,
  setSortBy,
  sortOrder,
  setSortOrder,
  viewMode,
  setViewMode,
  isGlobalView,
  selectedItemIds,
  toggleSelectAll,
  filteredItemsCount,
  onExportExcel,
  onSmartUpload,
  onOpenTransfer,
  onAddItem,
  canEditItem,
  isProcessingPdf,
  activeDropdown,
  setActiveDropdown,
  lowStockCount,
  language,
  onScanClick
}) => {
  return (
    <>
      <div className="flex flex-col lg:flex-row flex-wrap justify-between items-start lg:items-center gap-4 mb-6 relative z-40">
        {/* Search & Filter */}
        <div className="flex flex-1 gap-2 flex-wrap sm:flex-nowrap">
          <div className="relative flex-1 min-w-[200px] w-full max-w-md">
            <input
              type="text"
              placeholder={t.searchPlaceholder + " / Barcode"}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-10 rtl:pr-10 rtl:pl-10 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none text-gray-900 dark:text-white transition-all text-sm"
            />
            <Search className="w-4 h-4 text-gray-400 absolute left-3 rtl:right-3 rtl:left-auto top-3.5" />
            <button 
                type="button"
                onClick={onScanClick}
                className="absolute right-3 rtl:left-3 rtl:right-auto top-3 text-gray-400 hover:text-brand-500 cursor-pointer" 
                title="Scan Barcode"
            >
               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5v14"/><path d="M8 5v14"/><path d="M12 5v14"/><path d="M17 5v14"/><path d="M21 5v14"/></svg>
            </button>
          </div>

          <div className="flex items-center gap-2 pb-1 sm:pb-0">
            {/* View Dropdown */}
            <div className="relative shrink-0">
              <button 
                onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === 'view' ? null : 'view'); }}
                className={`h-11 px-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-200 text-sm ${activeDropdown === 'view' ? 'ring-2 ring-brand-500' : ''}`}
              >
                  <LayoutGrid className="w-4 h-4" />
                  <span className="hidden md:inline">{t.view}</span>
                  <ChevronDown className={`w-3 h-3 transition-transform ${activeDropdown === 'view' ? 'rotate-180' : ''}`} />
              </button>
              {activeDropdown === 'view' && (
                <div className="absolute top-full left-0 rtl:right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 p-2 z-30">
                     <p className="text-[10px] font-bold text-gray-400 px-3 py-2 uppercase">{t.view}</p>
                     <button onClick={() => { setViewMode('grid'); setActiveDropdown(null); }} className={`w-full text-left rtl:text-right px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${viewMode === 'grid' ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400' : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200'}`}>
                         <LayoutGrid className="w-4 h-4" /> {t.tiles}
                     </button>
                     <button onClick={() => { setViewMode('list'); setActiveDropdown(null); }} className={`w-full text-left rtl:text-right px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${viewMode === 'list' ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400' : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200'}`}>
                         <ListIcon className="w-4 h-4" /> {t.list}
                     </button>
                     <button onClick={() => { setViewMode('compact'); setActiveDropdown(null); }} className={`w-full text-left rtl:text-right px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${viewMode === 'compact' ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400' : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200'}`}>
                         <Grid3X3 className="w-4 h-4" /> {t.box}
                     </button>
                </div>
              )}
            </div>

            {/* Sort Dropdown */}
            <div className="relative shrink-0">
              <button 
                onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === 'sort' ? null : 'sort'); }}
                className={`h-11 px-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-200 text-sm ${activeDropdown === 'sort' ? 'ring-2 ring-brand-500' : ''}`}
              >
                  <ArrowUpDown className="w-4 h-4" />
                  <span className="hidden md:inline">{t.sortBy}</span>
                  <ChevronDown className={`w-3 h-3 transition-transform ${activeDropdown === 'sort' ? 'rotate-180' : ''}`} />
              </button>
              {activeDropdown === 'sort' && (
                <div className="absolute top-full left-0 rtl:right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 p-2 z-30">
                    <p className="text-[10px] font-bold text-gray-400 px-3 py-2 uppercase">{t.sortBy}</p>
                    <button onClick={() => { setSortBy('name'); setActiveDropdown(null); }} className={`w-full text-left rtl:text-right px-3 py-2 rounded-lg text-sm ${sortBy === 'name' ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400' : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200'}`}>{t.sortName}</button>
                    <button onClick={() => { setSortBy('quantity'); setActiveDropdown(null); }} className={`w-full text-left rtl:text-right px-3 py-2 rounded-lg text-sm ${sortBy === 'quantity' ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400' : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200'}`}>{t.sortQuantity}</button>
                    <button onClick={() => { setSortBy('lastUpdated'); setActiveDropdown(null); }} className={`w-full text-left rtl:text-right px-3 py-2 rounded-lg text-sm ${sortBy === 'lastUpdated' ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400' : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200'}`}>{t.sortDate}</button>
                    
                    <div className="my-2 border-t border-gray-100 dark:border-gray-700"></div>
                    
                    <p className="text-[10px] font-bold text-gray-400 px-3 py-2 uppercase">{t.order}</p>
                    <button onClick={() => { setSortOrder('asc'); setActiveDropdown(null); }} className={`w-full text-left rtl:text-right px-3 py-2 rounded-lg text-sm ${sortOrder === 'asc' ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400' : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200'}`}>{t.ascending}</button>
                    <button onClick={() => { setSortOrder('desc'); setActiveDropdown(null); }} className={`w-full text-left rtl:text-right px-3 py-2 rounded-lg text-sm ${sortOrder === 'desc' ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400' : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200'}`}>{t.descending}</button>
                </div>
              )}
            </div>

            {/* Filter Dropdown */}
            <div className="relative shrink-0">
              <button 
                onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === 'filter' ? null : 'filter'); }}
                className={`h-11 px-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-200 text-sm ${activeDropdown === 'filter' ? 'ring-2 ring-brand-500' : ''}`}
              >
                <Filter className="w-4 h-4" />
                <span className="hidden md:inline">{t.filter}</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${activeDropdown === 'filter' ? 'rotate-180' : ''}`} />
              </button>
              {activeDropdown === 'filter' && (
                <div className="absolute top-full left-0 rtl:right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 p-2 z-30">
                    <p className="text-[10px] font-bold text-gray-400 px-3 py-2 uppercase">{t.category}</p>
                    <button onClick={() => { setSelectedCategory('all'); setActiveDropdown(null); }} className={`w-full text-left rtl:text-right px-3 py-2 rounded-lg text-sm ${selectedCategory === 'all' ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400' : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200'}`}>{t.allStatuses}</button>
                    {categories.map(cat => (
                        <button key={cat} onClick={() => { setSelectedCategory(cat); setActiveDropdown(null); }} className={`w-full text-left rtl:text-right px-3 py-2 rounded-lg text-sm ${selectedCategory === cat ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400' : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200'}`}>{cat}</button>
                    ))}
                    <div className="my-2 border-t border-gray-100 dark:border-gray-700"></div>
                    <p className="text-[10px] font-bold text-gray-400 px-3 py-2 uppercase">{t.stockStatus}</p>
                    <button onClick={() => { setStockStatusFilter('all'); setActiveDropdown(null); }} className={`w-full text-left rtl:text-right px-3 py-2 rounded-lg text-sm ${stockStatusFilter === 'all' ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400' : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200'}`}>{t.allStatuses}</button>
                    <button onClick={() => { setStockStatusFilter('lowStock'); setActiveDropdown(null); }} className={`w-full text-left rtl:text-right px-3 py-2 rounded-lg text-sm ${stockStatusFilter === 'lowStock' ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400' : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200'}`}>{t.lowStock}</button>
                    <button onClick={() => { setStockStatusFilter('inStock'); setActiveDropdown(null); }} className={`w-full text-left rtl:text-right px-3 py-2 rounded-lg text-sm ${stockStatusFilter === 'inStock' ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400' : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200'}`}>{t.inStock}</button>
                </div>
              )}
            </div>

            {!isGlobalView && (
              <button 
                onClick={toggleSelectAll}
                className={`h-11 px-3 border rounded-xl shadow-sm flex items-center gap-2 transition-colors shrink-0 ${selectedItemIds.size === filteredItemsCount && filteredItemsCount > 0 ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50'}`}
              >
                <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${selectedItemIds.size === filteredItemsCount && filteredItemsCount > 0 ? 'bg-white border-white' : 'border-gray-300 dark:border-gray-600'}`}>
                  {selectedItemIds.size === filteredItemsCount && filteredItemsCount > 0 && <div className="w-2 h-2 bg-brand-600 rounded-sm"></div>}
                </div>
                <span className="hidden md:inline text-sm">{selectedItemIds.size === filteredItemsCount && filteredItemsCount > 0 ? t.deselectAll : t.selectAll}</span>
              </button>
            )}
          </div>
        </div>

        {/* Actions */}
        {!isGlobalView && (
          <div className="flex flex-wrap gap-2 w-full lg:w-auto">
             <button onClick={onExportExcel} className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors shadow-lg shadow-green-200 dark:shadow-none text-sm">
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Excel</span>
             </button>
             <button onClick={onSmartUpload} disabled={isProcessingPdf} className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors shadow-lg shadow-blue-200 dark:shadow-none disabled:opacity-50 text-sm">
                {isProcessingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                <span className="hidden sm:inline">{t.smartUpload}</span>
             </button>
             <button onClick={onScanClick} className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium transition-colors shadow-lg shadow-purple-200 dark:shadow-none text-sm">
                <Camera className="w-4 h-4" />
                <span className="hidden sm:inline">{t.scanBarcode || 'Scan'}</span>
             </button>
             <button onClick={onOpenTransfer} className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm text-sm">
                <ArrowRightLeft className="w-4 h-4" />
                <span className="hidden sm:inline">{t.transfer}</span>
             </button>
             {canEditItem && (
                <button onClick={onAddItem} className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-medium transition-colors shadow-lg shadow-brand-200 dark:shadow-none text-sm">
                    <Plus className="w-4 h-4" />
                    <span className="hidden sm:inline">{t.addItem}</span>
                </button>
             )}
          </div>
        )}
      </div>

      {/* Stats Cards - Mobile Only */}
      <div className="grid grid-cols-2 gap-3 mb-6 lg:hidden">
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
              <p className="text-xs text-gray-500 uppercase font-bold">{t.totalItems}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{filteredItemsCount}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
              <p className="text-xs text-gray-500 uppercase font-bold">{t.lowStock}</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{lowStockCount}</p>
          </div>
      </div>
    </>
  );
};

export default InventoryToolbar;
