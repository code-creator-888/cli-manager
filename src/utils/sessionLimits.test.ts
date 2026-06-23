import { describe, expect, it } from 'vitest';
import { canCreateTerminalSession, getSessionsForCLI, MAX_TERMINAL_SESSIONS_PER_CLI } from './sessionLimits';
import type { TerminalSession } from '../types';

function session(id: string, cliType: TerminalSession['cliType']): TerminalSession {
  return {
    id,
    cliType,
    createdAt: new Date(),
    lastActivity: new Date(),
  };
}

describe('sessionLimits', () => {
  it('counts sessions for the selected CLI only', () => {
    const sessions = {
      c1: session('c1', 'claude'),
      c2: session('c2', 'claude'),
      p1: session('p1', 'copilot'),
    };

    expect(getSessionsForCLI(sessions, 'claude')).toHaveLength(2);
    expect(getSessionsForCLI(sessions, 'copilot')).toHaveLength(1);
  });

  it('allows creating sessions below the per-CLI limit', () => {
    const sessions = Object.fromEntries(
      Array.from({ length: MAX_TERMINAL_SESSIONS_PER_CLI - 1 }, (_, index) => {
        const id = `claude-${index}`;
        return [id, session(id, 'claude')];
      })
    );

    expect(canCreateTerminalSession(sessions, 'claude')).toBe(true);
  });

  it('blocks creating sessions at the per-CLI limit without affecting other CLIs', () => {
    const sessions = Object.fromEntries(
      Array.from({ length: MAX_TERMINAL_SESSIONS_PER_CLI }, (_, index) => {
        const id = `claude-${index}`;
        return [id, session(id, 'claude')];
      })
    );

    expect(canCreateTerminalSession(sessions, 'claude')).toBe(false);
    expect(canCreateTerminalSession(sessions, 'copilot')).toBe(true);
  });
});
