import { describe, expect, it } from 'vitest';
import { BaseCLIService, isProcessNameMatch, ProcessInfo } from './base-cli';

class TestCLIService extends BaseCLIService<'claude'> {
  public installedCommands = new Set<string>();
  public versions = new Map<string, string | null>();
  public processInfo: ProcessInfo | undefined;

  constructor(commands: string[]) {
    super({
      cliType: 'claude',
      commands,
      configPath: '/tmp/claude',
    });
  }

  protected async hasCommand(command: string): Promise<boolean> {
    return this.installedCommands.has(command);
  }

  protected async getVersion(command: string): Promise<string | null> {
    return this.versions.get(command) ?? null;
  }

  protected async getProcessInfo(): Promise<ProcessInfo | undefined> {
    return this.processInfo;
  }
}

describe('BaseCLIService', () => {
  it('uses the first installed fallback command for status checks', async () => {
    const service = new TestCLIService(['missing', 'claude']);
    service.installedCommands.add('claude');
    service.versions.set('claude', '1.2.3');
    service.processInfo = { pid: 123, cpu: 4.5, memory: 6.7 };

    const status = await service.checkStatus();

    expect(status).toMatchObject({
      cliType: 'claude',
      installed: true,
      version: '1.2.3',
      running: true,
      pid: 123,
      cpuUsage: 4.5,
      memoryUsage: 6.7,
    });
  });

  describe('isProcessNameMatch', () => {
    it('matches exact command basenames', () => {
      expect(isProcessNameMatch('/opt/bin/copilot', '/opt/bin/copilot', ['copilot'])).toBe(true);
    });

    it('matches node-launched CLI script basenames', () => {
      expect(isProcessNameMatch('/usr/local/bin/node', 'node /opt/bin/github-copilot-cli', ['github-copilot-cli'])).toBe(true);
    });

    it('does not match arbitrary paths that only contain the CLI name', () => {
      expect(isProcessNameMatch('/Applications/Electron', '/Users/me/copilot-project/Electron', ['copilot'])).toBe(false);
    });
  });

  it('reports not installed without probing version or process info', async () => {
    const service = new TestCLIService(['missing']);

    const status = await service.checkStatus();

    expect(status.installed).toBe(false);
    expect(status.version).toBeNull();
    expect(status.running).toBe(false);
    expect(status.pid).toBeUndefined();
  });

  it('reports installed but stopped when no matching process exists', async () => {
    const service = new TestCLIService(['claude']);
    service.installedCommands.add('claude');
    service.versions.set('claude', '1.2.3');

    const status = await service.checkStatus();

    expect(status).toMatchObject({
      installed: true,
      version: '1.2.3',
      running: false,
    });
  });
});
