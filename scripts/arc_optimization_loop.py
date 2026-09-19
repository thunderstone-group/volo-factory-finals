#!/usr/bin/env python3
"""Decide whether a measured ARC round earns the next optimization round.

The input is sanitized round evidence, never a live platform response. The
controller deliberately prefers a lower noisy sample that does not regress and
requires two independent samples before it can keep a change.
"""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Mapping


TASKS = ("keep", "bookstack", "stackoverflow", "prestashop", "12306", "ctrip")
DEFAULT_TARGETS = ("12306", "ctrip")
DELIVERY_FAILURES = {
    "delivery_failed",
    "generation_failed",
    "protocol_failed",
    "transport_failed",
}
TASK_PRIORITY = {
    "12306": 1.35,
    "ctrip": 1.35,
    "prestashop": 1.15,
    "stackoverflow": 1.05,
    "bookstack": 1.0,
    "keep": 0.95,
}


def canonical_task(name: str) -> str:
    """Map platform display names such as ``arc-bench-web--12306`` to a task."""
    value = str(name).strip().lower().replace("_", "-")
    for task in TASKS:
        if value == task or value.endswith("--" + task) or value.endswith("-" + task):
            return task
    raise ValueError(f"unknown ARC task: {name!r}")


@dataclass(frozen=True)
class TaskScore:
    task: str
    passed: int
    total: int
    delivered: bool = True
    status: str = "completed"
    failures: Mapping[str, int] = field(default_factory=dict)

    @classmethod
    def from_json(cls, name: str, value: Mapping[str, Any]) -> "TaskScore":
        task = canonical_task(name)
        passed = value.get("passed")
        total = value.get("total")
        if not isinstance(passed, int) or isinstance(passed, bool):
            raise ValueError(f"{task}: passed must be an integer")
        if not isinstance(total, int) or isinstance(total, bool) or total <= 0:
            raise ValueError(f"{task}: total must be a positive integer")
        if passed < 0 or passed > total:
            raise ValueError(f"{task}: passed must be between 0 and total")
        status = str(value.get("status", "completed"))
        delivered = value.get("delivered", value.get("delivery_ok", status not in DELIVERY_FAILURES))
        if not isinstance(delivered, bool):
            raise ValueError(f"{task}: delivered must be boolean")
        failures = value.get("failures", value.get("failure_families", {}))
        if not isinstance(failures, Mapping):
            raise ValueError(f"{task}: failures must be an object")
        normalized = {}
        for family, count in failures.items():
            if not isinstance(count, int) or isinstance(count, bool) or count < 0:
                raise ValueError(f"{task}: failure count for {family!r} must be non-negative integer")
            if count:
                normalized[str(family)] = count
        return cls(task, passed, total, delivered, status, normalized)

    @property
    def rate(self) -> float:
        return self.passed / self.total

    @property
    def delivery_failure(self) -> bool:
        return not self.delivered or self.status in DELIVERY_FAILURES


@dataclass(frozen=True)
class Sample:
    sample_id: str
    tasks: Mapping[str, TaskScore]

    @classmethod
    def from_json(cls, value: Mapping[str, Any]) -> "Sample":
        sample_id = str(value.get("id", value.get("sample_id", ""))).strip()
        if not sample_id:
            raise ValueError("sample id is required")
        raw_tasks = value.get("tasks")
        if not isinstance(raw_tasks, Mapping):
            raise ValueError(f"sample {sample_id}: tasks must be an object")
        tasks = {}
        for name, score in raw_tasks.items():
            if not isinstance(score, Mapping):
                raise ValueError(f"sample {sample_id}: task {name!r} must be an object")
            task = TaskScore.from_json(str(name), score)
            if task.task in tasks:
                raise ValueError(f"sample {sample_id}: duplicate task {task.task}")
            tasks[task.task] = task
        if set(tasks) != set(TASKS):
            missing = sorted(set(TASKS) - set(tasks))
            extra = sorted(set(tasks) - set(TASKS))
            raise ValueError(f"sample {sample_id}: tasks must contain all six tasks; missing={missing}, extra={extra}")
        return cls(sample_id, tasks)

    @property
    def equal_rate(self) -> float:
        return sum(score.rate for score in self.tasks.values()) / len(TASKS)

    @property
    def pooled_rate(self) -> float:
        passed = sum(score.passed for score in self.tasks.values())
        total = sum(score.total for score in self.tasks.values())
        return passed / total

    @property
    def delivery_failures(self) -> list[str]:
        return [task for task, score in self.tasks.items() if score.delivery_failure]


@dataclass(frozen=True)
class Round:
    round_id: str
    change_id: str
    samples: tuple[Sample, ...]
    local_gate_passed: bool
    local_gate_problems: tuple[str, ...] = ()

    @classmethod
    def from_json(cls, value: Mapping[str, Any]) -> "Round":
        round_id = str(value.get("round_id", value.get("id", ""))).strip()
        change_id = str(value.get("change_id", "")).strip()
        if not round_id or not change_id:
            raise ValueError("round_id and change_id are required")
        raw_samples = value.get("samples")
        if not isinstance(raw_samples, list):
            raise ValueError(f"round {round_id}: samples must be an array")
        samples = tuple(Sample.from_json(item) for item in raw_samples)
        gate = value.get("local_gate", {})
        if isinstance(gate, bool):
            gate_passed, gate_problems = gate, ()
        elif isinstance(gate, Mapping):
            gate_passed = gate.get("passed", False)
            raw_problems = gate.get("problems", [])
            gate_problems = tuple(str(problem) for problem in raw_problems)
        else:
            raise ValueError(f"round {round_id}: local_gate must be an object or boolean")
        if not isinstance(gate_passed, bool):
            raise ValueError(f"round {round_id}: local_gate.passed must be boolean")
        return cls(round_id, change_id, samples, gate_passed, gate_problems)


