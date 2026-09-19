import React, { createContext, useContext } from 'react';
import { useAppSettings, UseAppSettingsResult, AppSettings } from '../hooks/useAppSettings';
import type { Currency } from '../types';

/**
 * Provides the business settings (currency, transfer rules, retention) to the whole
 * app.
 *
 * A context rather than props because the values are needed by leaf screens three
 * levels down — the purchase-order modal, the exports, the catalogue — and threading
 * `currency` through every layer would touch far more code than it is worth.
 *
 * It sits *inside* the subscription gate (see index.tsx), so nothing is fetched while
 * the licence is stopped.
 */

const AppSettingsContext = createContext<UseAppSettingsResult | null>(null);

export const AppSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const value = useAppSettings();
  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
};

export const useAppSettingsContext = (): UseAppSettingsResult => {
  const value = useContext(AppSettingsContext);
  if (!value) {
    throw new Error('useAppSettingsContext must be used inside <AppSettingsProvider>');
  }
  return value;
};

export const useAppSettingsValues = (): AppSettings => useAppSettingsContext().settings;

/** The currency to render money in. Falls back to the deployment default. */
export const useCurrency = (): Currency => useAppSettingsValues().currency;
