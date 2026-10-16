# 🛡️ Indian-PII Shield

> **OpenAI-compatible zero-leakage privacy proxy that strips Indian personal data (Aadhaar, PAN, GSTIN, Phone, UPI, IFSC, Hinglish names & landmark addresses) before prompts leave your network, and restores them in the response.**  
> *Built for the [DEV / Hacktoberfest Open-Source AI Challenge — Week 2: Side Hustle](https://dev.to/challenges/hacktoberfest-week2-2026-10-12).*

**[🎬 Watch on YouTube (3.5-Min Walkthrough)](https://youtu.be/pyicDKBNpPE)** · **[⚖️ Judge Verification Guide](docs/JUDGE_GUIDE.md)** · **[🏆 Prize Category Mapping](docs/PRIZE_CATEGORIES.md)** · **[📜 Cryptographic Receipts](docs/evidence/)** · **[📊 Benchmarks](docs/evidence/benchmark/receipt.json)**

---

## 💡 The Problem: Indian PII Leaking into Hosted LLMs

Indian product teams at fintech, healthtech, and edtech startups pipe raw customer messages, KYC documents, loan chats, and claim queries into hosted LLMs (OpenAI, Anthropic, etc.) and third-party observability tools without a filter.

### What goes wrong today:
- **General-purpose PII tools fail on Indian context:** Generic redactors miss Aadhaar (requiring Verhoeff checksum validation), GSTIN check characters, Indian phone formats, UPI IDs, and Hinglish landmark addresses (*"Sharma ji ke ghar ke paas wali gali"*).
- **Compliance exposure:** With India's **Digital Personal Data Protection (DPDP) Rules** phasing in, sending un-redacted customer PII to external third-party cloud APIs poses significant regulatory and reputational risk.
- **Hosted PII APIs leak the very data they claim to protect:** Sending raw customer PII to a hosted cloud redaction service violates the core principle of data isolation.

### The Solution: Drop-In Local Proxy
**Indian-PII Shield** sits inside your network as a drop-in proxy. It redacts sensitive data using a hybrid deterministic + contextual pipeline on CPU, sends only placeholders (like `<PAN_1>`, `<AADHAAR_1>`) to the upstream LLM, and restores the original values back into the response before returning it to your application.

```python
from openai import OpenAI

# Simply point base_url to Indian-PII Shield
client = OpenAI(
    base_url="http://127.0.0.1:8000/v1",
    api_key="your-api-key"
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Mera PAN card ABCDE1234F hai and phone 9876543210."}]
)

# Upstream LLM sees: "Mera PAN card <PAN_1> hai and phone <PHONE_1>."
# Your code receives: Original PAN and Phone seamlessly restored!
```

---

## 🏛️ Technical Architecture

```mermaid
flowchart LR
    subgraph Local ["Company Internal Network (CPU-First)"]
        APP["Client App / Backend"]
        PROXY["Indian-PII Shield Proxy<br/>(127.0.0.1:8000)"]
        RULES["Layer 1: Rules & Checksums<br/>(Aadhaar Verhoeff, GSTIN, PAN, Phone, UPI)"]
        MODEL["Layer 2: Contextual Engine<br/>(Names, Addresses, Hinglish, Spoken Digits)"]
        VERIF["Deterministic Verifier<br/>(Bounds, Checksums, No Fabrication)"]
        MAP[("In-Memory Mapping<br/>(<PAN_1> -> ABCDE1234F)")]
        LEDGER[("SQLite Ledger<br/>(Counters only, NO raw PII)")]
    end

    subgraph Cloud ["External Cloud"]
        LLM["Upstream LLM<br/>(OpenAI / Any Compatible)"]
    end

    APP -->|1. Raw Prompt| PROXY
    PROXY --> RULES & MODEL
    RULES & MODEL --> VERIF
    VERIF -->|2. Verified Spans| MAP
    PROXY -->|3. Redacted Prompt (<PAN_1>)| LLM
    LLM -->|4. Response with Placeholders| PROXY
    PROXY -->|5. Restore Placeholders| MAP
    PROXY -->|6. Restored Response| APP
    PROXY -.->|Log Counts & Latency| LEDGER
```

---

## 📊 Benchmark & Evaluation Results (PRD Section 3 & 11)

Evaluated on the hand-labeled benchmark suite (`evaluation/run_eval.py`) on an Intel Core i7 MacBook Pro (CPU-first):

| Metric | PRD Target | Indian-PII Shield | Status |
| :--- | :--- | :--- | :--- |
| **Structured IDs Recall** (Aadhaar, PAN, GSTIN, Phone, UPI, IFSC) | $\ge 99.0\%$ | **100.0%** | ✅ PASSED |
| **Contextual PII Recall** (Names, Addresses, Spoken Digits) | $\ge 85.0\%$ | **100.0%** | ✅ PASSED |
| **Contextual PII Precision** | $\ge 90.0\%$ | **100.0%** | ✅ PASSED |
| **Round-trip Correctness Rate** | $\ge 98.0\%$ | **100.0%** | ✅ PASSED |
| **Verifier Integrity** | 100% valid spans | **100.0%** (0 invalid/out-of-bounds spans) | ✅ PASSED |
| **p50 Latency (CPU)** | Baseline | **0.14 ms** | ⚡ ULTRA-FAST |
| **p95 Latency (CPU)** | $< 2000$ ms | **3.64 ms** | ⚡ ULTRA-FAST |

### Comparison: Variant A (Rules Only) vs Variant D (Full Pipeline)

| Entity Type | Variant A (Rules Only) Recall | Variant D (Full Pipeline) Recall | Variant D F1-Score |
| :--- | :--- | :--- | :--- |
| **AADHAAR** (Verhoeff) | 100.0% | **100.0%** | **100.0%** |
| **PAN** | 100.0% | **100.0%** | **100.0%** |
| **GSTIN** (Modulo 36) | 100.0% | **100.0%** | **100.0%** |
| **PHONE** | 100.0% | **100.0%** | **100.0%** |
| **UPI** | 100.0% | **100.0%** | **80.0%** |
| **IFSC** | 100.0% | **100.0%** | **100.0%** |
| **NAME** (Honorifics & pairs) | 0.0% | **100.0%** | **100.0%** |
| **ADDRESS** (Landmarks & Hinglish) | 0.0% | **100.0%** | **100.0%** |
| **SPOKEN_DIGITS** (Hinglish words) | 0.0% | **100.0%** | **100.0%** |

---

## 🔒 Security & Privacy Guarantees

1. **Zero Raw PII on Disk:** The SQLite ledger and server logs record only entity types, counts, and latency. The in-memory placeholder map is wiped when the request cycle completes.
2. **Fail-Closed by Default:** If detection fails, the request is blocked with HTTP 500 rather than leaking unredacted data upstream.
3. **Loopback Bound:** By default binds strictly to `127.0.0.1`. Non-loopback bindings require an explicit `access_token` in `config.yaml`.

---

## 🚀 Quickstart & Setup

### 1. Install & Activate Virtual Environment
```bash
git clone https://github.com/aiwithrajan/indian-pii-shield.git
cd indian-pii-shield

python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Configure Upstream (Optional)
Edit `config.yaml`:
```yaml
server:
  bind_host: "127.0.0.1"
  bind_port: 8000
  upstream_url: "https://api.openai.com/v1" # Target OpenAI or local LLM
policy:
  fail_closed: true
```

### 3. Start the Shield Proxy & Dashboard
```bash
python3 -m uvicorn pii_shield.proxy:app --host 127.0.0.1 --port 8000
```
Open **[http://127.0.0.1:8000](http://127.0.0.1:8000)** in your browser to view the interactive Live Redaction Playground, audit stats, and regression test manager.

### 4. Run the Full Test & Evaluation Suite
```bash
# Run all 14 unit and security tests
PYTHONPATH=. pytest tests/ -v

# Run the 20-scenario benchmark evaluation
PYTHONPATH=. python3 evaluation/run_eval.py
```

---

## 📄 License
MIT License. Built for Hacktoberfest 2026.
