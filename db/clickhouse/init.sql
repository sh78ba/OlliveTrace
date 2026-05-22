CREATE DATABASE IF NOT EXISTS ollivetrace;

USE ollivetrace;

CREATE TABLE IF NOT EXISTS inference_logs (
  session_id        UUID,
  turn_id           UUID,
  provider          LowCardinality(String),
  model             LowCardinality(String),
  status            LowCardinality(String),
  ttfb_ms           UInt32,
  total_latency_ms  UInt32,
  prompt_tokens     UInt32,
  completion_tokens UInt32,
  estimated_cost_usd Float32,
  input_preview     String,
  output_preview    String,
  error_code        Nullable(String),
  pii_redacted      UInt8,
  logged_at         DateTime64(3, 'UTC'),
  ingested_at       DateTime64(3, 'UTC')
) ENGINE = MergeTree()
  PARTITION BY toYYYYMMDD(logged_at)
  ORDER BY (logged_at, provider, model)
  TTL logged_at + INTERVAL 90 DAY;
