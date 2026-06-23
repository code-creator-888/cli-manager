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
import type { CLIType } from '../shared/ipc';
import {
  assertCLIType,
  assertConversationFilter,
  assertConversationMessage,
  assertNonEmptyString,
  assertOptionalString,
  assertPlainObject,
  assertString,
  assertTerminalSize,
} from './ipc-validation';

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
const isSmokeTest = process.env.CLI_MANAGER_SMOKE_TEST === '1' || process.argv.includes('--cli-manager-smoke-test');

function getWindowIcon(): string | undefined {
  const iconPath = path.join(__dirname, '../../assets/icon.png');
  return fs.existsSync(iconPath) ? iconPath : undefined;
}

function getCommandForCLI(cliType: CLIType): string {
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
    show: !isSmokeTest,
    title: 'CLI Manager',
    backgroundColor: '#1a1a2e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: getWindowIcon(),
  });

  const loadPromise = isDev
    ? mainWindow.loadURL(devServerUrl)
    : mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));

  if (isSmokeTest) {
    const smokeTimeout = setTimeout(() => {
      console.error('CLI Manager smoke test timed out while loading the main window.');
      cleanupAppResources();
      app.exit(1);
    }, 15000);

    loadPromise
      .then(() => {
        clearTimeout(smokeTimeout);
        quitApp();
      })
      .catch((error: unknown) => {
        clearTimeout(smokeTimeout);
        console.error(`CLI Manager smoke test failed to load: ${error instanceof Error ? error.message : String(error)}`);
        cleanupAppResources();
        app.exit(1);
      });
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
  ipcMain.handle('terminal:create', async (_, cliType: unknown) => {
    const validatedCLIType = assertCLIType(cliType);
    const command = getCommandForCLI(validatedCLIType);
    return terminalService.createSession(command, validatedCLIType);
  });

  ipcMain.on('terminal:write', (_, sessionId: unknown, data: unknown) => {
    terminalService.write(assertNonEmptyString(sessionId, 'sessionId'), assertNonEmptyString(data, 'data'));
  });

  ipcMain.on('terminal:resize', (_, sessionId: unknown, cols: unknown, rows: unknown) => {
    const size = assertTerminalSize(cols, rows);
    terminalService.resize(assertNonEmptyString(sessionId, 'sessionId'), size.cols, size.rows);
  });

  ipcMain.on('terminal:destroy', (_, sessionId: unknown) => {
    terminalService.destroy(assertNonEmptyString(sessionId, 'sessionId'));
  });

  // Forward terminal data to renderer
  terminalService.on('data', (sessionId: string, data: string) => {
    mainWindow?.webContents.send('terminal:data', sessionId, data);
  });

  terminalService.on('exit', (sessionId: string, exitCode: number) => {
    mainWindow?.webContents.send('terminal:exit', sessionId, exitCode);
  });

  // Status handlers
  ipcMain.handle('status:get', async (_, cliType: unknown) => {
    const validatedCLIType = assertCLIType(cliType);
    if (validatedCLIType === 'claude') return claudeService.getStatus();
    if (validatedCLIType === 'codex') return codexService.getStatus();
    if (validatedCLIType === 'qoder') return qoderService.getStatus();
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
  ipcMain.handle('config:get', async (_, cliType: unknown) => {
    return configService.get(assertCLIType(cliType));
  });

  ipcMain.handle('config:set', async (_, cliType: unknown, config: unknown) => {
    await configService.set(assertCLIType(cliType), assertPlainObject(config, 'config'));
  });

  ipcMain.handle('config:setEnvVar', async (_, cliType: unknown, key: unknown, value: unknown) => {
    await configService.setEnvVar(
      assertCLIType(cliType),
      assertNonEmptyString(key, 'key'),
      assertNonEmptyString(value, 'value')
    );
  });

  ipcMain.handle('config:deleteEnvVar', async (_, cliType: unknown, key: unknown) => {
    await configService.deleteEnvVar(assertCLIType(cliType), assertNonEmptyString(key, 'key'));
  });

  // Settings.json handler for Claude
  ipcMain.handle('config:getSettings', async () => {
    return configService.getSettings();
  });

  ipcMain.handle('config:setSettings', async (_, settings: unknown) => {
    await configService.setSettings(assertPlainObject(settings, 'settings'));
  });

  // Apps.json handler for Copilot
  ipcMain.handle('config:getApps', async () => {
    return configService.getApps();
  });

  ipcMain.handle('config:setApps', async (_, apps: unknown) => {
    await configService.setApps(assertPlainObject(apps, 'apps'));
  });

  // Config.json handler for Codex
  ipcMain.handle('config:getCodexConfig', async () => {
    return configService.getCodexConfig();
  });

  ipcMain.handle('config:setCodexConfig', async (_, content: unknown) => {
    await configService.setCodexConfig(assertString(content, 'content'));
  });

  // Settings.json handler for Qoder
  ipcMain.handle('config:getQoderSettings', async () => {
    return configService.getQoderSettings();
  });

  ipcMain.handle('config:setQoderSettings', async (_, settings: unknown) => {
    await configService.setQoderSettings(assertPlainObject(settings, 'settings'));
  });

  // Conversation handlers
  ipcMain.handle('conversation:create', async (_, cliType: unknown, sessionId: unknown, title?: unknown) => {
    return conversationService.create(
      assertCLIType(cliType),
      assertNonEmptyString(sessionId, 'sessionId'),
      assertOptionalString(title, 'title')
    );
  });

  ipcMain.handle('conversation:get', async (_, id: unknown) => {
    return conversationService.get(assertNonEmptyString(id, 'id'));
  });

  ipcMain.handle('conversation:getWithMessages', async (_, id: unknown) => {
    return conversationService.getWithMessages(assertNonEmptyString(id, 'id'));
  });

  ipcMain.handle('conversation:list', async (_, filter?: unknown) => {
    return conversationService.list(assertConversationFilter(filter) as ConversationFilter | undefined);
  });

  ipcMain.handle('conversation:addMessage', async (_, conversationId: unknown, message: unknown) => {
    return conversationService.addMessage(
      assertNonEmptyString(conversationId, 'conversationId'),
      assertConversationMessage(message) as Omit<ConversationMessage, 'id' | 'conversationId' | 'timestamp'>
    );
  });

  ipcMain.handle('conversation:updateTitle', async (_, id: unknown, title: unknown) => {
    await conversationService.updateTitle(assertNonEmptyString(id, 'id'), assertNonEmptyString(title, 'title'));
  });

  ipcMain.handle('conversation:delete', async (_, id: unknown) => {
    await conversationService.delete(assertNonEmptyString(id, 'id'));
  });

  ipcMain.handle('conversation:toggleFavorite', async (_, id: unknown) => {
    await conversationService.toggleFavorite(assertNonEmptyString(id, 'id'));
  });

  ipcMain.handle('conversation:getMessages', async (_, conversationId: unknown) => {
    return conversationService.getMessages(assertNonEmptyString(conversationId, 'conversationId'));
  });

  ipcMain.handle('conversation:getActiveForSession', async (_, sessionId: unknown) => {
    return conversationService.getActiveConversationForSession(assertNonEmptyString(sessionId, 'sessionId'));
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
