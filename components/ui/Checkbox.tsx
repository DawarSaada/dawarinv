import React, { useEffect, useRef } from 'react';
import { cn } from './cn';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode;
  indeterminate?: boolean;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, indeterminate = false, className, ...rest },
  forwardedRef
) {
  const innerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (innerRef.current) innerRef.current.indeterminate = indeterminate;
  }, [indeterminate]);

  const assignRef = (node: HTMLInputElement | null) => {
    innerRef.current = node;
    if (typeof forwardedRef === 'function') forwardedRef(node);
    else if (forwardedRef) (forwardedRef as React.MutableRefObject<HTMLInputElement | null>).current = node;
  };

  return (
    <label className={cn('inline-flex cursor-pointer items-center gap-2', className)}>
      <input
        ref={assignRef}
        type="checkbox"
        className="h-4 w-4 shrink-0 cursor-pointer rounded border-gray-300 accent-brand-700 focus-visible:outline-offset-2 dark:border-gray-600"
        {...rest}
      />
      {label && <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>}
    </label>
  );
});

export default Checkbox;
