---
"@bradygaster/squad-sdk": patch
"@bradygaster/squad-cli": patch
---

Keep the Copilot App sidebar to active work. Squad still gives each specialist
mission its own sub-session, and finished ones stay available for follow-ups
while the request continues. When the whole request is done, with each mission
verified completed and integrated into the parent (or read-only), the
coordinator archives the request's sub-sessions with `archive_session`. It never archives
a sub-session that is busy, waiting for an answer or plan approval, holding
work not yet integrated or committed, an open pull request or a session automation,
one that may still receive a same-mission follow-up, or one the user asked to
keep. Archiving keeps the conversation history; only the user can restore it,
and only that brings the conversation back, so for a later follow-up on that
mission the coordinator asks the user to restore it or starts a new sub-session
from its kickoff and report.

When a later request in the same conversation rewrites the plan, every earlier
mission keeps its own session link next to its summary (marked archived once
archived) instead of being folded into unlinked prose.
