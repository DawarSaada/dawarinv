import fs from 'fs';

let content = fs.readFileSync('hooks/useMutations.ts', 'utf8');

const targetIndex = content.indexOf('saveAuditCountsMutation = useMutation({');
if (targetIndex !== -1) {
  const nextMutationIndex = content.indexOf('submitAuditMutation = useMutation({', targetIndex);
  
  const chunk1 = content.substring(0, targetIndex);
  const chunk2 = content.substring(nextMutationIndex);
  
  const newMiddle = `saveAuditCountsMutation = useMutation({
    mutationFn: async ({ items }: { items: { id: string, counted_quantity: number, notes?: string }[] }) => {
      const CHUNK_SIZE = 50;
      for (let i = 0; i < items.length; i += CHUNK_SIZE) {
        const chunk = items.slice(i, i + CHUNK_SIZE);
        await Promise.all(
          chunk.map(async (item) => {
            const { error } = await supabase
              .from('audit_items')
              .update({ 
                counted_quantity: item.counted_quantity,
                notes: item.notes
              })
              .eq('id', item.id);
            if (error) throw error;
          })
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audits'] });
      addToast('success', language === 'ar' ? 'تم حفظ العد' : 'Audit counts saved');
    },
    onError: (error: any) => {
      addToast('error', error.message);
    }
  });

  const `;
  
  fs.writeFileSync('hooks/useMutations.ts', chunk1 + newMiddle + chunk2, 'utf8');
  console.log("Patched successfully via index slicing");
} else {
  console.log("Could not find saveAuditCountsMutation");
}
