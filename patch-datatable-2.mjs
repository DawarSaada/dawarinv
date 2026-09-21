import fs from 'fs';

let content = fs.readFileSync('components/ui/DataTable.tsx', 'utf8');

if (!content.includes('pageSize')) {
  // Add useState import
  content = content.replace(
    "import React from 'react';",
    "import React, { useState, useEffect } from 'react';"
  );
  
  // Add pageSize prop interface
  content = content.replace(
    "mobileCard?: (row: T) => React.ReactNode;",
    "mobileCard?: (row: T) => React.ReactNode;\n  pageSize?: number;"
  );
  
  // Add pageSize to destructured props
  content = content.replace(
    "  mobileCard,\n",
    "  mobileCard,\n  pageSize = 50,\n"
  );
  
  // Insert state and derived rows
  const hookInject = `
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [rows]);

  const totalPages = Math.ceil(rows.length / pageSize);
  const paginatedRows = pageSize ? rows.slice((currentPage - 1) * pageSize, currentPage * pageSize) : rows;
  const currentRowsLength = paginatedRows.length;
`;
  content = content.replace(
    "  const selectableRows = selection",
    hookInject + "\n  const selectableRows = selection"
  );
  
  // Replace rows.map with paginatedRows.map
  content = content.replace(/rows\.map/g, "paginatedRows.map");
  
  // Pagination controls string
  const paginationControls = `
      {pageSize && totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-800 px-4 py-3 bg-white dark:bg-gray-900 sm:px-6">
          <div className="flex flex-1 justify-between sm:hidden">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="relative inline-flex items-center rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700 dark:text-gray-400">
                Showing <span className="font-medium">{((currentPage - 1) * pageSize) + 1}</span> to <span className="font-medium">{Math.min(currentPage * pageSize, rows.length)}</span> of{' '}
                <span className="font-medium">{rows.length}</span> results
              </p>
            </div>
            <div>
              <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 dark:ring-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                >
                  <span className="sr-only">Previous</span>
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                  </svg>
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 dark:ring-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                >
                  <span className="sr-only">Next</span>
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                  </svg>
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}
`;

  content = content.replace(
    /\{\(summary \|\| footer\) && \(/,
    paginationControls + "\n      {(summary || footer) && ("
  );
  
  // also fix `rows.length === 0` in the mobileCard map to make sure it doesn't break
  // wait, the empty check in mobile uses `rows.length === 0 ? empty : paginatedRows.map`
  // the empty check in table uses `rows.length === 0 ? ... : paginatedRows.map`
  // so keeping rows.length there is totally fine.

  fs.writeFileSync('components/ui/DataTable.tsx', content, 'utf8');
  console.log("Patched DataTable.tsx successfully.");
} else {
  console.log("Already patched.");
}
