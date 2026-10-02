import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { captureError } from '../utils/logger';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * The interface language, read the way the rest of the app persists it.
 *
 * The boundary renders when the app has already failed, so it cannot rely on a
 * React context being mounted — this reads the same localStorage value the
 * language toggle writes. Its text used to be English-only.
 */
const readLanguage = (): 'ar' | 'en' => {
  try {
    return localStorage.getItem('dawar_language') === 'ar' ? 'ar' : 'en';
  } catch {
    return 'en';
  }
};

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    captureError(error, {
      scope: 'react-error-boundary',
      componentStack: errorInfo.componentStack ?? undefined,
    });
  }

  public render() {
    if (this.state.hasError) {
      const isAr = readLanguage() === 'ar';
      return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4 dark:bg-gray-950">
          <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center dark:border-gray-800 dark:bg-gray-900">
            <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-danger-50 text-danger-600 dark:bg-danger-900/30 dark:text-danger-100">
              <AlertTriangle className="h-5 w-5" />
            </div>

            <h1 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
              {isAr ? 'حدث خطأ غير متوقع' : 'Something went wrong'}
            </h1>

            <p className="mb-6 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
              {isAr
                ? 'حدث خطأ غير متوقع. بياناتك بأمان — أعد تحميل الصفحة للمتابعة.'
                : 'We hit an unexpected error. Your data is safe — reload to continue.'}
            </p>

            <div className="mb-6 overflow-hidden rounded-lg border border-danger-100 bg-danger-50 p-3 text-start dark:border-danger-900 dark:bg-danger-900/20">
              <p className="truncate font-mono text-xs text-danger-700 dark:text-danger-100">
                {this.state.error?.message || (isAr ? 'خطأ غير معروف' : 'Unknown error occurred')}
              </p>
            </div>

            <button
              onClick={() => window.location.reload()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-800"
            >
              <RefreshCw className="h-4 w-4" />
              {isAr ? 'إعادة تحميل التطبيق' : 'Reload application'}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
