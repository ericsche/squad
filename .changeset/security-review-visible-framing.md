---
"@bradygaster/squad-sdk": patch
"@bradygaster/squad-cli": patch
---

Make runtime-required security reviews visible in the Copilot App without
changing the review: publish the mission's SQL tasks and readable plan
no later than the tool call that starts the native `security-review` (review in progress,
restitution and requested follow-up pending), label the native call with the
`🔒 Security · {mission}` title pattern, and create the branded App restitution
owner alongside any host-required findings table or follow-up question rather
than after its answer. The reviewer's prompt, scope, order and result are unchanged.
