# Native Current-Session Plan

Squad can publish a visible plan into the **current foreground Copilot App
session**, separate from its internal TODO rows and dependency edges. This is
the host's genuine session plan, accessed through `session.rpc.plan.read/update`
after the extension joins the foreground session with `joinSession()`. It is
not a repository Markdown file, a child session, or a custom canvas.

The host owns presentation and approval. Squad does not switch session modes,
approve plans, or treat a successful publication as approval. Native display
depends on the host surface; RPC verification alone does not prove that the UI
displayed the plan.

## Installation

`squad init` and `squad upgrade` install these **user-owned** files:

```text
.github/extensions/squad-session-plan/
├── extension.mjs
└── plan-tools.mjs
```

The extension imports the host-resolved `@github/copilot-sdk/extension`.
No extension-local npm installation or `squad plugin install` is needed.
Squad's declarative plugin installer is not the installation path for
executable `.mjs` extensions.

Both files are installed only if absent. Existing copies survive init and
upgrade. Differences from bundled templates are reported by the existing CLI
warning output (newline-only differences are ignored). Reconcile both files
manually before reloading if they differ; an upgrade does not replace a
customized entry or helper. Installation does not automatically reload
extensions.

The host must support extensions, a current-session workspace, and the
experimental plan RPC. The installed host SDK can differ from the npm SDK used
by Squad. Use host extension reload/inspection tools to activate and diagnose
the extension; there is no hard-coded host version requirement.

## Explicit tool contracts

| Tool | Input | Behavior |
|------|-------|----------|
| `squad_session_plan_read` | `{}` | Reads a fresh snapshot, returning `fresh` when absent or `existing` when present. Never writes. |
| `squad_session_plan_publish` | `{content}` | Publishes non-empty Markdown only when no plan exists, then re-reads to verify. Refuses even an existing empty plan. |
| `squad_session_plan_update` | `{content, expectedHash}` | Replaces an existing plan only when its freshly read content hash matches `expectedHash`, then re-reads to verify. Refuses an absent plan. |

Each tool returns the SDK-standard `{textResultForLlm, resultType}`. The text
is JSON with `status`, `operation`, `sessionId`, `freshness`, `writeAttempted`,
and `verified`. Snapshot-bearing results also contain `exists`, `content`,
`path`, and `hash`. `hash` is SHA-256 of the exact UTF-8 content, without
newline normalization; it is `null` when absent.

`fresh`, `existing`, `published`, and `updated` use `resultType: "success"`.
Only verified publications/updates return `verified: true`. `conflict`,
`unavailable`, `error`, `invalid`, and `denied` use `resultType: "failure"`
with an explanation and actionable next step. RPC exceptions also carry
`stage` and `errorCode` when available; the original host error is surfaced,
not silently retried. Failures are logged through `session.log()` or stderr
when timeline logging is unavailable.

## Foreground-owned workflow

1. The foreground coordinator reads the current plan.
2. If absent, it deliberately publishes readable context for the user's current
   substantive mission (including delegated read-only work), or an explicit
   planning request. The mission needs no separate request containing "plan".
   Do not publish unrelated/unsolicited plans, or override an explicit refusal
   of plan metadata or an existing approval/input gate.
3. If present, it preserves the user's plan and deliberately reconciles any
   requested change. A new publication is not an overwrite operation.
4. Before a deliberate update, it reads again and supplies that snapshot's
   hash with the reconciled complete content.
5. On conflict, it reads and reconciles again with the user, rather than
   automatically retrying with a new hash.

The absent-plan reader's `action` and publication tool description express
this same boundary. "Explicit foreground-coordinator publication" means a
deliberate tool invocation, not an extra per-tool consent question or a new
authorization token. The handler does not infer a user's mission or consent
from the Markdown; following that scope/refusal rule remains the caller's
responsibility. A read still never writes, and startup/reload never publishes.

An ordinary substantive goal such as "Review the solution's architecture"
therefore has both task progress and readable context, even with one genuine
owner task. Preserve that task rather than padding a checklist. The context
explains purpose, actual scope/exclusions, acceptance, the verified owner and
host-supplied child link, and later the outcome and limitations. Add next work
or a decision only when it exists. Keeping repository files read-only does
not prohibit mission task/plan metadata, authorize source edits or approve
executing recommendations. An explicit request not to maintain a plan is
respected rather than disguised as an unavailable tool.

