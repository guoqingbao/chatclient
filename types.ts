
export enum Role {
  User = 'user',
  Model = 'model',
}

export type SessionStatus = 'Running' | 'Waiting' | 'Cached' | 'Swapped' | 'Finished';

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

export interface TokenUsage {
  token_used: number;
  max_model_len: number;
  used_kvcache_tokens: number;
  total_kv_cache_tokens?: number;
  swap_used?: number;
  total_swap_memory?: number;
  session_status?: SessionStatus;
}

export interface ServerConfig {
  serverUrl?: string;
  apiKey?: string;
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
  systemInstruction: 'You are a helpful, versatile AI assistant with broad expertise. Use Markdown for formatting.',
  language: 'en',
  theme: 'light',
  serverUrl: 'http://localhost:8000/v1/', 
  apiKey: '',
  contextCache: true,
  generateTitles: false,
};