
export enum Sender {
  User = 'USER',
  AI = 'AI',
}

export interface Message {
  id: string;
  text: string;
  sender: Sender;
  timestamp: Date;
  groundingChunks?: GroundingChunk[];
}

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
  retrievedContext?: { // For other types of grounding if used
    uri: string;
    title: string;
  };
  // other potential grounding types
}

export interface ChatSessionData {
  id: string;
  name: string;
  messages: Message[];
  createdAt: string;
}
