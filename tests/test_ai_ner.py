from pii_shield.detectors.ai_model import detect_ai_entities
from pii_shield.redactor import redact_text
from pii_shield.models import PIIType


def test_ai_ner_detection():
    text = "Candidate Rahul Sharma submitted application for Bangalore office."
    spans = detect_ai_entities(text)
    assert any(s.pii_type == PIIType.NAME and "Rahul" in s.raw_value and s.detector_source == "ai_ner" for s in spans)


def test_hybrid_redaction_ai_and_rules():
    text = "Rahul Sharma registered with PAN ABCDE1234F"
    res = redact_text(text)
    assert "<NAME_1>" in res.redacted_text
    assert "<PAN_1>" in res.redacted_text
    sources = {s.detector_source for s in res.spans}
    assert "ai_ner" in sources or "rules" in sources
