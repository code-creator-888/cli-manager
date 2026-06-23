import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../stores';

export const ConfigPanel: React.FC = () => {
  const { activeCLI, addNotification } = useAppStore();
  const [settingsPath, setSettingsPath] = useState('');
  const [appsPath, setAppsPath] = useState('');
  const [codexConfigPath, setCodexConfigPath] = useState('');
  const [qoderSettingsPath, setQoderSettingsPath] = useState('');
  const [configText, setConfigText] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadConfig();
  }, [activeCLI]);

  const loadConfig = async () => {
    if (!window.cliManagerAPI) return;
    setIsLoading(true);
    setLoadError(null);
    setSaveError(null);
    setSaveMessage(null);
    try {
      if (activeCLI === 'claude') {
        const result = await window.cliManagerAPI.config.getSettings();
        setSettingsPath(result.path);
        setConfigText(JSON.stringify(result.content || {}, null, 2));
      } else if (activeCLI === 'copilot') {
        const result = await window.cliManagerAPI.config.getApps();
        setAppsPath(result.path);
        setConfigText(JSON.stringify(result.content || {}, null, 2));
      } else if (activeCLI === 'codex') {
        const result = await window.cliManagerAPI.config.getCodexConfig();
        setCodexConfigPath(result.path);
        setConfigText(result.content || '');
      } else if (activeCLI === 'qoder') {
        const result = await window.cliManagerAPI.config.getQoderSettings();
        setQoderSettingsPath(result.path);
        setConfigText(JSON.stringify(result.content || {}, null, 2));
      }
    } catch (e) {
      console.error('Failed to load config:', e);
      const message = e instanceof Error ? e.message : String(e);
      setLoadError(message);
      addNotification({ type: 'error', message: `Failed to load configuration: ${message}` });
      setConfigText('');
    } finally {
      setIsLoading(false);
    }
  };

  const saveConfig = async () => {
    if (!window.cliManagerAPI) return;
    setIsSaving(true);
    setSaveError(null);
    setSaveMessage(null);
    try {
      if (activeCLI === 'claude') {
        const parsed = JSON.parse(configText) as Record<string, unknown>;
        await window.cliManagerAPI.config.setSettings(parsed);
      } else if (activeCLI === 'copilot') {
        const parsed = JSON.parse(configText) as Record<string, unknown>;
        await window.cliManagerAPI.config.setApps(parsed);
      } else if (activeCLI === 'codex') {
        await window.cliManagerAPI.config.setCodexConfig(configText);
      } else if (activeCLI === 'qoder') {
        const parsed = JSON.parse(configText) as Record<string, unknown>;
        await window.cliManagerAPI.config.setQoderSettings(parsed);
      }
      setSaveMessage('Saved successfully.');
      addNotification({ type: 'success', message: 'Configuration saved successfully.' });
    } catch (e) {
      console.error('Failed to save config:', e);
      const message = e instanceof Error ? e.message : String(e);
      setSaveError(message);
      addNotification({ type: 'error', message: `Failed to save configuration: ${message}` });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-text-secondary">Loading configuration...</div>
      </div>
    );
  }

  const currentPath = activeCLI === 'claude' ? settingsPath : activeCLI === 'copilot' ? appsPath : activeCLI === 'codex' ? codexConfigPath : qoderSettingsPath;
  const configTitle = activeCLI === 'claude' ? 'Settings' : activeCLI === 'copilot' ? 'Apps' : activeCLI === 'codex' ? 'Config' : 'Settings';

  const cliTitle = activeCLI === 'claude' ? 'Claude CLI' : activeCLI === 'copilot' ? 'Copilot CLI' : activeCLI === 'codex' ? 'Codex CLI' : 'Qoder CLI';

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-6">
      <div className="max-w-2xl">
        <h2 className="text-xl font-semibold text-text-primary mb-2">
          {cliTitle} Configuration
        </h2>
        <p className="text-text-secondary text-sm mb-6">
          Path: <code className="bg-bg-tertiary px-1 rounded">{currentPath}</code>
        </p>

        {loadError && (
          <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
            Failed to load configuration: {loadError}
          </div>
        )}

        {saveError && (
          <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
            Failed to save configuration: {saveError}
          </div>
        )}

        {saveMessage && (
          <div className="mb-4 rounded-lg border border-green-500/40 bg-green-500/10 p-3 text-sm text-green-300">
            {saveMessage}
          </div>
        )}

        <div className="mb-8">
          <h3 className="text-lg font-medium text-text-primary mb-3">{configTitle} File</h3>
          <textarea
            value={configText}
            onChange={(e) => {
              setConfigText(e.target.value);
              setSaveError(null);
              setSaveMessage(null);
            }}
            className="w-full h-96 bg-bg-secondary text-text-primary font-mono text-sm p-4 rounded-lg border border-bg-tertiary focus:outline-none focus:border-blue-500 resize-none"
            spellCheck={false}
            disabled={loadError !== null}
          />
          <div className="mt-2 flex justify-end">
            <button
              onClick={saveConfig}
              disabled={isSaving}
              className={`px-4 py-2 rounded-lg transition-colors ${
                isSaving
                  ? 'bg-bg-tertiary text-text-secondary'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {isSaving ? 'Saving...' : `Save ${configTitle}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
