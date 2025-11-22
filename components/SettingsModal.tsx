
import React, { useState, useEffect } from 'react';
import { AppSettings } from '../types';
import { RefreshIcon } from './Icon';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSettingsChange: (newSettings: AppSettings) => void;
}

const DEFAULT_MODELS = [
  "gemini-2.5-flash",
  "gemini-1.5-flash",
  "gpt-4o", 
  "gpt-3.5-turbo",
  "default"
];

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
      // Construct models endpoint logic
      let baseUrl = settings.serverUrl.trim().replace(/\/+$/, '');
      
      // Common Cleanup: If user pasted the chat endpoint, strip it back
      baseUrl = baseUrl.replace(/\/chat\/completions$/, '');

      // Heuristic: OpenAI models endpoint is typically {base}/models
      // If the user provided http://localhost:8000/v1, we want http://localhost:8000/v1/models
      const url = `${baseUrl}/models`;

      console.log(`[Settings] Fetching models from: ${url}`);

      const headers: Record<string, string> = {};
      if (settings.apiKey) {
        headers['Authorization'] = `Bearer ${settings.apiKey}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers,
        credentials: 'omit', // Important for local CORS with wildcard origins
      });

      if (!response.ok) {
         throw new Error(`Server returned ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      // OpenAI format: { object: "list", data: [ { id: "model-id", ... } ] }
      if (data && Array.isArray(data.data)) {
        const modelIds = data.data.map((m: any) => m.id);
        setAvailableModels(modelIds);
        
        // Auto-select 'default' if it's the only one and current model isn't in list
        if (modelIds.length === 1 && modelIds[0] === 'default' && !DEFAULT_MODELS.includes(settings.model) && settings.model !== 'default') {
           // Optional: we could auto-switch here, but better to let user decide
        }
      } else {
        throw new Error("Invalid JSON format received from server");
      }
    } catch (error: any) {
      console.error("Failed to fetch models:", error);
      setFetchError(error.message || "Connection failed");
      // Keep availableModels empty so we fall back to defaults visually, 
      // but we store the error to show the user.
    } finally {
      setIsLoadingModels(false);
    }
  };

  if (!isOpen) return null;

  const handleChange = (key: keyof AppSettings, value: string | number) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  // Merge fetched models with defaults, ensuring current selection is always visible
  const modelOptions = Array.from(new Set([
    ...availableModels, 
    ...DEFAULT_MODELS, 
    settings.model // Ensure current model is in the list even if fetch fails
  ]));

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
                onBlur={fetchModels} // Retry fetching models when user leaves this field
              />
              <p className="text-xs text-gray-500 mt-1">The API endpoint (e.g. http://localhost:8000/v1/)</p>
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
                {/* Custom arrow */}
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 dark:text-gray-300">
                  <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                </div>
              </div>
              
              {/* Error / Status Message */}
              {fetchError && (
                <p className="text-xs text-red-500 mt-1">
                  Error fetching models: {fetchError}
                </p>
              )}
              {availableModels.length > 0 && !fetchError && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                  ✓ Loaded {availableModels.length} models from server
                </p>
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
