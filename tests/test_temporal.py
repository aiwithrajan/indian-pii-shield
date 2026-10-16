import pytest
from pii_shield.temporal.activities import (
    ScanPIIInput, scan_pii_activity,
    PolicyEvaluationInput, evaluate_policy_activity,
    DispatchLLMInput, dispatch_llm_activity,
    AuditRecordInput, record_audit_activity
)
from pii_shield.temporal.service import temporal_service


@pytest.mark.anyio
async def test_scan_pii_activity():
    inp = ScanPIIInput(
        text="Rahul Sharma has Aadhaar 9999 2456 7832 and PAN ABCDE1234F",
        allowed_pii_types=[]
    )
    res = await scan_pii_activity(inp)
    assert res.has_critical_pii is True
    assert "PAN" in res.pii_counts or "NAME" in res.pii_counts
    assert "<PAN_1>" in res.redacted_text


@pytest.mark.anyio
async def test_evaluate_policy_activity():
    inp = PolicyEvaluationInput(
        pii_counts={"AADHAAR": 1, "PAN": 1},
        spans=[
            {"pii_type": "AADHAAR", "confidence": 0.70, "source": "ai_ner"}
        ],
        confidence_threshold=0.85
    )
    res = await evaluate_policy_activity(inp)
    assert res.risk_level == "CRITICAL"
    assert res.requires_quarantine is True


@pytest.mark.anyio
async def test_dispatch_and_audit_activities():
    dispatch_inp = DispatchLLMInput(
        redacted_text="Candidate <NAME_1> submitted ID <PAN_1>",
        placeholder_map={"<NAME_1>": "Rahul", "<PAN_1>": "ABCDE1234F"}
    )
    dispatch_out = await dispatch_llm_activity(dispatch_inp)
    assert dispatch_out.dispatch_latency_ms >= 0

    audit_inp = AuditRecordInput(
        pii_counts={"NAME": 1, "PAN": 1},
        latency_ms=15.0,
        masked_prompt_sample=dispatch_inp.redacted_text
    )
    audit_ok = await record_audit_activity(audit_inp)
    assert audit_ok is True


@pytest.mark.anyio
async def test_temporal_service_workflow_execution():
    rec = await temporal_service.execute_durable_workflow(
        text="Customer Rahul Sharma PAN ABCDE1234F",
        allowed_pii_types=[],
        workflow_type="DURABLE_REDACTION"
    )
    assert rec["status"] == "COMPLETED"
    assert rec["workflow_id"].startswith("wf-pii-")
    assert len(rec["activities"]) == 4
    assert all(a["status"] == "COMPLETED" for a in rec["activities"])
