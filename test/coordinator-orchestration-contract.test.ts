/**
 * Canonical instruction contracts, independent of generated mirrors and SDK dist.
 *
 * To demonstrate red against original content without restoring/stashing another
 * worker's files, set SQUAD_ORCHESTRATION_SOURCE_REF to the pre-fix git ref:
 *   $env:SQUAD_ORCHESTRATION_SOURCE_REF = 'HEAD'
 *   npm test -- test/coordinator-orchestration-contract.test.ts
 * Unset it for green against the working tree. git show is read-only.
 *
 * These are instruction regressions, not claims that a model obeys the prompt or
 * that a host renders a particular UI. Mutations pin the hazardous old guidance.
 */
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceRef = process.env.SQUAD_ORCHESTRATION_SOURCE_REF;
const paths = {
  coordinator: '.squad-templates/squad.agent.md',
  spawn: '.squad-templates/spawn-reference.md',
  after: '.squad-templates/after-agent-reference.md',
  client: '.squad-templates/client-compatibility-reference.md',
  response: '.squad-templates/skills/coordinator-response-mode/SKILL.md',
  ceremony: '.squad-templates/ceremony-reference.md',
  model: '.squad-templates/model-selection-reference.md',
} as const;

function read(path: string): string {
  return sourceRef
    ? execFileSync('git', ['show', `${sourceRef}:${path}`], { cwd: ROOT, encoding: 'utf8' })
    : readFileSync(resolve(ROOT, path), 'utf8');
}

const sources = Object.fromEntries(
  Object.entries(paths).map(([name, path]) => [name, read(path)]),
) as Record<keyof typeof paths, string>;

