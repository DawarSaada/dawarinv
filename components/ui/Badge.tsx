import React from 'react';
import { cn } from './cn';

export type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';
export type BadgeSize = 'sm' | 'md';

// Soft tints only: status colour belongs in the label and the dot, not in a
// saturated block that competes with the content around it.
const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
  brand: 'bg-brand-50 text-brand-800 border-brand-200 dark:bg-brand-950 dark:text-brand-300 dark:border-brand-900',
  success: 'bg-success-50 text-success-700 border-success-100 dark:bg-success-900/30 dark:text-success-100 dark:border-success-900',
  warning: 'bg-warning-50 text-warning-700 border-warning-100 dark:bg-warning-900/30 dark:text-warning-100 dark:border-warning-900',
  danger: 'bg-danger-50 text-danger-700 border-danger-100 dark:bg-danger-900/30 dark:text-danger-100 dark:border-danger-900',
  info: 'bg-info-50 text-info-700 border-info-100 dark:bg-info-900/30 dark:text-info-100 dark:border-info-900',
};

const DOT_TONES: Record<BadgeTone, string> = {
  neutral: 'bg-gray-400',
  brand: 'bg-brand-500',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  danger: 'bg-danger-500',
  info: 'bg-info-500',
};

const SIZES: Record<BadgeSize, string> = {
  sm: 'h-5 px-1.5 text-2xs gap-1',
  md: 'h-6 px-2 text-xs gap-1.5',
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  size?: BadgeSize;
  dot?: boolean;
  /** Pulses the dot, for "live" indicators. */
  pulse?: boolean;
  icon?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  tone = 'neutral',
  size = 'md',
  dot = false,
  pulse = false,
  icon,
  className,
  children,
  ...rest
}) => (
  <span
    className={cn(
      'inline-flex items-center rounded-full border font-medium whitespace-nowrap',
      TONES[tone],
      SIZES[size],
      className
    )}
    {...rest}
  >
    {dot && (
      <span
        className={cn('h-1.5 w-1.5 flex-shrink-0 rounded-full', DOT_TONES[tone], pulse && 'animate-pulse')}
        aria-hidden
      />
    )}
    {icon && <span className="[&>svg]:h-3 [&>svg]:w-3" aria-hidden>{icon}</span>}
    {children}
  </span>
);

export default Badge;
