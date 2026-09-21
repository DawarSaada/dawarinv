import fs from 'fs';

// 1. Patch hooks/useInventoryData.ts
let hookCode = fs.readFileSync('hooks/useInventoryData.ts', 'utf8');

// Add import
hookCode = hookCode.replace(
  "import { useInventoryQuery, useTransactionsQuery, usePurchaseOrdersQuery } from './useQueries';",
  "import { useInventoryQuery, useTransactionsQuery, usePurchaseOrdersQuery } from './useQueries';\nimport { useQueryClient } from '@tanstack/react-query';"
);

// Add queryClient and getAuditTarget
const hookBodyStart = hookCode.indexOf('  /**\n   * Every write goes through this.');
hookCode = hookCode.substring(0, hookBodyStart) +
  "  const queryClient = useQueryClient();\n" +
  "  const getAuditTarget = useCallback((auditId: string) => {\n" +
  "    const audits = queryClient.getQueryData(['audits']) as any[];\n" +
  "    return audits?.find(a => a.id === auditId)?.locationId || selectedLocation || '';\n" +
  "  }, [queryClient, selectedLocation]);\n\n" +
  hookCode.substring(hookBodyStart);

// Fix handleSaveAuditCounts
hookCode = hookCode.replace(
  'handleSaveAuditCounts: (items: any[]) => {',
  'handleSaveAuditCounts: (auditId: string, items: any[]) => {'
);
hookCode = hookCode.replace(
  "handleSaveAuditCounts: (auditId: string, items: any[]) => {\n        if (!guardWrite(selectedLocation || '')) return;",
  "handleSaveAuditCounts: (auditId: string, items: any[]) => {\n        if (!guardWrite(getAuditTarget(auditId))) return;"
);

// Fix handleSubmitAudit
hookCode = hookCode.replace(
  "handleSubmitAudit: (id: string) => {\n        if (!guardWrite(selectedLocation || '')) return;",
  "handleSubmitAudit: (id: string) => {\n        if (!guardWrite(getAuditTarget(id))) return;"
);

// Fix handleApplyAudit
hookCode = hookCode.replace(
  "handleApplyAudit: (auditId: string, performedBy: string) => {\n        if (!guardWrite(selectedLocation || '')) return;",
  "handleApplyAudit: (auditId: string, performedBy: string) => {\n        if (!guardWrite(getAuditTarget(auditId))) return;"
);

// Fix handleDeleteAudit
hookCode = hookCode.replace(
  "handleDeleteAudit: (auditId: string) => {\n        // Deleting an audit destroys the record of a count, so it stays admin-only.\n        if (!canWriteLocation(subjectFrom(currentUser), selectedLocation || '')) return;",
  "handleDeleteAudit: (auditId: string) => {\n        // Deleting an audit destroys the record of a count, so it stays admin-only.\n        if (!canWriteLocation(subjectFrom(currentUser), getAuditTarget(auditId))) return;"
);

fs.writeFileSync('hooks/useInventoryData.ts', hookCode, 'utf8');

// 2. Patch AdminDashboard.tsx
let adminCode = fs.readFileSync('components/AdminDashboard.tsx', 'utf8');
adminCode = adminCode.replace(
  'onSaveAuditCounts: (items: any[]) => void;',
  'onSaveAuditCounts: (auditId: string, items: any[]) => void;'
);
adminCode = adminCode.replace(
  'onSaveCounts={onSaveAuditCounts}',
  'onSaveCounts={(items) => onSaveAuditCounts(selectedAudit!.id, items)}'
);
fs.writeFileSync('components/AdminDashboard.tsx', adminCode, 'utf8');

// 3. Patch InventoryDashboard.tsx
let invCode = fs.readFileSync('components/InventoryDashboard.tsx', 'utf8');
invCode = invCode.replace(
  'onSaveAuditCounts?: (items: any[]) => void;',
  'onSaveAuditCounts?: (auditId: string, items: any[]) => void;'
);
invCode = invCode.replace(
  'onSaveCounts={(items) => onSaveAuditCounts?.(items)}',
  'onSaveCounts={(items) => onSaveAuditCounts?.(selectedAudit!.id, items)}'
);
fs.writeFileSync('components/InventoryDashboard.tsx', invCode, 'utf8');

console.log('Patched all audit permission references!');
