# Spawn Reference

### How to Spawn an Agent

Detect all available dispatch tools once, then choose per work item:
- **Direct Mode:** Trivial questions/readily available evidence → answer directly, using a small read/status command if needed.
- **Native `task`:** Bounded work not requiring isolated code execution or durable session lifecycle, including authorized edits.
- **App `create_session`:** Independent work requiring workspace isolation or a durable lifecycle.
- **VS Code `runSubagent`:** Specialist prompt when native `task` is unavailable.
- **No spawn tool:** Inline last-resort fallback within the user's authorization.

App may expose native `task` alongside `create_session`. Commit production alone is not a dispatch criterion; preserve specialist ownership/persona without forcing every task into a new session.

### Authorization Before Dispatch

Pass one explicit `AUTHORIZATION_SCOPE`: `inspect/read-only`, `propose/plan`, or `authorized execution`. Include allowed actions/files, exclusions, and required completion evidence. Neither dispatch nor publishing a visible plan expands the user's authorization.

"Inspect and propose" must not spawn implementation in autopilot. Use App `plan` for proposals needing user review, `interactive` for guided inspection/collaboration, and `autopilot` for authorized bounded execution by default when permitted, without unnecessary new approval friction. A prompt defaults to plan if `kickoff.mode` is omitted; do not use omission accidentally.

Honor existing user plan/input gates. Read the current gate with `get_session` and its exact `request_id`; never auto-approve or change modes to evade it. Resolve a user approval/input gate only with the user's decision, not a child's request. Scope and reviewer gates apply to native agents too.

---

### Sub-Sessions (Copilot App Mode)

Use a coordinated App child only when independence needs workspace isolation or persistent lifecycle. Do not create one merely for UI visibility or because files will change.

**When to use sub-sessions vs task:**
- **Sub-session** (`create_session`): Independent work requiring workspace isolation or a durable lifecycle.
- **Task** (`task` tool): Bounded work whose inputs and deliverable are known and which does not need that isolation/lifecycle.

**Sub-session parameters:**
- **`name`**: `"{Name} {verb}ing {noun}"` — 40-char max, sentence case (e.g., "Runtime Engineer refactoring auth", "Lead reviewing architecture")
- **`coordinate_with_creator`**: `true` (always — enables cross-session messaging)
- **`notify_on_idle`**: `"once"` (notification when the child becomes idle; not proof of successful completion)
- **`kickoff.prompt`**: The full agent prompt (same as task prompt below)
- **`kickoff.mode`**: `"plan"`, `"interactive"`, or `"autopilot"` as resolved from authorization above.
- **`kickoff.model` / `reasoning_effort` / `context_tier`**: Include only resolved preferences allowed by the current schema; otherwise omit.
- **`base_branch`**: Omit unless explicitly requested or the work depends on an in-progress branch. No implicit parent-branch stacking.

**Constraints:**
- **Max depth:** 1 — no sub-sub-sessions. If an agent needs to delegate, it uses `task` tool.
- **Concurrency cap:** Maximum 4-5 simultaneous sub-sessions. Queue additional spawns.
- **Fallback:** Use native `task` after a creation failure only if it preserves authorization, workspace safety and needed lifecycle; otherwise report the blocker.
- **Identity vs execution:** `TEAM_ROOT` supplies parent identity/team context, not the code execution workspace. Pass that context explicitly; child code, tests and edits execute in the child's own workspace returned by the App, not an inherited parent `WORKTREE_PATH`.
- **Integration:** Child changes/commits are not automatically integrated. Verify the child's outcome and arrange authorized integration separately before claiming the parent workspace contains it.

**Sub-session template:**
```
create_session({
  name: "{Name} {verb}ing {noun}",
  coordinate_with_creator: true,
  notify_on_idle: "once",
  kickoff: {
    prompt: "{full agent prompt — see template below}",
    mode: "{authorization-resolved plan | interactive | autopilot}"
  }
})
```

**App result collection:** Use notifications and `send_session_message` for handoff; `get_session` reads current status, workspace and plan/input gates when needed. Use the returned App session ID, never a native `agent_id`. Do not pass App children to `read_agent`, and do not repeatedly poll.

**Reuse:** Reuse only same-mission context with a compatible lifecycle; never an unrelated worker pool. Native sync task agents cannot be followed up with `write_agent` in hosts that reject it; a same-owner fresh invocation is not a persistent App session.

---

### Native Task Tool Spawn (CLI or App Host)

Use native `task` for bounded work even when App `create_session` is also available:

- **`agent_type`**: `"general-purpose"` for a full specialist; `"explore"` only for suitable substantive read-only work.
- **Scheduling:** Use sync for bounded work whose result is needed now; background only with independent foreground work or genuinely needed retained same-task follow-up supported by that host.
- **`mode`**: Include only if the tool schema exposes it. Some App-hosted `task` schemas have no mode parameter; do not send CLI-only fields.
- **`name`**: Specialist's lowercase cast name.
- **`description`**: `"{Name}: {brief task summary}"` (e.g., `"Runtime Engineer: Design REST API endpoints"`, `"Experience Engineer: Build login form"`) — this is what appears in the UI, so it MUST carry the agent's name and what they're doing
- **`prompt`**: The full agent prompt (see below)

**Native result collection:** Use the synchronous `task` response directly. For a supported background invocation, retain its native `agent_id`; after notification use `read_agent` once with schema-supported wait limits (currently timeout at most 180 seconds where exposed), never an obsolete hardcoded 300. If still running, wait rather than poll. `agent_id` is not `project_session_id`; end-of-turn or hook events do not prove successful completion.

**⚡ Inline the charter.** Before spawning, read the agent's `charter.md` (resolve from team root: `{team_root}/.squad/agents/{name}/charter.md`) and paste its contents directly into the spawn prompt. This eliminates a tool call from the agent's critical path. The agent still reads its own `history.md` and `decisions.md`.

The template below is an abstract field list, not permission to invent unsupported tool parameters. Resolve scheduling against the current schema; omit mode/model fields when unsupported or no override is required.

> **VS Code equivalent:** Use `runSubagent` with the prompt content below. Drop `agent_type`, `mode`, `model`, and `description` parameters. Multiple subagents in one turn run concurrently. Sync is the default on VS Code.

**Template for any agent** (substitute `{Name}`, `{Role}`, `{name}`, and inline the charter):

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
  EXECUTION_WORKSPACE: {native working directory or App child's own workspace}

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

  ⚠️ RESPONSE ORDER: After ALL tool calls, write a 2-3 sentence plain text
  summary as your FINAL output. No tool calls after this summary.
```
