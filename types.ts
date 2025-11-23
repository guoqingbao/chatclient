export enum Role {
  User = 'user',
  Model = 'model',
}

export interface FileAttachment {
  name: string;
  type: string;
  content: string; // Text content
  tokenCount?: number;
}

export interface Message {
  id: string;
  role: Role;
  text: string;
  attachments?: FileAttachment[];
  timestamp: number;
  isError?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  lastUpdated: number;
}

export interface AppSettings {
  model: string;
  temperature: number;
  topK: number;
  topP: number;
  maxOutputTokens: number;
  systemInstruction: string;
  language: 'en' | 'es' | 'fr' | 'de' | 'zh';
  theme: 'light' | 'dark';
  serverUrl: string;
  apiKey: string;
  contextCache: boolean;
  generateTitles: boolean;
}

// Interface for configuration injected by the Host
export interface ChatAppConfig {
  serverUrl?: string; 
  apiKey?: string;    
  defaultModel?: string;
  initialTheme?: 'light' | 'dark';
}

declare global {
  interface Window {
    CHAT_APP_CONFIG?: ChatAppConfig;
    RUST_APP_CONFIG?: ChatAppConfig; // Backward compatibility
  }
}

export const DEFAULT_SETTINGS: AppSettings = {
  model: 'default',
  temperature: 0.7,
  topK: 0, 
  topP: 0.95,
  maxOutputTokens: 32768,
  systemInstruction: 'You are a helpful, coding-expert AI assistant. Use Markdown for formatting.',
  language: 'en',
  theme: 'light',
  serverUrl: 'http://localhost:8000/v1/', 
  apiKey: '',
  contextCache: true,
  generateTitles: false,
};
