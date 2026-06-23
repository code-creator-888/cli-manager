import * as os from 'os';
import * as path from 'path';
import { BaseCLIService } from './base-cli';

export class QoderCLIService extends BaseCLIService<'qoder'> {
  constructor() {
    super({
      cliType: 'qoder',
      commands: ['qodercli'],
      configPath: path.join(os.homedir(), '.qoder'),
    });
  }
}
