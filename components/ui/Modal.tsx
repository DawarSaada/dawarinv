import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from './cn';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

const SIZES: Record<ModalSize, string> = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
  full: 'sm:max-w-6xl',
};

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  footer?: React.ReactNode;
  size?: ModalSize;
  /** Blocks closing via backdrop/Esc while a write is in flight. */
  busy?: boolean;
  closeOnBackdrop?: boolean;
  children?: React.ReactNode;
  className?: string;
  /** Fully custom header instead of the title/close row. */
  headerSlot?: React.ReactNode;
}

/**
 * One dialog implementation for the whole app.
 *
 * Renders as a centred dialog from `sm` up and as a bottom sheet on phones,
 * traps focus, locks background scroll, restores focus on close and closes on
 * Escape or backdrop click.
 */
export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  description,
  icon,
  footer,
  size = 'md',
  busy = false,
  closeOnBackdrop = true,
  children,
  className,
  headerSlot,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  // Scroll lock (also keeps iOS from scrolling the page behind a sheet).
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.dataset.scrollLocked = 'true';
    document.body.style.overflow = 'hidden';
    return () => {
      delete document.body.dataset.scrollLocked;
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  // Remember what had focus, then move focus into the dialog.
  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = (document.activeElement as HTMLElement) ?? null;

    const raf = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const first = panel.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? panel).focus({ preventScroll: true });
    });

    return () => {
      cancelAnimationFrame(raf);
      restoreFocusRef.current?.focus?.({ preventScroll: true });
    };
  }, [open]);

  // Escape to close, Tab cycling inside the panel.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const panel = panelRef.current;
      if (!panel) return;
      const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (node) => node.offsetParent !== null || node === document.activeElement
      );
      if (nodes.length === 0) {
        event.preventDefault();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [open, busy, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-modal flex items-end justify-center sm:items-center sm:p-4">
      <div
        className="absolute inset-0 animate-fade-in bg-gray-950/55 backdrop-blur-[2px]"
        onClick={() => {
          if (closeOnBackdrop && !busy) onClose();
        }}
        aria-hidden
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        tabIndex={-1}
        className={cn(
          'relative flex max-h-[92vh] w-full flex-col overflow-hidden bg-white outline-none',
          'animate-sheet-up rounded-t-2xl border border-gray-200 shadow-sheet',
          'sm:animate-pop-in sm:rounded-xl sm:shadow-pop dark:border-gray-800 dark:bg-gray-900',
          SIZES[size],
          className
        )}
      >
        {headerSlot ?? (
          <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-4 py-3.5 sm:px-5 dark:border-gray-800">
            <div className="flex min-w-0 items-start gap-3">
              {icon && (
                <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 [&>svg]:h-4.5 [&>svg]:w-4.5">
                  {icon}
                </span>
              )}
              <div className="min-w-0">
                {title && (
                  <h2 className="truncate text-base font-semibold text-gray-900 dark:text-white">
                    {title}
                  </h2>
                )}
                {description && (
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{description}</p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              aria-label="Close"
              className="-me-1 -mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          {children}
        </div>

        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-gray-200 bg-gray-50/70 px-4 py-3 pb-safe sm:px-5 dark:border-gray-800 dark:bg-gray-950/40">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

/** Confirmation dialog with a destructive/primary action contract. */
export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: React.ReactNode;
  message?: React.ReactNode;
  confirmLabel: React.ReactNode;
  cancelLabel: React.ReactNode;
  danger?: boolean;
  busy?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  cancelLabel,
  danger = false,
  busy = false,
}) => (
  <Modal
    open={open}
    onClose={onClose}
    title={title}
    size="sm"
    busy={busy}
    footer={
      <>
        <button
          type="button"
          onClick={onClose}
          className="h-10 rounded-lg px-3.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className={cn(
            'h-10 rounded-lg px-4 text-sm font-medium text-white transition-colors disabled:opacity-55',
            danger ? 'bg-danger-600 hover:bg-danger-700' : 'bg-brand-700 hover:bg-brand-800'
          )}
        >
          {confirmLabel}
        </button>
      </>
    }
  >
    <p className="text-sm text-gray-600 dark:text-gray-300">{message}</p>
  </Modal>
);

export default Modal;
