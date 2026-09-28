import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot, User, Copy, Check, AlertCircle, Sparkles } from 'lucide-react';

function getFriendlyToolName(name) {
  switch (name) {
    case 'get_user_profile':
      return 'Checked candidate profile';
    case 'get_user_progress':
      return 'Analyzed preparation progress';
    case 'update_user_progress':
      return 'Updated study progress';
    default:
      return 'Consulted preparation co-pilot tool';
  }
}

export default function ChatMessage({ message }) {
  const isUser = message.role === 'user';
  const isError = message.isError;
  const toolCalls = Array.isArray(message.toolCalls) ? message.toolCalls : [];
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`group w-full py-4 px-4 sm:px-6 transition-colors ${
        isUser
          ? 'bg-slate-950/40'
          : isError
          ? 'bg-rose-950/20 border-y border-rose-900/30'
          : 'bg-slate-900/40 border-y border-slate-900/80'
      }`}
    >
      <div className="max-w-3xl mx-auto flex gap-3.5 sm:gap-4 items-start">
        {/* Avatar */}
        <div
          className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center shadow-sm text-xs font-semibold ${
            isUser
              ? 'bg-gradient-to-tr from-slate-700 to-slate-600 text-slate-100 ring-1 ring-slate-600'
              : isError
              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              : 'bg-gradient-to-tr from-indigo-600 to-cyan-500 text-white ring-1 ring-cyan-400/30'
          }`}
        >
          {isUser ? (
            <User className="w-4 h-4" />
          ) : isError ? (
            <AlertCircle className="w-4 h-4" />
          ) : (
            <Bot className="w-4 h-4" />
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-200">
                {isUser ? 'You' : 'AI Placement Agent'}
              </span>
              {message.model && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700/60">
                  {message.model}
                </span>
              )}
              {message.timestamp && (
                <span className="text-[11px] text-slate-400 font-mono">{message.timestamp}</span>
              )}
            </div>

            {/* Copy button */}
            <button
              onClick={handleCopy}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-400 hover:text-slate-200 rounded hover:bg-slate-800 cursor-pointer text-xs flex items-center gap-1"
              title="Copy message"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[10px] text-emerald-400">Copied</span>
                </>
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          {/* Optional Tool Activity Badges (Section 14) */}
          {toolCalls.length > 0 && (
            <div className="flex flex-wrap gap-1.5 my-2">
              {toolCalls.map((t, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-slate-800/80 border border-slate-700 text-cyan-300 font-medium"
                >
                  <Sparkles className="w-3 h-3 text-cyan-400" />
                  <span>{getFriendlyToolName(t.name)}</span>
                </span>
              ))}
            </div>
          )}

          {/* Render Markdown or plain text */}
          <div className="prose-chat text-sm break-words">
            {isUser ? (
              <p className="whitespace-pre-wrap text-slate-100">{message.content}</p>
            ) : (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
