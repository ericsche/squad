---
"@bradygaster/squad-sdk": patch
"@bradygaster/squad-cli": patch
---

Make runtime-required security reviews visible in the Copilot App without
changing the review: publish the mission's SQL tasks and readable plan
immediately before the native `security-review` (review in progress,
restitution and requested follow-up pending), label the native call with the
`🛡️ Security · {mission}` title pattern, and continue to the branded App
restitution owner in the same turn after a host-required findings table or
follow-up question. The reviewer's prompt, scope, order and result are unchanged.
