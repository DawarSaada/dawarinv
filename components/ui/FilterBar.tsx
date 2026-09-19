import React, { useState } from 'react';
import { MoreHorizontal, Search, SlidersHorizontal, X } from 'lucide-react';
import { cn } from './cn';
import { Badge, type BadgeTone } from './Badge';
import { Input } from './Field';
import { Menu, type MenuItem } from './Menu';
import { Modal } from './Modal';
import { Button } from './Button';

export interface ActiveFilterChip {
  id: string;
  label: React.ReactNode;
  tone?: BadgeTone;
  onRemove: () => void;
}

export interface FilterBarProps {
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    /** Extra control pinned inside the search field, e.g. a scan button. */
    trailingSlot?: React.ReactNode;
  };
  /** Removable chips describing what is currently filtered. */
  chips?: ActiveFilterChip[];
  /** Controls rendered inside the filter sheet / inline on desktop. */
  filters?: React.ReactNode;
  /** Number of non-default filters applied (drives the Filters button badge). */
  filterCount?: number;
  /** Primary call to action, always visible. */
  primaryAction?: React.ReactNode;
  /** Secondary actions placed in an overflow menu on small screens. */
  overflowActions?: MenuItem[];
  /** Rendered inline on desktop and inside the sheet on mobile (e.g. sort/view). */
  inlineControls?: React.ReactNode;
  onClearFilters?: () => void;
  filtersLabel: string;
  clearLabel: string;
  doneLabel?: string;
  moreLabel: string;
  className?: string;
}

/**
 * One filter bar pattern for every list screen: search stays visible, filters
 * live behind a sheet so the table keeps the vertical space, and active filters
 * are always visible as removable chips.
 */
export const FilterBar: React.FC<FilterBarProps> = ({
  search,
  chips = [],
  filters,
  filterCount = 0,
  primaryAction,
  overflowActions = [],
  inlineControls,
  onClearFilters,
  filtersLabel,
  clearLabel,
  doneLabel,
  moreLabel,
  className,
}) => {
  const [filtersOpen, setFiltersOpen] = useState(false);

  return (
    <div className={cn('space-y-2.5', className)}>
      <div className="flex flex-wrap items-center gap-2">
        {search && (
          <Input
            value={search.value}
            onChange={(event) => search.onChange(event.target.value)}
            placeholder={search.placeholder}
            leadingIcon={<Search />}
            trailingSlot={search.trailingSlot}
            aria-label={search.placeholder}
            className="min-w-[180px] flex-1 sm:max-w-md"
          />
        )}

        {inlineControls && <div className="hidden items-center gap-2 lg:flex">{inlineControls}</div>}

        {filters && (
          <Button
            variant="secondary"
            icon={<SlidersHorizontal />}
            onClick={() => setFiltersOpen(true)}
            className="relative"
          >
            <span className="hidden sm:inline">{filtersLabel}</span>
            {filterCount > 0 && (
              <span className="ms-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-700 px-1 text-2xs font-semibold text-white">
                {filterCount}
              </span>
            )}
          </Button>
        )}

        <div className="ms-auto flex items-center gap-2">
          {primaryAction}
          {overflowActions.length > 0 && (
            <Menu
              items={overflowActions}
              width="w-60"
              trigger={({ toggle, ref, open }) => (
                <Button
                  ref={ref}
                  variant="secondary"
                  onClick={toggle}
                  aria-haspopup="menu"
                  aria-expanded={open}
                  aria-label={moreLabel}
                  icon={<MoreHorizontal />}
                />
              )}
            />
          )}
        </div>
      </div>

      {(chips.length > 0 || (filterCount > 0 && onClearFilters)) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={chip.onRemove}
              className="group inline-flex items-center"
              aria-label={`Remove filter ${typeof chip.label === 'string' ? chip.label : ''}`}
            >
              <Badge tone={chip.tone ?? 'neutral'} className="gap-1 pe-1">
                {chip.label}
                <X className="h-3 w-3 opacity-60 transition-opacity group-hover:opacity-100" />
              </Badge>
            </button>
          ))}
          {filterCount > 0 && onClearFilters && (
            <button
              type="button"
              onClick={onClearFilters}
              className="ms-0.5 text-xs font-medium text-gray-500 underline decoration-dotted underline-offset-2 transition-colors hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100"
            >
              {clearLabel}
            </button>
          )}
        </div>
      )}

      {filters && (
        <Modal
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          title={filtersLabel}
          size="sm"
          footer={
            <Button variant="primary" onClick={() => setFiltersOpen(false)}>
              {doneLabel ?? clearLabel}
            </Button>
          }
        >
          <div className="space-y-4">
            {inlineControls && <div className="lg:hidden">{inlineControls}</div>}
            {filters}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default FilterBar;
