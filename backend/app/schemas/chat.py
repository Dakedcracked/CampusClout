import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class ThreadParticipant(BaseModel):
    user_id: uuid.UUID
    username: str
    display_name: str | None
    market_cap: float


class ThreadResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    other_user: ThreadParticipant
    last_message_at: datetime | None
    last_message_preview: str | None
    created_at: datetime


class MessageResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    thread_id: uuid.UUID
    sender_id: uuid.UUID | None
    sender_username: str | None
    content: str
    token_cost: int
    is_ai_icebreaker: bool
    created_at: datetime


class SendMessageRequest(BaseModel):
    content: str = Field(min_length=1, max_length=1000)


class DmCostResponse(BaseModel):
    target_username: str
    target_market_cap: float
    sender_market_cap: float
    token_cost: int
    can_afford: bool
    wallet_balance: int


class WsTicketResponse(BaseModel):
    ticket: str
    expires_in: int = 30


class WsChatMessage(BaseModel):
    """Payload sent over the chat WebSocket."""
    type: str  # "message" | "icebreaker" | "error"
    message: MessageResponse | None = None
    error: str | None = None
