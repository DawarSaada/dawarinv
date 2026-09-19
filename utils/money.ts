import { CURRENCIES } from '../constants';
import type { Currency, Language } from '../types';

/**
 * One place that renders an amount of money.
 *
 * "SAR" used to be typed literally into the purchase-order screens, the product
 * catalogue and the PDF exports, so the currency could not be changed without editing
 * seven files. Every one of those now goes through here, which reads the currency from
 * the administrator's settings.
 *
 * The code is placed before the number (`SAR 1,250.00`) in both languages: the code is
 * Latin text either way, and keeping it on one side avoids a bidi mess in Arabic.
 * Amounts are formatted with the locale's number system, so Arabic gets Arabic-Indic
 * digits.
 */
export const formatMoney = (
  amount: number,
  currency: Currency,
  options: { language?: Language; withCode?: boolean; decimals?: number } = {}
): string => {
  const { language = 'en', withCode = true, decimals = 2 } = options;
  const value = Number.isFinite(amount) ? amount : 0;
  const formatted = value.toLocaleString(language === 'ar' ? 'ar-SA-u-nu-arab' : 'en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return withCode ? `${currency} ${formatted}` : formatted;
};

/** Human name of a currency for the settings picker. */
export const currencyName = (code: Currency, language: Language): string => {
  const entry = CURRENCIES.find((c) => c.code === code);
  if (!entry) return code;
  return language === 'ar' ? entry.nameAr : entry.nameEn;
};
