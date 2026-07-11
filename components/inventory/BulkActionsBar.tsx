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
    <div className="fixed bottom-24 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-bottom-10 duration-300 w-[95vw] sm:w-[90vw] md:w-auto overflow-x-auto scrollbar-hide">
      <div className="bg-gray-900 text-white px-4 py-3 sm:px-6 sm:py-4 rounded-2xl shadow-2xl flex items-center justify-between sm:justify-start gap-4 sm:gap-6 border border-gray-700 min-w-max">
        <div className="flex items-center gap-2 sm:gap-3 border-r border-gray-700 pr-4 sm:pr-6">
          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center font-bold text-sm sm:text-base">
            {selectedCount}
          </div>
          <span className="text-xs sm:text-sm font-bold hidden min-[360px]:inline">{t.itemsSelected || 'Items Selected'}</span>
        </div>
        
        <div className="flex items-center gap-1 sm:gap-2">
          {canBulkEdit && (
            <>
              <button 
                onClick={onBulkEdit}
                className="flex items-center gap-2 px-4 py-2 hover:bg-gray-800 rounded-xl transition-colors text-sm font-bold"
              >
                <Pencil className="w-4 h-4 text-brand-400" />
                {t.edit}
              </button>

              <button 
                onClick={onBulkDelete}
                className="flex items-center gap-2 px-4 py-2 hover:bg-red-900/30 text-red-400 rounded-xl transition-colors text-sm font-bold"
              >
                <Trash2 className="w-4 h-4" />
                {t.delete}
              </button>
            </>
          )}

          <button 
            onClick={onBulkPrint}
            className="flex items-center gap-2 px-4 py-2 hover:bg-gray-800 rounded-xl transition-colors text-sm font-bold"
          >
            <Printer className="w-4 h-4 text-emerald-400" />
            {t.printLabels || 'Print Labels'}
          </button>

          <button 
            onClick={onBulkTransfer}
            className="flex items-center gap-2 px-4 py-2 hover:bg-gray-800 rounded-xl transition-colors text-sm font-bold"
          >
            <ArrowRightLeft className="w-4 h-4 text-blue-400" />
            {t.transfer}
          </button>
          
          <button 
            onClick={onClearSelection}
            className="p-2 hover:bg-gray-800 rounded-xl transition-colors"
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
