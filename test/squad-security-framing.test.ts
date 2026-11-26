import { describe, expect, it, vi } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  createSecurityFramingHooks, missionFrom, SECURITY_PREFIX,
} from '../.squad-templates/extensions/squad-security-framing/framing-hooks.mjs';
import { TEMPLATE_MANIFEST } from '../packages/squad-cli/src/cli/core/templates.js';

const reviewerArgs = {
  description: 'Security review repository dependencies',
  prompt: 'Perform a read-only security review of the current worktree.',
  agent_type: 'security-review',
  name: 'security-review',
  mode: 'sync',
};

function hooksFor(agentName: string | null = 'Squad', getCurrent?: () => Promise<unknown>) {
  const session = {
    rpc: { agent: { getCurrent: vi.fn(getCurrent ?? (async () => ({ agent: agentName ? { name: agentName } : null }))) } },
  };
  return { session, hooks: createSecurityFramingHooks(() => session, async () => ({ reviewerPreferences: async () => ({}) })) };
}

const input = (toolArgs: unknown, extra: object = {}) => ({
  sessionId: 'foreground', timestamp: new Date(), workingDirectory: '/repo', toolName: 'task', toolArgs, ...extra,
});

describe('squad-security-framing hooks', () => {
  it('labels the coordinator reviewer and runs it in the background without changing the review', async () => {
    const { hooks } = hooksFor();
    const result = await hooks.onPreToolUse(input({ ...reviewerArgs }));
    expect(result).toEqual({
      modifiedArgs: { ...reviewerArgs, description: '🛡️ Security · Repository dependencies', mode: 'background' },
    });
    const { modifiedArgs } = result as { modifiedArgs: typeof reviewerArgs };
    expect(modifiedArgs.prompt).toBe(reviewerArgs.prompt);
    expect(modifiedArgs.agent_type).toBe('security-review');
  });

  it('never adds a mode argument the host schema has not shown', async () => {
    const { hooks } = hooksFor();
    const { mode: _mode, ...withoutMode } = reviewerArgs;
    const result = await hooks.onPreToolUse(input(withoutMode)) as { modifiedArgs: Record<string, unknown> };
    expect(result.modifiedArgs).not.toHaveProperty('mode');
    expect(result.modifiedArgs.description).toBe('🛡️ Security · Repository dependencies');
    const post = await hooks.onPostToolUse(input(result.modifiedArgs)) as { additionalContext: string };
    expect(post.additionalContext).toMatch(/has returned its report/);
    expect(post.additionalContext).toMatch(/create the restitution owner with create_session, clearly named as a synthesis[^]*Lead · Security report synthesis[^]*carrying the complete report/);
    expect(post.additionalContext).toMatch(/Backend · Dependency updates[^]*Neither restitution nor requested follow-up waits for that answer/);
  });

  it('returns the framing steps with a background handle', async () => {
    const { hooks } = hooksFor();
    const pre = await hooks.onPreToolUse(input({ ...reviewerArgs })) as { modifiedArgs: object };
    const post = await hooks.onPostToolUse(input(pre.modifiedArgs)) as { additionalContext: string };
    expect(post.additionalContext).toContain('"🛡️ Security · Repository dependencies" now runs in the background');
    expect(post.additionalContext).toMatch(/already satisfied\. It is the only agent doing this review/);
    expect(post.additionalContext).toMatch(/acknowledgment[^]*squad_session_plan_read[^]*When its report returns:[^]*create_session[^]*verified app_url/);
    expect(post.additionalContext, 'no waiting child while the review runs')
      .toMatch(/only agent doing this review: do not start another review, scan or audit, and do not create the restitution owner yet/);
    expect(post.additionalContext.indexOf('create_session')).toBeGreaterThan(post.additionalContext.indexOf('When its report returns:'));
    expect(post.additionalContext).not.toMatch(/send_session_message|wait for the report message/);
    expect(post.additionalContext, 'requested follow-up is dispatched with the host question')
      .toMatch(/also create the branded App owner for each follow-up the user requested that needs only the report[^]*ask any host-required follow-up question/);
    expect(post.additionalContext).toMatch(/Neither restitution nor requested follow-up waits for that answer/);
    expect(post.additionalContext).not.toMatch(/then dispatch the requested follow-up work/i);
  });

  it('is a no-op for other agents, subagents, tools, reviewers and unknown hosts', async () => {
    const cases: Array<[ReturnType<typeof hooksFor>, ReturnType<typeof input>]> = [
      [hooksFor('Other agent'), input({ ...reviewerArgs })],
      [hooksFor(null), input({ ...reviewerArgs })],
      [hooksFor('Squad', async () => { throw new Error('unsupported'); }), input({ ...reviewerArgs })],
      [hooksFor(), input({ ...reviewerArgs }, { agentId: 'security-review-child' })],
      [hooksFor(), input({ ...reviewerArgs, agent_type: 'code-review' })],
      [hooksFor(), { ...input({ ...reviewerArgs }), toolName: 'powershell' }],
      [hooksFor(), input('not an object')],
    ];
    for (const [{ hooks }, call] of cases) {
      expect(await hooks.onPreToolUse(call)).toBeUndefined();
      expect(await hooks.onPostToolUse(call)).toBeUndefined();
    }
    const unjoined = createSecurityFramingHooks(() => undefined);
    expect(await unjoined.onPreToolUse(input({ ...reviewerArgs }))).toBeUndefined();
  });

  it('drops a failed reviewer call so the next one gets its own guidance', async () => {
    const { hooks } = hooksFor();
    await hooks.onPreToolUse(input({ ...reviewerArgs }));
    await hooks.onPostToolUseFailure(input({ ...reviewerArgs, mode: 'background' }));
    const { mode: _mode, ...withoutMode } = reviewerArgs;
    const pre = await hooks.onPreToolUse(input({ ...withoutMode, description: 'Auth flows' })) as { modifiedArgs: object };
    const post = await hooks.onPostToolUse(input(pre.modifiedArgs)) as { additionalContext: string };
    expect(post.additionalContext).toContain('"🛡️ Security · Auth flows" has returned its report');
  });

  it('fills the reviewer model and effort from the spawn-config policy, never over the call', async () => {
    const policy = { reviewerPreferences: vi.fn(async () => ({ model: 'mai-code-2', reasoning_effort: 'high' })) };
    const session = { rpc: { agent: { getCurrent: async () => ({ agent: { name: 'Squad' } }) } } };
    const hooks = createSecurityFramingHooks(() => session, async () => policy);
    const result = await hooks.onPreToolUse(input({ ...reviewerArgs })) as { modifiedArgs: Record<string, unknown> };
    expect(result.modifiedArgs).toEqual({
      ...reviewerArgs, description: '🛡️ Security · Repository dependencies', mode: 'background', model: 'mai-code-2', reasoning_effort: 'high',
    });
    expect(policy.reviewerPreferences).toHaveBeenCalledWith(session, '/repo', expect.objectContaining({ agent_type: 'security-review' }));
    const explicit = await hooks.onPreToolUse(input({ ...reviewerArgs, model: 'gpt-6.1-sol', reasoning_effort: 'low' })) as { modifiedArgs: Record<string, unknown> };
    expect(explicit.modifiedArgs).toMatchObject({ model: 'gpt-6.1-sol', reasoning_effort: 'low' });
    expect(policy.reviewerPreferences).toHaveBeenCalledTimes(1);
    const broken = createSecurityFramingHooks(() => session, async () => { throw new Error('missing'); });
    const fallback = await broken.onPreToolUse(input({ ...reviewerArgs })) as { modifiedArgs: Record<string, unknown> };
    expect(fallback.modifiedArgs).not.toHaveProperty('model');
    expect(fallback.modifiedArgs.description).toBe('🛡️ Security · Repository dependencies');
  });

  it('loads the sibling squad-spawn-config policy by default', async () => {
    const root = mkdtempSync(join(tmpdir(), 'squad-framing-'));
    try {
      mkdirSync(join(root, '.git'));
      mkdirSync(join(root, '.squad'));
      writeFileSync(join(root, '.squad', 'config.json'), '{"version":1}');
      const session = {
        rpc: {
          agent: { getCurrent: async () => ({ agent: { name: 'Squad' } }) },
          model: { list: async () => ({ list: [{ id: 'mai-code-2', supportedReasoningEfforts: ['high'] }] }), getCurrent: async () => ({ modelId: 'gpt-6.1-sol' }) },
        },
      };
      const hooks = createSecurityFramingHooks(() => session);
      const result = await hooks.onPreToolUse(input({ ...reviewerArgs }, { workingDirectory: root })) as { modifiedArgs: Record<string, unknown> };
      expect(result.modifiedArgs).toMatchObject({ model: 'mai-code-2', reasoning_effort: 'high', prompt: reviewerArgs.prompt });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('derives one mission label without stacking prefixes', () => {
    expect(missionFrom('Security review repository dependencies')).toBe('Repository dependencies');
    expect(missionFrom('Security review of dependencies')).toBe('Dependencies');
    expect(missionFrom('Security review for the auth module')).toBe('Auth module');
    expect(missionFrom('Security Review: auth flows')).toBe('Auth flows');
    expect(missionFrom('🛡️ Security · Dependency review')).toBe('Dependency review');
    expect(missionFrom('🔒 Security · Project review')).toBe('Project review');
    expect(missionFrom('')).toBe('Project review');
    expect(SECURITY_PREFIX + missionFrom(SECURITY_PREFIX + 'Repo')).toBe('🛡️ Security · Repo');
  });

  it('joins only with hooks and ships as a user-owned extension', () => {
    const entry = readFileSync(resolve('.squad-templates/extensions/squad-security-framing/extension.mjs'), 'utf8');
    expect(entry).toContain("import { joinSession } from '@github/copilot-sdk/extension'");
    expect(entry).toContain('hooks: createSecurityFramingHooks(() => session)');
    expect(entry).not.toMatch(/tools:|createSession\(|\.plan\.update\(|\.mode\.set\(|setInterval\(/);
    const hooks = readFileSync(resolve('.squad-templates/extensions/squad-security-framing/framing-hooks.mjs'), 'utf8');
    expect(hooks).not.toMatch(/^import /m);

    const entries = TEMPLATE_MANIFEST.filter(item => item.source.startsWith('extensions/squad-security-framing/'));
    expect(entries.map(item => item.source).sort()).toEqual(
      readdirSync(resolve('.squad-templates/extensions/squad-security-framing')).map(name => `extensions/squad-security-framing/${name}`).sort(),
    );
    for (const item of entries) {
      expect(item.overwriteOnUpgrade).toBe(false);
      expect(item.destination).toBe(`../.github/${item.source}`);
    }
  });
});
