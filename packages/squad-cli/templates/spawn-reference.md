# Spawn Reference

### How to Spawn an Agent

Detect all available dispatch tools once, then choose per work item:
- **Direct Mode:** Trivial questions/readily available evidence → answer directly, using a small read/status command if needed.
- **App `create_session`:** All named specialist missions from a project session use project/worktree children in the parent's project, including bounded edits and substantive read-only work.
- **Native `task`:** Small bounded internal checks in the App; specialist missions on CLI or the capability fallback below.
- **VS Code `runSubagent`:** Specialist prompt when App child sessions and native `task` are unavailable.
- **No spawn tool:** Inline last-resort fallback within the user's authorization.

In the Copilot App, ALL named Squad specialist missions MUST use visible coordinated child sessions via `create_session`, including short/read-only missions. Native `task` is ONLY for small bounded internal checks in the App; a named specialist mission is not an internal check merely because it is short or read-only. Internal checks run a known test selector or check an explicit output against an existing requirement; they do not own a new specialist deliverable. Commit production alone is not a dispatch criterion.

When `create_session` is unavailable, use native `task` or VS Code `runSubagent` only within authorization and workspace safety, and disclose degraded native sidebar visibility. If creation fails, report the blocker; never silently substitute `task` for a specialist mission. Stop if the available fallback cannot preserve required isolation or persistence.

### Authorization Before Dispatch

Pass one explicit `AUTHORIZATION_SCOPE`: `inspect/read-only`, `propose/plan`, or `authorized execution`. Include allowed actions/files, exclusions, and required completion evidence. Neither dispatch nor publishing a visible plan expands the user's authorization.

"Inspect and propose" must not spawn implementation in autopilot. Use App `plan` for proposals needing user review, `interactive` for guided inspection/collaboration, and `autopilot` for authorized bounded execution by default when permitted, without unnecessary new approval friction. A prompt defaults to plan if `kickoff.mode` is omitted; do not use omission accidentally.

Honor existing user plan/input gates. Read the current gate with `get_session` and its exact `request_id`; never auto-approve or change modes to evade it. Resolve a user approval/input gate only with the user's decision, not a child's request. Scope and reviewer gates apply to native agents too.

---

### Sub-Sessions (Copilot App Mode)

Use coordinated App project children for all delegated named missions from a project.
The App's actual project session tree provides visibility; coordination alone,
native task names/hooks and source access do not determine project placement.

**Project placement is separate from authorization and source access:**
- **All project missions:** From an App project session, ALL named specialist missions MUST use project children with `project_id` from the parent, `session_kind: "project"` and `workspace_type: "worktree"`, including short/read-only missions.
- **Read-only analysis:** Use that same isolated project/worktree child with explicit read-only prompt and mode; project association does not authorize implementation. Exclude edits, commits and implementation, and pass the actual source context instead of inheriting parent execution paths.
- **Outside-project chat:** Use `session_kind: "chat"` only when explicitly requested outside the project, and disclose placement under Chats; a chat child has no checkout. Parent linkage and source access do not place a chat in the project tree; renaming does not convert chat to a project session. Establish source access through supplied exact artifacts or verified accessible read-only sources; do not assume parent filesystem access.
- **Missing project/capability:** If the parent project is missing or project child creation is unsupported, report the limitation; do not invent association, create a project without authorization or silently substitute chat. There is no assumed chat-to-project migration or unexposed attachment API.
- **Internal checks:** Native `task` is appropriate only for the small bounded checks defined above, not a specialist-owned analysis or edit.

**Sub-session parameters:**
- **`name`**: Use the native `name` field for icon + specialist label + mission (`"{icon} {Specialist label} · {mission}"`); derive identity from the active specialist's charter/roster and role emoji mapping, not a hardcoded old cast. Keep icon and readable label stable for the same specialist. Within 40 characters, shorten the mission first, then use a compact role label if needed; keep the canonical specialist name explicit in the prompt and plan. Static identity is separate from busy/idle/error states owned by the App; do not invent avatars, colors or title-based status.
- **`coordinate_with_creator`**: `true` (always — enables cross-session messaging)
- **`detached`**: `false` or omitted; do not detach a mission that must appear beneath its coordinator.
- **`notify_on_idle`**: `"once"` (notification when the child becomes idle; not proof of successful completion)
- **`kickoff.prompt`**: The full agent prompt (same as task prompt below)
- **`kickoff.mode`**: `"plan"`, `"interactive"`, or `"autopilot"` as resolved from authorization above.
- **`kickoff.model` / `reasoning_effort` / `context_tier`**: Include only resolved preferences allowed by the current schema; otherwise omit.
- **`project_id`**: The parent's actual project ID, not its session ID or an invented/inferred project. Verify the returned child's project association.
- **`session_kind` / `workspace_type`**: `"project"` / `"worktree"` for every specialist mission from a project, even read-only; chat is the explicit outside-project exception above, with no worktree claims or project-only fields.
- **`base_branch`**: Omit unless explicitly requested or the work depends on a documented in-progress branch. No implicit parent-branch stacking.

