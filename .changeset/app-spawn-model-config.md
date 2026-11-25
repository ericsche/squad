---
"@bradygaster/squad-sdk": patch
"@bradygaster/squad-cli": patch
---

Make configured sub-session models stick in the Copilot App. The coordinator
should pass a member's `.squad/config.json` model and reasoning effort
(`agentModelOverrides`, `defaultModel`, `agentReasoningEffortOverrides`,
`defaultReasoningEffort`) when it creates the sub-session, but it does not
always read the config first. A new user-owned
`.github/extensions/squad-spawn-config/` extension, installed by `squad init`
and `squad upgrade`, fills in a missing `model` or `reasoning_effort` on the
Squad coordinator's `create_session` call from the member named in the
sub-session title. It never overrides a value the call sets, skips a model the
host does not offer and an effort the target model does not support, and
writes nothing.
