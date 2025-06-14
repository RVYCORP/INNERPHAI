
import { GoogleGenAI, Chat, GenerateContentResponse, GroundingChunk as SDKGroundingChunk } from "@google/genai";
import { PHAI_SYSTEM_PROMPT, GEMINI_MODEL_NAME } from '../constants';
import { GroundingChunk as LocalGroundingChunk } from "../types";

let ai: GoogleGenAI | null = null;

const initializeAi = (): GoogleGenAI | null => {
  if (ai) return ai;

  const apiKey = import.meta.env.VITE_API_KEY; // Use API_KEY directly from process.env per guidelines

  if (apiKey) {
    ai = new GoogleGenAI({ apiKey }); // Ensure apiKey is passed as an object property { apiKey: value }
    return ai;
  } else {
    console.error("API_KEY is not available. Gemini Service cannot be initialized. Ensure process.env.API_KEY is set.");
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
    config: { // config for ChatSession
      systemInstruction: PHAI_SYSTEM_PROMPT,
      tools: [{ googleSearch: {} }] // Enable Google Search for the entire chat session
    },
  });
};

interface SendMessageResult {
  text: string;
  groundingChunks?: LocalGroundingChunk[];
}

export const sendPhaiMessage = async (chat: Chat, message: string): Promise<SendMessageResult> => {
  try {
    // The 'useSearch' variable is no longer needed here to decide on passing 'tools',
    // as tools are configured at the chat session level.
    // The model will use the search tool if appropriate based on the prompt.

    let response: GenerateContentResponse;

    // Always send the message without dynamically adding 'tools'.
    // The 'tools' (e.g., Google Search) are configured when the chat session is created.
    response = await chat.sendMessage({ message: message.trim() }); 

    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
    let finalGroundingChunks: LocalGroundingChunk[] | undefined = undefined;

    if (groundingMetadata?.groundingChunks && groundingMetadata.groundingChunks.length > 0) {
        // Map SDKGroundingChunk to LocalGroundingChunk for type safety and to match local definitions.
        finalGroundingChunks = groundingMetadata.groundingChunks
            .map((sdkChunk: SDKGroundingChunk): LocalGroundingChunk => {
                const localChunk: LocalGroundingChunk = {}; // Initialize as empty LocalGroundingChunk
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
