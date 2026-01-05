
export interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  created: string; // PB uses 'created'
  updated: string; // PB uses 'updated'
  is_pinned?: boolean; // PB conventions usually snake_case
  is_archived?: boolean;
  tasks?: TaskItem[];
  user?: string;
}

export interface TaskItem {
  id: string;
  text: string;
  isCompleted: boolean;
  dueDate?: string; 
}

export interface ChatThread {
  id: string;
  title: string;
  persona: 'hanisah' | 'stoic';
  model_id: string; // Changed to match PB field
  messages: ChatMessage[];
  updated: string; // PB uses 'updated'
  isPinned?: boolean;
  user?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string | Blob;
  metadata?: {
    model?: string;
    provider?: string;
    latency?: number;
    status: 'success' | 'error' | 'retrying';
    errorDetails?: string;
    groundingChunks?: any[];
    isRerouting?: boolean;
    systemStatus?: string;
  };
}

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'TODO' | 'KERNEL' | 'TRACE';

export interface LogEntry {
  id: string;
  timestamp: string;
  layer: string;
  level: LogLevel;
  code: string;
  message: string;
  payload?: any;
}

export interface ModelMetadata {
  id: string;
  name: string;
  category: 'GEMINI_3' | 'GEMINI_2_5' | 'DEEPSEEK_OFFICIAL' | 'GROQ_VELOCITY' | 'OPEN_ROUTER_ELITE' | 'MISTRAL_NATIVE';
  provider: 'GEMINI' | 'GROQ' | 'DEEPSEEK' | 'OPENAI' | 'XAI' | 'MISTRAL' | 'OPENROUTER';
  description: string;
  specs: { 
      context: string; 
      contextLimit: number; // Numeric limit for token calculation
      speed: 'INSTANT' | 'FAST' | 'THINKING' | 'DEEP'; 
      intelligence: number; 
  }
}
