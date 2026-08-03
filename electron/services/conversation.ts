import Database from 'better-sqlite3';
import * as crypto from 'crypto';
import { buildFTSQuery } from './conversation-search';

type CLIType = 'claude' | 'copilot' | 'codex' | 'qoder';
const LATEST_SCHEMA_VERSION = 3;

// Generate UUID v4 without external dependency
function generateUUID(): string {
  return crypto.randomUUID();
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

interface ConversationRow {
  id: string;
  cli_type: CLIType;
  session_id: string;
  cli_session_id: string | null;
  title: string | null;
  created_at: string;
  updated_at: string;
  message_count: number;
  favorite: number;
}

interface ConversationMessageRow {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: string;
  metadata: string | null;
}

interface CountRow {
  count: number;
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

export class ConversationService {
  private db: Database.Database | null = null;
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  async initialize(): Promise<void> {
    this.db = new Database(this.dbPath);
    this.db.pragma('foreign_keys = ON');
    this.migrate();
  }

  private migrate(): void {
    const currentVersion = this.db!.pragma('user_version', { simple: true }) as number;

    if (currentVersion > LATEST_SCHEMA_VERSION) {
      throw new Error(
        `Unsupported conversation database schema version ${currentVersion}; expected <= ${LATEST_SCHEMA_VERSION}.`
      );
    }

    const runMigrations = this.db!.transaction(() => {
      if (currentVersion < 1) {
        this.createBaseSchema();
        this.db!.pragma('user_version = 1');
      }

      if (currentVersion < 2) {
        this.createSearchSchema();
        this.rebuildSearchIndex();
        this.db!.pragma('user_version = 2');
      }

      if (currentVersion < 3) {
        this.db!.exec(`
          ALTER TABLE conversations ADD COLUMN cli_session_id TEXT;
        `);
        this.db!.pragma('user_version = 3');
      }
    });

    runMigrations();
  }

  private createBaseSchema(): void {
    this.db!.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        cli_type TEXT NOT NULL,
        session_id TEXT,
        title TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        message_count INTEGER DEFAULT 0,
        favorite INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS conversation_messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        metadata TEXT,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_conv_cli_type ON conversations(cli_type);
      CREATE INDEX IF NOT EXISTS idx_conv_session_id ON conversations(session_id);
      CREATE INDEX IF NOT EXISTS idx_conv_created_at ON conversations(created_at);
      CREATE INDEX IF NOT EXISTS idx_conv_favorite ON conversations(favorite);
      CREATE INDEX IF NOT EXISTS idx_msg_conversation_id ON conversation_messages(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_msg_timestamp ON conversation_messages(timestamp);
    `);
  }

  private createSearchSchema(): void {
    this.db!.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS conversation_search USING fts5(
        conversation_id UNINDEXED,
        entry_id UNINDEXED,
        content,
        tokenize = 'unicode61'
      );

      CREATE TRIGGER IF NOT EXISTS trg_conversations_search_insert
      AFTER INSERT ON conversations
      WHEN NEW.title IS NOT NULL AND NEW.title != ''
      BEGIN
        INSERT INTO conversation_search (conversation_id, entry_id, content)
        VALUES (NEW.id, 'conversation:' || NEW.id, NEW.title);
      END;

      CREATE TRIGGER IF NOT EXISTS trg_conversations_search_update
      AFTER UPDATE OF title ON conversations
      BEGIN
        DELETE FROM conversation_search WHERE entry_id = 'conversation:' || NEW.id;
        INSERT INTO conversation_search (conversation_id, entry_id, content)
        SELECT NEW.id, 'conversation:' || NEW.id, NEW.title
        WHERE NEW.title IS NOT NULL AND NEW.title != '';
      END;

      CREATE TRIGGER IF NOT EXISTS trg_conversations_search_delete
      AFTER DELETE ON conversations
      BEGIN
        DELETE FROM conversation_search WHERE conversation_id = OLD.id;
      END;

      CREATE TRIGGER IF NOT EXISTS trg_messages_search_insert
      AFTER INSERT ON conversation_messages
      BEGIN
        INSERT INTO conversation_search (conversation_id, entry_id, content)
        VALUES (NEW.conversation_id, 'message:' || NEW.id, NEW.content);
      END;

      CREATE TRIGGER IF NOT EXISTS trg_messages_search_update
      AFTER UPDATE OF content ON conversation_messages
      BEGIN
        DELETE FROM conversation_search WHERE entry_id = 'message:' || NEW.id;
        INSERT INTO conversation_search (conversation_id, entry_id, content)
        VALUES (NEW.conversation_id, 'message:' || NEW.id, NEW.content);
      END;

      CREATE TRIGGER IF NOT EXISTS trg_messages_search_delete
      AFTER DELETE ON conversation_messages
      BEGIN
        DELETE FROM conversation_search WHERE entry_id = 'message:' || OLD.id;
      END;
    `);
  }

  async create(cliType: CLIType, sessionId: string, title?: string): Promise<string> {
    const id = generateUUID();
    const now = new Date().toISOString();

    const stmt = this.db!.prepare(`
      INSERT INTO conversations (id, cli_type, session_id, title, created_at, updated_at, message_count, favorite)
      VALUES (?, ?, ?, ?, ?, ?, 0, 0)
    `);

    stmt.run(id, cliType, sessionId, title || null, now, now);

    return id;
  }

  async addMessage(conversationId: string, message: Omit<ConversationMessage, 'id' | 'conversationId' | 'timestamp'>): Promise<string> {
    const id = generateUUID();
    const timestamp = new Date().toISOString();

    const stmt = this.db!.prepare(`
      INSERT INTO conversation_messages (id, conversation_id, role, content, timestamp, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      conversationId,
      message.role,
      message.content,
      timestamp,
      message.metadata ? JSON.stringify(message.metadata) : null
    );

    // Update conversation's updated_at and message_count
    this.db!.prepare(`
      UPDATE conversations
      SET updated_at = ?, message_count = message_count + 1
      WHERE id = ?
    `).run(timestamp, conversationId);

    // Auto-generate title from first user message if not set
    const conv = await this.get(conversationId);
    if (conv && !conv.title && message.role === 'user') {
      const title = this.generateTitle(message.content);
      await this.updateTitle(conversationId, title);
    }

    return id;
  }

  async get(id: string): Promise<Conversation | null> {
    const stmt = this.db!.prepare('SELECT * FROM conversations WHERE id = ?');
    const row = stmt.get(id) as ConversationRow | undefined;

    return row ? this.rowToConversation(row) : null;
  }

  async getWithMessages(id: string): Promise<ConversationWithMessages | null> {
    const conversation = await this.get(id);
    if (!conversation) return null;

    const stmt = this.db!.prepare('SELECT * FROM conversation_messages WHERE conversation_id = ? ORDER BY timestamp ASC');
    const rows = stmt.all(id) as ConversationMessageRow[];

    return {
      ...conversation,
      messages: rows.map(this.rowToMessage),
    };
  }

  async list(filter?: ConversationFilter): Promise<Conversation[]> {
    let sql = 'SELECT * FROM conversations WHERE 1=1';
    const params: (string | number)[] = [];

    if (filter?.cliType) {
      sql += ' AND cli_type = ?';
      params.push(filter.cliType);
    }

    if (filter?.sessionId) {
      sql += ' AND session_id = ?';
      params.push(filter.sessionId);
    }

    const ftsQuery = filter?.search ? buildFTSQuery(filter.search) : undefined;
    if (ftsQuery) {
      sql += ' AND id IN (SELECT conversation_id FROM conversation_search WHERE conversation_search MATCH ?)';
      params.push(ftsQuery);
    } else if (filter?.search?.trim()) {
      // Non-empty search terms that produce no valid FTS tokens should return no matches.
      sql += ' AND 0';
    }

    if (filter?.favorites) {
      sql += ' AND favorite = 1';
    }

    if (filter?.startDate) {
      sql += ' AND created_at >= ?';
      params.push(filter.startDate.toISOString());
    }

    if (filter?.endDate) {
      sql += ' AND created_at <= ?';
      params.push(filter.endDate.toISOString());
    }

    sql += ' ORDER BY updated_at DESC';

    if (filter?.limit) {
      sql += ' LIMIT ?';
      params.push(filter.limit);

      if (filter.offset) {
        sql += ' OFFSET ?';
        params.push(filter.offset);
      }
    }

    const stmt = this.db!.prepare(sql);
    const rows = stmt.all(...params) as ConversationRow[];

    return rows.map(this.rowToConversation);
  }

  async updateTitle(id: string, title: string): Promise<void> {
    this.db!.prepare(`
      UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?
    `).run(title, new Date().toISOString(), id);
  }

  async updateCLISessionId(id: string, cliSessionId: string): Promise<void> {
    this.db!.prepare(`
      UPDATE conversations SET cli_session_id = ? WHERE id = ?
    `).run(cliSessionId, id);
  }

  async delete(id: string): Promise<void> {
    // CASCADE will delete messages automatically
    this.db!.prepare('DELETE FROM conversations WHERE id = ?').run(id);
  }

  async deleteByCLI(cliType: CLIType): Promise<number> {
    // CASCADE and search triggers will clean up messages and FTS rows.
    const result = this.db!.prepare('DELETE FROM conversations WHERE cli_type = ?').run(cliType);
    return result.changes;
  }

  async toggleFavorite(id: string): Promise<void> {
    this.db!.prepare(`
      UPDATE conversations SET favorite = CASE WHEN favorite = 1 THEN 0 ELSE 1 END
      WHERE id = ?
    `).run(id);
  }

  async getMessages(conversationId: string): Promise<ConversationMessage[]> {
    const stmt = this.db!.prepare('SELECT * FROM conversation_messages WHERE conversation_id = ? ORDER BY timestamp ASC');
    const rows = stmt.all(conversationId) as ConversationMessageRow[];

    return rows.map(this.rowToMessage);
  }

  async getActiveConversationForSession(sessionId: string): Promise<Conversation | null> {
    const stmt = this.db!.prepare(`
      SELECT * FROM conversations
      WHERE session_id = ?
      ORDER BY updated_at DESC
      LIMIT 1
    `);
    const row = stmt.get(sessionId) as ConversationRow | undefined;

    return row ? this.rowToConversation(row) : null;
  }

  async getStats(): Promise<{
    total: number;
    claude: number;
    copilot: number;
    codex: number;
    qoder: number;
    favorites: number;
  }> {
    const total = (this.db!.prepare('SELECT COUNT(*) as count FROM conversations').get() as CountRow).count;
    const claude = (this.db!.prepare('SELECT COUNT(*) as count FROM conversations WHERE cli_type = ?').get('claude') as CountRow).count;
    const copilot = (this.db!.prepare('SELECT COUNT(*) as count FROM conversations WHERE cli_type = ?').get('copilot') as CountRow).count;
    const codex = (this.db!.prepare('SELECT COUNT(*) as count FROM conversations WHERE cli_type = ?').get('codex') as CountRow).count;
    const qoder = (this.db!.prepare('SELECT COUNT(*) as count FROM conversations WHERE cli_type = ?').get('qoder') as CountRow).count;
    const favorites = (this.db!.prepare('SELECT COUNT(*) as count FROM conversations WHERE favorite = 1').get() as CountRow).count;

    return { total, claude, copilot, codex, qoder, favorites };
  }

  private generateTitle(content: string): string {
    // Take first line, truncate to 50 chars
    const firstLine = content.split('\n')[0].trim();
    if (firstLine.length <= 50) return firstLine;
    return firstLine.substring(0, 47) + '...';
  }

  private rebuildSearchIndex(): void {
    this.db!.exec(`
      DELETE FROM conversation_search;

      INSERT INTO conversation_search (conversation_id, entry_id, content)
      SELECT id, 'conversation:' || id, title
      FROM conversations
      WHERE title IS NOT NULL AND title != '';

      INSERT INTO conversation_search (conversation_id, entry_id, content)
      SELECT conversation_id, 'message:' || id, content
      FROM conversation_messages;
    `);
  }

  private rowToConversation(row: ConversationRow): Conversation {
    return {
      id: row.id,
      cliType: row.cli_type,
      sessionId: row.session_id,
      cliSessionId: row.cli_session_id || undefined,
      title: row.title || undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      messageCount: row.message_count,
      favorite: row.favorite === 1,
    };
  }

  private rowToMessage(row: ConversationMessageRow): ConversationMessage {
    return {
      id: row.id,
      conversationId: row.conversation_id,
      role: row.role,
      content: row.content,
      timestamp: new Date(row.timestamp),
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
