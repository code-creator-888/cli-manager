import React from 'react';
import { ConversationMessage } from '../../types';

interface MessageBubbleProps {
  message: ConversationMessage;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const { role, content, metadata } = message;

  const renderContent = (text: string) => {
    // Detect and render code blocks
    const parts: React.ReactNode[] = [];
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;
    let key = 0;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      // Add text before code block
      if (match.index > lastIndex) {
        parts.push(
          <span key={key++} className="whitespace-pre-wrap">
            {text.substring(lastIndex, match.index)}
          </span>
        );
      }

      // Add code block
      const language = match[1] || '';
      const code = match[2];
      parts.push(
        <pre key={key++} className="my-2 p-3 bg-bg-tertiary rounded-lg overflow-x-auto">
          <code className="text-sm font-mono text-text-primary">
            {code}
          </code>
        </pre>
      );

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(
        <span key={key++} className="whitespace-pre-wrap">
          {text.substring(lastIndex)}
        </span>
      );
    }

    return parts.length > 0 ? parts : <span className="whitespace-pre-wrap">{text}</span>;
  };

  const roleStyles = {
    user: 'bg-blue-500/20 border-blue-500/30',
    assistant: 'bg-green-500/20 border-green-500/30',
    tool: 'bg-purple-500/20 border-purple-500/30',
  };

  const roleIcons = {
    user: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
      </svg>
    ),
    assistant: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
      </svg>
    ),
    tool: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z" />
      </svg>
    ),
  };

  const roleLabels = {
    user: 'You',
    assistant: 'Assistant',
    tool: metadata?.toolName || 'Tool',
  };

  return (
    <div className={`p-3 rounded-lg border ${roleStyles[role]}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-text-secondary">
          {roleIcons[role]}
        </span>
        <span className="text-sm font-medium text-text-primary">
          {roleLabels[role]}
        </span>
        <span className="text-xs text-text-secondary ml-auto">
          {new Date(message.timestamp).toLocaleTimeString()}
        </span>
      </div>
      <div className="text-text-primary text-sm">
        {renderContent(content)}
      </div>
      {metadata?.toolResult && (
        <details className="mt-2">
          <summary className="text-text-secondary text-xs cursor-pointer hover:text-text-primary">
            Tool Result
          </summary>
          <pre className="mt-1 p-2 bg-bg-tertiary rounded text-xs overflow-x-auto max-h-48">
            {metadata.toolResult}
          </pre>
        </details>
      )}
    </div>
  );
};
