import { Message, Role, AppSettings, FileAttachment, TokenUsage, ServerConfig } from "../types";

// Helper to prepare messages for OpenAI format
const prepareMessages = (
  history: Message[], 
  newMessage: string, 
  attachments: FileAttachment[], 
  settings: AppSettings
) => {
  const messages = [];

  // 1. System Instruction
  if (settings.systemInstruction) {
    messages.push({ role: 'system', content: settings.systemInstruction });
  }

  // 2. History
  history.forEach(msg => {
    if (msg.isError) return;
    
    let content = msg.text;
    
    // Re-inject file context if it exists in history
    if (msg.attachments && msg.attachments.length > 0) {
       const fileContext = msg.attachments.map(f => 
        `\n--- START FILE: ${f.name} ---\n${f.content}\n--- END FILE ---\n`
      ).join('');
      content = `[Context Files Uploaded]\n${fileContext}\n\n${msg.text}`;
    }

    messages.push({
      role: msg.role === Role.User ? 'user' : 'assistant',
      content: content
    });
  });

  // 3. New Message
  let currentContent = newMessage;
  if (attachments.length > 0) {
    const fileContext = attachments.map(f => 
      `\n--- START FILE: ${f.name} ---\n${f.content}\n--- END FILE ---\n`
    ).join('');
    currentContent = `[Context Files Uploaded]\n${fileContext}\n\n${newMessage}`;
  }

  messages.push({ role: 'user', content: currentContent });

  return messages;
};

const getEndpoint = (baseUrl: string) => {
  if (!baseUrl) return '';
  let cleanBase = baseUrl.trim();

  // Fix: Browsers cannot connect to 0.0.0.0 directly.
  cleanBase = cleanBase.replace('0.0.0.0', 'localhost');
  
  // Ensure protocol
  if (!cleanBase.startsWith('http') && !cleanBase.startsWith('/')) {
    cleanBase = 'http://' + cleanBase;
  }
  
  cleanBase = cleanBase.replace(/\/+$/, ''); // Remove trailing slash
  
  // Standard suffix handling
  if (cleanBase.endsWith('/chat/completions')) return cleanBase;
  if (cleanBase.endsWith('/v1')) return `${cleanBase}/chat/completions`;
  
  return `${cleanBase}/chat/completions`;
};

// Exported for usage check in App.tsx
// Updated heuristic: Treat 1 word as 1 token (split by whitespace)
export const estimateTokenCount = (text: string): number => {
  if (!text) return 0;
  return text.trim().split(/\s+/).length;
};

export const fetchServerConfig = async (): Promise<ServerConfig | null> => {
    try {
        // Fetch from the same origin that served the web app
        // The Rust backend should intercept this route and return the JSON
        const response = await fetch('/app-config.json', {
            method: 'GET',
            cache: 'no-store'
        });

        if (!response.ok) return null;
        
        const data = await response.json();
        return data as ServerConfig;
    } catch (e) {
        return null;
    }
};

