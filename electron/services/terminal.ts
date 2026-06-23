import * as pty from 'node-pty';
import { EventEmitter } from 'events';
import * as os from 'os';
import { spawnSync } from 'child_process';
import { ConversationParser, ParsedMessage } from './conversation-parser';

const MAX_TERMINAL_DATA_CHUNK_BYTES = 64 * 1024;

interface TerminalSession {
  pty: pty.IPty;
  cliType: 'claude' | 'copilot' | 'codex' | 'qoder';
  createdAt: Date;
  lastActivity: Date;
  conversationId?: string;
  parser: ConversationParser;
}

export class TerminalService extends EventEmitter {
  private sessions: Map<string, TerminalSession> = new Map();
  private shell: string;

  constructor() {
    super();
    // Determine shell based on platform
    this.shell = os.platform() === 'win32' ? 'powershell.exe' : process.env.SHELL || '/bin/bash';
  }

  hasCommand(command: string): boolean {
    const checker = os.platform() === 'win32' ? 'where' : 'which';
    const result = spawnSync(checker, [command], { stdio: 'ignore' });
    return result.status === 0;
  }

  createSession(command: string, cliType: 'claude' | 'copilot' | 'codex' | 'qoder'): string {
    if (!this.hasCommand(command)) {
      throw new Error(`${cliType} CLI is not installed or not available in PATH`);
    }

    const sessionId = this.generateSessionId();

    const ptyProcess = pty.spawn(command, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: os.homedir(),
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
      },
    });

    // Create parser for conversation extraction
    const parser = new ConversationParser(cliType);

    const session: TerminalSession = {
      pty: ptyProcess,
      cliType,
      createdAt: new Date(),
      lastActivity: new Date(),
      parser,
    };

    // Handle parsed messages from the parser
    parser.on('message', (message: ParsedMessage) => {
      this.emit('conversation:message', sessionId, message);
    });

    parser.on('conversationStart', () => {
      this.emit('conversation:start', sessionId);
    });

    // Handle data from pty
    ptyProcess.onData((data: string) => {
      session.lastActivity = new Date();
      // Feed data to parser for conversation extraction
      session.parser.feed(data);
      // Emit raw data for terminal display
      this.emitTerminalData(sessionId, data);
    });

    // Handle exit
    ptyProcess.onExit(({ exitCode }) => {
      // Flush any remaining parsed content
      session.parser.flush();
      this.sessions.delete(sessionId);
      this.emit('exit', sessionId, exitCode);
    });

    this.sessions.set(sessionId, session);
    return sessionId;
  }

  write(sessionId: string, data: string): void {
    if (data.length === 0) {
      return;
    }

    const session = this.sessions.get(sessionId);
    if (session) {
      session.pty.write(data);
      session.lastActivity = new Date();
    }
  }

  resize(sessionId: string, cols: number, rows: number): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.pty.resize(cols, rows);
    }
  }

  destroy(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      try {
        session.pty.kill();
      } catch {
        // Ignore errors on kill
      }
      this.sessions.delete(sessionId);
    }
  }

  destroyAll(): void {
    for (const sessionId of this.sessions.keys()) {
      this.destroy(sessionId);
    }
  }

  getSession(sessionId: string): TerminalSession | undefined {
    return this.sessions.get(sessionId);
  }

  getActiveSessions(): string[] {
    return Array.from(this.sessions.keys());
  }

  setConversationId(sessionId: string, conversationId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.conversationId = conversationId;
    }
  }

  getConversationId(sessionId: string): string | undefined {
    const session = this.sessions.get(sessionId);
    return session?.conversationId;
  }

  resetParser(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.parser.reset();
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private emitTerminalData(sessionId: string, data: string): void {
    if (data.length <= MAX_TERMINAL_DATA_CHUNK_BYTES) {
      this.emit('data', sessionId, data);
      return;
    }

    for (let offset = 0; offset < data.length; offset += MAX_TERMINAL_DATA_CHUNK_BYTES) {
      this.emit('data', sessionId, data.slice(offset, offset + MAX_TERMINAL_DATA_CHUNK_BYTES));
    }
  }
}

// Type declarations for events
export interface TerminalServiceEvents {
  data: (sessionId: string, data: string) => void;
  exit: (sessionId: string, exitCode: number) => void;
  'conversation:message': (sessionId: string, message: ParsedMessage) => void;
  'conversation:start': (sessionId: string) => void;
}
