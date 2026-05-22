'use client';

import { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { ScrollArea } from '@/components/ui/scroll-area';

export default function ChatPage() {
  const [messages, setMessages] = useState<{role: string, content: string, latency?: number, tokens?: number}[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sid = urlParams.get('sessionId');
    if (sid) {
      setSessionId(sid);
      fetch(`${process.env.NEXT_PUBLIC_INGEST_URL || 'http://localhost:8000'}/conversations/${sid}/messages`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data) && data.length > 0) {
            setMessages(data.map(m => ({ role: m.role, content: m.content })));
          }
        })
        .catch(console.error);
    } else {
      setSessionId(uuidv4());
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming || !sessionId) return;

    const newMessages = [...messages, { role: 'user', content: input }];
    setMessages(newMessages);
    setInput('');
    setIsStreaming(true);

    abortControllerRef.current = new AbortController();

    try {
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, sessionId }),
        signal: abortControllerRef.current.signal,
      });

      if (!res.ok) throw new Error('Network response was not ok');
      if (!res.body) throw new Error('No body in response');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';
      let latency = 0;
      let tokens = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.replace('data: ', '');
            if (!dataStr) continue;
            try {
              const data = JSON.parse(dataStr);
              if (data.token) {
                assistantMessage += data.token;
                setMessages(prev => {
                  const newMsgs = [...prev];
                  newMsgs[newMsgs.length - 1].content = assistantMessage;
                  return newMsgs;
                });
              }
              if (data.done) {
                latency = data.total_latency_ms;
                tokens = data.tokens;
                setMessages(prev => {
                  const newMsgs = [...prev];
                  newMsgs[newMsgs.length - 1].latency = latency;
                  newMsgs[newMsgs.length - 1].tokens = tokens;
                  return newMsgs;
                });
              }
            } catch {
              // Ignore parse errors on incomplete chunks
            }
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('Chat error:', err);
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const cancelStreaming = async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      await fetch(`/api/sessions/${sessionId}/cancel`, { method: 'DELETE' });
      setIsStreaming(false);
    }
  };

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto p-4 gap-4">
      <ScrollArea className="flex-1 border border-zinc-800 bg-zinc-900/30 rounded-xl p-4">
        {messages.map((msg, idx) => (
          <div key={idx} className={`mb-6 flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl p-4 ${msg.role === 'user' ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-100'}`}>
              <div className="text-sm mb-2 opacity-70 font-medium">
                {msg.role === 'user' ? 'You' : 'AI Assistant'}
              </div>
              <div className="whitespace-pre-wrap">{msg.content}</div>
              
              {msg.role === 'assistant' && (msg.latency || msg.tokens) && (
                <div className="flex gap-2 mt-3 pt-3 border-t border-zinc-700/50">
                  {msg.latency && <Badge variant="outline" className="text-xs bg-zinc-900/50">{msg.latency}ms</Badge>}
                  {msg.tokens && <Badge variant="outline" className="text-xs bg-zinc-900/50">{msg.tokens} tokens</Badge>}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </ScrollArea>

      <form onSubmit={handleSubmit} className="flex gap-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isStreaming}
          placeholder="Send a message..."
          className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
        />
        {isStreaming ? (
          <Button type="button" variant="destructive" onClick={cancelStreaming} className="rounded-xl">
            Cancel
          </Button>
        ) : (
          <Button type="submit" className="bg-emerald-600 hover:bg-emerald-500 rounded-xl">
            Send
          </Button>
        )}
      </form>
    </div>
  );
}
