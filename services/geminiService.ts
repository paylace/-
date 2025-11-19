import { GoogleGenAI, Type } from "@google/genai";
import { TranslationResult } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

/**
 * Analyzes an image to extract Japanese text and translate it to Korean.
 * @param base64Image The base64 encoded image string (without the data prefix).
 * @returns A structured translation result.
 */
export const translateImage = async (base64Image: string): Promise<TranslationResult> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Image,
            },
          },
          {
            text: `Analyze this image containing Japanese text.
            
            Task:
            1. Detect all visible Japanese text blocks.
            2. Translate each detected Japanese phrase or sentence into natural, context-aware Korean.
               - Prioritize accuracy and flow over literal translation.
               - Correctly interpret technical terms, idioms, and cultural context.
               - Maintain the original tone (polite vs. casual).
            3. Return the bounding box for each detected text as [ymin, xmin, ymax, xmax] where coordinates are normalized to 1000 (0-1000).
            4. Provide a brief, coherent summary of the overall meaning in Korean.
            
            Return the result in JSON format corresponding to this schema:
            {
              items: [{ original: string, translated: string, box_2d: [number, number, number, number] }],
              summary: string
            }
            If no text is found, return empty arrays for items and a message in summary saying "No text detected".
            If the text is not Japanese, treat it as valid text but note the language in summary.`,
          },
        ],
      },
      config: {
        temperature: 0.3, // Low temperature for more deterministic/accurate translations
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  original: { type: Type.STRING },
                  translated: { type: Type.STRING },
                  box_2d: {
                    type: Type.ARRAY,
                    items: { type: Type.INTEGER },
                    description: "Bounding box coordinates [ymin, xmin, ymax, xmax] normalized to 1000.",
                  },
                },
                required: ["original", "translated", "box_2d"],
              },
            },
            summary: { type: Type.STRING },
          },
          required: ["items", "summary"],
        },
      },
    });

    const text = response.text;
    
    // Handle cases where model returns empty text (Safety blocks, etc.)
    if (!text) {
      console.warn("Gemini returned empty text. Possible safety block or no content.");
      return {
        items: [],
        summary: "Could not process image (Safety filter or Network error)."
      };
    }

    try {
      // Strip Markdown code blocks if present (e.g. ```json ... ```) to ensure clean parsing
      const cleanText = text.replace(/```json\s*|\s*```/g, '').trim();
      return JSON.parse(cleanText) as TranslationResult;
    } catch (jsonError) {
      console.error("Failed to parse Gemini JSON:", text);
      // Attempt cleanup or just return failure object
      return {
        items: [],
        summary: "Translation failed: Invalid response format."
      };
    }

  } catch (error) {
    console.error("Translation API error:", error);
    // Return a safe object instead of crashing the UI
    return {
        items: [],
        summary: "Connection error. Please check your internet."
    };
  }
};

/**
 * Simulates offline translation for demonstration purposes.
 * Real offline OCR/NMT requires heavy WASM libraries (like Tesseract + ONNX)
 * which are too large to include in this single-file demo context.
 */
export const translateImageOffline = async (): Promise<TranslationResult> => {
  // Simulate local processing delay (faster than cloud)
  await new Promise(resolve => setTimeout(resolve, 800));

  return {
    items: [
      {
        original: "オフライン",
        translated: "오프라인 모드",
        box_2d: [350, 200, 500, 800] // Centered box
      },
      {
        original: "接続なし",
        translated: "연결 상태 양호",
        box_2d: [550, 300, 650, 700]
      }
    ],
    summary: "Using downloaded language packs. (Simulation: Real local inference would run here using the stored models)."
  };
};