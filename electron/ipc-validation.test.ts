// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  assertCLIType,
  assertConversationFilter,
  assertConversationMessage,
  assertNonEmptyString,
  assertPlainObject,
  assertString,
  assertTerminalSize,
} from './ipc-validation';

describe('ipc-validation', () => {
  it('accepts supported CLI types and rejects unknown values', () => {
    expect(assertCLIType('claude')).toBe('claude');
    expect(() => assertCLIType('unknown')).toThrow('Invalid cliType');
  });

  it('validates strings based on empty-string policy', () => {
    expect(assertString('', 'content')).toBe('');
    expect(() => assertNonEmptyString('', 'sessionId')).toThrow('Invalid sessionId');
    expect(assertNonEmptyString('session_1', 'sessionId')).toBe('session_1');
  });

  it('accepts plain objects and rejects arrays', () => {
    expect(assertPlainObject({ enabled: true }, 'config')).toEqual({ enabled: true });
    expect(() => assertPlainObject([], 'config')).toThrow('Invalid config');
  });

  it('normalizes terminal size to positive integers', () => {
    expect(assertTerminalSize(80.9, 24.2)).toEqual({ cols: 80, rows: 24 });
    expect(() => assertTerminalSize(0, 24)).toThrow('Invalid terminal size');
  });

  it('validates conversation filters', () => {
    expect(assertConversationFilter({ cliType: 'codex', search: '', favorites: true, limit: 10.8 })).toEqual({
      cliType: 'codex',
      search: '',
      favorites: true,
      limit: 10,
    });
    expect(() => assertConversationFilter({ cliType: 'bad' })).toThrow('Invalid cliType');
  });

  it('validates conversation messages', () => {
    expect(assertConversationMessage({ role: 'user', content: 'hello' })).toEqual({
      role: 'user',
      content: 'hello',
      metadata: undefined,
    });
    expect(() => assertConversationMessage({ role: 'system', content: 'hello' })).toThrow('Invalid message.role');
  });
});
