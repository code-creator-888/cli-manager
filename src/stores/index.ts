import { create } from 'zustand';
import { CLIType, TerminalSession, CLIStatus, Conversation, ConversationMessage } from '../types';

interface AppState {
  activeCLI: CLIType;
  activeSessionId: string | null;
  sessions: Record<string, TerminalSession>;
  statuses: Record<CLIType, CLIStatus | null>;

  // Conversation state
  activeConversationId: string | null;
  conversations: Record<string, Conversation>;
  conversationMessages: Record<string, ConversationMessage[]>;

  setActiveCLI: (cli: CLIType) => void;
  setActiveSession: (sessionId: string | null) => void;
  addSession: (session: TerminalSession) => void;
  removeSession: (sessionId: string) => void;
  updateStatus: (cliType: CLIType, status: CLIStatus) => void;
  getSessionsForCLI: (cli: CLIType) => TerminalSession[];

  // Conversation actions
  setActiveConversation: (conversationId: string | null) => void;
  setConversations: (conversations: Conversation[]) => void;
  addConversation: (conversation: Conversation) => void;
  updateConversation: (conversationId: string, updates: Partial<Conversation>) => void;
  removeConversation: (conversationId: string) => void;
  setConversationMessages: (conversationId: string, messages: ConversationMessage[]) => void;
  addConversationMessage: (conversationId: string, message: ConversationMessage) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  activeCLI: 'claude',
  activeSessionId: null,
  sessions: {},
  statuses: {
    claude: null,
    copilot: null,
    codex: null,
    qoder: null,
  },
  activeConversationId: null,
  conversations: {},
  conversationMessages: {},

  setActiveCLI: (cli) => {
    const state = get();
    // Find first session of the new CLI type
    const cliSessions = Object.values(state.sessions).filter(s => s.cliType === cli);
    set({
      activeCLI: cli,
      // Set activeSessionId to first session of new CLI type, or keep null
      activeSessionId: cliSessions.length > 0 ? cliSessions[0].id : null
    });
  },

  setActiveSession: (sessionId) => set({ activeSessionId: sessionId }),

  addSession: (session) =>
    set((state) => ({
      sessions: { ...state.sessions, [session.id]: session },
      activeSessionId: session.id,
    })),

  removeSession: (sessionId) =>
    set((state) => {
      const { [sessionId]: removed, ...remaining } = state.sessions;
      const remainingList = Object.values(remaining);

      let newActiveSessionId = state.activeSessionId;
      // If removed session was active, pick another
      if (state.activeSessionId === sessionId) {
        // Prefer a session of the same CLI type
        const sameCLI = remainingList.find(s => s.cliType === state.activeCLI);
        newActiveSessionId = sameCLI?.id || remainingList[0]?.id || null;
      }

      return {
        sessions: remaining,
        activeSessionId: newActiveSessionId,
      };
    }),

  updateStatus: (cliType, status) =>
    set((state) => ({
      statuses: { ...state.statuses, [cliType]: status },
    })),

  getSessionsForCLI: (cli) => {
    return Object.values(get().sessions).filter(s => s.cliType === cli);
  },

  // Conversation actions
  setActiveConversation: (conversationId) => set({ activeConversationId: conversationId }),

  setConversations: (conversations) =>
    set(() => ({
      conversations: conversations.reduce((acc, conv) => {
        acc[conv.id] = conv;
        return acc;
      }, {} as Record<string, Conversation>),
    })),

  addConversation: (conversation) =>
    set((state) => ({
      conversations: { ...state.conversations, [conversation.id]: conversation },
    })),

  updateConversation: (conversationId, updates) =>
    set((state) => {
      const existing = state.conversations[conversationId];
      if (!existing) return state;

      return {
        conversations: {
          ...state.conversations,
          [conversationId]: { ...existing, ...updates },
        },
      };
    }),

  removeConversation: (conversationId) =>
    set((state) => {
      const { [conversationId]: removed, ...remainingConversations } = state.conversations;
      const { [conversationId]: removedMessages, ...remainingMessages } = state.conversationMessages;

      return {
        conversations: remainingConversations,
        conversationMessages: remainingMessages,
        activeConversationId: state.activeConversationId === conversationId ? null : state.activeConversationId,
      };
    }),

  setConversationMessages: (conversationId, messages) =>
    set((state) => ({
      conversationMessages: { ...state.conversationMessages, [conversationId]: messages },
    })),

  addConversationMessage: (conversationId, message) =>
    set((state) => {
      const existing = state.conversationMessages[conversationId] || [];
      return {
        conversationMessages: {
          ...state.conversationMessages,
          [conversationId]: [...existing, message],
        },
      };
    }),
}));
