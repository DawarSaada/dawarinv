import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Printer, X } from 'lucide-react';
import { InventoryItem, Language } from '../../types';

interface PrintLabelsProps {
  items: InventoryItem[];
  onClose: () => void;
  language: Language;
  t: any;
}

const PrintLabels: React.FC<PrintLabelsProps> = ({ items, onClose, language, t }) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className={`fixed inset-0 bg-gray-900/90 backdrop-blur-sm z-[200] flex flex-col ${language === 'ar' ? 'font-arabic' : ''}`}>
      {/* Header - Not visible during print */}
      <div className="flex justify-between items-center p-4 sm:p-6 bg-white dark:bg-gray-800 print:hidden border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Printer className="w-6 h-6 text-brand-600" />
            {t.printLabels || 'Print Labels'}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {language === 'ar' ? `إنشاء ملصقات لـ ${items.length} عنصر` : `Generating labels for ${items.length} items`}
          </p>
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={onClose}
            className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold transition-colors"
          >
            {t.cancel || 'Cancel'}
          </button>
          <button 
            onClick={handlePrint}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold flex items-center gap-2 transition-colors shadow-lg shadow-brand-200 dark:shadow-none"
          >
            <Printer className="w-5 h-5" />
            {t.print || 'Print'}
          </button>
        </div>
      </div>

      {/* Printable Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-gray-100 dark:bg-gray-900 print:p-0 print:bg-white">
        <div className="max-w-5xl mx-auto bg-white print:shadow-none shadow-sm min-h-screen">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 print:grid-cols-3 gap-2 p-4 print:p-0">
            {items.map(item => (
              <div 
                key={item.id} 
                className="border-2 border-dashed border-gray-300 print:border-solid print:border-black p-4 flex flex-col items-center justify-center text-center break-inside-avoid h-[180px]"
              >
                <div className="mb-2 w-full truncate px-2 font-bold text-sm text-black">
                  {language === 'ar' ? item.nameAr : item.nameEn}
                </div>
                
                <QRCodeSVG 
                  value={item.id} 
                  size={100} 
                  level="M"
                  includeMargin={true}
                />
                
                <div className="mt-1 text-[10px] text-gray-500 font-mono">
                  {item.id.toUpperCase().substring(0, 8)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrintLabels;
