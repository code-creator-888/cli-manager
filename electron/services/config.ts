import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import type { CLIConfig, CLIType, ConfigFileResult } from '../../shared/ipc';

type ConfigPaths = Record<CLIType, string>;

export class ConfigService {
  private configPaths: ConfigPaths;
  private includeGlobalFallbacks: boolean;

  constructor(configPaths?: Partial<ConfigPaths>) {
    this.includeGlobalFallbacks = !configPaths;
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

  // Settings file paths
  private getSettingsPath(): string {
    return this.getSettingsCandidates()[0];
  }

  private getAppsPath(): string {
    return this.getAppsCandidates()[0];
  }

  // Settings.json methods for Claude
  async getSettings(): Promise<ConfigFileResult<Record<string, unknown>>> {
    return this.getConfigFileResult(this.getSettingsCandidates(), (filePath) => this.readJsonFile(filePath, {}));
  }

  async setSettings(settings: Record<string, unknown>): Promise<void> {
    const settingsPath = this.resolveCandidatePath(this.getSettingsCandidates());
    await this.writeFileSafely(settingsPath, JSON.stringify(settings, null, 2));
  }

  // Apps.json methods for Copilot
  async getApps(): Promise<ConfigFileResult<Record<string, unknown>>> {
    return this.getConfigFileResult(this.getAppsCandidates(), (filePath) => this.readJsonFile(filePath, {}));
  }

  async setApps(apps: Record<string, unknown>): Promise<void> {
    const appsPath = this.resolveCandidatePath(this.getAppsCandidates());
    await this.writeFileSafely(appsPath, JSON.stringify(apps, null, 2));
  }

  // Config.json methods for Codex
  private getCodexConfigPath(): string {
    // Codex CLI 使用 config.toml 而不是 config.json
    return this.getCodexConfigCandidates()[0];
  }

  async getCodexConfig(): Promise<ConfigFileResult<string>> {
    return this.getConfigFileResult(this.getCodexConfigCandidates(), (filePath) => this.readTextFile(filePath, ''));
  }

  async setCodexConfig(content: string): Promise<void> {
    const configPath = this.resolveCandidatePath(this.getCodexConfigCandidates());
    await this.writeFileSafely(configPath, content);
  }

  // Settings.json methods for Qoder
  private getQoderSettingsPath(): string {
    return this.getQoderSettingsCandidates()[0];
  }

  async getQoderSettings(): Promise<ConfigFileResult<Record<string, unknown>>> {
    return this.getConfigFileResult(this.getQoderSettingsCandidates(), (filePath) => this.readJsonFile(filePath, {}));
  }

  async setQoderSettings(settings: Record<string, unknown>): Promise<void> {
    const settingsPath = this.resolveCandidatePath(this.getQoderSettingsCandidates());
    await this.writeFileSafely(settingsPath, JSON.stringify(settings, null, 2));
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

  private async readTextFile(filePath: string, missingDefault: string): Promise<string> {
    try {
      return await fs.promises.readFile(filePath, 'utf-8');
    } catch (error) {
      if (this.isMissingFileError(error)) {
        return missingDefault;
      }

      throw error;
    }
  }

  private async readJsonFile<T extends Record<string, unknown>>(filePath: string, missingDefault: T): Promise<T> {
    const content = await this.readTextFile(filePath, '');
    if (!content) {
      return missingDefault;
    }

    try {
      return JSON.parse(content) as T;
    } catch (error) {
      throw new Error(`Invalid JSON in ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private isMissingFileError(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
  }

  private getSettingsCandidates(): string[] {
    return this.uniquePaths([
      path.join(this.configPaths.claude, 'settings.json'),
      path.join(this.configPaths.claude, 'config.json'),
      ...this.globalFallbacks(path.join(os.homedir(), '.claude.json')),
    ]);
  }

  private getAppsCandidates(): string[] {
    return this.uniquePaths([
      path.join(this.configPaths.copilot, 'apps.json'),
      path.join(this.configPaths.copilot, 'config.json'),
      ...this.globalFallbacks(
        path.join(os.homedir(), '.github-copilot', 'apps.json'),
        path.join(os.homedir(), '.copilot', 'config.json')
      ),
    ]);
  }

  private getCodexConfigCandidates(): string[] {
    return this.uniquePaths([
      path.join(this.configPaths.codex, 'config.toml'),
      path.join(this.configPaths.codex, 'config.json'),
      ...this.globalFallbacks(path.join(os.homedir(), '.config', 'codex', 'config.toml')),
    ]);
  }

  private getQoderSettingsCandidates(): string[] {
    return this.uniquePaths([
      path.join(this.configPaths.qoder, 'settings.json'),
      path.join(this.configPaths.qoder, 'config.json'),
      ...this.globalFallbacks(path.join(os.homedir(), '.config', 'qoder', 'settings.json')),
    ]);
  }

  private globalFallbacks(...paths: string[]): string[] {
    return this.includeGlobalFallbacks ? paths : [];
  }

  private uniquePaths(paths: string[]): string[] {
    return Array.from(new Set(paths));
  }

  private resolveCandidatePath(candidates: string[]): string {
    return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0];
  }

  private async getConfigFileResult<T>(
    candidates: string[],
    readContent: (filePath: string) => Promise<T>
  ): Promise<ConfigFileResult<T>> {
    const candidateResults = candidates.map((candidate) => ({
      path: candidate,
      exists: fs.existsSync(candidate),
    }));
    const selectedPath = candidateResults.find((candidate) => candidate.exists)?.path || candidates[0];

    return {
      path: selectedPath,
      exists: fs.existsSync(selectedPath),
      candidates: candidateResults,
      content: await readContent(selectedPath),
    };
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
