// CLI Types
export type CLIType = 'claude' | 'copilot' | 'codex';

// Terminal Types
export interface TerminalSession {
  id: string;
  cliType: CLIType;
  pid?: number;
  createdAt: Date;
  lastActivity: Date;
}

// CLI Status Types
export interface CLIStatus {
  cliType: CLIType;
  installed: boolean;
  version: string | null;
  running: boolean;
  pid?: number;
  cpuUsage?: number;
  memoryUsage?: number;
  lastChecked: Date;
}

// Config Types
export interface CLIConfig {
  cliType: CLIType;
  configPath: string;
  config: Record<string, unknown>;
  envVars: Record<string, string>;
}

// Conversation Types
export interface Conversation {
  id: string;
  cliType: CLIType;
  sessionId: string;
  title?: string;
  createdAt: Date;
  updatedAt: Date;
  messageCount: number;
  favorite: boolean;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: Date;
  metadata?: {
    toolName?: string;
    toolArgs?: Record<string, unknown>;
    toolResult?: string;
  };
}

export interface ConversationFilter {
  cliType?: CLIType;
  sessionId?: string;
  search?: string;
  favorites?: boolean;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface ConversationWithMessages extends Conversation {
  messages: ConversationMessage[];
}

// IPC API Types
export interface TerminalAPI {
  create: (cliType: CLIType) => Promise<string>;
  write: (sessionId: string, data: string) => void;
  resize: (sessionId: string, cols: number, rows: number) => void;
  destroy: (sessionId: string) => void;
  onData: (callback: (sessionId: string, data: string) => void) => () => void;
}

export interface StatusAPI {
  get: (cliType: CLIType) => Promise<CLIStatus>;
  subscribe: (callback: (status: CLIStatus) => void) => () => void;
  checkAll: () => Promise<CLIStatus[]>;
}

export interface ConfigAPI {
  get: (cliType: CLIType) => Promise<CLIConfig>;
  set: (cliType: CLIType, config: Partial<CLIConfig['config']>) => Promise<void>;
  setEnvVar: (cliType: CLIType, key: string, value: string) => Promise<void>;
  deleteEnvVar: (cliType: CLIType, key: string) => Promise<void>;
}

export interface ConversationAPI {
  create: (cliType: CLIType, sessionId: string, title?: string) => Promise<string>;
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
}

// Store Types
export interface AppState {
  activeCLI: CLIType;
  activeSessionId: string | null;
  sessions: Record<string, TerminalSession>;
  statuses: Record<CLIType, CLIStatus | null>;

  setActiveCLI: (cli: CLIType) => void;
  setActiveSession: (sessionId: string | null) => void;
  addSession: (session: TerminalSession) => void;
  removeSession: (sessionId: string) => void;
  updateStatus: (cliType: CLIType, status: CLIStatus) => void;
}
