import * as os from 'os';
import * as path from 'path';
import { BaseCLIService } from './base-cli';

export class CodexCLIService extends BaseCLIService<'codex'> {
  constructor() {
    super({
      cliType: 'codex',
      commands: ['codex'],
      configPath: path.join(os.homedir(), '.codex'),
    });
  }
}
