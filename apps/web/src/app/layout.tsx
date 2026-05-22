import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Link from 'next/link'
import { MessageSquare, List, BarChart3 } from 'lucide-react'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'OlliveTrace',
  description: 'LLM Inference Logging and Ingestion',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} flex h-screen bg-zinc-950 text-white overflow-hidden`}>
        {/* Sidebar */}
        <aside className="w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col">
          <div className="p-4 border-b border-zinc-800">
            <h1 className="text-xl font-bold bg-gradient-to-r from-green-400 to-emerald-600 bg-clip-text text-transparent">OlliveTrace</h1>
          </div>
          <nav className="flex-1 p-4 space-y-2">
            <Link href="/chat" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-zinc-800 transition-colors">
              <MessageSquare size={20} className="text-zinc-400" />
              <span>Chat</span>
            </Link>
            <Link href="/conversations" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-zinc-800 transition-colors">
              <List size={20} className="text-zinc-400" />
              <span>Conversations</span>
            </Link>
            <Link href="/dashboard" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-zinc-800 transition-colors">
              <BarChart3 size={20} className="text-zinc-400" />
              <span>Dashboard</span>
            </Link>
          </nav>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col min-w-0">
          <header className="h-14 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-900/50 backdrop-blur-sm">
             <div className="text-sm font-medium text-zinc-400">Current Provider: Global</div>
             {/* Model Selector would go here */}
          </header>
          <div className="flex-1 overflow-auto bg-zinc-950">
            {children}
          </div>
        </main>
      </body>
    </html>
  )
}
