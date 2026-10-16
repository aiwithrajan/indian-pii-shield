import pytest
from pii_shield.checksums import (
    validate_verhoeff,
    generate_verhoeff_check_digit,
    validate_gstin_checksum,
    calculate_gstin_checksum_char
)


def test_verhoeff_aadhaar_checksum():
    # Generate valid Aadhaar numbers with correct Verhoeff check digits
    base_11 = "23456789012"
    check_digit = generate_verhoeff_check_digit(base_11)
    valid_aadhaar = base_11 + check_digit

    assert validate_verhoeff(valid_aadhaar) is True

    # Mutate last digit - must fail
    bad_check_digit = str((int(check_digit) + 1) % 10)
    invalid_aadhaar = base_11 + bad_check_digit
    assert validate_verhoeff(invalid_aadhaar) is False

    # Invalid length must fail
    assert validate_verhoeff("12345") is False
    # Starting with 0 or 1 must fail
    assert validate_verhoeff("012345678901") is False


def test_gstin_checksum():
    # 14 chars base for GSTIN (State 27 = Maharashtra, PAN = AAACW1234F, Entity 1, 'Z')
    base_14 = "27AAACW1234F1Z"
    check_char = calculate_gstin_checksum_char(base_14)
    valid_gstin = base_14 + check_char

    assert validate_gstin_checksum(valid_gstin) is True

    # Mutate checksum char - must fail
    wrong_char = "X" if check_char != "X" else "Y"
    invalid_gstin = base_14 + wrong_char
    assert validate_gstin_checksum(invalid_gstin) is False

    # Malformed GSTIN must fail
    assert validate_gstin_checksum("INVALIDGSTIN123") is False
