
import React from 'react';
import ChatInterface from './components/ChatInterface';
import './App.css';

function App() {
  // Simple check for API key availability - you'll need to set this up properly
  const apiKeyAvailable = !!(window as any).API_KEY || !!import.meta.env.VITE_API_KEY;

  return (
    <div className="App h-screen flex flex-col">
      <ChatInterface apiKeyAvailable={apiKeyAvailable} />
    </div>
  );
}

export default App;
