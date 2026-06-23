import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { CLIStatus, CLIType } from '../../shared/ipc';

const execFileAsync = promisify(execFile);

export interface CLIServiceOptions<T extends CLIType> {
  cliType: T;
  commands: string[];
  processNames?: string[];
  configPath: string;
}

export interface ProcessInfo {
  pid: number;
  cpu: number;
  memory: number;
}

export function isProcessNameMatch(commandPath: string, args: string, processNames: string[]): boolean {
  const tokens = args.trim().split(/\s+/).filter(Boolean);
  const candidates = [
    path.basename(commandPath),
    ...tokens.slice(0, 2).map((token) => path.basename(token)),
  ];

  return processNames.some((processName) => candidates.includes(processName));
}

export class BaseCLIService<T extends CLIType> {
  protected readonly cliType: T;
  protected readonly commands: string[];
  protected readonly processNames: string[];
  protected readonly configPath: string;
  private lastStatus: CLIStatus;

  constructor(options: CLIServiceOptions<T>) {
    this.cliType = options.cliType;
    this.commands = options.commands;
    this.processNames = options.processNames || options.commands;
    this.configPath = options.configPath;
    this.lastStatus = {
      cliType: this.cliType,
      installed: false,
      version: null,
      running: false,
      lastChecked: new Date(),
    };
  }

  async checkStatus(): Promise<CLIStatus> {
    const command = await this.resolveCommand();
    const installed = command !== null;
    const version = command ? await this.getVersion(command) : null;
    const processInfo = installed ? await this.getProcessInfo() : undefined;

    this.lastStatus = {
      cliType: this.cliType,
      installed,
      version,
      running: processInfo !== undefined,
      pid: processInfo?.pid,
      cpuUsage: processInfo?.cpu,
      memoryUsage: processInfo?.memory,
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
    return (await this.resolveCommand()) !== null;
  }

  async ensureConfigDir(): Promise<void> {
    if (!fs.existsSync(this.configPath)) {
      await fs.promises.mkdir(this.configPath, { recursive: true });
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

  protected async resolveCommand(): Promise<string | null> {
    for (const command of this.commands) {
      if (await this.hasCommand(command)) {
        return command;
      }
    }

    return null;
  }

  protected async hasCommand(command: string): Promise<boolean> {
    const checker = os.platform() === 'win32' ? 'where' : 'which';
    try {
      await execFileAsync(checker, [command]);
      return true;
    } catch {
      return false;
    }
  }

  protected async getVersion(command: string): Promise<string | null> {
    try {
      const { stdout } = await execFileAsync(command, ['--version']);
      return stdout.trim();
    } catch {
      return null;
    }
  }

  protected async getProcessInfo(): Promise<ProcessInfo | undefined> {
    const pid = await this.findProcessPid();
    if (!pid) {
      return undefined;
    }

    try {
      const { stdout } = await execFileAsync('ps', ['-p', String(pid), '-o', '%cpu,%mem']);
      const [, usageLine] = stdout.trim().split('\n');
      if (!usageLine) {
        return { pid, cpu: 0, memory: 0 };
      }

      const [cpu = '0', memory = '0'] = usageLine.trim().split(/\s+/);
      return {
        pid,
        cpu: Number.parseFloat(cpu) || 0,
        memory: Number.parseFloat(memory) || 0,
      };
    } catch {
      return { pid, cpu: 0, memory: 0 };
    }
  }

  protected async findProcessPid(): Promise<number | undefined> {
    if (os.platform() === 'win32') {
      return undefined;
    }

    try {
      const { stdout } = await execFileAsync('ps', ['-axo', 'pid=,comm=,args=']);
      for (const line of stdout.split('\n')) {
        const match = line.match(/^\s*(\d+)\s+(\S+)\s*(.*)$/);
        if (!match) {
          continue;
        }

        const pid = Number.parseInt(match[1], 10);
        const commandPath = match[2];
        const args = match[3] || '';
        if (pid !== process.pid && isProcessNameMatch(commandPath, args, this.processNames)) {
          return pid;
        }
      }
    } catch {
      return undefined;
    }

    return undefined;
  }
}
