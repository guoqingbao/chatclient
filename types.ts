export enum Role {
  User = 'user',
  Model = 'model',
}

export interface FileAttachment {
  name: string;
  type: string;
  content: string; // Text content
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
}

// Interface for configuration injected by the Rust host
export interface RustAppConfig {
  serverUrl?: string; // For future OpenAI compatible endpoint usage
  apiKey?: string;    // Pre-filled API key
  defaultModel?: string;
  initialTheme?: 'light' | 'dark';
}

declare global {
  interface Window {
    RUST_APP_CONFIG?: RustAppConfig;
  }
}

export const DEFAULT_SETTINGS: AppSettings = {
  model: 'gemini-2.5-flash',
  temperature: 0.7,
  topK: 0, 
  topP: 0.95,
  maxOutputTokens: 2048,
  systemInstruction: 'You are a helpful, coding-expert AI assistant. Use Markdown for formatting.',
  language: 'en',
  theme: 'light',
  // Google Gemini OpenAI-compatible endpoint
  serverUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/', 
  apiKey: '',
};