function section(content: string, heading: string): string {
  const start = content.indexOf(heading);
  expect(start, `missing section: ${heading}`).toBeGreaterThanOrEqual(0);
  const tail = content.slice(start + heading.length);
  return tail.split(/\n### /, 1)[0];
}

function assertDispatch(content: string): void {
  expect(content).toMatch(/Direct[^.\n]*(trivial|readily available)/i);
  expect(content).toMatch(/task[^.\n]*bounded/i);
  expect(content).toMatch(/create_session[^.\n]*(named specialist|isolation|isolated|durable)/i);
  expect(content).toMatch(/commit production alone is not/i);
  expect(content).not.toMatch(/sub-sessions for commit-producing work|Use `create_session` for agents that produce commits/i);
}

function assertAuthorization(content: string): void {
  expect(content).toMatch(/inspect\/read-only/);
  expect(content).toMatch(/propose\/plan/);
  expect(content).toMatch(/authorized execution/);
  expect(content).toMatch(/inspect and propose[^.\n]*must not[^.\n]*autopilot/i);
  expect(content).toMatch(/autopilot[^.\n]*authorized bounded execution/i);
  expect(content).toContain('request_id');
  expect(content).toMatch(/(do not|never)[^.\n]*auto[- ]approve/i);
  // Reject a literal unconditional value, not the authorized three-mode list.
  expect(content).not.toMatch(/(?:kickoff\.mode[`*:\s]*|^\s*mode:\s*)"autopilot"/m);
}

function assertNativeLifecycle(content: string): void {
  content = content.replace(/\s+/g, ' ');
  expect(content).toMatch(/sync[^.]*?(?:cannot[^.]*write_agent|write_agent[^.]*(?:cannot|not|reject))/i);
  expect(content).toMatch(/same[- ](task|mission)/i);
  expect(content).toMatch(/compatible lifecycle/i);
  expect(content).toMatch(/(not|never|no)[^.\n]*(unrelated|worker pool)/i);
}

function assertScribeScope(content: string): void {
  expect(content).toMatch(/Scribe[^.\n]*only when[^.\n]*durable decisions[^.\n]*merg/i);
  expect(content).not.toMatch(/Only if agents ran|Scribe included|at ceremony start to record|Scribe handles (it|cleanup) independently|spawn Scribe\. That's ALL/i);
}

function assertResultCollection(content: string): void {
  content = content.replace(/\s+/g, ' ');
  expect(content).toMatch(/Native[^.]*task[^.]*agent_id[^.]*read_agent/i);
  expect(content).toMatch(/App[^.]*session[^.]*notifications[^.]*send_session_message[^.]*get_session/i);
  expect(content).toMatch(/(never|do not)[^.]*App[^.]*read_agent/i);
  expect(content).toMatch(/agent_id[^.]*(not|!=|≠)[^.]*project_session_id/i);
  expect(content).toMatch(/(schema|tool)[^.]*wait limits/i);
  expect(content).not.toMatch(/timeout:\s*300|poll each|polling loop/i);
  expect(content).not.toMatch(/App child session use `?read_agent/i);
}

function assertAppVisibility(content: string, input: string): void {
  const text = content.replace(/\s+/g, ' ');
  expect(text, `${input}: all named specialist missions need visible App children`).toMatch(
    /ALL named Squad specialist missions MUST use visible coordinated (?:App )?child sessions via `create_session`/,
  );
  expect(text, `${input}: short/read-only specialist missions must not bypass the session tree`).toMatch(
    /including short\/read-only missions/,
  );
  expect(text, `${input}: native task exception must be limited to internal checks`).toMatch(
    /Native `task` is ONLY for small bounded internal checks in the App/,
  );
  expect(text, `${input}: brevity/read-only scope cannot reclassify a specialist mission`).toMatch(
    /a named specialist mission is not an internal check merely because it is short or read-only/,
  );
  expect(text, `${input}: stale native-first App routing must not survive`).not.toMatch(
    /Use native `task` for bounded work even when App `create_session` is also available|Do not create one merely for UI visibility|Use `create_session` only for independent work|tool availability does not force all work into App children/,
  );
}

function assertAppWorkspace(content: string, input: string): void {
  const text = content.replace(/\s+/g, ' ');
  expect(text, `${input}: analysis may use chat only with established source access`).toMatch(
    /session_kind: "chat"[^.]*source access[^.]*established/i,
  );
  expect(text, `${input}: chat must not imply a checkout`).toMatch(/chat child has no checkout/i);
  expect(text, `${input}: code isolation needs a project worktree`).toMatch(
    /session_kind: "project"[^.]*workspace_type: "worktree"/,
  );
  expect(text, `${input}: unavailable chat source access needs a supported project option`).toMatch(
    /source access[^.]*cannot be established[^.]*project child/i,
  );
}

function assertAppFallback(content: string, input: string): void {
  const text = content.replace(/\s+/g, ' ');
  expect(text, `${input}: specialist native fallback must be capability-gated`).toMatch(
    /When `create_session` is unavailable[^.]*native `task`[^.]*runSubagent/i,
  );
  expect(text, `${input}: fallback must disclose degraded native sidebar visibility`).toMatch(
    /disclose degraded native sidebar visibility/i,
  );
  expect(text, `${input}: failed App creation must not silently substitute task`).toMatch(
    /creation fail(?:s|ure)[^.]*report[^.]*blocker[^.]*(?:not|never)[^.]*silently[^.]*`task`/i,
  );
}

function assertAppHandoff(content: string, input: string): void {
  const text = content.replace(/\s+/g, ' ');
  expect(text, `${input}: App reports need the kickoff assignment ID`).toMatch(
    /send_session_message[^.]*assignment_id[^.]*kickoff/i,
  );
  expect(text, `${input}: distinguish handoffs, input and error reports`).toMatch(
    /purpose[^.]*handoff[^.]*needs_input[^.]*error/,
  );
}

function assertAppIdentity(content: string, input: string): void {
  const text = content.replace(/\s+/g, ' ');
  expect(text, `${input}: visual identity belongs in the native name field`).toMatch(
    /native `name`[^.]*icon[^.]*specialist[^.]*mission/i,
  );
  expect(text, `${input}: identity must come from the active specialist`).toMatch(
    /(?:derive|resolve)[^.]*active[^.]*(?:charter|roster)/i,
  );
  expect(text, `${input}: icon and readable label must remain stable`).toMatch(
    /icon and (?:readable )?label[^.]*stable[^.]*same specialist/i,
  );
  expect(text, `${input}: title length must not hide canonical identity`).toMatch(
    /40 characters[^.]*shorten[^.]*mission/i,
  );
  expect(text, `${input}: canonical specialist name stays in prompt and plan`).toMatch(
    /canonical specialist name[^.]*prompt[^.]*plan/i,
  );
  expect(text, `${input}: static identity must not masquerade as App status`).toMatch(
    /static identity[^.]*busy\/idle\/error[^.]*App/i,
  );
}

describe('coordinator orchestration: canonical contracts', () => {
  it.each(['coordinator', 'spawn', 'client'] as const)('%s chooses dispatch without losing named specialist visibility', key => {
    assertDispatch(sources[key]);
  });

  it.each(['coordinator', 'spawn', 'client'] as const)('%s preserves delegated authorization and input gates', key => {
    assertAuthorization(sources[key]);
  });

  it.each(['coordinator', 'spawn', 'after', 'client'] as const)('%s distinguishes native one-shot and retained lifecycles', key => {
    assertNativeLifecycle(sources[key]);
  });

  it.each(['coordinator', 'spawn', 'response'] as const)('%s uses sync for dependent bounded work, not blanket background', key => {
    const text = sources[key];
    expect(text).toMatch(/sync[^.\n]*(bounded|result)[^.\n]*(now|needed)/i);
    expect(text).toMatch(/background[^.\n]*independent foreground work/i);
    expect(text).not.toMatch(/Background is the Default|Background spawn \(the default\)|Everything else is `mode: "background"`|\*\*Default to background\*\*/i);
  });

  it('keeps all available spawn tools in the inline-dispatch and STOP gates', () => {
    const gate = section(sources.coordinator, '### Client Compatibility');
    expect(gate).toMatch(/Inline-dispatch gate[^.\n]*Direct Mode/);
    expect(gate).toMatch(/NEITHER[^.\n]*task[^.\n]*runSubagent[^.\n]*create_session/i);
    expect(gate).toContain('MUST dispatch');
    const spawn = section(sources.coordinator, '### How to Spawn an Agent');
    expect(spawn).toMatch(/STOP gate[^.\n]*Direct Mode/);
    expect(spawn).toContain('create_session');
  });

  it('collects results using the right namespace, not a blanket read_agent', () => {
    assertResultCollection(sources.after);
  });

  it('does not mark silent files or end-of-turn events as successful completion', () => {
    const after = sources.after.replace(/\s+/g, ' ');
    for (const status of ['in-progress', 'blocked/needs_input', 'completed', 'failed', 'cancelled']) {
      expect(after).toContain(status);
    }
    expect(after).toMatch(/completed[^.\n]*verified outcome/i);
    expect(after).toMatch(/(end[- ]of[- ]turn|end of an agent turn)[^.\n]*does not[^.\n]*success/i);
    expect(after).toMatch(/files alone[^.\n]*(not|never)[^.\n]*(success|done|completion)/i);
    expect(after).not.toMatch(/Files found[^.\n]*Treat as DONE/i);
    expect(after).toMatch(/(do not|never)[^.\n]*parent[^.\n]*complet[^.\n]*(running|incomplete)/i);
  });

  it('separates parent identity context from child code workspace and integration', () => {
    const spawn = sources.spawn;
    expect(spawn).toMatch(/TEAM_ROOT[^.\n]*identity[^.\n]*not[^.\n]*execution workspace/i);
    expect(spawn).toMatch(/child[^.\n]*own workspace/i);
    expect(spawn).toMatch(/(?:omit[^.\n]*base_branch|base_branch[^.\n]*omit)[^.\n]*(explicit|requested|depends)/i);
    expect(spawn).toMatch(/(not|never)[^.\n]*automatically integrated/i);
    expect(spawn).not.toContain('- Commit and push from the worktree');
  });

  it('publishes an optional current main-session plan without approving execution', () => {
    const plan = section(sources.coordinator, '### Visible Main-Session Plan');
    expect(plan).toMatch(/nontrivial multi-step[^.\n]*explicit planning/i);
    expect(plan).toContain('squad_session_plan_read()');
    expect(plan).toContain('squad_session_plan_publish({content})');
    expect(plan).toContain('squad_session_plan_update({content, expectedHash})');
    expect(plan).toMatch(/optional[^.\n]*extension[^.\n]*not[^.\n]*built-in App/i);
    expect(plan).toMatch(/unavailable[^.\n]*visible chat plan/i);
    expect(plan).toMatch(/meaningful[^.\n]*(status|results)/i);
    expect(plan).toMatch(/(?:user-edited|existing)[^.\n]*reconcil|reconcil[^.\n]*(?:user-edited|existing)/i);
    expect(plan).toMatch(/(never|do not)[^.\n]*re-read[^.\n]*bypass[^.\n]*conflict/i);
    expect(plan).toMatch(/(not|never)[^.\n]*approval[^.\n]*(mode|execution)/i);
    expect(plan).toContain('SQL');
  });

  it.each(Object.keys(paths) as (keyof typeof paths)[])('%s makes Scribe decision-only, not automatic task housekeeping', key => {
    assertScribeScope(sources[key]);
  });

  it('keeps routing, persona and rejection ownership gates', () => {
    expect(sources.coordinator).toContain('exactly one accountable specialist');
    expect(sources.coordinator).toContain('.squad/routing.md');
    expect(sources.spawn).toContain('YOUR CHARTER:');
    expect(sources.coordinator).toContain('The original author is locked out');
    expect(sources.coordinator).toContain('A different agent MUST own the revision');
  });
});

describe('App specialist visibility: canonical contracts', () => {
  it.each(['coordinator', 'spawn', 'client', 'response'] as const)(
    '%s makes even short/read-only specialist missions visible, not native internal checks',
    key => assertAppVisibility(sources[key], paths[key]),
  );

  it.each(['spawn', 'client'] as const)(
    '%s separates read-only chat source access from isolated specialist code work',
    key => assertAppWorkspace(sources[key], paths[key]),
  );

  it.each(['coordinator', 'spawn', 'client', 'response'] as const)(
    '%s preserves capability fallback without falsely promising the native sidebar',
    key => assertAppFallback(sources[key], paths[key]),
  );

  it.each(['spawn', 'after'] as const)(
    '%s returns meaningful App assignment results through the correct namespace',
    key => assertAppHandoff(sources[key], paths[key]),
  );

  it.each(['spawn', 'client'] as const)(
    '%s keeps ordinary App message delivery when coordinator-only fields are unavailable',
    key => {
      const text = sources[key].replace(/\s+/g, ' ');
      expect(text, `${paths[key]}: coordinator_instructions must not be assumed universally available`).toMatch(
        /not universally available[^.]*ordinary[^.]*parents|ordinary parents[^.]*not[^.]*universally available/i,
      );
      expect(text, `${paths[key]}: ordinary message delivery must remain supported`).toMatch(
        /normal `message` delivery[^.]*supported path/i,
      );
      expect(text, `${paths[key]}: host-limited field must be named explicitly`).toContain('coordinator_instructions');
    },
  );

  it.each(['coordinator', 'spawn'] as const)(
    '%s returns additional specialist missions to the coordinator, not nested native agents',
    key => {
      const text = sources[key].replace(/\s+/g, ' ');
      expect(text, `${paths[key]}: depth cap must not hide named specialist missions`).toMatch(
        /further specialist missions[^.]*coordinator[^.]*visible sibling/i,
      );
      expect(text, `${paths[key]}: child task exception is internal-check-only`).toMatch(
        /child[^.]*`task`[^.]*only for small bounded internal checks/i,
      );
    },
  );

  it('uses real App children, not hooks or reconstructed historical task sessions', () => {
    const text = sources.client.replace(/\s+/g, ' ');
    expect(text, `${paths.client}: native tree needs actual App children`).toMatch(
      /native session tree[^.]*actual App child sessions/i,
    );
    expect(text, `${paths.client}: task histories cannot be migrated by instruction`).toMatch(
      /(?:do not|never)[^.]*migrate[^.]*native task histor/i,
    );
    expect(text, `${paths.client}: no fake sidebar entries for old completed agents`).toMatch(
      /(?:do not|never)[^.]*fake sessions/i,
    );
  });

  it.each(['coordinator', 'spawn', 'client', 'response'] as const)(
    '%s exposes stable active-specialist identity in the native child title',
    key => assertAppIdentity(sources[key], paths[key]),
  );

  it('keeps the documented icon/label/mission example inside the native title limit', () => {
    const titles = sources.spawn.matchAll(/name: "([^"\n]+)"/g);
    const examples = [...titles].map(match => match[1]).filter(title => !title.includes('{'));
    expect(examples, `${paths.spawn}: needs a concrete native-title example`).toContain('🧭 Orchestration · Sessions visibles');
    for (const title of examples) {
      expect(title.length, `${paths.spawn}: title exceeds 40 characters: ${title}`).toBeLessThanOrEqual(40);
    }
  });
});

describe('App specialist visibility mutations', () => {
  const visibility = 'In the Copilot App, ALL named Squad specialist missions MUST use visible coordinated child sessions via `create_session`, including short/read-only missions. Native `task` is ONLY for small bounded internal checks in the App; a named specialist mission is not an internal check merely because it is short or read-only.';
  const workspace = 'Use session_kind: "chat" only when source access is established. A chat child has no checkout. Isolated code work uses session_kind: "project", workspace_type: "worktree". If source access cannot be established, use a supported project child.';
  const fallback = 'When `create_session` is unavailable, use native `task` or `runSubagent` within authorization and disclose degraded native sidebar visibility. If creation fails, report the blocker; never silently substitute `task`.';
  const handoff = 'Use send_session_message with assignment_id from the kickoff, and purpose handoff, needs_input or error.';
  const identity = 'Use native `name` for icon + specialist + mission. Derive identity from the active roster and charter. Keep icon and readable label stable for the same specialist. Within 40 characters, shorten the mission first. Keep canonical specialist name in prompt and plan. Static identity is separate from busy/idle/error owned by the App.';

  it('rejects native-first guidance even alongside a correct visibility rule', () => {
    assertAppVisibility(visibility, 'visibility fixture');
    expect(() => assertAppVisibility(`${visibility} Use native \`task\` for bounded work even when App \`create_session\` is also available.`, 'restored native-first rule')).toThrow();
  });

  it('rejects a short/read-only mission loophole', () => {
    expect(() => assertAppVisibility(visibility.replace('including short/read-only missions', 'except short/read-only missions'), 'short mission mutation')).toThrow();
    expect(() => assertAppVisibility(visibility.replace('a named specialist mission is not an internal check merely because it is short or read-only', 'read-only specialist missions count as internal checks'), 'internal check mutation')).toThrow();
  });

  it('rejects invented chat checkout/source access', () => {
    assertAppWorkspace(workspace, 'workspace fixture');
    expect(() => assertAppWorkspace(workspace.replace('A chat child has no checkout', 'A chat child has an isolated checkout'), 'chat checkout mutation')).toThrow();
    expect(() => assertAppWorkspace(workspace.replace('source access is established', 'source access is assumed'), 'chat source access mutation')).toThrow();
  });

  it('rejects hidden capability degradation and unscoped native substitution', () => {
    assertAppFallback(fallback, 'fallback fixture');
    expect(() => assertAppFallback(fallback.replace('disclose degraded native sidebar visibility', 'promise native sidebar visibility'), 'sidebar mutation')).toThrow();
    expect(() => assertAppFallback(fallback.replace('When `create_session` is unavailable', 'When the specialist task is short'), 'fallback scope mutation')).toThrow();
  });

  it('rejects an App handoff without its assignment context', () => {
    assertAppHandoff(handoff, 'handoff fixture');
    expect(() => assertAppHandoff(handoff.replace('assignment_id', 'agent_id'), 'handoff namespace mutation')).toThrow();
  });

  it('rejects fake title statuses or identity derived from a historical cast', () => {
    assertAppIdentity(identity, 'identity fixture');
    expect(() => assertAppIdentity(identity.replace('active roster and charter', 'historical hardcoded cast'), 'stale identity mutation')).toThrow();
    expect(() => assertAppIdentity(identity.replace('Static identity is separate from busy/idle/error owned by the App', 'Change the icon to imply completion'), 'status identity mutation')).toThrow();
  });
});

describe('orchestration contract mutations', () => {
  // Small self-contained fixtures make each guard independently checkable even
  // during a red run against original content; no repository file is rewritten.
  const dispatch = 'Direct for trivial evidence\n`task` for bounded work\n`create_session` for isolation or durable lifecycle\nCommit production alone is not the criterion';
  const auth = 'inspect/read-only; propose/plan; authorized execution\nInspect and propose must not use implementation autopilot\nAutopilot is permitted for authorized bounded execution\nUse exact request_id; never auto-approve';
  const scribe = 'Scribe only when durable decisions need merging';
  const lifecycle = 'Native sync task agents: write_agent cannot follow up\nReuse same-mission context with compatible lifecycle, not unrelated worker pool';

  it('rejects the original commit-production-only App routing rule', () => {
    assertDispatch(dispatch);
    expect(() => assertDispatch(`${dispatch}\nUse \`create_session\` for agents that produce commits`)).toThrow();
  });

  it('rejects restored unconditional App autopilot parameters', () => {
    assertAuthorization(auth);
    expect(() => assertAuthorization(`${auth}\n**\`kickoff.mode\`**: "autopilot" (agents work autonomously)`)).toThrow();
  });

  it('rejects restored automatic Scribe after any agent ran', () => {
    assertScribeScope(scribe);
    expect(() => assertScribeScope(`${scribe}\nOnly if agents ran or inbox has files`)).toThrow();
  });

  it('requires the observed one-shot follow-up restriction, not just same-agent reuse', () => {
    assertNativeLifecycle(lifecycle);
    expect(() => assertNativeLifecycle(lifecycle.replace('write_agent cannot follow up', 'reuse this worker'))).toThrow();
  });

  it('rejects blanket native collection with the original 300-second timeout', () => {
    const fixture = 'Native task returns agent_id for read_agent. App child session: notifications / send_session_message / get_session. agent_id != project_session_id. Never pass App IDs to read_agent. Honor tool schema wait limits.';
    assertResultCollection(fixture);
    expect(() => assertResultCollection(`${fixture}\nCollect results via read_agent (wait: true, timeout: 300)`)).toThrow();
    expect(() => assertResultCollection(`${fixture}\nFor App child session use read_agent`)).toThrow();
  });
});
