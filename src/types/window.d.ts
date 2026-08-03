import { CLIManagerAPI } from '../../shared/ipc';

declare global {
  interface Window {
    cliManagerAPI?: CLIManagerAPI;
  }
}

export {};