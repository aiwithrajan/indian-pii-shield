import os
import yaml
from typing import Dict, Any

DEFAULT_CONFIG_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "config.yaml")


class ShieldConfig:
    def __init__(self, config_dict: Dict[str, Any]):
        self.server = config_dict.get("server", {})
        self.policy = config_dict.get("policy", {})
        self.detectors = config_dict.get("detectors", {})
        self.thresholds = config_dict.get("thresholds", {})

        self.bind_host = self.server.get("bind_host", "127.0.0.1")
        self.bind_port = int(self.server.get("bind_port", 8000))
        self.access_token = self.server.get("access_token", "")
        self.upstream_url = self.server.get("upstream_url", "https://api.openai.com/v1")

        self.fail_closed = self.policy.get("fail_closed", True)
        self.allow_rules_fallback = self.policy.get("allow_rules_only_fallback", True)
        self.timeout_seconds = float(self.policy.get("timeout_seconds", 5.0))

    def is_detector_enabled(self, pii_type: str) -> bool:
        return self.detectors.get(pii_type.lower(), True)

    def get_threshold(self, pii_type: str) -> float:
        return self.thresholds.get(pii_type.lower(), 0.8)


def load_config(config_path: str = DEFAULT_CONFIG_PATH) -> ShieldConfig:
    if os.path.exists(config_path):
        with open(config_path, "r") as f:
            data = yaml.safe_load(f) or {}
    else:
        data = {}
    return ShieldConfig(data)
