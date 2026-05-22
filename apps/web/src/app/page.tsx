import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-black text-white selection:bg-emerald-500/30">
      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/40 via-zinc-950 to-black"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-emerald-500/10 blur-[120px] rounded-full -z-10"></div>

        <div className="max-w-4xl space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000 ease-out">
          <div className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-sm text-emerald-300 backdrop-blur-sm">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 mr-2 animate-pulse"></span>
            Production-Ready LLM Telemetry
          </div>
          
          <h1 className="text-5xl sm:text-7xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-white to-zinc-500">
            OlliveTrace
          </h1>
          
          <p className="text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            A high-performance ingestion pipeline and observability dashboard for large language models. Monitor latencies, track tokens, and log inferences in real-time.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
            <Link href="/chat">
              <Button size="lg" className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white rounded-full px-8 h-12 text-base font-medium shadow-[0_0_40px_-10px_rgba(16,185,129,0.5)] transition-all hover:scale-105">
                Start Chatting
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button size="lg" variant="outline" className="w-full sm:w-auto rounded-full px-8 h-12 text-base font-medium border-zinc-700 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-300 backdrop-blur-sm transition-all">
                View Dashboard
              </Button>
            </Link>
          </div>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-32 max-w-5xl mx-auto w-full text-left opacity-0 animate-[fade-in_1s_ease-out_0.5s_forwards]">
          <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 backdrop-blur-md">
            <h3 className="text-xl font-semibold mb-2 text-zinc-200">Asynchronous Logging</h3>
            <p className="text-zinc-400 text-sm leading-relaxed">Redis Streams decouple inference telemetry from the hot path, ensuring zero latency penalty to users.</p>
          </div>
          <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 backdrop-blur-md">
            <h3 className="text-xl font-semibold mb-2 text-zinc-200">PII Redaction</h3>
            <p className="text-zinc-400 text-sm leading-relaxed">Automatically scrub sensitive strings and credit cards via middleware before they ever reach the ingestion node.</p>
          </div>
          <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 backdrop-blur-md">
            <h3 className="text-xl font-semibold mb-2 text-zinc-200">OLAP Analytics</h3>
            <p className="text-zinc-400 text-sm leading-relaxed">ClickHouse-backed storage enables lightning-fast p95 aggregations over millions of rows in milliseconds.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
