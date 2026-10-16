import time
from collections import defaultdict
from typing import List, Dict, Tuple
from .models import PIISpan, PIIType, RedactionResult
from .detectors import run_rule_detectors, run_contextual_detector, detect_ai_entities
from .verifier import verify_spans


def resolve_overlaps(spans: List[PIISpan]) -> List[PIISpan]:
    """
    Resolves overlapping spans.
    Rule: Rules detector wins on structured IDs; higher confidence / longer span wins otherwise.
    """
    if not spans:
        return []

    # Sort spans primarily by start offset, then by length descending
    sorted_spans = sorted(spans, key=lambda s: (s.start, -(s.end - s.start)))
    resolved: List[PIISpan] = []

    for current in sorted_spans:
        if not resolved:
            resolved.append(current)
            continue

        prev = resolved[-1]
        # Check if overlaps with previous
        if current.start < prev.end:
            # Conflict resolution:
            # 1. If one is a verified rule detector and other is model/ai, rule detector wins
            if prev.detector_source == "rules" and current.detector_source != "rules":
                continue  # prev stays
            elif current.detector_source == "rules" and prev.detector_source != "rules":
                resolved[-1] = current  # current wins
            elif (current.end - current.start) > (prev.end - prev.start):
                # Longer span wins
                resolved[-1] = current
        else:
            resolved.append(current)

    return resolved


def redact_text(
    text: str,
    enable_rules: bool = True,
    enable_contextual: bool = True,
    enable_ai: bool = True,
    existing_placeholder_map: Dict[str, str] = None,
    allowed_pii_types: set = None
) -> RedactionResult:
    """
    Executes detection, verification, merging, and placeholder replacement.
    Ensures stable placeholders for identical values across messages within a request.
    If a PII type is in allowed_pii_types, it is left in normal form (unredacted).
    """
    t0 = time.time()
    raw_spans: List[PIISpan] = []
    allowed_set = set(allowed_pii_types or [])

    if enable_rules:
        raw_spans.extend(run_rule_detectors(text))

    if enable_ai:
        raw_spans.extend(detect_ai_entities(text))

    if enable_contextual:
        raw_spans.extend(run_contextual_detector(text))

    # Verify spans
    verified_spans, _ = verify_spans(raw_spans, text)

    # Resolve overlapping spans
    final_spans = resolve_overlaps(verified_spans)

    # Filter out spans whose pii_type is ALLOWED (Pass-through normal form)
    effective_spans = [s for s in final_spans if s.pii_type.value not in allowed_set and s.pii_type not in allowed_set]

    # Assign stable placeholders
    # Invert existing placeholder map to check if value already has a placeholder
    val_to_placeholder: Dict[Tuple[PIIType, str], str] = {}
    placeholder_map: Dict[str, str] = dict(existing_placeholder_map or {})
    for p_holder, val in placeholder_map.items():
        # infer type from placeholder e.g. <PAN_1>
        ptype_str = p_holder.strip("<>").split("_")[0]
        try:
            val_to_placeholder[(PIIType(ptype_str), val.lower())] = p_holder
        except Exception:
            pass

    type_counters: Dict[str, int] = defaultdict(int)
    # Initialize counters based on existing placeholders
    for p in placeholder_map.keys():
        ptype = p.strip("<>").split("_")[0]
        try:
            num = int(p.strip("<>").split("_")[1])
            type_counters[ptype] = max(type_counters[ptype], num)
        except Exception:
            pass

    # Sort in reverse order of start offset so string replacement does not offset subsequent indices
    reverse_spans = sorted(effective_spans, key=lambda s: s.start, reverse=True)
    redacted_chars = list(text)
    pii_counts: Dict[str, int] = defaultdict(int)

    for span in reverse_spans:
        key = (span.pii_type, span.raw_value.lower().strip())
        if key in val_to_placeholder:
            placeholder = val_to_placeholder[key]
        else:
            type_counters[span.pii_type.value] += 1
            idx = type_counters[span.pii_type.value]
            placeholder = f"<{span.pii_type.value}_{idx}>"
            val_to_placeholder[key] = placeholder
            placeholder_map[placeholder] = span.raw_value

        redacted_chars[span.start:span.end] = list(placeholder)
        pii_counts[span.pii_type.value] += 1

    redacted_text = "".join(redacted_chars)
    elapsed_ms = (time.time() - t0) * 1000

    return RedactionResult(
        redacted_text=redacted_text,
        spans=final_spans,
        placeholder_map=placeholder_map,
        pii_counts=dict(pii_counts),
        processing_time_ms=round(elapsed_ms, 2)
    )
