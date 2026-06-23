import React, { useEffect } from 'react';
import { Sidebar, Header } from './components/Layout';
import { TerminalPanel } from './components/Terminal';
import { ConversationPanel } from './components/ConversationPanel';
import { Dashboard } from './components/Dashboard';
import { NotificationCenter } from './components/Notifications';
import { useAppStore } from './stores';

const App: React.FC = () => {
  const { activeView, setActiveView, updateStatus, addNotification } = useAppStore();

  // Check CLI status
  useEffect(() => {
    const checkStatus = async () => {
      if (!window.cliManagerAPI) return;

      try {
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
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, [updateStatus, addNotification]);

  const renderContent = () => {
    return (
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
        {/* 保持 TerminalPanel 始终挂载，避免切换时终端被销毁 */}
        <div style={{
          position: 'absolute',
          inset: 0,
          display: activeView === 'dashboard' ? 'flex' : 'none',
          overflow: 'hidden'
        }}>
          <Dashboard />
        </div>
        <div style={{
          position: 'absolute',
          inset: 0,
          display: activeView === 'terminal' ? 'flex' : 'none',
          overflow: 'hidden'
        }}>
          <TerminalPanel />
        </div>
        <div style={{
          position: 'absolute',
          inset: 0,
          display: activeView === 'conversation' ? 'flex' : 'none',
          overflow: 'hidden'
        }}>
          <ConversationPanel />
        </div>
      </div>
    );
  };

  return (
    <div style={{
      height: '100vh',
      width: '100vw',
      display: 'flex',
      backgroundColor: '#1a1a2e',
      color: '#eaeaea',
      overflow: 'hidden',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      <NotificationCenter />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <Header activeView={activeView} />
        <main style={{ flex: 1, overflow: 'hidden', display: 'flex', minHeight: 0 }}>{renderContent()}</main>
      </div>
    </div>
  );
};

export default App;
