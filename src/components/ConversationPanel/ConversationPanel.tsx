import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { useAppStore } from '../../stores';
import type { CLIType, Conversation } from '../../types';
import { getCLILabel, getCLIBadgeClass } from '../../utils/cliUtils';

export const ConversationPanel: React.FC = () => {
  const { activeCLI, conversations, sessions, setActiveConversation, setConversations, appendConversations, removeConversation, removeConversationsForCLI, addNotification, addSession, setActiveCLI, setActiveSession, setActiveView } = useAppStore();

  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showFavorites, setShowFavorites] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loadConversationsRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setActiveConversation(null);
  }, [activeCLI, setActiveConversation]);

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
      }
    );

    return () => {
      unsubscribeCreated();
      unsubscribeMessage();
    };
  }, []);

  const loadConversations = useCallback(async () => {
    if (!window.cliManagerAPI) return;
    setIsLoading(true);
    setOffset(0);
    setHasMore(false);
    try {
      const result = await window.cliManagerAPI.conversation.list({
        cliType: activeCLI,
        search: debouncedSearch || undefined,
        favorites: showFavorites || undefined,
        limit: 50,
        offset: 0,
      });
      setConversations(result);
      setHasMore(result.length === 50);
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

  const resumeConversation = async (cliType: CLIType, cliSessionId: string | undefined) => {
    if (!cliSessionId) {
      addNotification({
        type: 'info',
        message: '此对话创建时尚未记录 CLI session，无法恢复上下文。',
      });
      return;
    }

    if (!window.cliManagerAPI) return;

    const existingSession = Object.values(sessions).find(
      s => s.cliType === cliType && s.cliSessionId === cliSessionId
    );

    if (existingSession) {
      setActiveCLI(cliType);
      setActiveSession(existingSession.id);
      setActiveView('terminal');
      return;
    }

    try {
      const { sessionId, cliSessionId: resumedCLISessionId } = await window.cliManagerAPI.terminal.createResume(cliType, cliSessionId);
      addSession({
        id: sessionId,
        cliType,
        cliSessionId: resumedCLISessionId,
        createdAt: new Date(),
        lastActivity: new Date(),
      });
      setActiveCLI(cliType);
      setActiveSession(sessionId);
      setActiveView('terminal');
    } catch (e) {
      addNotification({
        type: 'error',
        message: `Failed to resume session: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  };

  const toggleFavorite = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.cliManagerAPI) return;
    try {
      await window.cliManagerAPI.conversation.toggleFavorite(id);
      useAppStore.getState().updateConversation(id, { favorite: !conversations[id]?.favorite });
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
    if (!window.confirm('Delete this conversation?')) return;
    if (!window.cliManagerAPI) return;
    try {
      await window.cliManagerAPI.conversation.delete(id);
      removeConversation(id);
    } catch (e) {
      console.error('Failed to delete conversation:', e);
      addNotification({
        type: 'error',
        message: `Failed to delete conversation: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  };

  const clearCurrentCLIConversations = async () => {
    if (!window.cliManagerAPI || isClearing) return;

    const label = getCLILabel(activeCLI);
    const confirmed = typeof window.confirm === 'function'
      ? window.confirm(`Clear all non-favorite ${label} conversations? This cannot be undone.`)
      : true;

    if (!confirmed) {
      return;
    }

    setIsClearing(true);
    try {
      const deletedCount = await window.cliManagerAPI.conversation.deleteByCLI(activeCLI);
      removeConversationsForCLI(activeCLI);
      setActiveConversation(null);
      addNotification({
        type: 'success',
        message: `Cleared ${deletedCount} ${label} conversation${deletedCount === 1 ? '' : 's'}.`,
      });
      await loadConversations();
    } catch (e) {
      console.error('Failed to clear conversations:', e);
      addNotification({
        type: 'error',
        message: `Failed to clear ${label} conversations: ${e instanceof Error ? e.message : String(e)}`,
      });
    } finally {
      setIsClearing(false);
    }
  };

  const loadMore = useCallback(async () => {
    if (!window.cliManagerAPI || isLoadingMore || !hasMore) return;
    const nextOffset = offset + 50;
    setIsLoadingMore(true);
    try {
      const result = await window.cliManagerAPI.conversation.list({
        cliType: activeCLI,
        search: debouncedSearch || undefined,
        favorites: showFavorites || undefined,
        limit: 50,
        offset: nextOffset,
      });
      appendConversations(result);
      setOffset(nextOffset);
      setHasMore(result.length === 50);
    } catch (e) {
      addNotification({
        type: 'error',
        message: `Failed to load more: ${e instanceof Error ? e.message : String(e)}`,
      });
    } finally {
      setIsLoadingMore(false);
    }
  }, [activeCLI, debouncedSearch, showFavorites, offset, hasMore, isLoadingMore, appendConversations, addNotification]);

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

  const conversationList = useMemo(
    () =>
      Object.values(conversations).sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      ),
    [conversations]
  );

  const favoriteConversations = useMemo(
    () => conversationList.filter((conv) => conv.favorite),
    [conversationList]
  );

  const normalConversations = useMemo(
    () => conversationList.filter((conv) => !conv.favorite),
    [conversationList]
  );

  const renderConversationItem = (conv: Conversation) => (
    <div
      key={conv.id}
      className="p-4"
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
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${getCLIBadgeClass(conv.cliType)}`}>
              {getCLILabel(conv.cliType)}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <span>{formatDate(conv.updatedAt)}</span>
            <span>•</span>
            <span>{conv.messageCount} messages</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); resumeConversation(conv.cliType, conv.cliSessionId); }}
            disabled={!conv.cliSessionId}
            className={`p-1 ${
              conv.cliSessionId
                ? 'text-text-secondary hover:text-blue-400'
                : 'cursor-not-allowed text-text-secondary/40'
            }`}
            title={conv.cliSessionId ? '继续对话（恢复上下文）' : '无法恢复上下文：缺少 CLI session'}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="m7 10 3 2-3 2" />
              <path d="M13 15h5" />
            </svg>
          </button>
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
    </div>
  );

  return (
    <div className="h-full flex bg-bg-primary">
      {/* Conversation List */}
      <div className="flex flex-col border-r border-bg-tertiary flex-1">
        {/* Search and Filter */}
        <div className="p-4 bg-bg-secondary border-b border-bg-tertiary">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-medium text-text-primary">{getCLILabel(activeCLI)} Conversations</h2>
              <p className="text-xs text-text-secondary">History is scoped to the active CLI.</p>
            </div>
            <button
              onClick={clearCurrentCLIConversations}
              disabled={isClearing || normalConversations.length === 0}
              className="rounded-lg border border-red-500/40 px-3 py-1.5 text-xs text-red-300 transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isClearing ? 'Clearing...' : `Clear ${getCLILabel(activeCLI)}`}
            </button>
          </div>
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
                className="w-full bg-bg-tertiary text-text-primary pl-10 pr-9 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
                  title="Clear search"
                >
                  ×
                </button>
              )}
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
          {!isLoading && conversationList.length > 0 && (
            <div className="border-b border-bg-tertiary px-4 py-2 text-xs text-text-secondary">
              {conversationList.length} conversation{conversationList.length === 1 ? '' : 's'}
              {debouncedSearch ? ` matching "${debouncedSearch}"` : ''}
            </div>
          )}
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
              {favoriteConversations.length > 0 && (
                <div className="px-4 pt-3 pb-1 text-xs font-medium text-text-secondary">
                  Favorites ({favoriteConversations.length})
                </div>
              )}
              {favoriteConversations.map(renderConversationItem)}
              {normalConversations.length > 0 && (
                <div className="px-4 pt-3 pb-1 text-xs font-medium text-text-secondary">
                  All ({normalConversations.length})
                </div>
              )}
              {normalConversations.map(renderConversationItem)}
            </div>
          )}
          {hasMore && (
            <div className="p-4 flex justify-center border-t border-bg-tertiary">
              <button
                onClick={loadMore}
                disabled={isLoadingMore}
                className="px-4 py-2 rounded-lg bg-bg-secondary text-text-secondary hover:text-text-primary hover:bg-bg-tertiary text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoadingMore ? 'Loading...' : 'Load more'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
