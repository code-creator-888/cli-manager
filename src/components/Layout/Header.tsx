import React from 'react';
import { useAppStore } from '../../stores';
import { SidebarView } from './Sidebar';
import { getCLIBadgeClass } from '../../utils/cliUtils';
import { StatusDot } from '../shared/StatusDot';

interface HeaderProps {
  activeView: SidebarView;
}

const viewTitles: Record<SidebarView, string> = {
  terminal: 'Terminal',
  conversation: 'Conversations',
  dashboard: 'Dashboard',
};

export const Header: React.FC<HeaderProps> = ({ activeView }) => {
  const { activeCLI, statuses } = useAppStore();
  const status = statuses[activeCLI];
  const handleQuit = () => {
    window.cliManagerAPI?.app.quit();
  };

  return (
    <header className="h-12 bg-bg-secondary border-b border-bg-tertiary flex items-center px-4">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold text-text-primary">
          {viewTitles[activeView]}
        </h1>
        <span
          className={`text-sm px-2 py-0.5 rounded ${getCLIBadgeClass(activeCLI)}`}
        >
          {activeCLI.toUpperCase()}
        </span>
      </div>

      <div className="ml-auto flex items-center gap-4">
        {status && (
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <StatusDot status={status} />
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
        <button
          onClick={handleQuit}
          className="px-3 py-1.5 rounded bg-red-500/15 text-red-300 hover:bg-red-500/25 hover:text-red-200 transition-colors text-sm"
          title="退出 CLI Manager"
        >
          退出
        </button>
      </div>
    </header>
  );
};
