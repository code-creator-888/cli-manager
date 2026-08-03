import type { CLIType } from '../types';

export function getCLILabel(cliType: CLIType): string {
  switch (cliType) {
    case 'claude':  return 'Claude';
    case 'copilot': return 'Copilot';
    case 'codex':   return 'Codex';
    default:        return 'Qoder';
  }
}

export function getCLIBadgeClass(cliType: CLIType): string {
  switch (cliType) {
    case 'claude':  return 'bg-claude-primary/20 text-claude-secondary';
    case 'copilot': return 'bg-copilot-primary/20 text-copilot-secondary';
    case 'codex':   return 'bg-codex-primary/20 text-codex-secondary';
    default:        return 'bg-qoder-primary/20 text-qoder-secondary';
  }
}

export function getCLIActiveClass(cliType: CLIType): string {
  switch (cliType) {
    case 'claude':  return 'bg-claude-primary text-white';
    case 'copilot': return 'bg-copilot-primary text-white';
    case 'codex':   return 'bg-codex-primary text-white';
    default:        return 'bg-qoder-primary text-white';
  }
}

export function getCLIPrimaryColor(cliType: CLIType): string {
  switch (cliType) {
    case 'claude':  return 'bg-claude-primary';
    case 'copilot': return 'bg-copilot-primary';
    case 'codex':   return 'bg-codex-primary';
    default:        return 'bg-qoder-primary';
  }
}
