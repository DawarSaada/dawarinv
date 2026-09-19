import { InventoryItem, Language } from '../types';
import { AiUnavailableError, callAi, describeAiError } from './aiClient';
import { logger } from '../utils/logger';

/**
 * Inventory Q&A for the Smart Assistant.
 *
 * The prompt is relayed to the `ai-assistant` edge function (OpenRouter proxy);
 * the API key is a server-side secret and is never bundled into the browser build.
 */

/** Beyond this many items the prompt is trimmed to a summary + the interesting rows. */
const MAX_ITEMS_IN_PROMPT = 400;

const formatItem = (item: InventoryItem) =>
  `- ${item.nameEn} / ${item.nameAr}: ${item.quantity} ${item.unit} (min ${item.minThreshold}) [${item.category}]${
    item.expirationDate ? ` exp ${item.expirationDate}` : ''
  }`;

/** Compacts a large inventory into something a model can still reason about. */
const buildInventoryContext = (items: InventoryItem[]): { context: string; truncated: boolean } => {
  if (items.length <= MAX_ITEMS_IN_PROMPT) {
    return { context: items.map(formatItem).join('\n'), truncated: false };
  }

  const byCategory = new Map<string, { count: number; units: number }>();
  items.forEach((item) => {
    const entry = byCategory.get(item.category) || { count: 0, units: 0 };
    entry.count += 1;
    entry.units += Number(item.quantity) || 0;
    byCategory.set(item.category, entry);
  });

  const summary = Array.from(byCategory.entries())
    .map(([category, entry]) => `- ${category}: ${entry.count} items, ${entry.units} units`);

  const lowStock = items.filter((item) => Number(item.quantity) <= Number(item.minThreshold));
  const rest = items
    .filter((item) => !lowStock.includes(item))
    .sort((a, b) => Number(b.quantity) - Number(a.quantity))
    .slice(0, MAX_ITEMS_IN_PROMPT - lowStock.length);

  const context = [
    `Category summary (${items.length} items total):`,
    ...summary,
    '',
    `Low stock items (${lowStock.length}), all included:`,
    ...lowStock.map(formatItem),
    '',
    `Remaining items by quantity (${rest.length} shown):`,
    ...rest.map(formatItem),
  ].join('\n');

  return { context, truncated: true };
};

export const analyzeInventory = async (
  locationName: string,
  items: InventoryItem[],
  userQuery: string,
  language: Language
): Promise<string> => {
  const isAr = language === 'ar';
  const { context, truncated } = buildInventoryContext(items);

  const system = [
    'You are the inventory assistant for "Dawar Saada", a multilingual (English/Arabic) inventory system.',
    isAr
      ? 'IMPORTANT: Always answer in Arabic.'
      : 'IMPORTANT: Always answer in English.',
    'Be concise and concrete: name items, quantities and the location. Never invent items that are not in the data.',
    'If asked for a report, lead with the low stock items and suggest a restocking quantity.',
    'Format short answers in plain text; use a compact markdown list only when listing several items.',
  ]
    .filter(Boolean)
    .join('\n');

  const prompt = [
    `Location: ${locationName}`,
    `Items on record: ${items.length}`,
    truncated
      ? 'Note: the list below is a condensed view (category summary + low stock + the largest holdings). Say so if the answer needs the full catalogue.'
      : '',
    '',
    'Inventory data (English name / Arabic name: quantity unit):',
    context,
    '',
    `User question: "${userQuery}"`,
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const text = await callAi({ prompt, system, temperature: 0.2 });
    return text || (isAr ? 'لم أتمكن من إنشاء استجابة.' : "I couldn't generate a response at this time.");
  } catch (error) {
    logger.error('AI assistant request failed', error);
    if (error instanceof AiUnavailableError) {
      return describeAiError(error, language);
    }
    return isAr ? 'عذراً، واجهت خطأ.' : 'Sorry, I encountered an error while analyzing the inventory.';
  }
};
