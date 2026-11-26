# Plugin Marketplace

Plugins are curated agent templates, skills, instructions, and prompts shared by the community via GitHub repositories (e.g., `github/awesome-copilot`, `anthropics/skills`). They provide ready-made expertise for common domains — cloud platforms, frameworks, testing strategies, etc.

## Recommended .NET / Microsoft 365 guidance and optional setup

Recommended guidance is not a business-work prerequisite. Adding a Microsoft 365
Agents SDK .NET member may record useful recommendations, but does not trigger
installation, provider verification or a mandatory initialization mission.
Do not call verify or onboard automatically at member addition or child startup.
Dispatch the real authorized work. Use relevant skills already legitimately exposed
by the host through the actual skill tool. Do not require provider verification merely to invoke a skill already legitimately exposed by the host.
If an optional bridge, provider or skill is unavailable, disclose that limitation
once. Continue otherwise-authorized work with existing project context, official documentation and standard tools.

The user describes a goal such as "Build a Teams/M365 agent in C#." Squad identifies
the role/domain and offers that SDK profile; the user need not know cast IDs, skills,
marketplace names or commands. If the goal leaves the SDK choice unclear, clarify the
product goal, not plugin internals. **Do not apply this recommendation automatically to generic .NET/C# or
Microsoft Agent Framework profiles** (including ordinary `Squad.Agents.AI` work).
Microsoft 365 Agents SDK uses `Microsoft.Agents.Builder`,
`Microsoft.Agents.Hosting.AspNetCore` and `AgentApplication`; it is distinct from
Microsoft Agent Framework. Recommendations do not activate a charter's deferred
domain-onboarding exercise, grant execution permission or bypass an actual failing command.

### Independent required controls

An explicit repository or mission requirement remains binding. If that independent
rule requires a particular skill, plugin installation or canonical provenance
confirmation, unmet evidence blocks only the governed action. Identify the exact
rule and request reconciliation rather than silently downgrading it to a recommendation.
Security, source checks, tests, permissions and business-command errors remain real
controls; optional enrichment is not permission to ignore them.

Already-issued mandatory mission prompts and charters are not silently changed by
upgrading these templates. Reconcile only Squad's introduced blanket provider gate
with the coordinator; a preexisting user-owned requirement needs its own explicit
decision. A user's business request is not installation consent or provenance evidence.

#### Generated member recommendation section

Where relevant, include this section (in English) after the new member's standard
charter sections. It records recommendations, not executable dependencies or a
native Copilot YAML resolver. Preserve ownership, model choices and deferred exercises.
Do not rename/recast the current Microsoft Agent Framework specialist.

```markdown
## X-External Provider

- **Profile:** microsoft-365-agents-sdk-dotnet
- **Recommended provider:** agents-for-net@microsoft-agents-sdk (optional, shared host enrichment)
- **Source:** microsoft/Agents (external, host-managed; manifest name agents-for-dotnet)
- **Recommended guidance:** agents-sdk-dotnet for SDK development; relevant debugging, OTel or migration skills when useful for the actual task.
- **Default policy:** Optional and nonblocking for otherwise-permitted work; independent explicit repository/mission obligations remain binding.
- **Setup:** Only on a separate explicit user request with real native host consent before any provider mutation.
- **Evidence:** Native skill invocation, provider provenance and business readiness are separate facts; do not infer one from another.

Use relevant skills already available through the actual skill tool without requiring the optional install/verify bridge first. If recommended guidance or provider metadata is absent, disclose the optional limitation once and continue otherwise-authorized work using project context, official documentation and standard tools. Do not automatically install, prompt or retry a declined/failed setup. Independent explicit repository/mission requirements still control the relevant action. Do not copy external skills, create your installer, use a parent/main checkout, or recursively spawn setup agents. Availability metadata and reading SKILL.md are not native skill invocation; unknown provider association stays unknown. Respect deferred domain exercises and product-change authorization separately.
```

