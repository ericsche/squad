---
name: "coordinator-response-mode"
description: "Choose the smallest adequate Direct, Lightweight, Standard or Full response. Contains bounded specialist routing examples, a minimal authorized spawn template and context-upgrade rules; does not force delegation, ceremonies or a persistent session for trivial evidence."
allowedTools: []
confidence: high
domain: squad-internals
source: "Coordinator response-mode protocol; aligned with authorization, lifecycle and visible-plan rules in squad.agent.md."
---

> **Load this skill when:** choosing the smallest adequate response mode (Direct / Lightweight / Standard / Full). The stub in `squad.agent.md` is always-on; this skill expands the decision table and templates, not the user's authorization.

## Response Mode Selection

Choose Direct Mode for trivial questions with readily available evidence.
Otherwise route to exactly one accountable specialist and choose the smallest
adequate context/lifecycle. Upgrade for demonstrated complexity or risk, not
because a new agent or session is available.

| Mode | When | How |
|------|------|-----|
| **Direct** | Trivial questions, status or readily available evidence | Answer directly; a small read/status command is fine |
| **Lightweight** | Bounded edits, same-task follow-ups or substantive read-only queries | One specialist, minimum relevant context and explicit authorization |
| **Standard** | A task requiring full domain context | One accountable owner, charter and relevant shared decisions |
| **Full** | Independently deliverable outcomes with distinct owners, or concrete bounded collaboration | Explicit scopes/dependencies; reviewers only as required by policy |

These modes are not latency promises and do not force ceremonies or delegation
for trivial evidence. In the Copilot App, ALL named Squad specialist missions MUST
use visible coordinated child sessions via `create_session`, including short/read-only missions.
Native `task` is ONLY for small bounded internal checks in the App; a named specialist
mission is not an internal check merely because it is short or read-only.
An internal check runs a known test selector or checks an explicit output against
an existing requirement, without taking ownership of a new specialist deliverable.
Lightweight means a smaller prompt, not a hidden native specialist.
Scribe runs only when accepted durable decisions need merging, not after every task.
Use native sync for bounded internal checks whose result is needed now, or specialist work on fallback hosts; background only with independent foreground work or genuinely needed retained same-task follow-up supported by the host.
From an App project session, ALL named specialist missions MUST use project children
with `project_id` from the parent, `session_kind: "project"` and
`workspace_type: "worktree"`, including short/read-only missions.
A read-only prompt and mode stay read-only; project association does not authorize
implementation. Lightweight changes prompt size, not the child's project placement.

Use `session_kind: "chat"` only when explicitly requested outside the project,
and disclose placement under Chats; a chat child has no checkout.
Parent linkage and source access do not place a chat in the project tree;
renaming does not convert chat to a project session. Establish its source access
without assuming a parent checkout.
If the parent project is missing or project child creation is unsupported, report
the limitation; do not invent association, create a project without authorization
or silently substitute chat.
Commit production alone is not the criterion.

When `create_session` is unavailable, use native `task` or VS Code `runSubagent`
within authorization and workspace safety, and disclose degraded native sidebar
visibility. If creation fails, report the blocker; never silently substitute
`task` for a specialist mission. Stop if required isolation or persistence is missing.
See the spawn reference for App modes, handle namespaces and same-mission reuse limits.

Use the native `name` field for icon + specialist label + mission; derive identity
from the active specialist's charter/roster and role emoji mapping.
Keep icon and readable label stable for the same specialist.
Within 40 characters, shorten the mission first, then use a compact role label
if needed; keep the canonical specialist name explicit in the prompt and plan.
Static identity is separate from busy/idle/error states owned by the App, not a
fake avatar, color or status badge.

## Direct Mode exemplars

Coordinator answers instantly, no spawn:

- *"Where are we?"* → Summarize current state from context: branch, recent work, what the team's been doing. A user favorite — make it instant.
- *"How many tests do we have?"* → Run a quick command, answer directly.
- *"What branch are we on?"* → `git branch --show-current`, answer directly.
- *"Who's on the team?"* → Answer from `team.md` already in context.
- *"What did we decide about X?"* → Answer from `decisions.md` already in context.

## Lightweight Mode exemplars

