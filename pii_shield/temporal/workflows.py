"""
Temporal Workflows for Indian-PII Shield.
Implements:
  1. DurableRedactionWorkflow: Automated, fault-tolerant end-to-end PII masking & LLM dispatch.
  2. HumanInTheLoopQuarantineWorkflow: Pauses execution on high-risk/ambiguous entities,
     awaiting Temporal Signals from security administrators before resuming.
"""

from datetime import timedelta
from typing import List, Dict, Any, Optional
from temporalio import workflow
from temporalio.common import RetryPolicy

with workflow.unsafe.imports_passed_through():
    from .activities import (
        ScanPIIInput, ScanPIIOutput, scan_pii_activity,
        PolicyEvaluationInput, PolicyEvaluationOutput, evaluate_policy_activity,
        DispatchLLMInput, DispatchLLMOutput, dispatch_llm_activity,
        AuditRecordInput, record_audit_activity
    )


@workflow.defn
class DurableRedactionWorkflow:
    """
    Standard durable execution workflow.
    Guarantees completion across network dropouts, rate limits, and server reboots.
    """

    def __init__(self) -> None:
        self._current_step: str = "INITIALIZED"
        self._scan_output: Optional[ScanPIIOutput] = None
        self._dispatch_output: Optional[DispatchLLMOutput] = None

    @workflow.query
    def get_step(self) -> str:
        return self._current_step

    @workflow.run
    async def run(self, text: str, allowed_pii_types: List[str], model: str = "gpt-4o") -> Dict[str, Any]:
        retry_policy = RetryPolicy(
            initial_interval=timedelta(milliseconds=500),
            backoff_coefficient=2.0,
            maximum_interval=timedelta(seconds=10),
            maximum_attempts=4
        )

        # Step 1: Scan & Redact
        self._current_step = "SCANNING_PII"
        scan_res: ScanPIIOutput = await workflow.execute_activity(
            scan_pii_activity,
            ScanPIIInput(text=text, allowed_pii_types=allowed_pii_types),
            start_to_close_timeout=timedelta(seconds=15),
            retry_policy=retry_policy
        )
        self._scan_output = scan_res

        # Step 2: Policy Risk Check
        self._current_step = "EVALUATING_POLICY"
        policy_res: PolicyEvaluationOutput = await workflow.execute_activity(
            evaluate_policy_activity,
            PolicyEvaluationInput(pii_counts=scan_res.pii_counts, spans=scan_res.spans),
            start_to_close_timeout=timedelta(seconds=10),
            retry_policy=retry_policy
        )

        # Step 3: Upstream LLM Dispatch (With automatic retries for rate limits)
        self._current_step = "DISPATCHING_UPSTREAM_LLM"
        dispatch_res: DispatchLLMOutput = await workflow.execute_activity(
            dispatch_llm_activity,
            DispatchLLMInput(
                redacted_text=scan_res.redacted_text,
                placeholder_map=scan_res.placeholder_map,
                model=model
            ),
            start_to_close_timeout=timedelta(seconds=20),
            retry_policy=retry_policy
        )
        self._dispatch_output = dispatch_res

        # Step 4: Immutable Audit Record
        self._current_step = "RECORDING_AUDIT_LEDGER"
        await workflow.execute_activity(
            record_audit_activity,
            AuditRecordInput(
                pii_counts=scan_res.pii_counts,
                latency_ms=scan_res.latency_ms + dispatch_res.dispatch_latency_ms,
                masked_prompt_sample=scan_res.redacted_text[:120]
            ),
            start_to_close_timeout=timedelta(seconds=10),
            retry_policy=retry_policy
        )

        self._current_step = "COMPLETED"

        return {
            "status": "COMPLETED",
            "original_text": scan_res.original_text,
            "redacted_text": scan_res.redacted_text,
            "final_response": dispatch_res.final_response_restored,
            "upstream_response_raw": dispatch_res.upstream_response_raw,
            "pii_counts": scan_res.pii_counts,
            "spans": scan_res.spans,
            "risk_level": policy_res.risk_level,
            "total_latency_ms": round(scan_res.latency_ms + dispatch_res.dispatch_latency_ms, 2),
            "simulated": dispatch_res.simulated
        }


