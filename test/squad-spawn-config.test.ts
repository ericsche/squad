import { describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  createSpawnConfigHooks, memberFrom, readSquadConfig, spawnPreferences,
} from '../.squad-templates/extensions/squad-spawn-config/spawn-config-hooks.mjs';
import { TEMPLATE_MANIFEST } from '../packages/squad-cli/src/cli/core/templates.js';

const ROOT = resolve('/repo');
const config = {
  version: 1,
  agentModelOverrides: { backend: 'mai-code-2' },
  agentReasoningEffortOverrides: { backend: 'high' },
};
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

function hooksFor(options: { agent?: string | null; models?: unknown[] | null; current?: string; cfg?: object | null } = {}) {
  const { agent = 'Squad', models = hostModels, current = 'gpt-6.1-sol', cfg = config } = options;
  const session = {
    rpc: {
      agent: { getCurrent: vi.fn(async () => ({ agent: agent ? { name: agent } : null })) },
      model: {
        list: vi.fn(async () => (models === null ? Promise.reject(new Error('unsupported')) : { list: models })),
        getCurrent: vi.fn(async () => ({ modelId: current })),
      },
    },
  };
  const files = cfg ? { [join(ROOT, '.squad', 'config.json')]: JSON.stringify(cfg) } : {};
  return { session, hooks: createSpawnConfigHooks(() => session, fakeFs(files)) };
}

const spawn = (kickoff: object | undefined, extra: object = {}) => ({
  toolName: 'create_session', workingDirectory: ROOT, timestamp: new Date(), sessionId: 'coordinator',
  toolArgs: { name: '🔧 Backend · NuGet patch updates', session_kind: 'project', ...(kickoff ? { kickoff } : {}) },
  ...extra,
});

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
    const { hooks } = hooksFor({ cfg: { agentReasoningEffortOverrides: { backend: 'max' } } });
    expect(await hooks.onPreToolUse(spawn({ prompt: 'p' }))).toBeUndefined();
    const withModel = hooksFor({ cfg: { agentModelOverrides: { backend: 'claude-haiku-4.5' }, agentReasoningEffortOverrides: { backend: 'high' } } });
    const result = await withModel.hooks.onPreToolUse(spawn({ prompt: 'p' })) as { modifiedArgs: { kickoff: Record<string, unknown> } };
    expect(result.modifiedArgs.kickoff).toMatchObject({ model: 'claude-haiku-4.5', reasoning_effort: 'high' });
  });

  it('is a no-op outside the Squad coordinator, for other tools, unconfigured members and missing config', async () => {
    const cases: Array<[ReturnType<typeof hooksFor>, object]> = [
      [hooksFor({ agent: 'Other' }), spawn({ prompt: 'p' })],
      [hooksFor({ agent: null }), spawn({ prompt: 'p' })],
      [hooksFor(), spawn({ prompt: 'p' }, { agentId: 'child' })],
      [hooksFor(), { ...spawn({ prompt: 'p' }), toolName: 'task' }],
      [hooksFor(), spawn(undefined)],
      [hooksFor(), { ...spawn({ prompt: 'p' }), toolArgs: { name: '🏗️ Lead · Review', kickoff: { prompt: 'p' } } }],
      [hooksFor({ cfg: null }), spawn({ prompt: 'p' })],
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
