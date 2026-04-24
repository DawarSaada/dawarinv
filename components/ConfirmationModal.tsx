import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Language } from '../types';
import { TRANSLATIONS } from '../constants';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    language: Language;
    danger?: boolean;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText,
    language,
    danger = true
}) => {
    const t = TRANSLATIONS[language];
    if (!isOpen) return null;

    return (
        <div className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 ${language === 'ar' ? 'font-arabic' : ''}`}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-start mb-4">
                    <div className={`p-2 rounded-lg ${danger ? 'bg-red-50 dark:bg-red-900/20 text-red-600' : 'bg-brand-50 dark:bg-brand-900/20 text-brand-600'}`}>
                        <AlertTriangle className="w-6 h-6" />
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{title}</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed mb-6">
                    {message}
                    <br />
                    <span className="text-xs font-semibold opacity-75 mt-1 block">{t.actionIrreversible}</span>
                </p>

                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl font-medium transition-colors border border-gray-200 dark:border-gray-700"
                    >
                        {t.cancel}
                    </button>
                    <button
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                        className={`flex-1 px-4 py-2.5 text-white rounded-xl font-bold transition-colors shadow-lg ${danger ? 'bg-red-600 hover:bg-red-700 shadow-red-100 dark:shadow-none' : 'bg-brand-600 hover:bg-brand-700 shadow-brand-100 dark:shadow-none'}`}
                    >
                        {confirmText || t.confirm}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmationModal;