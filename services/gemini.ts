
import { GoogleGenAI } from "@google/genai";

/**
 * Generates professional feedback or analysis based on chat messages within a lab context.
 * Uses gemini-3-flash-preview for fast and intelligent summarization.
 */
export async function getFeedbackOnMessage(message: string, context: string = "") {
  // Use named parameter for apiKey as required by @google/genai
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Lab Context: ${context}\n\nRecent Discussion History:\n${message}\n\nPlease provide a professional insight, summary, or potential next step for the research team.`,
      config: {
        systemInstruction: "You are a world-class research coordinator for 'Collab Lab'. Your role is to analyze chat messages and provide concise, actionable insights or summaries. Keep responses short and professional (under 100 words).",
        temperature: 0.7,
      },
    });
    
    // Access response.text directly as a property
    return response.text;
  } catch (error) {
    console.error("Gemini AI error:", error);
    return "The AI analysis module is currently unavailable. Please check your connection and try again.";
  }
}
