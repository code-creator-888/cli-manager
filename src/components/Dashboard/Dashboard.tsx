import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../stores';
import { canCreateTerminalSession, getTerminalSessionLimitMessage } from '../../utils/sessionLimits';
import type { CLIType, CLIStatus, ConversationStats } from '../../types';
import { getCLILabel, getCLIPrimaryColor } from '../../utils/cliUtils';
import { StatusDot } from '../shared/StatusDot';

const StatusCard: React.FC<{
  title: string;
  status: CLIStatus | null;
  color: string;
  isLoading?: boolean;
}> = ({ title, status, color, isLoading }) => (
  <div className="bg-bg-secondary rounded-lg p-4 border border-bg-tertiary">
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-lg font-medium text-text-primary">{title}</h3>
      <StatusDot status={status} size="md" />
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
      <div className="text-text-secondary text-sm">
        {isLoading ? 'Checking status...' : 'No status available'}
      </div>
    )}
    <div className={`mt-4 h-1 rounded ${color}`} />
  </div>
);

const StatCard: React.FC<{
  title: string;
  value: number;
  icon: string;
  isLoading?: boolean;
}> = ({ title, value, icon, isLoading }) => (
  <div className="bg-bg-secondary rounded-lg p-4 border border-bg-tertiary">
    <div className="flex items-center gap-3">
      <div className="text-2xl">{icon}</div>
      <div>
        <div className="text-2xl font-bold text-text-primary">{isLoading ? '…' : value}</div>
        <div className="text-text-secondary text-sm">{title}</div>
      </div>
    </div>
  </div>
);

