import React, { useCallback, useMemo, useEffect, useRef, useState } from 'react';
import { TerminalView } from './TerminalView';
import { useAppStore } from '../../stores';
import {
  canCreateTerminalSession,
  getTerminalSessionLimitMessage,
  MAX_TERMINAL_SESSIONS_PER_CLI,
} from '../../utils/sessionLimits';
import { formatFilePathForCLI } from '../../../shared/clipboard';
import type { CLIType } from '../../types';
import { getCLILabel, getCLIActiveClass } from '../../utils/cliUtils';

export const TerminalPanel: React.FC = () => {
  const { activeCLI, activeSessionId, addSession, removeSession, sessions, addNotification } = useAppStore();
  const isCreatingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dragCounterRef = useRef(0);

  // Get sessions for current CLI type
  const currentCLISessions = useMemo(() => {
    return Object.values(sessions).filter(s => s.cliType === activeCLI);
  }, [sessions, activeCLI]);

  // Get current active session for current CLI
  const currentSession = useMemo(() => {
    // First check if activeSessionId belongs to current CLI
    if (activeSessionId && sessions[activeSessionId]?.cliType === activeCLI) {
      return sessions[activeSessionId];
    }
    // Otherwise return first session of current CLI
    return currentCLISessions[0] || null;
  }, [activeSessionId, sessions, activeCLI, currentCLISessions]);

  // Create a new session
  const createSession = useCallback(async (cliType: CLIType) => {
    if (!window.cliManagerAPI || isCreatingRef.current) return;

    const freshSessions = useAppStore.getState().sessions;
    if (!canCreateTerminalSession(freshSessions, cliType)) {
      const message = getTerminalSessionLimitMessage(cliType);
      setError(message);
      addNotification({ type: 'error', message });
      return;
    }

    isCreatingRef.current = true;
    setError(null);
    try {
      const { sessionId, cliSessionId } = await window.cliManagerAPI.terminal.create(cliType);
      addSession({
        id: sessionId,
        cliType,
        cliSessionId,
        createdAt: new Date(),
        lastActivity: new Date(),
      });
    } catch (error) {
      console.error('Failed to create terminal session:', error);
      const message = error instanceof Error ? error.message : String(error);
      setError(message);
      addNotification({ type: 'error', message: `Failed to create terminal session: ${message}` });
    } finally {
      isCreatingRef.current = false;
    }
  }, [addSession, addNotification]);

  // Close a session
  const closeSession = useCallback((sessionId: string) => {
    const confirmed = typeof window.confirm === 'function'
      ? window.confirm('Close this terminal session? Running CLI work in this session will be stopped.')
      : true;

    if (!confirmed) {
      return;
    }

    if (window.cliManagerAPI) {
      window.cliManagerAPI.terminal.destroy(sessionId);
    }
    removeSession(sessionId);
  }, [removeSession]);

  // Listen for terminal exit
  useEffect(() => {
    if (!window.cliManagerAPI) return;
    const cleanup = window.cliManagerAPI.terminal.onExit((sessionId: string) => {
      removeSession(sessionId);
    });
    return cleanup;
  }, [removeSession]);

  // Ensure session exists when CLI changes or on mount
  const prevCLIRef = useRef(activeCLI);
  useEffect(() => {
    // Check if CLI changed
    const cliChanged = prevCLIRef.current !== activeCLI;
    prevCLIRef.current = activeCLI;

    // Get fresh state
    const freshState = useAppStore.getState();
    const freshSessions = Object.values(freshState.sessions).filter(s => s.cliType === activeCLI);

    if (freshSessions.length === 0) {
      // No session for this CLI, create one
      if (!isCreatingRef.current) {
        createSession(activeCLI);
      }
    } else if (cliChanged || !freshState.activeSessionId) {
      // CLI changed or no active session, select first session of current CLI
      useAppStore.getState().setActiveSession(freshSessions[0].id);
    }
  }, [activeCLI, createSession]);

  const handleTerminalData = useCallback((sessionId: string, data: string) => {
    window.cliManagerAPI?.terminal.write(sessionId, data);
  }, []);

  const handleResize = useCallback((sessionId: string, cols: number, rows: number) => {
    window.cliManagerAPI?.terminal.resize(sessionId, cols, rows);
  }, []);

  // Handle drag and drop
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;

    const files = e.dataTransfer.files;
    if (files.length > 0 && currentSession) {
      // Get file paths and write to terminal
      const paths: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        // On macOS, we need to handle the path properly
        const path = (file as any).path || file.name;
        paths.push(path);
      }

      // Write paths to terminal, separated by spaces
      const pathsString = paths.map(p => formatFilePathForCLI(currentSession.cliType, p)).join(' ');
      window.cliManagerAPI?.terminal.write(currentSession.id, pathsString);
    }
  }, [currentSession]);

  const reachedSessionLimit = currentCLISessions.length >= MAX_TERMINAL_SESSIONS_PER_CLI;

  return (
    <div
      className="flex flex-col bg-bg-primary relative"
      style={{ width: '100%', height: '100%', flex: 1 }}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* CLI Type Tabs */}
      <div className="flex bg-bg-secondary border-b border-bg-tertiary">
        <button
          onClick={() => useAppStore.getState().setActiveCLI('qoder')}
          className={`px-6 py-3 text-sm font-medium transition-colors ${
            activeCLI === 'qoder'
              ? getCLIActiveClass('qoder')
              : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
          }`}
        >
          {getCLILabel('qoder')}
        </button>
        <button
          onClick={() => useAppStore.getState().setActiveCLI('claude')}
          className={`px-6 py-3 text-sm font-medium transition-colors ${
            activeCLI === 'claude'
              ? getCLIActiveClass('claude')
              : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
          }`}
        >
          {getCLILabel('claude')}
        </button>
        <button
          onClick={() => useAppStore.getState().setActiveCLI('codex')}
          className={`px-6 py-3 text-sm font-medium transition-colors ${
            activeCLI === 'codex'
              ? getCLIActiveClass('codex')
              : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
          }`}
        >
          {getCLILabel('codex')}
        </button>
        <button
          onClick={() => useAppStore.getState().setActiveCLI('copilot')}
          className={`px-6 py-3 text-sm font-medium transition-colors ${
            activeCLI === 'copilot'
              ? getCLIActiveClass('copilot')
              : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
          }`}
        >
          {getCLILabel('copilot')}
        </button>
      </div>

      {/* Session Tabs for current CLI */}
      {currentCLISessions.length > 0 && (
        <div className="flex bg-bg-secondary border-b border-bg-tertiary overflow-x-auto">
          {currentCLISessions.map((session, index) => (
            <div
              key={session.id}
              className={`flex items-center gap-2 px-4 py-2 border-r border-bg-tertiary cursor-pointer ${
                currentSession?.id === session.id
                  ? 'bg-bg-primary text-text-primary'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
              }`}
              onClick={() => useAppStore.getState().setActiveSession(session.id)}
            >
              <span className="text-sm">Terminal {index + 1}</span>
              <button
                className="text-text-secondary hover:text-text-primary"
                onClick={(e) => {
                  e.stopPropagation();
                  closeSession(session.id);
                }}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                </svg>
              </button>
            </div>
          ))}
          <button
            onClick={() => createSession(activeCLI)}
            disabled={reachedSessionLimit}
            className={`px-3 py-2 ${
              reachedSessionLimit
                ? 'text-text-secondary/50 cursor-not-allowed'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
            }`}
            title={reachedSessionLimit ? getTerminalSessionLimitMessage(activeCLI) : 'New Terminal'}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
            </svg>
          </button>
        </div>
      )}

      {/* Terminal Content - render ALL sessions (both Claude and Copilot), hide inactive */}
      <div className="flex-1 relative" style={{ minHeight: 0 }}>
        {Object.values(sessions).map((session) => (
          <div
            key={session.id}
            className="absolute inset-0"
            style={{
              visibility: currentSession?.id === session.id ? 'visible' : 'hidden',
              pointerEvents: currentSession?.id === session.id ? 'auto' : 'none',
              zIndex: currentSession?.id === session.id ? 1 : 0,
            }}
          >
            <TerminalView
              sessionId={session.id}
              cliType={session.cliType}
              isActive={currentSession?.id === session.id}
              onData={(data) => handleTerminalData(session.id, data)}
              onResize={(cols, rows) => handleResize(session.id, cols, rows)}
            />
          </div>
        ))}

        {Object.keys(sessions).length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            {error ? (
              <div className="text-center p-4">
                <div className="text-red-500 mb-2">Failed to create terminal</div>
                <div className="text-text-secondary text-sm mb-4">{error}</div>
                <button
                  onClick={() => createSession(activeCLI)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                >
                  Retry
                </button>
              </div>
            ) : (
              <div className="text-text-secondary">Creating terminal...</div>
            )}
            {Object.keys(sessions).length > 0 && error && (
              <div className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-300 shadow-lg">
                {error}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 bg-bg-primary/80 flex items-center justify-center z-50 border-2 border-dashed border-claude-primary rounded-lg m-2">
          <div className="text-center">
            <svg className="w-16 h-16 mx-auto mb-4 text-claude-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <div className="text-text-primary text-lg font-medium">Drop files here</div>
            <div className="text-text-secondary text-sm mt-1">File path will be inserted into terminal</div>
          </div>
        </div>
      )}
    </div>
  );
};
