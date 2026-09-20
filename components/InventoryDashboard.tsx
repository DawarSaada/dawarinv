import React, { useState, useRef, useEffect, useMemo } from 'react';
import { InventoryItem, LocationId, Language, Transaction, LocationData, CatalogItem, AppNotification, TransferSettings, Audit, Supplier, PurchaseOrder, PurchaseOrderStatus, Theme } from '../types';
import { TRANSLATIONS } from '../constants';
import { useToast } from './Toast';
import SmartAssistant from './SmartAssistant';
import TransferModal from './TransferModal';
import AddItemModal from './AddItemModal';
import UsageModal from './UsageModal';
import BulkEditModal from './BulkEditModal';
import ItemHistoryModal from './ItemHistoryModal';
import ConfirmationModal from './ConfirmationModal';
import ReceiveModal from './ReceiveModal';
import { Pagination } from './Pagination';
import AuditManagement from './admin/AuditManagement';
import ScheduleAuditModal from './admin/ScheduleAuditModal';
import PerformAuditModal from './admin/PerformAuditModal';
import ReviewAuditModal from './admin/ReviewAuditModal';
import { extractTextFromPDF, parseTransferDocument } from '../services/pdfService';
import { AiUnavailableError, describeAiError } from '../services/aiClient';
import { exportTransferPDF, exportInventoryExcel } from '../services/exportService';
import { useAuditLock } from '../hooks/useAuditLock';
import { accessFor, canCreateProduct, canWriteLocation, readOnlyMessage } from '../services/permissions';
import { UserRole } from '../types';
import { logger } from '../utils/logger';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRightLeft,
  CheckSquare,
  ClipboardCheck,
  FileSpreadsheet,
  LayoutGrid,
  List,
  LogOut,
  Moon,
  Package,
  Plus,
  Printer,
  Rows3,
  ScanLine,
  Search,
  Sun,
  ShoppingCart,
  Sparkles,
  Upload,
  XCircle
} from 'lucide-react';
import {
  AppShell,
  Badge,
  Button,
  EmptyState,
  Field,
  FilterBar,
  Modal,
  PageBody,
  PageHeader,
  CommandPalette,
  Segmented,
  Select,
  ShellBrand,
  Textarea,
  type ActiveFilterChip,
  type CommandItem,
  type MenuItem,
  type NavItem
} from './ui';
import AppControls from './AppControls';
import NotificationCenter from './NotificationCenter';
import { useHotkey } from '../hooks/useHotkey';
import InventoryNotifications from './inventory/InventoryNotifications';
import InventoryGrid from './inventory/InventoryGrid';
import BulkActionsBar from './inventory/BulkActionsBar';
import ScannerModal from './ScannerModal';
import PrintLabels from './inventory/PrintLabels';
import TransferDetailModal from './TransferDetailModal';
import PurchaseOrderManagement from './admin/PurchaseOrderManagement';
import PurchaseOrderModal from './admin/PurchaseOrderModal';
import ReceivePOModal from './admin/ReceivePOModal';

interface InventoryDashboardProps {
  locationId: LocationId;
  inventory: InventoryItem[];
  transactions: Transaction[];
  onBack: () => void;
  onLogout: () => void;
  language: Language;
  onTransfer: (items: { itemId: string, quantity: number }[], toLocation: LocationId, sourceOverride?: LocationId) => void;
  onAddItem: (locationId: string, item: Omit<InventoryItem, 'id' | 'lastUpdated'>) => void;
  onEditItem: (locationId: string, item: InventoryItem) => void;
  onDeleteItem: (locationId: string, itemId: string) => void;
  onBulkDeleteItems: (locationId: string, itemIds: string[]) => void;
  onBulkEditItems: (locationId: string, itemIds: string[], updates: Partial<InventoryItem>) => void;
  onRecordUsage: (itemId: string, quantity: number, notes: string) => void;
  onRecordReceive?: (itemId: string, quantity: number, notes: string) => void;
  userRole: string;
  userBranchCode?: string;
  accessibleBranches?: string[];
  readOnlyBranches?: string[];
  incomingTransfers: Transaction[];
  outgoingTransfers: Transaction[];
  outgoingApprovals: Transaction[];
  onReceiveTransfer: (transaction: Transaction) => void;
  onRejectTransfer: (transaction: Transaction, reason: string) => void;
  onConfirmOutbound: (transaction: Transaction) => void;
  availableLocations: LocationData[];
  getUserName: (name: string) => string;
  catalog: CatalogItem[];
  alerts?: AppNotification[];
  transferSettings?: TransferSettings;
  onReceiveTransferGroup?: (groupId: string, items: any[], signatureUrl?: string) => void;
  onRejectTransferGroup?: (groupId: string, reason: string) => void;
  onConfirmTransferGroup?: (groupId: string) => void;
  onMarkNotificationAsRead?: (id: string) => void;
  onMarkAllNotificationsAsRead?: () => void;
  audits?: Audit[];
  onScheduleAudit?: (params: any) => void;
  onSaveAuditCounts?: (auditId: string, items: any[]) => void;
  onSubmitAudit?: (id: string) => void;
  onApplyAudit?: (auditId: string, performedBy: string) => void;
  onDeleteAudit?: (auditId: string) => void;
  suppliers?: Supplier[];
  purchaseOrders?: PurchaseOrder[];
  onCreatePO?: (po: Omit<PurchaseOrder, 'id' | 'createdAt' | 'updatedAt' | 'poNumber' | 'status'> & { status?: string }, items: any[]) => void;
  onEditPO?: (id: string, po: Partial<PurchaseOrder>, items: any[]) => void;
  onUpdatePOStatus?: (id: string, status: PurchaseOrderStatus, performedBy: string) => void;
  onReceivePO?: (poId: string, items: any[], performedBy: string) => void;
  /** Theme/language controls are hosted by the shell top bar, not floating over content. */
  theme?: Theme;
  onToggleTheme?: () => void;
  onToggleLanguage?: () => void;
}

