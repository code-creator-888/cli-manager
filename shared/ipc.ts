export type CLIType = 'claude' | 'copilot' | 'codex' | 'qoder';

export interface TerminalSession {
  id: string;
  cliType: CLIType;
  cliSessionId?: string;
  pid?: number;
  createdAt: Date;
  lastActivity: Date;
}

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

export interface CLIConfig {
  cliType: CLIType;
  configPath: string;
  config: Record<string, unknown>;
  envVars: Record<string, string>;
}

export interface Conversation {
  id: string;
  cliType: CLIType;
  sessionId: string;
  cliSessionId?: string;
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

export interface ConversationStats {
  total: number;
  claude: number;
  copilot: number;
  codex: number;
  qoder: number;
  favorites: number;
}

export type NotificationType = 'error' | 'success' | 'info';

export interface AppNotification {
  id: string;
  type: NotificationType;
  message: string;
  createdAt: number;
}

export interface ConversationWithMessages extends Conversation {
  messages: ConversationMessage[];
}

export type ActiveView = 'terminal' | 'conversation' | 'dashboard';

export interface AppAPI {
  quit: () => void;
}

export interface ClipboardAPI {
  readText: () => string;
  writeText: (text: string) => void;
  hasImage: () => boolean;
  saveImageToTemp: (cliType?: CLIType) => Promise<string | null>;
  saveImageDataToTemp: (cliType: CLIType, imageData: ArrayBuffer) => Promise<string | null>;
}

export interface TerminalCreateResult {
  sessionId: string;
  cliSessionId?: string;
}

export interface TerminalAPI {
  create: (cliType: CLIType) => Promise<TerminalCreateResult>;
  createResume: (cliType: CLIType, cliSessionId: string) => Promise<TerminalCreateResult>;
  write: (sessionId: string, data: string) => void;
  pasteClipboardImage: (sessionId: string, cliType: CLIType) => Promise<string | null>;
  pasteImageData: (sessionId: string, cliType: CLIType, imageData: ArrayBuffer) => Promise<string | null>;
  resize: (sessionId: string, cols: number, rows: number) => void;
  destroy: (sessionId: string) => void;
  onData: (callback: (sessionId: string, data: string) => void) => () => void;
  onExit: (callback: (sessionId: string, exitCode: number) => void) => () => void;
}

export interface StatusAPI {
  get: (cliType: CLIType) => Promise<CLIStatus>;
  checkAll: () => Promise<CLIStatus[]>;
}

export interface ConfigFileCandidate {
  path: string;
  exists: boolean;
}

export interface ConfigFileResult<T> {
  path: string;
  exists: boolean;
  candidates: ConfigFileCandidate[];
  content: T;
}

export interface ConfigAPI {
  get: (cliType: CLIType) => Promise<CLIConfig>;
  set: (cliType: CLIType, config: Record<string, unknown>) => Promise<void>;
  setEnvVar: (cliType: CLIType, key: string, value: string) => Promise<void>;
  deleteEnvVar: (cliType: CLIType, key: string) => Promise<void>;
  getSettings: () => Promise<ConfigFileResult<Record<string, unknown>>>;
  setSettings: (settings: Record<string, unknown>) => Promise<void>;
  getApps: () => Promise<ConfigFileResult<Record<string, unknown>>>;
  setApps: (apps: Record<string, unknown>) => Promise<void>;
  getCodexConfig: () => Promise<ConfigFileResult<string>>;
  setCodexConfig: (config: string) => Promise<void>;
  getQoderSettings: () => Promise<ConfigFileResult<Record<string, unknown>>>;
  setQoderSettings: (settings: Record<string, unknown>) => Promise<void>;
}

export interface ConversationAPI {
  create: (cliType: CLIType, sessionId: string, title?: string) => Promise<string>;
  get: (id: string) => Promise<Conversation | null>;
  getWithMessages: (id: string) => Promise<ConversationWithMessages | null>;
  list: (filter?: ConversationFilter) => Promise<Conversation[]>;
  addMessage: (conversationId: string, message: Omit<ConversationMessage, 'id' | 'conversationId' | 'timestamp'>) => Promise<string>;
  updateTitle: (id: string, title: string) => Promise<void>;
  delete: (id: string) => Promise<void>;
  deleteByCLI: (cliType: CLIType) => Promise<number>;
  toggleFavorite: (id: string) => Promise<void>;
  getMessages: (conversationId: string) => Promise<ConversationMessage[]>;
  getActiveForSession: (sessionId: string) => Promise<Conversation | null>;
  getStats: () => Promise<ConversationStats>;
  onCreated: (callback: (sessionId: string, conversationId: string) => void) => () => void;
  onMessage: (callback: (conversationId: string, message: ConversationMessage) => void) => () => void;
}

export interface CLIManagerAPI {
  app: AppAPI;
  clipboard: ClipboardAPI;
  terminal: TerminalAPI;
  status: StatusAPI;
  config: ConfigAPI;
  conversation: ConversationAPI;
}
