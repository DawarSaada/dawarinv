import React from 'react';
import { 
  Pencil, 
  Trash2, 
  ArrowRightLeft, 
  XCircle,
  Printer 
} from 'lucide-react';

interface BulkActionsBarProps {
  t: any;
  selectedCount: number;
  canBulkEdit: boolean;
  onBulkEdit: () => void;
  onBulkDelete: () => void;
  onBulkTransfer: () => void;
  onBulkPrint: () => void;
  onClearSelection: () => void;
}

const BulkActionsBar: React.FC<BulkActionsBarProps> = ({
  t,
  selectedCount,
  canBulkEdit,
  onBulkEdit,
  onBulkDelete,
  onBulkTransfer,
  onBulkPrint,
  onClearSelection
}) => {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-20 left-1/2 z-modal w-[95vw] max-w-[95vw] -translate-x-1/2 animate-fade-in sm:bottom-6 sm:w-auto">
      <div className="flex w-full items-center gap-3 overflow-x-auto rounded-xl border border-gray-700/60 bg-gray-900 px-3 py-2.5 text-white shadow-pop sm:justify-start sm:gap-4 sm:px-4 scrollbar-hide">
        <div className="flex items-center gap-2 border-e border-gray-700 pe-3 sm:gap-3 sm:pe-4 shrink-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-700 text-xs font-semibold shrink-0">
            {selectedCount}
          </div>
          <span className="hidden text-xs font-medium sm:inline whitespace-nowrap">{t.itemsSelected || 'Items selected'}</span>
        </div>
        
        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
          {canBulkEdit && (
            <>
              <button 
                onClick={onBulkEdit}
                className="flex items-center gap-2 px-3 py-2 hover:bg-gray-800 rounded-xl transition-colors text-sm font-bold whitespace-nowrap shrink-0"
              >
                <Pencil className="w-4 h-4 text-brand-400" />
                {t.edit}
              </button>

              <button 
                onClick={onBulkDelete}
                className="flex items-center gap-2 px-3 py-2 hover:bg-red-900/30 text-red-400 rounded-xl transition-colors text-sm font-bold whitespace-nowrap shrink-0"
              >
                <Trash2 className="w-4 h-4" />
                {t.delete}
              </button>
            </>
          )}

          <button 
            onClick={onBulkPrint}
            className="flex items-center gap-2 px-3 py-2 hover:bg-gray-800 rounded-xl transition-colors text-sm font-bold whitespace-nowrap shrink-0"
          >
            <Printer className="w-4 h-4 text-emerald-400" />
            {t.printLabels || 'Print Labels'}
          </button>

          <button 
            onClick={onBulkTransfer}
            className="flex items-center gap-2 px-3 py-2 hover:bg-gray-800 rounded-xl transition-colors text-sm font-bold whitespace-nowrap shrink-0"
          >
            <ArrowRightLeft className="w-4 h-4 text-blue-400" />
            {t.transfer}
          </button>
          
          <button 
            onClick={onClearSelection}
            className="p-2 hover:bg-gray-800 rounded-xl transition-colors shrink-0"
            title={t.cancel}
          >
            <XCircle className="w-5 h-5 text-gray-400" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkActionsBar;
