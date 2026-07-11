import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Transaction, LocationData, Language, TransferSettings } from '../types';
import { TRANSLATIONS } from '../constants';
import { 
  X, Package, ArrowRight, CheckCircle, XCircle, AlertTriangle, 
  Download, Camera, Pen, Trash2, Plus, Minus, ChevronDown, ChevronUp,
  Clock, Truck, MapPin, User, FileText, Image as ImageIcon
} from 'lucide-react';

interface TransferItemState {
  transactionId: string;
  itemNameEn: string;
  itemNameAr: string;
  sentQuantity: number;
  receivedQuantity: number;
  unit: string;
  itemStatus: 'pending' | 'received' | 'partial' | 'rejected' | 'extra';
  receiptNotes: string;
  photoUrls: string[];
}

interface TransferDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  transferGroupId: string;
  transactions: Transaction[];
  transferType: 'incoming' | 'outgoing' | 'approval';
  language: Language;
  availableLocations: LocationData[];
  settings: TransferSettings;
  onAcceptGroup: (groupId: string, items: TransferItemState[], signatureDataUrl?: string) => void;
  onRejectGroup: (groupId: string, reason: string) => void;
  onConfirmGroup: (groupId: string) => void;
  onDownload: (groupId: string, type: 'incoming' | 'outgoing') => void;
  getUserName?: (name: string) => string;
}

