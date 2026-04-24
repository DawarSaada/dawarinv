import React, { useState } from 'react';
import { Language, InventoryItem } from '../types';
import { TRANSLATIONS } from '../constants';
import { useToast } from './Toast';
import { Pencil, X, Save, AlertCircle } from 'lucide-react';

interface BulkEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedCount: number;
    onSave: (updates: Partial<InventoryItem>) => void;
    language: Language;
}

const BulkEditModal: React.FC<BulkEditModalProps> = ({
    isOpen,
    onClose,
    selectedCount,
    onSave,
    language
}) => {
    const t = TRANSLATIONS[language];
    const { addToast } = useToast();
    const [category, setCategory] = useState('');
    const [unit, setUnit] = useState('');
    const [minThreshold, setMinThreshold] = useState('');
    const [applyCategory, setApplyCategory] = useState(false);
    const [applyUnit, setApplyUnit] = useState(false);
    const [applyThreshold, setApplyThreshold] = useState(false);

    const handleSave = () => {
        const updates: Partial<InventoryItem> = {};
        if (applyCategory && category) updates.category = category;
        if (applyUnit && unit) updates.unit = unit;
        if (applyThreshold && minThreshold !== '') updates.minThreshold = Number(minThreshold);

        if (Object.keys(updates).length === 0) {
            addToast('warning', language === 'ar' ? 'يرجى اختيار حقل واحد على الأقل لتعديله' : 'Please select at least one field to update');
            return;
        }

        onSave(updates);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[110] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-brand-50 dark:bg-brand-900/30 rounded-lg">
                            <Pencil className="w-5 h-5 text-brand-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t.bulkEdit || 'Bulk Edit'}</h2>
                            <p className="text-xs text-gray-500">{selectedCount} {t.itemsSelected || 'Items Selected'}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <div className="space-y-4">
                        <div className="flex items-start gap-3">
                            <input 
                                type="checkbox" 
                                checked={applyCategory} 
                                onChange={(e) => setApplyCategory(e.target.checked)}
                                className="mt-1 w-4 h-4 text-brand-600 border-gray-300 rounded focus:ring-brand-500"
                            />
                            <div className="flex-1">
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">{t.category}</label>
                                <input 
                                    type="text" 
                                    value={category} 
                                    onChange={(e) => setCategory(e.target.value)}
                                    disabled={!applyCategory}
                                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50"
                                    placeholder={t.category}
                                />
                            </div>
                        </div>

                        <div className="flex items-start gap-3">
                            <input 
                                type="checkbox" 
                                checked={applyUnit} 
                                onChange={(e) => setApplyUnit(e.target.checked)}
                                className="mt-1 w-4 h-4 text-brand-600 border-gray-300 rounded focus:ring-brand-500"
                            />
                            <div className="flex-1">
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">{t.unit}</label>
                                <input 
                                    type="text" 
                                    value={unit} 
                                    onChange={(e) => setUnit(e.target.value)}
                                    disabled={!applyUnit}
                                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50"
                                    placeholder={t.unit}
                                />
                            </div>
                        </div>

                        <div className="flex items-start gap-3">
                            <input 
                                type="checkbox" 
                                checked={applyThreshold} 
                                onChange={(e) => setApplyThreshold(e.target.checked)}
                                className="mt-1 w-4 h-4 text-brand-600 border-gray-300 rounded focus:ring-brand-500"
                            />
                            <div className="flex-1">
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">{t.minThreshold}</label>
                                <input 
                                    type="number" 
                                    value={minThreshold} 
                                    onChange={(e) => setMinThreshold(e.target.value)}
                                    disabled={!applyThreshold}
                                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50"
                                    placeholder={t.minThreshold}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-100 dark:border-amber-900/30 flex gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                        <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                            {language === 'ar' 
                                ? 'سيتم تطبيق هذه التغييرات على جميع العناصر المختارة. لا يمكن التراجع عن هذا الإجراء.' 
                                : 'These changes will be applied to all selected items. This action cannot be undone.'}
                        </p>
                    </div>
                </div>

                <div className="p-6 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700 flex gap-3">
                    <button 
                        onClick={onClose}
                        className="flex-1 px-4 py-3 text-gray-500 font-bold hover:bg-gray-100 dark:hover:bg-gray-800 rounded-2xl transition-all text-sm"
                    >
                        {t.cancel}
                    </button>
                    <button 
                        onClick={handleSave}
                        className="flex-1 px-4 py-3 bg-brand-600 text-white rounded-2xl font-bold transition-all shadow-lg text-sm flex items-center justify-center gap-2"
                    >
                        <Save className="w-4 h-4" />
                        {t.save}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BulkEditModal;
