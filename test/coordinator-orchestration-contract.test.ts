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
  expect(content).toMatch(/create_session[^.\n]*(isolation|isolated|durable)/i);
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

describe('coordinator orchestration: canonical contracts', () => {
  it.each(['coordinator', 'spawn', 'client'] as const)('%s chooses the smallest appropriate dispatch', key => {
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
