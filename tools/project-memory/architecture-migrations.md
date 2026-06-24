# Architecture Migrations

This file records major architecture rewrites, platform moves, framework
replacements, storage changes, service splits, routing changes, and other
changes that alter how this repository is organized.

Do not use this file for ordinary chat handoffs. Keep current chat state in
`tools/summary/` and durable reusable rules in the main instruction files,
patterns, templates, and accepted migrations.

## Entries

### 2026-06-21: Modular Agents Runtime Entrypoint

Previous architecture: root `AGENTS.md` and the copied project template carried
large inline runtime rule sets. Agents had to load broad guidance even when a
task needed only one command family or policy area.

New architecture: root and copied `AGENTS.md` files are compact entrypoints with
a routing table. Detailed reusable runtime rules live in
`patterns/AGENTS_RUNTIME/` modules by topic, and instruction-kit metadata copies
those modules alongside the entrypoint.

Reason: preserve accepted behavior while reducing startup context, making
project onboarding faster, and giving agents an explicit map for task-specific
rule retrieval.

### 2026-06-21: Coherent Batch Verification Pattern

Previous architecture: batch-completion expectations were spread across
configuration, project-memory, verification, and `gi refactor` guidance.

New architecture: `patterns/COHERENT_BATCH_VERIFICATION.md` is the reusable
module for checking source-of-truth consistency, durable project-memory
writeback, scoped diffs, and evidence-backed verification after meaningful
implementation, refactor, migration, or configuration cleanup batches.

Reason: agents need a portable completion standard that catches cross-layer
drift, stale specs, unrelated files, and ambiguous verification warnings without
turning every batch into a full-project audit.

### 2026-06-21: Architecture And Code Quality Pattern Extraction

Previous architecture: the reusable architecture and code-quality baseline lived
mostly as inline guidance in `AGENTS.md`, `templates/AGENTS.template.md`, and the
accepted code-quality migration.

New architecture: `patterns/ARCHITECTURE_AND_CODE_QUALITY.md` is the reusable
module for OOP, SOLID, DRY, clean-code, separation of concerns, interface and
adapter boundaries, abstraction discipline, and verification. The live
instructions and copied-project template keep concise baseline text and link to
the pattern.

Reason: consuming projects need a copyable, focused module for architecture and
code-quality rules instead of only receiving duplicated inline text.
