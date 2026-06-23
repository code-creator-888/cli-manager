import React from 'react';
import { useAppStore } from '../../stores';

const claudeIcon = (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
  </svg>
);

const copilotIcon = (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5.5-2.5l7.51-3.49L17.5 6.5 9.99 9.99 6.5 17.5zm5.5-6.6c.61 0 1.1.49 1.1 1.1s-.49 1.1-1.1 1.1-1.1-.49-1.1-1.1.49-1.1 1.1-1.1z"/>
  </svg>
);

const codexIcon = (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
  </svg>
);

const qoderIcon = (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
    <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V8h16v10zm-8-2h6v2h-6v-2zm-5.5-.5l-1.41-1.41L8.67 12l-2.59-2.59L7.5 8l4 4-4 4z"/>
  </svg>
);

const settingsIcon = (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
    <path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
  </svg>
);

const dashboardIcon = (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
    <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
  </svg>
);

const conversationIcon = (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" />
  </svg>
);

export type SidebarView = 'dashboard' | 'terminal' | 'conversation' | 'config';

interface SidebarProps {
  activeView: SidebarView;
  onViewChange: (view: SidebarView) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeView, onViewChange }) => {
  const { activeCLI, setActiveCLI, statuses } = useAppStore();

  const cliStatus = (cli: 'claude' | 'copilot' | 'codex' | 'qoder') => {
    const status = statuses[cli];
    if (!status) return 'unknown';
    if (!status.installed) return 'not-installed';
    if (status.running) return 'running';
    return 'stopped';
  };

  return (
    <div className="w-16 bg-bg-secondary flex flex-col items-center py-4 border-r border-bg-tertiary">
      {/* CLI Type Selector */}
      <div className="flex flex-col gap-2 mb-8">
        <button
          onClick={() => setActiveCLI('claude')}
          className={`p-3 rounded-lg transition-all ${
            activeCLI === 'claude'
              ? 'bg-claude-primary text-white'
              : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
          }`}
          title="Claude CLI"
        >
          {claudeIcon}
        </button>
        <div className="flex justify-center">
          <span
            className={`w-2 h-2 rounded-full ${
              cliStatus('claude') === 'running'
                ? 'bg-green-500'
                : cliStatus('claude') === 'not-installed'
                ? 'bg-red-500'
                : 'bg-yellow-500'
            }`}
          />
        </div>

        <button
          onClick={() => setActiveCLI('copilot')}
          className={`p-3 rounded-lg transition-all ${
            activeCLI === 'copilot'
              ? 'bg-copilot-primary text-white'
              : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
          }`}
          title="Copilot CLI"
        >
          {copilotIcon}
        </button>
        <div className="flex justify-center">
          <span
            className={`w-2 h-2 rounded-full ${
              cliStatus('copilot') === 'running'
                ? 'bg-green-500'
                : cliStatus('copilot') === 'not-installed'
                ? 'bg-red-500'
                : 'bg-yellow-500'
            }`}
          />
        </div>

        <button
          onClick={() => setActiveCLI('codex')}
          className={`p-3 rounded-lg transition-all ${
            activeCLI === 'codex'
              ? 'bg-codex-primary text-white'
              : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
          }`}
          title="Codex CLI"
        >
          {codexIcon}
        </button>
        <div className="flex justify-center">
          <span
            className={`w-2 h-2 rounded-full ${
              cliStatus('codex') === 'running'
                ? 'bg-green-500'
                : cliStatus('codex') === 'not-installed'
                ? 'bg-red-500'
                : 'bg-yellow-500'
            }`}
          />
        </div>

        <button
          onClick={() => setActiveCLI('qoder')}
          className={`p-3 rounded-lg transition-all ${
            activeCLI === 'qoder'
              ? 'bg-qoder-primary text-white'
              : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
          }`}
          title="Qoder CLI"
        >
          {qoderIcon}
        </button>
        <div className="flex justify-center">
          <span
            className={`w-2 h-2 rounded-full ${
              cliStatus('qoder') === 'running'
                ? 'bg-green-500'
                : cliStatus('qoder') === 'not-installed'
                ? 'bg-red-500'
                : 'bg-yellow-500'
            }`}
          />
        </div>
      </div>

      {/* View Selector */}
      <div className="flex flex-col gap-2 flex-1">
        <button
          onClick={() => onViewChange('dashboard')}
          className={`p-3 rounded-lg transition-all ${
            activeView === 'dashboard'
              ? 'bg-bg-tertiary text-text-primary'
              : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
          }`}
          title="Dashboard"
        >
          {dashboardIcon}
        </button>

        <button
          onClick={() => onViewChange('terminal')}
          className={`p-3 rounded-lg transition-all ${
            activeView === 'terminal'
              ? 'bg-bg-tertiary text-text-primary'
              : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
          }`}
          title="Terminal"
        >
          <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
            <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V8h16v10zm-2-1h-6v-2h6v2zM7.5 17l-1.41-1.41L8.67 13l-2.59-2.59L7.5 9l4 4-4 4z"/>
          </svg>
        </button>

        <button
          onClick={() => onViewChange('conversation')}
          className={`p-3 rounded-lg transition-all ${
            activeView === 'conversation'
              ? 'bg-bg-tertiary text-text-primary'
              : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
          }`}
          title="Conversations"
        >
          {conversationIcon}
        </button>

        <button
          onClick={() => onViewChange('config')}
          className={`p-3 rounded-lg transition-all ${
            activeView === 'config'
              ? 'bg-bg-tertiary text-text-primary'
              : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
          }`}
          title="Settings"
        >
          {settingsIcon}
        </button>
      </div>

      {/* App Info */}
      <div className="mt-auto text-text-secondary text-xs">
        CLI
      </div>
    </div>
  );
};
