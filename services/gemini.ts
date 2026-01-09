
import { GoogleGenAI } from "@google/genai";

// Fix: Initialized GoogleGenAI strictly following the provided guidelines (using process.env.API_KEY directly)
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function getFeedbackOnMessage(message: string, context: string = "") {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are a helpful collaboration assistant in "Collab Lab". 
      A user sent this: "${message}". 
      ${context ? `Context of discussion: ${context}` : ""}
      Provide a very brief, professional feedback or constructive question to keep the flow moving. Max 30 words.`,
      config: {
        systemInstruction: "You are the Collab Lab Assistant. Be helpful, concise, and professional.",
        temperature: 0.7,
      }
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return null;
  }
}
