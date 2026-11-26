import { describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  createSpawnConfigHooks, fillPreferences, memberFrom, memberRole, readSquadConfig, reviewerPreferences, spawnPreferences,
  WORK_EFFORT, WORK_MODEL, workDefaultsApply, workKind,
} from '../.squad-templates/extensions/squad-spawn-config/spawn-config-hooks.mjs';
import { TEMPLATE_MANIFEST } from '../packages/squad-cli/src/cli/core/templates.js';

const ROOT = resolve('/repo');
const config = {
  version: 1,
  agentModelOverrides: { backend: 'mai-code-2' },
  agentReasoningEffortOverrides: { backend: 'high' },
};
const team = [
  '## Members',
  '| Name | Role | Charter | Status |',
  '|------|------|---------|--------|',
  '| Lead | Architecture and review | .squad/agents/lead/charter.md | Active |',
  '| Backend | .NET and Microsoft 365 agent development | .squad/agents/backend/charter.md | Active |',
  '| Infra | Infrastructure and CI | .squad/agents/infra/charter.md | Active |',
  '| Tester | Quality and regression testing | .squad/agents/tester/charter.md | Active |',
  '| **Shield** | Security Engineer | .squad/agents/shield/charter.md | Active |',
  '| Rai | RAI Reviewer | .squad/agents/rai/charter.md | Support |',
  '| Fact Checker | Verification and Devil\'s Advocate | .squad/agents/fact-checker/charter.md | Support |',
  '| Scribe | Durable decision merger | .squad/agents/scribe/charter.md | Support |',
].join('\n');
const hostModels = [
  { id: 'mai-code-2', supportedReasoningEfforts: ['low', 'medium', 'high', 'xhigh', 'max'] },
  { id: 'gpt-6.1-sol', supportedReasoningEfforts: ['low', 'medium', 'high'] },
  { id: 'claude-haiku-4.5' },
];

function fakeFs(files: Record<string, string>, gitRoot = ROOT) {
  return {
    read: (path: string) => files[path],
    exists: (path: string) => path === join(gitRoot, '.git'),
  };
}

function hooksFor(options: { agent?: string | null; models?: unknown[] | null; current?: string; cfg?: object | null; roster?: string | null } = {}) {
  const { agent = 'Squad', models = hostModels, current = 'gpt-6.1-sol', cfg = config, roster = team } = options;
  const session = {
    rpc: {
      agent: { getCurrent: vi.fn(async () => ({ agent: agent ? { name: agent } : null })) },
      model: {
        list: vi.fn(async () => (models === null ? Promise.reject(new Error('unsupported')) : { list: models })),
        getCurrent: vi.fn(async () => ({ modelId: current })),
      },
    },
  };
  const files: Record<string, string> = {};
  if (cfg) files[join(ROOT, '.squad', 'config.json')] = JSON.stringify(cfg);
  if (roster) files[join(ROOT, '.squad', 'team.md')] = roster;
  return { session, hooks: createSpawnConfigHooks(() => session, fakeFs(files)) };
}

const spawn = (kickoff: object | undefined, extra: object = {}, name = '🔧 Backend · NuGet patch updates') => ({
  toolName: 'create_session', workingDirectory: ROOT, timestamp: new Date(), sessionId: 'coordinator',
  toolArgs: { name, session_kind: 'project', ...(kickoff ? { kickoff } : {}) },
  ...extra,
});

type Patched = { modifiedArgs: { kickoff: Record<string, unknown> } };

