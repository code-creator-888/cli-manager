import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

const execAsync = promisify(exec);

export interface CLIStatus {
  cliType: 'claude';
  installed: boolean;
  version: string | null;
  running: boolean;
  pid?: number;
  cpuUsage?: number;
  memoryUsage?: number;
  lastChecked: Date;
}

export class ClaudeCLIService {
  private configPath: string;
  private lastStatus: CLIStatus;

  constructor() {
    this.configPath = path.join(os.homedir(), '.claude');
    this.lastStatus = {
      cliType: 'claude',
      installed: false,
      version: null,
      running: false,
      lastChecked: new Date(),
    };
  }

  async checkStatus(): Promise<CLIStatus> {
    const installed = await this.checkInstalled();
    const version = installed ? await this.getVersion() : null;
    const running = installed ? await this.checkRunning() : false;

    let pid: number | undefined;
    let cpuUsage: number | undefined;
    let memoryUsage: number | undefined;

    if (running) {
      const processInfo = await this.getProcessInfo();
      pid = processInfo?.pid;
      cpuUsage = processInfo?.cpu;
      memoryUsage = processInfo?.memory;
    }

    this.lastStatus = {
      cliType: 'claude',
      installed,
      version,
      running,
      pid,
      cpuUsage,
      memoryUsage,
      lastChecked: new Date(),
    };

    return this.lastStatus;
  }

  getStatus(): CLIStatus {
    return this.lastStatus;
  }

  getConfigPath(): string {
    return this.configPath;
  }

  async checkInstalled(): Promise<boolean> {
    try {
      await execAsync('which claude');
      return true;
    } catch {
      return false;
    }
  }

  private async getVersion(): Promise<string | null> {
    try {
      const { stdout } = await execAsync('claude --version');
      return stdout.trim();
    } catch {
      return null;
    }
  }

  private async checkRunning(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('pgrep -f "claude"');
      return stdout.trim().length > 0;
    } catch {
      return false;
    }
  }

  private async getProcessInfo(): Promise<{ pid: number; cpu: number; memory: number } | undefined> {
    try {
      const { stdout } = await execAsync('pgrep -f "claude"');
      const pid = parseInt(stdout.trim().split('\n')[0], 10);

      if (isNaN(pid)) return undefined;

      // Get CPU and memory usage
      const { stdout: psOutput } = await execAsync(`ps -p ${pid} -o %cpu,%mem`);
      const lines = psOutput.trim().split('\n');
      if (lines.length > 1) {
        const parts = lines[1].trim().split(/\s+/);
        return {
          pid,
          cpu: parseFloat(parts[0]) || 0,
          memory: parseFloat(parts[1]) || 0,
        };
      }

      return { pid, cpu: 0, memory: 0 };
    } catch {
      return undefined;
    }
  }

  async ensureConfigDir(): Promise<void> {
    if (!fs.existsSync(this.configPath)) {
      fs.mkdirSync(this.configPath, { recursive: true });
    }
  }

  async readConfigFile(filename: string): Promise<Record<string, unknown> | null> {
    const filePath = path.join(this.configPath, filename);
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  async writeConfigFile(filename: string, config: Record<string, unknown>): Promise<void> {
    await this.ensureConfigDir();
    const filePath = path.join(this.configPath, filename);
    await fs.promises.writeFile(filePath, JSON.stringify(config, null, 2));
  }
}
