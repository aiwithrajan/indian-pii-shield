import pytest
from fastapi.testclient import TestClient
from pii_shield.proxy import app


@pytest.fixture
def client():
    return TestClient(app)


def test_health_endpoint(client):
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "healthy"


def test_chat_completions_proxy_endpoint(client):
    payload = {
        "model": "gpt-4o",
        "messages": [
            {"role": "user", "content": "Mera PAN card ABCDE1234F hai and phone is 9876543210."}
        ]
    }
    res = client.post("/v1/chat/completions", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert data["object"] == "chat.completion"
    assert "choices" in data
    assert len(data["choices"]) > 0

    # The restored message should contain the original PAN and phone
    reply_content = data["choices"][0]["message"]["content"]
    assert "ABCDE1234F" in reply_content
    assert "9876543210" in reply_content

    # Shield metadata shows detection counts
    assert "shield_metadata" in data
    assert data["shield_metadata"]["pii_detected"] >= 2


def test_redact_preview_endpoint(client):
    res = client.post("/api/redact-preview", json={"text": "UPI payment sent to sharma.raj@okhdfcbank."})
    assert res.status_code == 200
    data = res.json()
    assert "<UPI_1>" in data["redacted_text"]
    assert data["pii_counts"].get("UPI", 0) == 1