One agent, minimal prompt:

- *"Fix the typo in README"* → One specialist with a compact identity/charter excerpt and explicit edit permission.
- *"Add a comment to line 42"* → Small scoped edit, minimal context needed.
- *"What does this short function do?"* → Direct if one readily available read suffices; substantive investigation goes to a read-only specialist.
- Follow-up edits → Same owner/persona for the same mission, using only a compatible lifecycle (not an unrelated worker pool).

## Standard Mode exemplars

One agent, full ceremony:

- *"{AgentName}, add error handling to the export function"*
- *"{AgentName}, review the prompt structure"*
- Any task requiring architectural judgment or multi-file awareness.

## Full Mode exemplars

Bounded collaboration, not automatic fan-out:

- *"Team, build the login page"* → One accountable owner unless independent outcomes require distinct owners.
- *"Add OAuth support"* → One routed owner; a required auth reviewer is a bounded gate, not another implementation owner.

## Mode upgrade rules

- If a Lightweight task turns out to need history or decisions context → treat as Standard.
- Do not turn a trivial lookup into delegation solely because tools are available.
- Increase context for evidence/risk needs; keep the same authorized scope.
- Response modes do not grant implementation permission or approval. For nontrivial
  multi-step work or explicit planning, follow the visible main-session plan protocol.

## Lightweight Spawn Template

Keep the specialist persona with a compact charter excerpt and only relevant
context; do not read unrelated histories or fan out. Use scheduling/model fields
only when supported by the host and warranted by the actual task/preference.
In the App, place the prompt below in `create_session`'s `kickoff.prompt` with
the parent's `project_id`, project/worktree child parameters and authorization-resolved mode from the spawn
reference. The native envelope fields are for fallback hosts, not App arguments.

```
agent_type: "general-purpose"
name: "{name}"
description: "{emoji} {Name}: {brief task summary}"
prompt: |
  You are {Name}, the {Role} on this project.
  YOUR CHARTER: {compact relevant charter excerpt}
  TEAM ROOT: {team_root}
  CURRENT_DATETIME: <resolved CURRENT_DATETIME literal>
  STATE_BACKEND: {state_backend}
  AUTHORIZATION_SCOPE: {inspect/read-only | propose/plan | authorized execution}
  ALLOWED_ACTIONS_AND_FILES: {explicit permissions, including git operations}
  EXCLUSIONS: {out-of-scope actions/files}
  EXPECTED_EVIDENCE: {deliverable and validation}
  SOURCE_CONTEXT: {explicit input artifacts and parent/source context; not execution paths}
  EXECUTION_WORKSPACE: {verified project child's own worktree or native workspace; no checkout only for explicitly requested outside-project chat}
  WORKTREE_PATH: {worktree_path}
  WORKTREE_MODE: {true|false}
  **Requested by:** {current user name}

  {% if WORKTREE_MODE %}
  **WORKTREE:** Use `{WORKTREE_PATH}` only if it is your execution workspace, not inherited parent identity context. Do NOT switch branches.
  {% endif %}

  TASK: {specific task description}
  TARGET FILE(S): {exact file path(s)}

  Complete only the authorized scope. Inspect/plan scopes do not authorize implementation.
  Keep it focused; report adjacent discoveries without acting on them.
  If you made a meaningful decision, persist it with `memory.write` (class: `decision`) when available, or fall back to `squad_decide` / `squad_state_write` to `decisions/inbox/{name}-{brief-slug}.md`. Do not run git notes, switch branches, or write mutable `.squad/` state by hand.

  ⚠️ OUTPUT: Report outcomes in human terms. Never expose tool internals or SQL.
  ⚠️ RESPONSE ORDER: After ALL tool calls, write a plain text summary as FINAL output.
```

For **substantive read-only queries in the App**, use a visible coordinated child
with explicit read-only authorization, even for short missions. On fallback
hosts without `create_session`, use `agent_type: "explore"` only if its
tools suffice; retain identity, datetime, team root, state backend, requester,
read-only authorization, bounded input paths and evidence requirements.
Trivial readily available evidence stays Direct. Continue App missions in the
same child; native one-shot fallback agents are not persistent sessions and may
require a fresh same-persona invocation for follow-up.
