# 🏗️ OlliveTrace Architecture Notes

![Architecture Diagram](./architecture.png)

> **Design Philosophy**: The OlliveTrace architecture was built to prioritize **zero-latency overhead for the end user**, **strict separation of concerns between state and telemetry**, and **fault-tolerant ingestion** capable of scaling horizontally. 

Below is a breakdown of the engineering decisions powering the system.

---

## 🌊 1. Ingestion Flow: Decoupled & Event-Driven
The ingestion pipeline follows a highly decoupled, asynchronous pattern to ensure the hot-path (user chatting) is never bottlenecked by database writes.

1. **Edge Interception**: The Next.js API route instantiates the `@ollivetrace/sdk`. As the LLM streams tokens to the client, the SDK passively calculates TTFB (Time To First Byte), total latency, and estimated token costs.
2. **Asynchronous Dispatch**: Once the stream concludes, the SDK fires non-blocking `xadd` calls to Redis, pushing JSON payloads into two distinct streams: `inference:logged` and `conversation:events`.
3. **Background Consumption**: The `fastapi-ingest` container runs continuous Python `asyncio` background workers. These workers poll the Redis streams using **Consumer Groups**, allowing for easy horizontal scaling.
4. **Validation & Persistence**: Workers validate incoming payloads against strict `Pydantic` schemas. Verified data is then fanned out: relational state goes to **PostgreSQL (OLTP)**, and high-volume metrics go to **ClickHouse (OLAP)**.

---

## 📝 2. Logging Strategy: Fire-and-Forget + Edge Redaction
- **Zero-Blocking Telemetry**: The SDK intentionally does *not* `await` the Redis `xadd` operations. This guarantees that observability logging never bottlenecks the user's perception of latency. If the logging cluster drops, the chatbot remains 100% operational.
- **Dual-Stream Segregation**: We enforce a strict separation of concerns at the event bus layer. Inference telemetry (which is high volume and append-only) lives in its own stream. Stateful conversation events (session starts, cancellations) live in another. This prevents noisy analytics from stalling critical session state mutations.
- **PII Redaction at the Edge**: Sensitive data should never touch the network unnecessarily. The SDK features a `PiiRedactor` utility that strips sensitive information (e.g., SSNs, Credit Cards) via configurable regex *before* the payload is serialized and sent to Redis.

---

## 🚀 3. Scaling Considerations: Right Tool for the Job
- **Consumer Group Horizontal Scaling**: Because the Python workers utilize Redis Consumer Groups, scaling the ingestion pipeline is as trivial as spinning up more replicas of the `fastapi-ingest` pod. Redis automatically load-balances unread stream messages across the available consumer nodes.
- **Database Segregation (OLTP vs OLAP)**: 
  - **ClickHouse (OLAP)**: Optimized to ingest millions of append-only rows per second and evaluate complex aggregations (like p95 latency) in milliseconds. This prevents the heavy dashboard analytics from impacting chat operations.
  - **PostgreSQL (OLTP)**: Reserved strictly for relational state (session updates, user mappings, raw chat transcripts) to keep its b-tree indexes small and lookup times fast.
- **Connection Pooling**: Both the Python FastAPI backend and the ingestion workers utilize asynchronous connection pools (`asyncpg` for Postgres, `clickhouse-connect` HTTP keep-alive) to prevent connection starvation under heavy concurrent load.

---

## 🛡️ 4. Failure Handling Assumptions: Built to Survive
- **Worker Fault Tolerance (No-Ack Recovery)**: If a Python ingestion worker crashes mid-process or a database insert temporarily fails (e.g., ClickHouse is restarting), the worker does *not* issue a Redis `xack` (acknowledgment). Redis safely retains the message as "pending." When the worker restarts, it uses `XAUTOCLAIM` to retrieve and process the abandoned messages.
- **Dead Letter Queue (DLQ) for Poison Pills**: If a message fails Pydantic schema validation inside the worker, it is caught and immediately written to an `inference:dlq` (Dead Letter Queue) stream in Redis, and then `xack`'ed from the main stream. This ensures malformed data does not create an infinite retry loop that blocks the entire pipeline.
- **SDK Resilience**: If the Redis container goes completely offline, the `xadd` operation in the SDK will fail, but the SDK swallows the exception gracefully. The core assumption is that **the application must prioritize returning the LLM response to the user** even if observability telemetry is temporarily lost.
