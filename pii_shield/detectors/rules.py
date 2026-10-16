import re
from typing import List
from ..models import PIISpan, PIIType
from ..checksums import validate_verhoeff, validate_gstin_checksum

# Regex for Aadhaar: 12 digits, optional space or hyphen separators
RE_AADHAAR = re.compile(r'\b[2-9]\d{3}[\s-]?[0-9]{4}[\s-]?[0-9]{4}\b')

# Regex for PAN: 5 uppercase letters, 4 digits, 1 uppercase letter
RE_PAN = re.compile(r'\b[A-Z]{5}[0-9]{4}[A-Z]\b', re.IGNORECASE)

# Regex for GSTIN: 15 alphanumeric characters
RE_GSTIN = re.compile(r'\b[0-3][0-9][A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b', re.IGNORECASE)

# Regex for Indian Phone Numbers:
# Optional +91 or 0 prefix, starts with 6-9, followed by 9 digits with optional spaces or hyphens
RE_PHONE = re.compile(r'(?:(?:\+91|91|0)[\s-]?)?([6-9]\d{2}[\s-]?\d{3}[\s-]?\d{4})\b')

# Regex for UPI ID: username@bank_handle
RE_UPI = re.compile(r'\b[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}\b')

# Regex for IFSC Code: 4 letters + 0 + 6 alphanumeric
RE_IFSC = re.compile(r'\b[A-Z]{4}0[A-Z0-9]{6}\b', re.IGNORECASE)

# Regex for Email Addresses
RE_EMAIL = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b')

# Regex for Indian Passport: 1 uppercase letter followed by 7 digits
RE_PASSPORT = re.compile(r'\b[A-PR-WYa-pr-wy][1-9][0-9]{6}\b')

# Regex for Indian Voter ID (EPIC): 3 letters followed by 7 digits
RE_VOTER_ID = re.compile(r'\b[A-Z]{3}[0-9]{7}\b', re.IGNORECASE)

# Regex for Indian Driving License (DL): e.g. DL-0420110012345 or DL14 20110012345
RE_DRIVING_LICENSE = re.compile(r'\b[A-Z]{2}[-\s]?[0-9]{2}[-\s]?[0-9]{4}[-\s]?[0-9]{7}\b', re.IGNORECASE)

# Regex for Credit / Debit Cards (13 to 19 digits with spaces/hyphens)
RE_CREDIT_CARD = re.compile(r'\b(?:\d{4}[-\s]?){3}\d{4}\b|\b\d{13,19}\b')

# Regex for Indian Bank Account Numbers (9 to 18 consecutive digits)
RE_BANK_ACCOUNT = re.compile(r'(?i)(?:a/c|account|acct|acc|khata)[\s#:.-]*(\d{9,18})\b')

# Regex for ABHA ID (Ayushman Bharat Health Account): 14 digits (XX-XXXX-XXXX-XXXX or continuous)
RE_ABHA_ID = re.compile(r'\b\d{2}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b')

# Regex for Indian Postal PIN Code (6 digits starting with 1-9)
RE_PINCODE = re.compile(r'(?i)(?:pincode|pin|postal\s*code)[\s#:.-]*([1-9][0-9]{5})\b')


def detect_aadhaar(text: str) -> List[PIISpan]:
    spans = []
    for match in RE_AADHAAR.finditer(text):
        raw = match.group(0)
        clean = raw.replace(" ", "").replace("-", "")
        # Only accept if it passes the Verhoeff checksum
        if len(clean) == 12 and validate_verhoeff(clean):
            spans.append(PIISpan(
                start=match.start(),
                end=match.end(),
                pii_type=PIIType.AADHAAR,
                raw_value=raw,
                confidence=1.0,
                detector_source="rules",
                is_verified=True
            ))
    return spans


def detect_pan(text: str) -> List[PIISpan]:
    spans = []
    for match in RE_PAN.finditer(text):
        raw = match.group(0).upper()
        # High confidence if 4th char is standard entity type (P, C, H, F, A, T, etc.)
        conf = 1.0 if raw[3] in "CPHFATBLJG" else 0.95
        spans.append(PIISpan(
            start=match.start(),
            end=match.end(),
            pii_type=PIIType.PAN,
            raw_value=match.group(0),
            confidence=conf,
            detector_source="rules",
            is_verified=True
        ))
    return spans


def detect_gstin(text: str) -> List[PIISpan]:
    spans = []
    for match in RE_GSTIN.finditer(text):
        raw = match.group(0).upper()
        if validate_gstin_checksum(raw):
            spans.append(PIISpan(
                start=match.start(),
                end=match.end(),
                pii_type=PIIType.GSTIN,
                raw_value=match.group(0),
                confidence=1.0,
                detector_source="rules",
                is_verified=True
            ))
    return spans


def detect_phone(text: str) -> List[PIISpan]:
    spans = []
    for match in RE_PHONE.finditer(text):
        raw = match.group(0)
        digits_only = re.sub(r'\D', '', raw)
        # Indian phone numbers must have 10 digits (excluding 0 or 91 country code)
        if len(digits_only) == 10 and digits_only[0] in "6789":
            spans.append(PIISpan(
                start=match.start(),
                end=match.end(),
                pii_type=PIIType.PHONE,
                raw_value=raw,
                confidence=0.95,
                detector_source="rules",
                is_verified=True
            ))
        elif len(digits_only) == 11 and digits_only.startswith("0") and digits_only[1] in "6789":
            spans.append(PIISpan(
                start=match.start(),
                end=match.end(),
                pii_type=PIIType.PHONE,
                raw_value=raw,
                confidence=0.95,
                detector_source="rules",
                is_verified=True
            ))
        elif len(digits_only) == 12 and digits_only.startswith("91") and digits_only[2] in "6789":
            spans.append(PIISpan(
                start=match.start(),
                end=match.end(),
                pii_type=PIIType.PHONE,
                raw_value=raw,
                confidence=0.98,
                detector_source="rules",
                is_verified=True
            ))
    return spans


