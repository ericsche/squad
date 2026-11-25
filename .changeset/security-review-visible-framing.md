---
"@bradygaster/squad-sdk": patch
"@bradygaster/squad-cli": patch
---

Make runtime-required security reviews visible in the Copilot App without
changing the review. The host applies "invoke security-review first"
literally, so the coordinator now calls the native `security-review` first and
alone, labelled `🛡️ Security · {mission}` and in the background when the host
allows, and writes nothing before it. A new user-owned
`.github/extensions/squad-security-framing/` extension, installed by
`squad init` and `squad upgrade`, applies that label and background mode to
the Squad coordinator's own reviewer call and returns the next steps with its
handle; it never changes the review's prompt, agent or result and writes
nothing itself. While the review runs, the coordinator acknowledges the
request and writes the mission's SQL tasks and readable plan; the native
reviewer is the only agent doing the review, so no waiting child is created.
When the report returns, the coordinator creates the restitution owner with
it, named as a synthesis such as `🏗️ Lead · Security report synthesis` and
linked in the plan, alongside any host-required findings table or question.
Requested follow-up that needs only the report, such as dependency updates, is
dispatched to its branded owner in that same step instead of waiting behind
the question; a fix chosen in the answer goes to the matching owner.
