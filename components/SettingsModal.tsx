import React from 'react';
import { AppSettings } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSettingsChange: (newSettings: AppSettings) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onSettingsChange }) => {
  if (!isOpen) return null;

  const handleChange = (key: keyof AppSettings, value: string | number) => {
    onSettingsChange({ ...settings, [key]: value });
  };

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
                placeholder="https://generativelanguage.googleapis.com/v1beta/openai/"
                className="w-full bg-gray-50 dark:bg-dark-950 border border-gray-200 dark:border-dark-800 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={settings.serverUrl}
                onChange={(e) => handleChange('serverUrl', e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-1">Default: Google Gemini OpenAI-compatible endpoint.</p>
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Model</label>
              <select 
                className="w-full bg-gray-50 dark:bg-dark-950 border border-gray-200 dark:border-dark-800 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={settings.model}
                onChange={(e) => handleChange('model', e.target.value)}
              >
                <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                <option value="gpt-4o">GPT-4o</option>
                <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
              </select>
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