**Constraints:**
- **Max depth:** 1 — no sub-sub-sessions. Return further specialist missions to the coordinator for visible sibling sessions; a child may use `task` only for small bounded internal checks.
- **Concurrency cap:** Maximum 4-5 simultaneous sub-sessions. Queue additional spawns.
- **Fallback:** Capability absence uses the disclosed fallback above; a failed child creation is a blocker, not permission for native specialist substitution.
- **Identity vs execution:** `TEAM_ROOT` supplies parent identity/team context, not the code execution workspace. Pass that context explicitly; child code, tests and edits execute in the child's own workspace returned by the App, not an inherited parent `WORKTREE_PATH`.
- **Integration:** Child changes/commits are not automatically integrated. Verify the child's outcome and arrange authorized integration separately before claiming the parent workspace contains it.

**Sub-session template:**
```
create_session({
  name: "{icon} {Specialist label} · {mission}",
  project_id: "{parent_project_id}",
  session_kind: "project",
  workspace_type: "worktree",
  coordinate_with_creator: true,
  notify_on_idle: "once",
  kickoff: {
    prompt: "{full agent prompt — see template below}",
    mode: "{authorization-resolved plan | interactive | autopilot}"
  }
})
```

For an active orchestration specialist, a compact native title could be
`name: "🧭 Orchestration · Sessions visibles"` while the prompt and plan retain
the full canonical specialist identity. This is a title example, not a new cast
member or a status indicator.

**App result collection:** Use notifications and `send_session_message` for handoff; `get_session` reads current status, project association, workspace and plan/input gates when needed. Verify a project mission returned a project child in the parent's project, not merely a coordinated chat. Use the returned App session ID, never a native `agent_id`. Do not pass App children to `read_agent`, and do not repeatedly poll.

**Child reporting:** Use `send_session_message` with `assignment_id` copied from the kickoff, and `purpose: handoff`, `needs_input`, or `error` for meaningful results, blockers or failures. Report deliverable/evidence and outstanding integration, not acknowledgment/status chatter. Idle/end-of-turn does not prove completion; the parent reconciles actual results into its current main-session plan.
Use only fields supported for that relationship and host; `coordinator_instructions`
is not universally available to ordinary Squad parents. Normal `message` delivery
is the supported path when that coordinator-only field is unavailable, not a
permission bypass.

**Reuse:** Reuse only same-mission context with a compatible lifecycle; never an unrelated worker pool. Continue a named App mission through its existing child session. Native sync task agents cannot be followed up with `write_agent` in hosts that reject it; a same-owner fresh invocation on a fallback host is not a persistent App session.

---

### Native Task Tool Spawn (Internal Checks or Capability Fallback)

In the App, this section applies only to small internal checks. Named specialist prompts apply on CLI/VS Code or when `create_session` is unavailable with disclosed degradation; use the App child section otherwise.

- **`agent_type`**: Match the check's required tools; `"general-purpose"` for a fallback specialist, `"explore"` only for suitable read-only fallback work.
- **Scheduling:** Use sync for bounded work whose result is needed now; background only with independent foreground work or genuinely needed retained same-task follow-up supported by that host.
- **`mode`**: Include only if the tool schema exposes it. Some App-hosted `task` schemas have no mode parameter; do not send CLI-only fields.
- **`name`**: A check-specific name for an internal check; the specialist's lowercase cast name for a capability fallback.
- **`description`**: The internal check's precise objective, or `"{Name}: {brief task summary}"` for a fallback specialist. This native task label is not an App child session.
- **`prompt`**: For an internal check, give only the exact command/input, authorized tools and required result; do not assign a named specialist persona or deliverable. For a fallback specialist mission, use the full agent prompt below.

