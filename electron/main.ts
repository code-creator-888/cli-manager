import { app, BrowserWindow, ipcMain, Menu } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { TerminalService } from './services/terminal';
import { ClaudeCLIService } from './services/claude-cli';
import { CopilotCLIService } from './services/copilot-cli';
import { CodexCLIService } from './services/codex-cli';
import { QoderCLIService } from './services/qoder-cli';
import { ConfigService } from './services/config';
import { ConversationService, ConversationMessage, ConversationFilter } from './services/conversation';

let mainWindow: BrowserWindow | null = null;
let terminalService: TerminalService;
let claudeService: ClaudeCLIService;
let copilotService: CopilotCLIService;
let codexService: CodexCLIService;
let qoderService: QoderCLIService;
let configService: ConfigService;
let conversationService: ConversationService;
let isQuitting = false;

const devServerPort = process.env.CLI_MANAGER_DEV_PORT || '5173';
const devServerUrl = `http://localhost:${devServerPort}`;
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function getWindowIcon(): string | undefined {
  const iconPath = path.join(__dirname, '../assets/icon.png');
  return fs.existsSync(iconPath) ? iconPath : undefined;
}

function getCommandForCLI(cliType: 'claude' | 'copilot' | 'codex' | 'qoder'): string {
  const candidates = cliType === 'copilot'
    ? ['copilot', 'github-copilot-cli']
    : cliType === 'qoder'
    ? ['qodercli']
    : [cliType];

  const command = candidates.find((candidate) => terminalService.hasCommand(candidate));
  if (!command) {
    throw new Error(`${cliType} CLI is not installed or not available in PATH`);
  }

  return command;
}

function cleanupAppResources(): void {
  if (terminalService) {
    terminalService.destroyAll();
  }
  if (conversationService) {
    conversationService.close();
  }
}

function quitApp(exitAfterCleanup = true): void {
  if (isQuitting) {
    return;
  }

  isQuitting = true;
  cleanupAppResources();
  BrowserWindow.getAllWindows().forEach((window) => window.destroy());
  if (exitAfterCleanup) {
    app.exit(0);
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: 'CLI Manager',
    backgroundColor: '#1a1a2e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: getWindowIcon(),
  });

  if (isDev) {
    mainWindow.loadURL(devServerUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.on('close', (event) => {
    if (!isQuitting && process.platform === 'darwin') {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  // Prevent opening files dropped into the window
  mainWindow.webContents.on('will-navigate', (event, url) => {
    // Only prevent file:// URLs (dragged files)
    if (url.startsWith('file://')) {
      event.preventDefault();
    }
  });
}

function setupAppMenu(): void {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: app.name,
      submenu: [
        {
          label: '退出 CLI Manager',
          accelerator: 'CmdOrCtrl+Q',
          click: () => quitApp(),
        },
      ],
    },
  ]));
}

