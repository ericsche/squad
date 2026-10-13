# Client Compatibility Reference

### Client Compatibility

Detect the available tools once, then preserve named specialist visibility in the
App while keeping direct responses and internal checks lightweight.
See `docs/scenarios/client-compatibility.md` for the compatibility matrix.

#### Dispatch selection

- **Direct Mode:** Trivial questions/readily available evidence, including a small read/status command — no agent.
- **App `create_session`:** All named specialist missions from a project session use project/worktree children in the parent's project, including bounded edits and substantive read-only work.
- **Native `task`:** Small bounded internal checks in the App; specialist missions on CLI or the disclosed capability fallback.
- **VS Code `runSubagent` / `agent`:** Specialist prompt when App child sessions and native `task` are unavailable; results return directly.
- **Fallback:** Only when no spawn tool is available, work inline within authorization.

Commit production alone is not a dispatch criterion. Preserve routing, specialist
persona and reviewer gates on every delegated path. Check current tool schemas
for supported fields instead of sending CLI-only parameters to App-hosted tools.

In the Copilot App, ALL named Squad specialist missions MUST use visible coordinated
child sessions via `create_session`, including short/read-only missions.
Native `task` is ONLY for small bounded internal checks in the App; a named specialist
mission is not an internal check merely because it is short or read-only.
Internal checks run a known test selector or compare one explicit output against
an existing requirement, without assuming a specialist-owned deliverable.

The native session tree depends on actual App child sessions, not task labels or
hooks. Do not claim to migrate native task histories into it; do not create fake
sessions or rerun completed work to populate the sidebar.

Use the native `name` field for icon + specialist label + mission; derive identity
from the active specialist's charter/roster, using the role emoji mapping.
Keep icon and readable label stable for the same specialist.
Within 40 characters, shorten the mission first, then use a compact role label
if needed; keep the canonical specialist name explicit in the prompt and plan.
Static identity is separate from busy/idle/error states owned by the App; no
fake avatars, colors or title-based status.

When `create_session` is unavailable, use native `task` or VS Code `runSubagent`
within authorization and workspace safety, and disclose degraded native sidebar
visibility. If creation fails, report the blocker; do not silently substitute
`task` for the specialist. Stop if required isolation or persistence cannot be
provided by the fallback host.

#### Authorization and scheduling

Pass explicit `inspect/read-only`, `propose/plan`, or `authorized execution`
scope, permitted actions/files, exclusions and expected evidence.
"Inspect and propose" must not launch implementation in autopilot.
App `plan` requires user review before execution, `interactive` is guided
collaboration, and `autopilot` permits authorized bounded execution by default
when permitted without adding new approval friction.
Omitting `kickoff.mode` with a prompt defaults to plan; resolve it deliberately.
Never auto-approve or bypass existing user plan/input gates: inspect them with
`get_session`, preserve exact `request_id`, and route required decisions to the user.
Writing the visible plan does not approve execution or change modes.

Native sync is appropriate for bounded internal checks whose result is needed now,
or specialist work on fallback hosts without App children.
Use background only with independent foreground work or genuinely needed retained
same-task follow-up supported by the host. App mode is authorization, not native
sync/background scheduling. Some `task` schemas have no mode field.

#### Handles, results and reuse

| Lifecycle | Dispatch | Results / status | Same-task follow-up |
|-----------|----------|------------------|---------------------|
| Native synchronous | `task` | Direct tool response | Fresh invocation of the same persona if needed; not automatically retained |
| Native retained/background (if supported) | `task` with schema-supported scheduling | Notification, then `read_agent` with native `agent_id` | `write_agent` only if that lifecycle supports it |
| App persistent child | `create_session` with authorized mode | Notifications / `send_session_message` handoff; `get_session` for status, workspace or gates | `send_session_message` with App session ID and assignment context |
| VS Code | `runSubagent` / `agent` | Returned result; no `read_agent` | New invocation with bounded same-task context |

App child reports use the kickoff `assignment_id` and `purpose: handoff`,
`needs_input`, or `error`. Normal `message` delivery remains the supported path
when the host does not allow `coordinator_instructions` for ordinary parents;
do not assume coordinator-only fields are universally available.

Native `agent_id` is not App `project_session_id`; never pass App children to
`read_agent` or native IDs to App session tools. Native sync task agents cannot
receive `write_agent` follow-ups in hosts that reject them.
Reuse only same-mission context with a compatible lifecycle, never an unrelated
worker pool. A fresh same-owner invocation is not persistent session reuse.

