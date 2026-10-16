import pytest
from pii_shield.redactor import redact_text
from pii_shield.restorer import restore_text


def test_redact_and_stable_placeholders():
    prompt = "Mera PAN card ABCDE1234F hai. I repeat my PAN is ABCDE1234F."
    res = redact_text(prompt)

    # Must contain placeholder
    assert "<PAN_1>" in res.redacted_text
    assert "ABCDE1234F" not in res.redacted_text

    # Both occurrences of the same PAN must map to the same placeholder <PAN_1>
    assert res.redacted_text.count("<PAN_1>") == 2
    assert "<PAN_2>" not in res.redacted_text
    assert res.placeholder_map["<PAN_1>"] == "ABCDE1234F"


def test_roundtrip_restoration():
    prompt = "Customer Vikram Patel has phone 9876543210 and PAN ABCDE1234F."
    res = redact_text(prompt)

    assert "9876543210" not in res.redacted_text
    assert "ABCDE1234F" not in res.redacted_text

    # Simulated LLM upstream response echoing the placeholders
    mock_llm_reply = (
        f"Verified customer {res.placeholder_map.get('<NAME_1>', '<NAME_1>')} with "
        f"registered phone {res.placeholder_map.get('<PHONE_1>', '<PHONE_1>')} and "
        f"tax id <PAN_1>."
    )
    # The simulated upstream receives only placeholders
    upstream_sees_reply = "Verified customer <NAME_1> with registered phone <PHONE_1> and tax id <PAN_1>."

    # Restore placeholders
    restored = restore_text(upstream_sees_reply, res.placeholder_map)

    # Must contain original values
    assert "Vikram Patel" in restored
    assert "9876543210" in restored
    assert "ABCDE1234F" in restored
    assert "<PAN_1>" not in restored
    assert "<PHONE_1>" not in restored


def test_tolerant_whitespace_restoration():
    placeholder_map = {"<PAN_1>": "ABCDE1234F", "<NAME_1>": "Rajan Mishra"}
    # Model returns slightly spaced placeholders: < PAN_1 >
    llm_output_spaced = "Details for < NAME_1 > with PAN < PAN_1 >."
    restored = restore_text(llm_output_spaced, placeholder_map)

    assert "Rajan Mishra" in restored
    assert "ABCDE1234F" in restored
    assert "<" not in restored
