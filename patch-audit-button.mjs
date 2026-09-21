import fs from 'fs';

let content = fs.readFileSync('components/admin/AuditManagement.tsx', 'utf8');

// 1. Change filteredAudits.map(audit => (
// to filteredAudits.map(audit => { ... return (
const oldMapStart = "{filteredAudits.map(audit => (";
const newMapStart = `{filteredAudits.map(audit => {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const scheduled = audit.scheduledDate ? new Date(audit.scheduledDate) : new Date();
          scheduled.setHours(0, 0, 0, 0);
          const isFuture = scheduled > today;
          
          return (`;

if (content.includes(oldMapStart)) {
  content = content.replace(oldMapStart, newMapStart);
  
  // Need to close the map function correctly at the end.
  // The end is likely `))}  ` or `))} ` before `</div>`
  // Let's replace the last `))} ` or similar, or just regex it.
  content = content.replace(/\)\)}/g, "})}");
} else {
  console.log("Could not find map start.");
}

// 2. Patch the button
const oldButton = `              {(audit.status === 'scheduled' || audit.status === 'in_progress') && (
                <button 
                  onClick={() => onOpenPerformModal(audit)}
                  className="text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold transition-colors w-full justify-center"
                >
                  <Play className="w-4 h-4" />
                  {language === 'ar' ? 'بدء/متابعة الجرد' : 'Perform Audit'}
                </button>
              )}`;

// Wait, the Arabic string might be garbled in my terminal earlier. Let's use wildcard/regex to find the button block.
