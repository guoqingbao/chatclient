
import React, { useState, useEffect } from 'react';
import { AppSettings, DEFAULT_SETTINGS } from '../types';
import { RefreshIcon } from './Icon';
import { fetchAvailableModels } from '../services/geminiService';
import { translations, Language } from '../utils/translations';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSettingsChange: (newSettings: AppSettings) => void;
  useSampling: boolean;
  onSamplingToggle: (val: boolean) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, 
  onClose, 
  settings, 
  onSettingsChange,
  useSampling,
  onSamplingToggle
}) => {
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Determine current language from settings, fallback to 'en'
  const lang: Language = (settings.language === 'zh' || settings.language === 'en') ? settings.language : 'en';
  const t = translations[lang];

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
      const models = await fetchAvailableModels(settings);
      
      if (models.length > 0) {
        const modelIds = models.map((m: any) => m.id);
        setAvailableModels(modelIds);
        
        // Auto-select first model if current is 'default' (placeholder) or not in the list
        if (modelIds.length > 0) {
           if (settings.model === 'default' || !modelIds.includes(settings.model)) {
               onSettingsChange({ ...settings, model: modelIds[0] });
           }
        }
      } else {
        if (models.length === 0 && settings.serverUrl) {
             setFetchError(t.noModelsFound);
        }
      }
    } catch (error: any) {
      console.error("Failed to fetch models:", error);
      setFetchError(error.message || "Connection failed");
    } finally {
      setIsLoadingModels(false);
    }
  };

  const handleResetDefaults = () => {
      // Reset specific parameters to their default values as requested
      // Preserves: serverUrl, apiKey, model, systemInstruction, language, theme, generateTitles
      onSettingsChange({
          ...settings,
          temperature: DEFAULT_SETTINGS.temperature,
          topK: DEFAULT_SETTINGS.topK,
          topP: DEFAULT_SETTINGS.topP,
          minP: DEFAULT_SETTINGS.minP,
          frequencyPenalty: DEFAULT_SETTINGS.frequencyPenalty,
          presencePenalty: DEFAULT_SETTINGS.presencePenalty,
          repeatLastN: DEFAULT_SETTINGS.repeatLastN,
          thinking: DEFAULT_SETTINGS.thinking,
          maxOutputTokens: DEFAULT_SETTINGS.maxOutputTokens,
          contextCache: DEFAULT_SETTINGS.contextCache
      });
      
      // Also reset sampling toggle visual state if needed (though it's controlled by prop, 
      // typically we'd assume default means "standard" sampling, but useSampling is a UI state in parent.
      // We'll leave the toggle as is since it's passed in).
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
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 backdrop-blur-md p-4 animate-fade-in">
      <div className="glass rounded-2xl p-6 w-full max-w-lg shadow-2xl transform transition-all flex flex-col max-h-[90vh] animate-scale-in">
        <div className="flex justify-between items-center mb-4 border-b border-white/10 dark:border-white/5 pb-4 flex-shrink-0">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t.configuration}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-white/30 dark:hover:bg-white/5 transition-all">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-5">
          
          {/* General App Settings (Language) */}
          <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.language}</label>
              <div className="relative">
                <select 
                  className="w-full bg-white/30 dark:bg-white/5 border border-white/30 dark:border-white/10 rounded-xl px-3 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none backdrop-blur-sm"
                  value={settings.language}
                  onChange={(e) => handleChange('language', e.target.value)}
                >
                  <option value="en">English</option>
                  <option value="zh">中文 (Chinese)</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 dark:text-gray-300">
                  <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                </div>
              </div>
          </div>

          {/* Server Configuration */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider">{t.backendSettings}</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.serverUrl}</label>
              <input 
                type="text"
                placeholder="http://localhost:8000/v1/"
                className="w-full bg-white/30 dark:bg-white/5 border border-white/30 dark:border-white/10 rounded-xl px-3 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 backdrop-blur-sm"
                value={settings.serverUrl}
                onChange={(e) => handleChange('serverUrl', e.target.value)}
                onBlur={fetchModels} 
              />
            </div>
             <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.apiKey}</label>
              <input 
                type="password"
                placeholder="sk-..."
                className="w-full bg-white/30 dark:bg-white/5 border border-white/30 dark:border-white/10 rounded-xl px-3 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 backdrop-blur-sm"
                value={settings.apiKey}
                onChange={(e) => handleChange('apiKey', e.target.value)}
              />
            </div>
            
            {/* Advanced Backend Toggles */}
            <div className="flex items-center justify-between glass-subtle p-3 rounded-xl">
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">{t.contextCaching}</div>
                <div className="text-xs text-gray-500">{t.contextCachingDesc}</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={settings.contextCache}
                  onChange={(e) => handleChange('contextCache', e.target.checked)}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300/30 dark:peer-focus:ring-indigo-800/30 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-gradient-to-r peer-checked:from-indigo-500 peer-checked:to-purple-600"></div>
              </label>
            </div>
          </div>

          <div className="border-t border-white/10 dark:border-white/5 pt-4 space-y-4">
             <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider">{t.modelParameters}</h3>
             
            {/* Model Selection */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t.model}</label>
                <button 
                  onClick={fetchModels} 
                  disabled={isLoadingModels}
                  className={`text-xs flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline ${isLoadingModels ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <RefreshIcon /> {isLoadingModels ? t.refreshing : t.refreshList}
                </button>
              </div>
              
              <div className="relative">
                <select 
                  className="w-full bg-white/30 dark:bg-white/5 border border-white/30 dark:border-white/10 rounded-xl px-3 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none backdrop-blur-sm"
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.systemInstruction}</label>
              <textarea 
                className="w-full bg-white/30 dark:bg-white/5 border border-white/30 dark:border-white/10 rounded-xl px-3 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm resize-none backdrop-blur-sm"
                rows={3}
                value={settings.systemInstruction}
                onChange={(e) => handleChange('systemInstruction', e.target.value)}
              />
            </div>

             {/* Thinking Toggle - Standalone */}
             <div className="flex items-center justify-between glass-subtle p-3 rounded-xl">
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">{t.enableThinking}</div>
                  <div className="text-xs text-gray-500">{t.enableThinkingDesc}</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={settings.thinking}
                    onChange={(e) => handleChange('thinking', e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300/30 dark:peer-focus:ring-indigo-800/30 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-gradient-to-r peer-checked:from-indigo-500 peer-checked:to-purple-600"></div>
                </label>
            </div>

            {/* Sampling Parameters Toggle */}
            <div className="flex items-center justify-between glass-subtle p-3 rounded-xl border-indigo-200/20 dark:border-indigo-500/10">
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">{t.advancedSampling}</div>
                <div className="text-xs text-gray-500">{t.advancedSamplingDesc}</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={useSampling}
                  onChange={(e) => onSamplingToggle(e.target.checked)}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300/30 dark:peer-focus:ring-indigo-800/30 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-gradient-to-r peer-checked:from-indigo-500 peer-checked:to-purple-600"></div>
              </label>
            </div>

            <div className={`space-y-4 transition-all duration-300 ${useSampling ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                
                {/* Temperature */}
                <div>
                  <div className="flex justify-between">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.temperature}</label>
                    <span className="text-xs text-indigo-600 dark:text-indigo-400 font-mono bg-indigo-50/50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-full">{settings.temperature}</span>
                  </div>
                  <input 
                    type="range" min="0" max="2" step="0.1" disabled={!useSampling}
                    className="w-full accent-indigo-600 dark:accent-indigo-400 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    value={settings.temperature}
                    onChange={(e) => handleChange('temperature', parseFloat(e.target.value))}
                  />
                </div>

                {/* Top P & Min P Row */}
                <div className="grid grid-cols-2 gap-4">
                     <div>
                      <div className="flex justify-between">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.topP}</label>
                        <span className="text-xs text-indigo-600 dark:text-indigo-400 font-mono bg-indigo-50/50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-full">{settings.topP}</span>
                      </div>
                      <input 
                        type="range" min="0" max="1" step="0.05" disabled={!useSampling}
                        className="w-full accent-indigo-600 dark:accent-indigo-400 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                        value={settings.topP}
                        onChange={(e) => handleChange('topP', parseFloat(e.target.value))}
                      />
                    </div>
                    <div>
                      <div className="flex justify-between">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.minP}</label>
                        <span className="text-xs text-indigo-600 dark:text-indigo-400 font-mono bg-indigo-50/50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-full">{settings.minP}</span>
                      </div>
                      <input 
                        type="range" min="0" max="1" step="0.01" disabled={!useSampling}
                        className="w-full accent-indigo-600 dark:accent-indigo-400 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                        value={settings.minP}
                        onChange={(e) => handleChange('minP', parseFloat(e.target.value))}
                      />
                    </div>
                </div>

                {/* Top K */}
                <div>
                  <div className="flex justify-between">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.topK}</label>
                    <span className="text-xs text-indigo-600 dark:text-indigo-400 font-mono bg-indigo-50/50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-full">{settings.topK}</span>
                  </div>
                  <input 
                    type="number" min="0" disabled={!useSampling}
                    className="w-full bg-white/30 dark:bg-white/5 border border-white/30 dark:border-white/10 rounded-xl px-3 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm backdrop-blur-sm"
                    value={settings.topK}
                    onChange={(e) => handleChange('topK', parseInt(e.target.value) || 0)}
                  />
                </div>

                {/* Penalties Row */}
                <div className="grid grid-cols-2 gap-4">
                     <div>
                      <div className="flex justify-between">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.freqPenalty}</label>
                        <span className="text-xs text-indigo-600 dark:text-indigo-400 font-mono bg-indigo-50/50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-full">{settings.frequencyPenalty}</span>
                      </div>
                      <input 
                        type="range" min="-2" max="2" step="0.1" disabled={!useSampling}
                        className="w-full accent-indigo-600 dark:accent-indigo-400 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                        value={settings.frequencyPenalty}
                        onChange={(e) => handleChange('frequencyPenalty', parseFloat(e.target.value))}
                      />
                    </div>
                    <div>
                      <div className="flex justify-between">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.presPenalty}</label>
                        <span className="text-xs text-indigo-600 dark:text-indigo-400 font-mono bg-indigo-50/50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-full">{settings.presencePenalty}</span>
                      </div>
                      <input 
                        type="range" min="-2" max="2" step="0.1" disabled={!useSampling}
                        className="w-full accent-indigo-600 dark:accent-indigo-400 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                        value={settings.presencePenalty}
                        onChange={(e) => handleChange('presencePenalty', parseFloat(e.target.value))}
                      />
                    </div>
                </div>
                
                 {/* Repeat Last N */}
                <div>
                  <div className="flex justify-between">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.repeatLastN}</label>
                    <span className="text-xs text-indigo-600 dark:text-indigo-400 font-mono bg-indigo-50/50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-full">{settings.repeatLastN}</span>
                  </div>
                   <input 
                    type="range" min="16" max="256" step="16" disabled={!useSampling}
                    className="w-full accent-indigo-600 dark:accent-indigo-400 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    value={settings.repeatLastN}
                    onChange={(e) => handleChange('repeatLastN', parseInt(e.target.value))}
                  />
                </div>
            </div>

            {/* Max Tokens */}
             <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.maxOutputTokens}</label>
              <input 
                type="number" 
                className="w-full bg-white/30 dark:bg-white/5 border border-white/30 dark:border-white/10 rounded-xl px-3 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 backdrop-blur-sm"
                value={settings.maxOutputTokens}
                onChange={(e) => handleChange('maxOutputTokens', parseInt(e.target.value))}
              />
            </div>

             {/* Auto Title Toggle */}
            <div className="flex items-center justify-between pt-2">
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">{t.autoGenerateTitles}</div>
                <div className="text-xs text-gray-500">{t.autoGenerateTitlesDesc}</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={settings.generateTitles}
                  onChange={(e) => handleChange('generateTitles', e.target.checked)}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300/30 dark:peer-focus:ring-indigo-800/30 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-gradient-to-r peer-checked:from-indigo-500 peer-checked:to-purple-600"></div>
              </label>
            </div>

          </div>
        </div>

        <div className="mt-6 flex justify-between pt-4 border-t border-white/10 dark:border-white/5 flex-shrink-0">
          <button 
             onClick={handleResetDefaults}
             className="text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 px-4 py-2.5 rounded-xl transition-colors text-sm font-medium hover:bg-red-50/50 dark:hover:bg-red-900/10"
          >
             {t.resetToDefault}
          </button>
          
          <button 
            onClick={onClose}
            className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white px-6 py-2.5 rounded-xl transition-all font-medium shadow-lg hover:shadow-xl"
          >
            {t.saveAndClose}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
