export type Provider = 'anthropic' | 'openai' | 'google';
export type LogStatus = 'success' | 'error' | 'cancelled' | 'timeout';

export interface InferenceLog {
  session_id: string;
  turn_id: string;
  provider: Provider;
  model: string;
  status: LogStatus;
  ttfb_ms: number;
  total_latency_ms: number;
  prompt_tokens: number;
  completion_tokens: number;
  estimated_cost_usd: number;
  input_preview: string;
  output_preview: string;
  error_code?: string;
  logged_at: string; // ISO8601 string
  pii_redacted: boolean;
}

export interface RedactionResult {
  redacted: string;
  found: string[];
}

export interface LLMClientOptions {
  providers?: {
    anthropic?: any; // Anthropic
    openai?: any; // OpenAI
    google?: any; // GoogleGenerativeAI
  };
  defaultProvider: Provider;
  fallbackOrder: Provider[];
  logEndpoint?: string; 
  redisUrl?: string; // used to log via ioredis directly
  piiRedactor?: any;
  sessionId: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  model?: string;
  provider?: Provider;
  stream?: boolean;
}

export interface StreamingResponse {
  tokens: AsyncGenerator<string, void, unknown>;
  getMetrics: () => { ttfb_ms: number, total_latency_ms: number, completion_tokens: number };
}
