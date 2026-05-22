import { NextRequest, NextResponse } from 'next/server';
import { LLMClient } from '@ollivetrace/sdk';

export async function POST(req: NextRequest) {
  const { messages, sessionId, model } = await req.json();

  const client = new LLMClient({
    sessionId: sessionId || 'unknown-session',
    redisUrl: process.env.REDIS_URL || 'redis://redis:6379',
    defaultProvider: 'openai',
    fallbackOrder: ['openai', 'anthropic', 'google'],
  });

  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const startTime = Date.now();
        let tokensCount = 0;
        
        const resultStream = await client.chat(messages, { stream: true, model });
        
        for await (const token of resultStream) {
          tokensCount++;
          const chunk = `data: ${JSON.stringify({ token })}\n\n`;
          controller.enqueue(encoder.encode(chunk));
        }

        const totalLatency = Date.now() - startTime;
        const finalChunk = `data: ${JSON.stringify({ done: true, total_latency_ms: totalLatency, tokens: tokensCount })}\n\n`;
        controller.enqueue(encoder.encode(finalChunk));
        controller.close();
      } catch (err) {
        console.error("LLM Error:", err);
        const errorChunk = `data: ${JSON.stringify({ error: (err as Error).message })}\n\n`;
        controller.enqueue(encoder.encode(errorChunk));
        controller.close();
      }
    }
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