export const Dashboard: React.FC = () => {
  const { statuses, updateStatus, addSession, setActiveCLI, setActiveSession, setActiveView, sessions, addNotification } = useAppStore();
  const [stats, setStats] = useState<ConversationStats>({ total: 0, claude: 0, copilot: 0, codex: 0, qoder: 0, favorites: 0 });
  const [terminalError, setTerminalError] = useState<string | null>(null);
  const [isStatsLoading, setIsStatsLoading] = useState(true);
  const [isStatusLoading, setIsStatusLoading] = useState(true);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const checkStatus = async () => {
      if (window.cliManagerAPI) {
        try {
          setIsStatusLoading(true);
          const statusList = await window.cliManagerAPI.status.checkAll();
          statusList.forEach((status) => {
            updateStatus(status.cliType, status);
          });
        } catch (e) {
          console.error('Failed to check status:', e);
          addNotification({
            type: 'error',
            message: `Failed to check CLI status: ${e instanceof Error ? e.message : String(e)}`,
          });
        } finally {
          setIsStatusLoading(false);
        }
      }
    };

    checkStatus();
  }, [updateStatus, addNotification]);

  const fetchStats = useCallback(async () => {
    if (!window.cliManagerAPI) return;
    setIsStatsLoading(true);
    try {
      const nextStats = await window.cliManagerAPI.conversation.getStats();
      setStats(nextStats);
    } catch (e) {
      console.error('Failed to fetch stats:', e);
      addNotification({
        type: 'error',
        message: `Failed to fetch dashboard stats: ${e instanceof Error ? e.message : String(e)}`,
      });
    } finally {
      setIsStatsLoading(false);
    }
  }, [addNotification]);

  useEffect(() => {
    fetchStats();

    if (!window.cliManagerAPI) return;
    const unsubscribeCreated = window.cliManagerAPI.conversation.onCreated(() => {
      fetchStats();
    });
    const unsubscribeMessage = window.cliManagerAPI.conversation.onMessage(() => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        fetchStats();
      }, 2000);
    });

    return () => {
      unsubscribeCreated();
      unsubscribeMessage();
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [fetchStats]);

  const refreshDashboard = async () => {
    if (window.cliManagerAPI) {
      try {
        setIsStatusLoading(true);
        const statusList = await window.cliManagerAPI.status.checkAll();
        statusList.forEach((status) => {
          updateStatus(status.cliType, status);
        });
      } catch (e) {
        console.error('Failed to refresh status:', e);
        addNotification({
          type: 'error',
          message: `Failed to refresh CLI status: ${e instanceof Error ? e.message : String(e)}`,
        });
      } finally {
        setIsStatusLoading(false);
      }
    }

    await fetchStats();
  };

  const openTerminal = async (cliType: CLIType) => {
    if (!window.cliManagerAPI) return;

    if (!canCreateTerminalSession(sessions, cliType)) {
      const message = getTerminalSessionLimitMessage(cliType);
      setTerminalError(message);
      addNotification({ type: 'error', message });
      return;
    }

    try {
      setTerminalError(null);
      const { sessionId, cliSessionId } = await window.cliManagerAPI.terminal.create(cliType);
      addSession({
        id: sessionId,
        cliType,
        cliSessionId,
        createdAt: new Date(),
        lastActivity: new Date(),
      });
      setActiveCLI(cliType);
      setActiveSession(sessionId);
      setActiveView('terminal');
    } catch (error) {
      console.error(`Failed to create ${cliType} terminal session:`, error);
      const message = error instanceof Error ? error.message : String(error);
      setTerminalError(message);
      addNotification({ type: 'error', message: `Failed to create ${cliType} terminal session: ${message}` });
    }
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-6">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-text-primary">Dashboard</h2>
        <button
          onClick={refreshDashboard}
          disabled={isStatsLoading || isStatusLoading}
          className="rounded-lg bg-bg-secondary px-3 py-2 text-sm text-text-secondary transition-colors hover:text-text-primary disabled:opacity-50"
        >
          {isStatsLoading || isStatusLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatusCard
          title={`${getCLILabel('copilot')} CLI`}
          status={statuses.copilot}
          color={getCLIPrimaryColor('copilot')}
          isLoading={isStatusLoading}
        />
        <StatusCard
          title={`${getCLILabel('qoder')} CLI`}
          status={statuses.qoder}
          color={getCLIPrimaryColor('qoder')}
          isLoading={isStatusLoading}
        />
        <StatusCard
          title={`${getCLILabel('claude')} CLI`}
          status={statuses.claude}
          color={getCLIPrimaryColor('claude')}
          isLoading={isStatusLoading}
        />
        <StatusCard
          title={`${getCLILabel('codex')} CLI`}
          status={statuses.codex}
          color={getCLIPrimaryColor('codex')}
          isLoading={isStatusLoading}
        />
      </div>

      {/* Stats */}
      <h3 className="text-lg font-medium text-text-primary mb-4">History Statistics</h3>
      <div className="grid grid-cols-6 gap-4 mb-6">
        <StatCard title="Total Conversations" value={stats.total} icon="📊" isLoading={isStatsLoading} />
        <StatCard title="Copilot Conversations" value={stats.copilot} icon="✈️" isLoading={isStatsLoading} />
        <StatCard title="Qoder Conversations" value={stats.qoder} icon="⚡" isLoading={isStatsLoading} />
        <StatCard title="Claude Conversations" value={stats.claude} icon="🤖" isLoading={isStatsLoading} />
        <StatCard title="Codex Conversations" value={stats.codex} icon="🔬" isLoading={isStatsLoading} />
        <StatCard title="Favorites" value={stats.favorites} icon="⭐" isLoading={isStatsLoading} />
      </div>

      {/* Quick Actions */}
      <h3 className="text-lg font-medium text-text-primary mb-4">Quick Actions</h3>
      {terminalError && (
        <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
          {terminalError}
        </div>
      )}
      <div className="grid grid-cols-4 gap-4">
        <button
          onClick={() => openTerminal('copilot')}
          className="bg-copilot-primary/20 hover:bg-copilot-primary/30 text-copilot-secondary px-4 py-3 rounded-lg transition-colors"
        >
          Open Copilot CLI
        </button>
        <button
          onClick={() => openTerminal('qoder')}
          className="bg-qoder-primary/20 hover:bg-qoder-primary/30 text-qoder-secondary px-4 py-3 rounded-lg transition-colors"
        >
          Open Qoder CLI
        </button>
        <button
          onClick={() => openTerminal('claude')}
          className="bg-claude-primary/20 hover:bg-claude-primary/30 text-claude-secondary px-4 py-3 rounded-lg transition-colors"
        >
          Open Claude CLI
        </button>
        <button
          onClick={() => openTerminal('codex')}
          className="bg-codex-primary/20 hover:bg-codex-primary/30 text-codex-secondary px-4 py-3 rounded-lg transition-colors"
        >
          Open Codex CLI
        </button>
      </div>
    </div>
  );
};
