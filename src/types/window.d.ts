import { CLIStatus, CLIConfig, Conversation, ConversationMessage, ConversationFilter, ConversationWithMessages } from './index';

declare global {
  interface Window {
    cliManagerAPI: {
      terminal: {
        create: (cliType: 'claude' | 'copilot' | 'codex' | 'qoder') => Promise<string>;
        write: (sessionId: string, data: string) => void;
        resize: (sessionId: string, cols: number, rows: number) => void;
        destroy: (sessionId: string) => void;
        onData: (callback: (sessionId: string, data: string) => void) => () => void;
        onExit: (callback: (sessionId: string, exitCode: number) => void) => () => void;
      };
      status: {
        get: (cliType: 'claude' | 'copilot' | 'codex' | 'qoder') => Promise<CLIStatus>;
        checkAll: () => Promise<CLIStatus[]>;
      };
      config: {
        get: (cliType: 'claude' | 'copilot' | 'codex' | 'qoder') => Promise<CLIConfig>;
        set: (cliType: 'claude' | 'copilot' | 'codex' | 'qoder', config: Record<string, unknown>) => Promise<void>;
        setEnvVar: (cliType: 'claude' | 'copilot' | 'codex' | 'qoder', key: string, value: string) => Promise<void>;
        deleteEnvVar: (cliType: 'claude' | 'copilot' | 'codex' | 'qoder', key: string) => Promise<void>;
        // Settings.json for Claude
        getSettings: () => Promise<{ path: string; content: Record<string, unknown> }>;
        setSettings: (settings: Record<string, unknown>) => Promise<void>;
        // Apps.json for Copilot
        getApps: () => Promise<{ path: string; content: Record<string, unknown> }>;
        setApps: (apps: Record<string, unknown>) => Promise<void>;
        // Config.toml for Codex
        getCodexConfig: () => Promise<{ path: string; content: string }>;
        setCodexConfig: (config: string) => Promise<void>;
        // Settings.json for Qoder
        getQoderSettings: () => Promise<{ path: string; content: Record<string, unknown> }>;
        setQoderSettings: (settings: Record<string, unknown>) => Promise<void>;
      };
      conversation: {
        create: (cliType: 'claude' | 'copilot' | 'codex' | 'qoder', sessionId: string, title?: string) => Promise<string>;
        get: (id: string) => Promise<Conversation | null>;
        getWithMessages: (id: string) => Promise<ConversationWithMessages | null>;
        list: (filter?: ConversationFilter) => Promise<Conversation[]>;
        addMessage: (conversationId: string, message: Omit<ConversationMessage, 'id' | 'conversationId' | 'timestamp'>) => Promise<string>;
        updateTitle: (id: string, title: string) => Promise<void>;
        delete: (id: string) => Promise<void>;
        toggleFavorite: (id: string) => Promise<void>;
        getMessages: (conversationId: string) => Promise<ConversationMessage[]>;
        getActiveForSession: (sessionId: string) => Promise<Conversation | null>;
        onCreated: (callback: (sessionId: string, conversationId: string) => void) => () => void;
        onMessage: (callback: (conversationId: string, message: ConversationMessage) => void) => () => void;
      };
    };
  }
}

export {};