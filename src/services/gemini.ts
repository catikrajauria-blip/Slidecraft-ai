import { GoogleGenAI, Type } from "@google/genai";

let aiInstance: GoogleGenAI | null = null;

function getAI() {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined. Please add it to your environment variables.");
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

export interface EnhancedSlide {
  title: string;
  content: string;
  visualSuggestion: string;
  animationType: string;
  theme: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    fontFamily: string;
  };
}

export async function enhancePresentation(slidesText: string, instructions?: string): Promise<EnhancedSlide[]> {
  const ai = getAI();
  const prompt = `
    You are an expert presentation designer. I will provide you with the raw text content of a PowerPoint presentation.
    Your task is to:
    1. Analyze the content and structure it into clear, engaging slides.
    2. Suggest a visually appealing theme (colors, fonts).
    3. For each slide, provide a title, a concise and impactful content summary, a visual suggestion (graphics, icons, layout), and an animation type (e.g., "fade", "slide-up", "zoom").
    4. If instructions are provided, follow them strictly.

    Instructions: ${instructions || "Make it modern, professional, and visually stunning."}

    Raw Content:
    ${slidesText}
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            content: { type: Type.STRING },
            visualSuggestion: { type: Type.STRING },
            animationType: { type: Type.STRING },
            theme: {
              type: Type.OBJECT,
              properties: {
                primaryColor: { type: Type.STRING },
                secondaryColor: { type: Type.STRING },
                accentColor: { type: Type.STRING },
                fontFamily: { type: Type.STRING },
              },
              required: ["primaryColor", "secondaryColor", "accentColor", "fontFamily"]
            }
          },
          required: ["title", "content", "visualSuggestion", "animationType", "theme"]
        }
      }
    }
  });

  try {
    const text = response.text;
    if (!text) return [];
    return JSON.parse(text);
  } catch (e) {
    console.error("Failed to parse Gemini response", e);
    return [];
  }
}

export async function chatWithPresentation(history: any[], message: string) {
  const ai = getAI();
  const chat = ai.chats.create({
    model: "gemini-3-flash-preview",
    history: history,
  });

  const response = await chat.sendMessage({ message });
  return response.text;
}
