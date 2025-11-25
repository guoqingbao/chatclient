import React, { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message, ChatSession, Role, AppSettings, DEFAULT_SETTINGS, FileAttachment, TokenUsage } from './types';
import { streamChatResponse, generateTitle, fetchTokenUsage, estimateTokenCount, fetchServerConfig } from './services/geminiService';
import { BotIcon, UserIcon, SendIcon, StopIcon, PaperClipIcon, SettingsIcon, RefreshIcon, CopyIcon, ShareIcon, SunIcon, MoonIcon, EditIcon, WritingIcon } from './components/Icon';
import SettingsModal from './components/SettingsModal';

const ThinkingProcess = ({ thought, isComplete, isTruncated }: { thought: string, isComplete: boolean, isTruncated: boolean }) => {
  const [isOpen, setIsOpen] = useState(!isComplete || isTruncated);

  // Auto-close when complete (unless it was truncated, then we might want to keep it open to show the error)
  useEffect(() => {
    if (isComplete && !isTruncated) {
      setIsOpen(false);
    } else if (!isComplete && !isTruncated) {
      setIsOpen(true);
    }
  }, [isComplete, isTruncated]);

  return (
    <div className={`mb-3 border-l-2 pl-3 ml-1 ${isTruncated ? 'border-amber-400 dark:border-amber-600' : 'border-gray-200 dark:border-dark-700'}`}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-xs font-medium text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors select-none"
      >
        <span className="text-lg leading-none">
            {isOpen ? '▾' : '▸'}
        </span>
        {isComplete ? (
          <span>Thought Process</span>
        ) : isTruncated ? (
          <span className="text-amber-600 dark:text-amber-500 flex items-center gap-1">
            Thought Process (Interrupted)
          </span>
        ) : (
          <span className="animate-pulse flex items-center gap-1">
            Thinking<span className="animate-bounce">.</span><span className="animate-bounce delay-75">.</span><span className="animate-bounce delay-150">.</span>
          </span>
        )}
      </button>
      
      {isOpen && (
        <div className="mt-2 text-sm text-gray-500 dark:text-gray-400 font-mono bg-gray-50 dark:bg-dark-900 p-3 rounded-md whitespace-pre-wrap leading-relaxed animate-in fade-in slide-in-from-top-1 duration-200">
          {thought}
          {isTruncated && (
             <div className="mt-3 pt-2 border-t border-amber-200 dark:border-amber-900/30 text-amber-600 dark:text-amber-500 text-xs italic flex items-center gap-1">
                ⚠️ Thinking process was truncated unexpectedly.
             </div>
          )}
        </div>
      )}
    </div>
  );
};

