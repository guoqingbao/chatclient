
import React, { useState, useEffect } from 'react';
import { AppSettings } from '../types';
import { RefreshIcon } from './Icon';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSettingsChange: (newSettings: AppSettings) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onSettingsChange }) => {
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Fetch models when modal opens or server URL changes
  useEffect(() => {
    if (isOpen) {
      fetchModels();
    }
  }, [isOpen, settings.serverUrl]);

  const fetchModels = async () => {
    if (!settings.serverUrl) return;
    
    setIsLoadingModels(true);
    setFetchError(null);

    try {
      let baseUrl = settings.serverUrl.trim().replace(/\/+$/, '');
      baseUrl = baseUrl.replace(/\/chat\/completions$/, '');
      const url = `${baseUrl}/models`;

      // console.log(`[Settings] Fetching models from: ${url}`);

      const headers: Record<string, string> = {};
      if (settings.apiKey) {
        headers['Authorization'] = `Bearer ${settings.apiKey}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers,
        credentials: 'omit',
      });

      if (!response.ok) {
         throw new Error(`Server returned ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      if (data && Array.isArray(data.data)) {
        const modelIds = data.data.map((m: any) => m.id);
        setAvailableModels(modelIds);
        
        // Auto-select first model if current is 'default' (placeholder) or not in the list
        if (modelIds.length > 0) {
           if (settings.model === 'default' || !modelIds.includes(settings.model)) {
               onSettingsChange({ ...settings, model: modelIds[0] });
           }
        }
      } else {
        throw new Error("Invalid JSON format received from server");
      }
    } catch (error: any) {
      console.error("Failed to fetch models:", error);
      setFetchError(error.message || "Connection failed");
    } finally {
      setIsLoadingModels(false);
    }
  };

  if (!isOpen) return null;

  const handleChange = (key: keyof AppSettings, value: string | number | boolean) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  const modelOptions = Array.from(new Set([
    ...availableModels, 
    settings.model
  ])).filter(Boolean);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-dark-900 rounded-2xl p-6 w-full max-w-lg border border-gray-200 dark:border-dark-800 shadow-2xl transform transition-all">
        <div className="flex justify-between items-center mb-6 border-b border-gray-100 dark:border-dark-800 pb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Configuration</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
            ✕
          </button>
        </div>

        <div className="space-y-5 max-h-[65vh] overflow-y-auto pr-2 custom-scrollbar">
          
          {/* Server Configuration */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider">Backend Settings</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Server URL</label>
              <input 
                type="text"
                placeholder="http://localhost:8000/v1/"
                className="w-full bg-gray-50 dark:bg-dark-950 border border-gray-200 dark:border-dark-800 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={settings.serverUrl}
                onChange={(e) => handleChange('serverUrl', e.target.value)}
                onBlur={fetchModels} 
              />
            </div>
             <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">API Key</label>
              <input 
                type="password"
                placeholder="sk-..."
                className="w-full bg-gray-50 dark:bg-dark-950 border border-gray-200 dark:border-dark-800 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={settings.apiKey}
                onChange={(e) => handleChange('apiKey', e.target.value)}
              />
            </div>
            
            {/* Advanced Backend Toggles */}
            <div className="flex items-center justify-between border border-gray-100 dark:border-dark-800 p-3 rounded-lg">
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">Context Caching</div>
                <div className="text-xs text-gray-500">Sends unique session_id to server</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={settings.contextCache}
                  onChange={(e) => handleChange('contextCache', e.target.checked)}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          </div>

          <div className="border-t border-gray-100 dark:border-dark-800 pt-4 space-y-4">
             <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider">Model Parameters</h3>
             
            {/* Model Selection */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Model</label>
                <button 
                  onClick={fetchModels} 
                  disabled={isLoadingModels}
                  className={`text-xs flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline ${isLoadingModels ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <RefreshIcon /> {isLoadingModels ? 'Refreshing...' : 'Refresh List'}
                </button>
              </div>
              
              <div className="relative">
                <select 
                  className="w-full bg-gray-50 dark:bg-dark-950 border border-gray-200 dark:border-dark-800 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
                  value={settings.model}
                  onChange={(e) => handleChange('model', e.target.value)}
                >
                  {modelOptions.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 dark:text-gray-300">
                  <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                </div>
              </div>
              
              {fetchError && (
                <p className="text-xs text-red-500 mt-1">Error: {fetchError}</p>
              )}
            </div>

             {/* System Instruction */}
             <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">System Instruction</label>
              <textarea 
                className="w-full bg-gray-50 dark:bg-dark-950 border border-gray-200 dark:border-dark-800 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm resize-none"
                rows={3}
                value={settings.systemInstruction}
                onChange={(e) => handleChange('systemInstruction', e.target.value)}
              />
            </div>

            {/* Temperature */}
            <div>
              <div className="flex justify-between">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Temperature</label>
                <span className="text-xs text-gray-500 font-mono">{settings.temperature}</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="2" 
                step="0.1"
                className="w-full accent-indigo-600 dark:accent-indigo-400 h-1 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                value={settings.temperature}
                onChange={(e) => handleChange('temperature', parseFloat(e.target.value))}
              />
            </div>

            {/* Top P */}
             <div>
              <div className="flex justify-between">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Top P</label>
                <span className="text-xs text-gray-500 font-mono">{settings.topP}</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.05"
                className="w-full accent-indigo-600 dark:accent-indigo-400 h-1 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                value={settings.topP}
                onChange={(e) => handleChange('topP', parseFloat(e.target.value))}
              />
            </div>

            {/* Max Tokens */}
             <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max Output Tokens</label>
              <input 
                type="number" 
                className="w-full bg-gray-50 dark:bg-dark-950 border border-gray-200 dark:border-dark-800 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={settings.maxOutputTokens}
                onChange={(e) => handleChange('maxOutputTokens', parseInt(e.target.value))}
              />
            </div>

             {/* Auto Title Toggle */}
            <div className="flex items-center justify-between pt-2">
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">Auto-Generate Titles</div>
                <div className="text-xs text-gray-500">Summarize first message as chat title</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={settings.generateTitles}
                  onChange={(e) => handleChange('generateTitles', e.target.checked)}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
              </label>
            </div>

          </div>
        </div>

        <div className="mt-6 flex justify-end pt-4 border-t border-gray-100 dark:border-dark-800">
          <button 
            onClick={onClose}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg transition-colors font-medium shadow-sm"
          >
            Save & Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