describe('squad-spawn-config hooks', () => {
  it('fills the configured model and effort into a Backend kickoff that omits them', async () => {
    const { hooks } = hooksFor();
    const kickoff = { prompt: 'You are Backend (canonical backend).', mode: 'autopilot' };
    const result = await hooks.onPreToolUse(spawn(kickoff)) as { modifiedArgs: { kickoff: object; name: string } };
    expect(result.modifiedArgs.kickoff).toEqual({ ...kickoff, model: 'mai-code-2', reasoning_effort: 'high' });
    expect(result.modifiedArgs.name).toBe('🔧 Backend · NuGet patch updates');
  });

  it('never overrides a model or effort the coordinator passed', async () => {
    const { hooks } = hooksFor();
    expect(await hooks.onPreToolUse(spawn({ prompt: 'p', model: 'gpt-6.1-sol', reasoning_effort: 'low' }))).toBeUndefined();
    const partial = await hooks.onPreToolUse(spawn({ prompt: 'p', model: 'gpt-6.1-sol' })) as { modifiedArgs: { kickoff: Record<string, unknown> } };
    expect(partial.modifiedArgs.kickoff).toMatchObject({ model: 'gpt-6.1-sol', reasoning_effort: 'high' });
  });

  it('keeps the inherited model when the host does not offer the configured one', async () => {
    const { hooks } = hooksFor({ models: [{ id: 'gpt-6.1-sol', supportedReasoningEfforts: ['low', 'medium', 'high'] }] });
    const result = await hooks.onPreToolUse(spawn({ prompt: 'p' })) as { modifiedArgs: { kickoff: Record<string, unknown> } };
    expect(result.modifiedArgs.kickoff).not.toHaveProperty('model');
    expect(result.modifiedArgs.kickoff.reasoning_effort).toBe('high');
  });

  it('skips an effort the target model does not support', async () => {
    const { hooks } = hooksFor({ cfg: { modelProfile: 'economy', agentReasoningEffortOverrides: { backend: 'max' } } });
    expect(await hooks.onPreToolUse(spawn({ prompt: 'p' }))).toBeUndefined();
    const withModel = hooksFor({ cfg: { agentModelOverrides: { backend: 'claude-haiku-4.5' }, agentReasoningEffortOverrides: { backend: 'high' } } });
    const result = await withModel.hooks.onPreToolUse(spawn({ prompt: 'p' })) as { modifiedArgs: { kickoff: Record<string, unknown> } };
    expect(result.modifiedArgs.kickoff).toMatchObject({ model: 'claude-haiku-4.5', reasoning_effort: 'high' });
  });

  it('gives dev members and security work the work default when no config preference applies', async () => {
    expect([WORK_MODEL, WORK_EFFORT]).toEqual(['mai-code-2', 'high']);
    const { hooks } = hooksFor({ cfg: null });
    for (const name of ['🔧 Backend · Fix auth', '⚙️ Infra · Pipeline', '🧪 Tester · Review dependency fix', '🔒 Shield · Threat model', '🏗️ Lead · Security report synthesis']) {
      const result = await hooks.onPreToolUse(spawn({ prompt: 'p' }, {}, name)) as Patched;
      expect(result.modifiedArgs.kickoff, name).toMatchObject({ model: 'mai-code-2', reasoning_effort: 'high' });
    }
    for (const name of ['🏗️ Lead · README summary', '🛡️ Rai · Content review', '🔍 Fact Checker · Claims', '📋 Scribe · Merge decisions']) {
      expect(await hooks.onPreToolUse(spawn({ prompt: 'p' }, {}, name)), name).toBeUndefined();
    }
    const explicit = await hooks.onPreToolUse(spawn({ prompt: 'p', model: 'mai-code-2' })) as Patched;
    expect(explicit.modifiedArgs.kickoff).toEqual({ prompt: 'p', model: 'mai-code-2', reasoning_effort: 'high' });
    expect(await hooks.onPreToolUse(spawn({ prompt: 'p', model: 'gpt-6.1-sol' })), 'no work effort on another model').toBeUndefined();
  });

  it('keeps config ahead of the work default and yields to economy, hydrafusion and unlisted models', async () => {
    const byDefault = await hooksFor({ cfg: { defaultModel: 'gpt-6.1-sol' } }).hooks.onPreToolUse(spawn({ prompt: 'p' })) as Patched;
    expect(byDefault.modifiedArgs.kickoff).toEqual({ prompt: 'p', model: 'gpt-6.1-sol' });
    const effort = await hooksFor({ cfg: { defaultReasoningEffort: 'medium' } }).hooks.onPreToolUse(spawn({ prompt: 'p' })) as Patched;
    expect(effort.modifiedArgs.kickoff).toMatchObject({ model: 'mai-code-2', reasoning_effort: 'medium' });
    for (const cfg of [{ modelProfile: 'economy' }, { economyMode: true }, { modelProfile: 'HydraFusion' }]) {
      expect(await hooksFor({ cfg }).hooks.onPreToolUse(spawn({ prompt: 'p' })), JSON.stringify(cfg)).toBeUndefined();
    }
    expect(workDefaultsApply({ modelProfile: 'economy', economyMode: false })).toBe(true);
    for (const models of [[{ id: 'gpt-6.1-sol', supportedReasoningEfforts: ['high'] }], null]) {
      expect(await hooksFor({ cfg: null, models }).hooks.onPreToolUse(spawn({ prompt: 'p' })), 'not offered or unknown').toBeUndefined();
    }
  });

  it('classifies roster roles, falling back to the title label', () => {
    expect(memberRole(team, 'backend')).toBe('.NET and Microsoft 365 agent development');
    expect(memberRole(team, 'shield')).toBe('Security Engineer');
    expect(memberRole(team, 'fact checker')).toBe('Verification and Devil\'s Advocate');
    expect(memberRole(team, 'nobody')).toBeUndefined();
    expect(workKind({ role: 'Architecture and review', label: 'lead' })).toBeUndefined();
    expect(workKind({ role: 'Architecture and review', label: 'lead', mission: 'Review CVE-2026-1 fix' })).toBe('security');
    expect(workKind({ role: 'Auth Specialist', label: 'kai' })).toBe('security');
    expect(workKind({ role: 'Content author', label: 'ada' })).toBeUndefined();
    expect(workKind({ role: 'Frontend Dev', label: 'neo' })).toBe('dev');
    expect(workKind({ role: 'DevRel', label: 'sam' })).toBeUndefined();
    expect(workKind({ role: 'Developer Advocate', label: 'sam' })).toBeUndefined();
    expect(workKind({ role: 'Developer Relations and docs', label: 'sam', mission: 'Release blog' })).toBeUndefined();
    expect(workKind({ role: 'Backend developer and documentation', label: 'neo' })).toBe('dev');
    expect(workKind({ label: 'backend' })).toBe('dev');
  });

  it('resolves the native reviewer as security work, config first', async () => {
    const { session } = hooksFor();
    const files = (cfg: object) => fakeFs({ [join(ROOT, '.squad', 'config.json')]: JSON.stringify(cfg) });
    expect(await reviewerPreferences(session, ROOT, {}, files({}))).toEqual({ model: 'mai-code-2', reasoning_effort: 'high' });
    expect(await reviewerPreferences(session, ROOT, {}, files({ defaultModel: 'gpt-6.1-sol' }))).toEqual({ model: 'gpt-6.1-sol' });
    expect(await reviewerPreferences(session, ROOT, { model: 'gpt-6.1-sol' }, files({}))).toEqual({});
    const keyed = files({ agentModelOverrides: { 'security-review': 'gpt-6.1-sol' }, agentReasoningEffortOverrides: { 'security-review': 'low' } });
    expect(await reviewerPreferences(session, ROOT, {}, keyed), 'the reviewer config key wins').toEqual({ model: 'gpt-6.1-sol', reasoning_effort: 'low' });
    expect(await reviewerPreferences(session, ROOT, { model: 'mai-code-2' }, files({})), 'explicit work model gets its effort')
      .toEqual({ reasoning_effort: 'high' });
    expect(await reviewerPreferences(session, ROOT, { reasoning_effort: 'medium' }, files({}))).toEqual({ model: 'mai-code-2' });
    expect(await fillPreferences(session, { kind: undefined })).toEqual({});
  });

  it('is a no-op outside the Squad coordinator, for other tools and members without config or work default', async () => {
    const cases: Array<[ReturnType<typeof hooksFor>, object]> = [
      [hooksFor({ agent: 'Other' }), spawn({ prompt: 'p' })],
      [hooksFor({ agent: null }), spawn({ prompt: 'p' })],
      [hooksFor(), spawn({ prompt: 'p' }, { agentId: 'child' })],
      [hooksFor(), { ...spawn({ prompt: 'p' }), toolName: 'task' }],
      [hooksFor(), spawn(undefined)],
      [hooksFor(), { ...spawn({ prompt: 'p' }), toolArgs: { name: '🏗️ Lead · Review', kickoff: { prompt: 'p' } } }],
      [hooksFor({ cfg: null, roster: null }), spawn({ prompt: 'p' }, {}, '🏗️ Lead · Review')],
    ];
    for (const [{ hooks }, input] of cases) expect(await hooks.onPreToolUse(input)).toBeUndefined();
  });

  it('resolves the member from the title, then the kickoff identity, and honours auto and defaults', () => {
    expect(memberFrom({ name: '🔧 Backend · NuGet patch updates' })).toBe('backend');
    expect(memberFrom({ name: '🏗️ Lead · Security report synthesis' })).toBe('lead');
    expect(memberFrom({ name: 'Untitled', kickoff: { prompt: 'You are Backend (canonical identity backend).' } })).toBe('backend');
    expect(memberFrom({ name: 'Untitled' })).toBeUndefined();
    expect(spawnPreferences({ agentModelOverrides: { Backend: 'auto' }, defaultModel: 'gpt-6.1-sol' }, 'backend'))
      .toEqual({ model: 'gpt-6.1-sol', effort: undefined });
    expect(spawnPreferences({ defaultReasoningEffort: 'HIGH', agentReasoningEffortOverrides: { backend: 'bogus' } }, 'backend'))
      .toEqual({ model: undefined, effort: 'high' });
  });

  it('finds the nearest .squad/config.json and stops at the repository root', () => {
    const files = { [join(ROOT, '.squad', 'config.json')]: JSON.stringify(config) };
    expect(readSquadConfig(join(ROOT, 'src', 'deep'), fakeFs(files))).toEqual(config);
    expect(readSquadConfig(join(ROOT, 'src'), fakeFs({}, join(ROOT, 'src')))).toBeUndefined();
    expect(readSquadConfig(join(ROOT, 'src'), fakeFs({ [join(ROOT, '.squad', 'config.json')]: '{not json' }))).toBeUndefined();
  });

  it('joins only with hooks and ships as a user-owned extension', () => {
    const dir = '.squad-templates/extensions/squad-spawn-config';
    const entry = readFileSync(resolve(dir, 'extension.mjs'), 'utf8');
    expect(entry).toContain("import { joinSession } from '@github/copilot-sdk/extension'");
    expect(entry).toContain('hooks: createSpawnConfigHooks(() => session)');
    expect(entry).not.toMatch(/tools:|createSession\(|\.plan\.update\(|writeFile|setInterval\(/);
    const hooks = readFileSync(resolve(dir, 'spawn-config-hooks.mjs'), 'utf8');
    expect(hooks.match(/^import .*$/gm)).toEqual([
      "import { existsSync, readFileSync } from 'node:fs';",
      "import { dirname, join } from 'node:path';",
    ]);
    const entries = TEMPLATE_MANIFEST.filter(item => item.source.startsWith('extensions/squad-spawn-config/'));
    expect(entries.map(item => item.source).sort())
      .toEqual(readdirSync(resolve(dir)).map(name => `extensions/squad-spawn-config/${name}`).sort());
    for (const item of entries) {
      expect(item.overwriteOnUpgrade).toBe(false);
      expect(item.destination).toBe(`../.github/${item.source}`);
    }
  });
});
