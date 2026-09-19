import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from './cn';

export type ButtonVariant = 'primary' | 'secondary' | 'subtle' | 'ghost' | 'danger' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANTS: Record<ButtonVariant, string> = {
  // Solid fills use the 700 step so white label text clears AA contrast.
  primary:
    'bg-brand-700 text-white hover:bg-brand-800 active:bg-brand-900 shadow-xs disabled:shadow-none',
  secondary:
    'bg-white text-gray-700 border border-gray-200 shadow-xs hover:bg-gray-50 hover:border-gray-300 active:bg-gray-100 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700 dark:hover:bg-gray-700 dark:hover:border-gray-600',
  subtle:
    'bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700',
  ghost:
    'text-gray-600 hover:bg-gray-100 hover:text-gray-900 active:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white',
  danger: 'bg-danger-600 text-white hover:bg-danger-700 active:bg-danger-700 shadow-xs',
  link: 'text-brand-700 dark:text-brand-400 hover:underline underline-offset-2 px-0',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-2.5 text-xs gap-1.5 rounded-md [&>svg]:w-3.5 [&>svg]:h-3.5',
  md: 'h-10 px-3.5 text-sm gap-2 rounded-lg [&>svg]:w-4 [&>svg]:h-4',
  lg: 'h-11 px-5 text-base gap-2 rounded-lg [&>svg]:w-4.5 [&>svg]:h-4.5',
};

export interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Leading icon (any element, typically a lucide icon). */
  icon?: React.ReactNode;
  /** Trailing icon, e.g. a chevron or arrow. */
  trailingIcon?: React.ReactNode;
  loading?: boolean;
  block?: boolean;
  /** Hides the label below `sm`, which keeps mobile toolbars to icons only. */
  hideLabelOnMobile?: boolean;
  children?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'md',
    icon,
    trailingIcon,
    loading = false,
    block = false,
    hideLabelOnMobile = false,
    className,
    children,
    disabled,
    type = 'button',
    ...rest
  },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center font-medium whitespace-nowrap transition-colors duration-150',
        'disabled:cursor-not-allowed disabled:opacity-55',
        VARIANTS[variant],
        variant === 'link' ? 'h-auto' : SIZES[size],
        block && 'w-full',
        className
      )}
      {...rest}
    >
      {loading ? <Loader2 className="animate-spin" aria-hidden /> : icon}
      {children !== undefined && children !== null && (
        <span className={cn(hideLabelOnMobile && 'hidden sm:inline')}>{children}</span>
      )}
      {trailingIcon}
    </button>
  );
});

export default Button;
