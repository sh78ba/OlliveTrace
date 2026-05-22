# Architecture Notes

![Architecture Diagram](./architecture.png)

This document provides a brief explanation of the architectural decisions made for the OlliveTrace logging and ingestion system.

## Ingestion Flow
The ingestion pipeline follows a highly decoupled, asynchronous, event-driven pattern:
1. **Frontend Request**: The user initiates a request in the Next.js Chat UI.
2. **SDK Interception**: The Next.js API route instantiates the `@ollivetrace/sdk` and calls `.chat()`.
3. **LLM Execution & Telemetry**: The SDK streams the real-time response from the requested model provider (OpenAI, Anthropic, or Google) directly back to the client. Concurrently, it asynchronously calculates metrics (TTFB, Total Latency, Token counts, Estimated Costs).
4. **Redis Streams (Event Bus)**: The SDK fires non-blocking `xadd` calls to Redis, pushing payloads into two distinct streams: `inference:logged` and `conversation:events`.
5. **Python Workers**: The `fastapi-ingest` container runs background asynchronous Python workers that continuously poll these Redis streams as Consumer Groups.
6. **Database Persistence**: The workers validate the JSON payloads using strict Pydantic schemas and write the state tracking into PostgreSQL (OLTP) and the high-volume metrics into ClickHouse (OLAP).

## Logging Strategy
- **Asynchronous Fire-and-Forget**: The SDK intentionally does not `await` the Redis `xadd` operations in the critical execution path of the chatbot. This guarantees that observability logging never bottlenecks the user's perception of latency.
- **Dual-Stream Separation**: We enforce a strict separation of concerns at the event bus layer. Inference telemetry (high volume, append-only) lives in its own stream, while stateful Conversation events (session starts, turn completions, cancellations) live in another. This prevents noisy telemetry from stalling critical state mutations.
- **PII Redaction at the Edge**: The SDK features a `PiiRedactor` utility that strips sensitive information (e.g., SSNs, Credit Cards, Emails) via configurable regex passes *before* the payload is ever serialized and sent over the network to Redis.

## Scaling Considerations
- **Consumer Group Horizontal Scaling**: Because the Python workers utilize Redis Consumer Groups, scaling the ingestion pipeline is as simple as spinning up more replicas of the `fastapi-ingest` container. Redis automatically load-balances unread stream messages across the available consumer nodes.
- **Database Segregation**: 
  - **ClickHouse (OLAP)** is optimized to ingest millions of append-only rows per second and evaluate complex aggregations (like p95 latency) in milliseconds, preventing the dashboard analytics from impacting chat operations.
  - **PostgreSQL (OLTP)** is reserved strictly for relational state (session updates, user mappings) keeping its index size small and fast.
- **Connection Pooling**: Both the Python FastAPI backend and the ingestion workers utilize asynchronous connection pools (`asyncpg` for Postgres) to prevent connection starvation under heavy concurrent load.

## Failure Handling Assumptions
- **SDK Resilience**: If the Redis container goes down, the `xadd` operation in the SDK will fail, but the SDK swallows the exception (`.catch(e => console.error)`). The assumption is that the application should prioritize returning the LLM response to the user even if observability telemetry is temporarily lost.
- **Worker Fault Tolerance**: If a Python ingestion worker crashes mid-process or a database insert temporarily fails (e.g., ClickHouse unavailable), the worker does *not* issue a Redis `xack` (acknowledgment). Redis safely retains the message as "pending." When the worker restarts or another consumer spins up, it can use `XAUTOCLAIM` to retrieve and process the abandoned messages.
- **Poison Pill Messages**: If a message fails Pydantic schema validation inside the worker, it is caught and immediately written to an `inference:dlq` (Dead Letter Queue) stream in Redis, and then `xack`'ed from the main stream. This ensures malformed data does not create an infinite retry loop that blocks the entire pipeline.
