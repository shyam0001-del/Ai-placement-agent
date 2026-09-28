import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import ChatArea from './components/ChatArea';
import ChatInput from './components/ChatInput';
import { useChat } from './hooks/useChat';

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const {
    messages,
    isLoading,
    error,
    serverStatus,
    sendMessage,
    clearChat,
    retryLastMessage,
  } = useChat();

  const handleSend = () => {
    if (!inputValue.trim() || isLoading) return;
    const text = inputValue;
    setInputValue('');
    sendMessage(text);
  };

  const handleSelectPrompt = (promptText) => {
    sendMessage(promptText);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 font-sans text-slate-100">
      {/* Navigation / History Sidebar */}
      <Sidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        serverStatus={serverStatus}
        onNewChat={clearChat}
        onSelectPrompt={handleSelectPrompt}
      />

      {/* Main Chat Interface */}
      <main className="flex-1 flex flex-col min-w-0 h-full relative">
        <Header
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          serverStatus={serverStatus}
          onClearChat={clearChat}
          hasMessages={messages.length > 0}
        />

        <ChatArea
          messages={messages}
          isLoading={isLoading}
          error={error}
          onRetry={retryLastMessage}
          onSelectPrompt={handleSelectPrompt}
        />

        <ChatInput
          input={inputValue}
          setInput={setInputValue}
          onSend={handleSend}
          isLoading={isLoading}
        />
      </main>
    </div>
  );
}
