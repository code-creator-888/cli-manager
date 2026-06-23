import React from 'react';
import { useAppStore } from '../../stores';

const claudeIcon = (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="2" />
    <text x="12" y="13" textAnchor="middle" dominantBaseline="middle" fill="currentColor" fontSize="8" fontWeight="700" fontFamily="Menlo, Monaco, monospace">Cl</text>
  </svg>
);

const copilotIcon = (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="6" stroke="currentColor" strokeWidth="2" />
    <text x="12" y="13" textAnchor="middle" dominantBaseline="middle" fill="currentColor" fontSize="8" fontWeight="700" fontFamily="Menlo, Monaco, monospace">GH</text>
  </svg>
);

const codexIcon = (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="2" />
    <text x="12" y="13" textAnchor="middle" dominantBaseline="middle" fill="currentColor" fontSize="8" fontWeight="700" fontFamily="Menlo, Monaco, monospace">CX</text>
  </svg>
);

const qoderIcon = (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="2" />
    <text x="12" y="13" textAnchor="middle" dominantBaseline="middle" fill="currentColor" fontSize="11" fontWeight="800" fontFamily="Menlo, Monaco, monospace">Q</text>
  </svg>
);

const dashboardIcon = (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="4" width="7" height="7" rx="1.5" />
    <rect x="13" y="4" width="7" height="5" rx="1.5" />
    <rect x="4" y="13" width="7" height="7" rx="1.5" />
    <rect x="13" y="11" width="7" height="9" rx="1.5" />
  </svg>
);

const conversationIcon = (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 5h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9l-5 4v-4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
    <path d="M7 9h10" />
    <path d="M7 12h6" />
  </svg>
);

const terminalIcon = (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m7 10 3 2-3 2" />
    <path d="M13 15h5" />
  </svg>
);

export type SidebarView = 'terminal' | 'conversation' | 'dashboard';

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
      </div>

      {/* View Selector */}
      <div className="flex flex-col gap-2 flex-1">
        <button
          onClick={() => onViewChange('terminal')}
          className={`p-3 rounded-lg transition-all ${
            activeView === 'terminal'
              ? 'bg-bg-tertiary text-text-primary'
              : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
          }`}
          title="Terminal"
        >
          {terminalIcon}
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

      </div>

      {/* App Info */}
      <div className="mt-auto text-text-secondary text-xs">
        CLI
      </div>
    </div>
  );
};
