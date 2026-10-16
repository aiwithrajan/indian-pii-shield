"""
Checksum validators for Indian Structured IDs:
1. Aadhaar (Verhoeff Algorithm)
2. GSTIN (Modulo 36 Checksum Algorithm)
"""

# ==========================================
# 1. VERHOEFF ALGORITHM (AADHAAR)
# ==========================================

# The multiplication table (d)
VERHOEFF_D = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
    [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
    [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
    [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
    [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
    [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
    [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
    [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
    [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
]

# The permutation table (p)
VERHOEFF_P = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
    [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
    [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
    [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
    [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
    [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
    [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]
]

# The inverse table (inv)
VERHOEFF_INV = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9]


def validate_verhoeff(num_str: str) -> bool:
    """
    Validates a number string using the Verhoeff checksum algorithm.
    Returns True if the check passes (c == 0).
    """
    clean_num = "".join(filter(str.isdigit, num_str))
    if len(clean_num) != 12:
        return False
    # Aadhaar must not start with 0 or 1
    if clean_num[0] in ('0', '1'):
        return False

    c = 0
    reversed_num = clean_num[::-1]
    for i, digit in enumerate(reversed_num):
        c = VERHOEFF_D[c][VERHOEFF_P[i % 8][int(digit)]]
    return c == 0


def generate_verhoeff_check_digit(num_11_digits: str) -> str:
    """
    Generates the 12th Verhoeff checksum digit for an 11-digit base.
    """
    clean_num = "".join(filter(str.isdigit, num_11_digits))
    c = 0
    reversed_num = clean_num[::-1]
    for i, digit in enumerate(reversed_num):
        c = VERHOEFF_D[c][VERHOEFF_P[(i + 1) % 8][int(digit)]]
    return str(VERHOEFF_INV[c])


# ==========================================
# 2. GSTIN MODULO 36 CHECKSUM
# ==========================================

GSTIN_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"


def validate_gstin_checksum(gstin: str) -> bool:
    """
    Validates the 15-character GSTIN check digit per official Indian GST spec:
    Format: 2 digits (State) + 5 letters (PAN) + 4 digits + 1 letter + 1 char ('Z' or digit) + 'Z' + 1 checksum char.
    """
    clean_gstin = gstin.strip().upper().replace(" ", "").replace("-", "")
    if len(clean_gstin) != 15:
        return False

    # Basic regex validation
    import re
    if not re.match(r"^[0-3][0-9][A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$", clean_gstin):
        return False

    # Checksum calculation:
    factor = 1
    total = 0
    mod = 36

    for i in range(14):
        code_point = GSTIN_CHARS.index(clean_gstin[i])
        digit = factor * code_point
        factor = 2 if factor == 1 else 1
        digit = (digit // mod) + (digit % mod)
        total += digit

    remainder = total % mod
    check_code = (mod - remainder) % mod
    expected_char = GSTIN_CHARS[check_code]

    return clean_gstin[14] == expected_char


def calculate_gstin_checksum_char(gstin_14_chars: str) -> str:
    """
    Calculates the 15th checksum character for a 14-character GSTIN prefix.
    """
    clean = gstin_14_chars.strip().upper().replace(" ", "").replace("-", "")
    factor = 1
    total = 0
    mod = 36

    for i in range(14):
        code_point = GSTIN_CHARS.index(clean[i])
        digit = factor * code_point
        factor = 2 if factor == 1 else 1
        digit = (digit // mod) + (digit % mod)
        total += digit

    remainder = total % mod
    check_code = (mod - remainder) % mod
    return GSTIN_CHARS[check_code]


# ==========================================
# 3. LUHN ALGORITHM (CREDIT / DEBIT CARDS)
# ==========================================

def validate_luhn(card_number_str: str) -> bool:
    """
    Validates 13-19 digit card numbers using the standard Luhn algorithm.
    """
    clean = "".join(filter(str.isdigit, card_number_str))
    if len(clean) < 13 or len(clean) > 19:
        return False
    digits = [int(d) for d in clean]
    checksum = 0
    reverse_digits = digits[::-1]
    for i, d in enumerate(reverse_digits):
        if i % 2 == 1:
            doubled = d * 2
            checksum += doubled - 9 if doubled > 9 else doubled
        else:
            checksum += d
    return checksum % 10 == 0
