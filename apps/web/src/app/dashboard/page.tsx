'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// Mock Data
const rpmData = [
  { time: '10:00', count: 40 }, { time: '10:05', count: 65 },
  { time: '10:10', count: 85 }, { time: '10:15', count: 120 },
  { time: '10:20', count: 90 }, { time: '10:25', count: 150 },
];

const latencyData = [
  { name: 'claude-3.5-sonnet', avg_ms: 600 },
  { name: 'gpt-4o', avg_ms: 450 },
  { name: 'gemini-1.5-pro', avg_ms: 550 },
];

const errorData = [
  { name: 'Success (200)', value: 850, color: '#10b981' },
  { name: 'Rate Limit (429)', value: 30, color: '#f59e0b' },
  { name: 'Timeout (504)', value: 15, color: '#ef4444' },
];

export default function DashboardPage() {
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold tracking-tight">Observability</h1>
      
      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-zinc-400">Avg Latency</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-emerald-400">530ms</div></CardContent>
        </Card>
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-zinc-400">p95 Latency</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-amber-400">1,200ms</div></CardContent>
        </Card>
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-zinc-400">Total Requests (Today)</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-white">4,289</div></CardContent>
        </Card>
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-zinc-400">Error Rate</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-red-400">1.2%</div></CardContent>
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
                {errorData.map((entry, index) => (
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
