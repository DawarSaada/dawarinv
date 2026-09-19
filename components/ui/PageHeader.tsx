import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { cn } from './cn';

export interface PageHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  /** Back affordance; the arrow flips automatically in RTL. */
  onBack?: () => void;
  backLabel?: string;
  actions?: React.ReactNode;
  /** Badges or status text shown under the title. */
  meta?: React.ReactNode;
  /** Extra row rendered under the title block (typically tabs). */
  children?: React.ReactNode;
  sticky?: boolean;
  className?: string;
}

/**
 * Single header treatment for every screen so titles, spacing and action
 * placement never drift between sections.
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  icon,
  onBack,
  backLabel = 'Back',
  actions,
  meta,
  children,
  sticky = true,
  className,
}) => (
  <header
    className={cn(
      'border-b border-gray-200 bg-white/90 backdrop-blur dark:border-gray-800 dark:bg-gray-950/85',
      sticky && 'sticky top-0 z-sticky',
      className
    )}
  >
    <div className="mx-auto flex w-full max-w-[1600px] items-start gap-3 px-4 py-3 sm:px-6 sm:py-4">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label={backLabel}
          className="-ms-1 mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
        >
          <ArrowLeft className="h-4.5 w-4.5 rtl:rotate-180" />
        </button>
      )}

      {icon && (
        <span className="mt-1 hidden h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-400 [&>svg]:h-4.5 [&>svg]:w-4.5 sm:flex">
          {icon}
        </span>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h1 className="truncate text-lg font-semibold tracking-tight text-gray-900 sm:text-xl dark:text-white">
            {title}
          </h1>
          {meta}
        </div>
        {subtitle && (
          <p className="mt-0.5 truncate text-xs text-gray-500 sm:text-sm dark:text-gray-400">
            {subtitle}
          </p>
        )}
      </div>

      {actions && <div className="flex flex-shrink-0 items-center gap-2">{actions}</div>}
    </div>

    {children && <div className="mx-auto w-full max-w-[1600px] px-4 sm:px-6">{children}</div>}
  </header>
);

/** Consistent content container: one max width and gutter scale everywhere. */
export const PageBody: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  children,
  ...rest
}) => (
  <div className={cn('mx-auto w-full max-w-[1600px] px-4 py-4 sm:px-6 sm:py-5', className)} {...rest}>
    {children}
  </div>
);

export default PageHeader;
