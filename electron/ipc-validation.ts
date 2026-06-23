import type { CLIType, ConversationFilter, ConversationMessage } from '../shared/ipc';

const VALID_CLI_TYPES = new Set<CLIType>(['claude', 'copilot', 'codex', 'qoder']);
const MESSAGE_ROLES = new Set(['user', 'assistant', 'tool']);

export function assertCLIType(value: unknown, fieldName = 'cliType'): CLIType {
  if (typeof value !== 'string' || !VALID_CLI_TYPES.has(value as CLIType)) {
    throw new Error(`Invalid ${fieldName}: expected one of claude, copilot, codex, qoder.`);
  }

  return value as CLIType;
}

export function assertNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Invalid ${fieldName}: expected a non-empty string.`);
  }

  return value;
}

export function assertString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Invalid ${fieldName}: expected a string.`);
  }

  return value;
}

export function assertOptionalString(value: unknown, fieldName: string): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  return assertNonEmptyString(value, fieldName);
}

export function assertPlainObject(value: unknown, fieldName: string): Record<string, unknown> {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw new Error(`Invalid ${fieldName}: expected a plain object.`);
  }

  return value as Record<string, unknown>;
}

export function assertNumber(value: unknown, fieldName: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Invalid ${fieldName}: expected a finite number.`);
  }

  return value;
}

export function assertTerminalSize(cols: unknown, rows: unknown): { cols: number; rows: number } {
  const parsedCols = assertNumber(cols, 'cols');
  const parsedRows = assertNumber(rows, 'rows');
  if (parsedCols <= 0 || parsedRows <= 0) {
    throw new Error('Invalid terminal size: cols and rows must be positive.');
  }

  return {
    cols: Math.floor(parsedCols),
    rows: Math.floor(parsedRows),
  };
}

export function assertConversationFilter(value: unknown): ConversationFilter | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  const filter = assertPlainObject(value, 'filter') as Partial<ConversationFilter>;
  const result: ConversationFilter = {};

  if (filter.cliType !== undefined) result.cliType = assertCLIType(filter.cliType);
  if (filter.sessionId !== undefined) result.sessionId = assertNonEmptyString(filter.sessionId, 'filter.sessionId');
  if (filter.search !== undefined) result.search = assertString(filter.search, 'filter.search');
  if (filter.favorites !== undefined) result.favorites = Boolean(filter.favorites);
  if (filter.limit !== undefined) result.limit = Math.floor(assertNumber(filter.limit, 'filter.limit'));
  if (filter.offset !== undefined) result.offset = Math.floor(assertNumber(filter.offset, 'filter.offset'));

  return result;
}

export function assertConversationMessage(value: unknown): Omit<ConversationMessage, 'id' | 'conversationId' | 'timestamp'> {
  const message = assertPlainObject(value, 'message');
  const role = message.role;
  if (typeof role !== 'string' || !MESSAGE_ROLES.has(role)) {
    throw new Error('Invalid message.role: expected user, assistant, or tool.');
  }

  return {
    role: role as ConversationMessage['role'],
    content: assertNonEmptyString(message.content, 'message.content'),
    metadata: message.metadata === undefined ? undefined : assertPlainObject(message.metadata, 'message.metadata'),
  };
}
