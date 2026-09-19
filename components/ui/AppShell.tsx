import React, { useEffect, useState } from 'react';
import { Menu as MenuIcon, X } from 'lucide-react';
import { cn } from './cn';

export interface NavItem<T extends string = string> {
  id: T;
  label: string;
  icon: React.ReactNode;
  /** Rendered instead of an icon in the mobile tab bar (e.g. a count). */
  badge?: React.ReactNode;
  disabled?: boolean;
  /** Kept out of the mobile bottom bar when `mobilePrimary` slots are full. */
  mobilePrimary?: boolean;
}

export interface AppShellProps<T extends string = string> {
  /** Brand block: mark plus product/location name. */
  brand: React.ReactNode;
  navItems: NavItem<T>[];
  activeId: T;
  onNavigate: (id: T) => void;
  /** Top bar content after the title area: search, status, notifications… */
  topbar?: React.ReactNode;
  /** User menu / theme controls pinned to the top bar end. */
  topbarEnd?: React.ReactNode;
  /** Footer of the desktop sidebar, e.g. logout. */
  sidebarFooter?: React.ReactNode;
  /** Content shown above the nav in the sidebar. */
  sidebarTop?: React.ReactNode;
  children: React.ReactNode;
  /** Copy used for the mobile navigation trigger. */
  navLabel?: string;
  closeLabel?: string;
  className?: string;
}

/**
 * The single layout every screen lives in.
 *
 * - `lg` and up: fixed sidebar, sticky top bar, content column.
 * - below `lg`: sticky top bar, a slide-over drawer for the full nav, and a
 *   bottom tab bar with the primary destinations within thumb reach.
 */
export function AppShell<T extends string>({
  brand,
  navItems,
  activeId,
  onNavigate,
  topbar,
  topbarEnd,
  sidebarFooter,
  sidebarTop,
  children,
  navLabel = 'Open navigation',
  closeLabel = 'Close navigation',
  className,
}: AppShellProps<T>) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close the drawer when the layout switches to the desktop sidebar.
  useEffect(() => {
    if (!drawerOpen) return;
    const onResize = () => {
      if (window.innerWidth >= 1024) setDrawerOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [drawerOpen]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [drawerOpen]);

  const navigate = (id: T) => {
    onNavigate(id);
    setDrawerOpen(false);
  };

  const mobileItems = navItems.filter((item) => item.mobilePrimary).slice(0, 4);

  const navList = (
    <nav className="flex flex-col gap-0.5 p-2" aria-label={navLabel}>
      {sidebarTop}
      {navItems.map((item) => {
        const active = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            disabled={item.disabled}
            aria-current={active ? 'page' : undefined}
            onClick={() => navigate(item.id)}
            className={cn(
              'group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-brand-50 text-brand-800 dark:bg-brand-950/70 dark:text-brand-300'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/70 dark:hover:text-gray-100',
              item.disabled && 'cursor-not-allowed opacity-50'
            )}
          >
            <span
              className={cn(
                'flex h-4.5 w-4.5 flex-shrink-0 items-center justify-center [&>svg]:h-4 [&>svg]:w-4',
                active ? 'text-brand-700 dark:text-brand-400' : 'text-gray-400 dark:text-gray-500'
              )}
              aria-hidden
            >
              {item.icon}
            </span>
            <span className="truncate">{item.label}</span>
            {item.badge && <span className="ms-auto">{item.badge}</span>}
            {active && (
              <span
                className="absolute inset-y-1.5 -start-px w-0.5 rounded-full bg-brand-600 dark:bg-brand-500"
                aria-hidden
              />
            )}
          </button>
        );
      })}
    </nav>
  );

  return (
    <div className={cn('min-h-screen bg-gray-50 dark:bg-gray-950', className)}>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 start-0 z-sticky hidden w-64 flex-col border-e border-gray-200 bg-white lg:flex dark:border-gray-800 dark:bg-gray-900">
        <div className="flex h-14 flex-shrink-0 items-center border-b border-gray-200 px-4 dark:border-gray-800">
          {brand}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{navList}</div>
        {sidebarFooter && (
          <div className="flex-shrink-0 border-t border-gray-200 p-2 dark:border-gray-800">
            {sidebarFooter}
          </div>
        )}
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-modal lg:hidden">
          <div
            className="absolute inset-0 animate-fade-in bg-gray-950/50"
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />
          <div className="relative flex h-full w-72 max-w-[85vw] animate-fade-in flex-col border-e border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
            <div className="flex h-14 flex-shrink-0 items-center justify-between border-b border-gray-200 px-3 dark:border-gray-800">
              {brand}
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label={closeLabel}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto pb-safe">{navList}</div>
            {sidebarFooter && (
              <div className="flex-shrink-0 border-t border-gray-200 p-2 pb-safe dark:border-gray-800">
                {sidebarFooter}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="lg:ps-64">
        {/* Top bar */}
        <header className="sticky top-0 z-sticky border-b border-gray-200 bg-white/90 backdrop-blur dark:border-gray-800 dark:bg-gray-950/85">
          <div className="flex h-14 items-center gap-2 px-3 sm:px-4">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label={navLabel}
              className="-ms-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 lg:hidden dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
            >
              <MenuIcon className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">{topbar}</div>
            <div className="flex flex-shrink-0 items-center gap-1">{topbarEnd}</div>
          </div>
        </header>

        <main className="min-h-[calc(100vh-3.5rem)] pb-20 lg:pb-0">{children}</main>
      </div>

      {/* Mobile bottom tab bar */}
      {mobileItems.length > 0 && (
        <nav
          className="fixed inset-x-0 bottom-0 z-sticky flex border-t border-gray-200 bg-white/95 backdrop-blur pb-safe lg:hidden dark:border-gray-800 dark:bg-gray-900/95"
          aria-label={navLabel}
        >
          {mobileItems.map((item) => {
            const active = item.id === activeId;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(item.id)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex flex-1 flex-col items-center gap-0.5 py-2 text-2xs font-medium transition-colors',
                  active ? 'text-brand-700 dark:text-brand-400' : 'text-gray-500 dark:text-gray-400'
                )}
              >
                <span className="relative [&>svg]:h-5 [&>svg]:w-5" aria-hidden>
                  {item.icon}
                  {item.badge}
                </span>
                <span className="max-w-full truncate px-1">{item.label}</span>
                {active && <span className="h-0.5 w-6 rounded-full bg-brand-600 dark:bg-brand-500" />}
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
}

/** Shared brand block for the sidebar and drawer. */
export const ShellBrand: React.FC<{ mark: React.ReactNode; title: React.ReactNode; subtitle?: React.ReactNode }> = ({
  mark,
  title,
  subtitle,
}) => (
  <div className="flex min-w-0 items-center gap-2.5">
    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-brand-700 text-white [&>svg]:h-4.5 [&>svg]:w-4.5">
      {mark}
    </span>
    <span className="min-w-0">
      <span className="block truncate text-sm font-semibold leading-tight text-gray-900 dark:text-white">
        {title}
      </span>
      {subtitle && (
        <span className="block truncate text-2xs leading-tight text-gray-500 dark:text-gray-400">
          {subtitle}
        </span>
      )}
    </span>
  </div>
);

export default AppShell;
