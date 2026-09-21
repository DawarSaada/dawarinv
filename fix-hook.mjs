import fs from 'fs';

let content = fs.readFileSync('hooks/useInventoryData.ts', 'utf8');

const badBlock = `  const queryClient = useQueryClient();
  const getAuditTarget = useCallback((auditId: string) => {
    const audits = queryClient.getQueryData(['audits']) as any[];
    return audits?.find(a => a.id === auditId)?.locationId || selectedLocation || '';
  }, [queryClient, selectedLocation]);

`;

if (content.startsWith(badBlock)) {
  content = content.replace(badBlock, '');
} else {
  // Try CRLF
  const badBlockCRLF = badBlock.replace(/\n/g, '\r\n');
  if (content.startsWith(badBlockCRLF)) {
    content = content.replace(badBlockCRLF, '');
  } else {
     // Just remove first 6 lines
     content = content.split('\n').slice(6).join('\n');
  }
}

const target = "export const useInventoryData = ({ currentUser, selectedLocation, language, alerts, addToast }: UseInventoryDataProps) => {";
const replacement = target + `
  const queryClient = useQueryClient();
  const getAuditTarget = useCallback((auditId: string) => {
    const audits = queryClient.getQueryData(['audits']) as any[];
    return audits?.find(a => a.id === auditId)?.locationId || selectedLocation || '';
  }, [queryClient, selectedLocation]);
`;

content = content.replace(target, replacement);

fs.writeFileSync('hooks/useInventoryData.ts', content, 'utf8');
console.log('Fixed hooks/useInventoryData.ts');
