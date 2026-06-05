import React, { useEffect, useState } from 'react';
import { useAppStore } from '../../stores';

interface Stats {
  total: number;
  claude: number;
  copilot: number;
  codex: number;
  qoder: number;
  favorites: number;
}

export const Dashboard: React.FC = () => {
  const { statuses, updateStatus, addSession, setActiveCLI, setActiveSession } = useAppStore();
  const [stats, setStats] = useState<Stats>({ total: 0, claude: 0, copilot: 0, codex: 0, qoder: 0, favorites: 0 });

  useEffect(() => {
    const checkStatus = async () => {
      if (window.cliManagerAPI) {
        const statusList = await window.cliManagerAPI.status.checkAll();
        statusList.forEach((status) => {
          updateStatus(status.cliType, status);
        });
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [updateStatus]);

  useEffect(() => {
    const fetchStats = async () => {
      if (window.cliManagerAPI) {
        try {
          const conversations = await window.cliManagerAPI.conversation.list({ limit: 1000 });
          const favorites = conversations.filter((conversation) => conversation.favorite).length;
          setStats({
            total: conversations.length,
            claude: conversations.filter((conversation) => conversation.cliType === 'claude').length,
            copilot: conversations.filter((conversation) => conversation.cliType === 'copilot').length,
            codex: conversations.filter((conversation) => conversation.cliType === 'codex').length,
            qoder: conversations.filter((conversation) => conversation.cliType === 'qoder').length,
            favorites,
          });
        } catch (e) {
          console.error('Failed to fetch stats:', e);
        }
      }
    };

    fetchStats();
  }, []);

  const openTerminal = async (cliType: 'claude' | 'copilot' | 'codex' | 'qoder') => {
    if (!window.cliManagerAPI) return;

    try {
      const sessionId = await window.cliManagerAPI.terminal.create(cliType);
      addSession({
        id: sessionId,
        cliType,
        createdAt: new Date(),
        lastActivity: new Date(),
      });
      setActiveCLI(cliType);
      setActiveSession(sessionId);
    } catch (error) {
      console.error(`Failed to create ${cliType} terminal session:`, error);
    }
  };

  const StatusCard: React.FC<{ title: string; status: typeof statuses.claude; color: string }> = ({
    title,
    status,
    color,
  }) => (
    <div className="bg-bg-secondary rounded-lg p-4 border border-bg-tertiary">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-medium text-text-primary">{title}</h3>
        <span
          className={`w-3 h-3 rounded-full ${
            !status
              ? 'bg-gray-500'
              : !status.installed
              ? 'bg-red-500'
              : status.running
              ? 'bg-green-500'
              : 'bg-yellow-500'
          }`}
        />
      </div>
      {status ? (
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-text-secondary">Status</span>
            <span className="text-text-primary">
              {!status.installed
                ? 'Not Installed'
                : status.running
                ? 'Running'
                : 'Stopped'}
            </span>
          </div>
          {status.version && (
            <div className="flex justify-between">
              <span className="text-text-secondary">Version</span>
              <span className="text-text-primary">{status.version}</span>
            </div>
          )}
          {status.pid && (
            <div className="flex justify-between">
              <span className="text-text-secondary">PID</span>
              <span className="text-text-primary">{status.pid}</span>
            </div>
          )}
          {status.cpuUsage !== undefined && (
            <div className="flex justify-between">
              <span className="text-text-secondary">CPU</span>
              <span className="text-text-primary">{status.cpuUsage.toFixed(1)}%</span>
            </div>
          )}
          {status.memoryUsage !== undefined && (
            <div className="flex justify-between">
              <span className="text-text-secondary">Memory</span>
              <span className="text-text-primary">{status.memoryUsage.toFixed(1)}%</span>
            </div>
          )}
        </div>
      ) : (
        <div className="text-text-secondary text-sm">Checking status...</div>
      )}
      <div className={`mt-4 h-1 rounded ${color}`} />
    </div>
  );

  const StatCard: React.FC<{ title: string; value: number; icon: string }> = ({
    title,
    value,
    icon,
  }) => (
    <div className="bg-bg-secondary rounded-lg p-4 border border-bg-tertiary">
      <div className="flex items-center gap-3">
        <div className="text-2xl">{icon}</div>
        <div>
          <div className="text-2xl font-bold text-text-primary">{value}</div>
          <div className="text-text-secondary text-sm">{title}</div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-6">
      <h2 className="text-xl font-semibold text-text-primary mb-6">Dashboard</h2>

      {/* Status Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatusCard
          title="Claude CLI"
          status={statuses.claude}
          color="bg-claude-primary"
        />
        <StatusCard
          title="Copilot CLI"
          status={statuses.copilot}
          color="bg-copilot-primary"
        />
        <StatusCard
          title="Codex CLI"
          status={statuses.codex}
          color="bg-codex-primary"
        />
        <StatusCard
          title="Qoder CLI"
          status={statuses.qoder}
          color="bg-qoder-primary"
        />
      </div>

      {/* Stats */}
      <h3 className="text-lg font-medium text-text-primary mb-4">History Statistics</h3>
      <div className="grid grid-cols-6 gap-4 mb-6">
        <StatCard title="Total Commands" value={stats.total} icon="📊" />
        <StatCard title="Claude Commands" value={stats.claude} icon="🤖" />
        <StatCard title="Copilot Commands" value={stats.copilot} icon="✈️" />
        <StatCard title="Codex Commands" value={stats.codex} icon="🔬" />
        <StatCard title="Qoder Commands" value={stats.qoder} icon="⚡" />
        <StatCard title="Favorites" value={stats.favorites} icon="⭐" />
      </div>

      {/* Quick Actions */}
      <h3 className="text-lg font-medium text-text-primary mb-4">Quick Actions</h3>
      <div className="grid grid-cols-4 gap-4">
        <button
          onClick={() => openTerminal('claude')}
          className="bg-claude-primary/20 hover:bg-claude-primary/30 text-claude-secondary px-4 py-3 rounded-lg transition-colors"
        >
          Open Claude CLI
        </button>
        <button
          onClick={() => openTerminal('copilot')}
          className="bg-copilot-primary/20 hover:bg-copilot-primary/30 text-copilot-secondary px-4 py-3 rounded-lg transition-colors"
        >
          Open Copilot CLI
        </button>
        <button
          onClick={() => openTerminal('codex')}
          className="bg-codex-primary/20 hover:bg-codex-primary/30 text-codex-secondary px-4 py-3 rounded-lg transition-colors"
        >
          Open Codex CLI
        </button>
        <button
          onClick={() => openTerminal('qoder')}
          className="bg-qoder-primary/20 hover:bg-qoder-primary/30 text-qoder-secondary px-4 py-3 rounded-lg transition-colors"
        >
          Open Qoder CLI
        </button>
      </div>
    </div>
  );
};
