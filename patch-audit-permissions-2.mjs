import fs from 'fs';

let hookCode = fs.readFileSync('hooks/useInventoryData.ts', 'utf8');

// Replace handleSaveAuditCounts
hookCode = hookCode.replace(
  /handleSaveAuditCounts:\s*\(\s*auditId:\s*string,\s*items:\s*any\[\]\s*\)\s*=>\s*\{\s*if\s*\(!guardWrite\([^)]+\)\)\s*return;/g,
  "handleSaveAuditCounts: (auditId: string, items: any[]) => {\n        if (!guardWrite(getAuditTarget(auditId))) return;"
);
// Replace handleSubmitAudit
hookCode = hookCode.replace(
  /handleSubmitAudit:\s*\(\s*id:\s*string\s*\)\s*=>\s*\{\s*if\s*\(!guardWrite\([^)]+\)\)\s*return;/g,
  "handleSubmitAudit: (id: string) => {\n        if (!guardWrite(getAuditTarget(id))) return;"
);
// Replace handleApplyAudit
hookCode = hookCode.replace(
  /handleApplyAudit:\s*\(\s*auditId:\s*string,\s*performedBy:\s*string\s*\)\s*=>\s*\{\s*if\s*\(!guardWrite\([^)]+\)\)\s*return;/g,
  "handleApplyAudit: (auditId: string, performedBy: string) => {\n        if (!guardWrite(getAuditTarget(auditId))) return;"
);
// Replace handleDeleteAudit
hookCode = hookCode.replace(
  /handleDeleteAudit:\s*\(\s*auditId:\s*string\s*\)\s*=>\s*\{\s*\/\/\s*Deleting an audit destroys the record of a count, so it stays admin-only\.\s*if\s*\(!canWriteLocation\(subjectFrom\(currentUser\),\s*[^)]+\)\)\s*return;/g,
  "handleDeleteAudit: (auditId: string) => {\n        // Deleting an audit destroys the record of a count, so it stays admin-only.\n        if (!canWriteLocation(subjectFrom(currentUser), getAuditTarget(auditId))) return;"
);

fs.writeFileSync('hooks/useInventoryData.ts', hookCode, 'utf8');
console.log('Robust patch complete!');
