import React, { useState, useEffect } from 'react';
import { InventoryItem, Language } from '../types';
import { TRANSLATIONS } from '../constants';
import { formatUnit } from '../utils/units';
import { ArrowUpCircle, X } from 'lucide-react';

interface ReceiveModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: InventoryItem | null;
    onConfirm: (quantity: number, notes: string) => void;
    language: Language;
}

const ReceiveModal: React.FC<ReceiveModalProps> = ({ isOpen, onClose, item, onConfirm, language }) => {
    const [quantity, setQuantity] = useState('');
    const [notes, setNotes] = useState('');
    const [error, setError] = useState('');
    
    const t = TRANSLATIONS[language];

    useEffect(() => {
        if (isOpen) {
            setQuantity('');
            setNotes('');
            setError('');
        }
    }, [isOpen]);

    if (!isOpen || !item) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const qty = Number(quantity);
        
        if (qty <= 0) {
            setError(language === 'ar' ? 'الكمية يجب أن تكون أكبر من صفر' : 'Quantity must be greater than 0');
            return;
        }

        // No max check for receiving


        onConfirm(qty, notes);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center px-4 pb-4 pt-[max(env(safe-area-inset-top,1rem),1rem)]">
            <div className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-md p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                            <ArrowUpCircle className="w-6 h-6 text-green-600 dark:text-green-500" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white font-arabic">
                                {language === 'ar' ? 'تسجيل استلام' : 'Record Receive'}
                            </h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{language === 'ar' ? item.nameAr : item.nameEn}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.quantity}</label>
                        <div className="flex items-center gap-2">
                             <input
                                required
                                type="number"
                                min="0"
                                value={quantity}
                                onChange={e => {
                                    setQuantity(e.target.value);
                                    setError('');
                                }}
                                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none"
                            />
                            <span className="text-gray-500 dark:text-gray-400 font-medium">{formatUnit(item.unit, language)}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{t.available}: {item.quantity} {formatUnit(item.unit, language)}</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.notes}</label>
                        <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none resize-none h-20"
                            placeholder={t.notesPlaceholder}
                        />
                    </div>

                    {error && (
                        <div className="text-red-500 text-sm">{error}</div>
                    )}

                    <div className="flex gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-800">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors"
                        >
                            {t.cancel}
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                        >
                            {t.confirm}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ReceiveModal;