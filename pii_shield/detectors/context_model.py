import re
from typing import List
from ..models import PIISpan, PIIType

# Common Indian Titles & Honorifics
HONORIFICS = r'\b(?:Shri|Smt|Dr|Mr|Mrs|Ms|Prof|Pandit|Master|Kumar|Kumari)\b\.?'
POST_HONORIFICS = r'\b(?:ji|bhai|sahab|saheb|sir|madam)\b'

# Common Indian First and Last Names
INDIAN_FIRST_NAMES = {
    "rajan", "rahul", "rohit", "amit", "vikram", "ananya", "priya", "pooja", "sneha",
    "neha", "suresh", "ramesh", "mahesh", "rajesh", "deepak", "manish", "ankit", "alok",
    "sunil", "anil", "ajay", "vijay", "sanjay", "ashok", "arun", "varun", "karan",
    "aditya", "ayush", "shivam", "abhishek", "ritesh", "vivek", "ravi", "sourabh",
    "divya", "kavita", "anjali", "swati", "megha", "richa", "arti", "rekha", "simran",
    "arjun", "harsh", "nikhil", "sid", "siddharth", "tanmay", "prateek", "tarun"
}

INDIAN_SURNAMES = {
    "mishra", "sharma", "verma", "gupta", "singh", "yadav", "patel", "shah", "kumar",
    "joshi", "iyer", "nair", "reddy", "rao", "bose", "chatterjee", "banerjee", "das",
    "pandey", "tripathi", "tiwari", "dubey", "shukla", "chaubey", "saxena", "bhat",
    "agarwal", "agrawal", "jain", "mehta", "chawla", "malhotra", "kapoor", "khanna",
    "chopra", "arora", "bhatia", "grover", "kohli", "sethi", "deshmukh", "kulkarni"
}

# Spelled out digits in Hindi/Hinglish and English
HINDI_DIGIT_WORDS = {
    "shunya", "ek", "do", "teen", "char", "paanch", "chhe", "chheh", "saat", "aath", "nau", "das"
}
ENGLISH_DIGIT_WORDS = {
    "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"
}

# Address Landmark Triggers
ADDRESS_TRIGGERS = [
    r'\b(?:ghar|house|flat|plot|room|gali|lane|road|rasta|chowk|circle|nagar|colony|enclave|vihar|pur|puri|bypass)\b',
    r'\b(?:ke paas|ke peeche|ke samne|near|behind|opposite|opp|adj|adjacent to|next to|beside)\b',
    r'\b(?:sector|block|phase|pocket|floor|building|tower|apartment|soc|society)\b',
    r'\b(?:bengaluru|bangalore|mumbai|delhi|new delhi|noida|gurugram|gurgaon|hyderabad|pune|chennai|kolkata|ahmedabad|jaipur|lucknow|patna|bhopal|indore)\b'
]


def detect_names(text: str) -> List[PIISpan]:
    """Detects Indian names with honorifics, titles, or known name combinations."""
    spans = []
    # 1. Names with leading honorifics (e.g. "Shri Rajan Mishra", "Dr. Ananya Sharma")
    pattern_hon = re.compile(rf'{HONORIFICS}\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){{1,2}})', re.IGNORECASE)
    for m in pattern_hon.finditer(text):
        spans.append(PIISpan(
            start=m.start(),
            end=m.end(),
            pii_type=PIIType.NAME,
            raw_value=m.group(0),
            confidence=0.92,
            detector_source="model",
            is_verified=True
        ))

    # 2. Names with trailing honorifics (e.g. "Sharma ji", "Rajan bhai")
    pattern_post = re.compile(rf'\b([A-Z][a-z]+)\s+{POST_HONORIFICS}\b', re.IGNORECASE)
    for m in pattern_post.finditer(text):
        spans.append(PIISpan(
            start=m.start(),
            end=m.end(),
            pii_type=PIIType.NAME,
            raw_value=m.group(0),
            confidence=0.88,
            detector_source="model",
            is_verified=True
        ))

    # 3. Known Indian first name + surname pairs
    words = list(re.finditer(r'\b[A-Za-z]+\b', text))
    for i in range(len(words) - 1):
        w1 = words[i].group(0).lower()
        w2 = words[i+1].group(0).lower()
        if (w1 in INDIAN_FIRST_NAMES and w2 in INDIAN_SURNAMES) or \
           (w1 in INDIAN_FIRST_NAMES and words[i].group(0)[0].isupper() and words[i+1].group(0)[0].isupper()):
            start = words[i].start()
            end = words[i+1].end()
            raw_val = text[start:end]
            spans.append(PIISpan(
                start=start,
                end=end,
                pii_type=PIIType.NAME,
                raw_value=raw_val,
                confidence=0.90,
                detector_source="model",
                is_verified=True
            ))

    return spans


