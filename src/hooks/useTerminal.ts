import { useCallback, useRef } from 'react';
import { useAppStore } from '../stores';

export const useTerminal = () => {
  const { activeCLI, activeSessionId, addSession, removeSession, sessions } = useAppStore();
  const isCreatingRef = useRef(false);

  const createSession = useCallback(async () => {
    if (!window.cliManagerAPI || isCreatingRef.current) return null;

    isCreatingRef.current = true;
    try {
      const sessionId = await window.cliManagerAPI.terminal.create(activeCLI);
      addSession({
        id: sessionId,
        cliType: activeCLI,
        createdAt: new Date(),
        lastActivity: new Date(),
      });
      return sessionId;
    } catch (error) {
      console.error('Failed to create terminal session:', error);
      return null;
    } finally {
      isCreatingRef.current = false;
    }
  }, [activeCLI, addSession]);

  const destroySession = useCallback(
    (sessionId: string) => {
      if (window.cliManagerAPI) {
        window.cliManagerAPI.terminal.destroy(sessionId);
      }
      removeSession(sessionId);
    },
    [removeSession]
  );

  const writeToTerminal = useCallback((sessionId: string, data: string) => {
    if (window.cliManagerAPI) {
      window.cliManagerAPI.terminal.write(sessionId, data);
    }
  }, []);

  const resizeTerminal = useCallback(
    (sessionId: string, cols: number, rows: number) => {
      if (window.cliManagerAPI) {
        window.cliManagerAPI.terminal.resize(sessionId, cols, rows);
      }
    },
    []
  );

  return {
    createSession,
    destroySession,
    writeToTerminal,
    resizeTerminal,
    activeSessionId,
    sessions,
  };
};
