import React, { useEffect, useId, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { cn } from './cn';

export interface MenuItem {
  /** Unique key. `null` renders a separator. */
  id: string;
  label?: React.ReactNode;
  icon?: React.ReactNode;
  /** Right-aligned hint, e.g. a shortcut or count. */
  hint?: React.ReactNode;
  onSelect?: () => void;
  danger?: boolean;
  disabled?: boolean;
  /** Renders a leading check mark for single-select menus. */
  selected?: boolean;
  /** Non-interactive section label. */
  heading?: boolean;
  href?: string;
}

export interface MenuProps {
  items: MenuItem[];
  /** Trigger element. Receives open state through the render prop. */
  trigger: (props: { open: boolean; toggle: () => void; ref: React.Ref<HTMLButtonElement> }) => React.ReactNode;
  align?: 'start' | 'end';
  width?: string;
  className?: string;
  onOpenChange?: (open: boolean) => void;
}

/** Accessible dropdown used for every kebab/filter/sort menu in the app. */
export const Menu: React.FC<MenuProps> = ({
  items,
  trigger,
  align = 'end',
  width = 'w-56',
  className,
  onOpenChange,
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  const setOpenSafe = (next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
  };

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpenSafe(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenSafe(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  // Move focus to the first actionable item when the menu opens.
  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => {
      listRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])')?.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, [open]);

  const onListKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const nodes = Array.from(
      listRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? []
    );
    if (nodes.length === 0) return;
    const index = nodes.indexOf(document.activeElement as HTMLElement);

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      nodes[(index + 1) % nodes.length].focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      nodes[(index - 1 + nodes.length) % nodes.length].focus();
    } else if (event.key === 'Home') {
      event.preventDefault();
      nodes[0].focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      nodes[nodes.length - 1].focus();
    }
  };

  return (
    <div className={cn('relative', className)} ref={rootRef}>
      {trigger({ open, toggle: () => setOpenSafe(!open), ref: buttonRef })}

      {open && (
        <div
          ref={listRef}
          id={menuId}
          role="menu"
          aria-orientation="vertical"
          onKeyDown={onListKeyDown}
          className={cn(
            'absolute top-full z-dropdown mt-1.5 origin-top animate-pop-in overflow-hidden rounded-xl border border-gray-200 bg-white p-1 shadow-pop',
            'dark:border-gray-700 dark:bg-gray-800',
            align === 'end' ? 'end-0' : 'start-0',
            width
          )}
        >
          {items.map((item, index) =>
            item.heading ? (
              <p
                key={item.id}
                className="px-2.5 pb-1 pt-2 text-2xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500"
              >
                {item.label}
              </p>
            ) : item.id === '__separator__' ? (
              <div key={`sep-${index}`} className="my-1 h-px bg-gray-200 dark:bg-gray-700" />
            ) : item.href ? (
              <a
                key={item.id}
                role="menuitem"
                href={item.href}
                onClick={() => setOpenSafe(false)}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                {item.icon && <span className="shrink-0 text-gray-400 [&>svg]:h-4 [&>svg]:w-4">{item.icon}</span>}
                <span className="flex-1 truncate">{item.label}</span>
              </a>
            ) : (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                aria-disabled={item.disabled || undefined}
                onClick={() => {
                  if (item.disabled) return;
                  item.onSelect?.();
                  setOpenSafe(false);
                }}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-sm transition-colors',
                  item.disabled
                    ? 'cursor-not-allowed text-gray-400 dark:text-gray-500'
                    : item.danger
                      ? 'text-danger-600 hover:bg-danger-50 dark:text-danger-500 dark:hover:bg-danger-900/25'
                      : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700',
                  item.selected && !item.danger && 'font-medium'
                )}
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center text-gray-400 [&>svg]:h-4 [&>svg]:w-4">
                  {item.selected ? <Check className="text-brand-600" /> : item.icon}
                </span>
                <span className="flex-1 truncate">{item.label}</span>
                {item.hint && (
                  <span className="shrink-0 text-2xs text-gray-400 dark:text-gray-500">{item.hint}</span>
                )}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
};

export default Menu;