def detect_upi(text: str) -> List[PIISpan]:
    spans = []
    # Known legitimate UPI handles vs email domains
    common_email_domains = {"gmail", "yahoo", "hotmail", "outlook", "icloud", "proton", "example", "test"}
    for match in RE_UPI.finditer(text):
        raw = match.group(0)
        handle = raw.split("@")[1].lower()
        # If handle is a common email domain without typical UPI prefix/format, skip
        if handle in common_email_domains:
            continue
        spans.append(PIISpan(
            start=match.start(),
            end=match.end(),
            pii_type=PIIType.UPI,
            raw_value=raw,
            confidence=0.92,
            detector_source="rules",
            is_verified=True
        ))
    return spans


def detect_ifsc(text: str) -> List[PIISpan]:
    spans = []
    for match in RE_IFSC.finditer(text):
        raw = match.group(0).upper()
        spans.append(PIISpan(
            start=match.start(),
            end=match.end(),
            pii_type=PIIType.IFSC,
            raw_value=match.group(0),
            confidence=0.96,
            detector_source="rules",
            is_verified=True
        ))
    return spans


def detect_email(text: str) -> List[PIISpan]:
    spans = []
    for match in RE_EMAIL.finditer(text):
        spans.append(PIISpan(
            start=match.start(),
            end=match.end(),
            pii_type=PIIType.EMAIL,
            raw_value=match.group(0),
            confidence=0.98,
            detector_source="rules",
            is_verified=True
        ))
    return spans


def detect_passport(text: str) -> List[PIISpan]:
    spans = []
    for match in RE_PASSPORT.finditer(text):
        spans.append(PIISpan(
            start=match.start(),
            end=match.end(),
            pii_type=PIIType.PASSPORT,
            raw_value=match.group(0),
            confidence=0.95,
            detector_source="rules",
            is_verified=True
        ))
    return spans


def detect_voter_id(text: str) -> List[PIISpan]:
    spans = []
    for match in RE_VOTER_ID.finditer(text):
        spans.append(PIISpan(
            start=match.start(),
            end=match.end(),
            pii_type=PIIType.VOTER_ID,
            raw_value=match.group(0),
            confidence=0.95,
            detector_source="rules",
            is_verified=True
        ))
    return spans


def detect_driving_license(text: str) -> List[PIISpan]:
    spans = []
    for match in RE_DRIVING_LICENSE.finditer(text):
        spans.append(PIISpan(
            start=match.start(),
            end=match.end(),
            pii_type=PIIType.DRIVING_LICENSE,
            raw_value=match.group(0),
            confidence=0.95,
            detector_source="rules",
            is_verified=True
        ))
    return spans


def detect_credit_card(text: str) -> List[PIISpan]:
    from ..checksums import validate_luhn
    spans = []
    for match in RE_CREDIT_CARD.finditer(text):
        raw = match.group(0)
        clean = raw.replace(" ", "").replace("-", "")
        if validate_luhn(clean):
            spans.append(PIISpan(
                start=match.start(),
                end=match.end(),
                pii_type=PIIType.CREDIT_CARD,
                raw_value=raw,
                confidence=1.0,
                detector_source="rules",
                is_verified=True
            ))
    return spans


def detect_bank_account(text: str) -> List[PIISpan]:
    spans = []
    for match in RE_BANK_ACCOUNT.finditer(text):
        # group(1) has the digits
        spans.append(PIISpan(
            start=match.start(1),
            end=match.end(1),
            pii_type=PIIType.BANK_ACCOUNT,
            raw_value=match.group(1),
            confidence=0.90,
            detector_source="rules",
            is_verified=True
        ))
    return spans


def detect_abha_id(text: str) -> List[PIISpan]:
    spans = []
    for match in RE_ABHA_ID.finditer(text):
        raw = match.group(0)
        clean = raw.replace(" ", "").replace("-", "")
        # ABHA is 14 digits
        if len(clean) == 14 and clean[0] in '123456789':
            spans.append(PIISpan(
                start=match.start(),
                end=match.end(),
                pii_type=PIIType.ABHA_ID,
                raw_value=raw,
                confidence=0.92,
                detector_source="rules",
                is_verified=True
            ))
    return spans


def detect_pincode(text: str) -> List[PIISpan]:
    spans = []
    for match in RE_PINCODE.finditer(text):
        spans.append(PIISpan(
            start=match.start(1),
            end=match.end(1),
            pii_type=PIIType.PINCODE,
            raw_value=match.group(1),
            confidence=0.92,
            detector_source="rules",
            is_verified=True
        ))
    return spans


def run_rule_detectors(text: str) -> List[PIISpan]:
    """Runs all deterministic Layer 1 detectors."""
    all_spans = []
    all_spans.extend(detect_aadhaar(text))
    all_spans.extend(detect_pan(text))
    all_spans.extend(detect_gstin(text))
    all_spans.extend(detect_phone(text))
    all_spans.extend(detect_upi(text))
    all_spans.extend(detect_ifsc(text))
    all_spans.extend(detect_email(text))
    all_spans.extend(detect_passport(text))
    all_spans.extend(detect_voter_id(text))
    all_spans.extend(detect_driving_license(text))
    all_spans.extend(detect_credit_card(text))
    all_spans.extend(detect_bank_account(text))
    all_spans.extend(detect_abha_id(text))
    all_spans.extend(detect_pincode(text))
    return all_spans