export const fetchTokenUsage = async (
  sessionId: string, 
  settings: AppSettings
): Promise<TokenUsage | null> => {
  if (!settings.serverUrl || !sessionId) return null;

  try {
    // Construct usage endpoint: http://localhost:8000/v1/usage
    let baseUrl = settings.serverUrl.trim().replace(/\/+$/, '');
    baseUrl = baseUrl.replace('0.0.0.0', 'localhost');
    if (!baseUrl.startsWith('http') && !baseUrl.startsWith('/')) baseUrl = 'http://' + baseUrl;
    
    // If url ends with /chat/completions, strip it to get base
    baseUrl = baseUrl.replace(/\/chat\/completions$/, '');

    // Assuming endpoint is relative to base, e.g. /v1/usage
    const url = `${baseUrl}/usage?session_id=${sessionId}`;

    const headers: Record<string, string> = {};
    if (settings.apiKey && settings.apiKey.trim().length > 0) {
      headers['Authorization'] = `Bearer ${settings.apiKey.trim()}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: headers,
      credentials: 'omit'
    });

    if (!response.ok) {
        return null;
    }

    const data = await response.json();
    
    // Validate response shape
    if (typeof data.token_used === 'number' && typeof data.max_model_len === 'number') {
      return {
          token_used: data.token_used,
          max_model_len: data.max_model_len,
          used_kvcache_tokens: data.used_kvcache_tokens || 0,
          total_kv_cache_tokens: data.total_kv_cache_tokens,
          swap_used: data.swap_used,
          total_swap_memory: data.total_swap_memory,
          session_status: data.session_status // Capture session status
      } as TokenUsage;
    }
    return null;
  } catch (error) {
    return null;
  }
};

export const streamChatResponse = async (
  sessionId: string,
  history: Message[],
  newMessage: string,
  attachments: FileAttachment[],
  settings: AppSettings,
  signal: AbortSignal,
  onChunk: (text: string) => void
): Promise<string> => {

  const messages = prepareMessages(history, newMessage, attachments, settings);
  const url = getEndpoint(settings.serverUrl);
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (settings.apiKey && settings.apiKey.trim().length > 0) {
    headers['Authorization'] = `Bearer ${settings.apiKey.trim()}`;
  }

  const body: any = {
    model: settings.model,
    messages: messages,
    stream: true,
    temperature: settings.temperature,
    top_p: settings.topP,
    max_tokens: settings.maxOutputTokens,
  };

  if (settings.topK > 0) {
    body.top_k = settings.topK;
  }

  // Inject session_id if context caching is enabled
  if (settings.contextCache) {
      body.session_id = sessionId;
  }

  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal, // Pass abort signal to fetch
      credentials: 'omit' 
    });

    if (!response.ok) {
      // Try to parse error message more robustly
      let errorDetail = "";
      
      try {
        const errorData = await response.json();
        // Handle various error formats
        // 1. OpenAI format: { error: { message: "..." } }
        if (errorData.error && errorData.error.message) {
           errorDetail = errorData.error.message;
        } 
        // 2. Generic message: { message: "..." }
        else if (errorData.message) {
           errorDetail = errorData.message;
        }
        // 3. Python/FastAPI detail: { detail: "..." }
        else if (errorData.detail) {
           errorDetail = typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail);
        }
        // 4. Fallback: stringify whole object
        else {
           errorDetail = JSON.stringify(errorData);
        }
      } catch (e) {
         // Raw text?
         const text = await response.text();
         if (text) errorDetail = text.slice(0, 300); // Capture more context
      }
      
      let errorMsg = `Server Error (${response.status})`;
      if (errorDetail) {
          errorMsg += `: ${errorDetail}`;
      } else if (response.status === 404) {
          errorMsg += ": Endpoint not found. Check Server URL.";
      } else if (response.status === 401) {
          errorMsg += ": Unauthorized. Check API Key.";
      }

      throw new Error(errorMsg);
    }

    if (!response.body) throw new Error("No response body");

    reader = response.body.getReader();
    
    // CRITICAL: Explicitly listen for abort to cancel the reader immediately.
    // This handles cases where the stream is hung waiting for data.
    const abortHandler = () => {
        reader?.cancel().catch(() => {});
    };
    signal.addEventListener('abort', abortHandler);

    const decoder = new TextDecoder("utf-8");
    let done = false;
    let accumulatedText = "";
    let buffer = ""; // Buffer for split chunks

    while (!done) {
      // Double check before reading
      if (signal.aborted) {
         break;
      }

      try {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        
        if (value) {
            // Append new data to buffer
            buffer += decoder.decode(value, { stream: true });
            
            // Split by newline
            const lines = buffer.split('\n');
            
            // Keep the last segment in the buffer (it might be incomplete)
            // If the chunk ended with \n, the last element will be empty string, which is fine
            buffer = lines.pop() || "";
            
            for (const line of lines) {
              const trimmedLine = line.trim();
              if (trimmedLine === '') continue;
              if (trimmedLine === 'data: [DONE]') continue;
              
              if (trimmedLine.startsWith('data: ')) {
                  try {
                    const jsonStr = trimmedLine.replace('data: ', '');
                    const json = JSON.parse(jsonStr);
                    
                    if (json.choices && json.choices.length > 0) {
                        const delta = json.choices[0].delta;
                        if (delta.content) {
                          accumulatedText += delta.content;
                          onChunk(accumulatedText);
                        }
                    }
                  } catch (e) {
                    // JSON parse error usually means packet split (should be handled by buffer now)
                    // But if it happens, we ignore just this line to prevent crashing
                    console.debug("Skipping malformed JSON line", e);
                  }
              }
            }
        }
      } catch (readError: any) {
          // If the error is due to abort (cancel), break loop gracefully
          if (signal.aborted) {
              break;
          }
          throw readError;
      }
    }

    signal.removeEventListener('abort', abortHandler);
    return accumulatedText;
  } catch (error: any) {
    if (error.name === 'AbortError' || signal.aborted) {
        // Ensure reader is closed
        if (reader) await reader.cancel().catch(() => {});
        throw new DOMException('Aborted', 'AbortError'); // Normalize error
    }
    // CORS specific hint
    if (error.message && error.message.includes('Failed to fetch')) {
        throw new Error(`Connection failed. Check if server is running and accessible (CORS issues or invalid URL). ${error.message}`);
    }
    throw error;
  } finally {
      // Final cleanup
      if (reader) {
          try {
             reader.releaseLock();
          } catch(e) {}
      }
  }
};

export const generateTitle = async (
  firstMessageText: string,
  settings: AppSettings
): Promise<string> => {
  // Truncate to avoid massive context overhead for just a title
  const truncatedInput = firstMessageText.slice(0, 2000); 
  const prompt = `Summarize the following message into a short, concise chat title (max 6 words). Do not use quotes. Message: "${truncatedInput}"`;

  const url = getEndpoint(settings.serverUrl);
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (settings.apiKey && settings.apiKey.trim().length > 0) {
    headers['Authorization'] = `Bearer ${settings.apiKey.trim()}`;
  }

  // NOTE: We do NOT send session_id here. 
  // Title generation should be stateless and not pollute the chat context cache.
  const body = {
    model: settings.model,
    messages: [
        { role: 'user', content: prompt }
    ],
    stream: false,
    max_tokens: 20,
    temperature: 0.5
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      credentials: 'omit'
    });

    if (!response.ok) return "New Chat";

    const data = await response.json();
    if (data.choices && data.choices.length > 0 && data.choices[0].message) {
      return data.choices[0].message.content.trim().replace(/^["']|["']$/g, '');
    }
    return "New Chat";
  } catch (e) {
    return "New Chat";
  }
};