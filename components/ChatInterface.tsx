import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Message, Sender, GroundingChunk } from '../types';
import { SUGGESTED_PROMPTS } from '../constants';
import { startPhaiChat, sendPhaiMessage } from '../services/geminiService';
import type { Chat } from '@google/genai';

interface ChatInterfaceProps {
  apiKeyAvailable: boolean;
}

const SendIcon: React.FC = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 21L23 12L2 3V10L17 12L2 14V21Z" fill="currentColor"/>
  </svg>
);

const Logo: React.FC = () => (
  <div className="w-16 h-16 bg-gradient-to-br from-phai-purple to-phai-pink rounded-full flex items-center justify-center">
    <span className="text-white font-dela-gothic-one text-xl">P</span>
  </div>
);

const LoadingDots: React.FC = () => (
  <div className="flex space-x-1 items-center px-3 py-2">
    <div className="h-2 w-2 bg-phai-purple rounded-full animate-bounce [animation-delay:-0.3s]"></div>
    <div className="h-2 w-2 bg-phai-purple rounded-full animate-bounce [animation-delay:-0.15s]"></div>
    <div className="h-2 w-2 bg-phai-purple rounded-full animate-bounce"></div>
  </div>
);

const ChatInterface: React.FC<ChatInterfaceProps> = ({ apiKeyAvailable }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatSession, setChatSession] = useState<Chat | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout[]>([]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  useEffect(() => {
    if (apiKeyAvailable) {
      const session = startPhaiChat();
      setChatSession(session);
      if (!session) {
        setMessages(prev => [...prev, {id: 'apisetup_error', text: "Failed to initialize PHAI. Please check console for API key issues.", sender: Sender.AI, timestamp: new Date()}]);
      }
    }
    return () => {
        typingTimeoutRef.current.forEach(clearTimeout);
        typingTimeoutRef.current = [];
    };
  }, [apiKeyAvailable]);

  const handleSendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading || !chatSession) return;

    typingTimeoutRef.current.forEach(clearTimeout);
    typingTimeoutRef.current = [];

    const userMessage: Message = {
      id: Date.now().toString(),
      text: text.trim(),
      sender: Sender.User,
      timestamp: new Date(),
    };
    setMessages(prevMessages => [...prevMessages, userMessage]);
    setInputValue('');
    setIsLoading(true);

    const result = await sendPhaiMessage(chatSession, text.trim());

    setIsLoading(false);

    const fullAiText = result.text;
    const aiMessageId = (Date.now() + 1).toString();

    setMessages(prevMessages => [
      ...prevMessages,
      {
        id: aiMessageId,
        text: '',
        sender: Sender.AI,
        timestamp: new Date(),
      },
    ]);

    let currentText = '';
    const timeouts: NodeJS.Timeout[] = [];
    for (let i = 0; i < fullAiText.length; i++) {
      const timeout = setTimeout(() => {
        currentText += fullAiText[i];
        setMessages(prevMessages =>
          prevMessages.map(msg =>
            msg.id === aiMessageId ? { ...msg, text: currentText } : msg
          )
        );
      }, i * 50);
      timeouts.push(timeout);
    }
    typingTimeoutRef.current = timeouts;

  }, [isLoading, chatSession]);

  const handleSuggestionClick = (suggestion: string) => {
    handleSendMessage(suggestion);
  };

  const isInitialScreen = messages.length === 0;

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-purple-50 via-pink-50 to-purple-100">
      <div className={`flex-grow flex flex-col ${
          isInitialScreen 
            ? 'items-center justify-center p-6' 
            : 'items-stretch justify-start pt-20 px-6 pb-6 overflow-hidden min-h-0' 
        } transition-all duration-500 ease-in-out`}
      >
        {isInitialScreen ? (
          <div className="text-center flex flex-col items-center justify-center h-full w-full"> 
            <div className="mb-8 transform scale-150"> 
                <Logo />
            </div>
            <h1 className="text-3xl sm:text-4xl font-dela-gothic-one mb-2">
              <span className="text-phai-purple">HELLO ZIZO</span>
            </h1>
            <h2 className="text-3xl sm:text-4xl font-dela-gothic-one mb-10">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-phai-purple to-phai-pink">
                ASK PHAI ANYTHING
              </span>
            </h2>

            {apiKeyAvailable && chatSession && (
              <div className="w-full max-w-xl mx-auto">
                <p className="text-gray-600 mb-4 text-sm text-center">Suggestions on what to ask Our AI for you</p>
                <div className="flex flex-row flex-wrap justify-center gap-3 mt-2">
                  {SUGGESTED_PROMPTS.map((prompt, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestionClick(prompt)}
                      className="bg-white/80 hover:bg-white transition-colors duration-200 p-3 rounded-xl shadow-md border border-purple-100 text-sm text-gray-700 hover:text-phai-purple focus:outline-none focus:ring-2 focus:ring-phai-purple focus:ring-opacity-50"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {!apiKeyAvailable && (
                 <div className="mt-8 p-4 bg-red-100 text-red-700 rounded-lg max-w-md text-sm">
                    API Key not found or invalid. PHAI cannot be initialized. Please ensure the API_KEY environment variable is correctly set.
                 </div>
            )}
             {apiKeyAvailable && !chatSession && messages.some(m => m.id === 'apisetup_error') && (
                 <div className="mt-8 p-4 bg-yellow-100 text-yellow-700 rounded-lg max-w-md text-sm">
                    Failed to initialize PHAI chat session. Please try refreshing. If the problem persists, check console for errors.
                 </div>
            )}
          </div>
        ) : (
          <div className="w-full flex-grow overflow-y-auto space-y-4 pr-2 min-h-0"> 
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.sender === Sender.User ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                  msg.sender === Sender.User
                    ? 'bg-gradient-to-br from-phai-purple to-phai-pink text-white'
                    : 'bg-white/80 text-gray-800 border border-purple-100'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white/80 text-gray-800 border border-purple-100 rounded-lg">
                  <LoadingDots />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {apiKeyAvailable && chatSession && (
        <div className="p-4 bg-white/50 border-t border-purple-100 flex justify-center">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(inputValue);
            }}
            className="flex items-center space-x-2 w-full max-w-2xl"
          >
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask me anything about your projects..."
              className="flex-grow p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-phai-purple focus:border-transparent outline-none transition-shadow text-sm"
              disabled={isLoading || !chatSession}
            />
            <button
              type="submit"
              disabled={isLoading || !inputValue.trim() || !chatSession}
              className="p-3 bg-gradient-to-br from-phai-purple to-phai-pink text-white rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-phai-purple focus:ring-opacity-50"
            >
              <SendIcon />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default ChatInterface;