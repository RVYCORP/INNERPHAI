
import { GoogleGenAI, Chat, GenerateContentResponse, GroundingChunk as SDKGroundingChunk, Content } from "@google/genai";
import { PHAI_SYSTEM_PROMPT, GEMINI_MODEL_NAME } from '../constants';
import { Message as LocalMessage, GroundingChunk as LocalGroundingChunk, Sender } from "../types";


let ai: GoogleGenAI | null = null;

const initializeAi = (): GoogleGenAI | null => {
  if (ai) return ai;

  const apiKey = import.meta.env.VITE_API_KEY; 

  if (apiKey) {
    console.log("Initializing GoogleGenAI with API key");
    ai = new GoogleGenAI({ apiKey }); 
    return ai;
  } else {
    console.error("VITE_API_KEY is not available. Gemini Service cannot be initialized. Ensure import.meta.env.VITE_API_KEY is set.");
    return null;
  }
};

export const convertMessagesToGeminiHistory = (messages: LocalMessage[]): Content[] => {
  return messages.map(msg => ({
    role: msg.sender === Sender.User ? 'user' : 'model',
    parts: [{ text: msg.text }],
  }));
};

export const startPhaiChat = (history?: Content[]): Chat | null => {
  const currentAi = initializeAi();
  if (!currentAi) {
    return null;
  }
  return currentAi.chats.create({
    model: GEMINI_MODEL_NAME,
    history: history || [], 
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
    console.log("Sending message to Gemini:", message.trim());
    let response: GenerateContentResponse;
    response = await chat.sendMessage({ message: message.trim() }); 

    console.log("Full Gemini response:", response);
    console.log("Response text:", response.text);
    console.log("Response text length:", response.text?.length);

    const responseText = response.text || "";
    
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

    console.log("Returning response with text length:", responseText.length);
    return { text: responseText, groundingChunks: finalGroundingChunks };

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
