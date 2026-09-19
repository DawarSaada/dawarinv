import React, { useEffect, useRef, useState } from 'react';
import { X, Camera, AlertTriangle } from 'lucide-react';
// `html5-qrcode` (~500KB) is loaded on demand, when the scanner is opened.
import type { Html5Qrcode } from 'html5-qrcode';
import { Language } from '../types';

interface BarcodeScannerProps {
  onScan: (decodedText: string) => void;
  onClose: () => void;
  language: Language;
  t: any;
}

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScan, onClose, language, t }) => {
  const [error, setError] = useState<string>('');
  const [hasCameras, setHasCameras] = useState<boolean>(true);
  // A ref (not state) so the effect cleanup always sees the active instance.
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    const initScanner = async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        const cameras = await Html5Qrcode.getCameras();
        if (cameras && cameras.length > 0) {
          const newScanner = new Html5Qrcode("reader");
          scannerRef.current = newScanner;

          await newScanner.start(
            { facingMode: "environment" }, // Default to rear camera
            {
              fps: 10,
              qrbox: { width: 250, height: 250 },
              aspectRatio: 1.0
            },
            (decodedText) => {
              newScanner.stop().catch(console.error);
              onScan(decodedText);
            },
            (errorMessage) => {
              // Ignore standard scan failures
            }
          );
        } else {
          setHasCameras(false);
          setError(language === 'ar' ? 'لم يتم العثور على كاميرا' : 'No camera found on this device');
        }
      } catch (err: any) {
        setHasCameras(false);
        setError(language === 'ar' ? 'تم رفض إذن الكاميرا' : 'Camera permission denied or unavailable');
        console.error("Scanner setup failed:", err);
      }
    };

    setTimeout(initScanner, 100);

    return () => {
      const active = scannerRef.current;
      scannerRef.current = null;
      if (active && active.isScanning) {
        active.stop().catch(console.error);
      }
    };
  }, []);

  const handleClose = async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (scanner && scanner.isScanning) {
      try {
        await scanner.stop();
      } catch (e) {
        console.error("Failed to stop scanner", e);
      }
    }
    onClose();
  };

  return (
    <div className={`fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex flex-col items-center justify-center px-4 pb-4 pt-[max(env(safe-area-inset-top,1rem),1rem)] ${language === 'ar' ? 'font-arabic' : ''}`}>
      <div className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-md shadow-2xl overflow-hidden relative">
        <div className="absolute top-4 right-4 z-10 flex gap-2">
          <button 
            onClick={handleClose}
            className="p-2 bg-black/50 text-white hover:bg-black/70 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 text-center border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <div className="w-12 h-12 bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400 rounded-full flex items-center justify-center mx-auto mb-3">
            <Camera className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t.scanBarcode || (language === 'ar' ? 'مسح الباركود' : 'Scan Barcode')}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t.scanInstruction || (language === 'ar' ? 'وجه الكاميرا نحو ملصق المنتج' : 'Point your camera at a product label')}</p>
        </div>

        <div className="p-6">
          {!hasCameras || error ? (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-2xl flex flex-col items-center gap-3 text-center">
              <AlertTriangle className="w-8 h-8" />
              <div>
                <p className="font-bold">{t.scannerError || (language === 'ar' ? 'خطأ في الماسح' : 'Scanner Error')}</p>
                <p className="text-sm mt-1">{error}</p>
              </div>
            </div>
          ) : (
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-square max-w-[300px] mx-auto border-4 border-gray-100 dark:border-gray-700">
              <div id="reader" className="w-full h-full"></div>
              {/* Scan target overlay */}
              <div className="absolute inset-0 pointer-events-none border-[40px] border-black/40">
                <div className="w-full h-full border-2 border-brand-500 rounded-lg relative">
                  <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-brand-500 -ml-1 -mt-1"></div>
                  <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-brand-500 -mr-1 -mt-1"></div>
                  <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-brand-500 -ml-1 -mb-1"></div>
                  <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-brand-500 -mr-1 -mb-1"></div>
                  <div className="absolute w-full h-0.5 bg-brand-500 top-1/2 -translate-y-1/2 animate-scan shadow-[0_0_8px_2px_rgba(var(--brand-500),0.5)]"></div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BarcodeScanner;
