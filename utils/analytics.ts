import { Transaction, InventoryItem, LocationData } from '../types';

export const filterTransactionsByDays = (transactions: Transaction[], days: number) => {
  if (days === 0) return transactions; // All time
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  cutoffDate.setHours(0, 0, 0, 0);
  return transactions.filter(tx => new Date(tx.date) >= cutoffDate);
};

export const getKPIs = (inventoryMap: Record<string, InventoryItem[]>, transactions: Transaction[], days: number, locations: LocationData[]) => {
  // Total items
  const totalItems = Object.values(inventoryMap).flat().reduce((sum, item) => sum + item.quantity, 0);
  
  // Low stock alerts
  const lowStock = Object.values(inventoryMap).flat().filter(item => item.quantity <= item.minThreshold).length;
  
  // Active transfers
  const activeTransfers = transactions.filter(tx => tx.type === 'transfer' && tx.status === 'pending_target').length;

  // Most active branch
  const recentTx = filterTransactionsByDays(transactions, days);
  const branchActivity: Record<string, number> = {};
  
  recentTx.forEach(tx => {
    if (tx.fromLocation && tx.fromLocation !== 'warehouse') {
      branchActivity[tx.fromLocation] = (branchActivity[tx.fromLocation] || 0) + 1;
    }
    if (tx.toLocation && tx.toLocation !== 'warehouse') {
      branchActivity[tx.toLocation] = (branchActivity[tx.toLocation] || 0) + 1;
    }
  });

  let mostActiveBranchId = '';
  let maxActivity = -1;
  Object.entries(branchActivity).forEach(([loc, count]) => {
    if (count > maxActivity) {
      mostActiveBranchId = loc;
      maxActivity = count;
    }
  });

  const mostActiveBranch = locations.find(l => l.id === mostActiveBranchId);
  const mostActiveBranchName = mostActiveBranch ? mostActiveBranch.name : 'N/A';

  return { totalItems, lowStock, activeTransfers, mostActiveBranchName };
};

export const getConsumptionTrend = (transactions: Transaction[], days: number) => {
  const recentTx = filterTransactionsByDays(transactions, days);
  const usages = recentTx.filter(tx => tx.type === 'usage');
  
  const dailyUsage: Record<string, Record<string, number>> = {};
  const branchIds = new Set<string>();

  usages.forEach(tx => {
    const dateStr = new Date(tx.date).toISOString().split('T')[0];
    const locId = tx.fromLocation || 'unknown';
    
    if (!dailyUsage[dateStr]) dailyUsage[dateStr] = {};
    dailyUsage[dateStr][locId] = (dailyUsage[dateStr][locId] || 0) + tx.quantity;
    branchIds.add(locId);
  });

  // Ensure all days in range are represented
  const data = [];
  const limit = days === 0 ? 30 : days; // default to 30 days if all time
  for (let i = limit - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    
    const dayData: any = { date: dateStr };
    branchIds.forEach(loc => {
      dayData[loc] = dailyUsage[dateStr]?.[loc] || 0;
    });
    data.push(dayData);
  }

  return { data, branchIds: Array.from(branchIds) };
};

export const getTransferVolumes = (transactions: Transaction[], days: number, locations: LocationData[], lang: 'en'|'ar') => {
  const recentTx = filterTransactionsByDays(transactions, days);
  const transfers = recentTx.filter(tx => tx.type === 'transfer' && tx.status === 'completed');

  const volumes: Record<string, number> = {};
  
  transfers.forEach(tx => {
    if (tx.fromLocation === 'warehouse' && tx.toLocation) {
      volumes[tx.toLocation] = (volumes[tx.toLocation] || 0) + (tx.receivedQuantity || tx.quantity);
    }
  });

  return Object.entries(volumes).map(([locId, qty]) => {
    const loc = locations.find(l => l.id === locId);
    return {
      name: loc ? (lang === 'ar' ? (loc.nameAr || loc.name) : loc.name) : locId,
      quantity: qty
    };
  }).sort((a, b) => b.quantity - a.quantity);
};

export const getCategoryDistribution = (inventoryMap: Record<string, InventoryItem[]>) => {
  const allItems = Object.values(inventoryMap).flat();
  const distribution: Record<string, number> = {};
  
  allItems.forEach(item => {
    distribution[item.category] = (distribution[item.category] || 0) + 1;
  });

  return Object.entries(distribution).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
};

export const getTopDepletingItems = (transactions: Transaction[], days: number, lang: 'en'|'ar') => {
  const recentTx = filterTransactionsByDays(transactions, days);
  const usages = recentTx.filter(tx => tx.type === 'usage');
  
  const itemUsage: Record<string, number> = {};
  
  usages.forEach(tx => {
    const key = lang === 'ar' ? tx.itemNameAr : tx.itemNameEn;
    itemUsage[key] = (itemUsage[key] || 0) + tx.quantity;
  });

  return Object.entries(itemUsage)
    .map(([name, quantity]) => ({ name, quantity }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);
};
