---
"@bradygaster/squad-sdk": patch
"@bradygaster/squad-cli": patch
---

Make runtime-required security reviews visible in the Copilot App without
changing the review. The coordinator still invokes the native `security-review`
itself, labelled `🛡️ Security · {mission}` and in the background when the
host allows, and writes the mission's SQL tasks and readable plan in the same
tool batch, which holds nothing else. Only after that call returns its handle
does it create the branded `🛡️ Security · {mission}` restitution sub-session,
which starts no review and waits for the report, and link it in the plan while
the review runs; a synchronous reviewer gets the sub-session with its report.
The report goes to the sub-session alongside any host-required findings table
or question rather than after its answer, and requested follow-up such as
dependency updates is dispatched afterwards. The reviewer's prompt, scope,
order and result are unchanged.
