import { Redis } from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { PiiRedactor } from './redactor';
import { ChatMessage, ChatOptions, InferenceLog, LLMClientOptions, Provider } from './types';

export class LLMClient {
  private options: LLMClientOptions;
  private redis: Redis | null = null;
  private redactor: PiiRedactor;
  private costTable: Record<string, { prompt: number; completion: number }> = {
    'gpt-4o': { prompt: 5.0, completion: 15.0 },
    'gpt-3.5-turbo': { prompt: 0.5, completion: 1.5 },
    'claude-3-5-sonnet-20240620': { prompt: 3.0, completion: 15.0 },
    'gemini-1.5-flash': { prompt: 0.35, completion: 1.05 }
  }; // $ per 1M tokens

  constructor(options: LLMClientOptions) {
    this.options = options;
    this.redactor = options.piiRedactor || new PiiRedactor();
    
    if (options.redisUrl) {
      this.redis = new Redis(options.redisUrl);
    }
  }

  public async chat(messages: ChatMessage[], options: ChatOptions): Promise<any> {
    const provider = options.provider || this.routeProvider(options.model);
    let currentProvider = provider;
    
    const turnId = uuidv4();
    let startTime = Date.now();
    let ttfb = 0;
    
    const inputStr = messages.map(m => m.content).join('\\n');
    const inputPreview = inputStr.substring(0, 200);
    const redactedInput = this.redactor.redact(inputPreview);

    try {
      // Session Started Event (fire and forget)
      if (messages.length === 1) {
        this.emitEvent({
          type: 'session.started',
          session_id: this.options.sessionId,
          model: options.model || 'unknown',
          provider: currentProvider
        });
      }

      // Execute Chat
      let responseContent = '';
      let completionTokens = 0;
      let promptTokens = Math.ceil(inputStr.length / 4); // naive estimation

      if (options.stream) {
        // Implement AsyncGenerator for streaming
        const streamResponse = await this.executeChatStream(messages, options, currentProvider);
        
        const self = this;
        async function* streamWrapper() {
          let firstChunk = true;
          for await (const chunk of streamResponse) {
            if (firstChunk && chunk.trim().length > 0) {
              ttfb = Date.now() - startTime;
              firstChunk = false;
            }
            responseContent += chunk;
            completionTokens += 1; // naive token counting
            yield chunk;
          }
          
          const totalLatency = Date.now() - startTime;
          const redactedOutput = self.redactor.redact(responseContent.substring(0, 200));
          
          self.logInference({
            session_id: self.options.sessionId,
            turn_id: turnId,
            provider: currentProvider,
            model: options.model || 'unknown',
            status: 'success',
            ttfb_ms: ttfb,
            total_latency_ms: totalLatency,
            prompt_tokens: promptTokens,
            completion_tokens: completionTokens,
            estimated_cost_usd: self.calculateCost(options.model || 'unknown', promptTokens, completionTokens),
            input_preview: redactedInput.redacted,
            output_preview: redactedOutput.redacted,
            logged_at: new Date().toISOString(),
            pii_redacted: redactedInput.found.length > 0 || redactedOutput.found.length > 0
          });

          self.emitEvent({
            type: 'turn.completed',
            session_id: self.options.sessionId,
            turn_id: turnId
          });
        }
        
        return streamWrapper();
      } else {
        // Non-streaming logic would go here
        const response = await this.executeChat(messages, options, currentProvider);
        responseContent = response;
        completionTokens = Math.ceil(responseContent.length / 4);
        const totalLatency = Date.now() - startTime;
        ttfb = totalLatency; // same for non-streaming
        
        const redactedOutput = this.redactor.redact(responseContent.substring(0, 200));

        this.logInference({
          session_id: this.options.sessionId,
          turn_id: turnId,
          provider: currentProvider,
          model: options.model || 'unknown',
          status: 'success',
          ttfb_ms: ttfb,
          total_latency_ms: totalLatency,
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          estimated_cost_usd: this.calculateCost(options.model || 'unknown', promptTokens, completionTokens),
          input_preview: redactedInput.redacted,
          output_preview: redactedOutput.redacted,
          logged_at: new Date().toISOString(),
          pii_redacted: redactedInput.found.length > 0 || redactedOutput.found.length > 0
        });

        this.emitEvent({
          type: 'turn.completed',
          session_id: this.options.sessionId,
          turn_id: turnId
        });
        
        return responseContent;
      }

    } catch (error: any) {
      // Fallback logic could be implemented here
      this.logInference({
          session_id: this.options.sessionId,
          turn_id: turnId,
          provider: currentProvider,
          model: options.model || 'unknown',
          status: 'error',
          ttfb_ms: 0,
          total_latency_ms: Date.now() - startTime,
          prompt_tokens: Math.ceil(inputStr.length / 4),
          completion_tokens: 0,
          estimated_cost_usd: 0,
          input_preview: redactedInput.redacted,
          output_preview: '',
          error_code: error.message || 'unknown_error',
          logged_at: new Date().toISOString(),
          pii_redacted: redactedInput.found.length > 0
      });
      throw error;
    }
  }

  public cancelSession() {
    this.emitEvent({
      type: 'session.cancelled',
      session_id: this.options.sessionId,
      cancelled_at: new Date().toISOString()
    });
  }

  private routeProvider(model?: string): Provider {
    if (!model) return this.options.defaultProvider;
    if (model.startsWith('claude')) return 'anthropic';
    if (model.startsWith('gpt')) return 'openai';
    if (model.startsWith('gemini')) return 'google';
    return this.options.defaultProvider;
  }

  private calculateCost(model: string, promptTokens: number, completionTokens: number): number {
    const rates = this.costTable[model] || { prompt: 0, completion: 0 };
    return (rates.prompt * promptTokens / 1000000) + (rates.completion * completionTokens / 1000000);
  }

  private async executeChat(messages: ChatMessage[], options: ChatOptions, provider: Provider): Promise<string> {
    // Mock implementation for demo purposes
    return "This is a mock response from " + provider;
  }

  private async *executeChatStream(messages: ChatMessage[], options: ChatOptions, provider: Provider): AsyncGenerator<string, void, unknown> {
    const mockWords = ["Here", " is", " a", " simulated", " streaming", " response", " from", " ", provider, "."];
    for (const word of mockWords) {
      await new Promise(resolve => setTimeout(resolve, 50));
      // check cancel key logic if needed
      yield word;
    }
  }

  private logInference(log: InferenceLog) {
    if (!this.redis) return;
    this.redis.xadd('inference:logged', '*', 'payload', JSON.stringify(log)).catch(e => {
      console.error('Failed to log inference', e);
      // write to in-memory buffer or localStorage
    });
  }

  private emitEvent(event: any) {
    if (!this.redis) return;
    this.redis.xadd('conversation:events', '*', 'payload', JSON.stringify(event)).catch(e => {
      console.error('Failed to emit event', e);
    });
  }
}

export { PiiRedactor };
export * from './types';