Follow the current schema's wait limits (at most 180 seconds where currently
exposed). After a background notification, collect once, not a polling loop.
If still running and no independent work remains, report waiting and stop this
turn, not the whole mission as completed. Do not declare parent completion with
required running/incomplete subtasks.

An idle notification, end-of-agent-turn or native subagent hook event does not
prove success. Distinguish in-progress, blocked/needs_input, completed (verified
outcome), failed and cancelled. Do not promise exact UI rendering from hooks.

#### Workspace and visible-plan boundaries

Share parent identity/team context explicitly, not its execution paths.
From an App project session, ALL named specialist missions MUST use project children
with `project_id` from the parent, `session_kind: "project"` and
`workspace_type: "worktree"`, including short/read-only missions.
A read-only prompt and mode stay read-only; project association does not authorize
implementation. Code/tests execute only in the child's own worktree.
Verify the returned child's project association, not only its coordinating parent.

Use `session_kind: "chat"` only when explicitly requested outside the project,
and disclose placement under Chats; a chat child has no checkout.
Parent linkage and source access do not place a chat in the project tree;
renaming does not convert chat to a project session. Chat input sources must
still be supplied or their read-only access established, not assumed from the
parent filesystem.

If the parent project is missing or project child creation is unsupported, report
the limitation; do not invent association, create a project without authorization
or silently substitute chat. Do not assume migration or attachment APIs.
Omit `base_branch` unless explicitly requested or work depends on a documented
in-progress branch; no implicit stacking.
Child changes/commits are not automatically integrated into the parent.

The optional `squad_session_plan_read`, `squad_session_plan_publish`, and
`squad_session_plan_update` tools come from a runtime extension, not built-in
App tools. Discover schemas before use. The coordinator's current main-session
plan should reflect meaningful milestones for nontrivial multi-step work or
explicit planning; reconcile existing/user-edited content and hash conflicts
deliberately. If unavailable, explain the limitation and maintain a visible chat
plan. Plan writes never approve execution or change mode.

#### VS Code adaptations

- **Tool:** Pass the full specialist prompt to `runSubagent`; drop native-only fields (`agent_type`, `mode`, `model`, `description`).
- **Concurrency:** Multiple calls in one turn can run concurrently; use them only for independently deliverable outcomes or concrete bounded collaboration, not automatic fan-out.
- **Models:** Accept the session model unless the host explicitly exposes an override.
- **Scribe:** Spawn Scribe only when accepted durable decisions need merging, after the actual decisions exist; do not batch anticipatory logging with every group.
- **Acknowledgment:** Name the specialist before dispatch; do not claim results before collecting them.
- **Prompt:** Preserve identity, charter, authorization, execution workspace, evidence and response-order blocks.

#### Feature availability

| Feature | CLI/native agents | Copilot App | VS Code |
|---------|-------------------|-------------|---------|
| Named specialist missions, including short/read-only | Native `task` | Coordinated project/worktree child in parent's project | `runSubagent` / `agent`; no App tree implied |
| Small bounded internal checks | Native `task` | Native `task` when exposed; not a specialist substitute | Direct or available check tool |
| Persistent isolated code work | Only if host provides it | Project/worktree child | Not implied by a subagent |
| Result collection | Direct result or native `read_agent` | Native and App handles are distinct | Direct result |
| Model / scheduling fields | Current schema, not assumed | Native schema vs child `kickoff` schema | Session defaults unless exposed |
| Scribe | Only accepted durable decision merging | Same scope; coordinated child when delegated | Same scope, sync invocation |
| Native sidebar hierarchy | Not provided by native task | Project children under the project; explicit outside-project chats under Chats | Not provided by subagents |
| Visible current plan | Optional extension or chat fallback | Optional extension or chat fallback | Chat fallback unless extension tools are exposed |
| SQL TODOs | Use if exposed | Use if exposed | Do not assume availability |

#### SQL Tool Caveat

Do not make cross-platform orchestration depend on `sql`. Use SQL TODOs and real
dependencies when available, but keep the visible plan in the supported current
session plan tools or chat. Mutable `.squad/` state remains governed by its
configured runtime backend; do not invent raw-file state fallbacks for non-local
backends.
