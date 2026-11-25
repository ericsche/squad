---
"@bradygaster/squad-sdk": patch
"@bradygaster/squad-cli": patch
---

Make runtime-required security reviews visible in the Copilot App without
changing the review. The native `security-review` now runs as the first action
of one branded App security session (`🛡️ Security · {mission}`, created with
`create_session` on the parent worktree read-only), so it appears as a linked
sub-session with the same reviewer, target, scope and result; that session
presents the findings and hands the complete report back. The coordinator
writes the mission's SQL tasks and readable plan no later than that creation,
adds the session's verified link to the plan, then dispatches requested
follow-up (such as dependency updates) gated on the report. When App child
sessions are unavailable, the native reviewer runs in the main session with the
same branded label and an App restitution owner is created alongside any
host-required question.
