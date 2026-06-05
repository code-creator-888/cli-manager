import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../stores';

export const ConfigPanel: React.FC = () => {
  const { activeCLI } = useAppStore();
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [settingsPath, setSettingsPath] = useState('');
  const [apps, setApps] = useState<Record<string, unknown>>({});
  const [appsPath, setAppsPath] = useState('');
  const [codexConfig, setCodexConfig] = useState<string>('');
  const [codexConfigPath, setCodexConfigPath] = useState('');
  const [qoderSettings, setQoderSettings] = useState<Record<string, unknown>>({});
  const [qoderSettingsPath, setQoderSettingsPath] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadConfig();
  }, [activeCLI]);

  const loadConfig = async () => {
    if (!window.cliManagerAPI) return;
    setIsLoading(true);
    try {
      if (activeCLI === 'claude') {
        const result = await window.cliManagerAPI.config.getSettings();
        setSettings(result.content || {});
        setSettingsPath(result.path);
      } else if (activeCLI === 'copilot') {
        const result = await window.cliManagerAPI.config.getApps();
        setApps(result.content || {});
        setAppsPath(result.path);
      } else if (activeCLI === 'codex') {
        const result = await window.cliManagerAPI.config.getCodexConfig();
        setCodexConfig(result.content || '');
        setCodexConfigPath(result.path);
      } else if (activeCLI === 'qoder') {
        const result = await window.cliManagerAPI.config.getQoderSettings();
        setQoderSettings(result.content || {});
        setQoderSettingsPath(result.path);
      }
    } catch (e) {
      console.error('Failed to load config:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const saveConfig = async () => {
    if (!window.cliManagerAPI) return;
    setIsSaving(true);
    try {
      if (activeCLI === 'claude') {
        await window.cliManagerAPI.config.setSettings(settings);
      } else if (activeCLI === 'copilot') {
        await window.cliManagerAPI.config.setApps(apps);
      } else if (activeCLI === 'codex') {
        await window.cliManagerAPI.config.setCodexConfig(codexConfig);
      } else if (activeCLI === 'qoder') {
        await window.cliManagerAPI.config.setQoderSettings(qoderSettings);
      }
    } catch (e) {
      console.error('Failed to save config:', e);
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
  const currentConfig = activeCLI === 'claude' ? settings : activeCLI === 'copilot' ? apps : activeCLI === 'codex' ? codexConfig : qoderSettings;
  const setConfig = activeCLI === 'claude' ? setSettings : activeCLI === 'copilot' ? setApps : activeCLI === 'codex' ? setCodexConfig : setQoderSettings;
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

        <div className="mb-8">
          <h3 className="text-lg font-medium text-text-primary mb-3">{configTitle} File</h3>
          <textarea
            value={activeCLI === 'codex' ? codexConfig : JSON.stringify(currentConfig, null, 2)}
            onChange={(e) => {
              if (activeCLI === 'codex') {
                // Codex 使用 TOML，直接保存字符串
                setCodexConfig(e.target.value);
              } else {
                try {
                  const parsed = JSON.parse(e.target.value);
                  setConfig(parsed);
                } catch {
                  // Invalid JSON, keep the current state
                }
              }
            }}
            className="w-full h-96 bg-bg-secondary text-text-primary font-mono text-sm p-4 rounded-lg border border-bg-tertiary focus:outline-none focus:border-blue-500 resize-none"
            spellCheck={false}
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
