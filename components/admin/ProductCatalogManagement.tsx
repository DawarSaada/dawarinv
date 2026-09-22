import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CatalogItem, Language, Supplier } from '../../types';
import { TRANSLATIONS } from '../../constants';
import { formatUnit } from '../../utils/units';
import { Plus, Edit2, Trash2, Search, X, Check } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useCurrency } from '../AppSettingsProvider';

interface ProductCatalogManagementProps {
    catalog: CatalogItem[];
    suppliers: Supplier[];
    language: Language;
}

const ProductCatalogManagement: React.FC<ProductCatalogManagementProps> = ({ catalog, suppliers, language }) => {
    const t = TRANSLATIONS[language];
    const currency = useCurrency();
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);

    const [form, setForm] = useState<Partial<CatalogItem> & { supplierIds: string[] }>({
        nameEn: '', nameAr: '', description: '', category: '', unit: '', minThreshold: 0, barcode: '', defaultPrice: 0, supplierIds: []
    });

    const filteredCatalog = catalog.filter(c => {
        const query = search.toLowerCase();
        return c.nameEn.toLowerCase().includes(query) || c.nameAr.includes(query) || (c.barcode && c.barcode.toLowerCase().includes(query));
    });

    const handleOpenModal = (item?: CatalogItem) => {
        if (item) {
            setEditingItem(item);
            const assignedSuppliers = suppliers.filter(s => s.suppliedItems?.includes(item.id)).map(s => s.id);
            setForm({ ...item, supplierIds: assignedSuppliers });
        } else {
            setEditingItem(null);
            setForm({ nameEn: '', nameAr: '', description: '', category: '', unit: '', minThreshold: 0, barcode: '', defaultPrice: 0, supplierIds: [] });
        }
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            let productId = editingItem?.id;
            
            if (editingItem) {
                const { error } = await supabase.from('product_catalog').update({
                    name_en: form.nameEn,
                    name_ar: form.nameAr,
                    description: form.description,
                    category: form.category,
                    unit: form.unit,
                    min_threshold: form.minThreshold,
                    barcode: form.barcode,
                    default_price: form.defaultPrice || 0
                }).eq('id', editingItem.id);
                if (error) throw error;
            } else {
                const { data, error } = await supabase.from('product_catalog').insert({
                    name_en: form.nameEn,
                    name_ar: form.nameAr,
                    description: form.description,
                    category: form.category,
                    unit: form.unit,
                    min_threshold: form.minThreshold,
                    barcode: form.barcode,
                    default_price: form.defaultPrice || 0
                }).select().single();
                if (error) throw error;
                productId = data.id;
            }

            // Sync Suppliers
            if (productId && form.supplierIds) {
                const supplierUpdates = suppliers.map(async (supplier) => {
                    const isSelected = form.supplierIds!.includes(supplier.id);
                    const hasItem = supplier.suppliedItems?.includes(productId!);

                    if (isSelected && !hasItem) {
                        const newItems = [...(supplier.suppliedItems || []), productId!];
                        return supabase.from('suppliers').update({ supplied_items: newItems }).eq('id', supplier.id);
                    } else if (!isSelected && hasItem) {
                        const newItems = supplier.suppliedItems!.filter(id => id !== productId);
                        return supabase.from('suppliers').update({ supplied_items: newItems }).eq('id', supplier.id);
                    }
                });
                await Promise.all(supplierUpdates);
                queryClient.invalidateQueries({ queryKey: ['suppliers'] });
            }

            setIsModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['catalog'] });
        } catch (err) {
            console.error("Failed to save catalog item", err);
            alert(language === 'ar' ? 'حدث خطأ أثناء حفظ المنتج' : "Error saving item");
        }
    };

    const handleDelete = async (id: string) => {
        const confirmMsg = language === 'ar' 
            ? "هل أنت متأكد من حذف هذا المنتج من الدليل؟ لن يتم حذف عناصر المخزون الحالية، لكنه لن يكون متاحاً للاختيار مجدداً." 
            : "Are you sure you want to delete this catalog item? Existing inventory items won't be deleted, but this will no longer be available for selection.";
        if (!window.confirm(confirmMsg)) return;
        try {
            const { error } = await supabase.from('product_catalog').delete().eq('id', id);
            if (error) throw error;
            queryClient.invalidateQueries({ queryKey: ['catalog'] });
        } catch (err) {
            console.error("Failed to delete", err);
            alert(language === 'ar' ? 'حدث خطأ أثناء حذف المنتج' : "Error deleting item");
        }
    };

    return (
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-6 transition-colors">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                    <h2 className="text-lg font-semibold tracking-tight text-gray-900 sm:text-xl dark:text-white">{t.catalogMasterList}</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{t.manageCatalogDesc}</p>
                </div>
                <button 
                    onClick={() => handleOpenModal()}
                    className="inline-flex items-center gap-2 rounded-lg bg-brand-700 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-800"
                >
                    <Plus className="w-5 h-5" />
                    {t.addProduct}
                </button>
            </div>

            <div className="mb-6 relative">
                <input
                    type="text"
                    placeholder={t.searchPlaceholder}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 rtl:pr-10 rtl:pl-4 h-10 bg-white text-sm dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25"
                />
                <Search className="w-5 h-5 text-gray-400 absolute left-3 rtl:right-3 rtl:left-auto top-3.5" />
            </div>

            <div className="overflow-x-auto">
                <table className="hidden md:table w-full text-left rtl:text-right">
                    <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-800 text-sm text-gray-500 dark:text-gray-400">
                            <th className="pb-3 px-4">{t.nameEn}</th>
                            <th className="pb-3 px-4 font-arabic">{t.nameAr}</th>
                            <th className="pb-3 px-4">{t.category}</th>
                            <th className="pb-3 px-4">{t.unit}</th>
                            <th className="pb-3 px-4 text-center">{t.actions}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {filteredCatalog.map(item => (
                            <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">{item.nameEn}</td>
                                <td className="py-3 px-4 font-medium text-gray-900 dark:text-white font-arabic">{item.nameAr}</td>
                                <td className="py-3 px-4 text-sm text-gray-500">{item.category}</td>
                                <td className="py-3 px-4 text-sm text-gray-500">{formatUnit(item.unit, language)}</td>
                                <td className="py-3 px-4">
                                    <div className="flex items-center justify-center gap-2">
                                        <button onClick={() => handleOpenModal(item)} className="p-2 text-brand-600 hover:bg-brand-50 rounded-lg">
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => handleDelete(item.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {filteredCatalog.length === 0 && (
                            <tr>
                                <td colSpan={5} className="py-8 text-center text-gray-500">
                                    {t.noProductsInCatalog}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
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
                                <div className="text-xs text-gray-500">{t.category}</div>
                                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">{item.category}</div>
                            </div>
                            <div>
                                <div className="text-xs text-gray-500">{t.unit}</div>
                                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">{formatUnit(item.unit, language)}</div>
                            </div>
                        </div>
                    </div>
                ))}
                {filteredCatalog.length === 0 && (
                    <div className="text-center py-8 text-gray-500 bg-gray-50 dark:bg-gray-900 rounded-xl">
                        {t.noProductsInCatalog}
                    </div>
                )}
            </div>

            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4 pb-4 pt-[max(env(safe-area-inset-top,1rem),1rem)]">
                    <div className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-lg p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold dark:text-white">{editingItem ? t.editProduct : t.addProduct}</h3>
                            <button onClick={() => setIsModalOpen(false)}><X className="w-5 h-5 text-gray-500" /></button>
                        </div>
                        <form onSubmit={handleSave} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm mb-1 dark:text-gray-300">{t.nameEn}</label>
                                    <input required type="text" value={form.nameEn} onChange={e => setForm({...form, nameEn: e.target.value})} className="w-full border p-2 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                                </div>
                                <div>
                                    <label className="block text-sm mb-1 dark:text-gray-300 font-arabic">{t.nameAr}</label>
                                    <input required type="text" value={form.nameAr} onChange={e => setForm({...form, nameAr: e.target.value})} className="w-full border p-2 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm mb-1 dark:text-gray-300">{t.category}</label>
                                    <input required type="text" value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="w-full border p-2 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                                </div>
                                <div>
                                    <label className="block text-sm mb-1 dark:text-gray-300">{t.unit} ({t.unitPlaceholderHint})</label>
                                    <input required type="text" value={form.unit} onChange={e => setForm({...form, unit: e.target.value})} className="w-full border p-2 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm mb-1 dark:text-gray-300">{t.defaultMinThreshold}</label>
                                    <input required type="number" min="0" value={form.minThreshold} onChange={e => setForm({...form, minThreshold: Number(e.target.value)})} className="w-full border p-2 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{language === 'ar' ? 'الباركود' : 'Barcode'}</label>
                                    <input type="text" value={form.barcode} onChange={e => setForm({...form, barcode: e.target.value})} className="w-full border p-2 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{language === 'ar' ? `سعر الوحدة الافتراضي (${currency})` : `Default Unit Price (${currency})`}</label>
                                    <input type="number" step="0.01" min="0" value={form.defaultPrice || ''} onChange={e => setForm({...form, defaultPrice: parseFloat(e.target.value) || 0})} className="w-full border p-2 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                                </div>
                            </div>
                            <div className="pt-4 mt-2 border-t border-gray-200 dark:border-gray-800">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    {language === 'ar' ? 'الموردين (اختياري)' : 'Suppliers (Optional)'}
                                </label>
                                <div className="border border-gray-200 dark:border-gray-800 rounded-lg max-h-40 overflow-y-auto p-2 bg-gray-50 dark:bg-gray-900 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {suppliers.map(supplier => (
                                         <label key={supplier.id} className="flex items-center gap-2 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded cursor-pointer transition-colors">
                                            <input 
                                                type="checkbox" 
                                                className="rounded text-brand-600 focus:ring-brand-500"
                                                checked={form.supplierIds?.includes(supplier.id) || false}
                                                onChange={(e) => {
                                                    const currentIds = form.supplierIds || [];
                                                    if (e.target.checked) {
                                                        setForm({...form, supplierIds: [...currentIds, supplier.id]});
                                                    } else {
                                                        setForm({...form, supplierIds: currentIds.filter(id => id !== supplier.id)});
                                                    }
                                                }}
                                            />
                                            <span className="text-sm dark:text-white line-clamp-1" title={language === 'ar' ? supplier.nameAr : supplier.nameEn}>
                                                {language === 'ar' ? supplier.nameAr : supplier.nameEn}
                                            </span>
                                        </label>
                                    ))}
                                    {suppliers.length === 0 && (
                                        <div className="text-sm text-gray-500 p-2 col-span-2">
                                            {language === 'ar' ? 'لا يوجد موردين' : 'No suppliers available'}
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            <button type="submit" className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 rounded-xl transition-colors mt-4">{t.saveProduct}</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductCatalogManagement;
