'use client';

import { useEffect, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useRouter } from 'next/navigation';

interface Conversation {
  id: string;
  title: string;
  status: string;
  messages: number;
  created_at: string;
}

export default function ConversationsPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_INGEST_URL || 'http://localhost:8000'}/conversations`)
      .then(res => res.json())
      .then(json => {
        setConversations(json);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch conversations", err);
        setLoading(false);
      });
  }, []);

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
        <Button onClick={() => router.push('/chat')} className="bg-emerald-600 hover:bg-emerald-500">
          New Chat
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
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-zinc-400">Loading conversations...</TableCell>
              </TableRow>
            ) : conversations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-zinc-400">No conversations found.</TableCell>
              </TableRow>
            ) : conversations.map((conv) => (
              <TableRow key={conv.id} className="border-zinc-800 hover:bg-zinc-800/50">
                <TableCell className="font-mono text-xs text-zinc-400">{conv.id}</TableCell>
                <TableCell className="font-medium max-w-xs truncate">{conv.title || 'New Conversation'}</TableCell>
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
                  <Button onClick={() => router.push(`/chat?sessionId=${conv.id}`)} variant="outline" size="sm" className="bg-transparent border-zinc-700 hover:bg-zinc-800">
                    Resume
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
