import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import type { CLIConfig, CLIType } from '../../shared/ipc';

type ConfigPaths = Record<CLIType, string>;

export class ConfigService {
  private configPaths: ConfigPaths;

  constructor(configPaths?: Partial<ConfigPaths>) {
    const defaultConfigPaths: ConfigPaths = {
      claude: path.join(os.homedir(), '.claude'),
      copilot: os.platform() === 'win32'
        ? path.join(process.env.APPDATA || '', 'github-copilot')
        : path.join(os.homedir(), '.config', 'github-copilot'),
      codex: path.join(os.homedir(), '.codex'),
      qoder: path.join(os.homedir(), '.qoder'),
    };

    this.configPaths = {
      ...defaultConfigPaths,
      ...configPaths,
    };
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
    const envVars = await this.readJsonFile<Record<string, string>>(envPath, {});

    envVars[key] = value;
    await this.writeFileSafely(envPath, JSON.stringify(envVars, null, 2));
  }

  async deleteEnvVar(cliType: CLIType, key: string): Promise<void> {
    const envPath = path.join(this.configPaths[cliType], 'env.json');
    if (!fs.existsSync(envPath)) {
      return;
    }

    const envVars = await this.readJsonFile<Record<string, string>>(envPath, {});
    delete envVars[key];
    await this.writeFileSafely(envPath, JSON.stringify(envVars, null, 2));
  }

  async getEnvVar(cliType: CLIType, key: string): Promise<string | null> {
    const envPath = path.join(this.configPaths[cliType], 'env.json');
    const envVars = await this.readJsonFile<Record<string, string>>(envPath, {});
    return envVars[key] || null;
  }

  private async loadConfig(cliType: CLIType): Promise<Record<string, unknown>> {
    const configPath = path.join(this.configPaths[cliType], 'config.json');
    return this.readJsonFile(configPath, {});
  }

  private async loadEnvVars(cliType: CLIType): Promise<Record<string, string>> {
    const envPath = path.join(this.configPaths[cliType], 'env.json');
    return this.readJsonFile(envPath, {});
  }

  private async readJsonFile<T extends Record<string, unknown>>(filePath: string, missingDefault: T): Promise<T> {
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      if (!content) return missingDefault;
      return JSON.parse(content) as T;
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
        return missingDefault;
      }
      throw new Error(`Invalid JSON in ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
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

    if (originalExists && fs.existsSync(backupPath)) {
      await fs.promises.unlink(backupPath);
    }
  }

  getConfigPath(cliType: CLIType): string {
    return this.configPaths[cliType];
  }
}
