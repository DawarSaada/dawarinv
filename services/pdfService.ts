import * as pdfjsLib from 'pdfjs-dist';
// Use correct imports as per @google/genai guidelines
import { GoogleGenAI, Type } from "@google/genai";
import { InventoryItem, LocationData } from '../types';

// Use the namespace directly as it's correctly handled by the environment
const pdfjs: any = pdfjsLib;

// Set worker source for PDF.js using the specific CDN path matching the main library version
if (pdfjs.GlobalWorkerOptions) {
    pdfjs.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@5.4.624/build/pdf.worker.min.js`;
}

export const extractTextFromPDF = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(' ');
    fullText += pageText + '\n';
  }

  return fullText;
};

interface ExtractedTransfer {
  targetLocationId: string | null;
  items: { itemId: string; quantity: number }[];
}

export const parseTransferDocument = async (
  text: string, 
  inventoryItems: InventoryItem[], 
  availableLocations: LocationData[]
): Promise<ExtractedTransfer> => {
  // Always use new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) inside the function
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  // Prepare context for the AI
  const itemsContext = inventoryItems.map(i => `ID: "${i.id}", Name EN: "${i.nameEn}", Name AR: "${i.nameAr}", Unit: "${i.unit}"`).join('\n');
  const locationContext = availableLocations.map(l => `ID: "${l.id}", Name: "${l.name}"`).join('\n');

  const prompt = `
    You are a document processing assistant for an inventory system.
    Analyze the following text extracted from a transfer request document (PDF).
    
    Your goal is to extract:
    1. The destination location ID (where items are going TO).
    2. A list of items to transfer, matching them to the provided Inventory Database.

    **Inventory Database:**
    ${itemsContext}

    **Available Locations:**
    ${locationContext}

    **Document Text:**
    ${text}

    **Rules:**
    - Match item names in the text to either Name EN or Name AR in the Inventory Database. Return the corresponding ID.
    - If an item in the text does not exist in the database, ignore it.
    - Match the destination location name to the Location ID.
    - Extract quantities as numbers.
    - Return JSON only.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            targetLocationId: { type: Type.STRING, description: "The ID of the location the stock is moving TO" },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  itemId: { type: Type.STRING, description: "The ID of the inventory item found in the database" },
                  quantity: { type: Type.NUMBER, description: "The quantity to transfer" }
                },
                propertyOrdering: ["itemId", "quantity"]
              }
            }
          },
          propertyOrdering: ["targetLocationId", "items"]
        }
      }
    });

    // Access response text via the .text property (not a method)
    if (response.text) {
      return JSON.parse(response.text) as ExtractedTransfer;
    }
    throw new Error("No response from AI");
  } catch (error) {
    console.error("Error parsing transfer document:", error);
    throw error;
  }
};