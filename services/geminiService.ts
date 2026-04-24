// Use correct import as per @google/genai guidelines
import { GoogleGenAI } from "@google/genai";
import { InventoryItem, Language } from "../types";

// Always use process.env.GEMINI_API_KEY directly and initialize GoogleGenAI inside or right before use
export const analyzeInventory = async (
  locationName: string, 
  items: InventoryItem[], 
  userQuery: string,
  language: Language
): Promise<string> => {
  // MUST use new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const modelId = 'gemini-3-flash-preview';

  const inventoryContext = items.map(item => 
    `- ${item.nameEn} / ${item.nameAr}: ${item.quantity} ${item.unit} (Threshold: ${item.minThreshold}) [Category: ${item.category}]`
  ).join('\n');

  const langInstruction = language === 'ar' 
    ? "IMPORTANT: You must respond in Arabic (اللغة العربية)." 
    : "IMPORTANT: You must respond in English.";

  const prompt = `
    You are an intelligent inventory assistant for "Dawar Saada".
    ${langInstruction}
    
    Current Location: ${locationName}
    
    Current Inventory Data (Items listed as English Name / Arabic Name):
    ${inventoryContext}
    
    User Query: "${userQuery}"
    
    Task: Provide a helpful, concise response based on the inventory data. 
    If the user asks for a report, summarize low stock items and suggest restocking.
    If the user asks a specific question, answer it directly using the data provided.
    Keep the tone professional yet friendly.
  `;

  try {
    // Call generateContent with model and contents as properties of the first argument
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
    });
    // Access response text via the .text property (not a method)
    return response.text || (language === 'ar' ? "لم أتمكن من إنشاء استجابة." : "I couldn't generate a response at this time.");
  } catch (error) {
    console.error("Gemini API Error:", error);
    return language === 'ar' ? "عذراً، واجهت خطأ." : "Sorry, I encountered an error while analyzing the inventory.";
  }
};