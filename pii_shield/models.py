from enum import Enum
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class PIIType(str, Enum):
    AADHAAR = "AADHAAR"
    PAN = "PAN"
    GSTIN = "GSTIN"
    PHONE = "PHONE"
    UPI = "UPI"
    IFSC = "IFSC"
    NAME = "NAME"
    ADDRESS = "ADDRESS"
    SPOKEN_DIGITS = "SPOKEN_DIGITS"
    EMAIL = "EMAIL"
    PASSPORT = "PASSPORT"
    VOTER_ID = "VOTER_ID"
    DRIVING_LICENSE = "DRIVING_LICENSE"
    BANK_ACCOUNT = "BANK_ACCOUNT"
    CREDIT_CARD = "CREDIT_CARD"
    ABHA_ID = "ABHA_ID"
    PINCODE = "PINCODE"


class PIISpan(BaseModel):
    start: int
    end: int
    pii_type: PIIType
    raw_value: str
    confidence: float = 1.0
    detector_source: str = "rules"  # "rules" or "model"
    is_verified: bool = True

    class Config:
        frozen = True


class ChatMessage(BaseModel):
    role: str
    content: str
    name: Optional[str] = None


class ChatCompletionRequest(BaseModel):
    model: str = "gpt-4o"
    messages: List[ChatMessage]
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = None
    stream: Optional[bool] = False
    top_p: Optional[float] = None
    frequency_penalty: Optional[float] = 0.0
    presence_penalty: Optional[float] = 0.0


class ChatCompletionChoice(BaseModel):
    index: int = 0
    message: ChatMessage
    finish_reason: str = "stop"


class UsageInfo(BaseModel):
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0


class ChatCompletionResponse(BaseModel):
    id: str
    object: str = "chat.completion"
    created: int
    model: str
    choices: List[ChatCompletionChoice]
    usage: Optional[UsageInfo] = None
    shield_metadata: Optional[Dict[str, Any]] = None


class RedactionResult(BaseModel):
    redacted_text: str
    spans: List[PIISpan]
    placeholder_map: Dict[str, str]  # e.g. {"<AADHAAR_1>": "987654321098"}
    pii_counts: Dict[str, int]
    processing_time_ms: float


class CorrectionItem(BaseModel):
    id: Optional[str] = None
    input_text: str
    expected_spans: List[Dict[str, Any]]  # [{"start": 0, "end": 10, "pii_type": "PAN"}]
    user_note: Optional[str] = ""
    created_at: Optional[str] = None
