import { Message, Role, AppSettings, FileAttachment } from "../types";

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
  if (!cleanBase.startsWith('http')) {
    cleanBase = 'http://' + cleanBase;
  }
  
  cleanBase = cleanBase.replace(/\/+$/, ''); // Remove trailing slash
  
  if (cleanBase.endsWith('/chat/completions')) return cleanBase;
  if (cleanBase.endsWith('/v1')) return `${cleanBase}/chat/completions`;
  
  return `${cleanBase}/chat/completions`;
};

export const streamChatResponse = async (
  sessionId: string,
  history: Message[],
  newMessage: string,
  attachments: FileAttachment[],
  settings: AppSettings,
  onChunk: (text: string) => void
): Promise<string> => {

  const messages = prepareMessages(history, newMessage, attachments, settings);
  const url = getEndpoint(settings.serverUrl);

  // Basic headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (settings.apiKey && settings.apiKey.trim().length > 0) {
    headers['Authorization'] = `Bearer ${settings.apiKey.trim()}`;
  }

  try {
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
    
    // Inject session_id into root if Context Cache is enabled
    if (settings.contextCache) {
        body.session_id = sessionId;
    }

    console.log(`[Client] POST ${url}`, body);

    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body),
      credentials: 'omit', 
    });

    if (!response.ok) {
        const errText = await response.text();
        let errMsg = `API Request Failed (${response.status})`;
        try {
            const json = JSON.parse(errText);
            if (json.error && json.error.message) errMsg += `: ${json.error.message}`;
            else errMsg += `: ${errText}`;
        } catch {
            errMsg += `: ${errText}`;
        }
        throw new Error(errMsg);
    }

    if (!response.body) throw new Error("No response body received from server.");

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let fullText = "";
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        
        const dataStr = trimmed.replace('data: ', '');
        if (dataStr === '[DONE]') return fullText;

        try {
          const json = JSON.parse(dataStr);
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) {
            fullText += delta;
            onChunk(fullText);
          }
        } catch (e) {
          // Ignore JSON parse errors
        }
      }
    }

    return fullText;

  } catch (error: any) {
    console.error("Chat Stream Error:", error);
    if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
       throw new Error(`Connection failed to ${url}. Check if server is running and accessible (CORS issues or invalid URL).`);
    }
    throw error;
  }
};

export const generateTitle = async (firstMessage: string, settings: AppSettings): Promise<string> => {
  if (!settings.serverUrl) return "New Chat";
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (settings.apiKey && settings.apiKey.trim().length > 0) {
    headers['Authorization'] = `Bearer ${settings.apiKey.trim()}`;
  }

  // Truncate input to max 2000 chars approx to save tokens
  const truncatedMessage = firstMessage.slice(0, 2000);

  try {
    const url = getEndpoint(settings.serverUrl);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        model: settings.model,
        messages: [
          { role: 'system', content: 'Generate a title (max 5 words) for this content. Do not use quotes.' },
          { role: 'user', content: truncatedMessage }
        ],
        stream: false,
        max_tokens: 15,
        // Important: Do NOT send session_id here. Title generation should be standalone.
      }),
      credentials: 'omit'
    });

    if (!response.ok) return "New Chat";
    
    const data = await response.json();
    const title = data.choices?.[0]?.message?.content?.trim();
    
    return title || "New Chat";
  } catch (e) {
    return "New Chat";
  }
};