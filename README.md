# OlliveTrace

A production-grade LLM inference logging and ingestion system.

```bash
docker compose up --build
```

## Steps to Run

1. **Configure Environment Variables**
   Rename `.env.example` to `.env` in the root directory and populate your API keys:
   ```bash
   cp .env.example .env
   ```
   Add your `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, and `GOOGLE_API_KEY` to the `.env` file.

2. **Start the Infrastructure**
   Launch all 7 services (Next.js, FastAPI, Redis, Postgres, ClickHouse, Prometheus, Grafana) using Docker Compose:
   ```bash
   docker compose up --build
   ```

3. **Access the Applications**
   - **Next.js Frontend (Chat & Dashboard)**: Open [http://localhost:3000](http://localhost:3000)
   - **Grafana (Observability Metrics)**: Open [http://localhost:3001](http://localhost:3001) (Login: `admin` / Password: `admin` if prompted)
   - **FastAPI Ingestion API**: Open [http://localhost:8000/docs](http://localhost:8000/docs) for Swagger UI

4. **Verify Setup**
   - ClickHouse and Postgres will automatically run their respective initialization scripts located in `db/clickhouse/init.sql` and `db/migrations/V1__initial_schema.sql`.
   - Start chatting in the Web UI to generate inference logs. You should see token streaming and latency metrics. Navigate to the Grafana dashboard to view the data aggregating in real-time.

## Architecture

OlliveTrace consists of 6 explicit layers:

1. **Frontend**: A Next.js 14 App Router application with shadcn/ui and Tailwind CSS, featuring a multi-turn Chatbot UI with SSE streaming, a conversation list, and an observability dashboard with Recharts.
2. **SDK / Middleware**: A TypeScript SDK for Node.js environments that handles multi-provider routing (OpenAI, Anthropic, Google), metadata capture (latency, token counts), and PII redaction (via regex rules) before logging telemetry asynchronously to Redis Streams.
3. **Event Bus**: Redis Streams serves as a lightweight Kafka alternative. It maintains two main streams: `inference:logged` for telemetry logs and `conversation:events` for session lifecycle state.
4. **Ingestion API**: A FastAPI backend featuring asynchronous workers that read from Redis Streams. One worker writes inference logs into ClickHouse (for analytical querying), and the other updates conversation state in PostgreSQL.
5. **Storage Layer**: 
   - **PostgreSQL**: For storing normalized conversation and message metadata (ensuring ACID compliance and foreign key constraints).
   - **ClickHouse**: An append-only MergeTree configuration optimized for high-volume inference logs and sub-second analytical queries.
   - **Redis**: For the streaming event bus and ephemeral session states.
6. **Infrastructure**: Full Docker Compose setup for local one-command setup, Kubernetes manifests for production deployment (with HPA, rolling updates), and provisioned Grafana dashboards.

## Schema Design Decisions

- **Why Postgres for conversations/messages?** We need a relational database to maintain ACID properties, foreign key constraints (e.g., messages belonging to a conversation), and easy upserts for session states.
- **Why ClickHouse for inference_logs?** Inference telemetry data is high-volume and append-only. ClickHouse's columnar architecture allows for lightning-fast aggregations (e.g., calculating p95 latency or throughput over millions of rows) in milliseconds, which powers the real-time observability dashboard.
- **Why Redis Streams over Kafka?** Redis is significantly lighter to operate than Kafka, especially for smaller to medium-scale deployments, while still providing robust built-in consumer group semantics, message acknowledgment (XACK), and a dead-letter queue (via auto-claim) for fault tolerance.

## Tradeoffs

- **Two databases vs one:** Managing both Postgres and ClickHouse increases operational complexity (backups, migrations, tuning). However, the query performance tradeoff is worth it for analytical dashboarding, as a purely relational DB would eventually choke on massive telemetry aggregations.
- **Fire-and-forget logging vs synchronous:** The SDK writes logs to Redis asynchronously without awaiting acknowledgment in the hot path. This prioritizes the user's chatbot latency over absolute 100% log completeness in the event of a total network failure between the app and Redis.
- **90-day TTL on ClickHouse:** Using a TTL controls storage costs. While long-term historical analysis > 90 days is sacrificed, the observability focus is typically on recent operational health. Long-term data would require a separate archiving strategy (e.g., S3).

## Future Improvements (With More Time)

- **OpenTelemetry distributed traces:** Integrate standard OTel spans to trace requests end-to-end across the Next.js frontend, SDK middleware, and LLM provider endpoints.
- **Per-user cost budget alerts:** Add logic in the ingestion workers to aggregate estimated costs per user and emit alerts (via webhook/email) if a daily/monthly threshold is exceeded.
- **Model evaluation logging:** Implement a feedback mechanism (thumbs up/down) in the Chat UI, sending a separate `turn.evaluated` event to update the conversation telemetry.
- **Webhook delivery for DLQ alerts:** Expose a Slack/PagerDuty integration that automatically triggers when messages fall into the `inference:dlq` (Dead Letter Queue) stream.
