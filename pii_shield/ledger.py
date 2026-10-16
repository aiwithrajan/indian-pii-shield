import json
import os
import sqlite3
import uuid
from typing import Dict, Any, List, Optional

DB_PATH = os.environ.get("SHIELD_DB_PATH", os.path.join(os.path.dirname(os.path.dirname(__file__)), "shield_ledger.db"))


def get_db_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_ledger_db():
    conn = get_db_conn()
    cursor = conn.cursor()

    # Redaction event records (NEVER store raw PII text!)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS redaction_ledger (
        id TEXT PRIMARY KEY,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        pii_counts_json TEXT NOT NULL,
        total_pii_detected INTEGER DEFAULT 0,
        model_version TEXT DEFAULT 'rules+context_v1',
        latency_ms REAL DEFAULT 0.0,
        is_corrected INTEGER DEFAULT 0,
        masked_prompt_sample TEXT DEFAULT ''
    );
    """)

    # User corrections saved as regression tests
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS regression_tests (
        id TEXT PRIMARY KEY,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        input_text TEXT NOT NULL,
        expected_spans_json TEXT NOT NULL,
        user_note TEXT DEFAULT ''
    );
    """)

    conn.commit()
    conn.close()


def record_request_ledger(
    pii_counts: Dict[str, int],
    latency_ms: float,
    masked_prompt_sample: str = "",
    model_version: str = "rules+context_v1"
) -> str:
    """Records metadata only. NO RAW PII IS STORED."""
    conn = get_db_conn()
    cursor = conn.cursor()
    record_id = f"req_{uuid.uuid4().hex[:10]}"
    total_detected = sum(pii_counts.values())

    cursor.execute("""
        INSERT INTO redaction_ledger (
            id, pii_counts_json, total_pii_detected, model_version, latency_ms, masked_prompt_sample
        ) VALUES (?, ?, ?, ?, ?, ?);
    """, (
        record_id,
        json.dumps(pii_counts),
        total_detected,
        model_version,
        latency_ms,
        masked_prompt_sample[:160]  # Store small masked snippet only
    ))

    conn.commit()
    conn.close()
    return record_id


def get_ledger_records(limit: int = 50) -> List[Dict[str, Any]]:
    conn = get_db_conn()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, timestamp, pii_counts_json, total_pii_detected, model_version, latency_ms, is_corrected, masked_prompt_sample
        FROM redaction_ledger
        ORDER BY timestamp DESC
        LIMIT ?;
    """, (limit,))
    rows = cursor.fetchall()
    conn.close()

    results = []
    for r in rows:
        results.append({
            "id": r["id"],
            "timestamp": r["timestamp"],
            "pii_counts": json.loads(r["pii_counts_json"]),
            "total_pii_detected": r["total_pii_detected"],
            "model_version": r["model_version"],
            "latency_ms": r["latency_ms"],
            "is_corrected": bool(r["is_corrected"]),
            "masked_sample": r["masked_prompt_sample"]
        })
    return results


def get_aggregate_stats() -> Dict[str, Any]:
    conn = get_db_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) as total_requests, SUM(total_pii_detected) as total_pii, AVG(latency_ms) as avg_latency FROM redaction_ledger;")
    agg = cursor.fetchone()

    cursor.execute("SELECT pii_counts_json FROM redaction_ledger;")
    rows = cursor.fetchall()
    conn.close()

    type_counts = {}
    for r in rows:
        try:
            counts = json.loads(r["pii_counts_json"])
            for ptype, c in counts.items():
                type_counts[ptype] = type_counts.get(ptype, 0) + c
        except Exception:
            pass

    return {
        "total_requests": agg["total_requests"] or 0,
        "total_pii_stripped": agg["total_pii"] or 0,
        "avg_latency_ms": round(agg["avg_latency"] or 0.0, 2),
        "counts_by_type": type_counts
    }


def add_regression_test(input_text: str, expected_spans: List[Dict[str, Any]], user_note: str = "") -> str:
    conn = get_db_conn()
    cursor = conn.cursor()
    test_id = f"test_{uuid.uuid4().hex[:10]}"
    cursor.execute("""
        INSERT INTO regression_tests (id, input_text, expected_spans_json, user_note)
        VALUES (?, ?, ?, ?);
    """, (test_id, input_text, json.dumps(expected_spans), user_note))
    conn.commit()
    conn.close()
    return test_id


def list_regression_tests() -> List[Dict[str, Any]]:
    conn = get_db_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT id, timestamp, input_text, expected_spans_json, user_note FROM regression_tests ORDER BY timestamp DESC;")
    rows = cursor.fetchall()
    conn.close()

    results = []
    for r in rows:
        results.append({
            "id": r["id"],
            "timestamp": r["timestamp"],
            "input_text": r["input_text"],
            "expected_spans": json.loads(r["expected_spans_json"]),
            "user_note": r["user_note"]
        })
    return results