@workflow.defn
class HumanInTheLoopQuarantineWorkflow:
    """
    Human-in-the-Loop Quarantine Workflow.
    Pauses execution when sensitive or ambiguous PII is detected.
    Awaits Temporal Signals from an admin or security analyst to proceed.
    """

    def __init__(self) -> None:
        self._status: str = "INITIALIZED"
        self._decision: Optional[str] = None  # 'APPROVE_PASS_THROUGH' or 'ENFORCE_REDACTION'
        self._quarantined_items: List[Dict[str, Any]] = []
        self._scan_output: Optional[ScanPIIOutput] = None

    @workflow.query
    def get_quarantine_state(self) -> Dict[str, Any]:
        return {
            "status": self._status,
            "decision": self._decision,
            "quarantined_items": self._quarantined_items,
            "has_scanned": self._scan_output is not None
        }

    @workflow.signal
    def governance_decision(self, decision: str) -> None:
        """Signal received from UI or Security Officer."""
        self._decision = decision

    @workflow.run
    async def run(self, text: str, allowed_pii_types: List[str], model: str = "gpt-4o") -> Dict[str, Any]:
        retry_policy = RetryPolicy(maximum_attempts=3)

        # 1. Scan
        self._status = "SCANNING"
        scan_res: ScanPIIOutput = await workflow.execute_activity(
            scan_pii_activity,
            ScanPIIInput(text=text, allowed_pii_types=allowed_pii_types),
            start_to_close_timeout=timedelta(seconds=15),
            retry_policy=retry_policy
        )
        self._scan_output = scan_res

        # 2. Evaluate Policy
        self._status = "EVALUATING"
        policy_res: PolicyEvaluationOutput = await workflow.execute_activity(
            evaluate_policy_activity,
            PolicyEvaluationInput(pii_counts=scan_res.pii_counts, spans=scan_res.spans),
            start_to_close_timeout=timedelta(seconds=10),
            retry_policy=retry_policy
        )

        self._quarantined_items = policy_res.quarantined_entities

        # 3. If quarantine required, PAUSE WORKFLOW and await human signal
        if policy_res.requires_quarantine:
            self._status = "QUARANTINED"
            # Wait up to 10 minutes for human signal
            await workflow.wait_condition(
                lambda: self._decision is not None,
                timeout=timedelta(minutes=10)
            )

        # 4. Apply decision
        effective_allowed = list(allowed_pii_types)
        if self._decision == "APPROVE_PASS_THROUGH":
            # Add quarantined types to allowed
            for item in self._quarantined_items:
                effective_allowed.append(item["pii_type"])
            # Re-scan with new allowed list
            scan_res = await workflow.execute_activity(
                scan_pii_activity,
                ScanPIIInput(text=text, allowed_pii_types=effective_allowed),
                start_to_close_timeout=timedelta(seconds=15),
                retry_policy=retry_policy
            )

        # 5. Dispatch to LLM
        self._status = "DISPATCHING_LLM"
        dispatch_res: DispatchLLMOutput = await workflow.execute_activity(
            dispatch_llm_activity,
            DispatchLLMInput(
                redacted_text=scan_res.redacted_text,
                placeholder_map=scan_res.placeholder_map,
                model=model
            ),
            start_to_close_timeout=timedelta(seconds=20),
            retry_policy=retry_policy
        )

        # 6. Record Audit
        self._status = "AUDITING"
        await workflow.execute_activity(
            record_audit_activity,
            AuditRecordInput(
                pii_counts=scan_res.pii_counts,
                latency_ms=scan_res.latency_ms + dispatch_res.dispatch_latency_ms,
                masked_prompt_sample=scan_res.redacted_text[:120]
            ),
            start_to_close_timeout=timedelta(seconds=10),
            retry_policy=retry_policy
        )

        self._status = "COMPLETED"

        return {
            "status": "COMPLETED",
            "governance_decision": self._decision or "AUTO_APPROVED",
            "original_text": scan_res.original_text,
            "redacted_text": scan_res.redacted_text,
            "final_response": dispatch_res.final_response_restored,
            "pii_counts": scan_res.pii_counts,
            "spans": scan_res.spans,
            "risk_level": policy_res.risk_level,
            "quarantined_count": len(self._quarantined_items)
        }
