import fs from 'fs';

let content = fs.readFileSync('hooks/useMutations.ts', 'utf8');

const targetLoop = `      mutationFn: async ({ items }: { items: { id: string, counted_quantity: number, notes?: string }[] }) => {
        for (const item of items) {
          const { error } = await supabase
            .from('audit_items')
            .update({ 
              counted_quantity: item.counted_quantity,
              notes: item.notes
            })
            .eq('id', item.id);
          if (error) throw error;
        }
      },`;

const replacementLoop = `      mutationFn: async ({ items }: { items: { id: string, counted_quantity: number, notes?: string }[] }) => {
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
      },`;

if (content.includes('for (const item of items) {')) {
  // Use regex to replace the function body safely
  content = content.replace(
    /mutationFn: async \(\{ items \}: \{ items: \{ id: string, counted_quantity: number, notes\?: string \}\[\] \}\) => \{[\s\S]*?if \(error\) throw error;\n\s*\}\n\s*\}/,
    replacementLoop.trim().replace(/\}$/, '') // matching the inner part
  );
  // Actually, string replace is safer if exact match is found. Let's try exact match with normalized line endings.
  content = fs.readFileSync('hooks/useMutations.ts', 'utf8');
  let success = false;
  
  // A simpler regex that matches the whole function
  content = content.replace(
    /mutationFn: async \(\{ items \}[^{]*\{[^}]*for \(const item of items\) \{[^}]*update\(\{[^}]*\}[^}]*\.eq\('id', item\.id\);[^}]*if \(error\) throw error;\n\s*\}\n\s*\}/,
    replacementLoop.replace(/,\s*$/, '')
  );
  fs.writeFileSync('hooks/useMutations.ts', content, 'utf8');
} else {
  console.log("Could not find target loop");
}

console.log("Patched useMutations.ts");
