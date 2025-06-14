import React, { useState, useEffect } from 'react';
import ChatInterface from './components/ChatInterface';

const App: React.FC = () => {
  const [apiKeyAvailable, setApiKeyAvailable] = useState(false);

  useEffect(() => {
    // Check for API key strictly from process.env.API_KEY as per guidelines.
    // Assume process.env.API_KEY is pre-configured and accessible.
    if (process.env.API_KEY) {
      setApiKeyAvailable(true);
    } else {
      console.warn("API_KEY is not available. Please ensure it is set in your environment (process.env.API_KEY).");
      setApiKeyAvailable(false);
    }
  }, []);

  return (
    <div className="flex-grow flex flex-col bg-slate-100"> {/* Removed items-center, justify-center, p-2 sm:p-4 */}
      <ChatInterface apiKeyAvailable={apiKeyAvailable} />
    </div>
  );
};

export default App;