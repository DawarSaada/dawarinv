import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from './cn';

export const Spinner: React.FC<{ className?: string; label?: string }> = ({ className, label }) => (
  <Loader2
    className={cn('h-4 w-4 animate-spin text-gray-400', className)}
    role="status"
    aria-label={label ?? 'Loading'}
  />
);

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Tailwind sizing classes, e.g. "h-4 w-32". */
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className, ...rest }) => (
  <div
    className={cn(
      'relative overflow-hidden rounded-md bg-gray-200/80 dark:bg-gray-800',
      'after:absolute after:inset-0 after:animate-shimmer after:bg-gradient-to-r after:from-transparent after:via-white/50 after:to-transparent dark:after:via-white/5',
      className
    )}
    aria-hidden
    {...rest}
  />
);

/** Convenience: a block of text lines. */
export const SkeletonText: React.FC<{ lines?: number; className?: string }> = ({
  lines = 3,
  className,
}) => (
  <div className={cn('space-y-2', className)}>
    {Array.from({ length: lines }).map((_, index) => (
      <Skeleton key={index} className={cn('h-3', index === lines - 1 ? 'w-2/3' : 'w-full')} />
    ))}
  </div>
);

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  size?: 'sm' | 'md';
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  size = 'md',
  className,
}) => (
  <div
    className={cn(
      'flex flex-col items-center justify-center text-center',
      size === 'md' ? 'px-6 py-14' : 'px-4 py-8',
      className
    )}
  >
    {icon && (
      <span
        className={cn(
          'mb-3 flex items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 text-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-500',
          size === 'md' ? 'h-12 w-12 [&>svg]:h-5 [&>svg]:w-5' : 'h-9 w-9 [&>svg]:h-4 [&>svg]:w-4'
        )}
        aria-hidden
      >
        {icon}
      </span>
    )}
    <h3 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h3>
    {description && (
      <p className="mt-1 max-w-sm text-sm text-gray-500 dark:text-gray-400">{description}</p>
    )}
    {action && <div className="mt-4 flex items-center gap-2">{action}</div>}
  </div>
);

/** Inline, non-blocking error surface with an optional retry action. */
export const ErrorState: React.FC<{
  title?: React.ReactNode;
  message?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}> = ({ title, message, action, className }) => (
  <div
    className={cn(
      'rounded-lg border border-danger-100 bg-danger-50 p-3.5 dark:border-danger-900 dark:bg-danger-900/20',
      className
    )}
    role="alert"
  >
    <p className="text-sm font-medium text-danger-700 dark:text-danger-100">
      {title ?? 'Something went wrong'}
    </p>
    {message && <p className="mt-0.5 text-xs text-danger-700/80 dark:text-danger-100/80">{message}</p>}
    {action && <div className="mt-2">{action}</div>}
  </div>
);