// Edit Modal Component
const EditMessageModal = ({ 
  isOpen, 
  onClose, 
  initialText, 
  onConfirm 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  initialText: string; 
  onConfirm: (newText: string) => void; 
}) => {
  const [text, setText] = useState(initialText);

  useEffect(() => {
    if (isOpen) setText(initialText);
  }, [isOpen, initialText]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-dark-900 rounded-xl shadow-2xl w-full max-w-2xl border border-gray-200 dark:border-dark-800 flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-dark-800 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Message</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">✕</button>
        </div>
        <div className="p-4 flex-1">
          <textarea
            className="w-full h-64 bg-gray-50 dark:bg-dark-950 border border-gray-200 dark:border-dark-800 rounded-lg p-4 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none custom-scrollbar"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <p className="text-xs text-gray-500 mt-2">
            Editing this message will clear all subsequent messages in this conversation.
          </p>
        </div>
        <div className="p-4 border-t border-gray-200 dark:border-dark-800 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={() => onConfirm(text)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium"
          >
            Send & Restart
          </button>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const stored = localStorage.getItem('chat_client_sessions');
    return stored ? JSON.parse(stored) : [];
  });

  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  
  const [settings, setSettings] = useState<AppSettings>(() => {
    const stored = localStorage.getItem('chat_client_settings');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return { ...DEFAULT_SETTINGS, ...parsed };
      } catch (e) {
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  });

  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [configError, setConfigError] = useState<string | null>(null);
  
  // Edit State
  const [editingMessage, setEditingMessage] = useState<{index: number, text: string} | null>(null);

  // Token Usage State (Split)
  const [contextStats, setContextStats] = useState<{used: number, total: number} | null>(null);
  const [kvStats, setKvStats] = useState<{used: number, total: number} | null>(null);

  // Ref to track usage polling failures to auto-kill the thread
  const usageFailuresRef = useRef(0);
  
  // Scroll & UI Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true); // Track if we should auto-scroll

  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Bootstrap Configuration
  useEffect(() => {
    let attempts = 0;
    const maxAttempts = 5;

    const loadConfig = async () => {
        const config = await fetchServerConfig();
        if (config && config.serverUrl) {
            setSettings(prev => ({
                ...prev,
                serverUrl: config.serverUrl!,
                apiKey: config.apiKey || prev.apiKey
            }));
            setConfigError(null);
        } else {
            attempts++;
            if (attempts < maxAttempts) {
                setTimeout(loadConfig, 2000);
            } else {
                const errorMsg = `Unable to obtain server config automatically. Using default: ${DEFAULT_SETTINGS.serverUrl}`;
                setConfigError(errorMsg);
                // Clear error message after 1 minute
                setTimeout(() => setConfigError(null), 60000);
            }
        }
    };

    // Check for host injected config first
    const hostConfig = window.CHAT_APP_CONFIG || window.RUST_APP_CONFIG;
    if (hostConfig) {
       setSettings(prev => ({
          ...prev,
          model: hostConfig.defaultModel || prev.model,
          theme: hostConfig.initialTheme || prev.theme,
          serverUrl: hostConfig.serverUrl || prev.serverUrl,
          apiKey: hostConfig.apiKey || prev.apiKey
       }));
    } else {
       // Try fetching from endpoint
       loadConfig();
    }
  }, []);

  useEffect(() => {
    if (sessions.length > 0 && !currentSessionId) {
      setCurrentSessionId(sessions[0].id);
    } else if (sessions.length === 0) {
      createNewSession();
    }
  }, []);

  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem('chat_client_sessions', JSON.stringify(sessions));
    }
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem('chat_client_settings', JSON.stringify(settings));
  }, [settings]);

  // Helper to check if server is a custom server (Local/IP/Port)
  const isCustomServer = useCallback((url: string) => {
    if (!url) return false;
    // Check for localhost or specific IPs
    if (url.includes('localhost') || url.includes('127.0.0.1')) return true;
    
    // Check for explicit port usage (heuristic: colon followed by digits)
    // E.g. http://192.168.1.1:8000
    try {
        const urlObj = new URL(url.startsWith('http') ? url : `http://${url}`);
        // If there is a port specified in the URL authority, treat as custom
        if (urlObj.port) return true;
    } catch (e) {
        // Fallback simple regex if URL parse fails
        if (/:[0-9]+/.test(url)) return true;
    }
    
    return false;
  }, []);

  // Token Usage Polling
  useEffect(() => {
    // Only poll if context cache is enabled AND we are connected to a custom server
    if (!settings.contextCache || !currentSessionId || !isCustomServer(settings.serverUrl)) {
        setContextStats(null);
        // We do NOT clear kvStats here, as it might be relevant across sessions
        return;
    }
    
    usageFailuresRef.current = 0;
    
    const pollUsage = async () => {
        if (usageFailuresRef.current > 5) return;
        
        // Use the ID from closure if needed, but safer to pass explicit
        const stats = await fetchTokenUsage(currentSessionId, settings);
        
        if (stats) {
            // Update Context Stats (Session Specific)
            setContextStats({
                used: stats.token_used,
                total: stats.max_model_len
            });

            // Update KV Stats (Global)
            if (stats.total_kv_cache_tokens) {
                setKvStats({
                    used: stats.used_kvcache_tokens,
                    total: stats.total_kv_cache_tokens
                });
            }

            usageFailuresRef.current = 0;
        } else {
            usageFailuresRef.current += 1;
        }
    };
    
    pollUsage();
    const intervalId = setInterval(pollUsage, 3000);
    return () => clearInterval(intervalId);
  }, [currentSessionId, settings.contextCache, settings.serverUrl, isCustomServer]);


  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [settings.theme]);

  // SMART SCROLL LOGIC
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  };

  // Only auto-scroll if the user hasn't scrolled up
  useEffect(() => {
    if (shouldAutoScrollRef.current) {
      scrollToBottom();
    }
  }, [sessions, currentSessionId, isStreaming]);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    
    // Check if user is near bottom (within 50px)
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    shouldAutoScrollRef.current = isAtBottom;
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'inherit'; 
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(Math.max(scrollHeight, 56), 200)}px`;
    }
  }, [input]);

  const getCurrentSession = () => sessions.find(s => s.id === currentSessionId);

  const createNewSession = () => {
    if (isStreaming) return null; // Block creating new session while streaming
    
    const newSession: ChatSession = {
      id: uuidv4(),
      title: 'New Chat',
      messages: [],
      lastUpdated: Date.now(),
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    
    setContextStats(null); // Reset session-specific stats
    // KV Stats are preserved globally

    usageFailuresRef.current = 0; // Reset polling check
    shouldAutoScrollRef.current = true; // Reset scroll lock
    setTimeout(() => textareaRef.current?.focus(), 100);
    return newSession.id;
  };

  const updateSessionMessages = (sessionId: string, messages: Message[]) => {
    setSessions(prev => prev.map(s => {
      if (s.id === sessionId) {
        return { ...s, messages, lastUpdated: Date.now() };
      }
      return s;
    }));
  };

  const updateSessionTitle = (sessionId: string, title: string) => {
     setSessions(prev => prev.map(s => {
      if (s.id === sessionId) return { ...s, title };
      return s;
    }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleShare = () => {
    const session = getCurrentSession();
    if (!session) return;
    
    let markdown = `# ${session.title}\n\n`;
    session.messages.forEach(msg => {
      const role = msg.role === Role.User ? 'User' : 'ChatClient';
      markdown += `### ${role}\n${msg.text}\n\n`;
    });

    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session-${new Date().toISOString().slice(0,10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const parseMessageContent = (text: string) => {
    const thinkRegex = /<think>([\s\S]*?)(?:<\/think>|$)/;
    const match = text.match(thinkRegex);

    if (match) {
      const thoughtContent = match[1];
      const isComplete = text.includes('</think>');
      const mainContent = text.replace(match[0], '').trim();
      return { hasThought: true, thought: thoughtContent, isComplete, mainContent };
    }
    
    return { hasThought: false, thought: '', isComplete: true, mainContent: text };
  };

  const executeStream = async (
    sessionId: string, 
    historyMessages: Message[], 
    userText: string, 
    userAttachments: FileAttachment[]
  ) => {
    setIsStreaming(true);
    shouldAutoScrollRef.current = true; // Force scroll to bottom on start
    abortControllerRef.current = new AbortController();

    const newUserMsg: Message = {
      id: uuidv4(),
      role: Role.User,
      text: userText,
      attachments: userAttachments,
      timestamp: Date.now(),
    };

    const newBotMsg: Message = {
      id: uuidv4(),
      role: Role.Model,
      text: '', 
      timestamp: Date.now() + 1,
    };

    const updatedMessages = [...historyMessages, newUserMsg, newBotMsg];
    updateSessionMessages(sessionId, updatedMessages);

    // Buffer for Smooth Rendering
    let bufferedText = "";
    let animationFrameId: number;

    const flushBuffer = () => {
       setSessions(prev => prev.map(s => {
          if (s.id === sessionId) {
            const msgs = [...s.messages];
            const lastMsg = msgs[msgs.length - 1];
            if (lastMsg && lastMsg.role === Role.Model) {
               // Only update if changed to avoid unnecessary renders
               if (lastMsg.text !== bufferedText) {
                  lastMsg.text = bufferedText;
               }
            }
            return { ...s, messages: msgs };
          }
          return s;
       }));
       animationFrameId = requestAnimationFrame(flushBuffer);
    };

    // Start the render loop
    animationFrameId = requestAnimationFrame(flushBuffer);

    try {
      const historyForApi = updatedMessages.slice(0, -1); 

      await streamChatResponse(
        sessionId,
        historyForApi.filter(m => m.role !== Role.Model || m.text.length > 0),
        userText,
        userAttachments,
        settings,
        abortControllerRef.current.signal,
        (chunkText) => {
          if (abortControllerRef.current?.signal.aborted) return;
          // Just update the buffer, don't trigger state update here
          bufferedText = chunkText;
        }
      );

      // Handle Title Generation (only if it's the first exchange)
      if (historyMessages.length === 0) {
        if (settings.generateTitles) {
            generateTitle(userText, settings).then(t => {
                updateSessionTitle(sessionId, t);
            });
        } else {
            const fallbackTitle = userText.length > 30 ? userText.slice(0, 30) + '...' : userText;
            updateSessionTitle(sessionId, fallbackTitle);
        }
      }

    } catch (error: any) {
       // Stop the render loop immediately on error
       cancelAnimationFrame(animationFrameId);
       
       if (error.name === 'AbortError') {
          setSessions(prev => prev.map(s => {
            if (s.id === sessionId) {
              const msgs = [...s.messages];
              const lastMsg = msgs[msgs.length - 1];
              
              if (lastMsg && lastMsg.role === Role.Model) {
                // Ensure we capture whatever was in buffer before stopping
                lastMsg.text = bufferedText; 
                
                const isInThinking = lastMsg.text.includes('<think>') && !lastMsg.text.includes('</think>');
                const alreadyStopped = lastMsg.text.endsWith('[Stopped]') || lastMsg.text.endsWith('_⛔ Generation stopped by user_');

                if (!alreadyStopped) {
                    // If we were in thinking, we don't append text, the UI handles the 'Interrupted' state
                    if (!isInThinking) {
                        lastMsg.text += "\n\n_⛔ Generation stopped by user_";
                    } else {
                        // If thinking was interrupted, we might append a subtle stopped marker for raw text logs, 
                        // but the ThinkingProcess component handles the visuals.
                        // We do nothing here to avoid breaking the think tag structure.
                    }
                }
              }
              return { ...s, messages: msgs };
            }
            return s;
          }));
       } else {
           setSessions(prev => prev.map(s => {
                if (s.id === sessionId) {
                  const msgs = [...s.messages];
                  const lastMsg = msgs[msgs.length - 1];
                  if (lastMsg) {
                    lastMsg.text = bufferedText; // Flush buffer
                    lastMsg.text = `Error: ${error.message || "Failed to generate response"}. Check API settings.`;
                    lastMsg.isError = true;
                  }
                  return { ...s, messages: msgs };
                }
                return s;
           }));
       }
    } finally {
      cancelAnimationFrame(animationFrameId); // Ensure loop stops
      setIsStreaming(false);
      abortControllerRef.current = null;
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  };

  const handleSendMessage = async () => {
    if ((!input.trim() && attachments.length === 0) || isStreaming) return;

    let activeSessionId = currentSessionId;
    let currentHistory: Message[] = [];

    if (!activeSessionId) {
      const newId = createNewSession();
      if (!newId) return; // creation failed (blocked by streaming)
      activeSessionId = newId;
    } else {
      const session = sessions.find(s => s.id === activeSessionId);
      if (session) currentHistory = session.messages;
    }

    if (!activeSessionId) return;

    // CLIENT SIDE TOKEN GUARD
    const newMessageTokens = estimateTokenCount(input) + attachments.reduce((acc, f) => acc + (f.tokenCount || 0), 0);

    if (settings.contextCache && contextStats && contextStats.total > 0) {
        // Precise Check: Based on server stats
        const availableTokens = contextStats.total - contextStats.used;
        
        // Strict check: if new message exceeds remaining space
        if (newMessageTokens > availableTokens) {
             alert(`Message blocked: Estimated token usage (${newMessageTokens}) exceeds remaining context space (${availableTokens}). Please start a new chat or shorten context.`);
             return;
        }
    } else {
        // Fallback Heuristic Check (if server stats unavailable)
        // Estimate total session history + new message
        let totalSessionTokens = 0;
        currentHistory.forEach(m => {
             totalSessionTokens += estimateTokenCount(m.text);
             m.attachments?.forEach(a => totalSessionTokens += (a.tokenCount || 0));
        });
        totalSessionTokens += newMessageTokens;

        // Limit to 150% of the Max Output Tokens setting (acting as a proxy for context limit in fallback mode)
        const fallbackLimit = settings.maxOutputTokens * 1.5;
        if (totalSessionTokens > fallbackLimit) {
            alert(`Message blocked: Estimated conversation tokens (${totalSessionTokens}) exceeds fallback limit (${fallbackLimit}). Please start a new chat.`);
            return;
        }
    }

    const textToSend = input;
    const attachmentsToSend = attachments;

    setInput('');
    setAttachments([]);

    await executeStream(activeSessionId, currentHistory, textToSend, attachmentsToSend);
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleResend = (botMessageIndex: number) => {
    if (isStreaming) return;
    const session = getCurrentSession();
    if (!session) return;

    const userMsgIndex = botMessageIndex - 1;
    if (userMsgIndex < 0) return;
    
    const userMessage = session.messages[userMsgIndex];
    if (userMessage.role !== Role.User) return; 

    // Branching logic base
    const historyBeforeTurn = session.messages.slice(0, userMsgIndex);
    
    // REDO + CONTEXT CACHE BRANCHING
    // If context cache is enabled, we MUST generate a new Session ID
    // so the server doesn't use the cached tokens from the *previous* bot response.
    if (settings.contextCache) {
        const newSessionId = uuidv4();
        
        setSessions(prev => prev.map(s => {
            if (s.id === session.id) {
                return {
                    ...s,
                    id: newSessionId,
                    messages: historyBeforeTurn
                };
            }
            return s;
        }));
        
        setCurrentSessionId(newSessionId);
        
        setContextStats(null); // Reset session stats for new ID
        // KV stats preserved
        
        usageFailuresRef.current = 0;
        
        // Execute with new ID
        executeStream(newSessionId, historyBeforeTurn, userMessage.text, userMessage.attachments || []);

    } else {
        // Standard Redo (same session ID)
        updateSessionMessages(session.id, historyBeforeTurn);
        executeStream(session.id, historyBeforeTurn, userMessage.text, userMessage.attachments || []);
    }
  };

  // Open the modal for editing
  const openEditModal = (userMsgIndex: number) => {
      if (isStreaming) return;
      const session = getCurrentSession();
      if (!session) return;
      
      const userMessage = session.messages[userMsgIndex];
      setEditingMessage({ index: userMsgIndex, text: userMessage.text });
  };

  // Confirm edit from modal
  const handleConfirmEdit = (newText: string) => {
      if (!editingMessage || !currentSessionId) return;
      const session = getCurrentSession();
      if (!session) return;

      const userMsgIndex = editingMessage.index;
      const originalMessage = session.messages[userMsgIndex];

      const historyBeforeTurn = session.messages.slice(0, userMsgIndex);
      
      // Branching logic: Always new ID for clean state on edit
      const newSessionId = uuidv4();

      setSessions(prev => prev.map(s => {
          if (s.id === currentSessionId) {
              return {
                  ...s,
                  id: newSessionId,
                  messages: historyBeforeTurn
              };
          }
          return s;
      }));
      
      setCurrentSessionId(newSessionId);
      
      setContextStats(null); // Reset session stats
      // KV stats preserved
      
      usageFailuresRef.current = 0;
      
      executeStream(newSessionId, historyBeforeTurn, newText, originalMessage.attachments || []);
      setEditingMessage(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files) as File[];
      const newAttachments: FileAttachment[] = [];

      for (const file of filesArray) {
        const isText = file.type.startsWith('text/') || 
                       file.name.match(/\.(js|jsx|ts|tsx|rs|py|c|cpp|h|java|go|rb|php|html|css|json|md|yaml|toml|sh|bat|sql|xml|txt)$/i);

        if (!isText) {
            alert(`File "${file.name}" ignored. Only text/code files are supported.`);
            continue;
        }

        try {
          const text = await file.text();
          // Use the exported estimation helper for consistency
          const tokens = estimateTokenCount(text);
          newAttachments.push({
            name: file.name,
            type: file.type,
            content: text,
            tokenCount: tokens
          });
        } catch (err) {
          console.error("Failed to read file", file.name);
        }
      }
      setAttachments(prev => [...prev, ...newAttachments]);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (isStreaming && id === currentSessionId) return; // Prevent deleting active stream

    const sessionToDelete = sessions.find(s => s.id === id);
    if (!sessionToDelete) return;

    // Only prompt confirmation if there are messages
    let shouldDelete = true;
    if (sessionToDelete.messages.length > 0) {
        shouldDelete = window.confirm("Are you sure you want to delete this chat history?");
    }

    if (shouldDelete) {
      const newSessions = sessions.filter(s => s.id !== id);
      setSessions(newSessions);
      if (currentSessionId === id) {
        setCurrentSessionId(newSessions.length > 0 ? newSessions[0].id : null);
        setContextStats(null); // Clear context stats for deleted session
      }
    }
  };

  const toggleTheme = () => {
    setSettings(prev => ({ ...prev, theme: prev.theme === 'dark' ? 'light' : 'dark' }));
  };

  const currentSession = getCurrentSession();

  return (
    <div className="flex h-screen w-full bg-white dark:bg-dark-950 text-gray-900 dark:text-gray-100 transition-colors duration-300">
      
      {/* Sidebar */}
      <div className="w-64 bg-gray-50 dark:bg-dark-900 border-r border-gray-200 dark:border-dark-800 flex flex-col hidden md:flex transition-all duration-300">
        <div className="p-4 flex items-center gap-2">
           <div className="w-8 h-8 bg-gray-900 dark:bg-white rounded-lg flex items-center justify-center font-bold text-white dark:text-black shadow-sm">C</div>
           <span className="font-bold text-lg tracking-tight text-gray-900 dark:text-gray-100">ChatClient</span>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
          <button 
            onClick={() => createNewSession()}
            disabled={isStreaming}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 text-gray-900 dark:text-gray-100 rounded-xl transition-all text-sm font-medium shadow-sm mb-4 group ${isStreaming ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-dark-700'}`}
          >
            <span className="text-xl leading-none font-light text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">+</span> 
            <span>New Chat</span>
          </button>

          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider px-3 mb-2 mt-6">History</div>
          
          {sessions.map(session => {
            // Check if THIS specific session is the one currently streaming
            const isThisSessionStreaming = isStreaming && currentSessionId === session.id;

            return (
            <div 
              key={session.id}
              onClick={() => {
                  setCurrentSessionId(session.id);
                  setContextStats(null); // Clear context stats when switching, will re-poll
              }}
              className={`group relative flex items-center px-3 py-2.5 text-sm rounded-lg transition-all cursor-pointer ${
                currentSessionId === session.id 
                  ? 'bg-gray-200 dark:bg-dark-800 text-gray-900 dark:text-white font-medium shadow-sm' 
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-800'
              }`}
            >
              <span className="truncate flex-1 pr-6">{session.title}</span>
              {isThisSessionStreaming && (
                 <div className="absolute right-2 text-indigo-500">
                    <WritingIcon />
                 </div>
              )}
              {/* Only show delete if NOT streaming this specific session */}
              {!isThisSessionStreaming && (
                <button 
                  onClick={(e) => deleteSession(e, session.id)}
                  className="absolute right-2 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
                >
                  ×
                </button>
              )}
            </div>
          )})}
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-dark-800 space-y-1">
          <button 
            onClick={toggleTheme}
            className="flex items-center gap-3 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors text-sm w-full px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-800"
          >
            {settings.theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            <span>{settings.theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-3 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors text-sm w-full px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-800"
          >
            <SettingsIcon />
            <span>Settings</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col h-full relative bg-white dark:bg-dark-950 transition-colors duration-300">
        
        {/* Error Banner */}
        {configError && (
            <div className="bg-red-500 text-white text-xs p-2 text-center animate-pulse">
                {configError}
            </div>
        )}

        {/* Mobile Header */}
        <div className="md:hidden p-4 border-b border-gray-200 dark:border-dark-800 flex justify-between items-center bg-white dark:bg-dark-900 z-10">
           <span className="font-bold text-gray-900 dark:text-white">ChatClient</span>
           <div className="flex gap-4">
              <button onClick={toggleTheme} className="text-gray-600 dark:text-gray-400">
                 {settings.theme === 'dark' ? <SunIcon /> : <MoonIcon />}
              </button>
              <button onClick={() => setIsSettingsOpen(true)} className="text-gray-600 dark:text-gray-400">
                <SettingsIcon />
              </button>
           </div>
        </div>

        {/* Chat Area */}
        <div 
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 scroll-smooth"
        >
          {!currentSession || currentSession.messages.length === 0 ? (
             <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-600">
                <div className="w-20 h-20 mb-6 rounded-2xl bg-gray-100 dark:bg-dark-900 flex items-center justify-center">
                    <div className="text-gray-300 dark:text-gray-700">
                      <BotIcon /> 
                    </div>
                </div>
                <h3 className="text-2xl font-semibold text-gray-900 dark:text-gray-200 mb-2">Welcome to ChatClient</h3>
                <p className="text-center max-w-md text-gray-500 dark:text-gray-500">
                  Start a conversation by typing a message or uploading a file below.
                </p>
             </div>
          ) : (
            currentSession.messages.map((msg, index) => {
              const contentParts = msg.role === Role.Model ? parseMessageContent(msg.text) : null;
              
              // Only show "Waiting" animation if this is the active stream AND the last message
              const isWaitingForFirstToken = isStreaming && currentSessionId === currentSession.id && msg.role === Role.Model && msg.text === '' && index === currentSession.messages.length - 1;
              
              // Calculate if thinking is truncated
              // Logic: Has thought, but NOT complete, and we are NO LONGER streaming.
              const isThinkingTruncated = contentParts && contentParts.hasThought && !contentParts.isComplete && !isStreaming;

              return (
              <div key={msg.id} className={`flex gap-4 max-w-4xl mx-auto ${msg.role === Role.User ? 'flex-row-reverse' : ''}`}>
                <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-1 border border-gray-200 dark:border-gray-700 ${
                  msg.role === Role.User 
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300' 
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 shadow-sm'
                }`}>
                  {msg.role === Role.User ? <UserIcon /> : <BotIcon />}
                </div>

                <div className={`flex flex-col max-w-[85%] lg:max-w-[75%] ${msg.role === Role.User ? 'items-end' : 'items-start'}`}>
                   
                   <div className="flex items-center gap-2 mb-1 px-1">
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                        {msg.role === Role.User ? 'You' : 'ChatClient'}
                      </span>
                   </div>

                   <div className={`px-5 py-3.5 rounded-2xl shadow-sm text-sm md:text-base leading-7 ${
                     msg.role === Role.User 
                       ? 'bg-gray-100 dark:bg-dark-800 text-gray-900 dark:text-gray-100 rounded-tr-none' 
                       : `text-gray-900 dark:text-gray-100 ${msg.isError ? 'text-red-600 dark:text-red-400' : ''}`
                   }`}>
                     {msg.attachments && msg.attachments.length > 0 && (
                       <div className="mb-3 pb-2 border-b border-gray-200 dark:border-gray-700 text-xs flex flex-wrap gap-2">
                         {msg.attachments.map((file, i) => (
                            <span key={i} className="flex items-center gap-1 bg-white dark:bg-dark-900 px-2 py-1 rounded border border-gray-200 dark:border-dark-700">
                              📄 {file.name} 
                              <span className="text-gray-400 dark:text-gray-500 text-[10px]">({file.tokenCount}t)</span>
                            </span>
                         ))}
                       </div>
                     )}
                     
                     {msg.role === Role.Model ? (
                        <div className="markdown-body">
                           {isWaitingForFirstToken && (
                               <div className="flex items-center gap-1 h-6">
                                 <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
                                 <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-75"></div>
                                 <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-150"></div>
                               </div>
                           )}
                           {contentParts && contentParts.hasThought && (
                             <ThinkingProcess 
                                thought={contentParts.thought} 
                                isComplete={contentParts.isComplete}
                                isTruncated={!!isThinkingTruncated}
                             />
                           )}
                           <ReactMarkdown remarkPlugins={[remarkGfm]}>
                             {contentParts ? contentParts.mainContent : msg.text}
                           </ReactMarkdown>
                        </div>
                     ) : (
                        <div className="whitespace-pre-wrap">{msg.text}</div>
                     )}
                   </div>
                   
                   {msg.role === Role.Model && !isStreaming && !msg.isError && (
                      <div className="flex items-center gap-3 mt-2 px-1 justify-start">
                            <button 
                              onClick={() => handleResend(index)}
                              className="text-xs font-medium text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 flex items-center gap-1.5 transition-colors px-1"
                              title="Regenerate Response"
                            >
                               <RefreshIcon /> Redo
                            </button>
                            <button 
                              onClick={() => copyToClipboard(msg.text)}
                              className="text-xs font-medium text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 flex items-center gap-1.5 transition-colors px-1"
                              title="Copy Text"
                            >
                               <CopyIcon /> Copy
                            </button>
                            <button 
                              onClick={handleShare}
                              className="text-xs font-medium text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 flex items-center gap-1.5 transition-colors px-1"
                              title="Download Chat History"
                            >
                               <ShareIcon /> Share
                            </button>
                       </div>
                   )}
                    {msg.role === Role.User && !isStreaming && (
                        <div className="flex items-center gap-3 mt-2 px-1 justify-end">
                         <button 
                           onClick={() => openEditModal(index)}
                           className="text-xs font-medium text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 flex items-center gap-1 transition-colors bg-gray-50 dark:bg-dark-900 px-2 py-1 rounded"
                           title="Edit to resend"
                         >
                           <EditIcon /> Edit
                         </button>
                        </div>
                    )}
                </div>
              </div>
            )})
          )}
          <div ref={messagesEndRef} className="h-4" />
        </div>

        {/* Input Area */}
        <div className="p-4 md:p-6 bg-white dark:bg-dark-950 transition-colors duration-300 z-20">
           <div className="max-w-4xl mx-auto relative">
              
              {attachments.length > 0 && (
                <div className="absolute bottom-full left-0 mb-3 flex flex-wrap gap-2">
                   {attachments.map((f, i) => (
                     <div key={i} className="flex items-center gap-2 bg-gray-100 dark:bg-dark-800 text-xs text-gray-600 dark:text-gray-300 pl-3 pr-2 py-1.5 rounded-full border border-gray-200 dark:border-dark-700 shadow-sm animate-in fade-in slide-in-from-bottom-2">
                        <span className="truncate max-w-[120px] font-medium">{f.name}</span>
                        <span className="text-gray-400 text-[10px]">{f.tokenCount}t</span>
                        <button 
                          onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))} 
                          className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-dark-600 text-gray-400 transition-colors"
                        >
                          ×
                        </button>
                     </div>
                   ))}
                </div>
              )}

              <div className="relative flex items-end gap-2 bg-gray-50 dark:bg-dark-900 border border-gray-300 dark:border-dark-700 rounded-3xl shadow-sm focus-within:shadow-md focus-within:border-gray-400 dark:focus-within:border-gray-500 transition-all p-2">
                 <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isStreaming}
                    className="p-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors rounded-full hover:bg-gray-200 dark:hover:bg-dark-800 flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Upload files"
                  >
                    <PaperClipIcon />
                 </button>
                 <input 
                   type="file" 
                   multiple 
                   ref={fileInputRef} 
                   className="hidden" 
                   onChange={handleFileUpload}
                  />

                 <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    disabled={isStreaming}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder={isStreaming ? "Wait for response..." : "Message ChatClient..."}
                    className="flex-1 bg-transparent border-none focus:ring-0 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 resize-none py-3 px-4 max-h-[200px] min-h-[24px] leading-6 custom-scrollbar disabled:cursor-not-allowed"
                    rows={1}
                 />

                 {/* Stop Button - ONLY active if we are viewing the streaming session */}
                 {isStreaming && currentSessionId && sessions.find(s => s.id === currentSessionId)?.id === sessions.find(s => s.id === currentSessionId && isStreaming)?.id ? (
                   <button 
                     onClick={handleStopGeneration}
                     className="p-2 mb-1 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors animate-pulse flex-shrink-0"
                   >
                     <StopIcon />
                   </button>
                 ) : isStreaming ? (
                   // If streaming but viewing another session, show disabled send icon or nothing? 
                   // UI choice: Show disabled send to indicate global busy state
                   <button 
                     disabled
                     className="p-2 mb-1 bg-gray-400 text-white rounded-full opacity-50 cursor-not-allowed flex-shrink-0"
                   >
                     <SendIcon />
                   </button>
                 ) : (
                   <button 
                     onClick={() => handleSendMessage()}
                     disabled={!input.trim() && attachments.length === 0}
                     className="p-2 mb-1 bg-gray-900 dark:bg-white text-white dark:text-black rounded-full hover:bg-gray-700 dark:hover:bg-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-md flex-shrink-0"
                   >
                     <SendIcon />
                   </button>
                 )}
              </div>
              
              <div className="flex flex-col items-center mt-3 gap-1">
                 {/* Footer Token Indicator */}
                 {settings.contextCache && (contextStats || kvStats) && (
                    <div className="flex items-center gap-3 px-3 py-1 rounded-full bg-gray-100 dark:bg-dark-900 border border-gray-200 dark:border-dark-800 text-[10px] font-mono text-gray-500 dark:text-gray-400 animate-in fade-in slide-in-from-bottom-2">
                        {/* Context Usage - Only show if session has data */}
                        {contextStats && (
                            <div className="flex items-center gap-1.5" title="Context Window Usage">
                                <span className={`w-1.5 h-1.5 rounded-full ${contextStats.used > contextStats.total * 0.9 ? 'bg-red-500' : contextStats.used > contextStats.total * 0.7 ? 'bg-yellow-500' : 'bg-green-500'}`}></span>
                                <span>CTX: {contextStats.used.toLocaleString()} / {contextStats.total.toLocaleString()}</span>
                            </div>
                        )}
                        
                        {contextStats && kvStats && (
                            <div className="w-px h-3 bg-gray-300 dark:bg-dark-700"></div>
                        )}

                        {/* KV Cache Usage - Always show if available (Global) */}
                        {kvStats && (
                            <div className="flex items-center gap-1.5" title="KV Cache Usage">
                               <span className={`w-1.5 h-1.5 rounded-full ${kvStats.used > kvStats.total * 0.9 ? 'bg-red-500' : 'bg-green-500'}`}></span>
                               <span>KV: {kvStats.used.toLocaleString()} / {kvStats.total.toLocaleString()}</span>
                            </div>
                        )}
                    </div>
                 )}
                 <p className="text-[10px] text-gray-400 dark:text-gray-600">
                    AI can make mistakes. Please verify important information.
                 </p>
              </div>

           </div>
        </div>
      </div>

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSettingsChange={setSettings}
      />

      <EditMessageModal 
        isOpen={!!editingMessage}
        onClose={() => setEditingMessage(null)}
        initialText={editingMessage?.text || ''}
        onConfirm={handleConfirmEdit}
      />

    </div>
  );
};

export default App;