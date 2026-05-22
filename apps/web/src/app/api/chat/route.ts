import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { messages, sessionId, model } = await req.json();

  // In a real implementation, you would instantiate the SDK here
  // For this demonstration without a local Redis server running during Next.js build,
  // we will mock the SSE stream.

  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      const mockText = "Hello! I am a simulated response from the OlliveTrace pipeline. I will stream these tokens sequentially to demonstrate the latency metrics.";
      const words = mockText.split(' ');
      let tokensCount = 0;
      
      for (const word of words) {
        // simulate delay
        await new Promise(r => setTimeout(r, 50));
        
        const chunk = `data: ${JSON.stringify({ token: word + ' ' })}\\n\\n`;
        controller.enqueue(encoder.encode(chunk));
        tokensCount++;
      }

      // Final event with latency
      const finalChunk = `data: ${JSON.stringify({ done: true, total_latency_ms: 50 * words.length, tokens: tokensCount })}\\n\\n`;
      controller.enqueue(encoder.encode(finalChunk));
      
      controller.close();
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
