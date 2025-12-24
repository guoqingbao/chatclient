
export type Language = 'en' | 'zh';

export const translations = {
  en: {
    // Sidebar
    newChat: "New Chat",
    history: "History",
    lightMode: "Light Mode",
    darkMode: "Dark Mode",
    settings: "Settings",
    
    // Welcome
    welcomeTitle: "Welcome to ChatClient",
    welcomeSubtitle: "Start a conversation by typing a message or uploading a file below.",
    imageUploadEnabled: "✨ Image upload enabled for this model",
    
    // Input
    messagePlaceholder: "Message ChatClient...",
    waitingPlaceholder: "Wait for response...",
    stopGeneration: "Stop generation",
    disclaimer: "AI can make mistakes. Please verify important information.",
    
    // Message Actions
    redo: "Redo",
    copy: "Copy",
    copied: "Copied!",
    share: "Share",
    edit: "Edit",
    
    // Thinking
    thoughtProcess: "Thought Process",
    thoughtProcessInterrupted: "Thought Process (Interrupted)",
    thinking: "Thinking",
    thinkingTruncatedTitle: "Thinking Process Truncated",
    thinkingTruncatedDesc: "The thought process was interrupted. The partial content has been displayed below.",
    thinkingTruncatedWarning: "⚠️ Thinking process was truncated unexpectedly.",
    
    // Edit Modal
    editMessageTitle: "Edit Message",
    editMessageWarning: "Editing this message will clear all subsequent messages in this conversation.",
    cancel: "Cancel",
    sendAndRestart: "Send & Restart",
    
    // Settings
    configuration: "Configuration",
    backendSettings: "Backend Settings",
    serverUrl: "Server URL",
    apiKey: "API Key",
    contextCaching: "Context Caching",
    contextCachingDesc: "Sends unique session_id to server",
    modelParameters: "Model Parameters",
    model: "Model",
    refreshList: "Refresh List",
    refreshing: "Refreshing...",
    systemInstruction: "System Instruction",
    enableThinking: "Enable Thinking",
    enableThinkingDesc: "For reasoning models (CoT)",
    advancedSampling: "Advanced Sampling",
    advancedSamplingDesc: "Customize generation (Temp, Top-P, Min-P...)",
    temperature: "Temperature",
    topP: "Top P",
    minP: "Min P",
    topK: "Top K",
    freqPenalty: "Freq. Penalty",
    presPenalty: "Pres. Penalty",
    repeatLastN: "Repeat Last N",
    maxOutputTokens: "Max Output Tokens",
    autoGenerateTitles: "Auto-Generate Titles",
    autoGenerateTitlesDesc: "Summarize first message as chat title",
    saveAndClose: "Save & Close",
    resetToDefault: "Reset to Default",
    language: "Language",
    
    // Status
    status_running: "Running",
    status_waiting: "Waiting",
    status_cached: "Cached",
    status_swapped: "Swapped",
    status_finished: "Finished",
    
    // Errors/Alerts
    uploadBlockedSize: "Upload blocked: Total attachment size would exceed 100MB limit.",
    imageUploadIgnored: "Image upload ignored. Current model does not support images.",
    fileIgnored: "File ignored. Unsupported file type.",
    uploadError: "Some files could not be uploaded",
    messageBlockedContext: "Message blocked: Estimated token usage ({used}) exceeds remaining context space ({available}). Please start a new chat or shorten context.",
    messageBlockedFallback: "Message blocked: Estimated conversation tokens ({total}) exceeds fallback limit ({limit}). Please start a new chat.",
    copyFallbackFailed: "Failed to copy text.",
    clipboardUnavailable: "Clipboard API unavailable",
    serverConfigError: "Unable to obtain server config automatically. Using default: {url}",
    noModelsFound: "No models found or connection failed."
  },
  zh: {
    // Sidebar
    newChat: "新对话",
    history: "历史记录",
    lightMode: "浅色模式",
    darkMode: "深色模式",
    settings: "设置",
    
    // Welcome
    welcomeTitle: "欢迎使用 ChatClient",
    welcomeSubtitle: "在下方输入消息或上传文件以开始对话。",
    imageUploadEnabled: "✨ 当前模型支持图片上传",
    
    // Input
    messagePlaceholder: "发送消息...",
    waitingPlaceholder: "等待回复...",
    stopGeneration: "停止生成",
    disclaimer: "AI 可能会犯错。请核实重要信息。",
    
    // Message Actions
    redo: "重试",
    copy: "复制",
    copied: "已复制!",
    share: "分享",
    edit: "编辑",
    
    // Thinking
    thoughtProcess: "思考过程",
    thoughtProcessInterrupted: "思考过程 (已中断)",
    thinking: "思考中",
    thinkingTruncatedTitle: "思考过程被截断",
    thinkingTruncatedDesc: "思考过程被意外中断。部分内容已显示在下方。",
    thinkingTruncatedWarning: "⚠️ 思考过程意外中断。",
    
    // Edit Modal
    editMessageTitle: "编辑消息",
    editMessageWarning: "编辑此消息将清除该对话随后的所有消息。",
    cancel: "取消",
    sendAndRestart: "发送并重新开始",
    
    // Settings
    configuration: "配置",
    backendSettings: "后端设置",
    serverUrl: "服务器地址",
    apiKey: "API 密钥",
    contextCaching: "上下文缓存",
    contextCachingDesc: "向服务器发送唯一的 session_id",
    modelParameters: "模型参数",
    model: "模型",
    refreshList: "刷新列表",
    refreshing: "刷新中...",
    systemInstruction: "系统指令",
    enableThinking: "启用思考",
    enableThinkingDesc: "用于推理模型 (CoT)",
    advancedSampling: "高级采样",
    advancedSamplingDesc: "自定义生成参数 (Temp, Top-P, Min-P...)",
    temperature: "温度 (Temperature)",
    topP: "核采样 (Top P)",
    minP: "最小概率 (Min P)",
    topK: "Top K",
    freqPenalty: "频率惩罚",
    presPenalty: "存在惩罚",
    repeatLastN: "重复惩罚范围 (N)",
    maxOutputTokens: "最大输出 Token",
    autoGenerateTitles: "自动生成标题",
    autoGenerateTitlesDesc: "根据第一条消息总结标题",
    saveAndClose: "保存并关闭",
    resetToDefault: "恢复默认值",
    language: "语言 (Language)",
    
    // Status
    status_running: "运行中",
    status_waiting: "等待中",
    status_cached: "已缓存",
    status_swapped: "已交换",
    status_finished: "已完成",
    
     // Errors/Alerts
    uploadBlockedSize: "上传被阻止：总附件大小超过 100MB 限制。",
    imageUploadIgnored: "图片上传被忽略。当前模型不支持图片。",
    fileIgnored: "文件被忽略。不支持的文件类型。",
    uploadError: "部分文件上传失败",
    messageBlockedContext: "消息被阻止：预计 Token 用量 ({used}) 超过剩余上下文空间 ({available})。请开启新对话或缩短上下文。",
    messageBlockedFallback: "消息被阻止：预计对话 Token ({total}) 超过限制 ({limit})。请开启新对话。",
    copyFallbackFailed: "复制文本失败。",
    clipboardUnavailable: "剪贴板 API 不可用",
    serverConfigError: "无法自动获取服务器配置。使用默认值: {url}",
    noModelsFound: "未找到模型或连接失败。"
  }
};
