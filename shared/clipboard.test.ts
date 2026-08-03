// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  formatFilePathForCLI,
  getCopyableSelectionText,
  getPastedImageDirectory,
  quoteTerminalPath,
} from './clipboard';

describe('clipboard helpers', () => {
  it('stores Qoder pasted images inside the home workspace', () => {
    expect(getPastedImageDirectory('qoder', {
      homeDir: '/Users/example',
      tempDir: '/var/folders/example',
    })).toBe('/Users/example/.cli-manager/pasted-images');
  });

  it('stores non-Qoder pasted images in the system temp directory', () => {
    expect(getPastedImageDirectory('copilot', {
      homeDir: '/Users/example',
      tempDir: '/var/folders/example',
    })).toBe('/var/folders/example/cli-manager-pasted-images');
  });

  it('preserves Windows-style separators when building pasted image paths', () => {
    expect(getPastedImageDirectory('qoder', {
      homeDir: 'C:\\Users\\example\\',
      tempDir: 'C:\\Temp\\',
    })).toBe('C:\\Users\\example\\.cli-manager\\pasted-images');
  });

  it('formats Qoder file context with @path syntax', () => {
    expect(formatFilePathForCLI('qoder', '/Users/example/.cli-manager/pasted-images/shot.png'))
      .toBe('@/Users/example/.cli-manager/pasted-images/shot.png');
  });

  it('quotes file paths for CLIs that accept plain terminal paths', () => {
    expect(formatFilePathForCLI('claude', '/tmp/screen "one".png'))
      .toBe('"/tmp/screen \\"one\\".png"');
    expect(quoteTerminalPath('/tmp/screen.png')).toBe('"/tmp/screen.png"');
  });

  it('copies xterm selection before browser page selection', () => {
    expect(getCopyableSelectionText('terminal text', 'page text')).toBe('terminal text');
  });

  it('falls back to browser page selection for copy events', () => {
    expect(getCopyableSelectionText('', 'page text')).toBe('page text');
  });

  it('does not handle copy without a selection', () => {
    expect(getCopyableSelectionText('', '')).toBe('');
    expect(getCopyableSelectionText(undefined, undefined)).toBe('');
  });
});
