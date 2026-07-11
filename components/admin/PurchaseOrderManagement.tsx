import React, { useState } from 'react';
import { PurchaseOrder, Language, Supplier, CatalogItem } from '../../types';
import { TRANSLATIONS } from '../../constants';
import { Search, Plus, Eye, ShoppingCart, CheckCircle, FileText, ArrowRight } from 'lucide-react';

interface PurchaseOrderManagementProps {
  purchaseOrders: PurchaseOrder[];
  suppliers: Supplier[];
  catalog: CatalogItem[];
  onCreatePO: (po: any, items: any[]) => void;
  onUpdateStatus: (id: string, status: string) => void;
  onReceivePO: (poId: string, items: any[], performedBy: string) => void;
  userName: string;
  language: Language;
  onOpenCreateModal: () => void;
  onOpenViewModal: (po: PurchaseOrder) => void;
  onOpenReceiveModal: (po: PurchaseOrder) => void;
}

const PurchaseOrderManagement: React.FC<PurchaseOrderManagementProps> = ({ 
  purchaseOrders, suppliers, catalog, onCreatePO, onUpdateStatus, onReceivePO, userName, language,
  onOpenCreateModal, onOpenViewModal, onOpenReceiveModal
}) => {
  const t = TRANSLATIONS[language];
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredPOs = purchaseOrders.filter(po => {
    const matchesSearch = po.poNumber.toLowerCase().includes(search.toLowerCase()) || 
                          (po.supplier?.nameEn || '').toLowerCase().includes(search.toLowerCase()) ||
                          (po.supplier?.nameAr || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || po.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'draft': return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
      case 'pending': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'approved': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'received': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'cancelled': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusText = (status: string) => {
    if (language === 'ar') {
      switch(status) {
        case 'draft': return 'مسودة';
        case 'pending': return 'قيد الانتظار';
        case 'approved': return 'موافق عليه';
        case 'received': return 'مستلم';
        case 'cancelled': return 'ملغى';
        default: return status;
      }
    }
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <ShoppingCart className="w-8 h-8 text-brand-500" />
            {language === 'ar' ? 'أوامر الشراء' : 'Purchase Orders'}
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {language === 'ar' ? 'إدارة المشتريات والموردين' : 'Manage procurement and supplier orders'}
          </p>
        </div>
        <button 
          onClick={onOpenCreateModal}
          className="w-full sm:w-auto px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2 shadow-sm shadow-brand-500/20"
        >
          <Plus className="w-5 h-5" />
          {language === 'ar' ? 'إنشاء أمر شراء' : 'Create PO'}
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className={`absolute ${language === 'ar' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5`} />
          <input
            type="text"
            placeholder={language === 'ar' ? 'ابحث برقم الأمر أو المورد...' : 'Search by PO number or supplier...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-brand-500 text-gray-900 dark:text-white ${language === 'ar' ? 'pr-10 pl-4' : ''}`}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-brand-500 text-gray-900 dark:text-white"
        >
          <option value="all">{language === 'ar' ? 'جميع الحالات' : 'All Statuses'}</option>
          <option value="draft">{language === 'ar' ? 'مسودة' : 'Draft'}</option>
          <option value="pending">{language === 'ar' ? 'قيد الانتظار' : 'Pending'}</option>
          <option value="approved">{language === 'ar' ? 'موافق عليه' : 'Approved'}</option>
          <option value="received">{language === 'ar' ? 'مستلم' : 'Received'}</option>
          <option value="cancelled">{language === 'ar' ? 'ملغى' : 'Cancelled'}</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPOs.map(po => (
          <div key={po.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col group">
            <div className="p-6 flex-1 flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white font-mono">
                    {po.poNumber}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {language === 'ar' ? po.supplier?.nameAr : po.supplier?.nameEn}
                  </p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${getStatusColor(po.status)}`}>
                  {getStatusText(po.status)}
                </span>
              </div>

              <div className="space-y-2 mt-auto">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">{language === 'ar' ? 'التاريخ' : 'Date'}</span>
                  <span className="font-medium dark:text-white">{new Date(po.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">{language === 'ar' ? 'العناصر' : 'Items'}</span>
                  <span className="font-medium dark:text-white">{po.items?.length || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">{language === 'ar' ? 'الإجمالي' : 'Total'}</span>
                  <span className="font-bold text-brand-600 dark:text-brand-400">SAR {po.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-50 dark:bg-gray-900/50 px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
              <button 
                onClick={() => onOpenViewModal(po)}
                className="text-gray-600 hover:text-brand-600 dark:text-gray-400 dark:hover:text-brand-400 flex items-center gap-2 text-sm font-medium transition-colors"
              >
                <Eye className="w-4 h-4" />
                {language === 'ar' ? 'عرض التفاصيل' : 'View Details'}
              </button>
              
              {po.status === 'approved' && (
                <button 
                  onClick={() => onOpenReceiveModal(po)}
                  className="text-green-600 hover:text-green-700 bg-green-50 hover:bg-green-100 dark:bg-green-900/30 dark:hover:bg-green-900/50 px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm font-bold transition-colors"
                >
                  <CheckCircle className="w-4 h-4" />
                  {language === 'ar' ? 'استلام' : 'Receive'}
                </button>
              )}
            </div>
          </div>
        ))}

        {filteredPOs.length === 0 && (
          <div className="col-span-full py-12 text-center text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="text-lg">{language === 'ar' ? 'لم يتم العثور على أوامر شراء.' : 'No purchase orders found.'}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PurchaseOrderManagement;
