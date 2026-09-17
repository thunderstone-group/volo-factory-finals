---
name: interface-contract
description: Resolve interface names, container scope, and entry points from requirements.
---

# Interface contract

Use when an action is ambiguous, unreachable, or named inconsistently. Distinguish
the requirement's wording and behavior from observed UI behavior and an evaluator's
assumptions. An unspecified exact label, role, or container is an open contract
question, not permission to invent a hidden acceptance rule.

Trace each affected action from its visible entry to its owning entity and editor.
Reuse requirement-derived names across visible labels and accessible names. Keep
row actions and contextual content inside the relevant row/editor scope. Reuse
the supplied interaction helpers when present; inspect their actual call contract.
For example, pass the same requirement-derived action name to both its button and
its editor entry. Choose inline or modal presentation from the requested workflow;
neither presentation is universally required.

Evidence and limits: local interface diagnostics motivated these checks. They do
not establish universal evaluator conventions or cross-application effectiveness.
Use only the caller's requirement-derived observations and selected source. Missing
requirements remain uncertain; a proposal does not prove discoverability or usability.
