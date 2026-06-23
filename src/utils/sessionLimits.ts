import type { CLIType, TerminalSession } from '../types';

export const MAX_TERMINAL_SESSIONS_PER_CLI = 5;

export function getSessionsForCLI(
  sessions: Record<string, TerminalSession>,
  cliType: CLIType
): TerminalSession[] {
  return Object.values(sessions).filter((session) => session.cliType === cliType);
}

export function canCreateTerminalSession(
  sessions: Record<string, TerminalSession>,
  cliType: CLIType
): boolean {
  return getSessionsForCLI(sessions, cliType).length < MAX_TERMINAL_SESSIONS_PER_CLI;
}

export function getTerminalSessionLimitMessage(cliType: CLIType): string {
  return `${cliType.toUpperCase()} already has ${MAX_TERMINAL_SESSIONS_PER_CLI} terminal sessions. Close one before creating another.`;
}