const TransferDetailModal: React.FC<TransferDetailModalProps> = ({
  isOpen,
  onClose,
  transferGroupId,
  transactions,
  transferType,
  language,
  availableLocations,
  settings,
  onAcceptGroup,
  onRejectGroup,
  onConfirmGroup,
  onDownload,
  getUserName
}) => {
  const t = TRANSLATIONS[language];
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize item states from transactions
  const [itemStates, setItemStates] = useState<TransferItemState[]>([]);

  useEffect(() => {
    if (isOpen && transactions.length > 0) {
      setItemStates(transactions.map(tx => ({
        transactionId: tx.id,
        itemNameEn: tx.itemNameEn,
        itemNameAr: tx.itemNameAr,
        sentQuantity: tx.quantity,
        receivedQuantity: tx.receivedQuantity ?? tx.quantity,
        unit: tx.unit,
        itemStatus: tx.itemStatus || 'pending',
        receiptNotes: tx.receiptNotes || '',
        photoUrls: tx.photoUrls || []
      })));
      setHasSignature(false);
      setShowRejectModal(false);
      setRejectionReason('');
      setExpandedItem(null);
    }
  }, [isOpen, transactions]);

  // Resolve location names
  const firstTx = transactions[0];
  const fromLocData = availableLocations.find(l => l.id === firstTx?.fromLocation);
  const toLocData = availableLocations.find(l => l.id === firstTx?.toLocation);
  const fromName = fromLocData 
    ? (fromLocData.id === 'warehouse' ? t.warehouse : fromLocData.id === 'mammal' ? t.mammal : (language === 'ar' ? (fromLocData.nameAr || fromLocData.name) : fromLocData.name))
    : (firstTx?.fromLocation || '');
  const toName = toLocData 
    ? (toLocData.id === 'warehouse' ? t.warehouse : toLocData.id === 'mammal' ? t.mammal : (language === 'ar' ? (toLocData.nameAr || toLocData.name) : toLocData.name))
    : (firstTx?.toLocation || '');
  const performedByName = getUserName ? getUserName(firstTx?.performedBy || '') : (firstTx?.performedBy || '');

  // Auto-calculate item status based on received quantity
  const updateItemQuantity = (txId: string, qty: number) => {
    setItemStates(prev => prev.map(item => {
      if (item.transactionId !== txId) return item;
      let status: TransferItemState['itemStatus'] = 'received';
      if (qty === 0) status = 'rejected';
      else if (qty < item.sentQuantity) status = 'partial';
      else if (qty > item.sentQuantity) status = 'extra';
      else status = 'received';
      return { ...item, receivedQuantity: qty, itemStatus: status };
    }));
  };

  const updateItemNotes = (txId: string, notes: string) => {
    setItemStates(prev => prev.map(item => 
      item.transactionId === txId ? { ...item, receiptNotes: notes } : item
    ));
  };

  const setItemRejected = (txId: string) => {
    setItemStates(prev => prev.map(item => 
      item.transactionId === txId ? { ...item, receivedQuantity: 0, itemStatus: 'rejected' } : item
    ));
  };

  const setAllReceived = () => {
    setItemStates(prev => prev.map(item => ({
      ...item,
      receivedQuantity: item.sentQuantity,
      itemStatus: 'received'
    })));
  };

  // Signature pad handlers
  const getCanvasCoords = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height)
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCanvasCoords(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasSignature(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCanvasCoords(e);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1f2937';
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => setIsDrawing(false);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  // Photo handling
  const addPhotoToItem = (txId: string, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setItemStates(prev => prev.map(item => 
        item.transactionId === txId 
          ? { ...item, photoUrls: [...item.photoUrls, dataUrl] }
          : item
      ));
    };
    reader.readAsDataURL(file);
  };

  const removePhoto = (txId: string, index: number) => {
    setItemStates(prev => prev.map(item =>
      item.transactionId === txId
        ? { ...item, photoUrls: item.photoUrls.filter((_, i) => i !== index) }
        : item
    ));
  };

  // Summary calculations
  const receivedCount = itemStates.filter(i => i.itemStatus === 'received' || i.itemStatus === 'extra').length;
  const partialCount = itemStates.filter(i => i.itemStatus === 'partial').length;
  const rejectedCount = itemStates.filter(i => i.itemStatus === 'rejected').length;
  const hasAdjustments = itemStates.some(i => i.receivedQuantity !== i.sentQuantity);

  // Submit handlers
  const handleAcceptAll = async () => {
    setIsSubmitting(true);
    try {
      setAllReceived();
      const allReceived = itemStates.map(item => ({
        ...item,
        receivedQuantity: item.sentQuantity,
        itemStatus: 'received' as const
      }));
      const sigUrl = settings.enableSignatureCapture && hasSignature 
        ? canvasRef.current?.toDataURL('image/png') 
        : undefined;
      await onAcceptGroup(transferGroupId, allReceived, sigUrl);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAcceptWithAdjustments = async () => {
    if (settings.enableSignatureCapture && !hasSignature) return;
    setIsSubmitting(true);
    try {
      const sigUrl = settings.enableSignatureCapture && hasSignature
        ? canvasRef.current?.toDataURL('image/png')
        : undefined;
      await onAcceptGroup(transferGroupId, itemStates, sigUrl);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejectAll = () => {
    setShowRejectModal(true);
  };

  const executeRejectAll = async () => {
    if (!rejectionReason.trim()) return;
    setIsSubmitting(true);
    try {
      await onRejectGroup(transferGroupId, rejectionReason);
      setShowRejectModal(false);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmOutbound = async () => {
    setIsSubmitting(true);
    try {
      await onConfirmGroup(transferGroupId);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  // Status indicator
  const getStatusIcon = (status: TransferItemState['itemStatus']) => {
    switch (status) {
      case 'received': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'partial': return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'rejected': return <XCircle className="w-5 h-5 text-red-500" />;
      case 'extra': return <Plus className="w-5 h-5 text-blue-500" />;
      default: return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusLabel = (status: TransferItemState['itemStatus']) => {
    switch (status) {
      case 'received': return t.fullyReceived;
      case 'partial': return t.partialReceipt;
      case 'rejected': return t.notReceived;
      case 'extra': return t.extraReceived;
      default: return t.pendingReceipt;
    }
  };

  const getStatusColor = (status: TransferItemState['itemStatus']) => {
    switch (status) {
      case 'received': return 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800';
      case 'partial': return 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800';
      case 'rejected': return 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800';
      case 'extra': return 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800';
      default: return 'bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700';
    }
  };

  if (!isOpen || transactions.length === 0) return null;

  return (
    <div className={`fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-2 sm:p-4 ${language === 'ar' ? 'font-arabic' : ''}`}>
      <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[95vh] sm:max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-brand-50 to-white dark:from-brand-900/20 dark:to-gray-800">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-brand-100 dark:bg-brand-900/40 rounded-xl">
                <Package className="w-6 h-6 text-brand-600 dark:text-brand-400" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">{t.transferDetails}</h2>
                <p className="text-xs text-gray-400 font-mono mt-0.5">{transferGroupId.substring(0, 12).toUpperCase()}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => onDownload(transferGroupId, transferType === 'incoming' ? 'incoming' : 'outgoing')}
                className="p-2 text-gray-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-xl transition-colors"
                title="Download PDF"
              >
                <Download className="w-5 h-5" />
              </button>
              <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Route info */}
          <div className="flex items-center gap-3 text-sm">
            <div className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-gray-400" />
              <span className="font-semibold text-gray-900 dark:text-white">{fromName}</span>
            </div>
            <ArrowRight className="w-4 h-4 text-brand-500" />
            <div className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-gray-400" />
              <span className="font-semibold text-gray-900 dark:text-white">{toName}</span>
            </div>
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
            <span className="flex items-center gap-1"><User className="w-3 h-3" /> {performedByName}</span>
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(firstTx?.date || '').toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
            <span className="flex items-center gap-1"><Package className="w-3 h-3" /> {transactions.length} {t.items}</span>
          </div>

          {/* Status Timeline */}
          <div className="flex items-center gap-1 mt-4">
            {['initiated', 'source', 'receipt', 'done'].map((step, idx) => {
              const isActive = transferType === 'approval' ? idx <= 0 : transferType === 'incoming' ? idx <= 2 : idx <= 1;
              return (
                <React.Fragment key={step}>
                  <div className={`h-1.5 flex-1 rounded-full transition-colors ${isActive ? 'bg-brand-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
                </React.Fragment>
              );
            })}
          </div>
          <div className="flex justify-between mt-1 text-[10px] text-gray-400 font-medium">
            <span>{t.transferInitiated}</span>
            <span>{t.sourceApproved}</span>
            <span>{t.pendingReceipt}</span>
            <span>{t.transferCompleted}</span>
          </div>
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {/* Summary Bar */}
          <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-900/50 rounded-xl p-3 text-xs font-bold">
            <span className="text-gray-500">{t.itemsSummary}</span>
            <div className="flex gap-3">
              {receivedCount > 0 && <span className="text-green-600 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> {receivedCount}</span>}
              {partialCount > 0 && <span className="text-amber-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {partialCount}</span>}
              {rejectedCount > 0 && <span className="text-red-600 flex items-center gap-1"><XCircle className="w-3 h-3" /> {rejectedCount}</span>}
            </div>
          </div>

          {itemStates.map(item => {
            const isExpanded = expandedItem === item.transactionId;
            return (
              <div 
                key={item.transactionId} 
                className={`rounded-2xl border transition-all ${getStatusColor(item.itemStatus)} overflow-hidden`}
              >
                {/* Item Row */}
                <div 
                  className="flex items-center gap-3 p-3 sm:p-4 cursor-pointer"
                  onClick={() => setExpandedItem(isExpanded ? null : item.transactionId)}
                >
                  {getStatusIcon(item.itemStatus)}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{language === 'ar' ? item.itemNameAr : item.itemNameEn}</p>
                    <p className="text-[10px] opacity-70">{getStatusLabel(item.itemStatus)}</p>
                  </div>
                  
                  {/* Quantity Display */}
                  <div className="text-right shrink-0">
                    <p className="text-xs opacity-60">{t.sentQuantity}: {item.sentQuantity} {item.unit}</p>
                    {transferType === 'incoming' ? (
                      <div className="flex items-center gap-1 mt-0.5" onClick={e => e.stopPropagation()}>
                        <button 
                          onClick={() => updateItemQuantity(item.transactionId, Math.max(0, item.receivedQuantity - 1))}
                          className="p-0.5 rounded bg-white/60 dark:bg-gray-600/60 hover:bg-white dark:hover:bg-gray-600 transition-colors"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <input 
                          type="number"
                          value={item.receivedQuantity}
                          onChange={e => updateItemQuantity(item.transactionId, Math.max(0, Number(e.target.value)))}
                          className="w-16 text-center text-sm font-bold bg-white dark:bg-gray-700 rounded-lg border border-current/20 py-0.5 outline-none focus:ring-2 focus:ring-brand-500"
                        />
                        <button 
                          onClick={() => updateItemQuantity(item.transactionId, item.receivedQuantity + 1)}
                          className="p-0.5 rounded bg-white/60 dark:bg-gray-600/60 hover:bg-white dark:hover:bg-gray-600 transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <span className="text-xs ml-1">{item.unit}</span>
                      </div>
                    ) : (
                      <p className="font-bold text-sm">{item.sentQuantity} {item.unit}</p>
                    )}
                  </div>

                  {isExpanded ? <ChevronUp className="w-4 h-4 opacity-50 shrink-0" /> : <ChevronDown className="w-4 h-4 opacity-50 shrink-0" />}
                </div>

                {/* Expanded Details */}
                {isExpanded && transferType === 'incoming' && (
                  <div className="px-3 sm:px-4 pb-3 sm:pb-4 space-y-3 border-t border-current/10">
                    {/* Quick Actions */}
                    <div className="flex gap-2 mt-3">
                      <button 
                        onClick={() => updateItemQuantity(item.transactionId, item.sentQuantity)}
                        className="flex-1 py-1.5 text-[10px] font-bold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                      >
                        ✅ {t.fullyReceived}
                      </button>
                      <button 
                        onClick={() => setItemRejected(item.transactionId)}
                        className="flex-1 py-1.5 text-[10px] font-bold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                      >
                        ❌ {t.notReceived}
                      </button>
                    </div>

                    {/* Notes */}
                    <textarea 
                      value={item.receiptNotes}
                      onChange={e => updateItemNotes(item.transactionId, e.target.value)}
                      placeholder={t.receiptNotesPlaceholder}
                      className="w-full p-2.5 text-xs bg-white dark:bg-gray-700 border border-current/20 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 resize-none text-gray-900 dark:text-white placeholder-gray-400"
                      rows={2}
                    />

                    {/* Photo Evidence */}
                    {settings.enablePhotoEvidence && (
                      <div>
                        <p className="text-[10px] font-bold opacity-70 mb-2 flex items-center gap-1"><Camera className="w-3 h-3" /> {t.photoEvidence}</p>
                        <div className="flex flex-wrap gap-2">
                          {item.photoUrls.map((url, idx) => (
                            <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border border-current/20">
                              <img src={url} alt="" className="w-full h-full object-cover" />
                              <button 
                                onClick={() => removePhoto(item.transactionId, idx)}
                                className="absolute top-0 right-0 p-0.5 bg-red-500 text-white rounded-bl-lg"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                          <label className="w-16 h-16 rounded-lg border-2 border-dashed border-current/30 flex items-center justify-center cursor-pointer hover:bg-white/50 dark:hover:bg-gray-700/50 transition-colors">
                            <Plus className="w-5 h-5 opacity-40" />
                            <input 
                              type="file" 
                              accept="image/*" 
                              capture="environment"
                              className="hidden"
                              onChange={e => {
                                const file = e.target.files?.[0];
                                if (file) addPhotoToItem(item.transactionId, file);
                                e.target.value = '';
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Signature Pad (for incoming only) */}
        {transferType === 'incoming' && settings.enableSignatureCapture && (
          <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-gray-500 flex items-center gap-1"><Pen className="w-3 h-3" /> {t.signatureCapture}</p>
              {hasSignature && (
                <button onClick={clearSignature} className="text-[10px] text-red-500 font-bold hover:text-red-700">{t.clearSignature}</button>
              )}
            </div>
            <canvas
              ref={canvasRef}
              width={500}
              height={120}
              className={`w-full h-20 rounded-xl border-2 border-dashed ${hasSignature ? 'border-brand-300 dark:border-brand-700' : 'border-gray-200 dark:border-gray-700'} bg-white dark:bg-gray-900 cursor-crosshair touch-none`}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
            {!hasSignature && <p className="text-[10px] text-gray-400 text-center mt-1">{t.signatureRequired}</p>}
          </div>
        )}

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700">
          {transferType === 'incoming' && (
            <div className="space-y-2">
              {/* Adjustment indicator */}
              {hasAdjustments && (
                <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 text-center flex items-center justify-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> {t.hasAdjustments}
                </p>
              )}
              <div className="flex gap-2">
                <button 
                  onClick={handleRejectAll}
                  disabled={isSubmitting}
                  className="flex-1 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl font-bold text-sm hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors disabled:opacity-50"
                >
                  {t.rejectAll}
                </button>
                {hasAdjustments ? (
                  <button 
                    onClick={handleAcceptWithAdjustments}
                    disabled={isSubmitting || (settings.enableSignatureCapture && !hasSignature)}
                    className="flex-[2] py-3 bg-brand-600 text-white rounded-2xl font-bold text-sm hover:bg-brand-700 transition-colors shadow-lg shadow-brand-200 dark:shadow-none disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSubmitting && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                    {t.acceptWithAdjustments}
                  </button>
                ) : (
                  <button 
                    onClick={handleAcceptAll}
                    disabled={isSubmitting || (settings.enableSignatureCapture && !hasSignature)}
                    className="flex-[2] py-3 bg-green-600 text-white rounded-2xl font-bold text-sm hover:bg-green-700 transition-colors shadow-lg shadow-green-200 dark:shadow-none disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSubmitting && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                    {t.acceptAll}
                  </button>
                )}
              </div>
            </div>
          )}

          {transferType === 'approval' && (
            <div className="flex gap-3">
              <button 
                onClick={onClose} 
                disabled={isSubmitting}
                className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-100 dark:hover:bg-gray-700 rounded-2xl transition-colors text-sm disabled:opacity-50"
              >
                {t.cancel}
              </button>
              <button 
                onClick={handleConfirmOutbound}
                disabled={isSubmitting}
                className="flex-1 py-3 bg-orange-600 text-white rounded-2xl font-bold text-sm hover:bg-orange-700 transition-colors shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {t.confirmOutbound}
              </button>
            </div>
          )}

          {transferType === 'outgoing' && (
            <button 
              onClick={onClose}
              className="w-full py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-2xl font-bold text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              {t.cancel}
            </button>
          )}
        </div>
      </div>

      {/* Rejection Reason Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 z-[110] flex items-center justify-center p-4">
          <div className={`bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl ${language === 'ar' ? 'font-arabic' : ''}`}>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t.rejectAll}</h3>
            </div>
            <textarea 
              value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-xl mb-4 bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-red-500 resize-none"
              placeholder={t.rejectionPlaceholder}
              rows={3}
            />
            <div className="flex gap-3">
              <button 
                onClick={() => setShowRejectModal(false)} 
                className="flex-1 py-2.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl font-medium transition-colors"
              >
                {t.cancel}
              </button>
              <button 
                onClick={executeRejectAll}
                disabled={!rejectionReason.trim() || isSubmitting}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {isSubmitting && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {t.reject}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransferDetailModal;
