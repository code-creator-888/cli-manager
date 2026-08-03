// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { WebContents } from 'electron';
import {
  assertTrustedIpcSender,
  configureWebContentsSecurity,
  isAllowedRendererNavigation,
} from './security';

type Listener = (...args: unknown[]) => void;

function createWebContentsMock() {
  const listeners = new Map<string, Listener>();
  const webContents = {
    setWindowOpenHandler: vi.fn(),
    on: vi.fn((event: string, listener: Listener) => {
      listeners.set(event, listener);
    }),
    session: {
      setPermissionRequestHandler: vi.fn(),
    },
  };

  return { webContents: webContents as unknown as WebContents, listeners };
}

describe('Electron security boundaries', () => {
  it('allows only the configured development origin or packaged entry page', () => {
    expect(isAllowedRendererNavigation('http://localhost:5173/settings', 'http://localhost:5173')).toBe(true);
    expect(isAllowedRendererNavigation('http://localhost:4173', 'http://localhost:5173')).toBe(false);
    expect(isAllowedRendererNavigation('https://example.com', 'http://localhost:5173')).toBe(false);
    expect(
      isAllowedRendererNavigation(
        'file:///Applications/CLI%20Manager.app/Contents/Resources/app/dist/index.html#history',
        'file:///Applications/CLI%20Manager.app/Contents/Resources/app/dist/index.html'
      )
    ).toBe(true);
    expect(
      isAllowedRendererNavigation(
        'file:///Applications/CLI%20Manager.app/Contents/Resources/app/dist/other.html',
        'file:///Applications/CLI%20Manager.app/Contents/Resources/app/dist/index.html'
      )
    ).toBe(false);
  });

  it('denies popups, webviews, permissions, and untrusted navigations', () => {
    const { webContents, listeners } = createWebContentsMock();
    configureWebContentsSecurity(webContents, 'http://localhost:5173');

    const openHandler = vi.mocked(webContents.setWindowOpenHandler).mock.calls[0][0];
    expect(openHandler({} as Parameters<typeof openHandler>[0])).toEqual({ action: 'deny' });

    for (const eventName of ['will-navigate', 'will-redirect', 'will-attach-webview']) {
      expect(listeners.has(eventName)).toBe(true);
    }

    const navigationEvent = { preventDefault: vi.fn() };
    listeners.get('will-navigate')!(navigationEvent, 'https://example.com');
    expect(navigationEvent.preventDefault).toHaveBeenCalledOnce();

    const sameOriginEvent = { preventDefault: vi.fn() };
    listeners.get('will-navigate')!(sameOriginEvent, 'http://localhost:5173');
    expect(sameOriginEvent.preventDefault).not.toHaveBeenCalled();

    const webviewEvent = { preventDefault: vi.fn() };
    listeners.get('will-attach-webview')!(webviewEvent);
    expect(webviewEvent.preventDefault).toHaveBeenCalledOnce();

    const permissionHandler = vi.mocked(webContents.session.setPermissionRequestHandler).mock.calls[0][0];
    const permissionCallback = vi.fn();
    permissionHandler(webContents, 'notifications', permissionCallback);
    expect(permissionCallback).toHaveBeenCalledWith(false);
  });

  it('accepts IPC only from the current application web contents', () => {
    const trustedSender = { isDestroyed: () => false } as WebContents;
    const untrustedSender = { isDestroyed: () => false } as WebContents;
    const event = { sender: trustedSender };

    expect(() => assertTrustedIpcSender(event, trustedSender)).not.toThrow();
    expect(() => assertTrustedIpcSender(event, untrustedSender)).toThrow('Untrusted IPC sender');
  });

  it('registers window and IPC protection through shared main-process helpers', async () => {
    const mainSource = await import('node:fs/promises').then((fs) => fs.readFile(new URL('./main.ts', import.meta.url), 'utf8'));
    const trustedRegistrations = mainSource.match(/\b(?:handleTrusted|onTrusted)\('/g) || [];
    const directRegistrations = mainSource.match(/^\s*ipcMain\.(?:handle|on)\(/gm) || [];

    expect(mainSource).toContain('configureWebContentsSecurity');
    expect(mainSource).toContain('handleTrusted');
    expect(mainSource).toContain('onTrusted');
    expect(trustedRegistrations).toHaveLength(28);
    expect(directRegistrations).toHaveLength(2);
  });
});
