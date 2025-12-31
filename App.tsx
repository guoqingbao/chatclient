
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message, ChatSession, Role, AppSettings, DEFAULT_SETTINGS, FileAttachment, TokenUsage, SessionStatus, ToolCall } from './types';
import { streamChatResponse, generateTitle, fetchTokenUsage, estimateTokenCount, fetchServerConfig, fetchModelCapabilities, fetchAvailableModels } from './services/geminiService';
import { BotIcon, UserIcon, SendIcon, StopIcon, PaperClipIcon, SettingsIcon, RefreshIcon, CopyIcon, ShareIcon, SunIcon, MoonIcon, EditIcon, WritingIcon, CachedIcon, SwappedIcon, WaitingIcon, FinishedIcon, ImageIcon, CheckIcon } from './components/Icon';
import SettingsModal from './components/SettingsModal';
import CodeBlock from './components/CodeBlock';
import { saveAttachmentToDB, getAttachmentFromDB, pruneOrphanedAttachments, deleteAttachmentFromDB } from './services/db';
import { translations, Language } from './utils/translations';

const ToolCallDisplay = ({ toolCall }: { toolCall: ToolCall }) => {
    let args: Record<string, any> = {};
    let isParseError = false;
    
    try {
        if (toolCall.function.arguments) {
            args = JSON.parse(toolCall.function.arguments);
        }
    } catch (e) {
        isParseError = true;
    }

    return (
        <div className="mb-4 rounded-lg border border-gray-200 dark:border-dark-700 bg-gray-50 dark:bg-dark-900 overflow-hidden font-mono text-xs md:text-sm">
            <div className="bg-gray-100 dark:bg-dark-800 px-3 py-2 border-b border-gray-200 dark:border-dark-700 flex items-center justify-between">
                <span className="font-bold text-gray-700 dark:text-gray-300">Tool Call: <span className="text-indigo-600 dark:text-indigo-400">{toolCall.function.name}</span></span>
                <span className="text-[10px] text-gray-500 bg-white dark:bg-dark-950 px-1.5 py-0.5 rounded border border-gray-200 dark:border-dark-700">function</span>
            </div>
            <div className="p-0">
                {isParseError ? (
                    <div className="p-3 text-gray-500 whitespace-pre-wrap break-all">
                        {toolCall.function.arguments || <span className="italic opacity-50">No arguments</span>}
                    </div>
                ) : (
                    Object.keys(args).length > 0 ? (
                        <table className="w-full text-left border-collapse">
                            <tbody>
                                {Object.entries(args).map(([key, value], i) => (
                                    <tr key={i} className="border-b border-gray-100 dark:border-dark-800 last:border-0">
                                        <td className="px-3 py-2 font-semibold text-gray-600 dark:text-gray-400 bg-gray-50/50 dark:bg-dark-900/50 w-1/4 align-top">{key}</td>
                                        <td className="px-3 py-2 text-gray-800 dark:text-gray-200 break-all">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="p-3 text-gray-400 italic">No arguments provided</div>
                    )
                )}
            </div>
        </div>
    );
};

const ThinkingProcess = ({ thought, isComplete, isTruncated, lang }: { thought: string, isComplete: boolean, isTruncated: boolean, lang: Language }) => {
  const [isOpen, setIsOpen] = useState(!isComplete || isTruncated);
  const t = translations[lang];
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isComplete && !isTruncated) {
      setIsOpen(false);
    } else if (!isComplete && !isTruncated) {
      setIsOpen(true);
    }
  }, [isComplete, isTruncated]);

  // Auto-scroll to bottom of thought container while generating
  useEffect(() => {
    if (isOpen && !isComplete && scrollRef.current) {
       const el = scrollRef.current;
       el.scrollTop = el.scrollHeight;
    }
  }, [thought, isOpen, isComplete]);

  if (isTruncated && !thought) {
      return (
          <div className="mb-4 p-3 border-l-4 border-amber-400 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-600 rounded-r-md text-sm text-amber-800 dark:text-amber-200 flex items-start gap-3 shadow-sm animate-in fade-in slide-in-from-top-1">
             <span className="text-lg leading-none mt-0.5">⚠️</span>
             <div className="flex flex-col">
                 <span className="font-semibold">{t.thinkingTruncatedTitle}</span>
                 <span className="text-xs opacity-90">{t.thinkingTruncatedDesc}</span>
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
          <span>{t.thoughtProcess}</span>
        ) : isTruncated ? (
          <span className="text-amber-600 dark:text-amber-500 flex items-center gap-1">
            {t.thoughtProcessInterrupted}
          </span>
        ) : (
          <span className="animate-pulse flex items-center gap-1">
            {t.thinking}<span className="animate-bounce">.</span><span className="animate-bounce delay-75">.</span><span className="animate-bounce delay-150">.</span>
          </span>
        )}
      </button>
      
      {isOpen && (
        <div 
          ref={scrollRef}
          className="mt-2 text-sm text-gray-500 dark:text-gray-400 font-mono bg-gray-50 dark:bg-dark-900 p-3 rounded-md whitespace-pre-wrap leading-relaxed animate-in fade-in slide-in-from-top-1 duration-200 max-h-80 overflow-y-auto custom-scrollbar"
        >
          {thought}
          {isTruncated && (
             <div className="mt-3 pt-2 border-t border-amber-200 dark:border-amber-900/30 text-amber-600 dark:text-amber-500 text-xs italic flex items-center gap-1">
                {t.thinkingTruncatedWarning}
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
  onConfirm,
  lang
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  initialText: string; 
  onConfirm: (newText: string) => void;
  lang: Language; 
}) => {
  const [text, setText] = useState(initialText);
  const t = translations[lang];

  useEffect(() => {
    if (isOpen) setText(initialText);
  }, [isOpen, initialText]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-dark-900 rounded-xl shadow-2xl w-full max-w-2xl border border-gray-200 dark:border-dark-800 flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-dark-800 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t.editMessageTitle}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">✕</button>
        </div>
        <div className="p-4 flex-1">
          <textarea
            className="w-full h-64 bg-gray-50 dark:bg-dark-950 border border-gray-200 dark:border-dark-800 rounded-lg p-4 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none custom-scrollbar"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <p className="text-xs text-gray-500 mt-2">
            {t.editMessageWarning}
          </p>
        </div>
        <div className="p-4 border-t border-gray-200 dark:border-dark-800 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-800 rounded-lg transition-colors"
          >
            {t.cancel}
          </button>
          <button 
            onClick={() => onConfirm(text)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium"
          >
            {t.sendAndRestart}
          </button>
        </div>
      </div>
    </div>
  );
};

// Helper to generate a stable ID for attachments based on their location in the chat tree
const generateAttachmentKey = (sessionId: string, messageId: string, index: number) => {
    return `${sessionId}_${messageId}_${index}`;
};

const App: React.FC = () => {
  // --- STATE ---
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isHydrated, setIsHydrated] = useState(false); // Controls when it's safe to write to disk
  
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
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  // --- TRANSLATION SETUP ---
  const lang: Language = (settings.language === 'zh' || settings.language === 'en') ? settings.language : 'en';
  const t = translations[lang];

  // --- REFS ---
  const usageFailuresRef = useRef(0);
  const sessionsRef = useRef(sessions);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true); 
  const botTurnRef = useRef<HTMLDivElement>(null); 
  const scrollToNewTurnRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // --- MEMOIZED MARKDOWN COMPONENTS ---
  // Memoizing this object prevents CodeBlock from re-mounting on every stream chunk update
  // which fixes the "cannot copy code during generation" issue.
  const markdownComponents = useMemo(() => ({
    code(props: any) {
      const {children, className, node, ...rest} = props
      const match = /language-(\w+)/.exec(className || '')
      return match ? (
        <CodeBlock language={match[1]} value={String(children).replace(/\n$/, '')} />
      ) : (
        <code {...rest} className={className}>
          {children}
        </code>
      )
    }
  }), []);

  // --- PARSER FOR INTERLEAVED THOUGHTS ---
  const parseMixedContent = (text: string) => {
    const segments: { type: 'text' | 'thought', content: string, isComplete?: boolean }[] = [];
    if (!text) return segments;

    let currentIndex = 0;
    
    // Tag pairs. Order doesn't strictly matter for "earliest" match logic.
    // FIX: Escape special characters in strings passed to RegExp constructor to avoid false matches (e.g. <|think|> vs <tool_call>)
    const tagPairs = [
        { start: '<think>', end: '</think>' },
        { start: '<\\|think\\|>', end: '<\\|/think\\|>' }, // Correctly escaped pipe for regex
        { start: '<thought>', end: '</thought>' },
        { start: '\\[THINK\\]', end: '\\[/THINK\\]' } // Regex escaped for literal [THINK]
    ];

    while (currentIndex < text.length) {
        let nearestTagIndex = Infinity;
        let matchedPair = null;
        let matchedStartStr = '';

        // Find earliest matching start tag
        for (const pair of tagPairs) {
            const regex = new RegExp(pair.start, 'gi');
            regex.lastIndex = currentIndex;
            const match = regex.exec(text);
            
            if (match && match.index < nearestTagIndex) {
                nearestTagIndex = match.index;
                matchedPair = pair;
                matchedStartStr = match[0];
            }
        }

        // If no tag found, remaining is text
        if (!matchedPair) {
            const content = text.slice(currentIndex);
            if (content) segments.push({ type: 'text', content });
            break;
        }

        // Text before tag
        if (nearestTagIndex > currentIndex) {
            segments.push({ type: 'text', content: text.slice(currentIndex, nearestTagIndex) });
        }

        // Find matching end tag
        const contentStartIndex = nearestTagIndex + matchedStartStr.length;
        const endRegex = new RegExp(matchedPair.end, 'gi');
        endRegex.lastIndex = contentStartIndex;
        const endMatch = endRegex.exec(text);

        if (endMatch) {
            segments.push({ 
                type: 'thought', 
                content: text.slice(contentStartIndex, endMatch.index),
                isComplete: true 
            });
            currentIndex = endMatch.index + endMatch[0].length;
        } else {
            // No end tag -> incomplete thought till end
            segments.push({ 
                type: 'thought', 
                content: text.slice(contentStartIndex), 
                isComplete: false 
            });
            break;
        }
    }
    
    return segments;
  };

  // --- INITIALIZATION & HYDRATION ---

  // 1. Initial Load from LocalStorage + IndexedDB Hydration
  useEffect(() => {
    const loadData = async () => {
      try {
        const storedSessions = localStorage.getItem('chat_client_sessions');
        let initialSessions: ChatSession[] = storedSessions ? JSON.parse(storedSessions) : [];
        
        // Hydrate attachments from IndexedDB
        // This runs once on mount.
        const activeAttachmentKeys: string[] = [];
        
        const hydratedSessions = await Promise.all(initialSessions.map(async (session) => {
           const hydratedMessages = await Promise.all(session.messages.map(async (msg) => {
               if (msg.attachments && msg.attachments.length > 0) {
                   const hydratedAttachments = await Promise.all(msg.attachments.map(async (att, idx) => {
                       // Only try to load from DB if content is missing (which it should be for large files)
                       // and it's an image or large file.
                       const key = generateAttachmentKey(session.id, msg.id, idx);
                       activeAttachmentKeys.push(key);
                       
                       if (!att.content || att.content === "") {
                           const dbContent = await getAttachmentFromDB(key);
                           if (dbContent) {
                               return { ...att, content: dbContent };
                           }
                       }
                       return att;
                   }));
                   return { ...msg, attachments: hydratedAttachments };
               }
               return msg;
           }));
           return { ...session, messages: hydratedMessages };
        }));

        setSessions(hydratedSessions);
        if (hydratedSessions.length > 0 && !currentSessionId) {
            setCurrentSessionId(hydratedSessions[0].id);
        } else if (hydratedSessions.length === 0) {
            // Will trigger creation in next effect if still empty
        }
        
        setIsHydrated(true);

        // Async cleanup of old attachments
        setTimeout(() => pruneOrphanedAttachments(activeAttachmentKeys), 5000);

      } catch (e) {
        console.error("Failed to load sessions:", e);
        setSessions([]);
        setIsHydrated(true);
      }
    };
    loadData();
  }, []); // Run once

  // 2. Default Session Creation
  useEffect(() => {
    if (isHydrated && sessions.length === 0) {
        createNewSession();
    }
  }, [isHydrated, sessions.length]);

  // 3. PERSISTENCE (Hybrid Strategy)
  useEffect(() => {
    // Only save if we have successfully loaded first. 
    // Otherwise we might overwrite existing data with empty state.
    if (!isHydrated) return; 
    
    sessionsRef.current = sessions;
    
    const saveToStorage = async () => {
        try {
            // 1. Identify heavy attachments and save to IndexedDB
            const leanSessions = sessions.map(session => ({
                ...session,
                messages: session.messages.map(msg => ({
                    ...msg,
                    attachments: msg.attachments?.map((att, idx) => {
                        // If it has content, save to DB and strip from LS
                        if (att.content && att.content.length > 100) { 
                            const key = generateAttachmentKey(session.id, msg.id, idx);
                            // Fire and forget save (or await if critical, but we want UI responsive)
                            saveAttachmentToDB(key, att.content);
                            
                            // Return lean object for LocalStorage
                            return { ...att, content: '' }; 
                        }
                        // Small text files can stay in LS
                        return att;
                    })
                }))
            }));

            // 2. Save lean structure to LocalStorage
            localStorage.setItem('chat_client_sessions', JSON.stringify(leanSessions));
            
        } catch (e) {
            console.error("Failed to save sessions:", e);
        }
    };
    
    // Debounce slightly to avoid thrashing IDB on typing, 
    // though most updates here are message additions which are infrequent enough.
    const timer = setTimeout(saveToStorage, 500);
    return () => clearTimeout(timer);

  }, [sessions, isHydrated]);

  // --- OTHER EFFECTS ---

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
                // We use default language messages here as settings might not be loaded fully, but t is available
                setConfigError(t.serverConfigError.replace('{url}', DEFAULT_SETTINGS.serverUrl));
                setTimeout(() => setConfigError(null), 60000);
            }
        }
    };
    const hostConfig = window.CHAT_APP_CONFIG || window.RUST_APP_CONFIG;
    if (hostConfig) {
       setSettings(prev => ({ ...prev, model: hostConfig.defaultModel || prev.model, theme: hostConfig.initialTheme || prev.theme, serverUrl: hostConfig.serverUrl || prev.serverUrl, apiKey: hostConfig.apiKey || prev.apiKey }));
    } else loadConfig();
  }, [t.serverConfigError]);

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
    const newSession: ChatSession = { id: uuidv4(), title: t.newChat, messages: [], lastUpdated: Date.now() };
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

  const copyToClipboard = async (text: string, messageId: string) => {
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
            setCopiedMessageId(messageId);
            setTimeout(() => setCopiedMessageId(null), 2000);
        } else {
             throw new Error("Clipboard API unavailable");
        }
    } catch (err) {
        try {
            const textArea = document.createElement("textarea");
            textArea.value = text;
            textArea.style.position = "fixed";
            textArea.style.left = "-9999px";
            textArea.style.top = "0";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            if (successful) {
                setCopiedMessageId(messageId);
                setTimeout(() => setCopiedMessageId(null), 2000);
            } else {
                console.error("Fallback copy failed.");
                alert(t.copyFallbackFailed);
            }
        } catch (fallbackErr) {
            console.error("Failed to copy text: ", fallbackErr);
            alert(t.copyFallbackFailed);
        }
    }
  };

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

  const executeStream = async (sessionId: string, historyMessages: Message[], userText: string, userAttachments: FileAttachment[]) => {
    setIsStreaming(true);
    setStreamingSessionId(sessionId);
    setSessionStatuses(prev => ({ ...prev, [sessionId]: 'Running' }));

    shouldAutoScrollRef.current = false; 
    abortControllerRef.current = new AbortController();

    const newUserMsg: Message = { id: uuidv4(), role: Role.User, text: userText, attachments: userAttachments, timestamp: Date.now() };
    const newBotMsg: Message = { id: uuidv4(), role: Role.Model, text: '', timestamp: Date.now() + 1 };

    const updatedMessages = [...historyMessages, newUserMsg, newBotMsg];
    updateSessionMessages(sessionId, updatedMessages);
    
    scrollToNewTurnRef.current = true;

    let bufferedText = "";
    let bufferedToolCalls: ToolCall[] = [];
    let animationFrameId: number;
    const flushBuffer = () => {
       setSessions(prev => prev.map(s => {
          if (s.id === sessionId) {
            const msgs = [...s.messages];
            const lastMsg = msgs[msgs.length - 1];
            if (lastMsg?.role === Role.Model) {
                 if (lastMsg.text !== bufferedText) lastMsg.text = bufferedText;
                 if (bufferedToolCalls.length > 0) lastMsg.toolCalls = bufferedToolCalls;
            }
            return { ...s, messages: msgs };
          }
          return s;
       }));
       animationFrameId = requestAnimationFrame(flushBuffer);
    };
    animationFrameId = requestAnimationFrame(flushBuffer);

    try {
      await streamChatResponse(sessionId, historyMessages.filter(m => m.role !== Role.Model || m.text.length > 0), userText, userAttachments, settings, abortControllerRef.current.signal, (chunkText, chunkToolCalls) => {
          if (abortControllerRef.current?.signal.aborted) return;
          bufferedText = chunkText;
          if (chunkToolCalls && chunkToolCalls.length > 0) {
              bufferedToolCalls = chunkToolCalls;
          }
      }, isMultimodal, useSampling);
      setSessions(prev => prev.map(s => {
          if (s.id === sessionId) {
            const msgs = [...s.messages];
            const lastMsg = msgs[msgs.length - 1];
            if (lastMsg?.role === Role.Model) {
                lastMsg.text = bufferedText;
                if (bufferedToolCalls.length > 0) lastMsg.toolCalls = bufferedToolCalls;
            }
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
                // Don't append abort message if thought is active, might confuse parser
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
             alert(t.messageBlockedContext.replace('{used}', newMessageTokens.toString()).replace('{available}', availableTokens.toString()));
             return;
        }
    } else {
        let totalSessionTokens = 0;
        currentHistory.forEach(m => { totalSessionTokens += estimateTokenCount(m.text); m.attachments?.forEach(a => totalSessionTokens += (a.tokenCount || 0)); });
        totalSessionTokens += newMessageTokens;
        const fallbackLimit = settings.maxOutputTokens * 1.5;
        if (totalSessionTokens > fallbackLimit) { 
             alert(t.messageBlockedFallback.replace('{total}', totalSessionTokens.toString()).replace('{limit}', fallbackLimit.toString()));
             return; 
        }
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
    if (!e.target.files || e.target.files.length === 0) return;
    
    const files = Array.from(e.target.files);
    const MAX_TOTAL_SIZE_MB = 100;
    const MAX_TOTAL_BYTES = MAX_TOTAL_SIZE_MB * 1024 * 1024;
    
    const currentSize = attachments.reduce((acc, curr) => acc + (curr.content.length * 0.75), 0);
    const newFilesSize = files.reduce((acc, f) => acc + f.size, 0);
    
    if (currentSize + newFilesSize > MAX_TOTAL_BYTES) {
        alert(t.uploadBlockedSize);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
    }

    const readFile = (file: File): Promise<FileAttachment> => {
        return new Promise((resolve, reject) => {
            const isImage = file.type.startsWith('image/');
            if (isImage && !isMultimodal) {
                reject(new Error(t.imageUploadIgnored));
                return;
            }
            
            const allowedExtensions = /\.(txt|md|markdown|json|csv|log|xml|yaml|yml|toml|ini|cfg|conf|env|js|jsx|ts|tsx|html|css|scss|less|py|java|c|cpp|h|hpp|cc|cs|go|rs|rb|php|swift|kt|sql|sh|bash|bat|ps1|dockerfile|cu|cuh)$/i;

            const isText = file.type.startsWith('text/') || allowedExtensions.test(file.name);
            
            if (!isText && !isImage) {
                reject(new Error(t.fileIgnored));
                return;
            }

            const reader = new FileReader();
            reader.onload = (ev) => {
                const content = ev.target?.result as string;
                resolve({
                    name: file.name,
                    type: file.type,
                    content: content,
                    tokenCount: isImage ? 256 : estimateTokenCount(content)
                });
            };
            reader.onerror = () => reject(new Error(`Failed to read file ${file.name}`));
            
            if (isImage) {
                reader.readAsDataURL(file);
            } else {
                reader.readAsText(file); 
            }
        });
    };

    try {
        const results = await Promise.allSettled(files.map(readFile));
        const successfulAttachments: FileAttachment[] = [];
        let errors: string[] = [];

        results.forEach(result => {
            if (result.status === 'fulfilled') {
                successfulAttachments.push(result.value);
            } else {
                if (result.reason instanceof Error) {
                     if (!result.reason.message.includes("ignored")) {
                         errors.push(result.reason.message);
                     } else {
                         console.warn(result.reason.message);
                     }
                }
            }
        });
        
        if (errors.length > 0) {
            alert(`${t.uploadError}:\n${errors.slice(0, 3).join('\n')}`);
        }

        if (successfulAttachments.length > 0) {
            setAttachments(prev => {
                const combined = [...prev, ...successfulAttachments];
                return combined.filter((v, i, a) => a.findIndex(t => t.name === v.name) === i);
            });
        }
    } catch (error) {
        console.error("Critical error processing files:", error);
    } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const deleteSession = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (id === streamingSessionId) return; 
    const sessionToDelete = sessions.find(s => s.id === id);
    if (sessionToDelete && (sessionToDelete.messages.length === 0 || window.confirm("Are you sure you want to delete this chat history?"))) {
      
      // Cleanup IDB attachments for this session
      for (const msg of sessionToDelete.messages) {
          if (msg.attachments) {
              msg.attachments.forEach((_, idx) => {
                  deleteAttachmentFromDB(generateAttachmentKey(sessionToDelete.id, msg.id, idx));
              });
          }
      }

      const newSessions = sessions.filter(s => s.id !== id);
      setSessions(newSessions);
      if (currentSessionId === id) { setCurrentSessionId(newSessions.length > 0 ? newSessions[0].id : null); setContextStats(null); }
    }
  };

  const toggleTheme = () => setSettings(prev => ({ ...prev, theme: prev.theme === 'dark' ? 'light' : 'dark' }));

  const currentSession = getCurrentSession();

  if (!isHydrated) {
      return <div className="flex h-screen w-full items-center justify-center bg-white dark:bg-dark-950 text-gray-500">Loading chats...</div>;
  }

  return (
    <div className="flex h-screen w-full bg-white dark:bg-dark-950 text-gray-900 dark:text-gray-100 transition-colors duration-300">
      
      {/* Sidebar */}
      <div className="w-64 bg-gray-50 dark:bg-dark-900 border-r border-gray-200 dark:border-dark-800 flex flex-col hidden md:flex transition-all duration-300">
        <div className="p-4 flex items-center gap-3 mb-2">
           <div className="w-10 h-10 bg-black dark:bg-white rounded-xl flex items-center justify-center shadow-md text-white dark:text-black font-bold text-xl">
               <span>C</span>
           </div>
           <div>
               <h1 className="font-bold text-xl tracking-tight text-gray-900 dark:text-white leading-none">ChatClient</h1>
           </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
          <button onClick={() => createNewSession()} disabled={isStreaming} className={`w-full flex items-center justify-center gap-2 px-4 py-3 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 text-gray-900 dark:text-gray-100 rounded-xl transition-all text-sm font-medium shadow-sm mb-4 group ${isStreaming ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-dark-700'}`}>
            <span className="text-xl leading-none font-light text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">+</span> 
            <span>{t.newChat}</span>
          </button>
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider px-3 mb-2 mt-6">{t.history}</div>
          {sessions.map(session => (
            <div key={session.id} onClick={() => { setCurrentSessionId(session.id); setContextStats(null); }} className={`group relative flex items-center px-3 py-2.5 text-sm rounded-lg transition-all cursor-pointer ${currentSessionId === session.id ? 'bg-gray-200 dark:bg-dark-800 text-gray-900 dark:text-white font-medium shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-800'}`}>
              <span className="truncate flex-1 pr-6">{session.title}</span>
              <div className="absolute right-2 flex items-center gap-1">
                 {streamingSessionId === session.id ? <div className="text-indigo-500"><WritingIcon /></div> : (
                    <>
                        {sessionStatuses[session.id] === 'Waiting' && <div title={t.status_waiting}><WaitingIcon /></div>}
                        {sessionStatuses[session.id] === 'Cached' && <div title={t.status_cached}><CachedIcon /></div>}
                        {sessionStatuses[session.id] === 'Swapped' && <div title={t.status_swapped}><SwappedIcon /></div>}
                        {sessionStatuses[session.id] === 'Finished' && <div title={t.status_finished}><FinishedIcon /></div>}
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
            <span>{settings.theme === 'dark' ? t.lightMode : t.darkMode}</span>
          </button>
          <button onClick={() => setIsSettingsOpen(true)} className="flex items-center gap-3 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors text-sm w-full px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-800">
            <SettingsIcon />
            <span>{t.settings}</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col h-full relative bg-white dark:bg-dark-950 transition-colors duration-300">
        {configError && <div className="bg-red-500 text-white text-xs p-2 text-center animate-pulse">{configError}</div>}
        
        <div className="md:hidden p-4 border-b border-gray-200 dark:border-dark-800 flex justify-between items-center bg-white dark:bg-dark-900 z-10">
           <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-black dark:bg-white rounded-lg flex items-center justify-center text-white dark:text-black font-bold">C</div>
                <span className="font-bold text-gray-900 dark:text-white">ChatClient</span>
           </div>
           <div className="flex gap-4">
              <button onClick={toggleTheme} className="text-gray-600 dark:text-gray-400">{settings.theme === 'dark' ? <SunIcon /> : <MoonIcon />}</button>
              <button onClick={() => setIsSettingsOpen(true)} className="text-gray-600 dark:text-gray-400"><SettingsIcon /></button>
           </div>
        </div>

        {/* Chat Area */}
        <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 scroll-smooth">
          {!currentSession || currentSession.messages.length === 0 ? (
             <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-600">
                <div className="w-24 h-24 mb-6 rounded-3xl bg-gray-100 dark:bg-dark-900 flex items-center justify-center shadow-sm"><div className="text-gray-900 dark:text-white"><BotIcon className="w-12 h-12" /></div></div>
                <h3 className="text-2xl font-semibold text-gray-900 dark:text-gray-200 mb-2">{t.welcomeTitle}</h3>
                <p className="text-center max-w-md text-gray-500 dark:text-gray-500">{t.welcomeSubtitle}{isMultimodal && <span className="block mt-2 text-indigo-500 text-sm">{t.imageUploadEnabled}</span>}</p>
             </div>
          ) : (
            currentSession.messages.map((msg, index) => {
              const segments = msg.role === Role.Model ? parseMixedContent(msg.text) : [];
              const isWaitingForFirstToken = isStreaming && streamingSessionId === currentSession.id && msg.role === Role.Model && msg.text === '' && index === currentSession.messages.length - 1;
              const isAssistantActiveTurn = msg.role === Role.Model && index === currentSession.messages.length - 1;

              return (
              <div 
                key={msg.id} 
                ref={isAssistantActiveTurn ? botTurnRef : null}
                className={`scroll-mt-4 flex gap-4 max-w-4xl mx-auto ${msg.role === Role.User ? 'flex-row-reverse' : ''}`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm transition-all duration-300 ${
                    msg.role === Role.User 
                    ? 'bg-gray-100 dark:bg-dark-800 text-gray-500 dark:text-gray-400' 
                    : `bg-black dark:bg-white text-white dark:text-black ${isWaitingForFirstToken || (isStreaming && index === currentSession.messages.length - 1) ? 'ring-2 ring-gray-200 dark:ring-gray-700 animate-pulse' : ''}`
                }`}>
                  {msg.role === Role.User ? <UserIcon className="w-6 h-6" /> : <BotIcon className="w-6 h-6" />}
                </div>
                <div className={`flex flex-col max-w-[85%] lg:max-w-[75%] ${msg.role === Role.User ? 'items-end' : 'items-start'}`}>
                   <div className="flex items-center gap-2 mb-1 px-1"><span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{msg.role === Role.User ? 'You' : 'ChatClient'}</span></div>
                   <div className={`px-5 py-3.5 rounded-2xl shadow-sm text-sm md:text-base leading-7 ${msg.role === Role.User ? 'bg-gray-100 dark:bg-dark-800 text-gray-900 dark:text-gray-100 rounded-tr-none' : `text-gray-900 dark:text-gray-100 ${msg.isError ? 'text-red-600 dark:text-red-400' : ''}`}`}>
                     {msg.attachments?.length ? (
                       <div className="mb-3 pb-2 border-b border-gray-200 dark:border-gray-700 text-xs flex flex-wrap gap-2">
                         {msg.attachments.map((file, i) => (
                            <span key={i} className="flex items-center gap-1 bg-white dark:bg-dark-900 px-2 py-1 rounded border border-gray-200 dark:border-dark-700">
                              {file.type.startsWith('image/') ? (
                                  file.content ? 
                                  <><img src={file.content} className="w-8 h-8 object-cover rounded border border-gray-300 dark:border-gray-700 mr-1" /><span>🖼️ {file.name}</span></> :
                                  <span className="text-gray-400 italic">🖼️ {file.name} (loading...)</span>
                              ) : <>📄 {file.name} <span className="text-gray-400 dark:text-gray-500 text-[10px]">({file.tokenCount}t)</span></>}
                            </span>
                         ))}
                       </div>
                     ) : null}
                     {msg.role === Role.User && msg.attachments?.some(a => a.type.startsWith('image/')) ? (
                        <div className="mb-4 flex flex-wrap gap-2">{msg.attachments.filter(a => a.type.startsWith('image/')).map((img, idx) => (
                            img.content ? <img key={idx} src={img.content} className="max-w-full h-auto max-h-[300px] rounded-lg border border-gray-200 dark:border-gray-700" /> : <div key={idx} className="p-4 border border-dashed border-gray-300 dark:border-gray-700 rounded text-gray-400 text-xs animate-pulse">Loading image...</div>
                        ))}</div>
                     ) : null}
                     {msg.role === Role.Model ? (
                        <div className="markdown-body">
                           {isWaitingForFirstToken && <div className="flex items-center gap-1 h-6"><div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div><div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-75"></div><div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-150"></div></div>}
                           
                           {/* Render Tool Calls if present */}
                           {msg.toolCalls && msg.toolCalls.map((tc, idx) => (
                               <ToolCallDisplay key={tc.id || idx} toolCall={tc} />
                           ))}

                           {segments.map((segment, idx) => {
                             if (segment.type === 'thought') {
                               return (
                                 <ThinkingProcess 
                                   key={idx}
                                   thought={segment.content}
                                   isComplete={!!segment.isComplete}
                                   isTruncated={!segment.isComplete && !isStreaming}
                                   lang={lang}
                                 />
                               );
                             } else {
                               return (
                                 <ReactMarkdown 
                                    key={idx}
                                    remarkPlugins={[remarkGfm]}
                                    components={markdownComponents}
                                 >
                                    {segment.content}
                                 </ReactMarkdown>
                               );
                             }
                           })}
                        </div>
                     ) : <div className="whitespace-pre-wrap">{msg.text}</div>}
                   </div>
                   {msg.role === Role.Model && !isStreaming && !msg.isError && (
                      <div className="flex items-center gap-3 mt-2 px-1 justify-start">
                            <button onClick={() => handleResend(index)} className="text-xs font-medium text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 flex items-center gap-1.5 transition-colors px-1"><RefreshIcon /> {t.redo}</button>
                            <button onClick={() => copyToClipboard(msg.text, msg.id)} className={`text-xs font-medium flex items-center gap-1.5 transition-colors px-1 ${copiedMessageId === msg.id ? 'text-green-600 dark:text-green-400' : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'}`}>
                                {copiedMessageId === msg.id ? <CheckIcon /> : <CopyIcon />} 
                                {copiedMessageId === msg.id ? t.copied : t.copy}
                            </button>
                            <button onClick={handleShare} className="text-xs font-medium text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 flex items-center gap-1.5 transition-colors px-1"><ShareIcon /> {t.share}</button>
                       </div>
                   )}
                   {msg.role === Role.User && !isStreaming && <div className="flex items-center gap-3 mt-2 px-1 justify-end"><button onClick={() => openEditModal(index)} className="text-xs font-medium text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 flex items-center gap-1 transition-colors bg-gray-50 dark:bg-dark-900 px-2 py-1 rounded"><EditIcon /> {t.edit}</button></div>}
                </div>
              </div>
            )})
          )}
          <div ref={messagesEndRef} className="h-4" />
          {/* Restored Large Spacer to ensure slide-up focus works correctly */}
          <div className="h-[80vh] shrink-0" aria-hidden="true" />
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
                 <button onClick={() => fileInputRef.current?.click()} className="p-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors rounded-full hover:bg-gray-200 dark:hover:bg-dark-800 flex-shrink-0">{isMultimodal ? <ImageIcon /> : <PaperClipIcon />}</button>
                 <input type="file" multiple ref={fileInputRef} className="hidden" accept=".txt,.md,.markdown,.json,.csv,.log,.xml,.yaml,.yml,.toml,.ini,.cfg,.conf,.env,.js,.jsx,.ts,.tsx,.html,.css,.scss,.less,.py,.java,.c,.cpp,.h,.hpp,.cc,.cs,.go,.rs,.rb,.php,.swift,.kt,.sql,.sh,.bash,.bat,.ps1,.dockerfile,.cu,.cuh,image/*" onChange={handleFileUpload} />
                 <textarea ref={textareaRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }} placeholder={t.messagePlaceholder} className="flex-1 bg-transparent border-none focus:ring-0 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 resize-none py-3 px-4 max-h-[200px] min-h-[24px] leading-6 custom-scrollbar" rows={1} />
                 {isStreaming && currentSessionId === streamingSessionId ? <button onClick={handleStopGeneration} title={t.stopGeneration} className="p-2 mb-1 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors animate-pulse flex-shrink-0"><StopIcon /></button> : <button onClick={() => handleSendMessage()} disabled={!input.trim() && attachments.length === 0} className={`p-2 mb-1 rounded-full transition-colors shadow-md flex-shrink-0 ${isStreaming ? 'bg-gray-400 cursor-not-allowed opacity-50' : 'bg-gray-900 dark:bg-white text-white dark:text-black hover:bg-gray-700 dark:hover:bg-gray-200'}`}><SendIcon /></button>}
              </div>
              <div className="flex flex-col items-center mt-3 gap-1">
                 {settings.contextCache && (contextStats || kvStats || swapStats) && (
                    <div className="flex items-center gap-3 px-3 py-1 rounded-full bg-gray-100 dark:bg-dark-900 border border-gray-200 dark:border-dark-800 text-[10px] font-mono text-gray-500 dark:text-gray-400 animate-in fade-in slide-in-from-bottom-2">
                        {contextStats?.status && <div className="flex items-center pr-1">{contextStats.status === 'Running' ? <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" title={t.status_running} /> : contextStats.status === 'Waiting' ? <div title={t.status_waiting}><WaitingIcon /></div> : contextStats.status === 'Cached' ? <div title={t.status_cached}><CachedIcon /></div> : contextStats.status === 'Swapped' ? <div title={t.status_swapped}><SwappedIcon /></div> : <div title={t.status_finished}><FinishedIcon /></div>}</div>}
                        {contextStats && <div className="flex items-center gap-1.5"><span className={`w-1.5 h-1.5 rounded-full ${contextStats.used > contextStats.total * 0.9 ? 'bg-red-500' : 'bg-green-500'}`}></span><span>CTX: {contextStats.used.toLocaleString()} / {contextStats.total.toLocaleString()}</span></div>}
                        {contextStats && (kvStats || swapStats) && <div className="w-px h-3 bg-gray-300 dark:bg-dark-700"></div>}
                        {kvStats && <div className="flex items-center gap-1.5"><span className={`w-1.5 h-1.5 rounded-full ${kvStats.used > kvStats.total * 0.9 ? 'bg-red-500' : 'bg-green-500'}`}></span><span>KV: {kvStats.used.toLocaleString()} / {kvStats.total.toLocaleString()}</span></div>}
                        {swapStats && swapStats.total >= 0.2 && <><div className="w-px h-3 bg-gray-300 dark:bg-dark-700"></div><div className="flex items-center gap-1.5"><span className={`w-1.5 h-1.5 rounded-full ${swapStats.used > swapStats.total * 0.9 ? 'bg-red-500' : 'bg-green-500'}`}></span><span>Swap: {swapStats.used.toFixed(1)} / {swapStats.total.toFixed(1)} GB</span></div></>}
                    </div>
                 )}
                 <p className="text-[10px] text-gray-400 dark:text-gray-600">{t.disclaimer}</p>
              </div>
           </div>
        </div>
      </div>
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} settings={settings} onSettingsChange={setSettings} useSampling={useSampling} onSamplingToggle={setUseSampling} />
      <EditMessageModal isOpen={!!editingMessage} onClose={() => setEditingMessage(null)} initialText={editingMessage?.text || ''} onConfirm={handleConfirmEdit} lang={lang} />
    </div>
  );
};

export default App;
