import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createSessionPlanTools } from '../.squad-templates/extensions/squad-session-plan/plan-tools.mjs';

const hash = (content: string) => createHash('sha256').update(content, 'utf8').digest('hex');
const invocation = { sessionId: 'foreground', toolCallId: 'call', toolName: 'test', arguments: {} };
type Plan = { exists: boolean; content: string | null; path: string | null };

function host(content: string | null = null) {
  let state: Plan = { exists: content !== null, content, path: '/session-workspace/plan.md' };
  const read = vi.fn(async () => ({ ...state }));
  const update = vi.fn(async ({ content: next }: { content: string }) => {
    state = { ...state, exists: true, content: next };
  });
  const session = {
    sessionId: 'foreground',
    workspacePath: '/session-workspace',
    rpc: { plan: { read, update } },
    log: vi.fn(async () => {}),
  };
  const tools = createSessionPlanTools(() => session);
  return {
    session, read, update, tools,
    set: (value: Partial<Plan>) => { state = { ...state, ...value }; },
    call: (operation: string, args: object = {}, context: object = invocation) =>
      invoke(tools, operation, args, context),
  };
}

async function invoke(tools: ReturnType<typeof createSessionPlanTools>, operation: string, args = {}, context = invocation) {
  const tool = tools.find((tool: { name: string }) => tool.name === `squad_session_plan_${operation}`)!;
  const raw = await tool.handler(args, context);
  return { raw, data: JSON.parse(raw.textResultForLlm) };
}

afterEach(() => vi.restoreAllMocks());

