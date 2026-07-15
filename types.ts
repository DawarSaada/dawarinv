export type LocationId = string; // 'warehouse' | 'mammal' | 'all' | branchCode
export type Language = 'en' | 'ar';
export type Theme = 'light' | 'dark';
export type UserRole = 'admin' | 'branch_manager' | 'warehouse_manager' | 'mammal_employee';
export type TransactionType = 'transfer' | 'usage' | 'receive';
export type TransactionStatus = 'pending_source' | 'pending_target' | 'completed' | 'cancelled' | 'rejected';
export type PurchaseOrderStatus = 'draft' | 'pending' | 'approved' | 'received' | 'cancelled';
export type AuditStatus = 'scheduled' | 'in_progress' | 'pending_review' | 'completed' | 'cancelled';

export interface AuditItem {
  id: string;
  auditId: string;
  itemId?: string;
  itemNameEn: string;
  itemNameAr: string;
  category?: string;
  unit?: string;
  expectedQuantity: number;
  countedQuantity?: number;
  variance?: number;
  notes?: string;
}

export interface Audit {
  id: string;
  title: string;
  locationId: string;
  status: AuditStatus;
  scheduledDate?: string;
  completedDate?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  items?: AuditItem[];
}

export interface Supplier {
  id: string;
  nameEn: string;
  nameAr: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  suppliedItems?: string[];
  createdAt?: string;
}

export interface PurchaseOrderItem {
  id: string;
  poId: string;
  itemNameEn: string;
  itemNameAr: string;
  quantity: number;
  receivedQuantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  locationId?: string;
  status: PurchaseOrderStatus;
  expectedDelivery?: string;
  totalAmount: number;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  supplier?: Supplier;
  items?: PurchaseOrderItem[];
}

export interface InventoryItem {
  id: string;
  nameEn: string;
  nameAr: string;
  description?: string;
  category: string;
  quantity: number;
  unit: string;
  minThreshold: number;
  lastUpdated: string;
  locationId?: string; // Used in global view
  expirationDate?: string;
  barcode?: string;
}

export interface CatalogItem {
  id: string;
  nameEn: string;
  nameAr: string;
  description?: string;
  category: string;
  unit: string;
  minThreshold: number;
  barcode?: string;
  defaultPrice?: number;
}

export interface AppNotification {
  id: string;
  locationId: string;
  itemId: string;
  type: string;
  messageEn: string;
  messageAr: string;
  isRead: boolean;
  createdAt: string;
}

export interface LocationData {
  id: LocationId;
  name: string;
  nameAr?: string;
  description: string;
  descriptionAr?: string;
  icon: string;
  type?: 'central' | 'branch' | 'global';
}

export interface User {
  id: string;
  username: string;
  password?: string;
  name: string;
  nameAr?: string;
  role: UserRole;
  branchCode?: string;
  branchName?: string;
  branchNameAr?: string;
  accessibleBranches?: string[];
  readOnlyBranches?: string[];
}

export interface Transaction {
  id: string;
  transferGroupId?: string; // Group items together
  date: string;
  type: TransactionType;
  status: TransactionStatus;
  fromLocation?: string;
  toLocation?: string;
  itemNameEn: string;
  itemNameAr: string;
  quantity: number;
  receivedQuantity?: number;
  unit: string;
  performedBy: string;
  notes?: string;
  rejectionReason?: string;
  receiptNotes?: string;
  itemStatus?: 'pending' | 'received' | 'partial' | 'rejected' | 'extra';
  signatureUrl?: string;
  photoUrls?: string[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface TransferSettings {
  enableSignatureCapture: boolean;
  enablePhotoEvidence: boolean;
  enableAutoReject: boolean;
  autoRejectDays: number;
}