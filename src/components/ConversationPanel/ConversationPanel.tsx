import React, { useCallback, useState, useEffect, useRef } from 'react';
import { useAppStore } from '../../stores';
import { ConversationWithMessages } from '../../types';
import { MessageBubble } from './MessageBubble';

export const ConversationPanel: React.FC = () => {
  const { activeCLI, conversations, setActiveConversation, setConversations, removeConversation, setConversationMessages, addNotification } = useAppStore();

  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showFavorites, setShowFavorites] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<ConversationWithMessages | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const loadConversationsRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [search]);

  // Subscribe to conversation events
  useEffect(() => {
    if (!window.cliManagerAPI) return;

    const unsubscribeCreated = window.cliManagerAPI.conversation.onCreated(
      () => {
        // Reload conversations when a new one is created
        loadConversationsRef.current();
      }
    );

    const unsubscribeMessage = window.cliManagerAPI.conversation.onMessage(
      (conversationId, message) => {
        useAppStore.getState().addConversationMessage(conversationId, message);

        // If this is the selected conversation, update it
        if (useAppStore.getState().activeConversationId === conversationId) {
          setSelectedConversation(prev => prev ? {
            ...prev,
            messages: [...prev.messages, message],
            updatedAt: message.timestamp,
            messageCount: prev.messageCount + 1,
          } : null);
        }
      }
    );

    return () => {
      unsubscribeCreated();
      unsubscribeMessage();
    };
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedConversation?.messages]);

  const loadConversations = useCallback(async () => {
    if (!window.cliManagerAPI) return;
    setIsLoading(true);
    try {
      const result = await window.cliManagerAPI.conversation.list({
        cliType: activeCLI,
        search: debouncedSearch || undefined,
        favorites: showFavorites || undefined,
        limit: 50,
      });
      setConversations(result);
    } catch (e) {
      console.error('Failed to load conversations:', e);
      addNotification({
        type: 'error',
        message: `Failed to load conversations: ${e instanceof Error ? e.message : String(e)}`,
      });
    } finally {
      setIsLoading(false);
    }
  }, [activeCLI, debouncedSearch, showFavorites, setConversations, addNotification]);

  // Load conversations on mount and when filter changes
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    loadConversationsRef.current = loadConversations;
  }, [loadConversations]);

  const loadConversationDetails = async (id: string) => {
    if (!window.cliManagerAPI) return;
    try {
      const result = await window.cliManagerAPI.conversation.getWithMessages(id);
      if (result) {
        setSelectedConversation(result);
        setActiveConversation(id);
        setConversationMessages(id, result.messages);
      }
    } catch (e) {
      console.error('Failed to load conversation details:', e);
      addNotification({
        type: 'error',
        message: `Failed to load conversation details: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  };

  const toggleFavorite = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.cliManagerAPI) return;
    try {
      await window.cliManagerAPI.conversation.toggleFavorite(id);
      useAppStore.getState().updateConversation(id, { favorite: !conversations[id]?.favorite });
      if (selectedConversation?.id === id) {
        setSelectedConversation(prev => prev ? { ...prev, favorite: !prev.favorite } : null);
      }
    } catch (e) {
      console.error('Failed to toggle favorite:', e);
      addNotification({
        type: 'error',
        message: `Failed to update favorite: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  };

  const deleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.cliManagerAPI) return;
    try {
      await window.cliManagerAPI.conversation.delete(id);
      removeConversation(id);
      if (selectedConversation?.id === id) {
        setSelectedConversation(null);
        setActiveConversation(null);
      }
    } catch (e) {
      console.error('Failed to delete conversation:', e);
      addNotification({
        type: 'error',
        message: `Failed to delete conversation: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  };

  const formatDate = (date: Date) => {
    const d = new Date(date);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return d.toLocaleDateString([], { weekday: 'long' });
    } else {
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const conversationList = Object.values(conversations).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return (
    <div className="h-full flex bg-bg-primary">
      {/* Conversation List */}
      <div className={`flex flex-col border-r border-bg-tertiary ${selectedConversation ? 'w-80' : 'flex-1'}`}>
        {/* Search and Filter */}
        <div className="p-4 bg-bg-secondary border-b border-bg-tertiary">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <svg
                className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-text-secondary"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
              </svg>
              <input
                type="text"
                placeholder="Search conversations..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-bg-tertiary text-text-primary pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={() => setShowFavorites(!showFavorites)}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                showFavorites
                  ? 'bg-yellow-500/20 text-yellow-500'
                  : 'bg-bg-tertiary text-text-secondary hover:text-text-primary'
              }`}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
              </svg>
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-text-secondary">Loading conversations...</div>
            </div>
          ) : conversationList.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-text-secondary text-center p-4">
                {search || showFavorites
                  ? 'No matching conversations found'
                  : 'No conversations yet. Start a chat in the terminal to see your conversation history.'}
              </div>
            </div>
          ) : (
            <div className="divide-y divide-bg-tertiary">
              {conversationList.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => loadConversationDetails(conv.id)}
                  className={`p-4 hover:bg-bg-secondary/50 transition-colors cursor-pointer ${
                    selectedConversation?.id === conv.id ? 'bg-bg-secondary/70' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Favorite button */}
                    <button
                      onClick={(e) => toggleFavorite(conv.id, e)}
                      className={`mt-0.5 ${
                        conv.favorite
                          ? 'text-yellow-500'
                          : 'text-text-secondary hover:text-yellow-500'
                      }`}
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                      </svg>
                    </button>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-text-primary font-medium text-sm truncate">
                          {conv.title || 'Untitled Conversation'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-text-secondary">
                        <span>{formatDate(conv.updatedAt)}</span>
                        <span>•</span>
                        <span>{conv.messageCount} messages</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <button
                      onClick={(e) => deleteConversation(conv.id, e)}
                      className="text-text-secondary hover:text-red-500 p-1"
                      title="Delete"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Conversation Detail */}
      {selectedConversation && (
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="p-4 bg-bg-secondary border-b border-bg-tertiary">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-text-primary">
                {selectedConversation.title || 'Untitled Conversation'}
              </h2>
              <button
                onClick={() => {
                  setSelectedConversation(null);
                  setActiveConversation(null);
                }}
                className="text-text-secondary hover:text-text-primary p-1"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                </svg>
              </button>
            </div>
            <div className="flex items-center gap-4 mt-2 text-xs text-text-secondary">
              <span>
                Created: {new Date(selectedConversation.createdAt).toLocaleString()}
              </span>
              <span>
                {selectedConversation.messages.length} messages
              </span>
              <button
                onClick={(e) => toggleFavorite(selectedConversation.id, e)}
                className={`flex items-center gap-1 ${
                  selectedConversation.favorite
                    ? 'text-yellow-500'
                    : 'text-text-secondary hover:text-yellow-500'
                }`}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                </svg>
                {selectedConversation.favorite ? 'Favorited' : 'Add to favorites'}
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {selectedConversation.messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-text-secondary">No messages in this conversation</div>
              </div>
            ) : (
              selectedConversation.messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
      )}
    </div>
  );
};
