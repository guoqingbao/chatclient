
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message, ChatSession, Role, AppSettings, DEFAULT_SETTINGS, FileAttachment, TokenUsage, SessionStatus } from './types';
import { streamChatResponse, generateTitle, fetchTokenUsage, estimateTokenCount, fetchServerConfig, fetchModelCapabilities, fetchAvailableModels } from './services/geminiService';
import { BotIcon, UserIcon, SendIcon, StopIcon, PaperClipIcon, SettingsIcon, RefreshIcon, CopyIcon, ShareIcon, SunIcon, MoonIcon, EditIcon, WritingIcon, CachedIcon, SwappedIcon, WaitingIcon, FinishedIcon, ImageIcon } from './components/Icon';
import SettingsModal from './components/SettingsModal';

const ThinkingProcess = ({ thought, isComplete, isTruncated }: { thought: string, isComplete: boolean, isTruncated: boolean }) => {
  const [isOpen, setIsOpen] = useState(!isComplete || isTruncated);

  useEffect(() => {
    if (isComplete && !isTruncated) {
      setIsOpen(false);
    } else if (!isComplete && !isTruncated) {
      setIsOpen(true);
    }
  }, [isComplete, isTruncated]);

  if (isTruncated && !thought) {
      return (
          <div className="mb-4 p-3 border-l-4 border-amber-400 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-600 rounded-r-md text-sm text-amber-800 dark:text-amber-200 flex items-start gap-3 shadow-sm animate-in fade-in slide-in-from-top-1">
             <span className="text-lg leading-none mt-0.5">⚠️</span>
             <div className="flex flex-col">
                 <span className="font-semibold">Thinking Process Truncated</span>
                 <span className="text-xs opacity-90">The thought process was interrupted. The partial content has been displayed below.</span>
             </div>
          </div>
      );
  }

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

  const [useSampling, setUseSampling] = useState(false);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingSessionId, setStreamingSessionId] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [configError, setConfigError] = useState<string | null>(null);
  const [isMultimodal, setIsMultimodal] = useState(false);
  const [editingMessage, setEditingMessage] = useState<{index: number, text: string} | null>(null);

  const [contextStats, setContextStats] = useState<{used: number, total: number, status?: SessionStatus} | null>(null);
  const [kvStats, setKvStats] = useState<{used: number, total: number} | null>(null);
  const [swapStats, setSwapStats] = useState<{used: number, total: number} | null>(null);
  const [sessionStatuses, setSessionStatuses] = useState<Record<string, SessionStatus>>({});

  const usageFailuresRef = useRef(0);
  const sessionsRef = useRef(sessions);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true); 
  const botTurnRef = useRef<HTMLDivElement>(null); // Ref for the newest bot response start
  const scrollToNewTurnRef = useRef(false); // Flag to trigger scroll to top

  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let attempts = 0;
    const maxAttempts = 5;
    const loadConfig = async () => {
        const config = await fetchServerConfig();
        if (config && config.serverUrl) {
            setSettings(prev => ({ ...prev, serverUrl: config.serverUrl!, apiKey: config.apiKey || prev.apiKey }));
            setConfigError(null);
        } else {
            attempts++;
            if (attempts < maxAttempts) setTimeout(loadConfig, 2000);
            else {
                setConfigError(`Unable to obtain server config automatically. Using default: ${DEFAULT_SETTINGS.serverUrl}`);
                setTimeout(() => setConfigError(null), 60000);
            }
        }
    };
    const hostConfig = window.CHAT_APP_CONFIG || window.RUST_APP_CONFIG;
    if (hostConfig) {
       setSettings(prev => ({ ...prev, model: hostConfig.defaultModel || prev.model, theme: hostConfig.initialTheme || prev.theme, serverUrl: hostConfig.serverUrl || prev.serverUrl, apiKey: hostConfig.apiKey || prev.apiKey }));
    } else loadConfig();
  }, []);

  useEffect(() => {
    const validateAndCheckCapabilities = async () => {
        if (!settings.serverUrl) return;
        const availableModels = await fetchAvailableModels(settings);
        let currentModel = settings.model;
        if (availableModels && availableModels.length > 0) {
             const modelIds = availableModels.map((m: any) => m.id);
             if (currentModel === 'default' || !modelIds.includes(currentModel)) {
                 currentModel = modelIds[0];
                 setSettings(prev => ({ ...prev, model: currentModel }));
             }
             const modelData = availableModels.find((m: any) => m.id === currentModel);
             setIsMultimodal(modelData?.modalities?.includes("image") || false);
        } else {
             const caps = await fetchModelCapabilities(settings);
             setIsMultimodal(caps.isMultimodal);
        }
    };
    validateAndCheckCapabilities();
  }, [settings.serverUrl, settings.apiKey, settings.model]);

  useEffect(() => {
    if (sessions.length > 0 && !currentSessionId) setCurrentSessionId(sessions[0].id);
    else if (sessions.length === 0) createNewSession();
  }, []);

  useEffect(() => {
    sessionsRef.current = sessions;
    if (sessions.length > 0) localStorage.setItem('chat_client_sessions', JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem('chat_client_settings', JSON.stringify(settings));
  }, [settings]);

  const isCustomServer = useCallback((url: string) => {
    if (!url) return false;
    if (url.includes('localhost') || url.includes('127.0.0.1')) return true;
    try {
        const urlObj = new URL(url.startsWith('http') ? url : `http://${url}`);
        if (urlObj.port) return true;
    } catch (e) {
        if (/:[0-9]+/.test(url)) return true;
    }
    return false;
  }, []);

  useEffect(() => {
    if (!settings.contextCache || !currentSessionId || !isCustomServer(settings.serverUrl)) {
        setContextStats(null);
        return;
    }
    usageFailuresRef.current = 0;
    const pollCurrent = async () => {
        if (usageFailuresRef.current > 5) return;
        const currentSessions = sessionsRef.current;
        const session = currentSessions.find(s => s.id === currentSessionId);
        if (!session || session.messages.length === 0) return;
        const stats = await fetchTokenUsage(currentSessionId, settings);
        if (stats) {
            setContextStats({ used: stats.token_used, total: stats.max_model_len, status: stats.session_status });
            if (stats.total_kv_cache_tokens) setKvStats({ used: stats.used_kvcache_tokens, total: stats.total_kv_cache_tokens });
            if (stats.total_swap_memory !== undefined && stats.swap_used !== undefined) setSwapStats({ used: stats.swap_used, total: stats.total_swap_memory });
            if (stats.session_status) setSessionStatuses(prev => ({ ...prev, [currentSessionId]: stats.session_status! }));
            usageFailuresRef.current = 0;
        } else {
            setSessionStatuses(prev => { const newStatuses = { ...prev }; delete newStatuses[currentSessionId]; return newStatuses; });
            usageFailuresRef.current += 1;
        }
    };
    pollCurrent();
    const intervalId = setInterval(pollCurrent, 3000);
    return () => clearInterval(intervalId);
  }, [currentSessionId, settings.contextCache, settings.serverUrl, isCustomServer]);

  useEffect(() => {
    if (!settings.contextCache || !isCustomServer(settings.serverUrl)) return;
    const pollBackground = async () => {
        const currentSessions = sessionsRef.current;
        const backgroundSessions = currentSessions.filter(s => s.messages.length > 0 && s.id !== currentSessionId);
        for (const session of backgroundSessions) {
            const stats = await fetchTokenUsage(session.id, settings);
            if (stats) {
                if (stats.session_status) setSessionStatuses(prev => ({ ...prev, [session.id]: stats.session_status! }));
                if (stats.total_kv_cache_tokens) setKvStats({ used: stats.used_kvcache_tokens, total: stats.total_kv_cache_tokens });
                if (stats.total_swap_memory !== undefined) setSwapStats({ used: stats.swap_used || 0, total: stats.total_swap_memory });
            } else {
                setSessionStatuses(prev => { const newStatuses = { ...prev }; delete newStatuses[session.id]; return newStatuses; });
            }
        }
    };
    const intervalId = setInterval(pollBackground, 10000);
    return () => clearInterval(intervalId);
  }, [currentSessionId, settings.contextCache, settings.serverUrl, isCustomServer]);

  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
  }, [settings.theme]);

  // FIX: Explicitly align to 'end' (bottom) to avoid the spacer pushing content up to the top
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
  };

  // Modified auto-scroll effect: Block auto-scroll during streaming to support pinned top reading
  useEffect(() => {
    if (shouldAutoScrollRef.current && !isStreaming) {
      scrollToBottom();
    }
  }, [sessions, currentSessionId, isStreaming]);
  
  // Specific effect to handle "Pin to Top" for new turns
  useEffect(() => {
    if (scrollToNewTurnRef.current && botTurnRef.current) {
        // We use requestAnimationFrame and a small timeout to ensure layout (and the spacer) 
        // is fully rendered before we attempt to scroll.
        requestAnimationFrame(() => {
             setTimeout(() => {
                botTurnRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
             }, 50);
        });
        scrollToNewTurnRef.current = false;
    }
  }, [sessions]);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    
    // During streaming, we block auto-scroll to allow users to read fixed content
    if (!isStreaming) {
        shouldAutoScrollRef.current = isAtBottom;
    }
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
    if (isStreaming) return null;
    const newSession: ChatSession = { id: uuidv4(), title: 'New Chat', messages: [], lastUpdated: Date.now() };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    setContextStats(null);
    usageFailuresRef.current = 0;
    shouldAutoScrollRef.current = true;
    setTimeout(() => textareaRef.current?.focus(), 100);
    return newSession.id;
  };

  const updateSessionMessages = (sessionId: string, messages: Message[]) => {
    setSessions(prev => prev.map(s => {
      if (s.id === sessionId) return { ...s, messages, lastUpdated: Date.now() };
      return s;
    }));
  };

  const updateSessionTitle = (sessionId: string, title: string) => {
     setSessions(prev => prev.map(s => {
      if (s.id === sessionId) return { ...s, title };
      return s;
    }));
  };

  const copyToClipboard = (text: string) => navigator.clipboard.writeText(text);

  const handleShare = () => {
    const session = getCurrentSession();
    if (!session) return;
    let markdown = `# ${session.title}\n\n`;
    session.messages.forEach(msg => { markdown += `### ${msg.role === Role.User ? 'User' : 'ChatClient'}\n${msg.text}\n\n`; });
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
    const xmlMatch = text.match(/<think>([\s\S]*?)(?:<\/think>|$)/);
    if (xmlMatch) return { hasThought: true, thought: xmlMatch[1], isComplete: text.includes('</think>'), mainContent: text.replace(xmlMatch[0], '').trim() };
    const bracketMatch = text.match(/\[THINK\]([\s\S]*?)(?:\[\/THINK\]|$)/i);
    if (bracketMatch) return { hasThought: true, thought: bracketMatch[1], isComplete: text.includes('[/THINK]') || text.includes('[/think]'), mainContent: text.replace(bracketMatch[0], '').trim() };
    return { hasThought: false, thought: '', isComplete: true, mainContent: text };
  };

  const executeStream = async (sessionId: string, historyMessages: Message[], userText: string, userAttachments: FileAttachment[]) => {
    setIsStreaming(true);
    setStreamingSessionId(sessionId);
    setSessionStatuses(prev => ({ ...prev, [sessionId]: 'Running' }));

    // Disable auto-scroll so assistant text grows downward from a fixed top position
    shouldAutoScrollRef.current = false; 
    abortControllerRef.current = new AbortController();

    const newUserMsg: Message = { id: uuidv4(), role: Role.User, text: userText, attachments: userAttachments, timestamp: Date.now() };
    const newBotMsg: Message = { id: uuidv4(), role: Role.Model, text: '', timestamp: Date.now() + 1 };

    const updatedMessages = [...historyMessages, newUserMsg, newBotMsg];
    updateSessionMessages(sessionId, updatedMessages);
    
    // Set flag to trigger the "Pin to Top" scroll in useEffect
    scrollToNewTurnRef.current = true;

    let bufferedText = "";
    let animationFrameId: number;
    const flushBuffer = () => {
       setSessions(prev => prev.map(s => {
          if (s.id === sessionId) {
            const msgs = [...s.messages];
            const lastMsg = msgs[msgs.length - 1];
            if (lastMsg?.role === Role.Model && lastMsg.text !== bufferedText) lastMsg.text = bufferedText;
            return { ...s, messages: msgs };
          }
          return s;
       }));
       animationFrameId = requestAnimationFrame(flushBuffer);
    };
    animationFrameId = requestAnimationFrame(flushBuffer);

    try {
      await streamChatResponse(sessionId, historyMessages.filter(m => m.role !== Role.Model || m.text.length > 0), userText, userAttachments, settings, abortControllerRef.current.signal, (chunkText) => {
          if (abortControllerRef.current?.signal.aborted) return;
          bufferedText = chunkText;
      }, isMultimodal, useSampling);
      setSessions(prev => prev.map(s => {
          if (s.id === sessionId) {
            const msgs = [...s.messages];
            const lastMsg = msgs[msgs.length - 1];
            if (lastMsg?.role === Role.Model) lastMsg.text = bufferedText;
            return { ...s, messages: msgs };
          }
          return s;
      }));
      if (historyMessages.length === 0) {
        if (settings.generateTitles) generateTitle(userText, settings).then(t => updateSessionTitle(sessionId, t));
        else updateSessionTitle(sessionId, userText.length > 30 ? userText.slice(0, 30) + '...' : userText);
      }
    } catch (error: any) {
       cancelAnimationFrame(animationFrameId);
       if (error.name === 'AbortError') {
          setSessions(prev => prev.map(s => {
            if (s.id === sessionId) {
              const msgs = [...s.messages];
              const lastMsg = msgs[msgs.length - 1];
              if (lastMsg?.role === Role.Model) {
                lastMsg.text = bufferedText; 
                if (!lastMsg.text.includes('<think>') && !lastMsg.text.includes('[THINK]')) lastMsg.text += "\n\n_⛔ Generation stopped by user_";
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
                    lastMsg.text = `${bufferedText || lastMsg.text}\n\n**Error:** ${error.message || "Failed to generate response"}`;
                    lastMsg.isError = true;
                  }
                  return { ...s, messages: msgs };
                }
                return s;
           }));
       }
    } finally {
      cancelAnimationFrame(animationFrameId);
      setIsStreaming(false);
      setStreamingSessionId(null);
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
      if (!newId) return;
      activeSessionId = newId;
    } else {
      const session = sessions.find(s => s.id === activeSessionId);
      if (session) currentHistory = session.messages;
    }
    if (!activeSessionId) return;
    const newMessageTokens = estimateTokenCount(input) + attachments.reduce((acc, f) => acc + (f.tokenCount || 0), 0);
    if (settings.contextCache && contextStats && contextStats.total > 0) {
        const availableTokens = contextStats.total - contextStats.used;
        if (newMessageTokens > availableTokens) {
             alert(`Message blocked: Estimated token usage (${newMessageTokens}) exceeds remaining context space (${availableTokens}). Please start a new chat or shorten context.`);
             return;
        }
    } else {
        let totalSessionTokens = 0;
        currentHistory.forEach(m => { totalSessionTokens += estimateTokenCount(m.text); m.attachments?.forEach(a => totalSessionTokens += (a.tokenCount || 0)); });
        totalSessionTokens += newMessageTokens;
        const fallbackLimit = settings.maxOutputTokens * 1.5;
        if (totalSessionTokens > fallbackLimit) { alert(`Message blocked: Estimated conversation tokens (${totalSessionTokens}) exceeds fallback limit (${fallbackLimit}). Please start a new chat.`); return; }
    }
    const textToSend = input;
    const attachmentsToSend = attachments;
    setInput('');
    setAttachments([]);
    await executeStream(activeSessionId, currentHistory, textToSend, attachmentsToSend);
  };

  const handleStopGeneration = () => abortControllerRef.current?.abort();

  const handleResend = (botMessageIndex: number) => {
    if (isStreaming) return;
    const session = getCurrentSession();
    if (!session) return;
    const userMsgIndex = botMessageIndex - 1;
    if (userMsgIndex < 0 || session.messages[userMsgIndex].role !== Role.User) return; 
    const historyBeforeTurn = session.messages.slice(0, userMsgIndex);
    const userMessage = session.messages[userMsgIndex];
    if (settings.contextCache) {
        const newSessionId = uuidv4();
        setSessions(prev => prev.map(s => s.id === session.id ? { ...s, id: newSessionId, messages: historyBeforeTurn } : s));
        setCurrentSessionId(newSessionId);
        setContextStats(null);
        usageFailuresRef.current = 0;
        executeStream(newSessionId, historyBeforeTurn, userMessage.text, userMessage.attachments || []);
    } else {
        updateSessionMessages(session.id, historyBeforeTurn);
        executeStream(session.id, historyBeforeTurn, userMessage.text, userMessage.attachments || []);
    }
  };

  const openEditModal = (userMsgIndex: number) => {
      if (isStreaming) return;
      const session = getCurrentSession();
      const userMessage = session?.messages[userMsgIndex];
      if (userMessage) setEditingMessage({ index: userMsgIndex, text: userMessage.text });
  };

  const handleConfirmEdit = (newText: string) => {
      if (!editingMessage || !currentSessionId) return;
      const session = getCurrentSession();
      if (!session) return;
      const historyBeforeTurn = session.messages.slice(0, editingMessage.index);
      const originalMessage = session.messages[editingMessage.index];
      const newSessionId = uuidv4();
      setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, id: newSessionId, messages: historyBeforeTurn } : s));
      setCurrentSessionId(newSessionId);
      setContextStats(null);
      usageFailuresRef.current = 0;
      executeStream(newSessionId, historyBeforeTurn, newText, originalMessage.attachments || []);
      setEditingMessage(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files) as File[];
      const newAttachments: FileAttachment[] = [];
      for (const file of filesArray) {
        const isImage = file.type.startsWith('image/');
        if (isImage && !isMultimodal) { alert(`Image upload ignored. Current model "${settings.model}" does not support images.`); continue; }
        const isText = file.type.startsWith('text/') || file.name.match(/\.(js|jsx|ts|tsx|rs|py|c|cpp|h|java|go|rb|php|html|css|json|md|yaml|toml|sh|bat|sql|xml|txt)$/i);
        if (!isText && !isImage) { alert(`File "${file.name}" ignored. Only text/code or image files are supported.`); continue; }
        try {
          if (isImage) {
              const reader = new FileReader();
              reader.onload = (ev) => {
                  newAttachments.push({ name: file.name, type: file.type, content: ev.target?.result as string, tokenCount: 256 });
                  setAttachments(prev => [...prev, ...newAttachments].filter((v,i,a)=>a.findIndex(t=>(t.name===v.name))===i));
              };
              reader.readAsDataURL(file);
          } else {
              const text = await file.text();
              newAttachments.push({ name: file.name, type: file.type, content: text, tokenCount: estimateTokenCount(text) });
              setAttachments(prev => [...prev, ...newAttachments]);
          }
        } catch (err) { console.error("Failed to read file", file.name); }
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (id === streamingSessionId) return; 
    const sessionToDelete = sessions.find(s => s.id === id);
    if (sessionToDelete && (sessionToDelete.messages.length === 0 || window.confirm("Are you sure you want to delete this chat history?"))) {
      const newSessions = sessions.filter(s => s.id !== id);
      setSessions(newSessions);
      if (currentSessionId === id) { setCurrentSessionId(newSessions.length > 0 ? newSessions[0].id : null); setContextStats(null); }
    }
  };

  const toggleTheme = () => setSettings(prev => ({ ...prev, theme: prev.theme === 'dark' ? 'light' : 'dark' }));

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
          <button onClick={() => createNewSession()} disabled={isStreaming} className={`w-full flex items-center justify-center gap-2 px-4 py-3 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 text-gray-900 dark:text-gray-100 rounded-xl transition-all text-sm font-medium shadow-sm mb-4 group ${isStreaming ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-dark-700'}`}>
            <span className="text-xl leading-none font-light text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">+</span> 
            <span>New Chat</span>
          </button>
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider px-3 mb-2 mt-6">History</div>
          {sessions.map(session => (
            <div key={session.id} onClick={() => { setCurrentSessionId(session.id); setContextStats(null); }} className={`group relative flex items-center px-3 py-2.5 text-sm rounded-lg transition-all cursor-pointer ${currentSessionId === session.id ? 'bg-gray-200 dark:bg-dark-800 text-gray-900 dark:text-white font-medium shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-800'}`}>
              <span className="truncate flex-1 pr-6">{session.title}</span>
              <div className="absolute right-2 flex items-center gap-1">
                 {streamingSessionId === session.id ? <div className="text-indigo-500"><WritingIcon /></div> : (
                    <>
                        {sessionStatuses[session.id] === 'Waiting' && <WaitingIcon />}
                        {sessionStatuses[session.id] === 'Cached' && <CachedIcon />}
                        {sessionStatuses[session.id] === 'Swapped' && <SwappedIcon />}
                        {sessionStatuses[session.id] === 'Finished' && <FinishedIcon />}
                    </>
                 )}
                 {streamingSessionId !== session.id && <button onClick={(e) => deleteSession(e, session.id)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity ml-1">×</button>}
              </div>
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-gray-200 dark:border-dark-800 space-y-1">
          <button onClick={toggleTheme} className="flex items-center gap-3 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors text-sm w-full px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-800">
            {settings.theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            <span>{settings.theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
          <button onClick={() => setIsSettingsOpen(true)} className="flex items-center gap-3 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors text-sm w-full px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-800">
            <SettingsIcon />
            <span>Settings</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col h-full relative bg-white dark:bg-dark-950 transition-colors duration-300">
        {configError && <div className="bg-red-500 text-white text-xs p-2 text-center animate-pulse">{configError}</div>}
        <div className="md:hidden p-4 border-b border-gray-200 dark:border-dark-800 flex justify-between items-center bg-white dark:bg-dark-900 z-10">
           <span className="font-bold text-gray-900 dark:text-white">ChatClient</span>
           <div className="flex gap-4">
              <button onClick={toggleTheme} className="text-gray-600 dark:text-gray-400">{settings.theme === 'dark' ? <SunIcon /> : <MoonIcon />}</button>
              <button onClick={() => setIsSettingsOpen(true)} className="text-gray-600 dark:text-gray-400"><SettingsIcon /></button>
           </div>
        </div>

        {/* Chat Area */}
        <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 scroll-smooth">
          {!currentSession || currentSession.messages.length === 0 ? (
             <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-600">
                <div className="w-20 h-20 mb-6 rounded-2xl bg-gray-100 dark:bg-dark-900 flex items-center justify-center"><div className="text-gray-300 dark:text-gray-700"><BotIcon /></div></div>
                <h3 className="text-2xl font-semibold text-gray-900 dark:text-gray-200 mb-2">Welcome to ChatClient</h3>
                <p className="text-center max-w-md text-gray-500 dark:text-gray-500">Start a conversation by typing a message or uploading a file below.{isMultimodal && <span className="block mt-2 text-indigo-500 text-sm">✨ Image upload enabled for this model</span>}</p>
             </div>
          ) : (
            currentSession.messages.map((msg, index) => {
              const contentParts = msg.role === Role.Model ? parseMessageContent(msg.text) : null;
              const isWaitingForFirstToken = isStreaming && streamingSessionId === currentSession.id && msg.role === Role.Model && msg.text === '' && index === currentSession.messages.length - 1;
              const isThinkingTruncated = contentParts && contentParts.hasThought && !contentParts.isComplete && !isStreaming;
              
              // Pin logic: attach ref to the assistant's response start (the very last message)
              const isAssistantActiveTurn = msg.role === Role.Model && index === currentSession.messages.length - 1;

              return (
              <div 
                key={msg.id} 
                ref={isAssistantActiveTurn ? botTurnRef : null}
                className={`scroll-mt-32 flex gap-4 max-w-4xl mx-auto ${msg.role === Role.User ? 'flex-row-reverse' : ''}`}
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-1 border border-gray-200 dark:border-gray-700 ${msg.role === Role.User ? 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300' : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 shadow-sm'}`}>
                  {msg.role === Role.User ? <UserIcon /> : <BotIcon />}
                </div>
                <div className={`flex flex-col max-w-[85%] lg:max-w-[75%] ${msg.role === Role.User ? 'items-end' : 'items-start'}`}>
                   <div className="flex items-center gap-2 mb-1 px-1"><span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{msg.role === Role.User ? 'You' : 'ChatClient'}</span></div>
                   <div className={`px-5 py-3.5 rounded-2xl shadow-sm text-sm md:text-base leading-7 ${msg.role === Role.User ? 'bg-gray-100 dark:bg-dark-800 text-gray-900 dark:text-gray-100 rounded-tr-none' : `text-gray-900 dark:text-gray-100 ${msg.isError ? 'text-red-600 dark:text-red-400' : ''}`}`}>
                     {msg.attachments?.length ? (
                       <div className="mb-3 pb-2 border-b border-gray-200 dark:border-gray-700 text-xs flex flex-wrap gap-2">
                         {msg.attachments.map((file, i) => (
                            <span key={i} className="flex items-center gap-1 bg-white dark:bg-dark-900 px-2 py-1 rounded border border-gray-200 dark:border-dark-700">
                              {file.type.startsWith('image/') ? <><img src={file.content} className="w-8 h-8 object-cover rounded border border-gray-300 dark:border-gray-700 mr-1" /><span>🖼️ {file.name}</span></> : <>📄 {file.name} <span className="text-gray-400 dark:text-gray-500 text-[10px]">({file.tokenCount}t)</span></>}
                            </span>
                         ))}
                       </div>
                     ) : null}
                     {msg.role === Role.User && msg.attachments?.some(a => a.type.startsWith('image/')) ? (
                        <div className="mb-4 flex flex-wrap gap-2">{msg.attachments.filter(a => a.type.startsWith('image/')).map((img, idx) => (<img key={idx} src={img.content} className="max-w-full h-auto max-h-[300px] rounded-lg border border-gray-200 dark:border-gray-700" />))}</div>
                     ) : null}
                     {msg.role === Role.Model ? (
                        <div className="markdown-body">
                           {isWaitingForFirstToken && <div className="flex items-center gap-1 h-6"><div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div><div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-75"></div><div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-150"></div></div>}
                           {contentParts?.hasThought && <ThinkingProcess thought={isThinkingTruncated ? "" : contentParts.thought} isComplete={contentParts.isComplete} isTruncated={!!isThinkingTruncated} />}
                           <ReactMarkdown remarkPlugins={[remarkGfm]}>{isThinkingTruncated ? (contentParts.thought + "\n\n" + contentParts.mainContent) : (contentParts ? contentParts.mainContent : msg.text)}</ReactMarkdown>
                        </div>
                     ) : <div className="whitespace-pre-wrap">{msg.text}</div>}
                   </div>
                   {msg.role === Role.Model && !isStreaming && !msg.isError && (
                      <div className="flex items-center gap-3 mt-2 px-1 justify-start">
                            <button onClick={() => handleResend(index)} className="text-xs font-medium text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 flex items-center gap-1.5 transition-colors px-1"><RefreshIcon /> Redo</button>
                            <button onClick={() => copyToClipboard(msg.text)} className="text-xs font-medium text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 flex items-center gap-1.5 transition-colors px-1"><CopyIcon /> Copy</button>
                            <button onClick={handleShare} className="text-xs font-medium text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 flex items-center gap-1.5 transition-colors px-1"><ShareIcon /> Share</button>
                       </div>
                   )}
                   {msg.role === Role.User && !isStreaming && <div className="flex items-center gap-3 mt-2 px-1 justify-end"><button onClick={() => openEditModal(index)} className="text-xs font-medium text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 flex items-center gap-1 transition-colors bg-gray-50 dark:bg-dark-900 px-2 py-1 rounded"><EditIcon /> Edit</button></div>}
                </div>
              </div>
            )})
          )}
          <div ref={messagesEndRef} className="h-4" />
          {/* Spacer to allow scrolling the last message to the top */}
          <div className="h-[80vh] w-full" aria-hidden="true" />
        </div>

        {/* Input Area */}
        <div className="p-4 md:p-6 bg-white dark:bg-dark-950 transition-colors duration-300 z-20">
           <div className="max-w-4xl mx-auto relative">
              {attachments.length > 0 && (
                <div className="absolute bottom-full left-0 mb-3 flex flex-wrap gap-2">
                   {attachments.map((f, i) => (
                     <div key={i} className="flex items-center gap-2 bg-gray-100 dark:bg-dark-800 text-xs text-gray-600 dark:text-gray-300 pl-3 pr-2 py-1.5 rounded-full border border-gray-200 dark:border-dark-700 shadow-sm animate-in fade-in slide-in-from-bottom-2">
                        {f.type.startsWith('image/') ? <img src={f.content} className="w-6 h-6 object-cover rounded-full border border-gray-300" /> : <span>📄</span>}
                        <span className="truncate max-w-[120px] font-medium">{f.name}</span>
                        {!f.type.startsWith('image/') && <span className="text-gray-400 text-[10px]">{f.tokenCount}t</span>}
                        <button onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))} className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-dark-600 text-gray-400 transition-colors">×</button>
                     </div>
                   ))}
                </div>
              )}
              <div className="relative flex items-end gap-2 bg-gray-50 dark:bg-dark-900 border border-gray-300 dark:border-dark-700 rounded-3xl shadow-sm focus-within:shadow-md focus-within:border-gray-400 dark:focus-within:border-gray-500 transition-all p-2">
                 <button onClick={() => fileInputRef.current?.click()} disabled={isStreaming} className="p-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors rounded-full hover:bg-gray-200 dark:hover:bg-dark-800 flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed">{isMultimodal ? <ImageIcon /> : <PaperClipIcon />}</button>
                 <input type="file" multiple ref={fileInputRef} className="hidden" accept={isMultimodal ? "*/*" : ".txt,.md,.json,.js,.ts,.tsx,.py,.java,.c,.cpp,.h,.rs,.go,.html,.css,.xml,.yaml,.toml,.sh,.bat,.sql"} onChange={handleFileUpload} />
                 <textarea ref={textareaRef} value={input} onChange={(e) => setInput(e.target.value)} disabled={isStreaming} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }} placeholder={isStreaming ? "Wait for response..." : "Message ChatClient..."} className="flex-1 bg-transparent border-none focus:ring-0 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 resize-none py-3 px-4 max-h-[200px] min-h-[24px] leading-6 custom-scrollbar disabled:cursor-not-allowed" rows={1} />
                 {isStreaming && currentSessionId === streamingSessionId ? <button onClick={handleStopGeneration} className="p-2 mb-1 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors animate-pulse flex-shrink-0"><StopIcon /></button> : <button onClick={() => handleSendMessage()} disabled={!input.trim() && attachments.length === 0} className={`p-2 mb-1 rounded-full transition-colors shadow-md flex-shrink-0 ${isStreaming ? 'bg-gray-400 cursor-not-allowed opacity-50' : 'bg-gray-900 dark:bg-white text-white dark:text-black hover:bg-gray-700 dark:hover:bg-gray-200'}`}><SendIcon /></button>}
              </div>
              <div className="flex flex-col items-center mt-3 gap-1">
                 {settings.contextCache && (contextStats || kvStats || swapStats) && (
                    <div className="flex items-center gap-3 px-3 py-1 rounded-full bg-gray-100 dark:bg-dark-900 border border-gray-200 dark:border-dark-800 text-[10px] font-mono text-gray-500 dark:text-gray-400 animate-in fade-in slide-in-from-bottom-2">
                        {contextStats?.status && <div className="flex items-center pr-1">{contextStats.status === 'Running' ? <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> : contextStats.status === 'Waiting' ? <WaitingIcon /> : contextStats.status === 'Cached' ? <CachedIcon /> : contextStats.status === 'Swapped' ? <SwappedIcon /> : <FinishedIcon />}</div>}
                        {contextStats && <div className="flex items-center gap-1.5"><span className={`w-1.5 h-1.5 rounded-full ${contextStats.used > contextStats.total * 0.9 ? 'bg-red-500' : 'bg-green-500'}`}></span><span>CTX: {contextStats.used.toLocaleString()} / {contextStats.total.toLocaleString()}</span></div>}
                        {contextStats && (kvStats || swapStats) && <div className="w-px h-3 bg-gray-300 dark:bg-dark-700"></div>}
                        {kvStats && <div className="flex items-center gap-1.5"><span className={`w-1.5 h-1.5 rounded-full ${kvStats.used > kvStats.total * 0.9 ? 'bg-red-500' : 'bg-green-500'}`}></span><span>KV: {kvStats.used.toLocaleString()} / {kvStats.total.toLocaleString()}</span></div>}
                        {swapStats && swapStats.total >= 0.2 && <><div className="w-px h-3 bg-gray-300 dark:bg-dark-700"></div><div className="flex items-center gap-1.5"><span className={`w-1.5 h-1.5 rounded-full ${swapStats.used > swapStats.total * 0.9 ? 'bg-red-500' : 'bg-green-500'}`}></span><span>Swap: {swapStats.used.toFixed(1)} / {swapStats.total.toFixed(1)} GB</span></div></>}
                    </div>
                 )}
                 <p className="text-[10px] text-gray-400 dark:text-gray-600">AI can make mistakes. Please verify important information.</p>
              </div>
           </div>
        </div>
      </div>
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} settings={settings} onSettingsChange={setSettings} useSampling={useSampling} onSamplingToggle={setUseSampling} />
      <EditMessageModal isOpen={!!editingMessage} onClose={() => setEditingMessage(null)} initialText={editingMessage?.text || ''} onConfirm={handleConfirmEdit} />
    </div>
  );
};

export default App;
