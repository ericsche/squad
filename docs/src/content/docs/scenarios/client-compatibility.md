# Copilot Client Compatibility Matrix

> **Quick answer:** Not sure which interface to use? See [Choose your interface](../get-started/choose-your-interface.md) for a concise decision tree and comparison.

Squad runs on multiple Copilot surfaces — each with its own agent tools and lifecycle. In the Copilot App, all named specialist missions use visible coordinated child sessions, including short and read-only work. Native tasks remain available for small internal checks, while trivial questions stay direct. This document distinguishes those paths from CLI, VS Code, JetBrains, and GitHub.com.

## Quick Reference

| Feature | Copilot App | CLI | VS Code | JetBrains / GitHub.com |
|---------|-------------|-----|---------|-----------------------|
| **Named specialist missions, including short/read-only** | Visible coordinated `create_session` child | `task`; no App tree implied | `runSubagent` / `agent`; no App tree implied | Not established here |
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
2. **App specialist mission:** Every mission delegated to a named Squad specialist uses `create_session` with `coordinate_with_creator: true` and `notify_on_idle: "once"`, even a short review, read-only analysis or bounded edit. Choose the lightest persistent child with established source access.
3. **Native internal check:** Use `task` only for small bounded internal checks, such as running a known test selector or checking one explicit output against an existing requirement. A specialist-owned deliverable is not an internal check merely because it is short or read-only.

The native sidebar hierarchy comes from actual App child sessions, not native task labels, hooks or an in-chat launch table. Do not claim to migrate task histories into it, create fake sessions or rerun historical completed work just to fill the tree. Preserve the specialist's persona and accountable ownership; parallel work still requires independently deliverable outcomes or concrete bounded collaboration, not automatic fan-out.

If `create_session` is unavailable, native `task` or VS Code `runSubagent` can preserve bounded specialist work within authorization and workspace safety, but disclose **degraded native sidebar visibility**. Those agents are not App children. A failed child creation is a blocker to report, not permission to silently substitute a native specialist. Stop if the fallback cannot preserve required isolation or persistence.

### Native visual identity

Use the child's native `name` field for **icon + specialist label + mission**, for example `🧭 Orchestration · Sessions visibles`. Resolve identity from the active specialist's charter/roster and role emoji mapping, not a historical cast or invented member. Keep the icon and readable label stable for that specialist. The exact canonical specialist name stays explicit in the kickoff prompt and main-session plan.

Titles are limited to 40 characters: shorten the mission first, then choose a stable compact role label if necessary. This static identity is not the App's **busy/idle/error** state. Do not simulate avatars, colors, status badges or a custom sidebar canvas; the host owns status and rendering.

### Authorization is separate from scheduling

Every prompt carries `inspect/read-only`, `propose/plan`, or `authorized execution`, allowed actions/files, exclusions and evidence requirements.
The [App session documentation](https://docs.github.com/en/copilot/how-tos/github-copilot-app/agent-sessions) distinguishes:

- **Plan:** Prepare a plan for user review before execution.
- **Interactive:** Guided collaboration and input.
- **Autopilot:** Autonomous execution of authorized work.

"Inspect and propose" must not become an autopilot implementation. Authorized bounded execution can use autopilot by default when permitted without introducing a redundant approval step. Existing user plan/input gates still apply: read the current gate, preserve its exact `request_id`, and obtain the required user decision. Do not auto-approve or change modes to evade it. A prompt defaults to plan if `kickoff.mode` is omitted.

Native sync/background scheduling is a different choice, applicable to internal checks or specialist work on fallback hosts. Use sync when a bounded result is needed now. Background is justified only by independent foreground work or a genuinely needed retained same-task follow-up supported by the host. Some App `task` schemas do not expose `mode`; inspect the current schema instead of copying CLI fields.

### Results, workspaces and integration

- **Native:** Use the synchronous `task` response, or a known native `agent_id` with `read_agent` after a supported background notification.
- **Persistent App child:** Use notifications/`send_session_message` reports with the kickoff `assignment_id` and `purpose: handoff`, `needs_input`, or `error`; use `get_session` for current status, workspace or gates. Its App session ID is not a native `agent_id`.
- Use ordinary `message` delivery when the host does not permit `coordinator_instructions` for an ordinary parent. That coordinator-only field is not universally available; do not bypass its permissions.
- Continue the same App specialist mission in its existing child rather than moving a short follow-up to native `task`. Native sync task agents cannot receive `write_agent` follow-ups in hosts that reject them; only fallback-host work may need a fresh same-persona invocation. Never use an unrelated worker pool.
- Obey current tool wait limits (at most 180 seconds where exposed); no hardcoded 300-second wait or needless polling.
- Share parent identity/source context explicitly, not parent code execution paths. For read-only analysis, a `session_kind: "chat"` child is appropriate only with supplied exact artifacts or verified accessible read-only sources; it has no checkout and does not inherit parent filesystem access. If access cannot be established, use a supported project child with the same explicit read-only scope.
- Specialist code work needing isolation uses `session_kind: "project"` and `workspace_type: "worktree"`, executing code/tests in the child's own workspace. Omit `base_branch` unless explicitly requested or a documented in-progress branch is a real dependency; do not implicitly stack.
- Child commits are not automatically integrated into the parent. Verify deliverables and validation, then perform separately authorized integration before claiming the parent branch contains the result.
- Children do not spawn further children or hide additional specialist missions in native tasks. Return those missions to the coordinator for visible sibling sessions.

An end-of-agent-turn, idle notification or native `onSubagentStop` hook is not proof of success. Report **in-progress**, **blocked/needs_input**, **completed (verified outcome)**, **failed**, or **cancelled** with meaningful evidence, not acknowledgment/status chatter. Files alone may be partial or invalid. The foreground coordinator updates its main-session plan from actual child progress/results, and must not report parent completion while a required running/incomplete subtask remains.

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
| **Execution workspace** | Actual native working directory | Chat: no checkout, established source access; project: child's own workspace | Workspace-scoped |
| **Named mission visibility** | No App tree implied | Actual coordinated child, stable icon/label/mission | No App tree implied |
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
