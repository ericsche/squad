---
"@bradygaster/squad-sdk": patch
"@bradygaster/squad-cli": patch
---

Make runtime-required security reviews visible in the Copilot App without
changing the review. The coordinator still invokes the native `security-review`
itself, labelled `🛡️ Security · {mission}`, and writes the mission's SQL tasks
and readable plan no later than that call. In the same tool batch, never
before it, it creates the branded `🛡️ Security · {mission}` restitution
sub-session, which starts no review and waits for the report; with background
scheduling the plan gets that sub-session's verified link while the review
runs. When the report returns, it goes to the sub-session alongside any
host-required findings table or question rather than after its answer, and
requested follow-up such as dependency updates is dispatched afterwards. The
reviewer's prompt, scope, order and result are unchanged.
