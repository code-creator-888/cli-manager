import type {
  AppNotification as SharedAppNotification,
  CLIStatus as SharedCLIStatus,
  CLIType as SharedCLIType,
  TerminalSession as SharedTerminalSession,
} from '../../shared/ipc';

export type {
  AppAPI,
  AppNotification,
  CLIConfig,
  CLIManagerAPI,
  ConfigFileCandidate,
  ConfigFileResult,
  CLIStatus,
  CLIType,
  ConfigAPI,
  Conversation,
  ConversationAPI,
  ConversationFilter,
  ConversationMessage,
  ConversationStats,
  ConversationWithMessages,
  StatusAPI,
  TerminalAPI,
  TerminalSession,
  NotificationType,
} from '../../shared/ipc';

// Store Types
export interface AppState {
  activeCLI: SharedCLIType;
  activeSessionId: string | null;
  sessions: Record<string, SharedTerminalSession>;
  statuses: Record<SharedCLIType, SharedCLIStatus | null>;
  notifications: SharedAppNotification[];

  setActiveCLI: (cli: SharedCLIType) => void;
  setActiveSession: (sessionId: string | null) => void;
  addSession: (session: SharedTerminalSession) => void;
  removeSession: (sessionId: string) => void;
  updateStatus: (cliType: SharedCLIType, status: SharedCLIStatus) => void;
  addNotification: (notification: Omit<SharedAppNotification, 'id' | 'createdAt'>) => string;
  removeNotification: (id: string) => void;
  removeConversationsForCLI: (cliType: SharedCLIType) => void;
}
