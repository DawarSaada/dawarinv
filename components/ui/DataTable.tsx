import React from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { cn } from './cn';
import { Checkbox } from './Checkbox';
import { Skeleton } from './Feedback';

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T, index: number) => React.ReactNode;
  align?: 'start' | 'center' | 'end';
  width?: string;
  sortable?: boolean;
  headerClassName?: string;
  cellClassName?: string;
  /** Hides the column below this breakpoint to keep narrow screens usable. */
  hideBelow?: 'sm' | 'md' | 'lg' | 'xl';
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  skeletonRows?: number;
  empty?: React.ReactNode;
  selection?: {
    selectedIds: Set<string>;
    onToggle: (id: string, next: boolean) => void;
    onToggleAll: (next: boolean) => void;
    isSelectable?: (row: T) => boolean;
  };
  sort?: { key: string; order: 'asc' | 'desc' } | null;
  onSortChange?: (key: string) => void;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string | undefined;
  density?: 'compact' | 'comfortable';
  /** Card renderer used below `sm`, where a table row is unusable. */
  mobileCard?: (row: T) => React.ReactNode;
  /** Tabular note under the table, e.g. totals. */
  summary?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  stickyHeader?: boolean;
  /** Label shown in the selection header for screen readers. */
  selectAllLabel?: string;
}

const HIDE_BELOW: Record<NonNullable<Column<unknown>['hideBelow']>, string> = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
  xl: 'hidden xl:table-cell',
};

const ALIGN: Record<NonNullable<Column<unknown>['align']>, string> = {
  start: 'text-start',
  center: 'text-center',
  end: 'text-end',
};

function SortIcon({ state }: { state: 'asc' | 'desc' | null }) {
  if (state === 'asc') return <ArrowUp className="h-3.5 w-3.5 text-brand-600" />;
  if (state === 'desc') return <ArrowDown className="h-3.5 w-3.5 text-brand-600" />;
  return <ChevronsUpDown className="h-3.5 w-3.5 text-gray-300 dark:text-gray-600" />;
}