def detect_addresses(text: str) -> List[PIISpan]:
    """Detects Indian landmark addresses and pin codes."""
    spans = []

    # Pin code pattern (6 digits)
    pattern_pincode = re.compile(r'\b[1-9][0-9]{2}\s?[0-9]{3}\b')

    # Landmark style addresses (e.g. "Sharma ji ke ghar ke paas wali gali, Indiranagar, Bangalore - 560038")
    for pattern_str in ADDRESS_TRIGGERS:
        for m in re.finditer(pattern_str, text, re.IGNORECASE):
            # Expand context window around landmark trigger
            line_start = max(0, text.rfind('\n', 0, m.start()) + 1)
            line_end = text.find('\n', m.end())
            if line_end == -1:
                line_end = len(text)

            candidate = text[line_start:line_end].strip()
            # If line contains punctuation, comma, or multiple address tokens
            if len(candidate) > 15 and ("," in candidate or "ke paas" in candidate.lower() or "near" in candidate.lower() or "road" in candidate.lower() or pattern_pincode.search(candidate)):
                start = text.find(candidate, line_start)
                end = start + len(candidate)
                spans.append(PIISpan(
                    start=start,
                    end=end,
                    pii_type=PIIType.ADDRESS,
                    raw_value=candidate,
                    confidence=0.85,
                    detector_source="model",
                    is_verified=True
                ))

    return spans


def detect_spoken_digits(text: str) -> List[PIISpan]:
    """Detects numbers spelled out in words (e.g. 'nau aath saat chheh', 'eight four two zero')."""
    spans = []
    tokens = list(re.finditer(r'\b[a-zA-Z]+\b', text))
    
    current_span_start = None
    current_span_end = None
    count = 0

    for m in tokens:
        word = m.group(0).lower()
        if word in HINDI_DIGIT_WORDS or word in ENGLISH_DIGIT_WORDS:
            if current_span_start is None:
                current_span_start = m.start()
            current_span_end = m.end()
            count += 1
        else:
            if count >= 4 and current_span_start is not None and current_span_end is not None:
                spans.append(PIISpan(
                    start=current_span_start,
                    end=current_span_end,
                    pii_type=PIIType.SPOKEN_DIGITS,
                    raw_value=text[current_span_start:current_span_end],
                    confidence=0.89,
                    detector_source="model",
                    is_verified=True
                ))
            current_span_start = None
            current_span_end = None
            count = 0

    if count >= 4 and current_span_start is not None and current_span_end is not None:
        spans.append(PIISpan(
            start=current_span_start,
            end=current_span_end,
            pii_type=PIIType.SPOKEN_DIGITS,
            raw_value=text[current_span_start:current_span_end],
            confidence=0.89,
            detector_source="model",
            is_verified=True
        ))

    return spans


def run_contextual_detector(text: str) -> List[PIISpan]:
    """Runs Layer 2 contextual detectors (names, landmark addresses, spelled digits)."""
    spans = []
    spans.extend(detect_names(text))
    spans.extend(detect_addresses(text))
    spans.extend(detect_spoken_digits(text))
    return spans
