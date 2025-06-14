
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Message, Sender, GroundingChunk } from '../types';
import { SUGGESTED_PROMPTS } from '../constants';
import { startPhaiChat, sendPhaiMessage } from '../services/geminiService';
import type { Chat } from '@google/genai';

interface ChatInterfaceProps {
  apiKeyAvailable: boolean;
}

const Logo: React.FC<{className?: string}> = ({ className }) => (
  <svg width="40" height="40" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={`opacity-90 ${className}`}>
    <defs>
      <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style={{stopColor: '#A78BFA', stopOpacity: 1}} /> {/* phai-purple */}
        <stop offset="100%" style={{stopColor: '#F472B6', stopOpacity: 1}} /> {/* phai-pink */}
      </linearGradient>
    </defs>
    <path d="M18 2.0845C9.2275 2.0845 2.0845 9.2275 2.0845 18C2.0845 26.7725 9.2275 33.9155 18 33.9155C26.7725 33.9155 33.9155 26.7725 33.9155 18C33.9155 9.2275 26.7725 2.0845 18 2.0845Z" stroke="url(#grad1)" strokeWidth="3"/>
    <path d="M18 9C14.134 9 11 12.134 11 16C11 19.866 14.134 23 18 23C21.866 23 25 19.866 25 16C25 12.134 21.866 9 18 9Z" stroke="url(#grad1)" strokeWidth="2.5"/>
    <ellipse cx="18" cy="16" rx="3" ry="3" fill="url(#grad1)"/>
  </svg>
);

// SparkleIcon and Sparkles components are no longer used on the initial screen's center or top-right.
// They are kept in case they are needed for other UI elements or future features.
const SparkleIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={`w-6 h-6 ${className}`}>
    <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354l-4.502 2.825c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.007z" clipRule="evenodd" />
  </svg>
);

const Sparkles: React.FC<{ className?: string, large?: boolean }> = ({ className, large }) => {
  const sizeClasses = large ? "w-12 h-12" : "w-6 h-6";
  const positionClasses = large 
    ? {
        s1: "w-8 h-8 text-purple-400 absolute -top-2 -left-2 sparkle-animation",
        s2: "w-12 h-12 text-pink-400 sparkle-animation [animation-delay:-0.2s]",
        s3: "w-8 h-8 text-indigo-400 absolute -bottom-2 -right-2 sparkle-animation [animation-delay:-0.4s]"
      }
    : {
        s1: "w-5 h-5 text-purple-300 absolute -top-1 -left-1 sparkle-animation",
        s2: "w-6 h-6 text-pink-300 sparkle-animation [animation-delay:-0.2s]",
        s3: "w-5 h-5 text-indigo-300 absolute -bottom-1 -right-1 sparkle-animation [animation-delay:-0.4s]"
      };
      
  return (
    <div className={`relative flex items-center justify-center ${sizeClasses} ${className}`}>
      <SparkleIcon className={positionClasses.s1} />
      <SparkleIcon className={positionClasses.s2} />
      <SparkleIcon className={positionClasses.s3} />
    </div>
  );
};


const SendIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={`w-5 h-5 ${className}`}>
    <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
  </svg>
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
  const typingTimeoutRef = useRef<NodeJS.Timeout[]>([]); // To store typing timeouts


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
    } else {
      // API Key not available message is handled in the render logic
    }
    // Clear any pending typing timeouts when component unmounts or API key availability changes
    return () => {
        typingTimeoutRef.current.forEach(clearTimeout);
        typingTimeoutRef.current = [];
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKeyAvailable]);

  const handleSendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading || !chatSession) return;

    // Clear previous typing timeouts if any
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
    
    setIsLoading(false); // Hide loading dots

    const fullAiText = result.text;
    const aiMessageId = (Date.now() + 1).toString();

    // Add an initial empty message for AI to type into
    setMessages(prevMessages => [
      ...prevMessages,
      {
        id: aiMessageId,
        text: '', // Start with empty text
        sender: Sender.AI,
        timestamp: new Date(),
      },
    ]);

    // Type out the message
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
      }, i * 50); // Adjust typing speed (50ms per character)
      timeouts.push(timeout);
    }
    typingTimeoutRef.current = timeouts;
    
  }, [isLoading, chatSession]);

  const handleSuggestionClick = (prompt: string) => {
    handleSendMessage(prompt);
  };

  const isInitialScreen = messages.length === 0 || (messages.length === 1 && (messages[0].id === 'apikey_error' || messages[0].id === 'apisetup_error'));

  const renderMessageText = (text: string) => {
    const parts = text.split(/(\[.*?\]\(.*?\))/g);
    return parts.map((part, index) => {
      const match = part.match(/\[(.*?)\]\((.*?)\)/);
      if (match) {
        return (
          <a
            key={index}
            href={match[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-400 underline"
          >
            {match[1]}
          </a>
        );
      }
      return part.split('\n').map((line, i) => (
        <React.Fragment key={`${index}-${i}`}>
          {line}
          {i < part.split('\n').length - 1 && <br />}
        </React.Fragment>
      ));
    });
  };

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-gradient-to-br from-purple-50 via-pink-50 to-indigo-50 relative">
      
      {!isInitialScreen && (
        <div className="absolute top-6 left-6 z-20">
          <Logo />
        </div>
      )}

      {/* This is the intermediate container. */}
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
          // This is the direct message list container. Changed to flex-grow for better scrolling.
          <div className="w-full flex-grow overflow-y-auto space-y-4 pr-2 min-h-0"> 
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.sender === Sender.User ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[75%] p-3 rounded-2xl shadow ${
                    msg.sender === Sender.User
                      ? 'bg-phai-purple text-white rounded-br-none'
                      : 'bg-white text-gray-800 rounded-bl-none border border-gray-200'
                  }`}
                >
                  <p className={`text-xs font-medium mb-1 ${msg.sender === Sender.User ? 'text-purple-200 text-right' : 'text-phai-pink'}`}>
                    {msg.sender === Sender.User ? 'ME' : 'PHAI'}
                  </p>
                  <div className="text-sm whitespace-pre-wrap">{renderMessageText(msg.text)}</div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="max-w-[75%] p-3 rounded-2xl shadow bg-white text-gray-800 rounded-bl-none border border-gray-200">
                    <p className="text-xs font-medium mb-1 text-phai-pink">PHAI</p>
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
              disabled={isLoading || !chatSession} // isLoading also implies AI is typing if API call is done
            />
            <button
              type="submit"
              disabled={isLoading || !inputValue.trim() || !chatSession} // isLoading also implies AI is typing
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
