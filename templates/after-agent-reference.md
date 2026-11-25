# After Agent Reference

### After Agent Work

Keep this turn lean: collect the right result, verify the requested outcome,
update the visible plan at meaningful milestones, and present compact evidence.
Do not create routine orchestration/session logs or treat every agent task as a
reason to launch Scribe.

#### Collect by lifecycle, not by client name

- **Native `task`:** Small internal checks or a specific higher-priority runtime-required reviewer in the App, or specialist work on hosts without App child sessions; use the synchronous response directly, or native `agent_id` for `read_agent` after a supported background notification.
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

After a runtime-required reviewer returns, preserve its report and attribution,
including original severity/confidence/evidence and required host formatting or
user decisions. That native result is not an App child or a completed
restitution mission. Bounded App restitution is part of every substantive
security review, even with zero findings or a read-only request; do not wait
for a separate follow-up request. A host-required findings table or follow-up
question does not end the mission; create or reuse the owner with the report,
named as a synthesis, in the question's tool batch, never after its answer;
requested follow-up that needs only the report, such as dependency updates,
is dispatched in that same batch. Continue through one actual suitable App
owner using the existing report to explain scope, coverage, limitations and
result; do not rerun the audit or create a shell child for appearance.
After the report, reconcile the current-request SQL tasks and readable plan
published before the review with actual tool discovery/calls, including a
zero-finding outcome. Read-only
repository constraints do not forbid mission metadata. Keep native completion
separate from restitution in progress until verified handoff, and link only
the real session. Do not invent a required remediation/decision task or treat
zero findings as exhaustive coverage or security certification.
Missing access/capability or
ownership is a disclosed limitation, not permission to invent a security expert,
agent handle or URL. Follow the coordinator's required-review composition;
the general scope, user-input and no-nested-mission gates still apply.

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

When the user's whole request is done and every App child's mission in it is
verified completed and integrated (or read-only), archive those children with
`archive_session` in the same batch as the final plan update, following the
coordinator's sub-session Lifecycle rule; keep finished children until then for
same-mission follow-ups. Never archive a child that is busy, awaiting input,
holds unintegrated work, an open pull request or a session automation, or may
still receive a same-mission follow-up.

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

For App `send_session_message` follow-ups, omit `mode` to preserve the current
Autopilot or other user-selected mode. Never change session mode automatically
in a follow-up; only an explicit user decision authorizes a change, not parent
mode, delegation or task duration. A pending plan/input gate is not resolved
by selecting Autopilot. Assignment scope, unresolved questions and permissions
remain unchanged; native sync/background scheduling is separate.

Inspect/plan work cannot silently become implementation. Never auto-approve or
bypass existing plan/input gates, and preserve exact `request_id` checks.
Enforce reviewer rejection lockout: the rejected author cannot revise or advise
on that artifact's next version. Adjacent discoveries need separate user approval
before dispatch; do not launch speculative follow-on work.

Update the current main-session visible plan for meaningful status/results,
using the optional `squad_session_plan_*` tools with conflict reconciliation as
described in the coordinator. If unavailable, explicitly maintain a visible chat
plan, without claiming native UI integration. This is not approval or a mode change.

Reconcile the authoritative current-request SQL task states and readable Details
together, following the coordinator's native-task/context default.
Refresh any fallback summary/count, current activity/owner, next action, real
blocker/approval and task states from the same evidence, not only a checkbox.
Keep queued work Pending; idle is not completed evidence.
If required validation or integration is pending, do not show Completed.
Preserve unrelated/user-authored task rows and custom plan intent; report any
SQL/Markdown write mismatch rather than claiming synchronization.
Keep each work item and owner mapped to the verified actual App child and its
host-supplied `app_url` in readable context, following the coordinator's
assigned-session link rules. Pending dispatch or failed launch has no fabricated
link; native fallback without an App session cannot supply one. Preserve valid
user links and reconcile mission changes instead of silently repointing them.

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
