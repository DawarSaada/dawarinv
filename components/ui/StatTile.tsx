import React from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cn } from './cn';

export type StatTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';

const TONE_CHIP: Record<StatTone, string> = {
  neutral: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  brand: 'bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-400',
  success: 'bg-success-50 text-success-700 dark:bg-success-900/40 dark:text-success-100',
  warning: 'bg-warning-50 text-warning-700 dark:bg-warning-900/40 dark:text-warning-100',
  danger: 'bg-danger-50 text-danger-700 dark:bg-danger-900/40 dark:text-danger-100',
  info: 'bg-info-50 text-info-700 dark:bg-info-900/40 dark:text-info-100',
};

const TONE_VALUE: Record<StatTone, string> = {
  neutral: 'text-gray-900 dark:text-white',
  brand: 'text-gray-900 dark:text-white',
  success: 'text-success-700 dark:text-success-100',
  warning: 'text-warning-700 dark:text-warning-100',
  danger: 'text-danger-700 dark:text-danger-100',
  info: 'text-info-700 dark:text-info-100',
};

export interface StatTileProps {
  label: React.ReactNode;
  value: React.ReactNode;
  /** Unit or secondary value rendered next to the number, e.g. "units". */
  unit?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: StatTone;
  /** Positive/negative change versus the previous period, in percent. */
  delta?: number | null;
  deltaLabel?: React.ReactNode;
  hint?: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * A KPI tile that stays readable at a glance: label, number, then context.
 * Tiles double as filters when `onClick` is provided.
 */
export const StatTile: React.FC<StatTileProps> = ({
  label,
  value,
  unit,
  icon,
  tone = 'neutral',
  delta,
  deltaLabel,
  hint,
  onClick,
  active = false,
  size = 'md',
  className,
}) => {
  const interactive = Boolean(onClick);
  const Wrapper = interactive ? 'button' : 'div';

  return (
    <Wrapper
      {...(interactive ? { type: 'button' as const, onClick, 'aria-pressed': active } : {})}
      className={cn(
        'group relative flex w-full flex-col rounded-xl border bg-white text-start transition-colors dark:bg-gray-900',
        active
          ? 'border-brand-500 ring-1 ring-brand-500/40 dark:border-brand-500'
          : 'border-gray-200 dark:border-gray-800',
        interactive && 'hover:border-gray-300 hover:bg-gray-50/60 dark:hover:border-gray-700',
        size === 'md' ? 'gap-2.5 p-3.5 sm:p-4' : 'gap-2 p-3',
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-2xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          {label}
        </span>
        {icon && (
          <span
            className={cn(
              'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg [&>svg]:h-3.5 [&>svg]:w-3.5',
              TONE_CHIP[tone]
            )}
            aria-hidden
          >
            {icon}
          </span>
        )}
      </div>

      <div className="flex items-baseline gap-1.5">
        <span
          className={cn(
            'tnum font-semibold tracking-tight',
            size === 'md' ? 'text-2xl' : 'text-xl',
            TONE_VALUE[tone]
          )}
        >
          {value}
        </span>
        {unit && <span className="text-xs text-gray-500 dark:text-gray-400">{unit}</span>}
      </div>

      {(delta !== undefined || hint || deltaLabel) && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
          {delta !== undefined && delta !== null && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 font-medium',
                delta > 0
                  ? 'text-success-700 dark:text-success-100'
                  : delta < 0
                    ? 'text-danger-600 dark:text-danger-100'
                    : 'text-gray-500 dark:text-gray-400'
              )}
            >
              {delta > 0 ? (
                <ArrowUpRight className="h-3.5 w-3.5" />
              ) : delta < 0 ? (
                <ArrowDownRight className="h-3.5 w-3.5" />
              ) : (
                <Minus className="h-3.5 w-3.5" />
              )}
              {Math.abs(delta).toFixed(1)}%
            </span>
          )}
          {deltaLabel && <span className="truncate">{deltaLabel}</span>}
          {hint && <span className="truncate">{hint}</span>}
        </div>
      )}
    </Wrapper>
  );
};

export default StatTile;