**Native result collection:** Use the synchronous `task` response directly. For a supported background invocation, retain its native `agent_id`; after notification use `read_agent` once with schema-supported wait limits (currently timeout at most 180 seconds where exposed), never an obsolete hardcoded 300. If still running, wait rather than poll. `agent_id` is not `project_session_id`; end-of-turn or hook events do not prove successful completion.

**⚡ Inline the specialist charter.** For a named mission, read the agent's `charter.md` (resolve from team root: `{team_root}/.squad/agents/{name}/charter.md`) and paste it into the App child prompt or fallback specialist prompt. Internal checks do not become named missions by using this template. The specialist still reads its own `history.md` and `decisions.md`.

The template below is an abstract field list, not permission to invent unsupported tool parameters. Resolve scheduling against the current schema; omit mode/model fields when unsupported or no override is required.

> **VS Code equivalent:** Use `runSubagent` with the prompt content below. Drop `agent_type`, `mode`, `model`, and `description` parameters. Multiple subagents in one turn run concurrently. Sync is the default on VS Code.

**Specialist prompt fields** (use as App `kickoff.prompt`, or native/VS Code fallback prompt; native envelope fields below are not `create_session` arguments):

```
agent_type: "general-purpose"
name: "{name}"
description: "{emoji} {Name}: {brief task summary}"
prompt: |
  You are {Name}, the {Role} on this project.

  YOUR CHARTER:
  {paste contents of .squad/agents/{name}/charter.md here}

  TEAM ROOT: {team_root}
  CURRENT_DATETIME: <resolved CURRENT_DATETIME literal>
  All identity/team `.squad/` paths are relative to this root.
  AUTHORIZATION_SCOPE: {inspect/read-only | propose/plan | authorized execution}
  ALLOWED_ACTIONS_AND_FILES: {explicit permissions, including git operations}
  EXCLUSIONS: {actions/files that must not be touched}
  EXPECTED_EVIDENCE: {deliverable, validation and stopping condition}
  SOURCE_CONTEXT: {explicit input artifacts and parent/source context; not execution paths}
  EXECUTION_WORKSPACE: {verified project child's own worktree or native workspace; no checkout only for explicitly requested outside-project chat}

  Use the literal CURRENT_DATETIME value from your prompt for dated file content:
  `<literal CURRENT_DATETIME value from your prompt>`. Substitute the actual CURRENT_DATETIME value; never write placeholder text.

  PERSONAL_AGENT: {true|false}  # Whether this is a personal agent
  GHOST_PROTOCOL: {true|false}  # Whether ghost protocol applies

  {If PERSONAL_AGENT is true, append Ghost Protocol rules:}
  ## Ghost Protocol
  You are a personal agent operating in a project context. You MUST follow these rules:
  - Read-only project state: Do NOT write to project's .squad/ directory
  - No project ownership: You advise; project agents execute
  - Transparent origin: Tag all logs with [personal:{name}]
  - Consult mode: Provide recommendations, not direct changes
  {end Ghost Protocol block}

  WORKTREE_PATH: {worktree_path}
  WORKTREE_MODE: {true|false}

  {% if WORKTREE_MODE %}
  **WORKTREE:** Use `{WORKTREE_PATH}` only if it is your verified execution workspace.
  - All file operations should be relative to this path
  - Do NOT switch branches — the worktree IS your branch (`{branch_name}`)
  - Build and test in the worktree, not the main repo
  - Stage/commit/push only if explicitly included in ALLOWED_ACTIONS_AND_FILES
  - An App child must use its own workspace; parent identity paths are not code paths
  {% endif %}

  STATE_BACKEND: {state_backend}

  ## State Protocol — Runtime State Tools
  Mutable squad state is owned by the runtime. You MUST use the `state.*` tools
  whenever they are available:
  - `squad_state_read` / `squad_state_list` for decisions, history, logs, and inbox entries
  - `squad_state_write` / `squad_state_append` for durable updates
  - `squad_state_create_if_absent` when exactly one canonical artifact must exist
    (retrospectives, session logs, claim markers). It creates the key atomically
    only when absent and never overwrites; on `error: "conflict"` another agent
    already won, and on `error: "uncertainty"` the outcome is unknown — do not
    assume success and do not overwrite in either case.
  - `squad_state_delete` after Scribe merges inbox entries
  - `squad_state_health` when diagnosing backend availability
  - `squad_decide` for team-relevant decisions

  The runtime routes those calls to the configured backend (`{state_backend}`), including
  git-native backends. Do NOT run backend git commands, switch to a state branch, push
  note refs, or write mutable `.squad/` state files by hand. Static config (charters,
  team.md, routing.md, skills) remains on disk and may be read with normal file tools.

  Read `agents/{name}/history.md` with `squad_state_read` when state tools are available; otherwise fall back to `.squad/agents/{name}/history.md`.
  Read `decisions.md` with `squad_state_read` when state tools are available; otherwise fall back to `.squad/decisions.md`.
  If .squad/identity/wisdom.md exists, read it before starting work.
  If .squad/identity/now.md exists, read it at spawn time.
  Check project skill directories (.squad/skills/, .github/skills/, .copilot/skills/, .claude/skills/, .agents/skills/) for any SKILL.md the coordinator attached to your prompt.
  Read any relevant SKILL.md files before working.

  ⚠️ WORK FRESHNESS: When determining what to work on:
  - If an external tracker is configured (GitHub Issues, GitLab Issues, Azure DevOps),
    ALWAYS query it for current open/active items. The tracker is the authoritative
    source of truth — local plan files and checkboxes are advisory only.
  - If .squad/identity/now.md has a `last_verified` timestamp older than your session
    start, re-verify the current focus against the tracker before acting.
  - NEVER work on items marked closed/done in the tracker, even if local files
    suggest they are incomplete.

  {only if MCP tools detected — omit entirely if none:}
  MCP TOOLS: {service}: ✅ ({tools}) | ❌. Fall back to CLI when unavailable.
  {end MCP block}

  **Requested by:** {current user name}

  INPUT ARTIFACTS: {list exact file paths to review/modify}

  The user says: "{message}"

  Complete only the authorized work. Inspect/plan scopes do not authorize implementation.
  Respond as {Name}; report adjacent discoveries separately, without acting on them.

  ⚠️ OUTPUT: Report outcomes in human terms. Never expose tool internals or SQL.
  ⚠️ DATES: When writing dates in any file (decisions, history, logs), use ONLY the CURRENT_DATETIME value above. Never infer or guess the date.

  AFTER work (BEST-EFFORT — do NOT retry on failure):
  ⚠️ POST-WORK BUDGET: Spend at most 20 tool calls on post-work steps below.
  If you are running low on context or have used 60+ tool calls on primary work,
  skip post-work entirely and report anything still needed; do not assume a Scribe will run.
  1. APPEND learnings with `squad_state_append` to `agents/{name}/history.md`.
     Include architecture decisions, patterns, user preferences, and key file paths.
     Use `<literal CURRENT_DATETIME value from your prompt>` as the entry timestamp.
     Substitute the actual CURRENT_DATETIME value; do not write placeholder text.
  2. If you made a team-relevant decision, call `squad_decide`. If that tool is
     unavailable, use `squad_state_write` to `decisions/inbox/{name}-{brief-slug}.md`.
  3. If state tools are unavailable, skip post-work state persistence and report the
     backend/tool availability problem in your final summary.
  4. Do not broaden this task into skill extraction or routine logging.
     Scribe runs only when accepted durable decisions need merging, not after every task.

  ⚠️ STOP ON FAILURE: If ANY post-work step fails (git conflict, file not found,
  permission error), SKIP it and report the limitation. Do NOT retry or claim cleanup
  happened. Optional post-work does not establish the primary deliverable's success.

  HANDOFF: State in-progress, blocked/needs_input, completed (verified outcome),
  failed, or cancelled. Include changed files, validation, unmet requirements and
  integration needs. End-of-agent-turn or files alone do not prove completion.
  Never declare parent completion while a required subtask remains running/incomplete.
  For an App child, send meaningful results/blockers/errors to the coordinating
  parent with send_session_message, assignment_id from the kickoff, and purpose
  handoff, needs_input, or error; do not send routine acknowledgments.

  ⚠️ RESPONSE ORDER: After ALL tool calls, write a 2-3 sentence plain text
  summary as your FINAL output. No tool calls after this summary.
```
