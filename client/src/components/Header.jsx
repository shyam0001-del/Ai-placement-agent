import React from 'react';
import { Menu, Sparkles, Trash2, AlertCircle } from 'lucide-react';

export default function Header({
  sidebarOpen,
  setSidebarOpen,
  serverStatus,
  onClearChat,
  hasMessages,
}) {
  const isAiReady = serverStatus?.aiReady;
  const configuredModel = serverStatus?.configuredModel || 'Not configured';

  return (
    <header className="h-16 border-b border-slate-850 bg-slate-900/60 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="md:hidden p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
          aria-label="Toggle sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs font-medium text-indigo-300">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>AI Placement Co-Pilot</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700/60 text-xs text-slate-300">
            <span className="text-slate-400">Model:</span>
            <span className="font-mono text-cyan-300 font-semibold">{configuredModel}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Readiness indicator */}
        <div
          className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${
            isAiReady
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
          }`}
          title={isAiReady ? 'AI Engine Ready' : 'API Key or Model missing in .env'}
        >
          {isAiReady ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="hidden sm:inline font-medium">Ready</span>
            </>
          ) : (
            <>
              <AlertCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline font-medium">Setup Required</span>
            </>
          )}
        </div>

        {/* Clear chat action */}
        {hasMessages && (
          <button
            onClick={onClearChat}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition cursor-pointer"
            title="Clear current conversation"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Clear Chat</span>
          </button>
        )}
      </div>
    </header>
  );
}
