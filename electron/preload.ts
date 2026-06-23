import { clipboard, contextBridge, ipcRenderer } from 'electron';
import type { CLIManagerAPI, CLIType, ConversationFilter, ConversationMessage } from '../shared/ipc';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
const api: CLIManagerAPI = {
  app: {
    quit: () => ipcRenderer.send('app:quit'),
  },

  clipboard: {
    readText: () => clipboard.readText(),
    writeText: (text: string) => clipboard.writeText(text),
  },

  // Terminal operations
  terminal: {
    create: (cliType: CLIType) =>
      ipcRenderer.invoke('terminal:create', cliType),

    write: (sessionId: string, data: string) =>
      ipcRenderer.send('terminal:write', sessionId, data),

    resize: (sessionId: string, cols: number, rows: number) =>
      ipcRenderer.send('terminal:resize', sessionId, cols, rows),

    destroy: (sessionId: string) =>
      ipcRenderer.send('terminal:destroy', sessionId),

    onData: (callback: (sessionId: string, data: string) => void) => {
      const handler = (_: unknown, sessionId: string, data: string) => callback(sessionId, data);
      ipcRenderer.on('terminal:data', handler);
      return () => ipcRenderer.removeListener('terminal:data', handler);
    },

    onExit: (callback: (sessionId: string, exitCode: number) => void) => {
      const handler = (_: unknown, sessionId: string, exitCode: number) => callback(sessionId, exitCode);
      ipcRenderer.on('terminal:exit', handler);
      return () => ipcRenderer.removeListener('terminal:exit', handler);
    },
  },

  // Status monitoring
  status: {
    get: (cliType: CLIType) =>
      ipcRenderer.invoke('status:get', cliType),

    checkAll: () =>
      ipcRenderer.invoke('status:checkAll'),
  },

  // Configuration management
  config: {
    get: (cliType: CLIType) =>
      ipcRenderer.invoke('config:get', cliType),

    set: (cliType: CLIType, config: Record<string, unknown>) =>
      ipcRenderer.invoke('config:set', cliType, config),

    setEnvVar: (cliType: CLIType, key: string, value: string) =>
      ipcRenderer.invoke('config:setEnvVar', cliType, key, value),

    deleteEnvVar: (cliType: CLIType, key: string) =>
      ipcRenderer.invoke('config:deleteEnvVar', cliType, key),

    // Settings.json for Claude
    getSettings: () =>
      ipcRenderer.invoke('config:getSettings'),

    setSettings: (settings: Record<string, unknown>) =>
      ipcRenderer.invoke('config:setSettings', settings),

    // Apps.json for Copilot
    getApps: () =>
      ipcRenderer.invoke('config:getApps'),

    setApps: (apps: Record<string, unknown>) =>
      ipcRenderer.invoke('config:setApps', apps),

    // Config.toml for Codex
    getCodexConfig: () =>
      ipcRenderer.invoke('config:getCodexConfig'),

    setCodexConfig: (content: string) =>
      ipcRenderer.invoke('config:setCodexConfig', content),

    // Settings.json for Qoder
    getQoderSettings: () =>
      ipcRenderer.invoke('config:getQoderSettings'),

    setQoderSettings: (settings: Record<string, unknown>) =>
      ipcRenderer.invoke('config:setQoderSettings', settings),
  },

  // Conversation management
  conversation: {
    create: (cliType: CLIType, sessionId: string, title?: string) =>
      ipcRenderer.invoke('conversation:create', cliType, sessionId, title),

    get: (id: string) =>
      ipcRenderer.invoke('conversation:get', id),

    getWithMessages: (id: string) =>
      ipcRenderer.invoke('conversation:getWithMessages', id),

    list: (filter?: ConversationFilter) =>
      ipcRenderer.invoke('conversation:list', filter),

    addMessage: (conversationId: string, message: Omit<ConversationMessage, 'id' | 'conversationId' | 'timestamp'>) =>
      ipcRenderer.invoke('conversation:addMessage', conversationId, message),

    updateTitle: (id: string, title: string) =>
      ipcRenderer.invoke('conversation:updateTitle', id, title),

    delete: (id: string) =>
      ipcRenderer.invoke('conversation:delete', id),

    deleteByCLI: (cliType: CLIType) =>
      ipcRenderer.invoke('conversation:deleteByCLI', cliType),

    toggleFavorite: (id: string) =>
      ipcRenderer.invoke('conversation:toggleFavorite', id),

    getMessages: (conversationId: string) =>
      ipcRenderer.invoke('conversation:getMessages', conversationId),

    getActiveForSession: (sessionId: string) =>
      ipcRenderer.invoke('conversation:getActiveForSession', sessionId),

    getStats: () =>
      ipcRenderer.invoke('conversation:getStats'),

    onCreated: (callback: (sessionId: string, conversationId: string) => void) => {
      const handler = (_: unknown, sessionId: string, conversationId: string) => callback(sessionId, conversationId);
      ipcRenderer.on('conversation:created', handler);
      return () => ipcRenderer.removeListener('conversation:created', handler);
    },

    onMessage: (callback: (conversationId: string, message: ConversationMessage) => void) => {
      const handler = (_: unknown, conversationId: string, message: ConversationMessage) => callback(conversationId, message);
      ipcRenderer.on('conversation:message', handler);
      return () => ipcRenderer.removeListener('conversation:message', handler);
    },
  },
};

contextBridge.exposeInMainWorld('cliManagerAPI', api);
