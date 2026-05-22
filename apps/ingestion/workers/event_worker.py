import asyncio
import json
import os
import redis.asyncio as redis
import asyncpg
from schemas import ConversationEventSchema
from pydantic import ValidationError

class ConversationEventConsumer:
    def __init__(self):
        self.redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
        self.pg_url = os.getenv("POSTGRES_URL", "postgresql://user:pass@localhost:5432/ollivetrace")
        self.redis = redis.from_url(self.redis_url, decode_responses=True)
        self.group = "event-handlers"
        self.stream = "conversation:events"
        self.pool = None

    async def init_group(self):
        try:
            await self.redis.xgroup_create(self.stream, self.group, id="0", mkstream=True)
        except redis.exceptions.ResponseError as e:
            if "BUSYGROUP" not in str(e):
                raise

    async def start(self):
        self.pool = await asyncpg.create_pool(self.pg_url)
        await self.init_group()
        print("ConversationEventConsumer started")
        
        while True:
            try:
                messages = await self.redis.xreadgroup(self.group, "worker-1", {self.stream: ">"}, count=50, block=500)
                if not messages:
                    await asyncio.sleep(0.5)
                    continue
                
                for stream_name, msg_list in messages:
                    for msg_id, payload in msg_list:
                        await self.process_message(msg_id, payload)
                        
            except Exception as e:
                print(f"Error in ConversationEventConsumer loop: {e}")
                await asyncio.sleep(1)

    async def process_message(self, msg_id, payload):
        raw_data = payload.get("payload")
        if not raw_data:
            await self.redis.xack(self.stream, self.group, msg_id)
            return

        try:
            data = json.loads(raw_data)
            event = ConversationEventSchema(**data)
            
            async with self.pool.acquire() as conn:
                if event.type == 'session.started':
                    await conn.execute("""
                        INSERT INTO conversations (session_id, model, provider)
                        VALUES ($1, $2, $3)
                        ON CONFLICT (session_id) DO NOTHING
                    """, event.session_id, event.model, event.provider)
                    
                elif event.type == 'turn.completed':
                    await conn.execute("""
                        UPDATE conversations 
                        SET last_active_at = now(), turn_count = turn_count + 1
                        WHERE session_id = $1
                    """, event.session_id)
                    
                elif event.type == 'session.cancelled':
                    await conn.execute("""
                        UPDATE conversations 
                        SET status = 'cancelled', cancelled_at = $2
                        WHERE session_id = $1
                    """, event.session_id, event.cancelled_at or datetime.now())
                    
            await self.redis.xack(self.stream, self.group, msg_id)
            
        except ValidationError as e:
            print(f"Validation error in event: {e}")
            await self.redis.xack(self.stream, self.group, msg_id)
        except Exception as e:
            print(f"Failed to process event: {e}")
            # Allow it to be claimed by XAUTOCLAIM later if temporary PG failure
