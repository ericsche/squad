---
name: "coordinator-init-mode"
description: "Two-phase team formation when team.md is absent or there is no active specialist in Members, including installed scaffolding. Reuse the user's goal, propose a team and await confirmation before domain work or dispatch; then reconcile the roster, routes, casting and charters."
allowedTools: []
confidence: high
domain: squad-internals
source: "Coordinator team formation protocol, aligned with the existing roster/capability semantics and Init Mode entry."
---

> **Load this skill when:** `team.md` is absent or there is no active specialist in Members at the resolved team root, including a scaffold created by `squad init`. Apply the coordinator's roster/capability semantics, including legacy team paths/headings and casting statuses. Headers, the coordinator, support identities and the coding agent do not constitute a domain team. Preserve an existing active specialist team instead of recasting it.
>
> **Formation boundary:** Before substantive domain work, including an audit, or specialist dispatch, obtain the user's roster confirmation. Machine scaffolding is not confirmation. Trivial facts may still be answered directly; neither a task request nor visible progress authorizes forming an unapproved team.

## Phase 1: Propose the Team

The files may already be installed, but the team is not yet constituted. **Propose one — but do not create or change team files until the user confirms.**

1. **Identify the user.** Run `git config user.name` to learn who you're working with. Use their name in conversation. Store their name (NOT email) in `team.md` under Project Context only after confirmation. **Never read or store `git config user.email`** — email addresses are PII and must not be written to committed files.
2. **Reuse the user's existing goal, project context and collected evidence.** Preserve the existing audit and plan; they are inputs, not consent to form a team. Read only enough project context to propose relevant roles, not to perform the substantive audit inline. Ask for the project purpose/stack only if it is genuinely missing; do not repeat an interview or ask the user to resubmit the goal with agent names or tool instructions.
3. **Cast the team.** Before proposing names, run the Casting & Persistent Naming algorithm (see the canonical Casting reference at `.squad/templates/casting-reference.md`):
   - Determine team size: pick **4–5 cast (user-domain) agents**, then add the **4 always-on built-ins** (Scribe + Ralph + Rai + Fact Checker — see their dedicated sections in `squad.agent.md`). A typical fresh squad has **8–9 total roster entries**, not 4–5.
   - Determine assignment shape from the user's project description.
   - Derive resonance signals from the session and repo context.
   - Select a universe. Allocate character names from that universe.
   - Scribe is always "Scribe" — exempt from casting.
   - Ralph is always "Ralph" — exempt from casting.
   - Rai is always "Rai" — exempt from casting.
   - Fact Checker is always "Fact Checker" — exempt from casting (same pattern as Scribe / Ralph / Rai).
4. Propose the team with their cast names. Example (names will vary per cast):

```
🏗️  {CastName1}  — Lead          Scope, decisions, code review
⚛️  {CastName2}  — Frontend Dev  React, UI, components
🔧  {CastName3}  — Backend Dev   APIs, database, services
🧪  {CastName4}  — Tester        Tests, quality, edge cases
📋  Scribe       — (silent)      Memory, decisions, session logs
🔄  Ralph        — (monitor)     Work queue, backlog, keep-alive
🛡️  Rai         — (background)  RAI awareness, content safety
🔍  Fact Checker — (verifier)    Verification + Devil's Advocate
```

5. Use the `ask_user` tool to confirm the roster. Provide choices so the user sees a selectable menu.

   The `question` must be **self-contained** because the client may render the blocking input request without the assistant text that preceded it.

   The `question` must reuse every roster line from the exact proposal emitted in step 4, in the same order. Do not regenerate, summarize, truncate, omit, or replace any roster row with an ellipsis. Every proposed member must appear with their emoji, cast name, role, and concise responsibility/scope — including all four always-on built-ins (Scribe, Ralph, Rai, Fact Checker).

   Shape:

   ```
   Confirm this team (universe: {ActualUniverse}):

   {Every roster line from step 4, copied in full and in order}

   Look right?
   ```

   Never use a bare "Look right?" question and never rely on preceding assistant output to identify the team being confirmed.

   - **choices:** `["Yes, hire this team", "Add someone", "Change a role"]`

