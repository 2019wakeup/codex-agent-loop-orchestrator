from __future__ import annotations

from .models import CallbackPayload, Decision, JudgeReport, LoopContract, LoopState, LoopStatus, PolicyResult, RunStatus


class PolicyEngine:
    def evaluate_after_judge(
        self,
        contract: LoopContract,
        state: LoopState,
        judge: JudgeReport,
        callback: CallbackPayload | None = None,
    ) -> PolicyResult:
        if judge.requires_human or contract.human_gate.diff_review:
            return PolicyResult(
                decision=Decision.BLOCKED_NEEDS_USER,
                next_status=LoopStatus.REVIEW_REQUIRED,
                reason="human gate requires review",
                should_continue=False,
                should_commit=False,
            )
        if judge.rollback_recommended:
            return PolicyResult(
                decision=Decision.FAILED_NEEDS_ACTION,
                next_status=LoopStatus.FAILED,
                reason="judge recommended rollback",
                should_continue=False,
                should_commit=False,
            )
        if callback and callback.status != RunStatus.SUCCEEDED:
            return PolicyResult(
                decision=Decision.FAILED_NEEDS_ACTION,
                next_status=LoopStatus.FAILED,
                reason=f"run ended with status {callback.status}",
                should_continue=False,
                should_commit=False,
            )
        metric = None
        if callback:
            metric = callback.metrics.get(contract.target_metric)
        if metric is not None and metric >= contract.target_value and judge.verdict == "stop_success":
            return PolicyResult(
                decision=Decision.COMPLETED_VERIFY,
                next_status=LoopStatus.COMPLETED,
                reason=f"{contract.target_metric} reached {metric:.3f}",
                should_continue=False,
                should_commit=True,
            )
        if callback is not None and state.turn >= contract.iteration_limits.max_turns:
            return PolicyResult(
                decision=Decision.COMPLETED_VERIFY,
                next_status=LoopStatus.COMPLETED,
                reason="max_turns reached",
                should_continue=False,
                should_commit=True,
            )
        if callback is not None and state.no_improvement_turns >= contract.iteration_limits.patience:
            return PolicyResult(
                decision=Decision.COMPLETED_VERIFY,
                next_status=LoopStatus.COMPLETED,
                reason="patience exhausted",
                should_continue=False,
                should_commit=True,
            )
        if judge.verdict == "needs_fix":
            return PolicyResult(
                decision=Decision.CONTINUE_NOW,
                next_status=LoopStatus.READY,
                reason="judge requested a fix",
                should_continue=True,
                should_commit=False,
            )
        return PolicyResult(
            decision=Decision.OPERATIONAL_PAUSE,
            next_status=LoopStatus.TRAINING_RUNNING,
            reason="change accepted; launch external training",
            should_continue=True,
            should_commit=True,
            should_launch_training=True,
        )
