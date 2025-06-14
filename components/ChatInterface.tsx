
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Message, Sender, GroundingChunk, ChatSessionData } from '../types';
import { SUGGESTED_PROMPTS, CHAT_HISTORY_LOCAL_STORAGE_KEY } from '../constants';
import { startPhaiChat, sendPhaiMessage, convertMessagesToGeminiHistory } from '../services/geminiService';
import type { Chat, Content } from '@google/genai';

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

const HamburgerIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-6 h-6 ${className}`}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
  </svg>
);

const PlusIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-6 h-6 ${className}`}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
);


const ChatInterface: React.FC<ChatInterfaceProps> = ({ apiKeyAvailable }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatSession, setChatSession] = useState<Chat | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout[]>([]);
  const historySaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [chatHistory, setChatHistory] = useState<ChatSessionData[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Load chat history from localStorage on initial mount
  useEffect(() => {
    try {
      const storedHistory = localStorage.getItem(CHAT_HISTORY_LOCAL_STORAGE_KEY);
      if (storedHistory) {
        const parsedHistory: ChatSessionData[] = JSON.parse(storedHistory);
        // Ensure timestamps are Date objects
        parsedHistory.forEach(chat => {
          chat.messages.forEach(msg => msg.timestamp = new Date(msg.timestamp));
          chat.createdAt = new Date(chat.createdAt).toISOString(); // Ensure consistent ISO string format
        });
        setChatHistory(parsedHistory.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      }
    } catch (error) {
      console.error("Failed to load chat history from localStorage:", error);
      localStorage.removeItem(CHAT_HISTORY_LOCAL_STORAGE_KEY); // Clear corrupted data
    }
  }, []);

  // Save chat history to localStorage whenever it changes
  useEffect(() => {
    if (chatHistory.length > 0 || localStorage.getItem(CHAT_HISTORY_LOCAL_STORAGE_KEY)) { // only save if there's something to save or clear
        localStorage.setItem(CHAT_HISTORY_LOCAL_STORAGE_KEY, JSON.stringify(chatHistory));
    }
  }, [chatHistory]);


  const initializeNewChatSession = useCallback((history?: Content[]) => {
    if (!apiKeyAvailable) return;
    const session = startPhaiChat(history);
    setChatSession(session);
    if (!session && !messages.some(m => m.id === 'apisetup_error')) {
      setMessages(prev => [...prev, {id: 'apisetup_error', text: "Failed to initialize PHAI. Please check console for API key issues.", sender: Sender.AI, timestamp: new Date()}]);
    }
  }, [apiKeyAvailable, messages]);

  // Initialize a new chat session when API key is available and no chat is loaded
  useEffect(() => {
    if (apiKeyAvailable && !currentChatId && !chatSession) {
      initializeNewChatSession();
    }
     // Clear any pending timeouts when component unmounts or API key availability changes
    return () => {
        typingTimeoutRef.current.forEach(clearTimeout);
        typingTimeoutRef.current = [];
        if (historySaveTimeoutRef.current) {
            clearTimeout(historySaveTimeoutRef.current);
            historySaveTimeoutRef.current = null;
        }
    };
  }, [apiKeyAvailable, currentChatId, chatSession, initializeNewChatSession]);


  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(scrollToBottom, [messages]);


  const handleSendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading || !chatSession || !apiKeyAvailable) return;

    typingTimeoutRef.current.forEach(clearTimeout);
    typingTimeoutRef.current = [];
    if (historySaveTimeoutRef.current) {
        clearTimeout(historySaveTimeoutRef.current);
        historySaveTimeoutRef.current = null;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      text: text.trim(),
      sender: Sender.User,
      timestamp: new Date(),
    };

    // Add user message optimistically
    // If it's a new chat, messages will be empty (or error message), otherwise it's existing messages
    const updatedMessages = currentChatId ? messages.concat(userMessage) : [userMessage];
    setMessages(updatedMessages);

    setInputValue('');
    setIsLoading(true);

    const result = await sendPhaiMessage(chatSession, text.trim());
    setIsLoading(false);

    const fullAiText = result.text;
    const aiMessageId = (Date.now() + 1).toString();
    const aiMessageTimestamp = new Date();

    // Add an initial empty message for AI to type into
     const aiPlaceholderMessage: Message = {
      id: aiMessageId,
      text: '', // Start with empty text
      sender: Sender.AI,
      timestamp: aiMessageTimestamp,
      groundingChunks: result.groundingChunks, // Store them, even if not displayed
    };
    setMessages(prev => [...prev, aiPlaceholderMessage]);


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
      }, i * 30); // Typing speed
      timeouts.push(timeout);
    }
    typingTimeoutRef.current = timeouts;

    // Wait for typing animation to complete (or nearly complete) before saving history
    const typingDuration = fullAiText.length * 30;
    historySaveTimeoutRef.current = setTimeout(() => {
        const finalAiMessage: Message = { ...aiPlaceholderMessage, text: fullAiText };
        // At this point, `updatedMessages` contains only the user message if it was a new chat.
        // Or user message + previous messages if it was an existing chat.
        // `messages` state might have been updated by other effects or setMessages([]) if new chat was clicked.
        // We need to reliably get the messages *for this specific interaction*.

        // Reconstruct the message list that should be saved for this turn.
        // Start with the messages array as it was when the user sent their message, then add the AI's full response.
        let messagesForHistorySave: Message[];

        setMessages(prevMsgs => {
            // Find the AI placeholder and replace it with the final AI message
            const currentTurnMessages = prevMsgs.map(m => m.id === aiMessageId ? finalAiMessage : m);
            messagesForHistorySave = currentTurnMessages; // Capture for history saving

            if (!currentChatId) { // First exchange in a new chat
              const newId = Date.now().toString();
              const chatName = messagesForHistorySave[0]?.text.substring(0, 35) + (messagesForHistorySave[0]?.text.length > 35 ? "..." : "") || `Chat ${new Date(parseInt(newId)).toLocaleTimeString()}`;
              const newChatEntry: ChatSessionData = { 
                id: newId, 
                name: chatName, 
                messages: messagesForHistorySave, 
                createdAt: new Date().toISOString() 
              };
              setChatHistory(prevHistory => [newChatEntry, ...prevHistory.filter(c => c.id !== newId)].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
              setCurrentChatId(newId);
            } else { // Update existing chat
              setChatHistory(prevHistory => 
                prevHistory.map(chat => 
                  chat.id === currentChatId ? { ...chat, messages: messagesForHistorySave } : chat
                ).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              );
            }
            return currentTurnMessages; // Return the updated messages for the state
        });
        historySaveTimeoutRef.current = null; // Clear ref after execution
    }, typingDuration + 100);


  }, [isLoading, chatSession, apiKeyAvailable, messages, currentChatId]); // Added messages and currentChatId to dependencies for save logic

  const handleSuggestionClick = (prompt: string) => {
    // If it's the initial screen, messages are empty.
    // We want the suggestion to appear as the first user message.
    if (displayInitialScreen) {
        setMessages([]); // Clear any potential error messages
    }
    setInputValue(prompt);
    // Directly call handleSendMessage, it will manage messages state
    handleSendMessage(prompt);
  };

  const handleNewChat = () => {
    if (!apiKeyAvailable) return;

    // Clear any ongoing typing animations
    typingTimeoutRef.current.forEach(clearTimeout);
    typingTimeoutRef.current = [];

    // Clear any pending history save operations
    if (historySaveTimeoutRef.current) {
        clearTimeout(historySaveTimeoutRef.current);
        historySaveTimeoutRef.current = null;
    }

    setIsLoading(false); // Reset loading state
    setCurrentChatId(null);
    setMessages([]);
    setInputValue('');
    initializeNewChatSession(); // Fresh session
    setIsSidebarOpen(false);
  };

  const handleLoadChat = (chatIdToLoad: string) => {
    if (!apiKeyAvailable) return;

    // Clear any ongoing typing animations & pending saves from potentially active chat
    typingTimeoutRef.current.forEach(clearTimeout);
    typingTimeoutRef.current = [];
    if (historySaveTimeoutRef.current) {
        clearTimeout(historySaveTimeoutRef.current);
        historySaveTimeoutRef.current = null;
    }
    setIsLoading(false);

    const chatToLoad = chatHistory.find(c => c.id === chatIdToLoad);
    if (chatToLoad) {
      setCurrentChatId(chatIdToLoad);
      setMessages(chatToLoad.messages.map(m => ({...m, timestamp: new Date(m.timestamp)}))); 
      setInputValue('');
      const geminiHistory = convertMessagesToGeminiHistory(chatToLoad.messages);
      initializeNewChatSession(geminiHistory);
      setIsSidebarOpen(false);
    }
  };

  const displayInitialScreen = !currentChatId && messages.length === 0 && !isLoading ||
                               (messages.length === 1 && (messages[0].id === 'apikey_error' || messages[0].id === 'apisetup_error'));


  const renderMessageText = (text: string) => {
    const parts = text.split(/(\[.*?\]\(.*?\))/g); // Basic markdown link detection
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
      // Handle newlines
      return part.split('\n').map((line, i) => (
        <React.Fragment key={`${index}-${i}`}>
          {line}
          {i < part.split('\n').length - 1 && <br />}
        </React.Fragment>
      ));
    });
  };

  return (
    <div className="w-full h-full flex overflow-hidden bg-gradient-to-br from-purple-50 via-pink-50 to-indigo-50 relative">
      {/* Sidebar */}
      {apiKeyAvailable && (
        <div className={`fixed inset-y-0 left-0 z-30 w-72 bg-white/80 backdrop-blur-md shadow-lg transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} border-r border-purple-100 flex flex-col`}>
          <div className="p-4 border-b border-purple-200 flex items-center space-x-3">
            <Logo />
            <h2 className="text-xl font-semibold text-phai-purple">PHAI Chats</h2>
          </div>
          <button 
            onClick={handleNewChat}
            className="m-2 p-2.5 bg-gradient-to-r from-phai-purple to-phai-pink text-white rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center space-x-2 text-sm font-medium"
            aria-label="Start New Chat"
          >
            <PlusIcon className="w-5 h-5"/> 
            <span>New Chat</span>
          </button>
          <div className="flex-grow overflow-y-auto p-2 space-y-1">
            {chatHistory.map(chat => (
              <button
                key={chat.id}
                onClick={() => handleLoadChat(chat.id)}
                className={`w-full text-left p-2.5 rounded-md hover:bg-purple-100 transition-colors ${currentChatId === chat.id ? 'bg-phai-purple/20 text-phai-purple font-semibold' : 'text-gray-700'}`}
                aria-current={currentChatId === chat.id ? "page" : undefined}
              >
                <p className="text-sm truncate font-medium">{chat.name}</p>
                <p className="text-xs text-gray-500">{new Date(chat.createdAt).toLocaleDateString()} {new Date(chat.createdAt).toLocaleTimeString()}</p>
              </button>
            ))}
          </div>
        </div>
      )}
      {isSidebarOpen && <div className="fixed inset-0 z-20 bg-black/20" onClick={() => setIsSidebarOpen(false)}></div>}


      {/* Main Content */}
      <div className="flex-grow flex flex-col overflow-hidden min-h-0">
        {/* Header bar */}
        <div className="absolute top-0 left-0 right-0 p-3 sm:p-4 flex items-center justify-between z-20 pointer-events-none">
            <div className="flex items-center space-x-2 pointer-events-auto">
                {apiKeyAvailable && (
                    <button 
                        onClick={() => setIsSidebarOpen(prev => !prev)} 
                        className="p-2 text-gray-600 hover:text-phai-purple transition-colors"
                        aria-label={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
                        aria-expanded={isSidebarOpen}
                    >
                        <HamburgerIcon className="w-7 h-7" />
                    </button>
                )}
                {!displayInitialScreen && !isSidebarOpen && <Logo />}
            </div>

            {!displayInitialScreen && apiKeyAvailable && (
                 <button 
                    onClick={handleNewChat} 
                    className="p-2 text-gray-600 hover:text-phai-purple transition-colors pointer-events-auto"
                    aria-label="Start new chat"
                >
                    <PlusIcon className="w-7 h-7" />
                </button>
            )}
        </div>


        <div className={`flex-grow flex flex-col ${
            displayInitialScreen
              ? 'items-center justify-center p-6' 
              : 'items-stretch justify-start pt-20 px-4 sm:px-6 pb-4 sm:pb-6 overflow-hidden min-h-0' 
          } transition-all duration-300 ease-in-out`}
        >
          {displayInitialScreen ? (
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
            <div className="w-full flex-grow overflow-y-auto space-y-4 pr-1 sm:pr-2 min-h-0 scroll-smooth"> 
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === Sender.User ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[85%] sm:max-w-[75%] p-3 rounded-2xl shadow ${
                      msg.sender === Sender.User
                        ? 'bg-phai-purple text-white rounded-br-none'
                        : 'bg-white text-gray-800 rounded-bl-none border border-gray-200'
                    }`}
                  >
                    <p className={`text-xs font-medium mb-1 ${msg.sender === Sender.User ? 'text-purple-200 text-right' : 'text-phai-pink'}`}>
                      {msg.sender === Sender.User ? 'ME' : 'PHAI'}
                    </p>
                    <div className="text-sm whitespace-pre-wrap">{renderMessageText(msg.text)}</div>
                    {/* Grounding chunks display removed based on user request */}
                  </div>
                </div>
              ))}
              {isLoading && messages[messages.length-1]?.sender === Sender.User && ( 
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
          <div className="p-3 sm:p-4 bg-white/60 backdrop-blur-sm border-t border-purple-100 flex justify-center">
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
                placeholder="Ask PHAI anything..."
                className="flex-grow p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-phai-purple focus:border-transparent outline-none transition-shadow text-sm shadow-sm"
                disabled={isLoading || !chatSession || !apiKeyAvailable}
              />
              <button
                type="submit"
                disabled={isLoading || !inputValue.trim() || !chatSession || !apiKeyAvailable}
                className="p-3 bg-gradient-to-br from-phai-purple to-phai-pink text-white rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-phai-purple focus:ring-opacity-50 shadow-sm"
                aria-label="Send message"
              >
                <SendIcon />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatInterface;
