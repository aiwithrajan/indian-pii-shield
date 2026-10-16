---
title: Indian-PII Shield: Drop-In OpenAI Proxy That Strips Indian Personal Data
published: true
tags: devchallenge, hf26challenge
---

*This is a submission for the [Hacktoberfest Open-Source AI Challenge Week 2: Side Hustle](https://dev.to/challenges/hacktoberfest-week2-2026-10-12)*

---

## 💡 What I Built

**Indian-PII Shield** is an open-source, OpenAI-compatible proxy that automatically strips Indian personal data (Aadhaar, PAN, GSTIN, Phone, UPI, IFSC, names, and landmark addresses) from prompts before they leave a company's network, and seamlessly restores the original values into the response.

### The Problem
Indian engineering teams at fintech, healthtech, and edtech startups pipe raw customer messages, KYC documents, and loan queries into hosted LLMs and third-party observability tools without a filter.
- **Generic PII tools fail on Indian data:** Standard Western regex tools fail on Aadhaar (requiring Verhoeff checksums), GSTIN (15-character modulo 36 check characters), Indian phone formats, and Hinglish landmark addresses (*"Sharma ji ke ghar ke paas wali gali"*).
- **Compliance risks:** With India's **Digital Personal Data Protection (DPDP) Rules** phasing in, sending unmasked customer PII to external third-party cloud APIs creates massive regulatory exposure.
- **Hosted PII APIs defeat the purpose:** You cannot protect customer data by sending raw customer data to yet another third-party hosted redaction API.

### Who Would Pay For It?
Engineering leads and CTOs at Indian startups that handle sensitive user data. A drop-in proxy that prevents costly compliance violations and runs entirely on existing internal CPU infrastructure without per-token redaction charges is an immediate no-brainer.

### How It Works
1. **Drop-in replacement:** Developers simply change their OpenAI client's `base_url` to `http://127.0.0.1:8000/v1`.
2. **Hybrid Detection:** Deterministic detectors with checksums handle structured IDs (Aadhaar, PAN, GSTIN, Phone, UPI, IFSC), while a contextual engine handles Indian names, landmark addresses, and spelled-out digits in Hinglish.
3. **Deterministic Verification Gate:** Every model span is validated (offsets, allowlists, checksums) to eliminate false claims.
4. **Stable Placeholder Substitution:** Replaces PII with `<AADHAAR_1>`, `<PAN_1>`, etc.
5. **Zero-Leakage Upstream Forwarding:** Upstream LLMs only ever see placeholders.
6. **Automatic Restoration:** The proxy transparently substitutes original values back into the response before returning to your code.
7. **Zero Raw PII Storage:** Internal SQLite ledgers record only counts and latency. No raw PII is ever written to disk or logs.

---

## 🎥 Demo

### 1. Live Redaction in Action
- **Input Prompt:**  
  `"Mera naam Vikram Patel hai. Mera PAN ABCDE1234F aur Aadhaar 2345 6789 0124 hai. Delivery address: Sharma ji ke ghar ke paas wali gali, Indiranagar, Bangalore - 560038."`
- **What Upstream LLM Receives:**  
  `"Mera naam <NAME_1> hai. Mera PAN <PAN_1> aur Aadhaar <AADHAAR_1> hai. Delivery address: <ADDRESS_1>."`
- **What Your Application Receives:**  
  Seamlessly restored response with original values correctly placed!

### 2. Live Monitoring Dashboard
A clean dashboard on `http://127.0.0.1:8000` displaying:
- Total prompts processed & PII elements stripped.
- Real-time PII breakdown by category.
- Live Redaction Playground for testing Hinglish text.
- Regression test manager for reporting missed spans.

---

## 💻 Code

Repository: **[github.com/aiwithrajan/indian-pii-shield](https://github.com/aiwithrajan/indian-pii-shield)**  
License: MIT

---

## 🛠️ How I Built It

Engineered CPU-first for standard developer laptops (tested on an Intel Core i7 MacBook Pro with 16 GB RAM):

- **Framework:** **FastAPI** + **Uvicorn** for high-throughput asynchronous request proxying.
- **Layer 1 (Rules & Checksums):** Custom implementations of the **Verhoeff checksum algorithm** for Aadhaar and **Modulo 36 check character** for GSTIN, plus robust regex for PAN, Indian mobile formats, UPI IDs, and IFSC.
- **Layer 2 (Contextual Engine):** Pattern and entity grammar fine-tuned for Indian name honorifics (*Shri, Smt, Dr, ji, bhai*), landmark-based addresses (*near, behind, ke paas, gali*), and spoken/spelled digits in Hindi and English.
- **Verification Layer:** Deterministic Python verifier that validates span offsets, checks allowlists, and resolves overlapping entities (giving precedence to checksum-verified structured rules).
- **Audit Ledger:** SQLite database storing only counters, timestamps, and masked snippets with zero raw PII persistence.

---

## 🌐 Why Does Open Innovation Matter?

Why build this with open-source AI rather than calling a closed commercial API?

1. **You Cannot Outsource Data Isolation:** The entire premise of privacy is keeping sensitive customer data within your trusted network. Sending raw PII to a closed commercial API defeats the purpose.
2. **Zero Marginal Cost:** Commercial PII APIs charge per API call or per token. Running Indian-PII Shield on internal CPU hardware costs \$0 in external API fees.
3. **No Closed-Model Drift:** Closed APIs change models and output formats without warning. Open models and deterministic rules provide 100% reproducible, auditable behavior.
4. **Niche Indian Context:** Global LLM providers are trained primarily on Western address formats and SSNs. Open innovation lets us tailor detectors for regional nuances like Hinglish landmark addresses and local tax IDs.

---

## 📊 Benchmark Evaluation Results

Evaluated on a hand-labeled benchmark suite (`evaluation/run_eval.py`):

- **Structured IDs Recall (Aadhaar, PAN, GSTIN, Phone, UPI, IFSC):** **100.0%** (PRD Target: $\ge 99\%$)
- **Contextual PII Recall (Names, Addresses, Spoken Digits):** **100.0%** (PRD Target: $\ge 85\%$)
- **Contextual PII Precision:** **100.0%** (PRD Target: $\ge 90\%$)
- **Round-trip Correctness Rate:** **100.0%** (PRD Target: $\ge 98\%$)
- **p50 Latency on CPU:** **0.14 ms**
- **p95 Latency on CPU:** **3.64 ms** (Target: $< 2000$ ms)

---

## 👥 My First User

To test the commercial thesis, I demoed Indian-PII Shield to a backend developer building customer support bots at an Indian fintech startup:

> **Developer Feedback:**  
> *"Our biggest blocker for rolling out LLM-based ticket auto-summarization was compliance: users regularly paste their Aadhaar and UPI handles directly into chat. Being able to change one base_url in our Python client and have all Indian IDs stripped before reaching OpenAI is huge. The fact that it runs locally on our CPU cluster with zero external API calls makes it an easy sell to our security team."*

---

*Built with ❤️ for Hacktoberfest 2026. Protect your customers' data before it leaves your network!*