def _task_means(round_data: Round) -> dict[str, float]:
    if not round_data.samples:
        return {task: 0.0 for task in TASKS}
    return {
        task: sum(sample.tasks[task].rate for sample in round_data.samples) / len(round_data.samples)
        for task in TASKS
    }


def _failure_totals(round_data: Round) -> dict[tuple[str, str], int]:
    totals: dict[tuple[str, str], int] = {}
    for sample in round_data.samples:
        for task, score in sample.tasks.items():
            for family, count in score.failures.items():
                totals[(task, family)] = totals.get((task, family), 0) + count
    return totals


def _round_metrics(round_data: Round) -> dict[str, Any]:
    means = _task_means(round_data)
    return {
        "task_equal_mean": round(sum(means.values()) / len(TASKS), 4),
        "pooled_mean": round(sum(sample.pooled_rate for sample in round_data.samples) / len(round_data.samples), 4)
        if round_data.samples else 0.0,
        "lower_sample_equal_rate": round(min((sample.equal_rate for sample in round_data.samples), default=0.0), 4),
        "task_means": {task: round(means[task], 4) for task in TASKS},
        "delivery_failures": sorted({task for sample in round_data.samples for task in sample.delivery_failures}),
        "failure_families": [
            {"task": task, "family": family, "count": count}
            for (task, family), count in sorted(_failure_totals(round_data).items(), key=lambda item: (-item[1], item[0]))
        ],
    }


def choose_next_action(round_data: Round) -> dict[str, Any] | None:
    """Pick exactly one high-leverage failure family for the next round."""
    families = _failure_totals(round_data)
    if not families:
        return None
    (task, family), count = max(
        families.items(),
        key=lambda item: (item[1] * TASK_PRIORITY[item[0][0]], item[1], item[0]),
    )
    return {
        "task": task,
        "family": family,
        "observed_failures": count,
        "rule": "change one carrier or gate for this family, then rerun local replay before platform evaluation",
    }


def evaluate_round(
    baseline: Round,
    candidate: Round,
    *,
    target_tasks: tuple[str, ...] = DEFAULT_TARGETS,
    required_samples: int = 2,
    target_gain: float = 0.03,
    allowed_regression: float = 0.03,
    allowed_lower_sample_drop: float = 0.02,
) -> dict[str, Any]:
    """Return a keep/reject decision with reasons and the next single action."""
    reasons: list[str] = []
    if candidate.change_id == baseline.change_id:
        reasons.append("candidate change_id must differ from the baseline")
    if not candidate.local_gate_passed:
        reasons.append("local gate did not pass")
        reasons.extend(candidate.local_gate_problems[:3])
    if len(candidate.samples) < required_samples:
        reasons.append(f"candidate has {len(candidate.samples)} sample(s); {required_samples} are required")
    if len(baseline.samples) < required_samples:
        reasons.append(f"baseline has {len(baseline.samples)} sample(s); {required_samples} are required")
    candidate_metrics = _round_metrics(candidate)
    baseline_metrics = _round_metrics(baseline)
    candidate_delivery = candidate_metrics["delivery_failures"]
    if candidate_delivery:
        reasons.append("candidate has delivery/protocol failures: " + ", ".join(candidate_delivery))

    baseline_means = baseline_metrics["task_means"]
    candidate_means = candidate_metrics["task_means"]
    deltas = {task: round(candidate_means[task] - baseline_means[task], 4) for task in TASKS}
    target_gain_value = sum(deltas[task] for task in target_tasks) / len(target_tasks)
    regressions = {
        task: delta for task, delta in deltas.items()
        if task not in target_tasks and delta < -allowed_regression
    }
    if regressions:
        reasons.append("non-target task regression exceeds guard: " + ", ".join(
            f"{task} {delta:+.1%}" for task, delta in regressions.items()))
    lower_drop = candidate_metrics["lower_sample_equal_rate"] - baseline_metrics["lower_sample_equal_rate"]
    if lower_drop < -allowed_lower_sample_drop:
        reasons.append(f"candidate lower sample dropped {abs(lower_drop):.1%}, beyond variance guard")
    if target_gain_value < target_gain:
        reasons.append(f"target task gain {target_gain_value:+.1%} is below {target_gain:.1%}")

    decision = "keep" if not reasons else "reject"
    next_source = candidate if _failure_totals(candidate) else baseline
    return {
        "decision": decision,
        "baseline": {"round_id": baseline.round_id, **baseline_metrics},
        "candidate": {"round_id": candidate.round_id, **candidate_metrics},
        "task_deltas": deltas,
        "target_tasks": list(target_tasks),
        "target_gain": round(target_gain_value, 4),
        "non_target_regressions": regressions,
        "reasons": reasons,
        "next_action": choose_next_action(next_source),
    }


def _load(path: Path) -> Round:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, Mapping):
        raise ValueError(f"{path}: top-level JSON must be an object")
    return Round.from_json(value)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("baseline", type=Path)
    parser.add_argument("candidate", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args(argv)
    result = evaluate_round(_load(args.baseline), _load(args.candidate))
    rendered = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        args.output.write_text(rendered, encoding="utf-8")
    print(rendered, end="")
    return 0 if result["decision"] == "keep" else 2


if __name__ == "__main__":
    raise SystemExit(main())
