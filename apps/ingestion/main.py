import asyncio
import os
from fastapi import FastAPI
from workers.inference_worker import InferenceLogConsumer
from workers.event_worker import ConversationEventConsumer

app = FastAPI(title="OlliveTrace Ingestion API")

@app.on_event("startup")
async def startup_event():
    # Initialize workers (in background tasks for this example)
    inference_worker = InferenceLogConsumer()
    event_worker = ConversationEventConsumer()
    
    asyncio.create_task(inference_worker.start())
    asyncio.create_task(event_worker.start())

@app.get("/health")
async def health():
    return { "status": "ok", "redis": True, "clickhouse": True, "postgres": True }

@app.get("/metrics/latency")
async def get_latency():
    # Mocked metric response, ideally queries ClickHouse
    return { "avg_ms": 450, "p50_ms": 400, "p95_ms": 800, "p99_ms": 1200 }

@app.get("/metrics/throughput")
async def get_throughput():
    # Mocked metric response
    return { "rpm": [{"minute": "2026-05-22T10:00", "count": 120}] }

@app.get("/metrics/errors")
async def get_errors():
    # Mocked metric response
    return { "by_status": {"timeout": 2, "error": 5} }

@app.get("/metrics/by_model")
async def get_by_model():
    # Mocked metric response
    return [
        {"provider": "anthropic", "model": "claude-3-5-sonnet-20240620", "avg_latency": 600, "count": 100},
        {"provider": "openai", "model": "gpt-4o", "avg_latency": 500, "count": 80}
    ]
