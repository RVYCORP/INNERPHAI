
import { GoogleGenAI, Chat, GenerateContentResponse, GroundingChunk as SDKGroundingChunk } from "@google/genai";
import { PHAI_SYSTEM_PROMPT, GEMINI_MODEL_NAME } from '../constants';
import { GroundingChunk as LocalGroundingChunk } from "../types";

let ai: GoogleGenAI | null = null;

const initializeAi = (): GoogleGenAI | null => {
  if (ai) return ai;
  
  // In browser environment, we need to get API key from window or other method
  // For now, let's check if it's available in the global scope or passed via other means
  const apiKey = (window as any).API_KEY || import.meta.env.VITE_API_KEY;

  if (apiKey) {
    ai = new GoogleGenAI({ apiKey });
    return ai;
  } else {
    console.error("API_KEY is not available. Gemini Service cannot be initialized. Ensure VITE_API_KEY is set or API_KEY is available globally.");
    return null;
  }
};

export const startPhaiChat = (): Chat | null => {
  const currentAi = initializeAi();
  if (!currentAi) {
    return null;
  }
  return currentAi.chats.create({
    model: GEMINI_MODEL_NAME,
    config: {
      systemInstruction: PHAI_SYSTEM_PROMPT,
      tools: [{ googleSearch: {} }]
    },
  });
};

interface SendMessageResult {
  text: string;
  groundingChunks?: LocalGroundingChunk[];
}

export const sendPhaiMessage = async (chat: Chat, message: string): Promise<SendMessageResult> => {
  try {
    let response: GenerateContentResponse;

    response = await chat.sendMessage({ message: message.trim() }); 

    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
    let finalGroundingChunks: LocalGroundingChunk[] | undefined = undefined;

    if (groundingMetadata?.groundingChunks && groundingMetadata.groundingChunks.length > 0) {
        finalGroundingChunks = groundingMetadata.groundingChunks
            .map((sdkChunk: SDKGroundingChunk): LocalGroundingChunk => {
                const localChunk: LocalGroundingChunk = {};
                if (sdkChunk.web) {
                    localChunk.web = { uri: sdkChunk.web.uri, title: sdkChunk.web.title };
                }
                if (sdkChunk.retrievedContext) { 
                    localChunk.retrievedContext = { 
                        uri: sdkChunk.retrievedContext.uri, 
                        title: sdkChunk.retrievedContext.title 
                    };
                }
                return localChunk;
            })
            .filter(chunk => chunk.web || chunk.retrievedContext); 
    }
    
    return { text: response.text, groundingChunks: finalGroundingChunks };

  } catch (error) {
    console.error("Error sending message to Gemini:", error);
    if (error instanceof Error) {
        if (error.message.includes("API key not valid")) {
             return { text: "There seems to be an issue with the API configuration. Please check the API key." };
        }
         return { text: `Sorry, I encountered an error: ${error.message}. Please try again.`};
    }
    return { text: "Sorry, I encountered an unknown error. Please try again." };
  }
};
