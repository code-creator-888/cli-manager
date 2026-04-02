import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

export type CLIType = 'claude' | 'copilot' | 'codex';

export interface CLIConfig {
  cliType: CLIType;
  configPath: string;
  config: Record<string, unknown>;
  envVars: Record<string, string>;
}

export class ConfigService {
  private configPaths: Record<CLIType, string>;

  constructor() {
    this.configPaths = {
      claude: path.join(os.homedir(), '.claude'),
      copilot: os.platform() === 'win32'
        ? path.join(process.env.APPDATA || '', 'github-copilot')
        : path.join(os.homedir(), '.config', 'github-copilot'),
      codex: path.join(os.homedir(), '.codex'),
    };
  }

  // Settings file paths
  private getSettingsPath(): string {
    return path.join(this.configPaths.claude, 'settings.json');
  }

  private getAppsPath(): string {
    return path.join(this.configPaths.copilot, 'apps.json');
  }

  // Settings.json methods for Claude
  async getSettings(): Promise<{ path: string; content: Record<string, unknown> }> {
    const settingsPath = this.getSettingsPath();
    try {
      const content = await fs.promises.readFile(settingsPath, 'utf-8');
      return { path: settingsPath, content: JSON.parse(content) };
    } catch {
      return { path: settingsPath, content: {} };
    }
  }

  async setSettings(settings: Record<string, unknown>): Promise<void> {
    const settingsPath = this.getSettingsPath();
    await this.writeFileSafely(settingsPath, JSON.stringify(settings, null, 2));
  }

  // Apps.json methods for Copilot
  async getApps(): Promise<{ path: string; content: Record<string, unknown> }> {
    const appsPath = this.getAppsPath();
    try {
      const content = await fs.promises.readFile(appsPath, 'utf-8');
      return { path: appsPath, content: JSON.parse(content) };
    } catch {
      return { path: appsPath, content: {} };
    }
  }

  async setApps(apps: Record<string, unknown>): Promise<void> {
    const appsPath = this.getAppsPath();
    await this.writeFileSafely(appsPath, JSON.stringify(apps, null, 2));
  }

  // Config.json methods for Codex
  private getCodexConfigPath(): string {
    // Codex CLI 使用 config.toml 而不是 config.json
    return path.join(this.configPaths.codex, 'config.toml');
  }

  async getCodexConfig(): Promise<{ path: string; content: string }> {
    const configPath = this.getCodexConfigPath();
    try {
      const content = await fs.promises.readFile(configPath, 'utf-8');
      return { path: configPath, content };
    } catch {
      return { path: configPath, content: '' };
    }
  }

  async setCodexConfig(content: string): Promise<void> {
    const configPath = this.getCodexConfigPath();
    await this.writeFileSafely(configPath, content);
  }

  async get(cliType: CLIType): Promise<CLIConfig> {
    const configPath = this.configPaths[cliType];
    const config = await this.loadConfig(cliType);
    const envVars = await this.loadEnvVars(cliType);

    return {
      cliType,
      configPath,
      config,
      envVars,
    };
  }

  async set(cliType: CLIType, updates: Record<string, unknown>): Promise<void> {
    const configPath = this.configPaths[cliType];
    const config = await this.loadConfig(cliType);

    const merged = { ...config, ...updates };

    await this.writeFileSafely(
      path.join(configPath, 'config.json'),
      JSON.stringify(merged, null, 2)
    );
  }

  async setEnvVar(cliType: CLIType, key: string, value: string): Promise<void> {
    const envPath = path.join(this.configPaths[cliType], 'env.json');
    let envVars: Record<string, string> = {};

    try {
      const content = await fs.promises.readFile(envPath, 'utf-8');
      envVars = JSON.parse(content);
    } catch {
      // File doesn't exist
    }

    envVars[key] = value;
    await this.writeFileSafely(envPath, JSON.stringify(envVars, null, 2));
  }

  async deleteEnvVar(cliType: CLIType, key: string): Promise<void> {
    const envPath = path.join(this.configPaths[cliType], 'env.json');
    try {
      const content = await fs.promises.readFile(envPath, 'utf-8');
      const envVars: Record<string, string> = JSON.parse(content);
      delete envVars[key];
      await this.writeFileSafely(envPath, JSON.stringify(envVars, null, 2));
    } catch {
      // File doesn't exist, nothing to delete
    }
  }

  async getEnvVar(cliType: CLIType, key: string): Promise<string | null> {
    const envPath = path.join(this.configPaths[cliType], 'env.json');
    try {
      const content = await fs.promises.readFile(envPath, 'utf-8');
      const envVars: Record<string, string> = JSON.parse(content);
      return envVars[key] || null;
    } catch {
      return null;
    }
  }

  private async loadConfig(cliType: CLIType): Promise<Record<string, unknown>> {
    const configPath = path.join(this.configPaths[cliType], 'config.json');

    try {
      const content = await fs.promises.readFile(configPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return {};
    }
  }

  private async loadEnvVars(cliType: CLIType): Promise<Record<string, string>> {
    const envPath = path.join(this.configPaths[cliType], 'env.json');
    const envVars: Record<string, string> = {};

    try {
      const content = await fs.promises.readFile(envPath, 'utf-8');
      Object.assign(envVars, JSON.parse(content));
    } catch {
      // File doesn't exist
    }

    return envVars;
  }

  private async ensureDir(dir: string): Promise<void> {
    if (!fs.existsSync(dir)) {
      await fs.promises.mkdir(dir, { recursive: true });
    }
  }

  private async writeFileSafely(filePath: string, content: string): Promise<void> {
    const dir = path.dirname(filePath);
    await this.ensureDir(dir);

    const tempPath = path.join(dir, `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
    const backupPath = `${filePath}.bak`;
    const originalExists = fs.existsSync(filePath);

    if (originalExists) {
      await fs.promises.copyFile(filePath, backupPath);
    }

    try {
      await fs.promises.writeFile(tempPath, content, 'utf-8');
      await fs.promises.rename(tempPath, filePath);
    } catch (error) {
      try {
        await fs.promises.unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }

      if (originalExists && fs.existsSync(backupPath)) {
        await fs.promises.copyFile(backupPath, filePath);
      }

      throw error;
    }
  }

  getConfigPath(cliType: CLIType): string {
    return this.configPaths[cliType];
  }
}
