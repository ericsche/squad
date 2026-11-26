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

Dev and security work now defaults to `mai-code-2` with `high` reasoning
effort, above the model the coordinator session runs on: members whose
`team.md` role writes code (implementation, tests, infrastructure), members
with a security role, any security mission and the native security reviewer.
Config and per-spawn choices still win, the `economy` and `hydrafusion`
profiles turn it off, and it applies only when the host lists the model. The
security-framing extension, which owns the native reviewer's call, applies the
same policy to it under its own config key, `security-review`. The SDK's central
resolver gains a matching `work-default` source: callers pass `workModel` for dev
or security work, and it applies after config and before the session model.
