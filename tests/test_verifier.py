import pytest
from pii_shield.models import PIISpan, PIIType
from pii_shield.verifier import verify_spans


def test_verifier_catches_invalid_offsets():
    text = "Hello World"
    # End offset exceeds text length
    bad_span1 = PIISpan(start=0, end=99, pii_type=PIIType.NAME, raw_value="Hello", detector_source="model")
    # Start offset is negative
    bad_span2 = PIISpan(start=-5, end=5, pii_type=PIIType.NAME, raw_value="Hello", detector_source="model")
    # Start >= end
    bad_span3 = PIISpan(start=5, end=2, pii_type=PIIType.NAME, raw_value="Hello", detector_source="model")

    valid_spans, dropped = verify_spans([bad_span1, bad_span2, bad_span3], text)
    assert len(valid_spans) == 0
    assert dropped == 3


def test_verifier_catches_mismatched_text():
    text = "Payment sent to Rahul Sharma"
    # Slice text[16:28] is "Rahul Sharma", but raw_value says "Amit Kumar"
    bad_span = PIISpan(start=16, end=28, pii_type=PIIType.NAME, raw_value="Amit Kumar", detector_source="model")
    valid_spans, dropped = verify_spans([bad_span], text)
    assert len(valid_spans) == 0
    assert dropped == 1


def test_verifier_valid_spans():
    text = "Customer PAN ABCDE1234F verified."
    good_span = PIISpan(start=13, end=23, pii_type=PIIType.PAN, raw_value="ABCDE1234F", detector_source="rules")
    valid_spans, dropped = verify_spans([good_span], text)
    assert len(valid_spans) == 1
    assert dropped == 0
