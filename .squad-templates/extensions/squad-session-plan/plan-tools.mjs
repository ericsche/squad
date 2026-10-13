// Dependency-free apart from Node built-ins; tests inject the joined session.
import { createHash } from 'node:crypto';

const freshness = 'Snapshot only: hash is SHA-256 of exact UTF-8 content (null when absent). ' +
  'Re-read and deliberately reconcile before each update. Writers are serialized only within ' +
  'this extension instance. The host has no atomic compare-and-swap; external edits can race ' +
  'between read/write/verification. A verified write is not approval or a guarantee of future state.';
const fallback = 'Show the plan visibly in chat; do not claim native publication or approval.';
const recover = 'Check that the host supports extensions and session.rpc.plan.read/update with a ' +
  'session workspace enabled, then reload the extension and read again. ' + fallback;
const reconcile = 'Read the latest plan and deliberately reconcile with the user before another ' +
  'update using that read hash. Do not automatically retry or overwrite.';

function snapshot(value) {
  if (!value || typeof value.exists !== 'boolean' ||
    (value.exists ? typeof value.content !== 'string' : value.content !== null)) {
    throw new Error('Host returned an invalid plan.read result; cannot establish freshness.');
  }
  if (typeof value.path !== 'string' || !value.path.trim()) {
    return null;
  }
  return {
    exists: value.exists,
    content: value.content,
    path: value.path,
    hash: value.exists ? createHash('sha256').update(value.content, 'utf8').digest('hex') : null,
  };
}

/**
 * Only the joined foreground session is used. This factory does no RPC or I/O
 * on construction, so startup/reload never publishes a plan.
 */
