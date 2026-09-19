import * as pdfjsLib from 'pdfjs-dist';
// Bundle the worker locally so PDF parsing keeps working offline and does not
// depend on a third-party CDN at runtime.
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { InventoryItem, LocationData } from '../types';
import { AiUnavailableError, callAiForJson } from './aiClient';
import { logger } from '../utils/logger';

// Use the namespace directly as it's correctly handled by the environment
const pdfjs: any = pdfjsLib;

if (pdfjs.GlobalWorkerOptions) {
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;
}

/** Character budget for the document text handed to the model. */
const MAX_DOCUMENT_CHARS = 60_000;
/** Give up on absurdly long documents instead of burning the whole context. */
const MAX_PAGES = 40;

export const extractTextFromPDF = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';

  const pageCount = Math.min(pdf.numPages, MAX_PAGES);
  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(' ');
    fullText += pageText + '\n';
    if (fullText.length > MAX_DOCUMENT_CHARS) break;
  }

  if (pdf.numPages > pageCount) {
    logger.warn('PDF truncated for AI parsing', { pages: pdf.numPages, used: pageCount });
  }

  return fullText.slice(0, MAX_DOCUMENT_CHARS);
};

export interface ExtractedTransfer {
  targetLocationId: string | null;
  items: { itemId: string; quantity: number }[];
  /** Raw names found in the document that could not be matched to an item. */
  unmatched?: string[];
}

/** Standard JSON Schema — the edge function relays it as the JSON output contract. */
const RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['targetLocationId', 'items', 'unmatched'],
  properties: {
    targetLocationId: {
      type: ['string', 'null'],
      description: 'ID of the location the stock is moving TO, or null when unclear',
    },
    items: {
      type: 'array',
      description: 'Every document line that matched an item in the database',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['itemId', 'quantity'],
        properties: {
          itemId: { type: 'string', description: 'Exact ID from the inventory database' },
          quantity: { type: 'number', description: 'Quantity to transfer (positive)' },
        },
      },
    },
    unmatched: {
      type: 'array',
      description: 'Item names from the document that are not in the database',
      items: { type: 'string' },
    },
  },
};

export const parseTransferDocument = async (
  text: string, 
  inventoryItems: InventoryItem[], 
  availableLocations: LocationData[]
): Promise<ExtractedTransfer> => {
  if (!text.trim()) {
    throw new AiUnavailableError('The document contained no readable text.', 'invalid_response');
  }

  // Prepare context for the AI
  const itemsContext = inventoryItems.map(i => `ID: "${i.id}", Name EN: "${i.nameEn}", Name AR: "${i.nameAr}", Unit: "${i.unit}"`).join('\n');
  const locationContext = availableLocations.map(l => `ID: "${l.id}", Name: "${l.name}", Name AR: "${l.nameAr || ''}"`).join('\n');

  const system = [
    'You convert transfer request documents into structured data for an inventory system.',
    'You only use IDs that exist in the provided database. You never invent IDs.',
    'Reply with a single JSON object and nothing else.',
  ].join('\n');

  const prompt = `
    Analyze the text extracted from a transfer request document (PDF).

    Extract:
    1. targetLocationId — the destination location (where items are going TO).
    2. items — lines that match the inventory database, with their IDs and quantities.
    3. unmatched — raw item names in the document that do not exist in the database.

    **Inventory Database:**
    ${itemsContext}

    **Available Locations:**
    ${locationContext}

    **Document Text:**
    ${text}

    **Rules:**
    - Match item names to either Name EN or Name AR exactly; ignore fuzzy or partial matches.
    - Return the corresponding ID only — never a name — in "items".
    - Quantities must be positive numbers; if a quantity is missing or unreadable, skip that line.
    - Match the destination location by name (either language) to its Location ID.
    - If the destination is ambiguous or absent, set targetLocationId to null.
    - List every unrecognised item name in "unmatched" so a human can review it.
  `;

  try {
    const raw = await callAiForJson<ExtractedTransfer>({
      prompt,
      system,
      responseSchema: RESPONSE_SCHEMA as unknown as Record<string, unknown>,
      temperature: 0,
    });

    const knownIds = new Set(inventoryItems.map((item) => item.id));
    const knownLocationIds = new Set(availableLocations.map((location) => location.id));

    // Never trust the model with inventory math: drop unknown IDs and non-positive amounts.
    const items = (Array.isArray(raw?.items) ? raw.items : [])
      .filter(
        (item) =>
          item &&
          typeof item.itemId === 'string' &&
          knownIds.has(item.itemId) &&
          Number.isFinite(Number(item.quantity)) &&
          Number(item.quantity) > 0
      )
      .map((item) => ({ itemId: item.itemId, quantity: Math.floor(Number(item.quantity)) }));

    const targetLocationId =
      typeof raw?.targetLocationId === 'string' && knownLocationIds.has(raw.targetLocationId)
        ? raw.targetLocationId
        : null;

    return {
      targetLocationId,
      items,
      unmatched: (Array.isArray(raw?.unmatched) ? raw.unmatched : []).filter(
        (name): name is string => typeof name === 'string' && name.trim().length > 0
      ),
    };
  } catch (error) {
    logger.error("Error parsing transfer document", error);
    throw error;
  }
};