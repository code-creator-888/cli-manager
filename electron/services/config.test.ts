import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ConfigService } from './config';

let tempDir: string;
let service: ConfigService;

beforeEach(async () => {
  tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'cli-manager-config-'));
  service = new ConfigService({
    claude: path.join(tempDir, 'claude'),
    copilot: path.join(tempDir, 'copilot'),
    codex: path.join(tempDir, 'codex'),
    qoder: path.join(tempDir, 'qoder'),
  });
});

afterEach(async () => {
  await fs.promises.rm(tempDir, { recursive: true, force: true });
});

describe('ConfigService', () => {
  it('returns defaults only when config files are missing', async () => {
    await expect(service.getSettings()).resolves.toEqual({
      path: path.join(tempDir, 'claude', 'settings.json'),
      content: {},
    });

    await expect(service.getCodexConfig()).resolves.toEqual({
      path: path.join(tempDir, 'codex', 'config.toml'),
      content: '',
    });
  });

  it('throws on invalid JSON instead of silently returning an empty object', async () => {
    const settingsPath = path.join(tempDir, 'claude', 'settings.json');
    await fs.promises.mkdir(path.dirname(settingsPath), { recursive: true });
    await fs.promises.writeFile(settingsPath, '{ invalid json', 'utf-8');

    await expect(service.getSettings()).rejects.toThrow(`Invalid JSON in ${settingsPath}`);
  });

  it('does not overwrite existing invalid config when merging updates', async () => {
    const configPath = path.join(tempDir, 'claude', 'config.json');
    await fs.promises.mkdir(path.dirname(configPath), { recursive: true });
    await fs.promises.writeFile(configPath, '{ invalid json', 'utf-8');

    await expect(service.set('claude', { enabled: true })).rejects.toThrow(`Invalid JSON in ${configPath}`);
    await expect(fs.promises.readFile(configPath, 'utf-8')).resolves.toBe('{ invalid json');
  });

  it('writes config atomically and removes the temporary backup after success', async () => {
    const settingsPath = path.join(tempDir, 'claude', 'settings.json');
    await fs.promises.mkdir(path.dirname(settingsPath), { recursive: true });
    await fs.promises.writeFile(settingsPath, '{"old":true}', 'utf-8');

    await service.setSettings({ updated: true });

    await expect(fs.promises.readFile(settingsPath, 'utf-8')).resolves.toBe(JSON.stringify({ updated: true }, null, 2));
    expect(fs.existsSync(`${settingsPath}.bak`)).toBe(false);
  });

  it('does not create env.json when deleting a missing env var file', async () => {
    const envPath = path.join(tempDir, 'claude', 'env.json');

    await service.deleteEnvVar('claude', 'TOKEN');

    expect(fs.existsSync(envPath)).toBe(false);
  });
});
