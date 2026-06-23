import * as os from 'os';
import * as path from 'path';
import { BaseCLIService } from './base-cli';

export class ClaudeCLIService extends BaseCLIService<'claude'> {
  constructor() {
    super({
      cliType: 'claude',
      commands: ['claude'],
      configPath: path.join(os.homedir(), '.claude'),
    });
  }
}