const InventoryDashboard: React.FC<InventoryDashboardProps> = ({ 
  locationId, 
  inventory, 
  transactions,
  onBack, 
  onLogout, 
  language,
  onTransfer,
  onAddItem,
  onEditItem,
  onDeleteItem,
  onBulkDeleteItems,
  onBulkEditItems,
  onRecordUsage,
  userRole,
  userBranchCode,
  accessibleBranches = [],
  readOnlyBranches = [],
  incomingTransfers,
  outgoingTransfers,
  outgoingApprovals,
  onReceiveTransfer,
  onRejectTransfer,
  onConfirmOutbound,
  availableLocations,
  getUserName,
  onRecordReceive,
  catalog,
  alerts = [],
  transferSettings = { enableSignatureCapture: false, enablePhotoEvidence: false, enableAutoReject: false, autoRejectDays: 7 },
  onReceiveTransferGroup,
  onRejectTransferGroup,
  onConfirmTransferGroup,
  onMarkNotificationAsRead,
  onMarkAllNotificationsAsRead,
  audits = [],
  onScheduleAudit,
  onSaveAuditCounts,
  onSubmitAudit,
  onApplyAudit,
  onDeleteAudit,
  suppliers = [],
  purchaseOrders = [],
  onCreatePO,
  onEditPO,
  onUpdatePOStatus,
  onReceivePO,
  theme,
  onToggleTheme,
  onToggleLanguage
}) => {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<'inventory' | 'audits' | 'purchase_orders'>(() => {
    const hash = window.location.hash.replace('#', '');
    if (['inventory', 'audits', 'purchase_orders'].includes(hash)) {
      return hash as any;
    }
    return 'inventory';
  });

  useEffect(() => {
    window.location.hash = activeTab;
  }, [activeTab]);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (['inventory', 'audits', 'purchase_orders'].includes(hash)) {
        setActiveTab(hash as any);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [stockStatusFilter, setStockStatusFilter] = useState<'all' | 'inStock' | 'lowStock'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'quantity' | 'lastUpdated'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'compact'>('grid');
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  useHotkey('k', () => setIsCommandOpen((open) => !open), { mod: true });
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);
  
  const [itemToEdit, setItemToEdit] = useState<InventoryItem | null>(null);
  const [historyItem, setHistoryItem] = useState<InventoryItem | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  
  const [isUsageModalOpen, setIsUsageModalOpen] = useState(false);
  const [usageItem, setUsageItem] = useState<InventoryItem | null>(null);
  
  const [showScanner, setShowScanner] = useState(false);
  const [showPrintLabels, setShowPrintLabels] = useState(false);

  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [receiveItem, setReceiveItem] = useState<InventoryItem | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean; itemId: string; itemName: string}>({isOpen: false, itemId: '', itemName: ''});
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);


  // Grouped Notifications State
  const [selectedTransferGroup, setSelectedTransferGroup] = useState<string | null>(null);
  const [transferDetailGroupId, setTransferDetailGroupId] = useState<string | null>(null);
  const [transferDetailType, setTransferDetailType] = useState<'incoming' | 'outgoing' | 'approval'>('incoming');

  // Audit Modals State
  const [isScheduleAuditModalOpen, setIsScheduleAuditModalOpen] = useState(false);
  const [isPerformAuditModalOpen, setIsPerformAuditModalOpen] = useState(false);
  const [isReviewAuditModalOpen, setIsReviewAuditModalOpen] = useState(false);
  const [selectedAudit, setSelectedAudit] = useState<Audit | null>(null);

  // PO Modals State
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | undefined>(undefined);
  const [isPOModalOpen, setIsPOModalOpen] = useState(false);
  const [isReceivePOModalOpen, setIsReceivePOModalOpen] = useState(false);

  const [rejectionTarget, setRejectionTarget] = useState<Transaction[] | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessingPdf, setIsProcessingPdf] = useState(false);
  const [pdfTransferData, setPdfTransferData] = useState<{
      targetLocationId: string | null;
      items: { itemId: string; quantity: number }[];
  } | null>(null);

  useEffect(() => {
    const handleClickOutside = () => {
        setActiveActionId(null);
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const isGlobalView = locationId === 'all';
  const t = TRANSLATIONS[language];
  const locationData = availableLocations.find(l => l.id === locationId);
  const locationName = isGlobalView ? t.globalInventory : (locationId === 'warehouse' ? t.warehouse : locationId === 'mammal' ? t.mammal : (locationData ? (language === 'ar' ? (locationData.nameAr || locationData.name) : locationData.name) : locationId));
  const location: LocationData = locationData || (isGlobalView
    ? { id: 'all', name: t.globalInventory, description: '', icon: 'globe', type: 'global' }
    : { id: locationId, name: locationId, description: '', icon: 'package' });

  /**
   * All write access decisions come from services/permissions.ts.
   *
   * Previously these were hand-written per action and disagreed with each other:
   * a branch marked read-only for the user was still editable, "bulk edit" excluded
   * branch managers outright, and the warehouse-manager usage check had a
   * copy-paste `locationId === 'warehouse' || locationId === 'warehouse'` that
   * silently denied mammal. Read-only access now also greys out the write actions
   * rather than leaving them to fail.
   */
  const accessSubject = {
    role: userRole as UserRole,
    branchCode: userBranchCode,
    accessibleBranches,
    readOnlyBranches,
  };
  const locationAccess = isGlobalView ? 'none' : accessFor(accessSubject, locationId);
  const isReadOnly = locationAccess === 'read';

  const canCreateProductFlag = canCreateProduct(accessSubject);
  const canEditItem = locationAccess === 'write';
  const canBulkEdit = locationAccess === 'write' && userRole !== 'mammal_employee';
  const canRecordUsage = locationAccess === 'write';

  const { isInventoryLocked, lockedByAuditTitle } = useAuditLock(userRole);

  const effectiveCanEditItem = canEditItem && !isInventoryLocked;
  const effectiveCanBulkEdit = canBulkEdit && !isInventoryLocked;
  const effectiveCanRecordUsage = canRecordUsage && !isInventoryLocked;

  const categories = useMemo(() => {
    const cats = new Set(inventory.map(item => item.category));
    return Array.from(cats).sort();
  }, [inventory]);

  const filteredItems = useMemo(() => {
    const filtered = inventory.filter(item => {
      const searchLower = search.toLowerCase();
      
      // Search by name or barcode
      if (search) {
        const itemName = language === 'ar' ? item.nameAr : item.nameEn;
        const matchesSearch = itemName.toLowerCase().includes(searchLower) || (item.barcode && item.barcode.toLowerCase().includes(searchLower));
        if (!matchesSearch) return false;
      }
      
      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
      const isLowStock = item.quantity <= item.minThreshold;
      const matchesStockStatus = stockStatusFilter === 'all' || (stockStatusFilter === 'lowStock' && isLowStock) || (stockStatusFilter === 'inStock' && !isLowStock);

      return matchesCategory && matchesStockStatus;
    });

    return filtered.sort((a, b) => {
        let comparison = 0;
        switch (sortBy) {
            case 'name':
                const nameA = language === 'ar' ? a.nameAr : a.nameEn;
                const nameB = language === 'ar' ? b.nameAr : b.nameEn;
                comparison = nameA.localeCompare(nameB);
                break;
            case 'quantity':
                comparison = a.quantity - b.quantity;
                break;
            case 'lastUpdated':
                comparison = new Date(a.lastUpdated || 0).getTime() - new Date(b.lastUpdated || 0).getTime();
                break;
        }
        return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [inventory, search, selectedCategory, stockStatusFilter, language, sortBy, sortOrder]);

  const isExpiringSoon = (dateString?: string) => {
    if (!dateString) return false;
    const expDate = new Date(dateString);
    const today = new Date();
    const diffTime = expDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 30 && diffDays >= 0;
  };

  const isExpired = (dateString?: string) => {
    if (!dateString) return false;
    const expDate = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return expDate < today;
  };

  const lowStockItems = inventory.filter(item => item.quantity <= item.minThreshold);
  const groupedIncoming = useMemo(() => {
      const groups: Record<string, Transaction[]> = {};
      incomingTransfers.forEach(tx => {
          const fallbackGid = `${tx.fromLocation}-${tx.toLocation}-${new Date(tx.date).toISOString().substring(0, 16)}`;
          const gid = tx.transferGroupId || fallbackGid;
          if (!groups[gid]) groups[gid] = [];
          groups[gid].push(tx);
      });
      return Object.entries(groups).sort((a,b) => new Date(b[1][0].date).getTime() - new Date(a[1][0].date).getTime());
  }, [incomingTransfers]);

  const groupedOutgoing = useMemo(() => {
    const groups: Record<string, Transaction[]> = {};
    outgoingTransfers.forEach(tx => {
        const fallbackGid = `${tx.fromLocation}-${tx.toLocation}-${new Date(tx.date).toISOString().substring(0, 16)}`;
        const gid = tx.transferGroupId || fallbackGid;
        if (!groups[gid]) groups[gid] = [];
        groups[gid].push(tx);
    });
    return Object.entries(groups).sort((a,b) => new Date(b[1][0].date).getTime() - new Date(a[1][0].date).getTime());
}, [outgoingTransfers]);

  const groupedApprovals = useMemo(() => {
    const groups: Record<string, Transaction[]> = {};
    outgoingApprovals.forEach(tx => {
        const fallbackGid = `${tx.fromLocation}-${tx.toLocation}-${new Date(tx.date).toISOString().substring(0, 16)}`;
        const gid = tx.transferGroupId || fallbackGid;
        if (!groups[gid]) groups[gid] = [];
        groups[gid].push(tx);
    });
    return Object.entries(groups).sort((a,b) => new Date(b[1][0].date).getTime() - new Date(a[1][0].date).getTime());
  }, [outgoingApprovals]);

  const handleReject = () => {
      if (rejectionTarget && rejectionReason.trim()) {
          rejectionTarget.forEach(tx => onRejectTransfer(tx, rejectionReason));
          setRejectionTarget(null);
          setRejectionReason('');
      }
  };

  const handleBulkAccept = async (groupId: string) => {
      const group = groupedIncoming.find(g => g[0] === groupId);
      if (group) {
          for (const tx of group[1]) {
              await onReceiveTransfer(tx);
          }
      }
  };

  const handleDownloadTransfer = (groupId: string, type: 'incoming' | 'outgoing') => {
    const group = (type === 'incoming' ? groupedIncoming : groupedOutgoing).find(g => g[0] === groupId);
    if (group) {
      const tx = group[1][0];
      const fromLoc = availableLocations.find(l => l.id === tx.fromLocation);
      const toLoc = availableLocations.find(l => l.id === tx.toLocation);
      const fromLocationName = fromLoc ? (fromLoc.id === 'warehouse' ? t.warehouse : fromLoc.id === 'mammal' ? t.mammal : (language === 'ar' ? (fromLoc.nameAr || fromLoc.name) : fromLoc.name)) : (tx.fromLocation || '');
      const toLocationName = toLoc ? (toLoc.id === 'warehouse' ? t.warehouse : toLoc.id === 'mammal' ? t.mammal : (language === 'ar' ? (toLoc.nameAr || toLoc.name) : toLoc.name)) : (tx.toLocation || '');
      
      const translatedTransactions = group[1].map(t => ({
        ...t,
        performedBy: getUserName ? getUserName(t.performedBy) : t.performedBy
      }));
      
      exportTransferPDF(translatedTransactions, language, fromLocationName, toLocationName);
    }
  };

  const toggleItemSelection = (itemId: string) => {
    setSelectedItemIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedItemIds.size === filteredItems.length) {
      setSelectedItemIds(new Set());
    } else {
      setSelectedItemIds(new Set(filteredItems.map(i => i.id)));
    }
  };

  const handleBulkDelete = () => {
    setBulkDeleteConfirm(true);
  };

  const executeBulkDelete = () => {
    const allIds = Array.from(selectedItemIds).flatMap(id => id.split(','));
    onBulkDeleteItems(locationId, allIds);
    setSelectedItemIds(new Set());
    setBulkDeleteConfirm(false);
  };

  const handleBulkTransfer = () => {
    const selectedItemsData = Array.from(selectedItemIds).flatMap(id => {
      const ids = id.split(',');
      return ids.map(individualId => ({
        itemId: individualId,
        quantity: 0
      }));
    });
    
    setPdfTransferData({
      targetLocationId: null,
      items: selectedItemsData
    });
    setIsTransferModalOpen(true);
  };

  const handleBulkEdit = () => {
    setIsBulkEditModalOpen(true);
  };

  const handleBulkEditSave = (updates: Partial<InventoryItem>) => {
    const allIds = Array.from(selectedItemIds).flatMap(id => id.split(','));
    onBulkEditItems(locationId, allIds, updates);
    setSelectedItemIds(new Set());
  };

  const handleTransferSubmit = async (transferItems: { itemId: string, quantity: number }[], toLocation: LocationId, sourceOverride?: LocationId) => {
    await onTransfer(transferItems, toLocation, sourceOverride);
    setSelectedItemIds(new Set());
    setPdfTransferData(null);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessingPdf(true);
    try {
        const text = await extractTextFromPDF(file);
        const data = await parseTransferDocument(text, inventory, availableLocations);

        // Nothing matched: tell the user instead of opening an empty transfer form.
        if (data.items.length === 0) {
            addToast(
                'warning',
                language === 'ar'
                    ? 'لم يتم العثور على أصناف مطابقة في هذا المستند'
                    : 'No matching items were found in that document'
            );
            return;
        }

        setPdfTransferData(data);
        setIsTransferModalOpen(true);

        if (data.unmatched && data.unmatched.length > 0) {
            addToast(
                'info',
                language === 'ar'
                    ? `تم تجاهل ${data.unmatched.length} صنف غير معروف: ${data.unmatched.slice(0, 3).join(', ')}`
                    : `Ignored ${data.unmatched.length} unrecognised item(s): ${data.unmatched.slice(0, 3).join(', ')}`
            );
        }
    } catch (error) {
        logger.error("PDF Error", error);
        addToast(
            'error',
            error instanceof AiUnavailableError ? describeAiError(error, language) : t.matchError
        );
    } finally {
        setIsProcessingPdf(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleScan = (decodedText: string) => {
    setSearch(decodedText);
    setShowScanner(false);
  };

  const isAr = language === 'ar';

  const navItems: NavItem[] = [
    { id: 'inventory', label: isAr ? 'المخزون' : 'Inventory', icon: <Package />, mobilePrimary: true },
    ...(!isGlobalView
      ? [
          { id: 'audits', label: isAr ? 'جرد المخزون' : 'Audits', icon: <ClipboardCheck />, mobilePrimary: true },
          ...(onCreatePO && onUpdatePOStatus
            ? [{ id: 'purchase_orders', label: isAr ? 'طلبات الشراء' : 'Purchase Orders', icon: <ShoppingCart /> }]
            : [])
        ]
      : [])
  ];

  const activeFilterCount =
    (selectedCategory !== 'all' ? 1 : 0) + (stockStatusFilter !== 'all' ? 1 : 0);

  const filterChips: ActiveFilterChip[] = [
    ...(selectedCategory !== 'all'
      ? [
          {
            id: 'category',
            label: `${isAr ? 'الفئة' : 'Category'}: ${selectedCategory}`,
            onRemove: () => setSelectedCategory('all')
          }
        ]
      : []),
    ...(stockStatusFilter !== 'all'
      ? [
          {
            id: 'stock',
            label: stockStatusFilter === 'lowStock' ? t.lowStock : t.inStock,
            tone: stockStatusFilter === 'lowStock' ? ('warning' as const) : ('success' as const),
            onRemove: () => setStockStatusFilter('all')
          }
        ]
      : [])
  ];

  const toolbarMenuItems: MenuItem[] = [
    {
      id: 'transfer',
      label: isAr ? 'طلب تحويل' : 'New transfer',
      icon: <ArrowRightLeft />,
      disabled: isInventoryLocked,
      onSelect: () => setIsTransferModalOpen(true)
    },
    {
      id: 'import',
      label: isAr ? 'استيراد من PDF' : 'Import from PDF',
      icon: <Upload />,
      disabled: isInventoryLocked || isProcessingPdf,
      onSelect: () => fileInputRef.current?.click()
    },
    { id: '__separator__' },
    {
      id: 'select-all',
      label: isAr ? 'تحديد الكل' : 'Select all',
      icon: <CheckSquare />,
      onSelect: toggleSelectAll
    },
    {
      id: 'labels',
      label: isAr ? 'طباعة الملصقات' : 'Print labels',
      icon: <Printer />,
      disabled: selectedItemIds.size === 0,
      onSelect: () => setShowPrintLabels(true)
    },
    {
      id: 'export',
      label: isAr ? 'تصدير Excel' : 'Export Excel',
      icon: <FileSpreadsheet />,
      onSelect: () => exportInventoryExcel(filteredItems, locationId, language)
    }
  ];

  const commandItems: CommandItem[] = [
    ...(effectiveCanEditItem
      ? [
          {
            id: 'add-item',
            label: isAr ? 'إضافة صنف' : 'Add item',
            group: isAr ? 'إجراءات' : 'Actions',
            icon: <Plus />,
            onSelect: () => {
              setItemToEdit(null);
              setIsAddItemModalOpen(true);
            }
          }
        ]
      : []),
    ...(!isInventoryLocked
      ? [
          {
            id: 'transfer',
            label: isAr ? 'طلب تحويل' : 'New transfer',
            group: isAr ? 'إجراءات' : 'Actions',
            icon: <ArrowRightLeft />,
            onSelect: () => setIsTransferModalOpen(true)
          },
          {
            id: 'scan',
            label: isAr ? 'مسح الباركود' : 'Scan barcode',
            group: isAr ? 'إجراءات' : 'Actions',
            icon: <ScanLine />,
            onSelect: () => setShowScanner(true)
          }
        ]
      : []),
    {
      id: 'export',
      label: isAr ? 'تصدير المخزون إلى Excel' : 'Export inventory to Excel',
      group: isAr ? 'إجراءات' : 'Actions',
      icon: <FileSpreadsheet />,
      onSelect: () => exportInventoryExcel(filteredItems, locationId, language)
    },
    {
      id: 'low-stock',
      label: isAr ? 'عرض الأصناف تحت الحد الأدنى' : 'Show low stock items',
      group: isAr ? 'تصفية' : 'Filter',
      icon: <AlertTriangle />,
      onSelect: () => setStockStatusFilter('lowStock')
    },
    {
      id: 'clear-filters',
      label: isAr ? 'مسح كل عوامل التصفية' : 'Clear all filters',
      group: isAr ? 'تصفية' : 'Filter',
      onSelect: () => {
        setSearch('');
        setSelectedCategory('all');
        setStockStatusFilter('all');
      }
    },
    { id: 'grid', label: isAr ? 'عرض شبكي' : 'Grid view', group: isAr ? 'العرض' : 'View', icon: <LayoutGrid />, onSelect: () => setViewMode('grid') },
    { id: 'list', label: isAr ? 'عرض قائمة' : 'List view', group: isAr ? 'العرض' : 'View', icon: <List />, onSelect: () => setViewMode('list') },
    { id: 'compact', label: isAr ? 'عرض مكثف' : 'Compact view', group: isAr ? 'العرض' : 'View', icon: <Rows3 />, onSelect: () => setViewMode('compact') },
    ...filteredItems.slice(0, 40).map((item) => ({
      id: `item-${item.id}`,
      label: isAr ? item.nameAr || item.nameEn : item.nameEn || item.nameAr,
      group: isAr ? 'الأصناف' : 'Items',
      icon: <Package />,
      keywords: [item.category, item.barcode || '', String(item.quantity)],
      onSelect: () => {
        setSearch(isAr ? item.nameAr || item.nameEn : item.nameEn || item.nameAr);
        setViewMode('list');
      }
    })),
    {
      id: 'all-locations',
      label: isAr ? 'كل المواقع' : 'All locations',
      group: isAr ? 'تنقل' : 'Navigate',
      icon: <ArrowLeft className="rtl:rotate-180" />,
      onSelect: onBack
    },
    ...(!isGlobalView
      ? [
          { id: 'go-audits', label: isAr ? 'جرد المخزون' : 'Audits', group: isAr ? 'تنقل' : 'Navigate', icon: <ClipboardCheck />, onSelect: () => setActiveTab('audits') },
          ...(onCreatePO && onUpdatePOStatus
            ? [{ id: 'go-pos', label: isAr ? 'طلبات الشراء' : 'Purchase orders', group: isAr ? 'تنقل' : 'Navigate', icon: <ShoppingCart />, onSelect: () => setActiveTab('purchase_orders') }]
            : [])
        ]
      : []),
    {
      id: 'assistant',
      label: isAr ? 'المساعد الذكي' : 'AI assistant',
      group: isAr ? 'تنقل' : 'Navigate',
      icon: <Sparkles />,
      onSelect: () => setIsAssistantOpen(true)
    },
    ...(theme && onToggleTheme
      ? [{
          id: 'toggle-theme',
          label: theme === 'dark' ? (isAr ? 'الوضع الفاتح' : 'Switch to light mode') : isAr ? 'الوضع الداكن' : 'Switch to dark mode',
          group: isAr ? 'الإعدادات' : 'Preferences',
          icon: theme === 'dark' ? <Sun /> : <Moon />,
          onSelect: onToggleTheme
        }]
      : []),
    ...(onToggleLanguage
      ? [{
          id: 'toggle-language',
          label: isAr ? 'Switch to English' : 'التبديل إلى العربية',
          group: isAr ? 'الإعدادات' : 'Preferences',
          icon: <Sparkles />,
          onSelect: onToggleLanguage
        }]
      : []),
    {
      id: 'logout',
      label: t.logout,
      group: isAr ? 'الإعدادات' : 'Preferences',
      icon: <LogOut className="rtl:rotate-180" />,
      onSelect: onLogout
    }
  ];

  return (
    <AppShell
      className={language === 'ar' ? 'font-arabic' : ''}
      navLabel={isAr ? 'فتح القائمة' : 'Open navigation'}
      closeLabel={isAr ? 'إغلاق القائمة' : 'Close navigation'}
      brand={
        <ShellBrand
          mark={<Package />}
          title={locationName}
          subtitle={isGlobalView ? (isAr ? 'كل المواقع' : 'All locations') : isAr ? 'إدارة المخزون' : 'Inventory management'}
        />
      }
      navItems={navItems}
      activeId={activeTab}
      onNavigate={(id) => setActiveTab(id as typeof activeTab)}
      topbar={
        <div className="flex items-center gap-2">
          <Badge tone={isGlobalView ? 'info' : 'neutral'} className="hidden sm:inline-flex">
            {locationName}
          </Badge>
          <button
            type="button"
            onClick={() => setIsCommandOpen(true)}
            className="hidden h-9 items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 text-xs text-gray-500 transition-colors hover:border-gray-300 hover:text-gray-800 sm:flex dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-100"
          >
            <Search className="h-4 w-4" />
            <span>{isAr ? 'أوامر' : 'Commands'}</span>
            <kbd className="rounded border border-gray-200 px-1 text-2xs dark:border-gray-700">⌘K</kbd>
          </button>
          {lowStockItems.length > 0 && (
            <Badge tone="warning" icon={<AlertTriangle />} className="hidden md:inline-flex">
              {lowStockItems.length} {isAr ? 'تحت الحد' : 'low'}
            </Badge>
          )}
        </div>
      }
      topbarEnd={
        <>
          <Button
            variant="ghost"
            icon={<Search />}
            className="sm:hidden"
            aria-label={isAr ? 'الأوامر' : 'Commands'}
            title={isAr ? 'الأوامر' : 'Commands'}
            onClick={() => setIsCommandOpen(true)}
          />
          <Button
            variant="ghost"
            icon={<Sparkles />}
            aria-label={isAr ? 'المساعد الذكي' : 'AI assistant'}
            title={isAr ? 'المساعد الذكي' : 'AI assistant'}
            aria-pressed={isAssistantOpen}
            onClick={() => setIsAssistantOpen(!isAssistantOpen)}
          />
          <NotificationCenter
            notifications={alerts || []}
            language={language}
            t={t}
            onMarkAsRead={onMarkNotificationAsRead || (() => {})}
            onMarkAllAsRead={onMarkAllNotificationsAsRead}
          />
          {theme && onToggleTheme && onToggleLanguage && (
            <AppControls
              language={language}
              theme={theme}
              onToggleTheme={onToggleTheme}
              onToggleLanguage={onToggleLanguage}
            />
          )}
          <Button variant="ghost" icon={<LogOut className="rtl:rotate-180" />} onClick={onLogout} hideLabelOnMobile>
            {t.logout}
          </Button>
        </>
      }
      sidebarFooter={
        <Button variant="ghost" block icon={<ArrowLeft className="rtl:rotate-180" />} onClick={onBack}>
          {isAr ? 'كل المواقع' : 'All locations'}
        </Button>
      }
    >
      {/* Section screens (audits, purchase orders) carry their own header. */}
      {activeTab === 'inventory' && (
        <PageHeader
        title={locationName}
        subtitle={
          isGlobalView
            ? isAr
              ? 'عرض موحّد لجميع المواقع'
              : 'Combined view across every location'
            : isAr
              ? 'الأصناف والكميات والحالة في هذا الموقع'
              : 'Items, quantities and status for this location'
        }
        icon={<Package />}
        onBack={onBack}
        backLabel={isAr ? 'كل المواقع' : 'All locations'}
        meta={
          <>
            <Badge tone="neutral">{filteredItems.length}</Badge>
            {lowStockItems.length > 0 && (
              <Badge tone="warning" icon={<AlertTriangle />}>
                {lowStockItems.length} {isAr ? 'تحت الحد الأدنى' : 'below minimum'}
              </Badge>
            )}
            {isInventoryLocked && (
              <Badge tone="danger">{isAr ? 'مقفل بسبب جرد' : 'Locked by audit'}</Badge>
            )}
          </>
        }
        />
      )}

      <CommandPalette
        open={isCommandOpen}
        onClose={() => setIsCommandOpen(false)}
        items={commandItems}
        placeholder={isAr ? 'ابحث عن صنف أو أمر…' : 'Search for an item or command…'}
        emptyLabel={isAr ? 'لا توجد نتائج' : 'No matches'}
        recentLabel={isAr ? 'الأخيرة' : 'Recent'}
      />

      <PageBody className="space-y-4">              {/* Transfer requests, approvals and stock alerts — collapsed by default */}
          <InventoryNotifications 
            t={t}
            groupedIncoming={groupedIncoming}
            groupedApprovals={groupedApprovals}
            handleDownloadTransfer={handleDownloadTransfer}
            setSelectedTransferGroup={setSelectedTransferGroup}
            handleBulkAccept={handleBulkAccept}
            setRejectionTarget={setRejectionTarget}
            onConfirmOutbound={onConfirmOutbound}
            alerts={alerts}
            language={language}
            availableLocations={availableLocations}
            onOpenTransferDetail={(groupId, type) => {
              setTransferDetailGroupId(groupId);
              setTransferDetailType(type);
            }}
            onMarkAsRead={onMarkNotificationAsRead}
          />

          {!isGlobalView && (
            <div className="scrollbar-hide -mx-4 -mt-4 flex gap-1 overflow-x-auto border-b border-gray-200 px-4 sm:mx-0 sm:px-0 dark:border-gray-800">
              <button 
                onClick={() => setActiveTab('inventory')}
                className={`relative -mb-px border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors ${activeTab === 'inventory' ? 'border-brand-600 text-gray-900 dark:border-brand-500 dark:text-white' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-800 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-200'}`}
              >
                {language === 'ar' ? 'المخزون' : 'Inventory'}
              </button>
              <button 
                onClick={() => setActiveTab('audits')}
                className={`relative -mb-px border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors ${activeTab === 'audits' ? 'border-brand-600 text-gray-900 dark:border-brand-500 dark:text-white' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-800 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-200'}`}
              >
                {language === 'ar' ? 'جرد المخزون' : 'Audits'}
              </button>
              <button 
                onClick={() => setActiveTab('purchase_orders')}
                className={`relative -mb-px border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors ${activeTab === 'purchase_orders' ? 'border-brand-600 text-gray-900 dark:border-brand-500 dark:text-white' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-800 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-200'}`}
              >
                {language === 'ar' ? 'طلبات الشراء' : 'Purchase Orders'}
              </button>
            </div>
          )}

          {activeTab === 'inventory' && (
            <>
              {isInventoryLocked && (
                <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-start gap-3 animate-fade-in">
                  <div className="p-2 bg-red-100 dark:bg-red-900/40 rounded-lg text-red-600 dark:text-red-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-red-900 dark:text-red-400">
                      {language === 'ar' ? 'المخزون مقفل' : 'Inventory Locked'}
                    </h3>
                    <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                      {language === 'ar' 
                        ? `لا يمكن إجراء تعديلات. يوجد جرد نشط: ${lockedByAuditTitle}`
                        : `Modifications are disabled. An active audit is in progress: ${lockedByAuditTitle}`}
                    </p>
                  </div>
                </div>
              )}

              <FilterBar
                filtersLabel={isAr ? 'تصفية' : 'Filters'}
                clearLabel={isAr ? 'مسح الكل' : 'Clear all'}
                doneLabel={isAr ? 'تم' : 'Done'}
                moreLabel={isAr ? 'خيارات أخرى' : 'More options'}
                search={{
                  value: search,
                  onChange: setSearch,
                  placeholder: t.searchPlaceholder,
                  trailingSlot: (
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<ScanLine />}
                      aria-label={isAr ? 'مسح الباركود' : 'Scan barcode'}
                      title={isAr ? 'مسح الباركود' : 'Scan barcode'}
                      disabled={isInventoryLocked}
                      onClick={() => setShowScanner(true)}
                    />
                  )
                }}
                chips={filterChips}
                filterCount={activeFilterCount}
                onClearFilters={() => {
                  setSearch('');
                  setSelectedCategory('all');
                  setStockStatusFilter('all');
                }}
                inlineControls={
                  <Segmented<'grid' | 'list' | 'compact'>
                    aria-label={isAr ? 'طريقة العرض' : 'View mode'}
                    value={viewMode}
                    onChange={setViewMode}
                    items={[
                      { id: 'grid', label: isAr ? 'شبكة' : 'Grid', icon: <LayoutGrid /> },
                      { id: 'list', label: isAr ? 'قائمة' : 'List', icon: <List /> },
                      { id: 'compact', label: isAr ? 'مكثف' : 'Compact', icon: <Rows3 /> }
                    ]}
                  />
                }
                filters={
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                        {isAr ? 'الفئة' : 'Category'}
                      </p>
                      <Select
                        value={selectedCategory}
                        onChange={(event) => setSelectedCategory(event.target.value)}
                        aria-label={isAr ? 'الفئة' : 'Category'}
                      >
                        <option value="all">{isAr ? 'كل الفئات' : 'All categories'}</option>
                        {categories.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                        {isAr ? 'حالة المخزون' : 'Stock status'}
                      </p>
                      <Segmented<'all' | 'inStock' | 'lowStock'>
                        value={stockStatusFilter}
                        onChange={setStockStatusFilter}
                        className="w-full"
                        items={[
                          { id: 'all', label: isAr ? 'الكل' : 'All' },
                          { id: 'lowStock', label: t.lowStock, icon: <AlertTriangle /> },
                          { id: 'inStock', label: t.inStock }
                        ]}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                        {isAr ? 'الترتيب' : 'Sort by'}
                      </p>
                      <Select
                        value={`${sortBy}:${sortOrder}`}
                        onChange={(event) => {
                          const [key, order] = event.target.value.split(':');
                          setSortBy(key as typeof sortBy);
                          setSortOrder(order as typeof sortOrder);
                        }}
                        aria-label={isAr ? 'الترتيب' : 'Sort by'}
                      >
                        <option value="name:asc">{isAr ? 'الاسم (أ - ي)' : 'Name (A–Z)'}</option>
                        <option value="name:desc">{isAr ? 'الاسم (ي - أ)' : 'Name (Z–A)'}</option>
                        <option value="quantity:asc">
                          {isAr ? 'الكمية (الأقل أولاً)' : 'Quantity (low to high)'}
                        </option>
                        <option value="quantity:desc">
                          {isAr ? 'الكمية (الأكثر أولاً)' : 'Quantity (high to low)'}
                        </option>
                        <option value="lastUpdated:desc">
                          {isAr ? 'آخر تحديث' : 'Recently updated'}
                        </option>
                      </Select>
                    </div>
                  </div>
                }
                primaryAction={
                  effectiveCanEditItem ? (
                    <Button
                      variant="primary"
                      icon={<Plus />}
                      onClick={() => {
                        setItemToEdit(null);
                        setIsAddItemModalOpen(true);
                      }}
                    >
                      {isAr ? 'إضافة صنف' : 'Add item'}
                    </Button>
                  ) : undefined
                }
                overflowActions={toolbarMenuItems}
              />

          {/* Inventory Container */}
          <InventoryGrid 
            filteredItems={filteredItems.slice((currentPage - 1) * pageSize, currentPage * pageSize)}
            viewMode={viewMode}
            language={language}
            isGlobalView={isGlobalView}
            selectedItemIds={selectedItemIds}
            toggleItemSelection={toggleItemSelection}
            canEditItem={effectiveCanEditItem}
            canRecordUsage={effectiveCanRecordUsage}
            activeActionId={activeActionId}
            setActiveActionId={setActiveActionId}
            t={t}
            onEditItem={(item) => { setItemToEdit(item); setIsAddItemModalOpen(true); }}
            onRecordUsage={(item) => { setUsageItem(item); setIsUsageModalOpen(true); }}
            onRecordReceive={(item) => { setReceiveItem(item); setIsReceiveModalOpen(true); }}
            onViewHistory={(item) => { setHistoryItem(item); setIsHistoryModalOpen(true); }}
            onDeleteItem={(item) => setDeleteConfirm({isOpen: true, itemId: item.id, itemName: language === 'ar' ? item.nameAr : item.nameEn})}
            isExpiringSoon={isExpiringSoon}
            isExpired={isExpired}
          />
          
          {filteredItems.length === 0 && (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-900">
              <EmptyState
                icon={<Package />}
                title={t.noItemsFound}
                description={t.tryAdjustingFilters}
                action={
                  activeFilterCount > 0 ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setSearch('');
                        setSelectedCategory('all');
                        setStockStatusFilter('all');
                      }}
                    >
                      {isAr ? 'مسح كل عوامل التصفية' : 'Clear filters'}
                    </Button>
                  ) : effectiveCanEditItem ? (
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<Plus />}
                      onClick={() => {
                        setItemToEdit(null);
                        setIsAddItemModalOpen(true);
                      }}
                    >
                      {isAr ? 'إضافة صنف' : 'Add item'}
                    </Button>
                  ) : undefined
                }
              />
            </div>
          )}

          {/* Pagination */}
          {filteredItems.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 dark:border-gray-800 dark:bg-gray-900">
              <Pagination
                currentPage={currentPage}
                pageSize={pageSize}
                totalItems={filteredItems.length}
                onPageChange={setCurrentPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setCurrentPage(1);
                }}
                language={language}
              />
            </div>
          )}
            </>
          )}

          {activeTab === 'audits' && (
            <AuditManagement 
              audits={audits.filter(a => a.locationId === locationId || isGlobalView)}
              locations={availableLocations}
              userRole={userRole as any}
              language={language}
              onOpenScheduleModal={() => setIsScheduleAuditModalOpen(true)}
              onOpenPerformModal={(audit) => { 
                const hasPendingTransfers = [...incomingTransfers, ...outgoingApprovals].some(
                  t => t.toLocation === audit.locationId || t.fromLocation === audit.locationId
                );
                
                if (hasPendingTransfers) {
                  alert(language === 'ar' 
                    ? 'لا يمكن بدء الجرد. الرجاء معالجة (استلام، رفض، أو تأكيد) جميع طلبات النقل المعلقة الخاصة بهذا الموقع أولاً.' 
                    : 'Cannot start audit. Please resolve (receive, reject, or confirm) all pending transfers for this location first.');
                  return;
                }
                
                setSelectedAudit(audit); 
                setIsPerformAuditModalOpen(true); 
              }}
              onOpenReviewModal={(audit) => { setSelectedAudit(audit); setIsReviewAuditModalOpen(true); }}
            />
          )}

          {activeTab === 'purchase_orders' && (
            <div>
              {onCreatePO && onUpdatePOStatus ? (
                <PurchaseOrderManagement
                  purchaseOrders={purchaseOrders.filter(po => po.locationId === locationId || (locationId === 'warehouse' && !po.locationId))}
                  suppliers={suppliers}
                  catalog={catalog}
                  language={language}
                  onCreatePO={(po, items) => onCreatePO({...po, locationId}, items)}
                  onEditPO={onEditPO || (() => {})}
                  onUpdateStatus={(id, status) =>
                    onUpdatePOStatus?.(id, status as PurchaseOrderStatus, getUserName(userRole))
                  }
                  onReceivePO={onReceivePO || (() => {})}
                  // Was '', so a branch receiving a purchase order wrote a ledger
                  // entry with no performer. The admin screen passed a real name.
                  userName={getUserName(userRole)}
                  // A PO can only select catalogue products, so raising one cannot
                  // introduce a new product — it follows the same rule as adding a
                  // catalogue item to a shelf rather than the admin-only rule.
                  canCreatePO={locationAccess === 'write'}
                  onOpenCreateModal={() => { setSelectedPO(undefined); setIsPOModalOpen(true); }}
                  onOpenViewModal={(po) => { setSelectedPO(po); setIsPOModalOpen(true); }}
                  onOpenReceiveModal={(po) => { setSelectedPO(po); setIsReceivePOModalOpen(true); }}
                />
              ) : (
                <div className="rounded-xl border border-dashed border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-900">
                  <EmptyState
                    icon={<ShoppingCart />}
                    title={isAr ? 'طلبات الشراء غير مهيأة' : 'Purchase orders not configured'}
                    description={
                      isAr
                        ? 'يرجى تفعيل وحدة المشتريات لاستخدام هذه الشاشة.'
                        : 'Enable the procurement module to use this screen.'
                    }
                  />
                </div>
              )}
            </div>
          )}

      </PageBody>

      {/* Bulk Actions Bar */}
          <BulkActionsBar 
            t={t}
            selectedCount={selectedItemIds.size}
            canBulkEdit={effectiveCanBulkEdit}
            onBulkEdit={handleBulkEdit}
            onBulkDelete={handleBulkDelete}
            onBulkTransfer={handleBulkTransfer}
            onBulkPrint={() => setShowPrintLabels(true)}
            onClearSelection={() => setSelectedItemIds(new Set())}
          />

      <SmartAssistant 
        locationName={locationName}
        items={inventory}
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
        language={language}
      />

      <TransferModal
        isOpen={isTransferModalOpen}
        onClose={() => { setIsTransferModalOpen(false); setPdfTransferData(null); }}
        currentLocation={locationId}
        items={inventory}
        onTransfer={handleTransferSubmit}
        language={language}
        availableLocations={availableLocations}
        initialData={pdfTransferData}
      />

      <AddItemModal 
        isOpen={isAddItemModalOpen}
        onClose={() => setIsAddItemModalOpen(false)}
        onSubmit={(item) => {
          if (itemToEdit) {
            onEditItem(locationId, { ...itemToEdit, ...item });
          } else {
            onAddItem(locationId, item);
          }
        }}
        language={language}
        initialData={itemToEdit}
        existingItems={inventory}
        catalog={catalog}
        canCreateProduct={canCreateProductFlag}
      />

      <BulkEditModal 
        isOpen={isBulkEditModalOpen}
        onClose={() => setIsBulkEditModalOpen(false)}
        selectedCount={selectedItemIds.size}
        onSave={handleBulkEditSave}
        language={language}
      />

      <ItemHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        item={historyItem}
        transactions={transactions}
        language={language}
        getUserName={getUserName}
        availableLocations={availableLocations}
      />

      <UsageModal
        isOpen={isUsageModalOpen}
        onClose={() => setIsUsageModalOpen(false)}
        item={usageItem}
        onConfirm={(qty, notes) => onRecordUsage(usageItem!.id, qty, notes)}
        language={language}
      />

      <ReceiveModal
        isOpen={isReceiveModalOpen}
        onClose={() => setIsReceiveModalOpen(false)}
        item={receiveItem}
        onConfirm={(qty, notes) => {
            if (onRecordReceive && receiveItem) {
                onRecordReceive(receiveItem.id, qty, notes);
            }
        }}
        language={language}
      />

      <ConfirmationModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({isOpen: false, itemId: '', itemName: ''})}
        onConfirm={() => { onDeleteItem(locationId, deleteConfirm.itemId); setDeleteConfirm({isOpen: false, itemId: '', itemName: ''}); }}
        title={t.confirmDeleteTitle}
        message={`${t.confirmDeleteItem}: "${deleteConfirm.itemName}"?`}
        language={language}
        danger={true}
      />

      <ConfirmationModal
        isOpen={bulkDeleteConfirm}
        onClose={() => setBulkDeleteConfirm(false)}
        onConfirm={executeBulkDelete}
        title={t.confirmDeleteTitle}
        message={language === 'ar' ? `هل أنت متأكد من حذف ${selectedItemIds.size} عنصر، لا يمكن التراجع عن هذا الإجراء.` : `Are you sure you want to delete ${selectedItemIds.size} item(s)? This action cannot be undone.`}
        language={language}
        danger={true}
      />

      {/* Rejection Modal */}
      <Modal
        open={!!rejectionTarget}
        onClose={() => setRejectionTarget(null)}
        title={t.rejectionReason}
        icon={<XCircle />}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRejectionTarget(null)}>
              {t.cancel}
            </Button>
            <Button
              variant="danger"
              disabled={!rejectionReason.trim()}
              onClick={handleReject}
            >
              {t.reject}
            </Button>
          </>
        }
      >
        <Field label={t.rejectionReason} hint={t.rejectionPlaceholder}>
          <Textarea
            value={rejectionReason}
            onChange={(event) => setRejectionReason(event.target.value)}
            placeholder={t.rejectionPlaceholder}
            rows={3}
            autoFocus
          />
        </Field>
      </Modal>

      {/* Transfer Detail Modal — NEW */}
      <TransferDetailModal
        isOpen={!!transferDetailGroupId}
        onClose={() => setTransferDetailGroupId(null)}
        transferGroupId={transferDetailGroupId || ''}
        transactions={(() => {
          if (!transferDetailGroupId) return [];
          const group = [...groupedIncoming, ...groupedApprovals, ...groupedOutgoing].find(g => g[0] === transferDetailGroupId);
          return group?.[1] || [];
        })()}
        transferType={transferDetailType}
        language={language}
        availableLocations={availableLocations}
        settings={transferSettings}
        onAcceptGroup={(isReadOnly || isInventoryLocked) ? undefined : ((groupId, items, sigUrl) => {
          if (onReceiveTransferGroup) {
            onReceiveTransferGroup(groupId, items, sigUrl);
          }
        })}
        onRejectGroup={(isReadOnly || isInventoryLocked) ? undefined : ((groupId, reason) => {
          if (onRejectTransferGroup) {
            onRejectTransferGroup(groupId, reason);
          }
        })}
        onConfirmGroup={(isReadOnly || isInventoryLocked) ? undefined : ((groupId) => {
          if (onConfirmTransferGroup) {
            onConfirmTransferGroup(groupId);
          }
        })}
        onDownload={handleDownloadTransfer}
        getUserName={getUserName}
      />

      {/* Legacy View Items Modal — kept for backwards compat */}
      <Modal
        open={!!selectedTransferGroup}
        onClose={() => setSelectedTransferGroup(null)}
        title={t.transferDetails}
        footer={
          <Button block variant="secondary" onClick={() => setSelectedTransferGroup(null)}>
            {t.cancel}
          </Button>
        }
      >
        <div className="space-y-2">
          {(() => {
            const group = [...groupedIncoming, ...groupedApprovals, ...groupedOutgoing].find(
              (entry) => entry[0] === selectedTransferGroup
            );
            return (group?.[1] || []).map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-800"
              >
                <span className="truncate text-sm text-gray-900 dark:text-white">
                  {isAr ? tx.itemNameAr || tx.itemNameEn : tx.itemNameEn || tx.itemNameAr}
                </span>
                <span className="tnum flex-shrink-0 text-sm font-semibold text-brand-700 dark:text-brand-400">
                  {tx.quantity} {tx.unit}
                </span>
              </div>
            ));
          })()}
        </div>
      </Modal>

      {showScanner && (
        <ScannerModal 
          isOpen={showScanner}
          onClose={() => setShowScanner(false)}
          language={language}
          t={t}
          onScan={(decodedText) => {
            setShowScanner(false);
            // Try to find the item
            const item = inventory.find(i => i.id === decodedText || i.barcode === decodedText);
            if (item) {
              addToast('success', language === 'ar' ? `تم العثور على: ${item.nameAr}` : `Found: ${item.nameEn}`);
              setSearch(item.nameEn); // Auto search for it
            } else {
              addToast('error', language === 'ar' ? 'لم يتم العثور على العنصر' : 'Item not found');
              setSearch(decodedText);
            }
          }}
        />
      )}

      {showPrintLabels && (
        <PrintLabels 
          items={inventory.filter(i => selectedItemIds.has(i.id))}
          onClose={() => setShowPrintLabels(false)}
          language={language}
          t={t}
        />
      )}

      <ScheduleAuditModal 
        isOpen={isScheduleAuditModalOpen}
        onClose={() => setIsScheduleAuditModalOpen(false)}
        language={language}
        locations={isGlobalView ? availableLocations : [location!]}
        inventory={isGlobalView ? {} : { [locationId]: inventory }}
        onSchedule={(params) => onScheduleAudit?.(params)}
        userName={getUserName(userRole)} 
      />

      <PerformAuditModal 
        isOpen={isPerformAuditModalOpen}
        onClose={() => { setIsPerformAuditModalOpen(false); setSelectedAudit(null); }}
        language={language}
        audit={selectedAudit}
        onSaveCounts={(items) => onSaveAuditCounts?.(selectedAudit!.id, items)}
        onSubmitAudit={(id) => onSubmitAudit?.(id)}
      />

      <ReviewAuditModal 
        isOpen={isReviewAuditModalOpen}
        onClose={() => { setIsReviewAuditModalOpen(false); setSelectedAudit(null); }}
        language={language}
        audit={selectedAudit}
        userRole={userRole as any}
        onApplyAudit={(id) => onApplyAudit?.(id, getUserName(userRole))}
      />

      {/* PO Modals */}
      {isPOModalOpen && onCreatePO && onEditPO && (
        <PurchaseOrderModal
          isOpen={isPOModalOpen}
          onClose={() => setIsPOModalOpen(false)}
          purchaseOrder={selectedPO}
          suppliers={suppliers}
          catalog={catalog}
          onSave={selectedPO 
            ? (po, items) => onEditPO(selectedPO.id, po, items)
            : (po, items) => onCreatePO({...po, locationId}, items)}
          // Editing an order writes its own branch, so withhold the controls when
          // the viewer only has read access there.
          canManage={canWriteLocation(accessSubject, (selectedPO?.locationId as string) || locationId)}
          // A branch manager orders for their own shelf and approves their own order, so
          // there is no approval queue for them. Enforced again in useInventoryData.
          autoApprove={accessSubject?.role === 'branch_manager'}
          onUpdateStatus={(id, status) =>
            onUpdatePOStatus?.(id, status as PurchaseOrderStatus, getUserName(userRole))
          }
          // `created_by` was '' for a purchase order raised by a branch.
          userName={getUserName(userRole)}
          language={language}
        />
      )}

      {isReceivePOModalOpen && selectedPO && onReceivePO && (
        <ReceivePOModal
          isOpen={isReceivePOModalOpen}
          onClose={() => setIsReceivePOModalOpen(false)}
          purchaseOrder={selectedPO || null}
          // Receiving writes stock into the order's own location, so it needs write
          // access there — not merely access to the purchase order screen.
          onReceive={(poId, items, performedBy) => {
            if (!canWriteLocation(accessSubject, selectedPO.locationId || 'warehouse')) {
              addToast('error', readOnlyMessage(language, selectedPO.locationId || undefined));
              return;
            }
            onReceivePO(poId, items, performedBy);
          }}
          userName={getUserName(userRole)}
          language={language}
        />
      )}
    </AppShell>
  );
};

export default InventoryDashboard;