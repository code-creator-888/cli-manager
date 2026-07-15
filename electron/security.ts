import type { IpcMainEvent, IpcMainInvokeEvent, WebContents } from 'electron';

type IpcSenderEvent = Pick<IpcMainEvent | IpcMainInvokeEvent, 'sender'>;

export function isAllowedRendererNavigation(navigationUrl: string, rendererUrl: string): boolean {
  try {
    const candidate = new URL(navigationUrl);
    const allowed = new URL(rendererUrl);

    if (allowed.protocol === 'file:') {
      return candidate.protocol === 'file:' && candidate.pathname === allowed.pathname;
    }

    return candidate.origin === allowed.origin;
  } catch {
    return false;
  }
}

export function configureWebContentsSecurity(webContents: WebContents, rendererUrl: string): void {
  const blockUntrustedNavigation = (event: { preventDefault: () => void }, navigationUrl: string) => {
    if (!isAllowedRendererNavigation(navigationUrl, rendererUrl)) {
      event.preventDefault();
    }
  };

  webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  webContents.on('will-navigate', blockUntrustedNavigation);
  webContents.on('will-redirect', blockUntrustedNavigation);
  webContents.on('will-attach-webview', (event) => event.preventDefault());
  webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
}

export function assertTrustedIpcSender(event: IpcSenderEvent, trustedWebContents: WebContents | null): void {
  if (!trustedWebContents || trustedWebContents.isDestroyed() || event.sender !== trustedWebContents) {
    throw new Error('Untrusted IPC sender');
  }
}
