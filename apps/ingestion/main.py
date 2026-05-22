import asyncio
import os
import asyncpg
import clickhouse_connect
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from workers.inference_worker import InferenceLogConsumer
from workers.event_worker import ConversationEventConsumer

app = FastAPI(title="OlliveTrace Ingestion API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    # Database connections
    app.state.pg_pool = await asyncpg.create_pool(os.getenv("POSTGRES_URL", "postgresql://user:pass@localhost:5432/ollivetrace"))
    
    try:
        app.state.ch_client = clickhouse_connect.get_client(
            host=os.getenv("CLICKHOUSE_HOST", "localhost"),
            port=int(os.getenv("CLICKHOUSE_PORT", "8123")),
            database=os.getenv("CLICKHOUSE_DB", "ollivetrace")
        )
    except Exception as e:
        print(f"Failed to connect to ClickHouse in main API: {e}")
        app.state.ch_client = None

    inference_worker = InferenceLogConsumer()
    event_worker = ConversationEventConsumer()
    
    asyncio.create_task(inference_worker.start())
    asyncio.create_task(event_worker.start())

@app.on_event("shutdown")
async def shutdown_event():
    if hasattr(app.state, 'pg_pool') and app.state.pg_pool:
        await app.state.pg_pool.close()

@app.get("/health")
async def health():
    return { "status": "ok" }

@app.get("/conversations")
async def get_conversations():
    async with app.state.pg_pool.acquire() as conn:
        rows = await conn.fetch("SELECT session_id as id, title, status, turn_count as messages, created_at FROM conversations ORDER BY created_at DESC LIMIT 50")
        return [dict(r) for r in rows]

@app.get("/metrics/dashboard")
async def get_dashboard_metrics():
    client = app.state.ch_client
    if not client:
        return {"error": "ClickHouse not connected"}
    
    # Avg and p95 latency
    res = client.query("SELECT avg(total_latency_ms), quantile(0.95)(total_latency_ms), count(*), countIf(status != 'success') FROM inference_logs")
    row = res.result_rows[0]
    avg_ms = row[0] or 0
    p95_ms = row[1] or 0
    total = row[2] or 0
    errors = row[3] or 0
    error_rate = (errors / total * 100) if total > 0 else 0

    # RPM
    rpm_res = client.query("SELECT toStartOfMinute(logged_at) as time, count(*) FROM inference_logs WHERE logged_at >= now() - INTERVAL 30 MINUTE GROUP BY time ORDER BY time ASC")
    rpm_data = [{"time": r[0].strftime("%H:%M"), "count": r[1]} for r in rpm_res.result_rows]

    # Latency by model
    lat_res = client.query("SELECT model, avg(total_latency_ms) FROM inference_logs GROUP BY model")
    latency_data = [{"name": r[0] if r[0] else 'unknown', "avg_ms": round(r[1]) if r[1] else 0} for r in lat_res.result_rows]

    # Errors
    err_res = client.query("SELECT status, count(*) FROM inference_logs GROUP BY status")
    error_data = []
    for r in err_res.result_rows:
        status = r[0] if r[0] else 'unknown'
        color = "#10b981" if status == 'success' else "#ef4444"
        name = "Success" if status == 'success' else f"Error ({status})"
        error_data.append({"name": name, "value": r[1], "color": color})

    # Ensure empty state has some defaults so UI doesn't crash
    if not error_data:
        error_data = [{"name": "Success", "value": 1, "color": "#10b981"}]
        
    return {
        "summary": {
            "avg_ms": round(avg_ms),
            "p95_ms": round(p95_ms),
            "total_requests": total,
            "error_rate": round(error_rate, 1)
        },
        "rpmData": rpm_data,
        "latencyData": latency_data,
        "errorData": error_data
    }
