# After Agent Reference

### After Agent Work

Keep this turn lean: collect the right result, verify the requested outcome,
update the visible plan at meaningful milestones, and present compact evidence.
Do not create routine orchestration/session logs or treat every agent task as a
reason to launch Scribe.

#### Collect by lifecycle, not by client name

- **Native `task`:** Small internal checks in the App, or specialist work on hosts without App child sessions; use the synchronous response directly, or native `agent_id` for `read_agent` after a supported background notification.
- **App child session:** Collect notifications and `send_session_message` handoffs; use `get_session` for current status, workspace, or pending plan/input gates when needed.
- **VS Code `runSubagent`:** Use the returned result; no `read_agent` is needed.

All named App missions, even short/read-only specialist work, return through their
visible coordinated children, not native task agents. Use `send_session_message`
with `assignment_id` from the kickoff and `purpose: handoff`, `needs_input`, or
`error`; return meaningful evidence, unmet requirements and integration needs.
No acknowledgment/status chatter that would not change the parent's next action.
For a mission delegated from a project, verify that the child belongs to that
same project and has its own worktree. A chat under Chats can be coordinated and
read sources without appearing in the project tree; do not report that as
successful project placement or attempt conversion by renaming.

Native `agent_id` is not App `project_session_id`. Never pass an App child session
ID to `read_agent`, or a native ID to `send_session_message`/`get_session`.
Obey the current tool schema's wait limits (at most 180 seconds where currently
exposed), not a hardcoded 300. After a background notification, collect once; if
still running or incomplete, say you are waiting and stop this turn unless
independent foreground work remains. No needless polling.

#### Verify the outcome before declaring completion

An end-of-turn or subagent hook event does not imply successful completion.
An App idle notification can mean a blocked question or pending plan, not a
finished deliverable. Do not promise precise native UI rendering from hooks.

| Status | Required evidence / next action |
|--------|---------------------------------|
| **in-progress** | Execution or required validation remains; retain the known handle and scope. |
| **blocked/needs_input** | Identify the actual blocker or user gate, not an inferred approval. Read the current App gate with `get_session` and its exact `request_id`; route it to the user when required. |
| **completed** | Verified outcome: requested deliverable plus required validation and accounted-for integration. |
| **failed** | Report the error and what was not delivered; do not mask it as completion. |
| **cancelled** | Report cancellation and any partial work; do not imply success. |

**Silent response:** Inspect only the explicit output artifacts and validation
evidence in the agent's execution workspace. Files alone are not success or
completion evidence: an edit may be partial, invalid, or outside scope.
If the required outcome is verified, report completion with the evidence and
note the missing response. Otherwise report unverified/incomplete, and obtain
the missing validation through a compatible same-task follow-up. Do not use
history/inbox changes as proof, blindly rerun the task, or duplicate running work.

Do not declare parent completion while a required subtask remains running or
incomplete. A progress handoff identifies outstanding work. For App children,
verify code and tests in their own workspaces; their commits are not automatically
integrated into the parent. Arrange authorized integration before claiming that
the parent's branch contains the change. A complete research/proposal result
does not imply implementation permission.

#### Follow-up and reviewer gates

Keep the accountable owner for the same mission unless routing or rejection
requires another owner. Reuse only same-mission context with a compatible lifecycle,
never an unrelated worker pool. Continue App specialist missions through their
existing visible child session; do not move a short follow-up to native `task`.
Native sync task agents cannot receive `write_agent` follow-ups in hosts that
reject them; a fresh native invocation of that persona with the bounded remaining
objective is appropriate only on the disclosed capability fallback.

For retained native agents, use `write_agent` only if supported for that known
agent's lifecycle. For App children use their App session ID and
`send_session_message`, with the existing assignment identifier for context about
the same assignment when required by the schema. Neither native nor App messaging
grants new authorization.

Inspect/plan work cannot silently become implementation. Never auto-approve or
bypass existing plan/input gates, and preserve exact `request_id` checks.
Enforce reviewer rejection lockout: the rejected author cannot revise or advise
on that artifact's next version. Adjacent discoveries need separate user approval
before dispatch; do not launch speculative follow-on work.

Update the current main-session visible plan for meaningful status/results,
using the optional `squad_session_plan_*` tools with conflict reconciliation as
described in the coordinator. If unavailable, explicitly maintain a visible chat
plan, without claiming native UI integration. This is not approval or a mode change.

#### Scribe — accepted durable decisions only

Spawn Scribe only when accepted durable decisions need merging. Agents having
run, ordinary result reporting, a hook event, or routine task completion is not
a trigger. Scribe does not create specialist histories, orchestration logs,
session logs, or speculative skill extraction.

Use a coordinated App child for this named mission when `create_session` is
available. On hosts without App children, use native sync for bounded work needed
now; background only with independent foreground work or a genuinely needed
retained same-task follow-up supported by the host. Adapt fields to the current
tool schema; the native envelope below is for fallback hosts, not App arguments.

```
agent_type: "general-purpose"
name: "scribe"
description: "📋 Scribe: Merge accepted durable decisions"
prompt: |
  You are the Scribe. Read .squad/agents/scribe/charter.md.
  TEAM ROOT: {team_root}
  CURRENT_DATETIME: <resolved CURRENT_DATETIME literal>
  STATE_BACKEND: {state_backend}
  Requested by: {current user name}
  AUTHORIZATION_SCOPE: authorized execution — merge accepted durable decisions only
  EXCLUSIONS: routine logs, specialist histories, source changes, git operations

  Tasks (in order):
  0. PRE-CHECK: Run `squad_state_health` when available. If state tools are unavailable,
     stop without mutating files or git state.
  0b. PRE-CHECK: Read `decisions.md` and list `decisions/inbox` with state tools.
  1. DECISION INBOX: Use `squad_state_list` and `squad_state_read` on `decisions/inbox`.
     Merge only accepted durable decisions into `decisions.md` with `squad_state_write`,
     deduplicating without dropping source evidence. Before splicing an inbox body
     beneath an `###` entry, DEMOTE its headings so its shallowest heading lands at
     `####` (`##` -> `####`). Preserve relative structure. Never emit an `##` under an `###`.
  2. VERIFY: Re-read `decisions.md` and confirm every merged entry is present before
     deleting its inbox source with `squad_state_delete`.
     On failure or uncertainty, preserve the source and report the blocker.
  3. GIT: Do not commit mutable squad state. If non-state repo files changed,
     report them for coordinator handling; do not integrate them yourself.

  Runtime state tools own persistence. Never switch branches, push note refs, reset
  `.squad/`, or commit mutable squad state from this prompt.

  Never speak to user. End with a plain text evidence summary after all tool calls.
```

If Ralph is active, apply his authorized work-check cycle after accounting for
required results. User plan/input gates, scope exclusions and reviewer lockout
still apply; monitor activity does not authorize bypassing them.
