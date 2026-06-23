type TerminalDataCallback = (sessionId: string, data: string) => void;

const listeners = new Set<TerminalDataCallback>();
let cleanupIPCSubscription: (() => void) | null = null;

function ensureIPCSubscription(): void {
  if (cleanupIPCSubscription || !window.cliManagerAPI) {
    return;
  }

  cleanupIPCSubscription = window.cliManagerAPI.terminal.onData((sessionId, data) => {
    listeners.forEach((listener) => listener(sessionId, data));
  });
}

export function subscribeTerminalData(callback: TerminalDataCallback): () => void {
  ensureIPCSubscription();
  listeners.add(callback);

  return () => {
    listeners.delete(callback);
    if (listeners.size === 0 && cleanupIPCSubscription) {
      cleanupIPCSubscription();
      cleanupIPCSubscription = null;
    }
  };
}
