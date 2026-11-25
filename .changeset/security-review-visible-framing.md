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
request, writes the mission's SQL tasks and readable plan, creates the branded
`🛡️ Security · {mission}` restitution sub-session, which starts no review and
waits for the report, and links it in the plan. The report goes to the
sub-session alongside any host-required findings table or question, and
requested follow-up such as dependency updates is dispatched afterwards.
