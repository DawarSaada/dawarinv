import React, { useState, useEffect } from 'react';
import { InventoryItem, Language, CatalogItem } from '../types';
import { TRANSLATIONS } from '../constants';
import { Package, Plus, X, Save, AlignLeft, AlertCircle, Camera } from 'lucide-react';
import BarcodeScanner from './BarcodeScanner';

interface AddItemModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (item: Omit<InventoryItem, 'id' | 'lastUpdated'>) => void;
    language: Language;
    initialData?: InventoryItem | null;
    existingItems: InventoryItem[];
    catalog: CatalogItem[];
}

const AddItemModal: React.FC<AddItemModalProps> = ({ isOpen, onClose, onSubmit, language, initialData, existingItems, catalog }) => {
    const t = TRANSLATIONS[language];
    
    const [newItem, setNewItem] = useState({
        nameEn: '',
        nameAr: '',
        description: '',
        category: '',
        quantity: '',
        unit: '',
        minThreshold: '',
        expirationDate: '',
        barcode: '',
        catalogId: ''
    });

    const [error, setError] = useState('');
    const [showScanner, setShowScanner] = useState(false);

    // Populate form if editing
    useEffect(() => {
        if (isOpen && initialData) {
            setNewItem({
                nameEn: initialData.nameEn,
                nameAr: initialData.nameAr,
                description: initialData.description || '',
                category: initialData.category,
                quantity: initialData.quantity.toString(),
                unit: initialData.unit,
                minThreshold: initialData.minThreshold.toString(),
                expirationDate: initialData.expirationDate || '',
                barcode: initialData.barcode || '',
                catalogId: '' // We don't strictly link them back yet, but could try to find a match
            });
            
            // Try to find matching catalog item by nameEn
            const match = catalog?.find(c => c.nameEn === initialData.nameEn);
            if (match) {
                setNewItem(prev => ({...prev, catalogId: match.id}));
            }
            
            setError('');
        } else if (isOpen && !initialData) {
            // Reset if opening in Add mode
            setNewItem({ nameEn: '', nameAr: '', description: '', category: '', quantity: '', unit: '', minThreshold: '', expirationDate: '', barcode: '', catalogId: '' });
            setError('');
        }
    }, [isOpen, initialData, catalog]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        const qty = Number(newItem.quantity);
        const threshold = Number(newItem.minThreshold);

        // Validation: Ensure numbers are valid and non-negative
        if (isNaN(qty) || qty < 0) {
            setError(language === 'ar' ? 'الكمية يجب أن تكون رقماً أكبر من أو يساوي صفر' : 'Quantity must be a number greater than or equal to 0');
            return;
        }
        if (isNaN(threshold) || threshold < 0) {
            setError(language === 'ar' ? 'الحد الأدنى يجب أن يكون رقماً أكبر من أو يساوي صفر' : 'Minimum threshold must be a number greater than or equal to 0');
            return;
        }

        // Duplicate Check
        const nameEnTrimmed = newItem.nameEn.trim();
        const nameArTrimmed = newItem.nameAr.trim();

        if (nameEnTrimmed === '') {
            setError(language === 'ar' ? 'الاسم بالانجليزية مطلوب' : 'English name is required');
            return;
        }

        if (nameArTrimmed === '') {
            setError(language === 'ar' ? 'الاسم بالعربية مطلوب' : 'Arabic name is required');
            return;
        }

        const isDuplicateEn = existingItems.some(item => {
            if (initialData && item.id === initialData.id) return false;
            return item.nameEn.toLowerCase().trim() === nameEnTrimmed.toLowerCase();
        });

        const isDuplicateAr = existingItems.some(item => {
            if (initialData && item.id === initialData.id) return false;
            return item.nameAr.trim() === nameArTrimmed;
        });


        if (isDuplicateEn) {
            setError(language === 'ar' ? 'يوجد منتج بنفس الاسم الانجليزي بالفعل' : 'An item with this English name already exists');
            return;
        }

        if (isDuplicateAr) {
            setError(language === 'ar' ? 'يوجد منتج بنفس الاسم العربي بالفعل' : 'An item with this Arabic name already exists');
            return;
        }

        onSubmit({
            nameEn: newItem.nameEn,
            nameAr: newItem.nameAr,
            description: newItem.description,
            category: newItem.category,
            quantity: qty,
            unit: newItem.unit,
            minThreshold: threshold,
            expirationDate: newItem.expirationDate || undefined,
            barcode: newItem.barcode || undefined
        });
        onClose();
    };

    if (!isOpen) return null;

    const isEditMode = !!initialData;

    return (
        <div className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 ${language === 'ar' ? 'font-arabic' : ''}`}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-brand-100 dark:bg-brand-900/30 rounded-lg">
                            <Package className="w-6 h-6 text-brand-600 dark:text-brand-500" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                            {isEditMode ? t.edit : t.addItemTitle}
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {!isEditMode && catalog && catalog.length > 0 && (
                        <div>
                            <label className="block text-sm font-medium text-brand-600 dark:text-brand-400 mb-1 flex items-center gap-1">
                                <Package className="w-4 h-4" />
                                {language === 'ar' ? 'اختر من دليل المنتجات (إلزامي)' : 'Select from Catalog (Required)'}
                            </label>
                            <select
                                required
                                value={newItem.catalogId}
                                onChange={e => {
                                    const selected = catalog.find(c => c.id === e.target.value);
                                    if (selected) {
                                        setNewItem({
                                            ...newItem,
                                            catalogId: selected.id,
                                            nameEn: selected.nameEn,
                                            nameAr: selected.nameAr,
                                            description: selected.description || '',
                                            category: selected.category,
                                            unit: selected.unit,
                                            minThreshold: selected.minThreshold.toString(),
                                            barcode: selected.barcode || ''
                                        });
                                        setError('');
                                    } else {
                                        setNewItem({...newItem, catalogId: ''});
                                    }
                                }}
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                            >
                                <option value="">{language === 'ar' ? '-- اختر منتج --' : '-- Select Product --'}</option>
                                {catalog.map(c => (
                                    <option key={c.id} value={c.id}>
                                        {language === 'ar' ? c.nameAr : c.nameEn} ({c.category})
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.itemNameEn}</label>
                            <input
                                required
                                readOnly={!isEditMode || !!newItem.catalogId}
                                type="text"
                                value={newItem.nameEn}
                                onChange={e => {
                                    setNewItem({...newItem, nameEn: e.target.value});
                                    setError('');
                                }}
                                placeholder={t.itemNameEnPlaceholder}
                                className={`w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none ${(!isEditMode || newItem.catalogId) ? 'opacity-60 cursor-not-allowed' : ''}`}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.itemNameAr}</label>
                            <input
                                required
                                readOnly={!isEditMode || !!newItem.catalogId}
                                type="text"
                                value={newItem.nameAr}
                                onChange={e => {
                                    setNewItem({...newItem, nameAr: e.target.value});
                                    setError('');
                                }}
                                placeholder={t.itemNameArPlaceholder}
                                className={`w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-arabic ${(!isEditMode || newItem.catalogId) ? 'opacity-60 cursor-not-allowed' : ''}`}
                                dir="rtl"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                            <AlignLeft className="w-3.5 h-3.5" />
                            {t.description}
                        </label>
                        <textarea
                            readOnly={!isEditMode || !!newItem.catalogId}
                            value={newItem.description}
                            onChange={e => {
                                setNewItem({...newItem, description: e.target.value});
                                setError('');
                            }}
                            placeholder={t.descriptionPlaceholder}
                            className={`w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none resize-none h-20 text-sm ${(!isEditMode || newItem.catalogId) ? 'opacity-60 cursor-not-allowed' : ''}`}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.category}</label>
                        <input
                            required
                            readOnly={!isEditMode || !!newItem.catalogId}
                            type="text"
                            list="category-suggestions"
                            value={newItem.category}
                            onChange={e => {
                                setNewItem({...newItem, category: e.target.value});
                                setError('');
                            }}
                            placeholder={t.category}
                            className={`w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none ${(!isEditMode || newItem.catalogId) ? 'opacity-60 cursor-not-allowed' : ''}`}
                        />
                        <datalist id="category-suggestions">
                            {Array.from(new Set(existingItems.map(i => i.category))).sort().map(cat => (
                                <option key={cat} value={cat} />
                            ))}
                        </datalist>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{isEditMode ? t.quantity : t.initialQty}</label>
                            <input
                                required
                                type="number"
                                min="0"
                                step="any"
                                value={newItem.quantity}
                                onChange={e => {
                                    setNewItem({...newItem, quantity: e.target.value});
                                    setError('');
                                }}
                                className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none ${error ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.unit}</label>
                            <input
                                required
                                readOnly={!isEditMode || !!newItem.catalogId}
                                type="text"
                                value={newItem.unit}
                                onChange={e => {
                                    setNewItem({...newItem, unit: e.target.value});
                                    setError('');
                                }}
                                placeholder={t.unitPlaceholder}
                                className={`w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none ${(!isEditMode || newItem.catalogId) ? 'opacity-60 cursor-not-allowed' : ''}`}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.minThreshold}</label>
                        <input
                            required
                            type="number"
                            min="0"
                            step="any"
                            value={newItem.minThreshold}
                            onChange={e => {
                                setNewItem({...newItem, minThreshold: e.target.value});
                                setError('');
                            }}
                            className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none ${error ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`}
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t.thresholdDesc}</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.expirationDateOptional}</label>
                        <input
                            type="date"
                            value={newItem.expirationDate}
                            onChange={e => {
                                setNewItem({...newItem, expirationDate: e.target.value});
                                setError('');
                            }}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.barcodeOptional}</label>
                        <div className="relative">
                            <input
                                type="text"
                                value={newItem.barcode}
                                onChange={e => {
                                    setNewItem({...newItem, barcode: e.target.value});
                                    setError('');
                                }}
                                placeholder={t.scanOrEnterBarcode}
                                className="w-full px-4 pr-12 rtl:pr-4 rtl:pl-12 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                            />
                            <button
                                type="button"
                                onClick={() => setShowScanner(true)}
                                className="absolute right-2 rtl:left-2 rtl:right-auto top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-md transition-colors"
                            >
                                <Camera className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg animate-in fade-in slide-in-from-top-1">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            {error}
                        </div>
                    )}

                    <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors"
                        >
                            {t.cancel}
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                        >
                            {isEditMode ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                            {isEditMode ? t.saveUser : t.addItem}
                        </button>
                    </div>
                </form>
            </div>
            
            {showScanner && (
                <BarcodeScanner 
                    t={t}
                    onScan={(decodedText) => {
                        setNewItem({...newItem, barcode: decodedText});
                        setShowScanner(false);
                    }}
                    onClose={() => setShowScanner(false)}
                    language={language}
                />
            )}
        </div>
    );
};

export default AddItemModal;