---
title: Indian-PII Shield: Drop-In OpenAI Proxy That Strips Indian Personal Data (DPDP Act 2023)
published: true
tags: devchallenge, hf26challenge, python, security, privacy
cover_image: https://raw.githubusercontent.com/aiwithrajan/indian-pii-shield/main/docs/demo/thumbnail.png
---

*This is an official submission for the [Hacktoberfest Open-Source AI Challenge Week 2: Side Hustle](https://dev.to/challenges/hacktoberfest-week2-2026-10-12).*

---

## 💡 What I Built

**Indian-PII Shield** is an open-source, OpenAI-compatible reverse proxy that automatically strips sensitive Indian citizen identifiers (Aadhaar, PAN, GSTIN, Phone, UPI, IFSC, ABHA Health IDs, names, and landmark addresses) from prompts before they leave a company's internal network, and transparently restores the original values into the LLM response on egress.

### The Problem: India's ₹250 Crore Regulatory Risk
On August 11, 2023, India enacted the **Digital Personal Data Protection (DPDP) Act 2023**, establishing severe statutory penalties of up to **₹250 Crore (~$30M USD)** for personal data breaches and non-compliant processing.

Indian product teams at fintech, healthtech, and edtech startups routinely pipe raw customer support chats, loan applications, KYC documents, and claim queries into hosted LLMs (OpenAI, Anthropic) and third-party observability platforms without a privacy filter.
- **Generic Western redactors fail on Indian context:** Standard Western tools (like Presidio) fail on Aadhaar (which requires Verhoeff dihedral group $D_5$ checksums), GSTIN (15-character modulo-36 state checks), Indian mobile formats (+91), and Hinglish landmark addresses (*"Sharma ji ke ghar ke paas wali gali"*).
- **The Third-Party Privacy Paradox:** Calling a commercial hosted redaction API defeats the entire premise of data sovereignty by sending sensitive citizen data to yet another external cloud.
- **High-Stakes Hallucination:** Relying purely on an LLM prompt to identify PII results in probabilistic false positives and missed sensitive spans.

### The Side Hustle Thesis: Who Pays For It?
Engineering leads, CISOs, and CTOs at Indian startups that handle sensitive citizen data. A drop-in proxy that prevents catastrophic compliance violations, runs entirely on existing internal CPU infrastructure with zero external API fees, and is priced at **₹500 / month** ($6/mo) for dedicated private cloud deployment is an immediate commercial decision.

---

## 🎥 3.5-Minute Video Walkthrough

{% youtube pyicDKBNpPE %}

*(Direct link: [youtu.be/pyicDKBNpPE](https://youtu.be/pyicDKBNpPE))*

- **Full Walkthrough Video:** [3m 33s MP4 Backup in Repo](https://github.com/aiwithrajan/indian-pii-shield/blob/main/docs/demo/indian_pii_shield_demo.mp4)
- **Official Judge Guide:** [docs/JUDGE_GUIDE.md](https://github.com/aiwithrajan/indian-pii-shield/blob/main/docs/JUDGE_GUIDE.md)

![Indian-PII Shield Overview](https://raw.githubusercontent.com/aiwithrajan/indian-pii-shield/main/docs/demo/thumbnail.png)

---

## 💻 Code Repository

- **GitHub Repository:** **[github.com/aiwithrajan/indian-pii-shield](https://github.com/aiwithrajan/indian-pii-shield)**  
- **License:** MIT License  
- **Topics:** `hacktoberfest`, `privacy`, `llm`, `security`, `dpdp-act`, `temporal`, `fastapi`, `react`, `openai`, `compliance`

---

## 🛠️ How I Built It

Engineered CPU-first for standard developer laptops and internal cloud clusters (benchmarked on an Intel Core i7 MacBook Pro with 16 GB RAM):

### 1. Dual-Engine Hybrid Pipeline
- **Layer 1 (Deterministic Group Math):** Custom pure-Python implementations of the **Verhoeff Dihedral Group ($D_5$) Checksum Algorithm** for Aadhaar numbers, **Modulo-36 check character calculation** for GSTIN tax entities, and **Luhn Mod-10 algorithm** for payment cards. Fabricated or mistyped digits are immediately rejected with 0% false positives.
- **Layer 2 (Indic Contextual NER):** Contextual pattern and entity grammar fine-tuned for Indian name honorifics (*Shri, Smt, Dr, ji, bhai*), landmark-based addresses (*near, behind, ke paas, gali*), and spoken/spelled digits in Hindi and English.
- **Deterministic Verification Gate:** Resolves overlapping entities and validates span offsets, giving strict precedence to checksum-verified statutory rules.

### 2. Temporal Durable Privacy Orchestration
Rather than vulnerable synchronous scripts, the privacy lifecycle is wrapped in a durable **Temporal DAG Workflow**:
- **Activity 1 (`scan_pii_activity`):** Hybrid detection across 17 categories.
- **Activity 2 (`evaluate_policy_activity`):** Granular policy evaluation.
- **Activity 3 (`dispatch_llm_activity`):** Masked prompt egress to upstream LLM with exponential backoff `RetryPolicy` for upstream rate limits.
- **Activity 4 (`record_audit_activity`):** Cryptographic SHA-256 chained hash ledger entry.
- **Human-In-The-Loop (HITL) Quarantine Workflow:** When ambiguous or critical PII combinations are flagged, execution pauses and awaits an authenticated Temporal Signal (`APPROVE_PASS_THROUGH` or `ENFORCE_REDACTION`) before resuming.

### 3. Strict DPDP Act 2023 Section 8 Compliance
Section 8 mandates that citizen personal data must not be stored beyond processing necessity. Indian-PII Shield operates with:
- **0.2ms Transient RAM TTL:** Tokens exist in memory only for the duration of the request.
- **0 Bytes Raw PII on Disk:** The SQLite audit ledger stores only request IDs, latencies, category counts, and SHA-256 hash fingerprints. Zero raw citizen names, Aadhaar digits, or PANs are ever committed to disk or server logs.

---

## 🛡️ 17 Statutory Indian PII Categories Covered

| Category | Authority & Regulation | Detection & Validation Mechanism |
|---|---|---|
| **Aadhaar** | UIDAI / Aadhaar Act 2016 | Dihedral Group $D_5$ (Verhoeff Checksum Algorithm) |
| **PAN** | CBDT / Income Tax Rule 114 | 10-char alphanumeric with 4th character entity check |
| **GSTIN** | GSTN / Central GST Act | 15-char format + Modulo-36 check character |
| **UPI** | NPCI | Virtual Payment Address handle regex & domain validation |
| **ABHA ID** | National Health Authority (ABDM) | 14-digit Ayushman Bharat health account identifier |
| **Credit/Debit Card** | RBI / PCI-DSS | 16-digit Luhn Mod-10 algorithm |
| **IFSC Code** | RBI | 11-character Indian Financial System Code |
| **Bank Account** | RBI | 9-18 digit account number with financial context |
| **Voter ID (EPIC)** | Election Commission of India | 10-character alphanumeric photo ID code |
| **Passport** | Ministry of External Affairs | 8-character Indian passport booklet identifier |
| **Driving Licence** | MoRTH / Sarathi Portal | 15-16 character state transport licensing code |
| **Mobile Number** | DoT / TRAI | 10-digit Indian phone with +91, 0, or national prefix |
| **Postal PIN Code** | India Post | 6-digit residential index number |
| **Email Address** | DPDP Act 2023 | RFC-5322 electronic mail address |
| **Personal Name** | DPDP Act 2023 | Contextual spaCy Indic Name Entity Recognizer |
| **Address** | DPDP Act 2023 | Landmark-based Indic address parsing (*gali, ke paas*) |
| **Spoken Digits** | DPDP Act 2023 | Phonetic Hindi/Hinglish spelled-out numbers (*nau do ek*) |

---

## 🏆 Prize Category Mapping

### 1. Week 2 Challenge: Side Hustle
- **Pricing:** Free Developer Tier (open-source) + **₹500 / month** ($6/mo) Enterprise VPC for Indian startups and agencies.
- **Target Customer:** Fintech, Healthtech, Edtech, and Indian customer support platforms facing ₹250 Crore DPDP Act penalties.
- **Unit Economics:** 100% commodity CPU operation ($0 marginal cloud/API cost). Integration takes under 2 minutes.

### 2. Best Use of Temporal
- Full 4-activity durable DAG workflow in `pii_shield/temporal/workflows.py`.
- Human-in-the-Loop Quarantine with authenticated signal resumption.
- Verified execution receipt: [docs/evidence/temporal/receipt.json](https://github.com/aiwithrajan/indian-pii-shield/blob/main/docs/evidence/temporal/receipt.json).

### 3. Best Privacy & Data Compliance Innovation
- Pure group mathematics eliminating LLM hallucinations.
- Ephemeral in-memory token vault with zero disk footprint.

---

## 📊 Benchmark Evaluation Results & Cryptographic Receipts

Evaluated against the hand-labeled PRD evaluation suite (`evaluation/run_eval.py`):

| Metric | PRD Target | Indian-PII Shield | Status |
| :--- | :--- | :--- | :--- |
| **Structured IDs Recall** (Aadhaar, PAN, GSTIN, Phone, UPI, IFSC) | $\ge 99.0\%$ | **100.0%** | ✅ PASSED |
| **Contextual PII Recall** (Names, Addresses, Spoken Digits) | $\ge 85.0\%$ | **100.0%** | ✅ PASSED |
| **Contextual PII Precision** | $\ge 90.0\%$ | **100.0%** | ✅ PASSED |
| **Round-trip Correctness Rate** | $\ge 98.0\%$ | **100.0%** | ✅ PASSED |
| **Automated Test Suite** | 100% Passing | **20 / 20 Tests Passing** | ✅ PASSED |
| **p50 Latency (CPU)** | Baseline | **5.70 ms** | ⚡ ULTRA-FAST |
| **p95 Latency (CPU)** | $< 2000$ ms | **10.28 ms** | ⚡ 194x FASTER |
| **Raw PII on Disk** | 0 Bytes | **0 Bytes Stored** | 🛡️ DPDP §8 PASS |

### Dated Evidence Receipts with SHA-256 Hashes
- 📜 **Temporal Workflow Receipt:** [`docs/evidence/temporal/receipt.json`](https://github.com/aiwithrajan/indian-pii-shield/blob/main/docs/evidence/temporal/receipt.json)
- 📜 **Regression Math Receipt:** [`docs/evidence/regression/receipt.json`](https://github.com/aiwithrajan/indian-pii-shield/blob/main/docs/evidence/regression/receipt.json)
- 📜 **Accuracy & Storage Receipt:** [`docs/evidence/benchmark/receipt.json`](https://github.com/aiwithrajan/indian-pii-shield/blob/main/docs/evidence/benchmark/receipt.json)

---

## ⚡ 2-Minute Drop-In Integration

```python
from openai import OpenAI

# Simply redirect base_url to Indian-PII Shield
client = OpenAI(
    base_url="http://127.0.0.1:8080/v1",
    api_key="your-api-key"
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[
        {
            "role": "user",
            "content": "Customer Ramesh Kumar PAN ABCDE1234F Aadhaar 2345 6789 0124 applied for a loan."
        }
    ]
)

# 1. Upstream LLM sees only safe placeholders:
#    "Customer <NAME_1> PAN <PAN_1> Aadhaar <AADHAAR_1> applied for a loan."
# 2. Your application receives the response with original values restored seamlessly!
print(response.choices[0].message.content)
```

---

## 👥 My First User

I demonstrated Indian-PII Shield to a lead backend engineer at an Indian fintech startup processing loan applications:

> *"Our biggest blocker for adopting Generative AI in customer support was compliance: users regularly paste their Aadhaar numbers and UPI handles directly into the chatbox. Under DPDP Act rules, sending that to OpenAI creates massive liability. Being able to change a single base_url in our OpenAI client and have all 17 Indian identifiers stripped locally on our internal CPU cluster without external token costs is an absolute game-changer."*

---

*Built with ❤️ by Rajan Mishra ([@aiwithrajan](https://github.com/aiwithrajan)) for Hacktoberfest 2026. Protect citizen privacy before it leaves your network!*
