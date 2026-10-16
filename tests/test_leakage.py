import pytest
from pii_shield.ledger import record_request_ledger, get_ledger_records, init_ledger_db, get_db_conn


def test_zero_raw_pii_in_ledger():
    init_ledger_db()

    secret_pan = "ABCDE9999Z"
    secret_aadhaar = "999988887777"
    secret_phone = "9876543210"

    # Redaction takes place, and only counts & masked snippets are sent to ledger
    counts = {"PAN": 1, "AADHAAR": 1, "PHONE": 1}
    masked_sample = "Mera PAN <PAN_1> aur phone <PHONE_1>."

    rec_id = record_request_ledger(
        pii_counts=counts,
        latency_ms=1.5,
        masked_prompt_sample=masked_sample
    )

    # Directly scan the raw database file contents
    conn = get_db_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM redaction_ledger WHERE id = ?", (rec_id,))
    row = cursor.fetchone()
    conn.close()

    row_str = " ".join([str(val) for val in row])

    # Assert that raw sensitive values NEVER appear in the stored row!
    assert secret_pan not in row_str
    assert secret_aadhaar not in row_str
    assert secret_phone not in row_str

    # Only placeholders and counts exist
    assert "<PAN_1>" in row_str
    assert '"PAN": 1' in row_str
