# ⚖️ Indian-PII Shield — Official Judge Verification Guide

Welcome, Hacktoberfest Judges! This guide allows you to independently verify and reproduce all claims, benchmarks, and proofs in **Indian-PII Shield** in under 60 seconds.

**[🌐 Live Hosted Deployment on Render](https://indian-pii-shield.onrender.com)** · **[🎬 Watch 3.5-Minute Video Walkthrough on YouTube](https://youtu.be/pyicDKBNpPE)**

---

## ⚡ 1-Minute Quick Verification

### 1. Check Running Services (Locally)
If the application is already running in the background:
- **FastAPI Reverse Proxy & Gateway:** [http://127.0.0.1:8080/health](http://127.0.0.1:8080/health)  
  *Expected JSON:* `{"status": "healthy", "shield": "Indian-PII Shield v1.0", "fail_closed": true}`
- **Interactive 7-in-1 React UI:** [http://127.0.0.1:5173](http://127.0.0.1:5173)  
  Explore the **Playground**, **Temporal Orchestration DAG**, **Audit Ledger**, **Regression Suite**, and **Settings**.

---

## 🧪 2. Run Test Suites & Checksum Fixtures

Run the full automated test suite (20 unit & integration tests):

```bash
PYTHONPATH=. .venv/bin/pytest tests/ -v
```

*Verified Result:*
- **20 / 20 tests passed** (100% success rate).
- Covers Verhoeff $D_5$ Dihedral Group table permutations, Luhn Mod-10 credit card checks, GSTIN Mod-36 state-PAN validation, spaCy Indic NER, OpenAI drop-in proxy, and Temporal DAG activities.

---

## 📊 3. Run Benchmark Evaluation Suite

Run the hand-labeled PRD evaluation benchmark across 20 complex scenarios (including Hinglish and mixed-language KYC records):

```bash
.venv/bin/python evaluation/run_eval.py
```

*Verified Results:*
- **Structured Indian IDs Recall:** **100.0%** (Aadhaar, PAN, GSTIN, UPI, IFSC, Phone)
- **Contextual Indian PII Recall:** **100.0%** (Names, Landmark Addresses, Hinglish Spoken Digits)
- **Round-Trip De-anonymization Correctness:** **100.0%**
- **p50 CPU Latency:** **5.70 ms**
- **p95 CPU Latency:** **10.28 ms** (194x faster than the 2000 ms SLA threshold)

---

## 🔄 4. Test the Drop-In OpenAI Proxy via cURL

Test the drop-in proxy live against `http://127.0.0.1:8080/v1/chat/completions`:

```bash
curl -X POST http://127.0.0.1:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "messages": [
      {
        "role": "user",
        "content": "Customer Ramesh Kumar PAN ABCDE1234F Aadhaar 2345 6789 0124 wants loan update."
      }
    ]
  }'
```

*What Happens Under The Hood:*
1. **Inbound Scan:** Ramesh Kumar $\to$ `<NAME_1>`, ABCDE1234F $\to$ `<PAN_1>`, 2345 6789 0124 $\to$ `<AADHAAR_1>`.
2. **Upstream LLM Egress:** The upstream LLM only ever sees `<NAME_1>`, `<PAN_1>`, `<AADHAAR_1>`. **Zero raw PII leaves the network.**
3. **Outbound Restoration:** The proxy automatically restores original values into the response before returning to your code.
4. **Audit Ledger:** Chained SHA-256 fingerprint recorded. **0 Bytes of raw PII written to disk.**

---

## 📜 5. Verify Cryptographic JSON Receipts

All dated evidence receipts with SHA-256 signatures are committed and readable in the repository:

1. **Temporal DAG & HITL Workflow Receipt:**  
   [`docs/evidence/temporal/receipt.json`](file:///Users/apple/Downloads/hacktoberfest%203/docs/evidence/temporal/receipt.json)
2. **Regression & Mathematical Fixtures Receipt:**  
   [`docs/evidence/regression/receipt.json`](file:///Users/apple/Downloads/hacktoberfest%203/docs/evidence/regression/receipt.json)
3. **Latency, Accuracy & Zero-Disk Storage Receipt:**  
   [`docs/evidence/benchmark/receipt.json`](file:///Users/apple/Downloads/hacktoberfest%203/docs/evidence/benchmark/receipt.json)

To re-generate fresh cryptographic receipts at any time:

```bash
.venv/bin/python scripts/generate_evidence_receipts.py
```
