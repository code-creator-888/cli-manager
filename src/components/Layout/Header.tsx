import React from 'react';
import { useAppStore } from '../../stores';
import { SidebarView } from './Sidebar';

interface HeaderProps {
  activeView: SidebarView;
}

const viewTitles: Record<SidebarView, string> = {
  terminal: 'Terminal',
  conversation: 'Conversations',
  config: 'Configuration',
};

export const Header: React.FC<HeaderProps> = ({ activeView }) => {
  const { activeCLI, statuses } = useAppStore();
  const status = statuses[activeCLI];

  return (
    <header className="h-12 bg-bg-secondary border-b border-bg-tertiary flex items-center px-4">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold text-text-primary">
          {viewTitles[activeView]}
        </h1>
        <span
          className={`text-sm px-2 py-0.5 rounded ${
            activeCLI === 'claude'
              ? 'bg-claude-primary/20 text-claude-secondary'
              : activeCLI === 'copilot'
              ? 'bg-copilot-primary/20 text-copilot-secondary'
              : activeCLI === 'codex'
              ? 'bg-codex-primary/20 text-codex-secondary'
              : 'bg-gray-500/20 text-gray-400'
          }`}
        >
          {activeCLI.toUpperCase()}
        </span>
      </div>

      <div className="ml-auto flex items-center gap-4">
        {status && (
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <span
              className={`w-2 h-2 rounded-full ${
                status.running ? 'bg-green-500' : status.installed ? 'bg-yellow-500' : 'bg-red-500'
              }`}
            />
            <span>
              {status.running
                ? 'Running'
                : status.installed
                ? 'Installed'
                : 'Not Installed'}
            </span>
            {status.version && (
              <span className="text-text-secondary">({status.version})</span>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
