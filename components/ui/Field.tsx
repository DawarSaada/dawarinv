import React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from './cn';

const CONTROL_BASE =
  'w-full rounded-lg border bg-white text-gray-900 placeholder:text-gray-400 transition-colors duration-150 ' +
  'focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 ' +
  'disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500 ' +
  'dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500 dark:disabled:bg-gray-800/60';

const CONTROL_BORDER =
  'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600';

const CONTROL_INVALID =
  'border-danger-500 focus:border-danger-500 focus:ring-danger-500/30 dark:border-danger-500';

export const CONTROL_HEIGHTS = {
  sm: 'h-8 text-xs',
  md: 'h-10 text-sm',
  lg: 'h-11 text-sm',
} as const;

export type ControlSize = keyof typeof CONTROL_HEIGHTS;

export interface FieldProps {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
  /** Renders label and hint inline, for compact filter rows. */
  inline?: boolean;
}

export const Field: React.FC<FieldProps> = ({
  label,
  hint,
  error,
  required,
  htmlFor,
  className,
  children,
  inline = false,
}) => (
  <div className={cn(inline ? 'flex items-center gap-2' : 'space-y-1.5', className)}>
    {label && (
      <label
        htmlFor={htmlFor}
        className="block text-xs font-medium text-gray-600 dark:text-gray-400"
      >
        {label}
        {required && <span className="ms-0.5 text-danger-600">*</span>}
      </label>
    )}
    <div className={inline ? 'flex-1' : undefined}>{children}</div>
    {error ? (
      <p className="text-xs text-danger-600 dark:text-danger-500" role="alert">
        {error}
      </p>
    ) : (
      hint && <p className="text-xs text-gray-500 dark:text-gray-500">{hint}</p>
    )}
  </div>
);

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: ControlSize;
  invalid?: boolean;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  /** Extra content pinned to the trailing edge (e.g. a scan button). */
  trailingSlot?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { size = 'md', invalid = false, leadingIcon, trailingIcon, trailingSlot, className, ...rest },
  ref
) {
  return (
    <div className="relative">
      {leadingIcon && (
        <span className="pointer-events-none absolute inset-y-0 start-0 flex w-9 items-center justify-center text-gray-400 [&>svg]:h-4 [&>svg]:w-4">
          {leadingIcon}
        </span>
      )}
      <input
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          CONTROL_BASE,
          invalid ? CONTROL_INVALID : CONTROL_BORDER,
          CONTROL_HEIGHTS[size],
          leadingIcon ? 'ps-9' : 'ps-3',
          trailingSlot ? 'pe-20' : trailingIcon ? 'pe-9' : 'pe-3',
          className
        )}
        {...rest}
      />
      {(trailingSlot || trailingIcon) && (
        <span className="absolute inset-y-0 end-1.5 flex items-center gap-1">
          {trailingSlot}
          {trailingIcon && <span className="text-gray-400 [&>svg]:h-4 [&>svg]:w-4">{trailingIcon}</span>}
        </span>
      )}
    </div>
  );
});

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  size?: ControlSize;
  invalid?: boolean;
  /** Chevron position flips automatically in RTL via logical properties. */
  containerClassName?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { size = 'md', invalid = false, className, containerClassName, children, ...rest },
  ref
) {
  return (
    <div className={cn('relative', containerClassName)}>
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          CONTROL_BASE,
          invalid ? CONTROL_INVALID : CONTROL_BORDER,
          CONTROL_HEIGHTS[size],
          'appearance-none ps-3 pe-9',
          className
        )}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute inset-y-0 end-2.5 my-auto h-4 w-4 text-gray-400" />
    </div>
  );
});

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { invalid = false, className, rows = 3, ...rest },
  ref
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cn(
        CONTROL_BASE,
        invalid ? CONTROL_INVALID : CONTROL_BORDER,
        'resize-y px-3 py-2 text-sm',
        className
      )}
      {...rest}
    />
  );
});
