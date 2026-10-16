import pytest
from pii_shield.checksums import generate_verhoeff_check_digit, calculate_gstin_checksum_char
from pii_shield.detectors.rules import (
    detect_aadhaar,
    detect_pan,
    detect_gstin,
    detect_phone,
    detect_upi,
    detect_ifsc,
    run_rule_detectors
)
from pii_shield.detectors.context_model import (
    detect_names,
    detect_addresses,
    detect_spoken_digits,
    run_contextual_detector
)
from pii_shield.models import PIIType


def test_structured_detectors():
    # Valid Aadhaar numbers
    base_aadhaar = "23456789012"
    cd = generate_verhoeff_check_digit(base_aadhaar)
    raw_aadhaar = f"2345 {base_aadhaar[4:8]} {base_aadhaar[8:]}{cd}"
    text_aadhaar = f"Mera Aadhaar number {raw_aadhaar} hai."

    spans_a = detect_aadhaar(text_aadhaar)
    assert len(spans_a) == 1
    assert spans_a[0].pii_type == PIIType.AADHAAR

    # PAN Detection
    text_pan = "Customer PAN is ABCDE1234F for tax verification."
    spans_p = detect_pan(text_pan)
    assert len(spans_p) == 1
    assert spans_p[0].raw_value == "ABCDE1234F"
    assert spans_p[0].pii_type == PIIType.PAN

    # GSTIN Detection
    base_gstin = "27AAACW1234F1Z"
    gstin_cd = calculate_gstin_checksum_char(base_gstin)
    full_gstin = base_gstin + gstin_cd
    text_gstin = f"Invoice billed to GSTIN {full_gstin}."
    spans_g = detect_gstin(text_gstin)
    assert len(spans_g) == 1
    assert spans_g[0].raw_value == full_gstin
    assert spans_g[0].pii_type == PIIType.GSTIN

    # Phone Detection (with +91 and without)
    text_phone = "Contact customer at +91 9876543210 or 8765432109."
    spans_ph = detect_phone(text_phone)
    assert len(spans_ph) == 2
    assert all(s.pii_type == PIIType.PHONE for s in spans_ph)

    # UPI Detection
    text_upi = "Send 500 rupees to rahul.kumar@okhdfcbank."
    spans_u = detect_upi(text_upi)
    assert len(spans_u) == 1
    assert spans_u[0].raw_value == "rahul.kumar@okhdfcbank"

    # IFSC Detection
    text_ifsc = "Branch IFSC is HDFC0001234 for NEFT transfer."
    spans_i = detect_ifsc(text_ifsc)
    assert len(spans_i) == 1
    assert spans_i[0].raw_value == "HDFC0001234"


def test_contextual_detectors():
    # Names with honorifics
    text_name1 = "Documents submitted by Shri Rajan Mishra."
    spans_n1 = detect_names(text_name1)
    assert len(spans_n1) >= 1
    assert "Rajan Mishra" in spans_n1[0].raw_value

    text_name2 = "Please coordinate with Sharma ji regarding the delivery."
    spans_n2 = detect_names(text_name2)
    assert len(spans_n2) >= 1
    assert "Sharma ji" in spans_n2[0].raw_value

    # Landmark Address in Hinglish
    text_addr = "Deliver to Sharma ji ke ghar ke paas wali gali, Indiranagar, Bangalore - 560038."
    spans_ad = detect_addresses(text_addr)
    assert len(spans_ad) >= 1
    assert spans_ad[0].pii_type == PIIType.ADDRESS

    # Spoken Digits
    text_digits = "Mera phone number hai nau aath saat chheh paanch char teen do."
    spans_dig = detect_spoken_digits(text_digits)
    assert len(spans_dig) == 1
    assert spans_dig[0].pii_type == PIIType.SPOKEN_DIGITS
