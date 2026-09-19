import React, { useRef } from 'react';
import { cn } from './cn';

export interface TabItem<T extends string = string> {
  id: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  disabled?: boolean;
}

interface BaseProps<T extends string> {
  items: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
  'aria-label'?: string;
}

const move = <T extends string>(items: TabItem<T>[], current: T, delta: number): T | null => {
  const enabled = items.filter((item) => !item.disabled);
  if (enabled.length === 0) return null;
  const index = enabled.findIndex((item) => item.id === current);
  return enabled[(index + delta + enabled.length) % enabled.length].id;
};

/** Pill segmented control — for view switches and time ranges. */
export function Segmented<T extends string>({
  items,
  value,
  onChange,
  className,
  ...rest
}: BaseProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={rest['aria-label']}
      className={cn(
        'inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-gray-100/80 p-1 dark:border-gray-800 dark:bg-gray-900',
        className
      )}
    >
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            role="tab"
            type="button"
            aria-selected={active}
            disabled={item.disabled}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(item.id)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                const next = move(items, value, 1);
                if (next) onChange(next);
              } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                const next = move(items, value, -1);
                if (next) onChange(next);
              }
            }}
            className={cn(
              'inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors [&>svg]:h-3.5 [&>svg]:w-3.5',
              active
                ? 'bg-white text-gray-900 shadow-xs dark:bg-gray-800 dark:text-white'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
            )}
          >
            {item.icon}
            {item.label}
            {item.badge}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Underline tabs — for primary in-page navigation. On narrow screens the row
 * scrolls horizontally instead of wrapping into an unusable stack.
 */
export function TabList<T extends string>({
  items,
  value,
  onChange,
  className,
  ...rest
}: BaseProps<T>) {
  const listRef = useRef<HTMLDivElement>(null);

  return (
    <div
      role="tablist"
      aria-label={rest['aria-label']}
      ref={listRef}
      className={cn(
        'scrollbar-hide -mx-4 flex gap-1 overflow-x-auto border-b border-gray-200 px-4 sm:mx-0 sm:px-0 dark:border-gray-800',
        className
      )}
    >
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            role="tab"
            type="button"
            aria-selected={active}
            disabled={item.disabled}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(item.id)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowRight') {
                const next = move(items, value, 1);
                if (next) onChange(next);
              } else if (event.key === 'ArrowLeft') {
                const next = move(items, value, -1);
                if (next) onChange(next);
              }
            }}
            className={cn(
              'relative -mb-px inline-flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors [&>svg]:h-4 [&>svg]:w-4',
              active
                ? 'border-brand-600 text-gray-900 dark:border-brand-500 dark:text-white'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-800 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-200',
              item.disabled && 'cursor-not-allowed opacity-50'
            )}
          >
            {item.icon}
            <span>{item.label}</span>
            {item.badge}
          </button>
        );
      })}
    </div>
  );
}
