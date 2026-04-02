import React, { useState, useEffect } from 'react';
import { Sidebar, Header } from './components/Layout';
import { TerminalPanel } from './components/Terminal';
import { ConfigPanel } from './components/ConfigPanel';
import { useAppStore } from './stores';
import { SidebarView } from './components/Layout/Sidebar';

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<SidebarView>('terminal');
  const { activeCLI, updateStatus } = useAppStore();

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
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, [updateStatus]);

  const renderContent = () => {
    return (
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
        {/* 保持 TerminalPanel 始终挂载，避免切换时终端被销毁 */}
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
          display: activeView === 'config' ? 'flex' : 'none',
          overflow: 'hidden'
        }}>
          <ConfigPanel />
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
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <Header activeView={activeView} />
        <main style={{ flex: 1, overflow: 'hidden', display: 'flex', minHeight: 0 }}>{renderContent()}</main>
      </div>
    </div>
  );
};

export default App;
