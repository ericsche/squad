# Copilot Client Compatibility Matrix

> **Quick answer:** Not sure which interface to use? See [Choose your interface](../get-started/choose-your-interface.md) for a concise decision tree and comparison.

> **New in Squad 2.0:** `squad init --client copilot|claude|kiro|opencode|cursor|codex|antigravity|all` and `squad upgrade --client ...` now project host-native adapters across all 7 supported hosts (GitHub Copilot, Claude Code, Kiro, OpenCode, Cursor, OpenAI Codex, and Google Antigravity) while keeping the backend contract portable. Start with [Using Squad across clients](./using-squad-across-clients.md) for the hands-on walkthrough and [Squad 2.0 architecture](../concepts/squad-2-0-architecture.md) for the three-plane model, MCP-vs-HTTP transport story, and the `G1`-`G9` conformance gates.

Squad runs on multiple Copilot surfaces — each with its own agent tools and lifecycle. From a Copilot App project session, all named specialist missions use visible coordinated project/worktree children in that same project, including short and read-only work. Native tasks remain available for small internal checks, while trivial questions stay direct. This document distinguishes those paths from CLI, VS Code, JetBrains, and GitHub.com. The Quick Reference table covers Copilot surfaces only; [Claude Code](#claude-code) has its own section below, and the [Host Feature Matrix](../reference/host-feature-matrix.md) covers every supported host feature by feature.

## Quick Reference

| Feature | Copilot App | CLI | VS Code | JetBrains / GitHub.com |
|---------|-------------|-----|---------|-----------------------|
| **Named specialist missions, including short/read-only** | Coordinated project/worktree child in parent's project | `task`; no App tree implied | `runSubagent` / `agent`; no App tree implied | Not established here |
| **Small bounded internal checks** | Native `task` when exposed, not a specialist substitute | `task` or direct check | Direct or available check tool | Host-dependent |
| **Persistent isolated code work** | Project/worktree child | Not implied by a native task | Not implied by a subagent | Not established here |
| **Specialist visual identity** | Stable icon + specialist label + mission in native child title | Native task label, not App hierarchy | Host subagent label, not App hierarchy | Host-dependent |
| **Result collection** | Native results or App notifications/handoffs; distinct IDs | Direct result or `read_agent` for supported background agents | Returned result | Host-dependent |
| **Model / scheduling fields** | Current native schema or child `kickoff` schema | Current tool schema | Session model unless override exposed | Host-dependent |
| **Current visible plan** | Optional Squad runtime extension, otherwise chat plan | Optional extension, otherwise chat plan | Chat plan unless extension exposed | Chat plan |
| **SQL TODOs** | If exposed; not a visible-plan substitute | If exposed | Do not assume availability | Do not assume availability |
| **Team state** | Configured backend; child code workspace stays distinct | Configured backend | Workspace/backend constraints | Host-dependent |
| **MCP server access** | If configured/exposed | If configured/exposed | If configured/exposed | Host-dependent |

**Legend:**
- ✅ **Works** — Feature is fully supported with no degradation
- ⚠️ **Limited** — Feature works with constraints, degraded experience, or special configuration
- ❌ **Not available** — Feature cannot be used on this surface
- ? **Untested** — Not yet validated in production

---

## Copilot App

### Visible specialist missions, lightweight internal checks

1. **Direct response:** A trivial question with readily available evidence needs no agent. A small read or status command is fine.
2. **App specialist mission:** Every mission delegated to a named Squad specialist from a project uses `create_session` with that parent's `project_id`, `session_kind: "project"`, `workspace_type: "worktree"`, `coordinate_with_creator: true` and `notify_on_idle: "once"`, even a short review, read-only analysis or bounded edit.
3. **Native internal check:** Use `task` only for small bounded internal checks, such as running a known test selector or checking one explicit output against an existing requirement. A specialist-owned deliverable is not an internal check merely because it is short or read-only.

The native sidebar hierarchy comes from actual App child sessions, not native task labels, hooks or an in-chat launch table. Do not claim to migrate task histories into it, create fake sessions or rerun historical completed work just to fill the tree. Preserve the specialist's persona and accountable ownership; parallel work still requires independently deliverable outcomes or concrete bounded collaboration, not automatic fan-out.

From an App project session, ALL named specialist missions MUST use project children with `project_id` from the parent, `session_kind: "project"` and `workspace_type: "worktree"`, including short/read-only missions. A read-only prompt and mode stay read-only; project association does not authorize implementation.

Use `session_kind: "chat"` only when explicitly requested outside the project, and disclose placement under Chats; a chat child has no checkout. Parent linkage and source access do not place a chat in the project tree; renaming does not convert chat to a project session. A coordinated chat may read supplied sources and return a valid result while still appearing under **Chats**, not the project. That is not equivalent to the requested project hierarchy.

If the parent project is missing or project child creation is unsupported, report the limitation; do not invent association, create a project without authorization or silently substitute chat. Do not assume an unexposed chat-to-project migration, attachment, avatar or color API.

If `create_session` is unavailable, native `task` or VS Code `runSubagent` can preserve bounded specialist work within authorization and workspace safety, but disclose **degraded native sidebar visibility**. Those agents are not App children. A failed child creation is a blocker to report, not permission to silently substitute a native specialist. Stop if the fallback cannot preserve required isolation or persistence.

### Native visual identity

Use the child's native `name` field for **icon + specialist label + mission**, for example `🧭 Orchestration · Visible sessions`. Resolve identity from the active specialist's charter/roster and role emoji mapping, not a historical cast or invented member. Keep the icon and readable label stable for that specialist. The exact canonical specialist name stays explicit in the kickoff prompt and main-session plan.

Titles are limited to 40 characters: shorten the mission first, then choose a stable compact role label if necessary. This static identity is not the App's **busy/idle/error** state. Do not simulate avatars, colors, status badges or a custom sidebar canvas; the host owns status and rendering.

### Authorization is separate from scheduling

Every prompt carries `inspect/read-only`, `propose/plan`, or `authorized execution`, allowed actions/files, exclusions and evidence requirements.
The [App session documentation](https://docs.github.com/en/copilot/how-tos/github-copilot-app/agent-sessions) distinguishes:

- **Plan:** Prepare a plan for user review before execution.
- **Interactive:** Guided collaboration and input.
- **Autopilot:** Autonomous execution of authorized work.

"Inspect and propose" must not become an autopilot implementation. Squad launches named App specialists with **explicit `kickoff.mode: "autopilot"`** by default for autonomous work within the authorized scope. The user may manually select another mode through the host; preserve that choice, including Plan and its approval gate. Autopilot does not expand scope or permissions, answer unresolved questions, or approve cloud, deployment or provider actions.

For follow-ups through `send_session_message`, omit `mode` to preserve the user's current choice. Do not automatically change session mode based on delegation, parent mode, parallelism or task length. A pending plan/input gate is not resolved by selecting Autopilot: read the current gate, preserve its exact `request_id`, and obtain the required decision. A prompt defaults to Plan if `kickoff.mode` is omitted, so set the requested launch mode deliberately.

Native sync/background scheduling is a different choice, applicable to internal checks or specialist work on fallback hosts. Use sync when a bounded result is needed now. Background is justified only by independent foreground work or a genuinely needed retained same-task follow-up supported by the host. Some App `task` schemas do not expose `mode`; inspect the current schema instead of copying CLI fields. Never pass an App session mode as a native task's scheduling value.

These are coordinator instruction defaults, not host enforcement. Updating files does not change a running session's mode or prove it loaded the new instructions; actual mode and pending gates must be observed separately in the host. Refresh/reselect Squad normally to load revised guidance without bypassing existing approval or input gates.

### Results, workspaces and integration

- **Native:** Use the synchronous `task` response, or a known native `agent_id` with `read_agent` after a supported background notification.
- **Persistent App child:** Use notifications/`send_session_message` reports with the kickoff `assignment_id` and `purpose: handoff`, `needs_input`, or `error`; use `get_session` for current status, workspace or gates. Its App session ID is not a native `agent_id`.
- Use ordinary `message` delivery when the host does not permit `coordinator_instructions` for an ordinary parent. That coordinator-only field is not universally available; do not bypass its permissions.
- Continue the same App specialist mission in its existing child rather than moving a short follow-up to native `task`. Native sync task agents cannot receive `write_agent` follow-ups in hosts that reject them; only fallback-host work may need a fresh same-persona invocation. Never use an unrelated worker pool.
- Obey current tool wait limits (at most 180 seconds where exposed); no hardcoded 300-second wait or needless polling.
- Share parent identity/source context explicitly, not parent code execution paths. All project specialist missions, including read-only analysis, use a project/worktree child in the same project; verify its actual project association, not only its coordinating parent.
- Execute code/tests only in the child's own workspace. A worktree does not expand read-only authorization. Omit `base_branch` unless explicitly requested or a documented in-progress branch is a real dependency; do not implicitly stack.
- An explicitly requested outside-project chat still needs supplied exact artifacts or verified accessible read-only sources; it has no checkout and does not inherit parent filesystem access.
- Child commits are not automatically integrated into the parent. Verify deliverables and validation, then perform separately authorized integration before claiming the parent branch contains the result.
- Children do not spawn further children or hide additional specialist missions in native tasks. Return those missions to the coordinator for visible sibling sessions.

An end-of-agent-turn, idle notification or native `onSubagentStop` hook is not proof of success. Report **in-progress**, **blocked/needs_input**, **completed (verified outcome)**, **failed**, or **cancelled** with meaningful evidence, not acknowledgment/status chatter. Files alone may be partial or invalid. The foreground coordinator updates its main-session plan from actual child progress/results, and must not report parent completion while a required running/incomplete subtask remains.

### Runtime-required security review and visible follow-up

A host may require its native `security-review` agent **first** for a security
review request. That higher-priority requirement takes precedence over Squad's
App dispatch: use the mandated reviewer, not an inline audit or a replacement
App session. This is a full review, not a small internal check, and its result
is not an App child. A synchronous result may have no native agent ID, and even
a native ID is not a canonical App session URL.

Squad still frames the mission visibly as the review starts. In the same
first tool batch as the reviewer call, when the plan tools are available, it publishes the SQL tasks and readable plan (review
in progress; restitution and any requested follow-up, such as dependency
updates, pending) and labels the native reviewer with the specialist title
pattern, for example `🔒 Security · Dependency review`. That framing changes
what you see, never the review's prompt, scope, order or result. A findings
table or follow-up question required by the host after the review does not end
the mission; Squad continues with the visible restitution owner.

A substantive security review includes bounded App restitution, even with
zero findings or a read-only request such as "Review this project's security
without changing files". The ordinary request is sufficient: no separate
follow-up request, positive finding or remediation choice is required.
After the report returns, reuse an existing suitable child for the same
mission or create one genuine coordinated project/worktree owner to explain
the examined scope, known coverage, limitations and result. Supply the returned report or a
verified accessible report artifact; do not repeat the audit to populate the
sidebar or create an empty child just for appearance. Preserve the native
reviewer's findings, severity, confidence, evidence and attribution, together
with required host formatting and any outstanding user decision. Reviewing
results does not authorize fixes, cloud actions or a new audit. If the report
only examined changes, retain that coverage limit instead of presenting it
as an exhaustive project review. Zero findings is not a security certification.

Choose the owner from the actual active roster and charter-permitted scope.
If there is no declared security specialist, an existing Lead/Architect may
own material-risk synthesis within its boundaries without claiming security
expertise or authorship of the findings. Resolve the real member by role, not
an assumed agent named `architect`. If no suitable owner exists, ask for a
scope/ownership decision through normal confirmation, not a new team member
created solely for UI.

After the native result, discover actual schemas and use supported SQL task
and native plan tools to reconcile this request's progress and readable context,
even when there are no findings or code changes. "Without changing files"
preserves repository/code files; it does not forbid mission task/plan metadata
or permit writing `plan.md` directly. Preserve unrelated rows, user content and
hash guards. A listed tool resource alone is not evidence that schema discovery
or an operation succeeded. If discovery or a supported operation fails, report
the specific unavailable/blocked step and use the visible fallback rather than
silently skipping progress.

Keep native review completion and App restitution in progress distinct until
the genuine handoff is verified. Next decisions are included only when there
are any; do not invent remediation or an obligatory decision task for a
zero-finding result. Link only the actual child's host-supplied `app_url` after
verified creation. If report access, workspace, ownership or App tools are
unavailable, disclose the limitation without fabricating a session.

Only when the higher-priority runtime allows its required reviewer to run
inside an existing App mission may that mission invoke it there. This is a
narrow capability exception, not general native specialist delegation or
permission for nested App sessions. Do not invoke that reviewer again after
its report has already returned. Autopilot defaults, user-selected modes,
approval/input gates and evidence boundaries remain unchanged.

This is an instruction-level composition, not a new runtime interceptor.
Contract and template tests do not establish native reviewer execution, a
real App child, or navigation/rendering in the host; those need live evidence.

### Optional current main-session plan

The Squad runtime extension can supply `squad_session_plan_read()`, `squad_session_plan_publish({content})` and `squad_session_plan_update({content, expectedHash})`. These are extension tools, not built-in App tools. Discover their current schemas.

For nontrivial multi-step or explicit planning work, read/create the main session's visible current plan, then update at meaningful milestones. Reconcile existing/user-edited plans deliberately; a hash conflict is a reason to stop and reconcile, not force-write or repeatedly re-read until an overwrite succeeds. Keep SQL TODOs/dependencies if useful, but not as a substitute for the visible plan.

If the tools are unavailable, say so and provide a visible chat plan without claiming native UI integration. A plan write is not approval and never changes mode. Native hook instrumentation is separate from persistent child sessions and does not establish exact UI rendering or completion semantics.

### Scribe

Scribe runs only when accepted durable decisions need merging, not after every task, hook event or status report. Routine logs and anticipatory housekeeping are not part of that handoff. When delegated in the App, this named mission uses a coordinated child too; fallback hosts use dependency-based native scheduling.

---

## CLI (Copilot CLI)

Use native agents for substantive specialist work; trivial evidence stays Direct. Tool fields and retained-agent capabilities depend on the installed host.

### Agent Spawning

- **Tool:** `task`
- **Parameters:** Use the actual schema; typical fields include `agent_type`, `name`, `description`, `prompt`, and optional model/scheduling controls.
- **Agent types:**
  - `general-purpose` — Full tool access (file ops, CLI, SQL, web, GitHub MCP)
  - `explore` — Read-only tools (grep, glob, view) — optimized for speed and cost
  - `task` — CLI tools + Haiku model (rarely used by Squad)
  - `code-review` — Investigation tools (available but Squad uses its own reviewer pattern)

### Model Selection

- **Mechanism:** Per-spawn `model` parameter
- **Dynamic:** Yes — each spawn can use a different model
- **4-layer hierarchy:**
  1. User override ("use opus")
  2. Agent charter preference (`## Model` section)
  3. Task-aware auto-select (Luna for non-code work, Terra for code and prompts, Sol for visual work)
  4. Default: `gpt-5.6-luna`
- **Fallback chains:** 3 retries + platform default fallback (omit parameter)
  - Premium: `gpt-5.6-sol → claude-opus-5 → claude-opus-4.8 → claude-opus-4.7 → claude-opus-4.6 → claude-sonnet-4.6 → (omit)`
  - Standard: `gpt-5.6-terra → claude-sonnet-5 → claude-sonnet-4.6 → gpt-5.5 → gpt-5.4 → gpt-5.3-codex → claude-sonnet-4.5 → gemini-3.1-pro → (omit)`
  - Fast: `gpt-5.6-luna → claude-haiku-4.5 → gpt-5.4-mini → gpt-5-mini → (omit)`

### Background/Async Execution

- **Mechanism:** Supported native background scheduling, only when there is independent foreground work or a genuinely needed retained same-task follow-up
- **Default for bounded dependent work:** Sync result
- **Result collection:** Use the direct result or, after notification, `read_agent` with the known native ID and current wait limits
- **Squad's typical flow:**
  1. Choose one accountable specialist and the smallest adequate lifecycle
  2. Acknowledge before dispatch, with explicit authorization and evidence requirements
  3. Do independent foreground work if background is justified; otherwise wait for notification rather than poll
  4. Verify the requested outcome, update the visible plan and report outstanding work accurately

### File Discovery & Access

- **Auto-discovery:** `.github/agents/squad.agent.md` is discovered automatically
- **`.ai-team/` access:** Unrestricted (full filesystem)
- **Parallel reads:** Multiple file operations in one turn supported
- **Parallel writes:** Multiple file creates/edits in one turn supported

### Special Tools

- **SQL:** ✅ Available — Squad uses `sql` for tracking todos and batch processing
- **Web fetch:** ✅ Available — `web_fetch` for live data
- **GitHub MCP:** ✅ Available — Full GitHub CLI + API access
- **PowerShell:** ✅ Available — Terminal commands for git operations, builds, tests

---

## VS Code (Copilot in VS Code)

Squad runs on VS Code with **conditional support**. Key differences from CLI:

### Agent Spawning

- **Tools:** `runSubagent` (anonymous) or `agent` (named custom agent)
- **Behavior:** Sub-agents are **always synchronous** (blocking) individually, but **multiple subagents run in parallel** when spawned in the same turn
- **Custom agents:** Auto-discovered from `.github/agents/*.agent.md` (same location as CLI)
- **Default behavior:** Subagents inherit parent model and tools

### Model Selection

- **Mechanism A (Phase 1 — MVP):** Accept session model
  - Subagents use whatever model the user selected in VS Code's model picker
  - No per-spawn control
  - Loss of cost optimization (Scribe might run on Opus instead of Haiku)

- **Mechanism B (Phase 2 — Future):** Custom agent frontmatter
  - Define `model` in `.agent.md` files: `model: "Claude Haiku 4.5 (copilot)"`
  - Supports prioritized lists: `model: ['GPT-5.6 Luna (copilot)', 'Claude Haiku 4.5 (copilot)']`
  - Static per-agent, not per-spawn dynamic
  - Requires experimental setting: `chat.customAgentInSubagent.enabled: true`

- **Recommendation for now:** Use `runSubagent` (anonymous) for all spawns. Accept session model. Model cost optimization deferred.

### Background/Async Execution

- **Mechanism:** Parallel concurrent subagents (not fire-and-forget)
- **Result collection:** Automatic — no `read_agent` polling needed
- **Synchronicity:** All subagents are sync individually, but multiple subagents in one turn run concurrently
- **Fire-and-forget (Scribe):** Not possible
  - **Decision-only handoff:** Invoke Scribe only after accepted durable decisions exist and need merging; do not automatically batch it with every group
- **Launch acknowledgment:** Name the specialist before dispatch; collect the result before claiming success

Multiple calls can run concurrently, but this does not imply a retained background agent or App session. Parallel dispatch still needs independently deliverable outcomes or concrete bounded collaboration.

### File Discovery & Access

- **Auto-discovery:** `.github/agents/squad.agent.md` auto-discovered from workspace on load (file watchers enabled — no restart needed on changes)
- **Scope:** Workspace-scoped (cannot access outside workspace directory)
- **`.ai-team/` read:** ✅ Full access via `readFile` tool
- **`.ai-team/` write:** ✅ Full access via `createFile` / `editFiles` tools
- **First-time approval:** VS Code may prompt for file modification approval on first write (security feature)
  - **User experience:** "Always allow in this workspace" option available
  - Subsequent writes in same workspace are automatic
- **Tool inheritance:** Sub-agents inherit parent's tools by default (a net positive vs CLI)
- **Parallel operations:** Multiple `readFile` / `createFile` / `editFiles` calls in one turn supported

### Special Tools

- **SQL:** ❌ Not available — avoid SQL-dependent workflows
- **Web fetch:** ✅ Available as `fetch` tool (may require URL approval)
- **GitHub MCP:** ✅ Available if configured in workspace
- **Terminal:** ✅ Available as `runInTerminal` — works for git operations
- **Codebase search:** ✅ Available as semantic (`codebase`) + literal (`searchResults`) search

### Constraints & Caveats

- **Workspace trust:** Squad requires a trusted workspace (VS Code security setting)
- **Single-root workspaces:** Recommended; multi-root has path resolution bugs (vscode#264837, vscode#293428)
- **Silent success bug:** VS Code may report file edits as successful when no changes occurred (vscode#253561) — same bug as CLI's P0 issue (Proposal 015)

---

## JetBrains IDEs (IntelliJ IDEA, PyCharm, etc.)

**Status:** Untested. JetBrains Copilot integration exists but sub-agent spawning mechanisms are not yet documented.

### Known Constraints

- No native Copilot CLI equivalent
- Copilot plugin provides chat but sub-agent spawn capability is unclear
- File discovery and workspace integration differ from VS Code

### Questions to Answer

- Does JetBrains Copilot support agent spawning via a tool equivalent to `task` or `runSubagent`?
- Can agents access workspace files and `.ai-team/` directories?
- What model selection mechanisms exist?
- Is there a background/async mode?

---

## GitHub.com (Copilot Chat in GitHub)

**Status:** Untested. GitHub's web-based Copilot has limited agent orchestration.

### Known Constraints

- Copilot Chat on GitHub.com focuses on issue-centric workflows (not general agent spawning)
- No documented sub-agent spawning mechanism
- Context is limited to conversation scope

### Questions to Answer

- Can GitHub Copilot spawn agents for background work?
- Can agents read `.ai-team/` files from the repository?
- Is there a GitHub-specific command protocol for delegation?

---

## Claude Code

**Status:** Supported through `squad init --client claude` (or `squad upgrade --client claude`), with live lab runs. Per-feature status is in the [Host Feature Matrix](../reference/host-feature-matrix.md); work to make Claude Code a first-class host is tracked in [#2438](https://github.com/github/squad/issues/2438).

### What Squad projects

- `.claude/agents/squad.md` — the coordinator, as a Claude Code subagent named `squad`
- `.claude/agents/<member>.md` — one subagent per team member, built-ins included, generated from `.squad/agents/<member>/charter.md`. `squad cast` adds the new member's file. If you already have your own file at one of these paths, Squad leaves it alone and reports it as skipped.
- `.claude/skills/<name>/SKILL.md` — Squad's skills as native Claude Code skills, plus `squad-coordinator-*` skills the coordinator loads on demand (Init Mode, Ralph, ceremonies, GitHub Issues and PRD modes), which keeps its always-loaded prompt smaller. A team skill of the same name in `.squad/skills/` takes precedence, so that template isn't projected. Your own skills in `.claude/skills/` are left alone.
- `.mcp.json` — the `squad_state` MCP server, merged without touching your other servers
- `CLAUDE.md` — a Squad-managed marker block
- `.gitignore` — `.claude/worktrees/` under a `# squad:claude` comment
- `.claude/settings.json` — Squad's governance hooks, only if you opt in (see below). Your other settings and hooks are kept.

`squad init --client claude` also writes the GitHub Copilot files: `.github/agents/squad.agent.md`, `.github/skills/`, `.copilot/mcp-config.json`, the Squad workflows under `.github/workflows/` and `.vscode/settings.json`. This is intended. GitHub Copilot is the base host. The Claude Code coordinator is generated from the same shared source as Copilot's `.github/agents/squad.agent.md` and is complete on its own: it doesn't read Copilot's file ([ADR-003](https://github.com/github/squad/blob/dev/docs/specification/adr-003-host-neutral-canonical-coordinator.md), option C). Skip the workflows with `--no-workflows` and the VS Code setting with `--no-vscode-default`.

### Starting a session

```bash
claude --agent squad --mcp-config .mcp.json
```

Interactive Claude Code doesn't load project-scoped `.mcp.json` servers until you approve them, so pass the config explicitly. Headless runs (`claude -p`) need `--mcp-config` too, or a prior approval for the project; without it, the coordinator stops at the state-backend handshake.

### Capabilities

| Feature | Status | Notes |
|---------|--------|-------|
| **Sub-agent spawning** | ✅ `Agent` tool | Each member runs as its own subagent (`subagent_type: "<member>"`), which reads its charter. Squad dispatches specialists only from the coordinator; members don't spawn subagents of their own. This is Squad's dispatch policy and doesn't depend on whether your Claude Code version allows nested subagents. |
| **Parallel fan-out** | ✅ | Independent `Agent` calls in one message run in parallel. |
| **Background/async execution** | ✅ `run_in_background` | Validated in live runs. |
| **Worktree isolation** | ✅ `isolation: "worktree"` | Claude Code creates worktrees under `.claude/worktrees/`, which Squad ignores in git. |
| **Per-spawn model selection** | ✅ | A member's subagent uses the Claude model in its charter's `Preferred` field, and the reasoning effort from `.squad/config.json` or the charter. The coordinator passes a per-call `model` when your request, `agentModelOverrides`, `defaultModel` or the session's model takes precedence. Re-run `squad upgrade` after changing reasoning-effort config. A non-Claude model, a one-off effort request and `long_context` without a long-context Claude model are reported rather than applied. |
| **MCP server access** | ✅ | `squad_state` tools appear as `mcp__squad_state__*`; subagents inherit them. |
| **Hooks** | ✅ Opt-in, advisory | Off by default. See [Governance hooks](#governance-hooks). |
| **`squad watch --execute`** | ✅ Preset | `squad watch --execute --agent-preset claude` (or `"agentPreset": "claude"` under `watch` in `.squad/config.json`) runs each round as `claude -p … --agent squad` with a `squad_state`-only MCP config written by the `squad` CLI (never the repository's `.mcp.json`, whose other servers keep Claude Code's approval). Execute mode defaults to `--permission-mode bypassPermissions`, the counterpart of Copilot's `--yolo`; override it with `--claude-flags`. Fleet dispatch (`--dispatch-mode fleet`) stays Copilot-only. |

### Permissions for Squad's own tools

`squad init --client claude` and `squad upgrade --client claude` add these rules to `permissions.allow` in `.claude/settings.json`, so the coordinator can cast a team and use its state without a permission prompt for each call:

- each `squad_state` tool the coordinator uses, by name: `mcp__squad_state__squad_decide`, `…__squad_state_read`, `…_write`, `…_append`, `…_delete`, `…_list`, `…_create_if_absent`, `…_health` and `…_upstreams` (in plugin mode, the same tools under `mcp__plugin_squad_squad_state__`). Not the whole server: the experimental backend tools, such as approving a harness request, and the `memory.*` tools still ask.
- `Bash(squad cast:*)`, `Bash(squad client sync:*)`, `Bash(squad lockout reject:*)` and `Bash(squad lockout status:*)`. Recording a rejection only adds a restriction. The steps that move a lockout toward release (`assign`, `submit`, `approve` and `override`) always ask, so an agent can't clear a lockout on its own.
- The same commands through the repository launcher, `node .squad/squad.mjs …`, only while `.mcp.json` runs Squad's own launcher from a folder inside the repository. A `squad.mjs` Squad didn't write is never pre-approved.

Nothing else is allowed: no edits, no other commands, no other MCP servers. `squad cast` refuses to write through a symbolic link, so a pre-approved cast can't be pointed at a file outside the team folder. Your own rules stay first and are never changed. Squad records the rules it added in `.claude/.squad-permissions.json` (commit it with `settings.json`), and removing Claude Code from the team, or turning the allowlist off, removes only those: a rule you had already written stays. Claude Code applies a project's allow rules only once you've trusted the folder (the trust prompt on your first interactive `claude` run there); until then, and in headless runs in an untrusted folder, it ignores them and says so. To turn the allowlist off, set `"claudePermissions": "off"` in `.squad/config.json` and run `squad upgrade --client claude`.

### Governance hooks

To turn the hooks on, add `"claudeHooks": "advisory"` to `.squad/config.json` and run `squad upgrade --client claude`. Squad then adds these hooks to `.claude/settings.json`:

- **Session start:** the coordinator starts with the roster, routing, active reviewer lockouts and the CLI version its `squad_state` bridge must match.
- **Before an edit:** a member who is locked out of a review subject gets a warning when it edits a file that subject covers. You see the warning too.
- **After a member finishes:** the coordinator gets a handoff summary and a reminder to record decisions and run the reviewer gate.
- **When the coordinator stops:** it's reminded to run Scribe if `.squad/decisions/inbox/` has entries, and you're told if Ralph's circuit breaker is open.

The hooks only warn. They never block a tool call or permission, and they print nothing when hooks are off. To turn them off, set `"claudeHooks": "off"` and run `squad upgrade --client claude` again. Squad removes its hooks and leaves the rest of `.claude/settings.json` as it was.

Reviewer lockouts come from `squad lockout`. For example, after Ripley rejects Dallas's work on issue 42:

```bash
squad lockout reject issue-42 --author dallas --reviewer ripley --reason "no tests for the auth path" --paths "src/auth/**"
```

```bash
squad lockout assign issue-42 --successor lambert
```

`squad lockout status` lists each subject with its state and who can take the next revision. `submit` and `approve` record the revision and its approval, which ends the lockout. `override` lets you, or a member listed in `governance.authorities` in `.squad/config.json`, let a locked-out author back in, with a reason. If no eligible member is left, the subject is marked deadlocked until someone records an override.

---

## Platform Adaptation Guide

### For Developers Using Squad

**Use CLI if:**
- You need sub-agent spawning with full control (model selection, agent type, background mode)
- You use SQL in your Squad workflows
- You want cost optimization via Haiku/Sonnet/Opus tiering

**Use the App if:**
- You want all named specialist missions individually navigable in the native parent/child session tree
- You want stable specialist identity in child titles and native tasks only for small internal checks
- You want a visible current main-session plan via the optional extension, with a chat fallback

**Use VS Code if:**
- You work in VS Code and want seamless integration
- You don't need per-spawn model selection (accept session model)
- You're OK with decision-only Scribe work running synchronously when needed
- You prefer not to see intermediate launch tables

**Using Both:**
- CLI is recommended for initial Squad setup and learning
- VS Code works for day-to-day development once Squad is established
- They share the same `.ai-team/` state — both can read/write the same team files
- Team state is portable — init in CLI, use in VS Code, export/import across repos

### For Squad Developers

**Coordinator instructions:** Edit the canonical `.squad-templates/` sources. Detect all available tools once: direct trivial responses remain direct, named App specialist missions use visible children, and small App internal checks may use native tasks. CLI/VS Code capability fallbacks preserve authorization and disclose missing native sidebar visibility. Never send unsupported fields. The inline-dispatch fallback checks all spawn tools, including `create_session`; Direct Mode does not require delegation.

**Feature Degradation Plan:**

| Feature | Native task | App child | VS Code |
|---------|-------------|-----------|---------|
| **Results** | Direct result or native `read_agent` | Notifications/handoff and `get_session` | Returned result |
| **Same-task reuse** | Only a supported retained lifecycle | Persistent session messaging | New invocation |
| **Execution workspace** | Actual native working directory | Every project specialist: own worktree; explicit outside-project chat: no checkout | Workspace-scoped |
| **Named mission visibility** | No App tree implied | Same-project child, stable icon/label/mission; explicit chat stays under Chats | No App tree implied |
| **Scribe** | Accepted durable decisions only | Same scope; coordinated child when delegated | Same scope, sync |
| **Visible plan / SQL** | Optional tools with visible chat fallback | Optional tools; not approval or mode change | Do not assume tool availability |

---

## Investigation Status

This document is based on active research spikes (#32, #33, #34) conducted in February 2026. Key findings:

- **Proposal 032a** (Strausz): `runSubagent` API research — agent spawning mechanics on VS Code
- **Proposal 032b** (Kujan): CLI spawn parity analysis — all 5 Squad spawn patterns mapped
- **Proposal 033a** (Strausz): VS Code file discovery — `.ai-team/` access and workspace scoping
- **Proposal 034a** (Kujan): Model selection & background mode — per-agent model routing and async execution

**Next steps:**
- [ ] JetBrains investigation spike (#12)
- [ ] GitHub.com investigation spike (#13)
- [ ] VS Code custom agent generation during `squad init` (Phase 2, v0.5.0)
- [ ] Empirical testing of Response Order bug workaround on VS Code

---

## See Also

- [Squad in VS Code](../features/vscode.md) — Getting started with VS Code, what's different from CLI
- [Model Selection](../features/model-selection.md) — Cost-first routing across agents
- [Parallel Execution](../features/parallel-execution.md) — Background and sync patterns
- [Worktrees](../features/worktrees.md) — Multi-branch isolation
- [Troubleshooting](./troubleshooting.md) — Common questions and answers
