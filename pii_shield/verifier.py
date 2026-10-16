from typing import List, Tuple
from .models import PIISpan, PIIType
from .checksums import validate_verhoeff, validate_gstin_checksum

ALLOWED_LABELS = {t.value for t in PIIType}


def verify_spans(spans: List[PIISpan], text: str) -> Tuple[List[PIISpan], int]:
    """
    Deterministic Verification Layer (PRD Requirement 9):
    1. Validates that start and end offsets are strictly inside bounds (0 <= start < end <= len(text)).
    2. Validates that the raw_value matches text[start:end].
    3. Validates that the PII label belongs to the strict allowlist.
    4. Re-verifies checksums for structured IDs (Aadhaar & GSTIN).
    Returns (valid_spans, dropped_count).
    """
    valid_spans: List[PIISpan] = []
    dropped_count = 0
    text_len = len(text)

    for span in spans:
        # Check boundary bounds
        if span.start < 0 or span.end > text_len or span.start >= span.end:
            dropped_count += 1
            continue

        # Check raw text slice exact match
        expected_raw = text[span.start:span.end]
        if span.raw_value != expected_raw:
            dropped_count += 1
            continue

        # Check allowlist
        if span.pii_type.value not in ALLOWED_LABELS:
            dropped_count += 1
            continue

        # Re-check structured checksums
        if span.pii_type == PIIType.AADHAAR:
            clean = span.raw_value.replace(" ", "").replace("-", "")
            if not (len(clean) == 12 and validate_verhoeff(clean)):
                dropped_count += 1
                continue

        if span.pii_type == PIIType.GSTIN:
            clean = span.raw_value.upper().replace(" ", "").replace("-", "")
            if not validate_gstin_checksum(clean):
                dropped_count += 1
                continue

        valid_spans.append(span)

    return valid_spans, dropped_count