| Field | Value |
|-------|-------|
| Profile | `microsoft-365-agents-sdk-dotnet` (opt-in) |
| Recommended provider | `agents-for-net@microsoft-agents-sdk` (optional) |
| Source | [`microsoft/Agents`](https://github.com/microsoft/Agents/tree/main/agent-plugins/agents-for-net) |
| Manifest name | `agents-for-dotnet`; this is not the marketplace catalog name |
| Recommended base guidance | `agents-sdk-dotnet` when available for SDK development |
| Recommended specialized guidance | Relevant debugging, instrumentation or migration skill when useful |
| Business readiness | Determined by the actual mission, repository obligations, tests and permissions, not optional provider metadata |

Current provider skills (inventory checked against the Microsoft marketplace and
plugin manifest at `cc2a383c65d45e1e34445114184eeab16b0e8559`):

| Skill | Capability | Recommended when |
|-------|------------|---------------|
| `agents-sdk-dotnet` | Microsoft 365 Agents SDK development | Developing/configuring an SDK agent |
| `agents-sdk-dotnet-debugging` | SDK build/startup/auth troubleshooting | Diagnosing an SDK problem |
| `agents-sdk-dotnet-otel` | SDK OpenTelemetry | Adding or troubleshooting instrumentation |
| `agents-sdk-dotnet-activityhandler-migration` | SDK ActivityHandler to AgentApplication | Modernizing an existing Microsoft.Agents.* handler |
| `bf-to-agents-sdk-dotnet-migration` | Bot Framework to Microsoft 365 Agents SDK | Migrating Microsoft.Bot.* to SDK compatibility handlers |
| `teams-sdk-to-agents-sdk-dotnet-migration` | Teams SDK to Microsoft 365 Agents SDK | Migrating a teams.net application |

These six names describe optional guidance, not mandatory dependencies of a new
developer. No missing recommendation alone establishes that the business task is
blocked, nor does a complete inventory establish business readiness.
Bot Framework compatibility migration does not also require ActivityHandler
modernization; that conversion is a separate task.

Only names/provider metadata are Squad-owned; the skill content stays external. The
plugin manifest declares skills, not an `agents-sdk-common` dependency. Azure
provisioning, credentials, MCP, cloud/auth tools and NuGet dependencies require
separate task requirements and authorization.

### Supported same-host bridge

Squad init/upgrade distributes the user-owned `squad-provider-onboarding` extension
and its companion to `.github/extensions/`. Existing customizations are preserved.
The host supplies `@github/copilot-sdk`; do not install an npm SDK beside it. Loading
the extension only registers tools: **no startup installation or config changes**.
Its absence limits optional inspection/installation, not use of native skills or
ordinary otherwise-permitted work. Do not build another installer or repeatedly
reload/reselect sessions to make optional tools appear. Use a supported host action
only when that setup is separately requested and authorized.

#### Recommended guidance block

For a relevant named mission, pass the actual charter and this short block.
The marker remains compatible with older prompts, but its default is now optional
enrichment, not a provider bootstrap prerequisite. Do not launch another setup-only
mission or ask the novice for internal names.

```text
EXTERNAL_PROVIDER_PREPARATION
Recommendation: profile=microsoft-365-agents-sdk-dotnet; provider=agents-for-net@microsoft-agents-sdk (optional).
Member: {allocated member name}
Task guidance: {relevant SDK guidance derived from the actual mission}
1. Perform the authorized mission in YOUR own foreground App project session. Use relevant skills already legitimately exposed by this host through the actual skill tool; provider verification is not required merely to invoke them. A SKILL.md file read or parent snapshot is not invocation or canonical provider provenance.
2. Missing optional bridge, provider metadata or skill guidance does not block ordinary work. Disclose the limitation once and continue otherwise-authorized work with project context, official documentation and standard tools. Keep provider verified=false/unknown when evidence is absent; never invent readiness or silently ignore a failing business command.
3. Do not call verify/onboard or ask for installation automatically at member addition, child startup or on every task. Optional inspection/setup requires a separate explicit user request; native consent is mandatory before any marketplace/install/enable mutation. A business request or consent=true is not that approval. The provider has shared host scope, not agent-exclusive isolation.
4. Do not repeat a declined installation request without a new explicit user request. After a failed attempt preserve stage, attemptedMutations and confirmed mutations, including partial/uncertain effects. No automatic retry, rollback, reinstall, update, enable, admin elevation, ACL/security changes or refresh remedy.
5. An explicit repository or mission requirement remains binding. If it independently requires SDK guidance/provider confirmation and evidence is unmet, report that exact rule and pause only the governed action. This recommendation never overrides tests, security, permissions, explicit required capabilities, or deferred domain exercise boundaries.
6. Never self-install the bridge, vendor skills, read/write a parent/main checkout or recursively spawn setup agents. Report limitations of optional host tools without manufacturing a new prerequisite for ordinary business work.
```

Bridge distribution is only a prerequisite of the optional provider tools:
the existing Squad init/upgrade path installs both modules and the host discovers
them. App child creation has no provider/plugin selector. Uncommitted parent
extension/charter files may not exist in a new worktree; coordinator skills are not
inherited evidence. Missing optional tools get one truthful disclosure, not a
mandatory bootstrap gate or permission to access another checkout.

Only after a separate explicit optional-setup request, the existing onboard tool
accepts this compatibility context; the lifecycle label itself does not authorize setup:

```json
{
  "profile": "microsoft-365-agents-sdk-dotnet",
  "provider": "agents-for-net@microsoft-agents-sdk",
  "event": "specialist-initialization",
  "member": "<allocated member name>",
  "capability": "development"
}
```

`provider` must match the fixed provider exactly. Unknown declarations or
capabilities are explicit errors before host inventory reads; there is no generic
`Dependencies` parser, URL installer or custom-agent plugin YAML. Recommendations
pass through generated charters/inlined prompts and existing charter compilation,
not deterministic Markdown-to-install resolution.

Existing `squad_m365_profile_onboard` callers with `event: profile-added` remain
compatible: without a capability they evaluate development and retain real host
consent for user-requested missing/disabled-provider setup. These calls are not
automatic triggers at member addition or startup, nor evidence of child readiness.
Do not duplicate setup checks or treat prior refusals as permission for another attempt.

This fixed-provider tool uses the **joined current
session's** public `session.rpc.plugins` APIs and retained host account, working
directory and policy. It never invokes a separate system `copilot` executable,
guesses a config directory, or accepts another session's identity. The runtime API
is experimental; unsupported methods limit optional inspection/setup and are
not an ordinary-work prerequisite or a successful verification fallback.

- Inspect only this provider/marketplace and its known skill inventory. An installed,
  enabled provider with validated core guidance causes no registration, reinstall,
  prompt or reload, even if optional inventory is incomplete.
- Unambiguously missing provider: the host's `session.ui.confirm` dialog explains the
  selected provider, Microsoft source, member, session, actions and shared host
  configuration scope. Roster approval, model-supplied `consent=true`, copied text
  or autopilot mode are **not** install approval. No registration, install or enable
  is attempted until that actual dialog returns `true`.
- For the compatibility specialist-initialization setup call, a disabled provider is reported,
  not automatically enabled and not repeatedly prompted. Missing required skill
  exposure/activation is not permission to reinstall or update the provider.
- Known plugin skill rows without a matching provider record, an unrecognized or
  qualified .NET provider representation under the selected marketplace, or a
  contradictory installed state yield `inventory-inconsistent`. The tool reports
  selected-provider counts only and blocks changes before consent. It does not
  loosen aliases/source checks, expose third-party inventories, or diagnose the
  host's underlying configuration. `missing` means no matching record is observable
  in this session inventory, not proof of a physical uninstall.
- Approval is not persisted or reusable. Re-read source/activation authority after
  the dialog; changed authority requires fresh consent. Check the retained
  marketplace identity before installation; conflicts/policy blocks do not repoint
  a marketplace or override policy. The host APIs are separate operations, not an
  atomic registration/install transaction: concurrent external edits and partial
  failures must remain explicit, never reported as a verified install.
- Register `microsoft/Agents` only if absent, install only the selected provider if
  absent, and enable only within the separately consented setup. Do not remove unrelated
  plugins/marketplaces/settings or roll back someone else's state. After partial
  failure, preserve uncertain effects and stop automatic retries. A new explicit
  user request and fresh native consent are required for a later attempt.
- After an authorized change, refresh plugin/skill caches through public APIs with
  MCP, agent, hook and extension reloads disabled. Surface skill reload diagnostics.
  Successful installation or `skillsInstalled` counts alone are not availability.
  Report reload diagnostics without assuming they determine required-action
  readiness; current required skill/provider evidence determines the verdict.
  `reloadDiagnostics` exposes counts and known inventory skill names only, not
  raw diagnostics that may contain unrelated skill names or personal paths.
- Decline, cancellation, source conflict, policy/offline failure and unsupported
  APIs remain explicit non-success states of optional setup, not ordinary-work
  vetoes. Preserve independent required repository/mission controls.

The beginner normally sees work continue, with at most a concise disclosure when
recommended guidance is unavailable. Only after asking for optional installation do
they see "Install or activate optional Microsoft 365 development guidance?" with
source/action/shared-scope details and a real native consent dialog. A failure is
reported truthfully, not retried or reclassified as a successful installation.
The bridge does not perform or certify model-facing skill invocation.

### Optional verification and evidence

When provider inspection is explicitly requested, use
`squad_m365_profile_verify` in the specialist's **own foreground session** using
`profile`, `member`, and the fixed `provider` from the declaration (no install event).
Default `capability` is `development`; legacy profile-added onboarding remains
development-only. Specialist-initialization may check the mission's relevant
capability. This tool only reads session-scoped
plugin/marketplace/skill inventories: it never installs, enables, reloads or writes
configuration. To return provider `verified: true`, it requires the selected inspection target's skill names to be
enabled, `source: plugin`, and associated through `pluginName` with the actual
installed provider record, not merely matching files/names in another source.

For a later specialized task, Squad derives the optional closed `capability`
selector from the user's requested optional investigation; the novice need not know
these names. Neither verification nor a lifecycle label is an installation trigger.

| `capability` | Verification criteria only, not new business prerequisites |
|--------------|-----------------|
| `development` (default) | Core only |
| `debugging` | Core + `agents-sdk-dotnet-debugging` |
| `otel` | Core + `agents-sdk-dotnet-otel` |
| `activityhandler-migration` | Core + `agents-sdk-dotnet-activityhandler-migration` |
| `bot-framework-migration` | Core + `bf-to-agents-sdk-dotnet-migration` |
| `teams-sdk-migration` | Core + `teams-sdk-to-agents-sdk-dotnet-migration` |

Unknown selectors are explicit input errors before host inventory reads. This is a
fixed-provider mapping, not a generic dependency parser or arbitrary skill list.

`available` / `verified: true` means the selected inspection target's guidance
passed the provider/source/activation checks **in this session**. The result includes
`capability`, `requiredSkills`, verified exposed `skills`, required `missingSkills`,
`missingOptionalSkills`, and separate `runtimeInventoryComplete` for the six-name
runtime inventory. It includes minimal `providerAssociation` (catalog spec, actual
installed name/marketplace and matched source) and `skillEvidence` (name, source,
pluginName, enabled) only for validated provider rows. No account, config, path or
foreign-provider inventory is disclosed. These are guidance-availability checks,
not proof that a generated SDK application builds or functions.

`guidancePolicy: recommended` and `businessAuthorization: not-evaluated` distinguish
optional provider evidence from permission to perform a business task. `requiredSkills`
and `guidanceLoadRequired` are retained compatibility names for this optional
provider-check/load target, not requirements imposed on ordinary work.
`guidanceLoadRequired` lists skills that could be invoked after validated availability;
`guidanceLoadVerified: false` makes explicit that the bridge has **not** performed
the skill-tool calls or certified loaded guidance. The specialist must observe
actual skill invocations when claiming loading, not set a boolean or infer loading
from metadata. On explicit-setup results, `specialistVerificationRequired: false` means
evidence is already local to the caller, **not** that skill loading or domain
authorization has passed. Legacy profile-add results cannot certify child provider
association. None of these fields makes provider verification compulsory for native skill use.

A native skill invocation proves invocation, not provider provenance. It may be
used without an optional installer bridge if legitimately exposed and no independent
rule requires additional evidence. A matching name, description or invocation alone
does not establish Microsoft catalog association; leave that evidence unknown/false.

The returned `sessionId` identifies the evidence scope. An attributed native
subagent cannot use its parent's joined RPC snapshot as its own verification;
report that host limitation instead. Coordinator availability is not specialist
readiness. Claim only the evidence actually observed. If an optional skill invocation
fails or its tool is absent, disclose the guidance limitation and continue
otherwise-permitted work; preserve an independent explicit rule that requires it.
Do not cache attestation across relevant host/account/session/override changes.

Installed/enabled but unavailable **required** skills yield `capability-unavailable`
/ `verified: false`. `skillIssues` separates `not-exposed` (no matching runtime row,
cause unknown), `disabled` (associated skill is disabled) and `source-mismatch`
(matching name is not from the selected plugin). These gaps are explicit but do
not by themselves block ordinary business work. Provider/governance failures retain their own
missing/disabled/source-conflict/policy-blocked/host-error statuses.

For example, five validated skills with only Teams SDK migration absent yield
`available` for development, `runtimeInventoryComplete: false`, and a missing
optional migration skill. The same snapshot yields `capability-unavailable` when
Teams SDK migration is requested.

Absence alone does not distinguish an older provider inventory from a loading
problem or prove that refresh/restart will fix it. Inspect host provider state/version,
skill activation overrides and loading diagnostics; use a supported host-authorized
refresh/reselection only if indicated, then verify again. Do not automatically enable,
update or reinstall an existing provider. Disk files, plugin metadata, parent-loaded
skills, older evidence or successful reload alone do not establish current availability.

### When optional setup is unavailable or fails

Say plainly that optional installation/activation is unavailable in this host.
Continue otherwise-permitted work; do not claim provider attestation, an installer
from `copilot.requires`, a fixed cache cause or a resolved installation.
An independent explicit repository/mission requirement still controls its governed action.

Preserve refusal and failure separately. `declined` at `stage: consent` with both
mutation arrays empty means no mutation was attempted by that call; whether the
dialog was denied, cancelled or visible is not established by this result alone.
After a new explicit user installation request, `host-error` at `stage: install`
with `attemptedMutations: ["install"]`, `mutations: []` and
`Failed to install plugin: Access is denied. (os error 5)` means an installation
was attempted but no change was confirmed. Partial effects remain possible; do not
claim zero attempts, no actual changes, a physical uninstall, or an ACL/admin cause.
Do not retry, roll back or escalate privileges/security changes automatically.

Only for a separately requested optional setup, use the host's supported plugin manager to select the Microsoft source and .NET
provider. For a verified **Copilot CLI host** whose config scope is known, the
[documented commands](https://github.com/microsoft/Agents/blob/main/agent-plugins/README.md)
are:

```text
copilot plugin marketplace add microsoft/Agents
copilot plugin install agents-for-net@microsoft-agents-sdk
```

Reuse a matching existing registration/installation; do not run these merely
because `copilot` is on PATH. For the App, if no supported same-host mutation path is
exposed, explain the remaining host-owned action rather than editing personal
settings or inventing RPCs/UI automation. Activation/refresh remains explicit.

### Source and updates

Microsoft owns plugin/skill contents and host-managed source updates. Squad does not
vendor them, add a synchronizer, or change `autoUpdate`. This custom marketplace is
not a verified built-in `awesome-copilot` plugin. User/managed marketplace opt-in can
enable updates for interactive CLI sessions; repository opt-in does not enable it,
and SDK/server sessions do not run that automatic update path. See the
[Copilot CLI plugin reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference).
Manual host updates remain available; use the exact installed name/spec from host
metadata, then reverify skills. Do not promise automatic App updates.

## Marketplace State

Registered marketplace sources are stored in `.squad/plugins/marketplaces.json`:

```json
{
  "marketplaces": [
    {
      "name": "awesome-copilot",
      "source": "github/awesome-copilot",
      "added_at": "2026-02-14T00:00:00Z"
    }
  ]
}
```

## CLI Commands

Users manage marketplaces via the CLI:
- `squad plugin marketplace add {owner/repo}` — Register a GitHub repo as a marketplace source
- `squad plugin marketplace remove {name}` — Remove a registered marketplace
- `squad plugin marketplace list` — List registered marketplaces
- `squad plugin marketplace browse {name}` — List available plugins in a marketplace

## When to Browse

During the **Adding Team Members** flow, AFTER allocating a name but BEFORE generating the charter:

This optional discovery is for other domains/local static guidance. There is no
mandatory M365 provider gate, including when this registry is empty.

1. Read `.squad/plugins/marketplaces.json`. If the file doesn't exist or `marketplaces` is empty, skip silently.
2. For each registered marketplace, search for plugins whose name or description matches the new member's role or domain keywords.
3. Present matching plugins to the user: *"Found '{plugin-name}' in {marketplace} marketplace — want me to install it as a skill for {CastName}?"*
4. If the user accepts, install the plugin (see below). If they decline or skip, proceed without it.

## How to Install a Plugin

These legacy static-copy steps apply only to approved local Squad guidance, **not**
external Copilot plugin skills. External Copilot content uses host plugin
installation above; do not copy it into a charter or `.squad/skills/`.

1. Read the plugin content from the marketplace repository (the plugin's `SKILL.md` or equivalent).
2. Copy it into the agent's skills directory: `.squad/skills/{plugin-name}/SKILL.md`
3. If the plugin includes charter-level instructions (role boundaries, tool preferences), merge those into the agent's `charter.md`.
4. Log the installation in the agent's `history.md`: *"📦 Plugin '{plugin-name}' installed from {marketplace}."*

## Graceful Degradation

- **No marketplaces configured:** Skip the marketplace check entirely. No warning, no prompt.
- **Marketplace unreachable:** Warn the user (*"⚠ Couldn't reach {marketplace} — continuing without it"*) and proceed with team member creation normally.
- **No matching plugins:** Inform the user (*"No matching plugins found in configured marketplaces"*) and proceed.
