import Database from 'better-sqlite3';
import * as crypto from 'crypto';

type CLIType = 'claude' | 'copilot' | 'codex';

// Generate UUID v4 without external dependency
function generateUUID(): string {
  return crypto.randomUUID();
}

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

export class ConversationService {
  private db: Database.Database | null = null;
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  async initialize(): Promise<void> {
    this.db = new Database(this.dbPath);

    // Create tables if they don't exist
    this.db.exec(`
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
    const row = stmt.get(id) as any;

    return row ? this.rowToConversation(row) : null;
  }

  async getWithMessages(id: string): Promise<ConversationWithMessages | null> {
    const conversation = await this.get(id);
    if (!conversation) return null;

    const stmt = this.db!.prepare('SELECT * FROM conversation_messages WHERE conversation_id = ? ORDER BY timestamp ASC');
    const rows = stmt.all(id) as any[];

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

    if (filter?.search) {
      sql += ' AND (title LIKE ? OR id IN (SELECT conversation_id FROM conversation_messages WHERE content LIKE ?))';
      params.push(`%${filter.search}%`, `%${filter.search}%`);
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
    const rows = stmt.all(...params) as any[];

    return rows.map(this.rowToConversation);
  }

  async updateTitle(id: string, title: string): Promise<void> {
    this.db!.prepare(`
      UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?
    `).run(title, new Date().toISOString(), id);
  }

  async delete(id: string): Promise<void> {
    // CASCADE will delete messages automatically
    this.db!.prepare('DELETE FROM conversations WHERE id = ?').run(id);
  }

  async toggleFavorite(id: string): Promise<void> {
    this.db!.prepare(`
      UPDATE conversations SET favorite = CASE WHEN favorite = 1 THEN 0 ELSE 1 END
      WHERE id = ?
    `).run(id);
  }

  async getMessages(conversationId: string): Promise<ConversationMessage[]> {
    const stmt = this.db!.prepare('SELECT * FROM conversation_messages WHERE conversation_id = ? ORDER BY timestamp ASC');
    const rows = stmt.all(conversationId) as any[];

    return rows.map(this.rowToMessage);
  }

  async getActiveConversationForSession(sessionId: string): Promise<Conversation | null> {
    const stmt = this.db!.prepare(`
      SELECT * FROM conversations
      WHERE session_id = ?
      ORDER BY updated_at DESC
      LIMIT 1
    `);
    const row = stmt.get(sessionId) as any;

    return row ? this.rowToConversation(row) : null;
  }

  async getStats(): Promise<{
    total: number;
    claude: number;
    copilot: number;
    favorites: number;
  }> {
    const total = (this.db!.prepare('SELECT COUNT(*) as count FROM conversations').get() as any).count;
    const claude = (this.db!.prepare('SELECT COUNT(*) as count FROM conversations WHERE cli_type = ?').get('claude') as any).count;
    const copilot = (this.db!.prepare('SELECT COUNT(*) as count FROM conversations WHERE cli_type = ?').get('copilot') as any).count;
    const favorites = (this.db!.prepare('SELECT COUNT(*) as count FROM conversations WHERE favorite = 1').get() as any).count;

    return { total, claude, copilot, favorites };
  }

  private generateTitle(content: string): string {
    // Take first line, truncate to 50 chars
    const firstLine = content.split('\n')[0].trim();
    if (firstLine.length <= 50) return firstLine;
    return firstLine.substring(0, 47) + '...';
  }

  private rowToConversation(row: any): Conversation {
    return {
      id: row.id,
      cliType: row.cli_type,
      sessionId: row.session_id,
      title: row.title || undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      messageCount: row.message_count,
      favorite: row.favorite === 1,
    };
  }

  private rowToMessage(row: any): ConversationMessage {
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
