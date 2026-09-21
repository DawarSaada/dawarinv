import fs from 'fs';

// 1. Patch hooks/useInventoryData.ts
let hookCode = fs.readFileSync('hooks/useInventoryData.ts', 'utf8');
hookCode = hookCode.replace(
  "saveAuditCountsMutation.mutate({ items });",
  "return saveAuditCountsMutation.mutateAsync({ items });"
);
fs.writeFileSync('hooks/useInventoryData.ts', hookCode, 'utf8');

// 2. Patch AdminDashboard.tsx
let adminCode = fs.readFileSync('components/AdminDashboard.tsx', 'utf8');
adminCode = adminCode.replace(
  'onSaveAuditCounts: (auditId: string, items: any[]) => void;',
  'onSaveAuditCounts: (auditId: string, items: any[]) => Promise<void> | void;'
);
fs.writeFileSync('components/AdminDashboard.tsx', adminCode, 'utf8');

// 3. Patch InventoryDashboard.tsx
let invCode = fs.readFileSync('components/InventoryDashboard.tsx', 'utf8');
invCode = invCode.replace(
  'onSaveAuditCounts?: (auditId: string, items: any[]) => void;',
  'onSaveAuditCounts?: (auditId: string, items: any[]) => Promise<void> | void;'
);
fs.writeFileSync('components/InventoryDashboard.tsx', invCode, 'utf8');

// 4. Patch PerformAuditModal.tsx
let modalCode = fs.readFileSync('components/admin/PerformAuditModal.tsx', 'utf8');
modalCode = modalCode.replace(
  'onSaveCounts: (items: any[]) => void;',
  'onSaveCounts: (items: any[]) => Promise<void> | void;'
);
modalCode = modalCode.replace(
  'const handleSave = () => {',
  'const handleSave = async () => {'
);
modalCode = modalCode.replace(
  'onSaveCounts(itemsToSave);',
  'await onSaveCounts(itemsToSave);'
);
modalCode = modalCode.replace(
  'const handleSubmit = () => {',
  'const handleSubmit = async () => {'
);
modalCode = modalCode.replace(
  'handleSave(); // Save final state just in case',
  'await handleSave(); // Save final state just in case'
);
fs.writeFileSync('components/admin/PerformAuditModal.tsx', modalCode, 'utf8');

console.log("Patched all files for async save");
