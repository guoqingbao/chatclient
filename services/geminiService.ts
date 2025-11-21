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
  const cleanBase = baseUrl.replace(/\/+$/, '');
  // If the user just put in the base domain, append v1/chat/completions
  // However, usually users provide the API base (e.g. http://localhost:11434/v1)
  // We will append /chat/completions
  return `${cleanBase}/chat/completions`;
};

export const streamChatResponse = async (
  history: Message[],
  newMessage: string,
  attachments: FileAttachment[],
  settings: AppSettings,
  onChunk: (text: string) => void
): Promise<string> => {

  const messages = prepareMessages(history, newMessage, attachments, settings);
  const url = getEndpoint(settings.serverUrl);

  try {
    const body: any = {
      model: settings.model,
      messages: messages,
      stream: true,
      temperature: settings.temperature,
      top_p: settings.topP,
      max_tokens: settings.maxOutputTokens,
    };

    // Add top_k if supported/configured (non-standard OpenAI, but common in local LLMs)
    if (settings.topK > 0) {
      body.top_k = settings.topK;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`API Request Failed (${response.status}): ${errText}`);
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
      
      // Keep the last part in buffer if it doesn't end with newline
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
          // Ignore JSON parse errors for individual chunks
        }
      }
    }

    return fullText;

  } catch (error) {
    console.error("Chat Stream Error:", error);
    throw error;
  }
};

export const generateTitle = async (firstMessage: string, settings: AppSettings): Promise<string> => {
  if (!settings.apiKey && !settings.serverUrl) return "New Chat";
  
  try {
    const url = getEndpoint(settings.serverUrl);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify({
        model: settings.model,
        messages: [
          { role: 'system', content: 'You are a helper. Generate a very short title (max 5 words) for the following user message. Do not use quotes.' },
          { role: 'user', content: firstMessage }
        ],
        stream: false,
        max_tokens: 15
      })
    });

    if (!response.ok) return "New Chat";
    
    const data = await response.json();
    const title = data.choices?.[0]?.message?.content?.trim();
    
    return title || "New Chat";
  } catch (e) {
    console.error("Failed to generate title", e);
    return "New Chat";
  }
};