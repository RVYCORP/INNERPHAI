
import React from 'react';
import ChatInterface from './components/ChatInterface';
import './App.css';

function App() {
  // Check for API key availability from environment
  const apiKeyAvailable = !!import.meta.env.VITE_API_KEY;

  return (
    <div className="App h-screen flex flex-col">
      <ChatInterface apiKeyAvailable={apiKeyAvailable} />
    </div>
  );
}

export default App;