Discover the actual schemas and use the supported tools: a successful read
returning `exists: false` is not a publication, nor evidence of a rendering
failure. If discovery or RPC fails, report the specific limitation and show
the visible fallback. Never write `plan.md` directly. The existing hash,
re-read, verification and non-atomic race limits still apply.

Background specialists return evidence and proposed progress to the
foreground coordinator; they do not publish or update its plan. Invocations
for another session and writes attributed to subagents are refused.
Some hosts omit subagent attribution (`agentId`); on those hosts the extension
cannot distinguish an unattributed subagent from the root caller.
Foreground-only writing remains an orchestration requirement, not a complete
caller authentication guarantee.

TODOs and dependency edges can also feed the host's structured task view, as
described below. There are no extension event hooks, timers, background writes,
or automatic SQL-to-Markdown synchronization.
Reloading/resuming re-registers tools without publishing anything; the next
explicit read observes the existing host state.

## Native tasks and readable context

For multi-step work, Squad uses the current session's SQL `todos` and
`todo_deps` as the **single authoritative task-state source** when the `sql`
tool is available. Short gerund titles such as "Inspecting scope" and
"Verifying outcome" are the task labels; descriptions carry the owner,
acceptance evidence and any blocker. Dependencies represent real prerequisites,
not simply the order of the list. Existing task IDs stay stable, and updates
are scoped to this request's rows, preserving unrelated and user-authored tasks.

The experimental host SDK documents
`session.rpc.plan.readSqlTodosWithDependencies()` as a reader of those SQL
rows and edges **for structured progress UI**. SQL writes to either table
signal `session.todos_changed`; clients can read on session start and refresh
on that event. `readSqlTodos()` is the rows-only reader. These are host APIs,
not tools added by Squad, and the extension does not emit events manually.
The readers can return empty arrays when the database, tables or queries are
unavailable; an empty result is not evidence that work is completed.

In contrast, `plan.update` takes only `{content: string}` and writes Markdown.
It has no structured task field. Markdown checklists do **not** establish the
native task timeline. The exact visual layout and ordering are not verified
by these API contracts or by a successful SQL/Markdown write; presentation
still belongs to the host.

The default native plan therefore avoids a duplicate Markdown task-state
table/checklist or a separately maintained progress count. Its body explains
the work so the user can follow along:

```markdown
# Review the proposed change

**Next / limits:** Check the proposed scope; read-only review, no new execution approval.

**Assigned work:** Reviewing scope - assigned owner; Pending dispatch, no session yet.

## Details

We are reviewing whether the proposed change meets the user's request without
expanding its scope. Implementation and deployment are excluded.

Inspecting scope establishes the boundaries. Reviewing behavior checks the
proposal against those boundaries. Verifying evidence establishes whether the
required checks support the conclusion.

**Acceptance and constraints:** A clear review conclusion supported by relevant
evidence; existing user approval and reviewer gates still apply.

**Evidence / provenance:** Add relevant findings and references here, after the
explanation. Historical setup is context, not progress on this review.
```

Task state belongs in the host's task area; useful human-readable purpose,
scope, step explanations, constraints and acceptance belong in Details.
Long SHAs, worktree paths and technical provenance come later, not before the
user-facing explanation. A brief permitted next action and authorization limit
remain easy to find.

After a real App child launch succeeds and its session/project association is
verified, the coordinator replaces that pending assignment with a readable
Markdown link to the **actual child session** near the work item and owner.
Use the exact canonical `app_url` returned by the host when available, or read
it with `list_sessions_and_chats`, and use it verbatim. Each independently
assigned outcome maps to its own child link; the same mapping is reconciled
as the work progresses.

Before launch, after a failed launch, or on a native-agent fallback without an
App session, show the actual state without a fabricated link. If the child
exists but its canonical URL is unavailable, say "launched; link unavailable".
Do not construct App URLs, use a raw GUID as the only navigation pointer, or
link a charter in place of the working session. Preserve existing valid user
links and reconcile any change of mission rather than silently redirecting them.

