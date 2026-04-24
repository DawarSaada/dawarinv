export type LocationId = string; // 'warehouse' | 'mammal' | 'all' | branchCode
export type Language = 'en' | 'ar';
export type Theme = 'light' | 'dark';
export type UserRole = 'admin' | 'branch_manager' | 'warehouse_manager' | 'mammal_employee';
export type TransactionType = 'transfer' | 'usage' | 'receive';
export type TransactionStatus = 'pending_source' | 'pending_target' | 'completed' | 'cancelled' | 'rejected';

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
  unit: string;
  performedBy: string;
  notes?: string;
  rejectionReason?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}