describe('genuine current foreground session plan tools', () => {
  it('construction and reload perform no reads, writes, hooks, or unsolicited publication', async () => {
    const h = host('# User plan');
    const reloaded = createSessionPlanTools(() => h.session);
    expect(h.read).not.toHaveBeenCalled();
    expect(h.update).not.toHaveBeenCalled();
    expect(h.tools.map((tool: { name: string }) => tool.name)).toEqual([
      'squad_session_plan_read', 'squad_session_plan_publish', 'squad_session_plan_update',
    ]);
    expect((await invoke(reloaded, 'read')).data).toMatchObject({ status: 'existing', content: '# User plan' });
    expect(h.read).toHaveBeenCalledOnce();
    expect(h.update).not.toHaveBeenCalled();
  });

  it('reads fresh or existing snapshots with exact Unicode content hashes', async () => {
    const h = host();
    const fresh = await h.call('read');
    expect(fresh.raw.resultType).toBe('success');
    expect(fresh.data).toMatchObject({
      status: 'fresh', sessionId: 'foreground', exists: false, content: null, hash: null,
      path: '/session-workspace/plan.md', writeAttempted: false,
    });
    h.set({ exists: true, content: '# étapes\r\n- [ ] vérifier 🧪\n' });
    const existing = await h.call('read');
    expect(existing.data.hash).toBe(hash('# étapes\r\n- [ ] vérifier 🧪\n'));
    expect(existing.data.freshness).toMatch(/no atomic compare-and-swap/);
    expect(existing.data.action).toMatch(/reconcile with the user/);
    expect(h.update).not.toHaveBeenCalled();
  });

  it('publishes exclusively through plan.update and verifies by re-read', async () => {
    const h = host();
    const result = await h.call('publish', { content: '# Scope\n- [ ] Deliver\n' });
    expect(result.raw.resultType).toBe('success');
    expect(result.data).toMatchObject({
      status: 'published', exists: true, content: '# Scope\n- [ ] Deliver\n',
      hash: hash('# Scope\n- [ ] Deliver\n'), writeAttempted: true, verified: true,
    });
    expect(h.update).toHaveBeenCalledExactlyOnceWith({ content: '# Scope\n- [ ] Deliver\n' });
    expect(h.read).toHaveBeenCalledTimes(2);
    expect(h.session.log).not.toHaveBeenCalled();
  });

  it.each(['# Already authored by user', ''])('refuses to publish over ANY existing plan (%j)', async (content) => {
    const h = host(content);
    const result = await h.call('publish', { content: '# Replacement' });
    expect(result.raw.resultType).toBe('failure');
    expect(result.data).toMatchObject({
      status: 'conflict', content, hash: hash(content), writeAttempted: false, verified: false,
    });
    expect(h.update).not.toHaveBeenCalled();
    expect(h.session.log).toHaveBeenCalledWith(expect.stringContaining('conflict'), { level: 'warning' });
  });

  it('updates an existing plan only with the caller hash and verifies the result', async () => {
    const h = host('# Pending');
    const snapshot = (await h.call('read')).data;
    const result = await h.call('update', { content: '# Complete', expectedHash: snapshot.hash });
    expect(result.data).toMatchObject({ status: 'updated', hash: hash('# Complete'), verified: true });
    expect(h.update).toHaveBeenCalledExactlyOnceWith({ content: '# Complete' });
    expect(h.read).toHaveBeenCalledTimes(3);
  });

  it('refuses a stale caller hash after a user edit and returns the latest snapshot', async () => {
    const h = host('# Initial');
    const earlier = (await h.call('read')).data;
    h.set({ content: '# User edit' });
    const result = await h.call('update', { content: '# Worker edit', expectedHash: earlier.hash });
    expect(result.raw.resultType).toBe('failure');
    expect(result.data).toMatchObject({
      status: 'conflict', content: '# User edit', hash: hash('# User edit'), writeAttempted: false,
    });
    expect(h.update).not.toHaveBeenCalled();
    expect(result.data.action).toMatch(/Do not automatically retry/);
  });

  it('does not turn update into publication if the plan was removed', async () => {
    const h = host();
    const result = await h.call('update', { content: '# New', expectedHash: hash('# Old') });
    expect(result.data).toMatchObject({ status: 'conflict', exists: false, hash: null });
    expect(h.update).not.toHaveBeenCalled();
  });

  it.each([
    { exists: true, content: '# External edit' },
    { exists: false, content: null },
    { path: '/another-workspace/plan.md' },
  ])('never claims verification when the re-read differs: %j', async (change) => {
    const h = host();
    h.update.mockImplementationOnce(async ({ content }) => h.set({ exists: true, content, ...change }));
    const result = await h.call('publish', { content: '# Requested' });
    expect(result.raw.resultType).toBe('failure');
    expect(result.data).toMatchObject({ status: 'conflict', writeAttempted: true, verified: false, ...change });
    expect(h.update).toHaveBeenCalledOnce(); // no retry/rollback clobbering the observed plan
  });

  it('surfaces write and verification RPC failures with uncertain outcome instead of success', async () => {
    const h = host();
    h.update.mockRejectedValueOnce(Object.assign(new Error('host conflict'), { code: 'CONFLICT' }));
    const failed = await h.call('publish', { content: '# Requested' });
    expect(failed.raw.resultType).toBe('failure');
    expect(failed.data).toMatchObject({
      status: 'error', stage: 'update', message: 'host conflict', errorCode: 'CONFLICT',
      writeAttempted: true, verified: false,
    });
    expect(failed.data.action).toMatch(/uncertain/);
    h.read.mockResolvedValueOnce({ exists: false, content: null, path: '/session-workspace/plan.md' });
    h.read.mockRejectedValueOnce(new Error('verification read failed'));
    const unverified = await h.call('publish', { content: '# Requested' });
    expect(unverified.data).toMatchObject({
      status: 'error', stage: 'verify', writeAttempted: true, verified: false,
      message: 'verification read failed',
    });
  });

  it('surfaces read errors and unsupported RPC without attempting a write', async () => {
    const h = host();
    h.read.mockRejectedValueOnce(new Error('read failed'));
    const error = await h.call('publish', { content: '# Requested' });
    expect(error.data).toMatchObject({ status: 'error', stage: 'read', writeAttempted: false, message: 'read failed' });
    h.read.mockRejectedValueOnce(Object.assign(new Error('Method not found'), { code: -32601 }));
    const unavailable = await h.call('read');
    expect(unavailable.data).toMatchObject({ status: 'unavailable', errorCode: -32601 });
    expect(unavailable.data.action).toMatch(/host supports extensions/);
    expect(unavailable.data.action).toMatch(/visibly in chat/);
    expect(h.update).not.toHaveBeenCalled();
  });

  it.each([
    undefined,
    { sessionId: 'foreground', workspacePath: undefined, rpc: {} },
    { sessionId: 'foreground', workspacePath: '/workspace', rpc: {} },
    { sessionId: 'foreground', workspacePath: '/workspace', rpc: { plan: { read: null } } },
  ])('returns actionable unavailable for missing joined session/workspace/RPC: %j', async (session) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const tools = createSessionPlanTools(() => session);
    const result = await invoke(tools, 'publish', { content: '# New' });
    expect(result.raw.resultType).toBe('failure');
    expect(result.data).toMatchObject({ status: 'unavailable', writeAttempted: false });
    expect(result.data.action).toMatch(/reload.*read again/);
    expect(console.error).toHaveBeenCalled();
  });

  it('allows read-only RPC, but explicitly refuses missing update support', async () => {
    const h = host();
    const tools = createSessionPlanTools(() => ({
      ...h.session, rpc: { plan: { read: h.read } },
    }));
    expect((await invoke(tools, 'read')).data.status).toBe('fresh');
    expect((await invoke(tools, 'publish', { content: '# New' })).data.status).toBe('unavailable');
    expect(h.read).toHaveBeenCalledOnce();
  });

  it('handles unavailable paths before and after writes explicitly', async () => {
    const h = host();
    h.set({ path: null });
    expect((await h.call('publish', { content: '# New' })).data).toMatchObject({
      status: 'unavailable', writeAttempted: false,
    });
    expect(h.update).not.toHaveBeenCalled();
    h.set({ path: '/session-workspace/plan.md' });
    h.update.mockImplementationOnce(async () => h.set({ path: null }));
    expect((await h.call('publish', { content: '# New' })).data).toMatchObject({
      status: 'unavailable', writeAttempted: true, verified: false,
    });
  });

  it('fails closed for malformed read results rather than silently publishing', async () => {
    const h = host();
    h.read.mockResolvedValueOnce({ exists: true, content: null, path: '/session-workspace/plan.md' });
    expect((await h.call('publish', { content: '# New' })).data).toMatchObject({
      status: 'error', stage: 'read', writeAttempted: false,
    });
    expect(h.update).not.toHaveBeenCalled();
  });

  it.each([
    ['publish', {}], ['publish', { content: '' }], ['publish', { content: '   ' }],
    ['update', { content: '# New' }], ['update', { content: '# New', expectedHash: 'not-a-hash' }],
  ])('validates %s arguments without host reads or writes', async (operation, args) => {
    const h = host();
    expect((await h.call(operation as string, args as object)).data.status).toBe('invalid');
    expect(h.read).not.toHaveBeenCalled();
    expect(h.update).not.toHaveBeenCalled();
  });

  it('serializes two publications; the queued caller observes the first plan and cannot overwrite it', async () => {
    const h = host();
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    h.update.mockImplementationOnce(async ({ content }) => {
      await gate;
      h.set({ exists: true, content });
    });
    const first = h.call('publish', { content: '# First' });
    const second = h.call('publish', { content: '# Second' });
    await vi.waitFor(() => expect(h.update).toHaveBeenCalledOnce());
    expect(h.read).toHaveBeenCalledOnce(); // second writer hasn't even pre-read
    release();
    expect((await first).data.status).toBe('published');
    expect((await second).data).toMatchObject({ status: 'conflict', content: '# First' });
    expect(h.update).toHaveBeenCalledOnce();
  });

  it('serializes own updates and rejects the second stale expectedHash', async () => {
    const h = host('# Initial');
    const args = { expectedHash: hash('# Initial') };
    const results = await Promise.all([
      h.call('update', { ...args, content: '# First' }),
      h.call('update', { ...args, content: '# Second' }),
    ]);
    expect(results.map(result => result.data.status)).toEqual(['updated', 'conflict']);
    expect(results[1].data.content).toBe('# First');
    expect(h.update).toHaveBeenCalledOnce();
  });

  it('an RPC failure does not poison the own-writer queue', async () => {
    const h = host();
    h.read.mockRejectedValueOnce(new Error('temporary read failure'));
    const results = await Promise.all([
      h.call('publish', { content: '# First' }),
      h.call('publish', { content: '# Second' }),
    ]);
    expect(results.map(result => result.data.status)).toEqual(['error', 'published']);
  });

  it('refuses other-session or attributed subagent writes; a subagent may read', async () => {
    const h = host();
    expect((await h.call('read', {}, { ...invocation, sessionId: 'child-session' })).data.status).toBe('denied');
    expect((await h.call('publish', { content: '# New' }, { ...invocation, agentId: 'worker' })).data.status).toBe('denied');
    expect(h.read).not.toHaveBeenCalled();
    expect(h.update).not.toHaveBeenCalled();
    expect((await h.call('read', {}, { ...invocation, agentId: 'worker' })).data.status).toBe('fresh');
  });

  it('does not write on cancelled invocations, including cancellation during pre-read', async () => {
    const h = host();
    const controller = new AbortController();
    controller.abort();
    expect((await h.call('publish', { content: '# New' }, { ...invocation, signal: controller.signal })).data.status).toBe('denied');
    expect(h.read).not.toHaveBeenCalled();
    const pending = new AbortController();
    h.read.mockImplementationOnce(async () => {
      pending.abort();
      return { exists: false, content: null, path: '/session-workspace/plan.md' };
    });
    expect((await h.call('publish', { content: '# New' }, { ...invocation, signal: pending.signal })).data.status).toBe('denied');
    expect(h.update).not.toHaveBeenCalled();
  });

  it('timeline failures are surfaced on stderr without converting a failed tool into success', async () => {
    const h = host('# Existing');
    h.session.log.mockRejectedValueOnce(new Error('log failed'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await h.call('publish', { content: '# New' });
    expect(result.raw.resultType).toBe('failure');
    expect(result.data.status).toBe('conflict');
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('conflict'), 'Timeline logging also failed:', expect.any(Error),
    );
  });

  it('tool schemas require deliberate freshness and descriptions disclose best-effort concurrency', () => {
    const h = host();
    for (const tool of h.tools) {
      expect(tool.description).toMatch(/no atomic compare-and-swap/);
      expect(tool.parameters.additionalProperties).toBe(false);
    }
    expect(h.tools[2].parameters.required).toEqual(['content', 'expectedHash']);
    const entry = readFileSync(resolve('.squad-templates/extensions/squad-session-plan/extension.mjs'), 'utf8');
    expect(entry).toContain("import { joinSession } from '@github/copilot-sdk/extension'");
    expect(entry).toContain('tools: createSessionPlanTools(() => session)');
    expect(entry).not.toMatch(/createSession\(|\.mode\.set\(|\.plan\.update\(|hooks:\s*\{|setInterval\(/);
  });
});
