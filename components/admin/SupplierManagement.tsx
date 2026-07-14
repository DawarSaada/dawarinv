import React, { useState } from 'react';
import { Supplier, Language } from '../../types';
import { TRANSLATIONS } from '../../constants';
import { Search, Plus, Edit2, Trash2, Phone, Mail, MapPin, Building2 } from 'lucide-react';

interface SupplierManagementProps {
  suppliers: Supplier[];
  onAdd: (supplier: Omit<Supplier, 'id' | 'createdAt'>) => void;
  onEdit: (supplier: Supplier) => void;
  onDelete: (id: string) => void;
  language: Language;
  catalog: any[];
}

const SupplierManagement: React.FC<SupplierManagementProps> = ({ suppliers, onAdd, onEdit, onDelete, language, catalog }) => {
  const t = TRANSLATIONS[language];
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const [formData, setFormData] = useState({
    nameEn: '',
    nameAr: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    suppliedItems: [] as string[]
  });

  const filteredSuppliers = suppliers.filter(s => 
    s.nameEn.toLowerCase().includes(search.toLowerCase()) || 
    s.nameAr.toLowerCase().includes(search.toLowerCase()) ||
    (s.contactPerson || '').toLowerCase().includes(search.toLowerCase())
  );

  const openAddModal = () => {
    setEditingSupplier(null);
    setFormData({ nameEn: '', nameAr: '', contactPerson: '', email: '', phone: '', address: '', suppliedItems: [] });
    setIsModalOpen(true);
  };

  const openEditModal = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      nameEn: supplier.nameEn,
      nameAr: supplier.nameAr,
      contactPerson: supplier.contactPerson || '',
      email: supplier.email || '',
      phone: supplier.phone || '',
      address: supplier.address || '',
      suppliedItems: supplier.suppliedItems || []
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingSupplier) {
      onEdit({ ...editingSupplier, ...formData });
    } else {
      onAdd(formData);
    }
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Building2 className="w-8 h-8 text-brand-500" />
            {language === 'ar' ? 'إدارة الموردين' : 'Supplier Management'}
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {language === 'ar' ? 'إدارة بيانات الموردين وجهات الاتصال' : 'Manage supplier details and contacts'}
          </p>
        </div>
        <button 
          onClick={openAddModal}
          className="w-full sm:w-auto px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2 shadow-sm shadow-brand-500/20"
        >
          <Plus className="w-5 h-5" />
          {language === 'ar' ? 'إضافة مورد' : 'Add Supplier'}
        </button>
      </div>

      {/* Search Filter */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="relative max-w-md">
          <Search className={`absolute ${language === 'ar' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5`} />
          <input
            type="text"
            placeholder={language === 'ar' ? 'ابحث عن مورد...' : 'Search suppliers...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-brand-500 text-gray-900 dark:text-white ${language === 'ar' ? 'pr-10 pl-4' : ''}`}
          />
        </div>
      </div>

      {/* Grid of Suppliers */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredSuppliers.map(supplier => (
          <div key={supplier.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col group">
            <div className="p-6 flex-1">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {language === 'ar' ? supplier.nameAr : supplier.nameEn}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {language === 'ar' ? supplier.nameEn : supplier.nameAr}
                  </p>
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => openEditModal(supplier)}
                    className="p-2 text-blue-600 bg-blue-50 dark:bg-blue-900/30 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => {
                      if (window.confirm(language === 'ar' ? 'هل أنت متأكد من حذف هذا المورد؟' : 'Are you sure you want to delete this supplier?')) {
                        onDelete(supplier.id);
                      }
                    }}
                    className="p-2 text-red-600 bg-red-50 dark:bg-red-900/30 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-3 mt-6">
                {supplier.contactPerson && (
                  <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                    <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0">
                      <span className="font-bold">{supplier.contactPerson.charAt(0)}</span>
                    </div>
                    <span>{supplier.contactPerson}</span>
                  </div>
                )}
                {supplier.phone && (
                  <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <a href={`tel:${supplier.phone}`} className="hover:text-brand-600">{supplier.phone}</a>
                  </div>
                )}
                {supplier.email && (
                  <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <a href={`mailto:${supplier.email}`} className="hover:text-brand-600">{supplier.email}</a>
                  </div>
                )}
                {supplier.address && (
                  <div className="flex items-start gap-3 text-sm text-gray-600 dark:text-gray-300">
                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                    <span className="line-clamp-2">{supplier.address}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {filteredSuppliers.length === 0 && (
          <div className="col-span-full py-12 text-center text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
            <Building2 className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="text-lg">{language === 'ar' ? 'لم يتم العثور على موردين.' : 'No suppliers found.'}</p>
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                {editingSupplier 
                  ? (language === 'ar' ? 'تعديل بيانات المورد' : 'Edit Supplier') 
                  : (language === 'ar' ? 'إضافة مورد جديد' : 'Add New Supplier')}
              </h3>
            </div>
            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name (English) *</label>
                  <input required type="text" value={formData.nameEn} onChange={e => setFormData({...formData, nameEn: e.target.value})} className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name (Arabic) *</label>
                  <input required type="text" value={formData.nameAr} onChange={e => setFormData({...formData, nameAr: e.target.value})} className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-right dark:text-white" dir="rtl" />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {language === 'ar' ? 'اسم جهة الاتصال' : 'Contact Person'}
                </label>
                <input type="text" value={formData.contactPerson} onChange={e => setFormData({...formData, contactPerson: e.target.value})} className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg dark:text-white" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {language === 'ar' ? 'البريد الإلكتروني' : 'Email'}
                  </label>
                  <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg dark:text-white" dir="ltr" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {language === 'ar' ? 'رقم الهاتف' : 'Phone'}
                  </label>
                  <input type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg dark:text-white" dir="ltr" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {language === 'ar' ? 'العنوان' : 'Address'}
                </label>
                <textarea rows={3} value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg resize-none dark:text-white" />
              </div>

              <div className="pt-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {language === 'ar' ? 'العناصر الموردة (اختر من الفهرس)' : 'Supplied Items (Select from Catalog)'}
                </label>
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg max-h-48 overflow-y-auto p-2 bg-gray-50 dark:bg-gray-900 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {catalog.map(item => (
                    <label key={item.id} className="flex items-center gap-2 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded cursor-pointer transition-colors">
                      <input 
                        type="checkbox" 
                        className="rounded text-brand-600 focus:ring-brand-500"
                        checked={formData.suppliedItems.includes(item.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({...formData, suppliedItems: [...formData.suppliedItems, item.id]});
                          } else {
                            setFormData({...formData, suppliedItems: formData.suppliedItems.filter(id => id !== item.id)});
                          }
                        }}
                      />
                      <span className="text-sm dark:text-white line-clamp-1" title={language === 'ar' ? item.nameAr : item.nameEn}>
                        {language === 'ar' ? item.nameAr : item.nameEn}
                      </span>
                    </label>
                  ))}
                  {catalog.length === 0 && (
                    <div className="text-sm text-gray-500 p-2 col-span-2">
                      {language === 'ar' ? 'لا توجد عناصر في الفهرس' : 'No items in catalog'}
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 dark:border-gray-700 mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 rounded-lg transition-colors">
                  {t.cancel}
                </button>
                <button type="submit" className="px-6 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors font-medium">
                  {editingSupplier ? (language === 'ar' ? 'تحديث' : 'Update') : (language === 'ar' ? 'إضافة' : 'Add')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierManagement;
