"""
AI / NLP Named Entity Recognition (NER) & Semantic Detection Engine.
Part of Indian-PII Shield's Hybrid Architecture:
  1. Cryptographic/Deterministic Engines: Verhoeff & Luhn checksums for structured IDs
  2. AI / ML Model (spaCy Transformer / Statistical NER): For unstructured names, organizations, and locations
"""

import logging
from typing import List, Optional
from ..models import PIISpan, PIIType

logger = logging.getLogger("pii_shield.ai_detector")

_NLP_MODEL = None
_NLP_LOADED = False


def get_nlp_pipeline():
    """Lazily loads spaCy NER model, caching the pipeline instance."""
    global _NLP_MODEL, _NLP_LOADED
    if _NLP_LOADED:
        return _NLP_MODEL

    try:
        import spacy
        try:
            _NLP_MODEL = spacy.load("en_core_web_sm")
            logger.info("Loaded spaCy en_core_web_sm AI pipeline for NER detection.")
        except Exception:
            # Fallback if package is present but model not yet downloaded
            _NLP_MODEL = spacy.blank("en")
            logger.warning("en_core_web_sm model not found, using blank spaCy pipeline.")
    except ImportError:
        _NLP_MODEL = None
        logger.warning("spaCy not installed; falling back to contextual heuristics.")

    _NLP_LOADED = True
    return _NLP_MODEL


def detect_ai_entities(text: str) -> List[PIISpan]:
    """
    Executes spaCy Named Entity Recognition to detect unstructured personal identifiers.
    Identifies:
      - PERSON entities -> PIIType.NAME (Confidence: 0.95, Source: 'ai_ner')
      - GPE / LOC / FAC entities -> PIIType.ADDRESS (Confidence: 0.92, Source: 'ai_ner')
    """
    nlp = get_nlp_pipeline()
    if not nlp or not text:
        return []

    spans: List[PIISpan] = []
    try:
        doc = nlp(text)
        for ent in doc.ents:
            # Clean and filter whitespace
            val = ent.text.strip()
            if len(val) < 2:
                continue

            if ent.label_ == "PERSON":
                spans.append(PIISpan(
                    start=ent.start_char,
                    end=ent.end_char,
                    pii_type=PIIType.NAME,
                    raw_value=ent.text,
                    confidence=0.96,
                    detector_source="ai_ner",
                    is_verified=True
                ))
            elif ent.label_ in ("GPE", "LOC", "FAC"):
                # Only flag as address if meaningful or longer than 3 chars
                if len(val) >= 3:
                    spans.append(PIISpan(
                        start=ent.start_char,
                        end=ent.end_char,
                        pii_type=PIIType.ADDRESS,
                        raw_value=ent.text,
                        confidence=0.91,
                        detector_source="ai_ner",
                        is_verified=True
                    ))
    except Exception as e:
        logger.error(f"Error during AI NER entity extraction: {e}")

    return spans
