import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CornerDownLeft, Search } from 'lucide-react';
import { cn } from './cn';

export interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  /** Extra search terms: synonyms, barcodes, usernames… */
  keywords?: string[];
  shortcut?: string;
  group?: string;
  onSelect: () => void;
}

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  items: CommandItem[];
  placeholder?: string;
  emptyLabel?: string;
  recentLabel?: string;
  /** localStorage key used to remember recently used commands. */
  recentKey?: string;
}

const score = (item: CommandItem, query: string): number => {
  const target = item.label.toLowerCase();
  if (target === query) return 100;
  if (target.startsWith(query)) return 80;
  if (target.includes(query)) return 60;
  const haystack = [item.description ?? '', ...(item.keywords ?? [])].join(' ').toLowerCase();
  if (haystack.includes(query)) return 30;
  return -1;
};

/**
 * ⌘K/Ctrl+K palette: the fastest path to any item, location or action without
 * hunting through tabs. Falls back to recents when the query is empty.
 */
export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  onClose,
  items,
  placeholder = 'Search or jump to…',
  emptyLabel = 'No matches',
  recentLabel = 'Recent',
  recentKey = 'dawar-recent-commands',
}) => {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIndex(0);
    try {
      const raw = localStorage.getItem(recentKey);
      setRecentIds(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      setRecentIds([]);
    }
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [open, recentKey]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  const results = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      const recents = recentIds
        .map((id) => items.find((item) => item.id === id))
        .filter((item): item is CommandItem => Boolean(item))
        .map((item) => ({ ...item, group: recentLabel }));
      const rest = items.filter((item) => !recentIds.includes(item.id)).slice(0, 8);
      return [...recents, ...rest];
    }
    return items
      .map((item) => ({ item, value: score(item, trimmed) }))
      .filter((entry) => entry.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 24)
      .map((entry) => entry.item);
  }, [items, query, recentIds, recentLabel]);

  useEffect(() => {
    setActiveIndex((index) => Math.min(index, Math.max(results.length - 1, 0)));
  }, [results.length]);

  const run = (item: CommandItem) => {
    try {
      const next = [item.id, ...recentIds.filter((id) => id !== item.id)].slice(0, 5);
      localStorage.setItem(recentKey, JSON.stringify(next));
    } catch {
      /* recents are best-effort */
    }
    onClose();
    item.onSelect();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % Math.max(results.length, 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + results.length) % Math.max(results.length, 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const item = results[activeIndex];
      if (item) run(item);
    }
  };

  if (!open) return null;

  let lastGroup: string | undefined;

  return createPortal(
    <div className="fixed inset-0 z-palette flex items-start justify-center px-4 pb-4 pt-[max(env(safe-area-inset-top,1rem),1rem)] pt-[12vh]">
      <div className="absolute inset-0 animate-fade-in bg-gray-950/50 backdrop-blur-[2px]" onClick={onClose} aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={placeholder}
        onKeyDown={onKeyDown}
        className="relative w-full max-w-xl animate-pop-in overflow-hidden rounded-xl border border-gray-200 bg-white shadow-pop dark:border-gray-700 dark:bg-gray-900"
      >
        <div className="flex items-center gap-2.5 border-b border-gray-200 px-3.5 dark:border-gray-800">
          <Search className="h-4 w-4 flex-shrink-0 text-gray-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={placeholder}
            aria-label={placeholder}
            className="h-12 flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-white"
          />
          <kbd className="hidden rounded border border-gray-200 px-1.5 py-0.5 text-2xs text-gray-400 sm:block dark:border-gray-700">
            ESC
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-1.5" role="listbox">
          {results.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-gray-500 dark:text-gray-400">{emptyLabel}</p>
          )}

          {results.map((item, index) => {
            const showGroup = item.group && item.group !== lastGroup;
            lastGroup = item.group;
            const active = index === activeIndex;
            return (
              <React.Fragment key={item.id}>
                {showGroup && (
                  <p className="px-2.5 pb-1 pt-2 text-2xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                    {item.group}
                  </p>
                )}
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => run(item)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-start transition-colors',
                    active ? 'bg-brand-50 dark:bg-brand-950/60' : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                  )}
                >
                  {item.icon && (
                    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 [&>svg]:h-3.5 [&>svg]:w-3.5">
                      {item.icon}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-gray-900 dark:text-white">{item.label}</span>
                    {item.description && (
                      <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                        {item.description}
                      </span>
                    )}
                  </span>
                  {item.shortcut ? (
                    <kbd className="flex-shrink-0 rounded border border-gray-200 px-1.5 py-0.5 text-2xs text-gray-400 dark:border-gray-700">
                      {item.shortcut}
                    </kbd>
                  ) : (
                    active && <CornerDownLeft className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                  )}
                </button>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default CommandPalette;
