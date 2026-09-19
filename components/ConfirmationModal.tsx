import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Language } from '../types';
import { TRANSLATIONS } from '../constants';
import { ConfirmDialog } from './ui';

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

/**
 * Thin wrapper over the shared ConfirmDialog so every destructive action gets
 * the same layout, focus handling and mobile sheet behaviour.
 */
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

    return (
        <ConfirmDialog
            open={isOpen}
            onClose={onClose}
            onConfirm={() => {
                onConfirm();
                onClose();
            }}
            title={title}
            danger={danger}
            confirmLabel={confirmText || t.confirm}
            cancelLabel={t.cancel}
            message={
                <>
                    {message}
                    <span className="mt-2 block text-xs font-medium opacity-75">
                        {t.actionIrreversible}
                    </span>
                </>
            }
        />
    );
};

export default ConfirmationModal;