// Initialize services
async function initializeServices(): Promise<void> {
  const userDataPath = app.getPath('userData');

  // Ensure data directory exists
  const dataDir = path.join(userDataPath, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Initialize services
  conversationService = new ConversationService(path.join(dataDir, 'conversations.db'));
  configService = new ConfigService();
  terminalService = new TerminalService();
  claudeService = new ClaudeCLIService();
  copilotService = new CopilotCLIService();
  codexService = new CodexCLIService();
  qoderService = new QoderCLIService();

  await conversationService.initialize();
}

// Set up IPC handlers
function setupIPCHandlers(): void {
  ipcMain.on('app:quit', () => quitApp());

  // Terminal handlers
  ipcMain.handle('terminal:create', async (_, cliType: 'claude' | 'copilot' | 'codex' | 'qoder') => {
    const command = getCommandForCLI(cliType);
    return terminalService.createSession(command, cliType);
  });

  ipcMain.on('terminal:write', (_, sessionId: string, data: string) => {
    terminalService.write(sessionId, data);
  });

  ipcMain.on('terminal:resize', (_, sessionId: string, cols: number, rows: number) => {
    terminalService.resize(sessionId, cols, rows);
  });

  ipcMain.on('terminal:destroy', (_, sessionId: string) => {
    terminalService.destroy(sessionId);
  });

  // Forward terminal data to renderer
  terminalService.on('data', (sessionId: string, data: string) => {
    mainWindow?.webContents.send('terminal:data', sessionId, data);
  });

  terminalService.on('exit', (sessionId: string, exitCode: number) => {
    mainWindow?.webContents.send('terminal:exit', sessionId, exitCode);
  });

  // Status handlers
  ipcMain.handle('status:get', async (_, cliType: 'claude' | 'copilot' | 'codex' | 'qoder') => {
    if (cliType === 'claude') return claudeService.getStatus();
    if (cliType === 'codex') return codexService.getStatus();
    if (cliType === 'qoder') return qoderService.getStatus();
    return copilotService.getStatus();
  });

  ipcMain.handle('status:checkAll', async () => {
    // 并行检查所有 CLI 状态，提高速度
    const [claudeStatus, copilotStatus, codexStatus, qoderStatus] = await Promise.all([
      claudeService.checkStatus(),
      copilotService.checkStatus(),
      codexService.checkStatus(),
      qoderService.checkStatus(),
    ]);
    return [claudeStatus, copilotStatus, codexStatus, qoderStatus];
  });

  // Config handlers
  ipcMain.handle('config:get', async (_, cliType: 'claude' | 'copilot' | 'codex' | 'qoder') => {
    return configService.get(cliType);
  });

  ipcMain.handle('config:set', async (_, cliType: 'claude' | 'copilot' | 'codex' | 'qoder', config: Record<string, unknown>) => {
    await configService.set(cliType, config);
  });

  ipcMain.handle('config:setEnvVar', async (_, cliType: 'claude' | 'copilot' | 'codex' | 'qoder', key: string, value: string) => {
    await configService.setEnvVar(cliType, key, value);
  });

  ipcMain.handle('config:deleteEnvVar', async (_, cliType: 'claude' | 'copilot' | 'codex' | 'qoder', key: string) => {
    await configService.deleteEnvVar(cliType, key);
  });

  // Settings.json handler for Claude
  ipcMain.handle('config:getSettings', async () => {
    return configService.getSettings();
  });

  ipcMain.handle('config:setSettings', async (_, settings: Record<string, unknown>) => {
    await configService.setSettings(settings);
  });

  // Apps.json handler for Copilot
  ipcMain.handle('config:getApps', async () => {
    return configService.getApps();
  });

  ipcMain.handle('config:setApps', async (_, apps: Record<string, unknown>) => {
    await configService.setApps(apps);
  });

  // Config.json handler for Codex
  ipcMain.handle('config:getCodexConfig', async () => {
    return configService.getCodexConfig();
  });

  ipcMain.handle('config:setCodexConfig', async (_, content: string) => {
    await configService.setCodexConfig(content);
  });

  // Settings.json handler for Qoder
  ipcMain.handle('config:getQoderSettings', async () => {
    return configService.getQoderSettings();
  });

  ipcMain.handle('config:setQoderSettings', async (_, settings: Record<string, unknown>) => {
    await configService.setQoderSettings(settings);
  });

  // Conversation handlers
  ipcMain.handle('conversation:create', async (_, cliType: 'claude' | 'copilot' | 'codex' | 'qoder', sessionId: string, title?: string) => {
    return conversationService.create(cliType, sessionId, title);
  });

  ipcMain.handle('conversation:get', async (_, id: string) => {
    return conversationService.get(id);
  });

  ipcMain.handle('conversation:getWithMessages', async (_, id: string) => {
    return conversationService.getWithMessages(id);
  });

  ipcMain.handle('conversation:list', async (_, filter?: ConversationFilter) => {
    return conversationService.list(filter);
  });

  ipcMain.handle('conversation:addMessage', async (_, conversationId: string, message: Omit<ConversationMessage, 'id' | 'conversationId' | 'timestamp'>) => {
    return conversationService.addMessage(conversationId, message);
  });

  ipcMain.handle('conversation:updateTitle', async (_, id: string, title: string) => {
    await conversationService.updateTitle(id, title);
  });

  ipcMain.handle('conversation:delete', async (_, id: string) => {
    await conversationService.delete(id);
  });

  ipcMain.handle('conversation:toggleFavorite', async (_, id: string) => {
    await conversationService.toggleFavorite(id);
  });

  ipcMain.handle('conversation:getMessages', async (_, conversationId: string) => {
    return conversationService.getMessages(conversationId);
  });

  ipcMain.handle('conversation:getActiveForSession', async (_, sessionId: string) => {
    return conversationService.getActiveConversationForSession(sessionId);
  });

  // Listen for conversation events from terminal service
  terminalService.on('conversation:start', async (sessionId: string) => {
    const session = terminalService.getSession(sessionId);
    if (!session) return;

    // Create a new conversation for this session
    const conversationId = await conversationService.create(session.cliType, sessionId);
    terminalService.setConversationId(sessionId, conversationId);

    // Notify renderer
    mainWindow?.webContents.send('conversation:created', sessionId, conversationId);
  });

  terminalService.on('conversation:message', async (sessionId: string, message) => {
    const conversationId = terminalService.getConversationId(sessionId);
    if (!conversationId) {
      // No active conversation, start one
      const session = terminalService.getSession(sessionId);
      if (session) {
        const newConversationId = await conversationService.create(session.cliType, sessionId);
        terminalService.setConversationId(sessionId, newConversationId);
        await conversationService.addMessage(newConversationId, message);
        mainWindow?.webContents.send('conversation:created', sessionId, newConversationId);
        mainWindow?.webContents.send('conversation:message', newConversationId, message);
      }
      return;
    }

    // Add message to conversation
    await conversationService.addMessage(conversationId, message);
    mainWindow?.webContents.send('conversation:message', conversationId, message);
  });
}

// App lifecycle
app.whenReady().then(async () => {
  await initializeServices();
  setupIPCHandlers();
  setupAppMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  cleanupAppResources();
  if (process.platform !== 'darwin') {
    quitApp();
  }
});

app.on('before-quit', () => {
  quitApp(false);
});

// Types for IPC are handled in services/conversation.ts
