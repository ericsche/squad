---
"@bradygaster/squad-sdk": patch
"@bradygaster/squad-cli": patch
---

Make Squad work like a project team in the Copilot App. The coordinator staffs
each part of a request from `routing.md` without asking the user who should do
it, and names each mission's peer reviewer and teammates in its kickoff. Before
a mission's commits are integrated, a different member whose route covers the
change reviews them in its own read-only sub-session and approves, requests
changes or rejects; requested changes go back to the author's existing
sub-session and then to the same reviewer, with the user brought in after two
rounds. When a member needs another member's expertise it asks the coordinator,
which brings that member in and passes the answer back. In the App, a triggered
ceremony runs as one facilitator sub-session instead of nested sessions.

At the end of a request, finished sub-sessions are archived even when another
mission ends blocked on something only the user or an outside change can
resolve; the blocked mission's sub-session is kept, and the final message says
which sub-sessions were kept and why. The native security reviewer's label no
longer reads like "Of dependencies".
