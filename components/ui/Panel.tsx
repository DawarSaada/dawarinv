import React from 'react';
import { cn } from './cn';

export type PanelTone = 'default' | 'inset' | 'plain';

const TONES: Record<PanelTone, string> = {
  default: 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800',
  inset: 'bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800',
  plain: '',
};

export interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: PanelTone;
  /** Adds the popover shadow for panels that float above the page. */
  elevated?: boolean;
  as?: 'div' | 'section' | 'article' | 'aside';
}

/**
 * The workhorse surface: a crisp bordered panel rather than a floating card, so
 * dense screens stay calm. Elevation is opt-in for things that genuinely overlay.
 */
export const Panel: React.FC<PanelProps> = ({
  tone = 'default',
  elevated = false,
  as: Tag = 'div',
  className,
  children,
  ...rest
}) => (
  <Tag
    className={cn('rounded-xl', TONES[tone], elevated && 'shadow-pop', className)}
    {...rest}
  >
    {children}
  </Tag>
);

export interface PanelHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  /** Denser padding for panels inside panels. */
  compact?: boolean;
}

export const PanelHeader: React.FC<PanelHeaderProps> = ({
  title,
  subtitle,
  icon,
  actions,
  compact = false,
  className,
  children,
  ...rest
}) => (
  <div
    className={cn(
      'flex items-start justify-between gap-3 border-b border-gray-200 dark:border-gray-800',
      compact ? 'px-3.5 py-2.5' : 'px-4 py-3.5 sm:px-5',
      className
    )}
    {...rest}
  >
    <div className="flex min-w-0 items-start gap-3">
      {icon && (
        <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 [&>svg]:h-4 [&>svg]:w-4">
          {icon}
        </span>
      )}
      <div className="min-w-0">
        <h3 className="truncate text-base font-semibold text-gray-900 dark:text-white">{title}</h3>
        {subtitle && (
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>
        )}
      </div>
    </div>
    {actions && <div className="flex flex-shrink-0 items-center gap-2">{actions}</div>}
    {children}
  </div>
);

export const PanelBody: React.FC<React.HTMLAttributes<HTMLDivElement> & { compact?: boolean }> = ({
  compact = false,
  className,
  children,
  ...rest
}) => (
  <div className={cn(compact ? 'p-3.5' : 'p-4 sm:p-5', className)} {...rest}>
    {children}
  </div>
);

export const PanelFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  children,
  ...rest
}) => (
  <div
    className={cn(
      'flex items-center justify-end gap-2 border-t border-gray-200 px-4 py-3 sm:px-5 dark:border-gray-800',
      className
    )}
    {...rest}
  >
    {children}
  </div>
);

export default Panel;
