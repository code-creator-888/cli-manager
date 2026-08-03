import { app, BrowserWindow, clipboard, ipcMain, Menu, nativeImage } from 'electron';
import type { IpcMainEvent, IpcMainInvokeEvent, WebContents } from 'electron';
import * as path from 'path';
import { pathToFileURL } from 'url';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { TerminalService } from './services/terminal';
import { ClaudeCLIService } from './services/claude-cli';
import { CopilotCLIService } from './services/copilot-cli';
import { CodexCLIService } from './services/codex-cli';
import { QoderCLIService } from './services/qoder-cli';
import { ConfigService } from './services/config';
import { ConversationService, ConversationMessage, ConversationFilter } from './services/conversation';
import type { CLIType } from '../shared/ipc';
import { formatFilePathForCLI, getPastedImageDirectory } from '../shared/clipboard';
import { assertTrustedIpcSender, configureWebContentsSecurity } from './security';
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

function getRendererUrl(): string {
  if (isDev) {
    return devServerUrl;
  }

  return pathToFileURL(path.join(__dirname, '../../dist/index.html')).toString();
}

function getTrustedWebContents(): WebContents | null {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return null;
  }

  return mainWindow.webContents;
}

function handleTrusted(
  channel: string,
  handler: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown
): void {
  ipcMain.handle(channel, async (event, ...args) => {
    assertTrustedIpcSender(event, getTrustedWebContents());
    try {
      return await handler(event, ...args);
    } catch (error) {
      console.error(`IPC handler failed for "${channel}": ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
      throw error;
    }
  });
}

function onTrusted(channel: string, handler: (event: IpcMainEvent, ...args: unknown[]) => void): void {
  ipcMain.on(channel, (event, ...args) => {
    assertTrustedIpcSender(event, getTrustedWebContents());
    handler(event, ...args);
  });
}

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

function supportsPresetCLISession(cliType: CLIType): boolean {
  return ['claude', 'copilot', 'qoder'].includes(cliType);
}

function supportsResumeCLISession(cliType: CLIType): boolean {
  return ['claude', 'copilot', 'codex', 'qoder'].includes(cliType);
}

function getNewSessionArgs(cliType: CLIType, cliSessionId: string): string[] {
  if (cliType === 'copilot') {
    return [`--session-id=${cliSessionId}`];
  }

  return ['--session-id', cliSessionId];
}

function getResumeSessionArgs(cliType: CLIType, cliSessionId: string): string[] {
  if (cliType === 'codex') {
    return ['resume', cliSessionId];
  }

  if (cliType === 'copilot') {
    return [`--resume=${cliSessionId}`];
  }

  return ['--resume', cliSessionId];
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
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
    icon: getWindowIcon(),
  });

  const rendererUrl = getRendererUrl();
  configureWebContentsSecurity(mainWindow.webContents, rendererUrl);
  const loadPromise = mainWindow.loadURL(rendererUrl);

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

}

function setupAppMenu(): void {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: '退出 CLI Manager',
          accelerator: 'CmdOrCtrl+Q',
          click: () => quitApp(),
        },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' },
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
  onTrusted('app:quit', () => quitApp());

  const savePngToPastedImages = async (png: Buffer, cliType: CLIType | undefined) => {
    const tempDir = getPastedImageDirectory(cliType, {
      homeDir: app.getPath('home'),
      tempDir: app.getPath('temp'),
    });
    await fs.promises.mkdir(tempDir, { recursive: true });

    const filePath = path.join(tempDir, `clipboard-${Date.now()}-${crypto.randomUUID()}.png`);
    await fs.promises.writeFile(filePath, png);

    // Keep only the most recent pasted image to avoid unbounded disk growth.
    const entries = await fs.promises.readdir(tempDir, { withFileTypes: true });
    const imageFiles = entries
      .filter((entry) => entry.isFile() && entry.name.startsWith('clipboard-') && entry.name.endsWith('.png'))
      .map((entry) => ({
        name: entry.name,
        path: path.join(tempDir, entry.name),
      }));

    if (imageFiles.length > 1) {
      const filesWithMtime = await Promise.all(
        imageFiles.map(async (file) => {
          const stats = await fs.promises.stat(file.path);
          return { ...file, mtime: stats.mtimeMs };
        })
      );
      filesWithMtime.sort((a, b) => b.mtime - a.mtime);
      await Promise.all(
        filesWithMtime.slice(1).map((file) => fs.promises.unlink(file.path))
      );
    }

    return filePath;
  };

  const imageDataToPng = (imageData: unknown): Buffer | null => {
    if (!(imageData instanceof ArrayBuffer) && !ArrayBuffer.isView(imageData)) {
      throw new Error('Invalid imageData: expected an ArrayBuffer.');
    }

    const imageBuffer = imageData instanceof ArrayBuffer
      ? Buffer.from(imageData)
      : Buffer.from(imageData.buffer, imageData.byteOffset, imageData.byteLength);
    const image = nativeImage.createFromBuffer(imageBuffer);
    if (image.isEmpty()) {
      return null;
    }

    const png = image.toPNG();
    return png.length === 0 ? null : png;
  };

  const pasteImageFileToTerminal = (sessionId: string, cliType: CLIType, filePath: string) => {
    const formatted = formatFilePathForCLI(cliType, filePath);
    // Claude Code detects pasted image paths and renders them as inline
    // attachments when they arrive via bracketed paste mode.
    const content = cliType === 'claude'
      ? `\x1b[200~${formatted}\x1b[201~`
      : formatted;
    terminalService.write(sessionId, `${content} `);
  };

  handleTrusted('clipboard:saveImageToTemp', async (_, cliType: unknown) => {
    const validatedCLIType = cliType === undefined ? undefined : assertCLIType(cliType);
    const image = clipboard.readImage();
    if (image.isEmpty()) {
      return null;
    }

    const png = image.toPNG();
    if (png.length === 0) {
      return null;
    }

    return savePngToPastedImages(png, validatedCLIType);
  });

  handleTrusted('clipboard:saveImageDataToTemp', async (_, cliType: unknown, imageData: unknown) => {
    const validatedCLIType = cliType === undefined ? undefined : assertCLIType(cliType);
    const png = imageDataToPng(imageData);
    if (!png) {
      return null;
    }

    return savePngToPastedImages(png, validatedCLIType);
  });

  // Terminal handlers
  handleTrusted('terminal:create', async (_, cliType: unknown) => {
    const validatedCLIType = assertCLIType(cliType);
    const command = getCommandForCLI(validatedCLIType);
    const cliSessionId = supportsPresetCLISession(validatedCLIType) ? crypto.randomUUID() : undefined;
    const args = cliSessionId ? getNewSessionArgs(validatedCLIType, cliSessionId) : [];
    const sessionId = terminalService.createSession(command, validatedCLIType, args, cliSessionId);
    return { sessionId, cliSessionId };
  });

  handleTrusted('terminal:createResume', async (_, cliType: unknown, cliSessionId: unknown) => {
    const validatedCLIType = assertCLIType(cliType);
    const validatedSessionId = assertNonEmptyString(cliSessionId, 'cliSessionId');
    if (!supportsResumeCLISession(validatedCLIType)) {
      throw new Error(`${validatedCLIType} conversations cannot be resumed with saved context yet`);
    }
    const command = getCommandForCLI(validatedCLIType);
    const sessionId = terminalService.createSession(
      command,
      validatedCLIType,
      getResumeSessionArgs(validatedCLIType, validatedSessionId),
      validatedSessionId
    );
    return { sessionId, cliSessionId: validatedSessionId };
  });

  onTrusted('terminal:write', (_, sessionId: unknown, data: unknown) => {
    terminalService.write(assertNonEmptyString(sessionId, 'sessionId'), assertString(data, 'data'));
  });

  handleTrusted('terminal:pasteClipboardImage', async (_, sessionId: unknown, cliType: unknown) => {
    const validatedSessionId = assertNonEmptyString(sessionId, 'sessionId');
    const validatedCLIType = assertCLIType(cliType);
    const image = clipboard.readImage();
    if (image.isEmpty()) {
      return null;
    }

    const png = image.toPNG();
    if (png.length === 0) {
      return null;
    }

    const filePath = await savePngToPastedImages(png, validatedCLIType);
    pasteImageFileToTerminal(validatedSessionId, validatedCLIType, filePath);
    return filePath;
  });

  handleTrusted('terminal:pasteImageData', async (_, sessionId: unknown, cliType: unknown, imageData: unknown) => {
    const validatedSessionId = assertNonEmptyString(sessionId, 'sessionId');
    const validatedCLIType = assertCLIType(cliType);
    const png = imageDataToPng(imageData);
    if (!png) {
      return null;
    }

    const filePath = await savePngToPastedImages(png, validatedCLIType);
    pasteImageFileToTerminal(validatedSessionId, validatedCLIType, filePath);
    return filePath;
  });

  onTrusted('terminal:resize', (_, sessionId: unknown, cols: unknown, rows: unknown) => {
    const size = assertTerminalSize(cols, rows);
    terminalService.resize(assertNonEmptyString(sessionId, 'sessionId'), size.cols, size.rows);
  });

  onTrusted('terminal:destroy', (_, sessionId: unknown) => {
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
  handleTrusted('status:get', async (_, cliType: unknown) => {
    const validatedCLIType = assertCLIType(cliType);
    if (validatedCLIType === 'claude') return claudeService.getStatus();
    if (validatedCLIType === 'codex') return codexService.getStatus();
    if (validatedCLIType === 'qoder') return qoderService.getStatus();
    return copilotService.getStatus();
  });

  handleTrusted('status:checkAll', async () => {
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
  handleTrusted('config:get', async (_, cliType: unknown) => {
    return configService.get(assertCLIType(cliType));
  });

  handleTrusted('config:set', async (_, cliType: unknown, config: unknown) => {
    await configService.set(assertCLIType(cliType), assertPlainObject(config, 'config'));
  });

  handleTrusted('config:setEnvVar', async (_, cliType: unknown, key: unknown, value: unknown) => {
    await configService.setEnvVar(
      assertCLIType(cliType),
      assertNonEmptyString(key, 'key'),
      assertNonEmptyString(value, 'value')
    );
  });

  handleTrusted('config:deleteEnvVar', async (_, cliType: unknown, key: unknown) => {
    await configService.deleteEnvVar(assertCLIType(cliType), assertNonEmptyString(key, 'key'));
  });

  // Conversation handlers
  handleTrusted('conversation:create', async (_, cliType: unknown, sessionId: unknown, title?: unknown) => {
    return conversationService.create(
      assertCLIType(cliType),
      assertNonEmptyString(sessionId, 'sessionId'),
      assertOptionalString(title, 'title')
    );
  });

  handleTrusted('conversation:get', async (_, id: unknown) => {
    return conversationService.get(assertNonEmptyString(id, 'id'));
  });

  handleTrusted('conversation:getWithMessages', async (_, id: unknown) => {
    return conversationService.getWithMessages(assertNonEmptyString(id, 'id'));
  });

  handleTrusted('conversation:list', async (_, filter?: unknown) => {
    return conversationService.list(assertConversationFilter(filter) as ConversationFilter | undefined);
  });

  handleTrusted('conversation:addMessage', async (_, conversationId: unknown, message: unknown) => {
    return conversationService.addMessage(
      assertNonEmptyString(conversationId, 'conversationId'),
      assertConversationMessage(message) as Omit<ConversationMessage, 'id' | 'conversationId' | 'timestamp'>
    );
  });

  handleTrusted('conversation:updateTitle', async (_, id: unknown, title: unknown) => {
    await conversationService.updateTitle(assertNonEmptyString(id, 'id'), assertNonEmptyString(title, 'title'));
  });

  handleTrusted('conversation:delete', async (_, id: unknown) => {
    await conversationService.delete(assertNonEmptyString(id, 'id'));
  });

  handleTrusted('conversation:deleteByCLI', async (_, cliType: unknown) => {
    return conversationService.deleteByCLI(assertCLIType(cliType));
  });

  handleTrusted('conversation:toggleFavorite', async (_, id: unknown) => {
    await conversationService.toggleFavorite(assertNonEmptyString(id, 'id'));
  });

  handleTrusted('conversation:getMessages', async (_, conversationId: unknown) => {
    return conversationService.getMessages(assertNonEmptyString(conversationId, 'conversationId'));
  });

  handleTrusted('conversation:getActiveForSession', async (_, sessionId: unknown) => {
    return conversationService.getActiveConversationForSession(assertNonEmptyString(sessionId, 'sessionId'));
  });

  handleTrusted('conversation:getStats', async () => {
    return conversationService.getStats();
  });

  // Listen for conversation events from terminal service
  terminalService.on('conversation:start', () => {
    // Conversation records are created lazily when the first real message arrives.
    // Creating on start alone can leave empty "Untitled Conversation" rows.
  });

  terminalService.on('conversation:message', async (sessionId: string, message) => {
    const conversationId = terminalService.getConversationId(sessionId);
    if (!conversationId) {
      // No active conversation, start one
      const session = terminalService.getSession(sessionId);
      if (session) {
        const newConversationId = await conversationService.create(session.cliType, sessionId);
        terminalService.setConversationId(sessionId, newConversationId);
        // Store the CLI session ID so the conversation can be resumed later
        const cliSessionId = terminalService.resolveCLISessionId(sessionId);
        if (cliSessionId) {
          await conversationService.updateCLISessionId(newConversationId, cliSessionId);
        }
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
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.show();
      mainWindow.focus();
      return;
    }

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
