import asyncio
import json
import os
import redis.asyncio as redis
import clickhouse_connect
from redis.exceptions import ResponseError
from datetime import datetime, timezone
from schemas import InferenceLogSchema
from pydantic import ValidationError

class InferenceLogConsumer:
    def __init__(self):
        self.redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
        self.redis = redis.from_url(self.redis_url, decode_responses=True)
        self.group = "ingestion-workers"
        self.stream = "inference:logged"
        
        ch_host = os.getenv("CLICKHOUSE_HOST", "localhost")
        ch_port = int(os.getenv("CLICKHOUSE_PORT", "8123"))
        ch_db = os.getenv("CLICKHOUSE_DB", "ollivetrace")
        
        # Connect to ClickHouse (synchronous for simplicity here, though async is preferred in production)
        try:
            self.client = clickhouse_connect.get_client(host=ch_host, port=ch_port, database=ch_db)
        except Exception as e:
            print(f"ClickHouse connection failed: {e}")
            self.client = None

    async def init_group(self):
        try:
            await self.redis.xgroup_create(self.stream, self.group, id="0", mkstream=True)
        except ResponseError as e:
            if "BUSYGROUP" not in str(e):
                raise

    async def start(self):
        await self.init_group()
        print("InferenceLogConsumer started")
        
        while True:
            try:
                # Read from stream
                messages = await self.redis.xreadgroup(self.group, "worker-1", {self.stream: ">"}, count=100, block=500)
                if not messages:
                    await asyncio.sleep(0.5)
                    continue
                
                for stream_name, msg_list in messages:
                    for msg_id, payload in msg_list:
                        await self.process_message(msg_id, payload)
                        
            except Exception as e:
                print(f"Error in InferenceLogConsumer loop: {e}")
                await asyncio.sleep(1)

    async def process_message(self, msg_id, payload):
        raw_data = payload.get("payload")
        if not raw_data:
            await self.redis.xack(self.stream, self.group, msg_id)
            return

        try:
            data = json.loads(raw_data)
            log = InferenceLogSchema(**data)
            
            # Enrich
            ingested_at = datetime.now(timezone.utc)
            
            # Write to ClickHouse
            if self.client:
                row = [
                    log.session_id, log.turn_id, log.provider, log.model, log.status,
                    log.ttfb_ms, log.total_latency_ms, log.prompt_tokens, log.completion_tokens,
                    log.estimated_cost_usd, log.input_preview, log.output_preview,
                    log.error_code, 1 if log.pii_redacted else 0,
                    log.logged_at, ingested_at
                ]
                # In production, use batch inserts
                self.client.insert("inference_logs", [row], column_names=[
                    "session_id", "turn_id", "provider", "model", "status",
                    "ttfb_ms", "total_latency_ms", "prompt_tokens", "completion_tokens",
                    "estimated_cost_usd", "input_preview", "output_preview",
                    "error_code", "pii_redacted", "logged_at", "ingested_at"
                ])
                
            await self.redis.xack(self.stream, self.group, msg_id)
            
        except ValidationError as e:
            # DLQ
            await self.redis.xadd("inference:dlq", {"reason": "validation_error", "payload": raw_data})
            await self.redis.xack(self.stream, self.group, msg_id)
        except Exception as e:
            # DLQ or retry
            await self.redis.xadd("inference:dlq", {"reason": str(e), "payload": raw_data})
            await self.redis.xack(self.stream, self.group, msg_id)
