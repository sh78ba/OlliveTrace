'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface DashboardData {
  summary: {
    avg_ms: number;
    p95_ms: number;
    total_requests: number;
    error_rate: number;
  };
  rpmData: { time: string; count: number }[];
  latencyData: { name: string; avg_ms: number }[];
  errorData: { name: string; value: number; color: string }[];
  error?: string;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_INGEST_URL || 'http://localhost:8000'}/metrics/dashboard`)
      .then(res => res.json())
      .then(json => {
        setData(json);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch dashboard metrics", err);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="p-8 text-center text-zinc-400">Loading metrics...</div>;
  if (!data || data.error) return <div className="p-8 text-center text-red-400">Error loading metrics. Is the FastAPI ingestion service running?</div>;

  const { summary, rpmData, latencyData, errorData } = data;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold tracking-tight">Observability</h1>
      
      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-zinc-400">Avg Latency</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-emerald-400">{summary.avg_ms}ms</div></CardContent>
        </Card>
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-zinc-400">p95 Latency</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-amber-400">{summary.p95_ms}ms</div></CardContent>
        </Card>
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-zinc-400">Total Requests</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-white">{summary.total_requests}</div></CardContent>
        </Card>
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-zinc-400">Error Rate</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-red-400">{summary.error_rate}%</div></CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-zinc-900/50 border-zinc-800 p-4 h-96">
          <h3 className="text-lg font-medium mb-4">Requests Per Minute</h3>
          <ResponsiveContainer width="100%" height="85%">
            <LineChart data={rpmData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
              <XAxis dataKey="time" stroke="#a1a1aa" />
              <YAxis stroke="#a1a1aa" />
              <Tooltip contentStyle={{ backgroundColor: '#18181b', border: 'none' }} />
              <Line type="monotone" dataKey="count" stroke="#10b981" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-800 p-4 h-96">
          <h3 className="text-lg font-medium mb-4">Avg Latency by Model (ms)</h3>
          <ResponsiveContainer width="100%" height="85%">
            <BarChart data={latencyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
              <XAxis dataKey="name" stroke="#a1a1aa" />
              <YAxis stroke="#a1a1aa" />
              <Tooltip contentStyle={{ backgroundColor: '#18181b', border: 'none' }} />
              <Bar dataKey="avg_ms" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-800 p-4 h-96 lg:col-span-2">
          <h3 className="text-lg font-medium mb-4">Response Status Distribution</h3>
          <ResponsiveContainer width="100%" height="85%">
            <PieChart>
              <Pie data={errorData} innerRadius={80} outerRadius={120} paddingAngle={5} dataKey="value">
                {errorData.map((entry: { color: string }, index: number) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#18181b', border: 'none' }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}