export function createSessionPlanTools(getSession) {
  let writers = Promise.resolve();

  function serialize(action) {
    const result = writers.then(action);
    // A failed request must not poison subsequent requests.
    writers = result.then(() => undefined, () => undefined);
    return result;
  }

  async function run(operation, args, invocation) {
    let session;
    let stage = 'preflight';
    let writeAttempted = false;

    async function result(status, details = {}) {
      const data = {
        status, operation, sessionId: session?.sessionId ?? null,
        freshness, writeAttempted, verified: false, ...details,
      };
      const successful = ['fresh', 'existing', 'published', 'updated'].includes(status);
      if (!successful) {
        const message = `[squad-session-plan] ${operation}: ${status}. ${details.message ?? ''} ${details.action ?? ''}`;
        try {
          if (typeof session?.log === 'function') await session.log(message, { level: 'warning' });
          else console.error(message);
        } catch (error) {
          console.error(message, 'Timeline logging also failed:', error);
        }
      }
      return { textResultForLlm: JSON.stringify(data), resultType: successful ? 'success' : 'failure' };
    }

    try {
      session = getSession();
      if (!session || typeof session.sessionId !== 'string' || !session.sessionId ||
        typeof session.workspacePath !== 'string' || !session.workspacePath.trim()) {
        return await result('unavailable', { message: 'No joined current-session workspace is available.', action: recover });
      }
      if (invocation?.sessionId !== session.sessionId) {
        return await result('denied', {
          message: 'Tool invocation does not match the joined foreground session.',
          action: 'Use these tools only from the current foreground session. ' + fallback,
        });
      }
      if (operation !== 'read' && invocation?.agentId) {
        return await result('denied', {
          message: 'Attributed subagents may not write the foreground session plan.',
          action: 'Return proposed progress to the foreground coordinator for deliberate reconciliation.',
        });
      }
      if (invocation?.signal?.aborted) {
        return await result('denied', { message: 'Tool invocation was cancelled; no write attempted.', action: fallback });
      }
      const plan = session.rpc?.plan;
      if (typeof plan?.read !== 'function' || (operation !== 'read' && typeof plan.update !== 'function')) {
        return await result('unavailable', { message: 'Required current-session plan RPC is missing.', action: recover });
      }
      if (operation !== 'read' && (typeof args?.content !== 'string' || !args.content.trim())) {
        return await result('invalid', { message: 'content must be a non-empty Markdown string.', action: 'Supply the deliberate plan content.' });
      }
      if (operation === 'update' && (typeof args?.expectedHash !== 'string' || !/^[a-f0-9]{64}$/.test(args.expectedHash))) {
        return await result('invalid', { message: 'expectedHash must be the hash of an existing plan from a fresh read.', action: reconcile });
      }
      stage = 'read';
      const current = snapshot(await plan.read());
      if (!current) {
        return await result('unavailable', { message: 'Host plan.read returned no enabled workspace path.', action: recover });
      }
      if (operation === 'read') {
        return await result(current.exists ? 'existing' : 'fresh', { ...current, action: current.exists ? reconcile : 'Publish only on explicit request.' });
      }
      if (operation === 'publish' && current.exists) {
        return await result('conflict', { ...current, message: 'A plan already exists, including an empty plan; publish refused.', action: reconcile });
      }
      if (operation === 'update' && (!current.exists || args.expectedHash !== current.hash)) {
        return await result('conflict', { ...current, message: 'Plan is absent or expectedHash no longer matches; update refused.', action: reconcile });
      }
      // Check again after the await, including writers that waited in the queue.
      if (invocation?.signal?.aborted) {
        return await result('denied', { ...current, message: 'Tool invocation was cancelled; no write attempted.', action: fallback });
      }
      stage = 'update';
      writeAttempted = true;
      await plan.update({ content: args.content });
      stage = 'verify';
      const observed = snapshot(await plan.read());
      if (!observed) {
        return await result('unavailable', {
          message: 'Write attempted, but the workspace path disappeared during verification.',
          action: 'Write outcome is uncertain. Read again before taking any action. ' + fallback,
        });
      }
      if (!observed.exists || observed.content !== args.content || observed.path !== current.path) {
        return await result('conflict', {
          ...observed, message: 'Write attempted, but re-read did not verify the requested plan at the same path.',
          action: reconcile,
        });
      }
      return await result(operation === 'publish' ? 'published' : 'updated', { ...observed, verified: true });
    } catch (error) {
      const unsupported = error?.code === -32601;
      return await result(unsupported ? 'unavailable' : 'error', {
        stage,
        message: error instanceof Error ? error.message : String(error),
        errorCode: error?.code ?? null,
        action: (writeAttempted ? 'Write outcome is uncertain; read again before any further write. ' : '') +
          (unsupported ? recover : 'Resolve the reported host error, then read again. ' + fallback),
      });
    }
  }

  const content = { type: 'string', minLength: 1, description: 'Deliberate complete Markdown plan, not a TODO/SQL synchronization.' };
  return [
    {
      name: 'squad_session_plan_read',
      description: 'Read the genuine current foreground session plan through host RPC. No writes. ' + freshness,
      parameters: { type: 'object', properties: {}, additionalProperties: false },
      handler: (args, invocation) => run('read', args, invocation),
    },
    {
      name: 'squad_session_plan_publish',
      description: 'Explicit foreground-coordinator publication of a new native current-session plan. ' +
        'Refuses ANY existing plan; no background publication, mode change, or approval. Re-reads to verify. ' + freshness,
      parameters: { type: 'object', properties: { content }, required: ['content'], additionalProperties: false },
      handler: (args, invocation) => serialize(() => run('publish', args, invocation)),
    },
    {
      name: 'squad_session_plan_update',
      description: 'Explicit foreground-coordinator reconciliation of an EXISTING native current-session plan. ' +
        'Requires expectedHash from a fresh read; refuses a mismatch or absent plan. Re-reads to verify. ' +
        'No automatic conflict retry, background updates, mode change, or approval. ' + freshness,
      parameters: {
        type: 'object',
        properties: {
          content,
          expectedHash: { type: 'string', pattern: '^[a-f0-9]{64}$', description: 'Exact hash from the latest read of the existing plan you deliberately reconciled.' },
        },
        required: ['content', 'expectedHash'],
        additionalProperties: false,
      },
      handler: (args, invocation) => serialize(() => run('update', args, invocation)),
    },
  ];
}
