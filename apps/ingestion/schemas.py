from pydantic import BaseModel, Field, field_validator
from typing import Optional, Literal
from uuid import UUID
from datetime import datetime, timezone, timedelta

class InferenceLogSchema(BaseModel):
    session_id: UUID
    turn_id: UUID
    provider: Literal['anthropic', 'openai', 'google']
    model: str
    status: Literal['success', 'error', 'cancelled', 'timeout']
    ttfb_ms: int
    total_latency_ms: int
    prompt_tokens: int
    completion_tokens: int
    estimated_cost_usd: float
    input_preview: str
    output_preview: str
    error_code: Optional[str] = None
    logged_at: datetime
    pii_redacted: bool

    @field_validator('total_latency_ms')
    def latency_must_be_positive(cls, v):
        if v < 0:
            raise ValueError('total_latency_ms cannot be negative')
        return v

    @field_validator('logged_at')
    def logged_at_not_too_far_in_future(cls, v):
        if v > datetime.now(timezone.utc) + timedelta(minutes=5):
            raise ValueError('logged_at cannot be more than 5 minutes in the future')
        return v

class ConversationEventSchema(BaseModel):
    type: Literal['session.started', 'turn.completed', 'session.cancelled']
    session_id: UUID
    model: Optional[str] = None
    provider: Optional[str] = None
    turn_id: Optional[UUID] = None
    title: Optional[str] = None
    cancelled_at: Optional[datetime] = None
