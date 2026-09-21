import fs from 'fs';

let content = fs.readFileSync('components/admin/AuditManagement.tsx', 'utf8');

const oldMapStart = `{filteredAudits.map(audit => (
          <div key={audit.id}`;

const newMapStart = `{filteredAudits.map(audit => {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const scheduled = audit.scheduledDate ? new Date(audit.scheduledDate) : new Date();
          scheduled.setHours(0, 0, 0, 0);
          const isFuture = scheduled > today;

          return (
          <div key={audit.id}`;

content = content.replace(oldMapStart, newMapStart);

const oldButton = `            <div className="bg-gray-50 dark:bg-gray-900/50 px-6 py-4 border-t border-gray-200 dark:border-gray-800 flex justify-end items-center gap-3">
              {(audit.status === 'scheduled' || audit.status === 'in_progress') && (
                <button 
                  onClick={() => onOpenPerformModal(audit)}
                  className="text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold transition-colors w-full justify-center"
                >
                  <Play className="w-4 h-4" />
                  {language === 'ar' ? 'بدء/متابعة الجرد' : 'Perform Audit'}
                </button>
              )}`;

// Wait, the Arabic characters might mismatch. I will use regex for the button replacement.
const buttonRegex = /\{\(audit\.status === 'scheduled' \|\| audit\.status === 'in_progress'\) && \([\s\S]*?<\/button>\s*\)\}/;

const newButton = `{(audit.status === 'scheduled' || audit.status === 'in_progress') && (
                <button 
                  onClick={() => onOpenPerformModal(audit)}
                  disabled={isFuture}
                  className={
                    isFuture
                      ? "text-gray-400 bg-gray-100 dark:bg-gray-800 px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold w-full justify-center cursor-not-allowed"
                      : "text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold transition-colors w-full justify-center"
                  }
                  title={isFuture ? (language === 'ar' ? 'لا يمكن إجراء الجرد قبل تاريخه المجدول' : 'Cannot perform audit before scheduled date') : undefined}
                >
                  <Play className="w-4 h-4" />
                  {language === 'ar' ? 'بدء/متابعة الجرد' : 'Perform Audit'}
                </button>
              )}`;

content = content.replace(buttonRegex, newButton);

const oldMapEnd = `          </div>
        ))}

        {filteredAudits.length === 0 && (`;
const newMapEnd = `          </div>
        )})}

        {filteredAudits.length === 0 && (`;

content = content.replace(oldMapEnd, newMapEnd);

fs.writeFileSync('components/admin/AuditManagement.tsx', content, 'utf8');
console.log("Patched successfully");
