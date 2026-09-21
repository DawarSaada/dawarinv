import fs from 'fs';

let content = fs.readFileSync('components/ui/DataTable.tsx', 'utf8');

// 1. Add pageSize to props
content = content.replace(
  "mobileCard?: (row: T) => React.ReactNode;",
  "mobileCard?: (row: T) => React.ReactNode;\n  pageSize?: number;"
);

// 2. Add useState to import
content = content.replace(
  "import React from 'react';",
  "import React, { useState, useEffect } from 'react';"
);

// 3. Add state and slicing inside the component
const componentStart = /export function DataTable<T>([^\{]*)\{/s;
// Let's check how the component is defined
const definitionMatch = content.match(/export function DataTable<T>\(([\s\S]*?)\) \{/);
if (definitionMatch) {
  let inner = definitionMatch[1];
  inner = inner.replace("mobileCard,", "mobileCard,\n  pageSize,");
  
  content = content.replace(definitionMatch[0], `export function DataTable<T>(${inner}) {\n  const [currentPage, setCurrentPage] = useState(1);\n\n  useEffect(() => {\n    setCurrentPage(1);\n  }, [rows]);\n\n  const paginatedRows = pageSize ? rows.slice((currentPage - 1) * pageSize, currentPage * pageSize) : rows;\n  const totalPages = pageSize ? Math.ceil(rows.length / pageSize) : 1;\n`);
}

// 4. Replace rows.map with paginatedRows.map
content = content.replace(/rows\.map/g, "paginatedRows.map");
content = content.replace(/rows\.length/g, "paginatedRows.length"); // wait, empty check uses rows.length. Let's fix that.
// Actually, empty check should use the original `rows.length`!
// Let's replace ONLY specific instances or fix after.

fs.writeFileSync('components/ui/DataTable.tsx', content, 'utf8');
console.log('Done 1');
