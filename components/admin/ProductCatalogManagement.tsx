import React, { useState } from 'react';
import { CatalogItem, Language } from '../../types';
import { TRANSLATIONS } from '../../constants';
import { Plus, Edit2, Trash2, Search, X, Check } from 'lucide-react';
import { supabase } from '../../services/supabase';

interface ProductCatalogManagementProps {
    catalog: CatalogItem[];
    language: Language;
}

const ProductCatalogManagement: React.FC<ProductCatalogManagementProps> = ({ catalog, language }) => {
    const t = TRANSLATIONS[language];
    const [search, setSearch] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);

    const [form, setForm] = useState<Partial<CatalogItem>>({
        nameEn: '', nameAr: '', description: '', category: '', unit: '', minThreshold: 0, barcode: ''
    });

    const filteredCatalog = catalog.filter(c => {
        const query = search.toLowerCase();
        return c.nameEn.toLowerCase().includes(query) || c.nameAr.includes(query) || (c.barcode && c.barcode.toLowerCase().includes(query));
    });

    const handleOpenModal = (item?: CatalogItem) => {
        if (item) {
            setEditingItem(item);
            setForm(item);
        } else {
            setEditingItem(null);
            setForm({ nameEn: '', nameAr: '', description: '', category: '', unit: '', minThreshold: 0, barcode: '' });
        }
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingItem) {
                const { error } = await supabase.from('product_catalog').update({
                    name_en: form.nameEn,
                    name_ar: form.nameAr,
                    description: form.description,
                    category: form.category,
                    unit: form.unit,
                    min_threshold: form.minThreshold,
                    barcode: form.barcode
                }).eq('id', editingItem.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('product_catalog').insert({
                    name_en: form.nameEn,
                    name_ar: form.nameAr,
                    description: form.description,
                    category: form.category,
                    unit: form.unit,
                    min_threshold: form.minThreshold,
                    barcode: form.barcode
                });
                if (error) throw error;
            }
            setIsModalOpen(false);
            // We should invalidate queries here, but relying on realtime or user refreshing for now is ok
            // Ideally we pass a queryClient.invalidateQueries(['catalog']) from the parent.
            window.location.reload(); // Simple brute force for now since this is admin config
        } catch (err) {
            console.error("Failed to save catalog item", err);
            alert("Error saving item");
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Are you sure you want to delete this catalog item? Existing inventory items won't be deleted, but this will no longer be available for selection.")) return;
        try {
            const { error } = await supabase.from('product_catalog').delete().eq('id', id);
            if (error) throw error;
            window.location.reload();
        } catch (err) {
            console.error("Failed to delete", err);
            alert("Error deleting item");
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 transition-colors">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white font-arabic">Product Catalog (Master List)</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Manage the official list of products available to branches.</p>
                </div>
                <button 
                    onClick={() => handleOpenModal()}
                    className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 transition-colors font-medium"
                >
                    <Plus className="w-5 h-5" />
                    {language === 'ar' ? 'إضافة منتج' : 'Add Product'}
                </button>
            </div>

            <div className="mb-6 relative">
                <input
                    type="text"
                    placeholder={t.searchPlaceholder}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 rtl:pr-10 rtl:pl-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-brand-500"
                />
                <Search className="w-5 h-5 text-gray-400 absolute left-3 rtl:right-3 rtl:left-auto top-3.5" />
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left rtl:text-right">
                    <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
                            <th className="pb-3 px-4">Name (En)</th>
                            <th className="pb-3 px-4 font-arabic">Name (Ar)</th>
                            <th className="pb-3 px-4">Category</th>
                            <th className="pb-3 px-4">Unit</th>
                            <th className="pb-3 px-4 text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {filteredCatalog.map(item => (
                            <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">{item.nameEn}</td>
                                <td className="py-3 px-4 font-medium text-gray-900 dark:text-white font-arabic">{item.nameAr}</td>
                                <td className="py-3 px-4 text-sm text-gray-500">{item.category}</td>
                                <td className="py-3 px-4 text-sm text-gray-500">{item.unit}</td>
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
                                    No products found in catalog.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold dark:text-white">{editingItem ? 'Edit Product' : 'Add Product'}</h3>
                            <button onClick={() => setIsModalOpen(false)}><X className="w-5 h-5 text-gray-500" /></button>
                        </div>
                        <form onSubmit={handleSave} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm mb-1 dark:text-gray-300">Name (En)</label>
                                    <input required type="text" value={form.nameEn} onChange={e => setForm({...form, nameEn: e.target.value})} className="w-full border p-2 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                                </div>
                                <div>
                                    <label className="block text-sm mb-1 dark:text-gray-300 font-arabic">Name (Ar)</label>
                                    <input required type="text" value={form.nameAr} onChange={e => setForm({...form, nameAr: e.target.value})} className="w-full border p-2 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm mb-1 dark:text-gray-300">Category</label>
                                    <input required type="text" value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="w-full border p-2 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                                </div>
                                <div>
                                    <label className="block text-sm mb-1 dark:text-gray-300">Unit (e.g. KG, PCS)</label>
                                    <input required type="text" value={form.unit} onChange={e => setForm({...form, unit: e.target.value})} className="w-full border p-2 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm mb-1 dark:text-gray-300">Default Min Threshold</label>
                                    <input required type="number" min="0" value={form.minThreshold} onChange={e => setForm({...form, minThreshold: Number(e.target.value)})} className="w-full border p-2 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                                </div>
                                <div>
                                    <label className="block text-sm mb-1 dark:text-gray-300">Barcode</label>
                                    <input type="text" value={form.barcode} onChange={e => setForm({...form, barcode: e.target.value})} className="w-full border p-2 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                                </div>
                            </div>
                            <button type="submit" className="w-full bg-brand-600 text-white p-3 rounded-lg font-bold mt-4">Save Product</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductCatalogManagement;
