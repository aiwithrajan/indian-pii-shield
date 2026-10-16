import re
from typing import Dict


def restore_text(redacted_response: str, placeholder_map: Dict[str, str]) -> str:
    """
    Restores original values into LLM response by substituting placeholders.
    Handles exact matching and tolerant whitespace variants (e.g. `< PAN_1 >`).
    """
    if not placeholder_map or not redacted_response:
        return redacted_response

    restored = redacted_response

    # Replace in order of longest placeholder first to avoid partial collision
    sorted_items = sorted(placeholder_map.items(), key=lambda item: len(item[0]), reverse=True)

    for placeholder, original_value in sorted_items:
        # 1. Exact string replacement
        restored = restored.replace(placeholder, original_value)

        # 2. Tolerant matching with optional spaces: e.g. < PAN_1 > or <PAN_1>
        inner_tag = placeholder.strip("<>")
        tolerant_pattern = re.compile(rf'<\s*{re.escape(inner_tag)}\s*>', re.IGNORECASE)
        restored = tolerant_pattern.sub(original_value, restored)

    return restored
