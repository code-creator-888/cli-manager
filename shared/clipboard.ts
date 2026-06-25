import type { CLIType } from './ipc';

export interface PastedImageDirectoryPaths {
  homeDir: string;
  tempDir: string;
}

export function getPastedImageDirectory(
  cliType: CLIType | undefined,
  paths: PastedImageDirectoryPaths
): string {
  if (cliType === 'qoder') {
    return joinPath(paths.homeDir, '.cli-manager', 'pasted-images');
  }

  return joinPath(paths.tempDir, 'cli-manager-pasted-images');
}

export function quoteTerminalPath(filePath: string): string {
  return `"${filePath.replace(/"/g, '\\"')}"`;
}

export function formatFilePathForCLI(cliType: CLIType, filePath: string): string {
  return cliType === 'qoder' ? `@${filePath}` : quoteTerminalPath(filePath);
}

export function getCopyableSelectionText(
  terminalSelection: string | undefined,
  pageSelection: string | undefined
): string {
  return terminalSelection || pageSelection || '';
}

function joinPath(basePath: string, ...segments: string[]): string {
  const separator = basePath.includes('\\') ? '\\' : '/';
  const trimmedBase = basePath.replace(/[\\/]+$/, '');
  const trimmedSegments = segments.map((segment) => segment.replace(/^[\\/]+|[\\/]+$/g, ''));
  return [trimmedBase, ...trimmedSegments].filter(Boolean).join(separator);
}