This is a standard Markdown link in readable plan context, **not** a native
task-row hyperlink or a guarantee of successful navigation. SQL task titles
stay concise, and no `session_id` column or new host API is introduced.
String/contract tests and persisted Markdown do not verify link navigation
or its rendering in the native Plan panel; that remains a user-visible check.

If the structured view or native tools are unavailable, Squad shows a visible
Markdown/chat fallback with `## Tasks` as a short checklist before
`## Details`. That summary is derived from the same task states when SQL is
available, not a second independent task store. Without SQL, the coordinator
maintains the visible tasks explicitly and discloses the limitation. Labels
are short gerunds with human-readable states, not tables, ASCII bars, HTML/CSS
widgets or emoji-only signals.

## Keeping progress truthful

The existing SQL tool supports `pending`, `in_progress`, `done` and `blocked`.
These correspond to Pending (including queued), In progress, Completed and
Blocked / Needs input. `done` requires a verified requested outcome, including
required validation and integration, not an idle agent or an elapsed-time guess.
Failed or Cancelled work is not done: where the SQL schema cannot express
those states separately, use `blocked` and explain the exact state/reason in
the description and any fallback summary.

At a meaningful status change, the coordinator reads the relevant task rows
and current plan, reconciles result evidence and refreshes the task states,
current activity/owner, next permitted action, real blockers/decisions and
readable context, including verified assignment links, together. For parallel work, it identifies the active owners
and actual blockers rather than declaring every task blocked. Existing
approval/input gates still require the user's decision.

If a fallback includes an overall state or completed/total count, derive it
from this request's actionable milestones, counting each once. Historical
setup and unrelated tasks do not count. Unknown scope means "not yet scoped",
not an estimated percentage. Failed/Cancelled milestones stay non-completed
and in the total unless an authorized scope change explicitly removes them.
Only verified completion of every required outcome permits Overall Completed
and no further required action. Only Completed tasks get checked in a fallback;
all other states remain unchecked and labeled.

SQL and Markdown writes are **not atomic**, and no hook synchronizes them.
If a task update or plan write fails, report the mismatch and reconcile it
deliberately without bypassing the plan hash guard. Do not change just one
task/checkbox and leave a stale next action, count or explanation behind.

These are coordinator prompt defaults, not deterministic format enforcement
or proof that a model follows them. The extension continues to accept arbitrary
custom Markdown byte-for-byte; older/user-authored plans are preserved and
reconciled deliberately, not silently reformatted or rejected.

These defaults ship in the coordinator and after-agent reference templates.
Activate instruction changes by reloading/reselecting Squad or starting a fresh
Squad session as supported by the host. Updating the files alone does not
promise that an existing conversation has refreshed its loaded instructions.
The helper's absent-plan guidance is a separate loaded extension surface.

If upgrading from a helper that says "Publish only on explicit request",
reconcile its installed **user-owned** `plan-tools.mjs` with the updated
bundle and use that target host's normal extension reload. An ordinary
init/upgrade preserves existing extension files, so a newer CLI or refreshed
coordinator alone does not prove that the loaded helper's guidance changed.
Do not overwrite local customizations or claim activation from file copying.

## Freshness and concurrency limits

Own publish/update requests are serialized **within one extension instance**.
Each writer reads before writing and verifies the result by re-reading. This
prevents two writers in that instance from blindly overwriting each other.

The host offers **no atomic compare-and-swap**. The hash check and update are
separate RPC calls: a user or another extension can edit between them.
Verification detects changes visible at re-read, but cannot prevent all lost
updates, detect an edit that was already overwritten, or guarantee the state
after verification. A matching content hash is a content snapshot, not a
host revision token or proof of approval.

If update or verification fails after a write was attempted, the outcome is
uncertain. Read again before taking further action. There is no automatic
retry or rollback that could clobber a user's edit.

## Unavailable host or UI

Missing workspace/API support returns an actionable unavailable/error result,
not a claimed publication. Check host support, enable a session workspace
where supported, and reload the extension before reading again.

If native tools or their UI are unavailable, show the plan visibly in chat
and label it as a fallback. Do not claim a native artifact or native approval.
The extension never writes a repository file or creates a session to simulate
native display.
