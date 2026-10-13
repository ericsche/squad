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
2. If absent, it publishes only when the user requested or authorized a plan.
3. If present, it preserves the user's plan and deliberately reconciles any
   requested change. A new publication is not an overwrite operation.
4. Before a deliberate update, it reads again and supplies that snapshot's
   hash with the reconciled complete content.
5. On conflict, it reads and reconciles again with the user, rather than
   automatically retrying with a new hash.

Background specialists return evidence and proposed progress to the
foreground coordinator; they do not publish or update its plan. Invocations
for another session and writes attributed to subagents are refused.
Some hosts omit subagent attribution (`agentId`); on those hosts the extension
cannot distinguish an unattributed subagent from the root caller.
Foreground-only writing remains an orchestration requirement, not a complete
caller authentication guarantee.

TODOs and dependency edges remain execution internals. There are no event
hooks, timers, background writes, or automatic SQL-to-plan synchronization.
Reloading/resuming re-registers tools without publishing anything; the next
explicit read observes the existing host state.

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
