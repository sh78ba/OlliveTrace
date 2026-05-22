import { Redis } from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
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
          model: options.model || 'gpt-3.5-turbo',
          provider: currentProvider,
          title: messages.find(m => m.role === 'user')?.content.substring(0, 80) || 'New Conversation'
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
            model: options.model || 'gpt-3.5-turbo',
            status: 'success',
            ttfb_ms: ttfb,
            total_latency_ms: totalLatency,
            prompt_tokens: promptTokens,
            completion_tokens: completionTokens,
            estimated_cost_usd: self.calculateCost(options.model || 'gpt-3.5-turbo', promptTokens, completionTokens),
            input_preview: redactedInput.redacted,
            output_preview: redactedOutput.redacted,
            logged_at: new Date().toISOString(),
            pii_redacted: redactedInput.found.length > 0 || redactedOutput.found.length > 0
          });

          self.emitEvent({
            type: 'turn.completed',
            session_id: self.options.sessionId,
            turn_id: turnId,
            user_message: messages[messages.length - 1]?.content || '',
            assistant_message: responseContent
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
          model: options.model || 'gpt-3.5-turbo',
          status: 'success',
          ttfb_ms: ttfb,
          total_latency_ms: totalLatency,
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          estimated_cost_usd: this.calculateCost(options.model || 'gpt-3.5-turbo', promptTokens, completionTokens),
          input_preview: redactedInput.redacted,
          output_preview: redactedOutput.redacted,
          logged_at: new Date().toISOString(),
          pii_redacted: redactedInput.found.length > 0 || redactedOutput.found.length > 0
        });

        this.emitEvent({
          type: 'turn.completed',
          session_id: this.options.sessionId,
          turn_id: turnId,
          user_message: messages[messages.length - 1]?.content || '',
          assistant_message: responseContent
        });
        
        return responseContent;
      }

    } catch (error: any) {
      // Fallback logic could be implemented here
      this.logInference({
          session_id: this.options.sessionId,
          turn_id: turnId,
          provider: currentProvider,
          model: options.model || 'gpt-3.5-turbo',
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
    let response = '';
    const stream = this.executeChatStream(messages, options, provider);
    for await (const chunk of stream) {
      response += chunk;
    }
    return response;
  }

  private async *executeChatStream(messages: ChatMessage[], options: ChatOptions, provider: Provider): AsyncGenerator<string, void, unknown> {
    const model = options.model || 'gpt-3.5-turbo';
    
    if (provider === 'openai') {
      if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set.");
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const stream = await openai.chat.completions.create({
        model,
        messages: messages as any,
        stream: true,
      });
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) yield content;
      }
    } else if (provider === 'anthropic') {
      if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set.");
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const systemMessage = messages.find(m => m.role === 'system')?.content;
      const userMessages = messages.filter(m => m.role !== 'system').map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content
      }));
      
      const stream = await anthropic.messages.create({
        model,
        max_tokens: 1024,
        system: systemMessage,
        messages: userMessages as any,
        stream: true,
      });
      
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          yield chunk.delta.text;
        }
      }
    } else if (provider === 'google') {
      if (!process.env.GOOGLE_API_KEY) throw new Error("GOOGLE_API_KEY is not set.");
      const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
      const genModel = genAI.getGenerativeModel({ model });
      const history = messages.slice(0, -1).filter(m => m.role !== 'system').map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
      }));
      const latestMsg = messages[messages.length - 1].content;
      
      const chat = genModel.startChat({ history });
      const result = await chat.sendMessageStream(latestMsg);
      for await (const chunk of result.stream) {
        yield chunk.text();
      }
    } else {
      throw new Error(`Provider ${provider} not implemented for streaming.`);
    }
  }

  private logInference(log: InferenceLog) {
    if (!this.redis) return;
    this.redis.xadd('inference:logged', '*', 'payload', JSON.stringify(log)).catch((e: any) => {
      console.error('Failed to log inference', e);
      // write to in-memory buffer or localStorage
    });
  }

  private emitEvent(event: any) {
    if (!this.redis) return;
    this.redis.xadd('conversation:events', '*', 'payload', JSON.stringify(event)).catch((e: any) => {
      console.error('Failed to emit event', e);
    });
  }
}

export { PiiRedactor };
export * from './types';
