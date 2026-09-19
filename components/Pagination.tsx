import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { cn } from './ui/cn';

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  language: 'en' | 'ar';
  className?: string;
}

const PAGE_SIZES = [10, 25, 50, 100];

const iconButton =
  'flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-colors ' +
  'hover:bg-gray-50 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-40 ' +
  'dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100';

/**
 * Compact pager shared by every list screen.
 *
 * Uses first/prev/next/last icon buttons plus a windowed page list so it stays
 * usable with hundreds of pages, and lets the caller own the container border.
 */
export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  language,
  className
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const isRTL = language === 'ar';

  if (totalItems === 0) return null;

  const page = Math.min(Math.max(currentPage, 1), totalPages);

  const getPageNumbers = (): (number | '...')[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);

    const pages: (number | '...')[] = [1];
    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);

    if (start > 2) pages.push('...');
    for (let index = start; index <= end; index += 1) pages.push(index);
    if (end < totalPages - 1) pages.push('...');

    pages.push(totalPages);
    return pages;
  };

  const rangeStart = (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, totalItems);

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 sm:flex-row sm:justify-between',
        className
      )}
    >
      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        <span className="tnum">
          {isRTL ? `${rangeStart}–${rangeEnd} من ${totalItems}` : `${rangeStart}–${rangeEnd} of ${totalItems}`}
        </span>
        <span className="text-gray-300 dark:text-gray-600">·</span>
        <label className="flex items-center gap-1.5">
          <span className="sr-only">{isRTL ? 'عدد الصفوف' : 'Rows per page'}</span>
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="h-7 rounded-md border border-gray-200 bg-white px-1.5 text-xs text-gray-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
            aria-label={isRTL ? 'عدد الصفوف في الصفحة' : 'Rows per page'}
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </div>

      <nav
        className="flex items-center gap-1"
        aria-label={isRTL ? 'ترقيم الصفحات' : 'Pagination'}
      >
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={page === 1}
          className={iconButton}
          aria-label={isRTL ? 'الصفحة الأولى' : 'First page'}
        >
          {isRTL ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className={iconButton}
          aria-label={isRTL ? 'الصفحة السابقة' : 'Previous page'}
        >
          {isRTL ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>

        {getPageNumbers().map((entry, index) =>
          entry === '...' ? (
            <span key={`gap-${index}`} className="px-1 text-xs text-gray-400" aria-hidden>
              …
            </span>
          ) : (
            <button
              key={entry}
              type="button"
              onClick={() => onPageChange(entry)}
              aria-current={entry === page ? 'page' : undefined}
              className={cn(
                'tnum h-8 min-w-8 rounded-lg px-2 text-xs font-medium transition-colors',
                entry === page
                  ? 'bg-brand-700 text-white'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
              )}
            >
              {entry}
            </button>
          )
        )}

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className={iconButton}
          aria-label={isRTL ? 'الصفحة التالية' : 'Next page'}
        >
          {isRTL ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={() => onPageChange(totalPages)}
          disabled={page === totalPages}
          className={iconButton}
          aria-label={isRTL ? 'الصفحة الأخيرة' : 'Last page'}
        >
          {isRTL ? <ChevronsLeft className="h-4 w-4" /> : <ChevronsRight className="h-4 w-4" />}
        </button>
      </nav>
    </div>
  );
};

export default Pagination;
