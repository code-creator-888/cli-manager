import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BaseCLIService } from './base-cli';

export class CopilotCLIService extends BaseCLIService<'copilot'> {
  constructor() {
    super({
      cliType: 'copilot',
      commands: ['copilot', 'github-copilot-cli'],
      processNames: ['copilot', 'github-copilot-cli'],
      configPath: os.platform() === 'win32'
        ? path.join(process.env.APPDATA || '', 'github-copilot')
        : path.join(os.homedir(), '.config', 'github-copilot'),
    });
  }

  async getProjectConfig(projectPath: string): Promise<Record<string, unknown> | null> {
    const rcPath = path.join(projectPath, '.copilotrc');
    try {
      const content = await fs.promises.readFile(rcPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }
}