/**
 * Dense data table tuned for inventory work: sticky header, tabular numbers,
 * keyboard-friendly sorting, bulk selection, skeleton and empty states, plus a
 * card fallback on phones.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading = false,
  skeletonRows = 6,
  empty,
  selection,
  sort,
  onSortChange,
  onRowClick,
  rowClassName,
  density = 'comfortable',
  mobileCard,
  summary,
  footer,
  className,
  stickyHeader = true,
  selectAllLabel = 'Select all rows',
}: DataTableProps<T>) {
  const selectableRows = selection
    ? rows.filter((row) => (selection.isSelectable ? selection.isSelectable(row) : true))
    : [];
  const selectedCount = selectableRows.filter((row) => selection?.selectedIds.has(rowKey(row))).length;
  const allSelected = selectableRows.length > 0 && selectedCount === selectableRows.length;
  const someSelected = selectedCount > 0 && !allSelected;

  const rowPadding = density === 'compact' ? 'px-3 py-1.5' : 'px-3 py-2.5 sm:px-4 sm:py-3';
  const colSpan = columns.length + (selection ? 1 : 0);

  const table = (
    <div className={cn('relative w-full overflow-x-auto', mobileCard && 'hidden sm:block', className)}>
      <table className="w-full min-w-full border-collapse text-sm">
        <thead className={cn(stickyHeader && 'sticky top-0 z-sticky')}>
          <tr className="bg-gray-50/95 backdrop-blur dark:bg-gray-900/95">
            {selection && (
              <th scope="col" className="w-10 border-b border-gray-200 px-3 py-2 dark:border-gray-800">
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  aria-label={selectAllLabel}
                  onChange={(event) => selection.onToggleAll(event.target.checked)}
                />
              </th>
            )}
            {columns.map((column) => {
              const activeSort = sort?.key === column.key ? sort.order : null;
              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={activeSort ? (activeSort === 'asc' ? 'ascending' : 'descending') : undefined}
                  className={cn(
                    'border-b border-gray-200 px-3 py-2 text-2xs font-semibold uppercase tracking-wider text-gray-500 dark:border-gray-800 dark:text-gray-400 sm:px-4',
                    ALIGN[column.align ?? 'start'],
                    column.hideBelow && HIDE_BELOW[column.hideBelow],
                    column.width,
                    column.headerClassName
                  )}
                >
                  {column.sortable && onSortChange ? (
                    <button
                      type="button"
                      onClick={() => onSortChange(column.key)}
                      className={cn(
                        'inline-flex items-center gap-1 rounded transition-colors hover:text-gray-900 dark:hover:text-gray-100',
                        ALIGN[column.align ?? 'start']
                      )}
                    >
                      {column.header}
                      <SortIcon state={activeSort} />
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {loading
            ? Array.from({ length: skeletonRows }).map((_, rowIndex) => (
                <tr key={`skeleton-${rowIndex}`}>
                  {selection && (
                    <td className={cn('border-b border-gray-100 dark:border-gray-800/70', rowPadding)}>
                      <Skeleton className="h-4 w-4" />
                    </td>
                  )}
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn(
                        'border-b border-gray-100 dark:border-gray-800/70',
                        rowPadding,
                        column.hideBelow && HIDE_BELOW[column.hideBelow]
                      )}
                    >
                      <Skeleton className="h-3.5 w-3/4" />
                    </td>
                  ))}
                </tr>
              ))
            : rows.map((row, index) => {
                const id = rowKey(row);
                const selected = selection?.selectedIds.has(id) ?? false;
                const selectable = selection?.isSelectable ? selection.isSelectable(row) : true;
                return (
                  <tr
                    key={id}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(
                      'transition-colors',
                      selected
                        ? 'bg-brand-50/70 dark:bg-brand-950/40'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800/60',
                      onRowClick && 'cursor-pointer',
                      rowClassName?.(row)
                    )}
                  >
                    {selection && (
                      <td
                        className={cn('border-b border-gray-100 dark:border-gray-800/70', rowPadding)}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <Checkbox
                          checked={selected}
                          disabled={!selectable}
                          aria-label={`Select row ${index + 1}`}
                          onChange={(event) => selection.onToggle(id, event.target.checked)}
                        />
                      </td>
                    )}
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={cn(
                          'border-b border-gray-100 text-gray-700 dark:border-gray-800/70 dark:text-gray-200',
                          rowPadding,
                          ALIGN[column.align ?? 'start'],
                          column.hideBelow && HIDE_BELOW[column.hideBelow],
                          column.cellClassName
                        )}
                      >
                        {column.cell(row, index)}
                      </td>
                    ))}
                  </tr>
                );
              })}

          {!loading && rows.length === 0 && (
            <tr>
              <td colSpan={colSpan} className="border-b border-gray-100 dark:border-gray-800/70">
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="w-full">
      {table}

      {mobileCard && (
        <div className={cn('space-y-2 sm:hidden', className)}>
          {loading
            ? Array.from({ length: Math.min(skeletonRows, 5) }).map((_, index) => (
                <div
                  key={`mobile-skeleton-${index}`}
                  className="rounded-xl border border-gray-200 bg-white p-3.5 dark:border-gray-800 dark:bg-gray-900"
                >
                  <Skeleton className="mb-2 h-4 w-1/2" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              ))
            : rows.length === 0
              ? empty
              : rows.map((row) => (
                  <div key={rowKey(row)} className={rowClassName?.(row)}>
                    {mobileCard(row)}
                  </div>
                ))}
        </div>
      )}

      {(summary || footer) && (
        <div className="flex flex-col gap-2 border-t border-gray-200 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4 dark:border-gray-800">
          <div className="text-xs text-gray-500 dark:text-gray-400">{summary}</div>
          <div>{footer}</div>
        </div>
      )}
    </div>
  );
}

export default DataTable;