**⚠️ STOP. Your response ENDS here. Do NOT proceed to Phase 2. Do NOT create any files or directories. Wait for the user's reply.**

---

## Phase 2: Create the Team

**Trigger:** The user confirmed the specific roster proposed in Phase 1 ("yes", "looks good", or the equivalent choice). A new or repeated business task alone is not roster confirmation.

> If the user said "add someone" or "change a role," go back to Phase 1 step 3 and re-propose. **Do NOT enter Phase 2 until the user confirms.**

6. After confirmation, reconcile the actual roster, routes, casting registry and charters as one coherent team using the existing casting/state tools and formats. Preserve installed scaffolding, user customizations and prior evidence; create only missing team structure rather than resetting existing files (see `.squad/templates/` for format guides).

**Casting state initialization:** Reuse the installed casting policy and the canonical registry/history schemas and transaction mechanism from the casting reference. Record confirmed active domain specialists and the initial assignment snapshot coherently; do not replace a valid pair with an ad hoc legacy format or put support identities in the specialist registry. Use configured runtime state tools when required by the backend.

**Seeding:** Each agent's `history.md` starts with the project description, tech stack, and the user's name so they have day-1 context. Agent folder names are the cast name in lowercase (e.g., `.squad/agents/ripley/`). The Scribe's charter includes maintaining `decisions.md` and cross-agent context sharing. Rai's charter is seeded from the `Rai-charter.md` template, and `.squad/rai/policy.md` is seeded from `rai-policy.md`. Fact Checker's charter is seeded from `fact-checker-charter.md` and `.squad/fact-checker/policy.md` is seeded from `fact-checker-policy.md`.

**Team.md structure:** `team.md` MUST contain a section titled exactly `## Members` (not "## Team Roster" or other variations) containing the roster table. This header is hard-coded in GitHub workflows (`squad-heartbeat.yml`, `squad-issue-assign.yml`, `squad-triage.yml`, `sync-squad-labels.yml`) for label automation. If the header is missing or titled differently, label routing breaks.

**Merge driver for append-only files:** Create or update `.gitattributes` at the repo root to enable conflict-free merging of `.squad/` state across branches:

```
.squad/decisions.md merge=union
.squad/agents/*/history.md merge=union
.squad/log/** merge=union
.squad/orchestration-log/** merge=union
.squad/rai/audit-trail.md merge=union
```

The `union` merge driver keeps all lines from both sides, which is correct for append-only files. This makes worktree-local strategy work seamlessly when branches merge — decisions, memories, and logs from all branches combine automatically.

7. Verify that the confirmed specialists, their routes, active registry entries and charter files agree, then refresh the existing capability advertisement. Report the team as configured only after that verification. Resume the original user goal through its actual accountable specialist, retaining the collected evidence and the user's scope; in the App use a real coordinated project child and link it in the plan after verified creation. Do not require the user to name a member or force unnecessary parallel agents.

8. **Post-setup input sources** (optional — ask after team is created, not during casting):
   - **PRD/spec:** *"Do you have a PRD or spec document? (file path, paste it, or skip)"* → If provided, follow PRD Mode flow.
   - **GitHub issues:** *"Is there a GitHub repo with issues I should pull from? (owner/repo, or skip)"* → If provided, follow GitHub Issues Mode flow.
   - **Human members:** *"Are any humans joining the team? (names and roles, or just AI for now)"* → If provided, add per Human Team Members section.
   - **Copilot agent:** *"Want to include @copilot? It can pick up issues autonomously. (yes/no)"* → If yes, follow Copilot Coding Agent Member section and ask about auto-assignment.
   - These are additive. **Don't block** — if the user skips or gives a task instead, proceed immediately.
