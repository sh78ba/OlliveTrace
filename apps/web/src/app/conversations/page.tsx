'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

// Mock data
const initialConversations = [
  { id: 'sess-1a2b3c', title: 'How to configure Redis Streams?', status: 'active', messages: 4, created_at: '2026-05-22T10:00:00Z' },
  { id: 'sess-4d5e6f', title: 'Write a python script to parse CSV', status: 'completed', messages: 12, created_at: '2026-05-22T09:15:00Z' },
  { id: 'sess-7g8h9i', title: 'What is the capital of France?', status: 'cancelled', messages: 2, created_at: '2026-05-21T18:30:00Z' },
];

export default function ConversationsPage() {
  const [conversations, setConversations] = useState(initialConversations);

  const handleCancel = async (id: string) => {
    // In real app, call DELETE /api/sessions/{id}/cancel
    setConversations(prev => prev.map(c => c.id === id ? { ...c, status: 'cancelled' } : c));
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'active': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50';
      case 'completed': return 'bg-amber-500/20 text-amber-400 border-amber-500/50';
      case 'cancelled': return 'bg-red-500/20 text-red-400 border-red-500/50';
      default: return '';
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Conversations</h1>
        <Button asChild className="bg-emerald-600 hover:bg-emerald-500">
          <Link href="/chat">New Chat</Link>
        </Button>
      </div>

      <Card className="border-zinc-800 bg-zinc-900/50">
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-800 hover:bg-transparent">
              <TableHead>Session ID</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Messages</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {conversations.map((conv) => (
              <TableRow key={conv.id} className="border-zinc-800 hover:bg-zinc-800/50">
                <TableCell className="font-mono text-xs text-zinc-400">{conv.id}</TableCell>
                <TableCell className="font-medium max-w-xs truncate">{conv.title}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={getStatusColor(conv.status)}>
                    {conv.status}
                  </Badge>
                </TableCell>
                <TableCell>{conv.messages}</TableCell>
                <TableCell className="text-zinc-400">
                  {new Date(conv.created_at).toLocaleString()}
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button asChild variant="outline" size="sm" className="bg-transparent border-zinc-700 hover:bg-zinc-800">
                    <Link href={`/chat?sessionId=${conv.id}`}>Resume</Link>
                  </Button>
                  {conv.status === 'active' && (
                    <Button variant="destructive" size="sm" onClick={() => handleCancel(conv.id)}>
                      Cancel
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
