// Dependency-free; tests inject the joined session.
//
// A higher-priority host rule makes the coordinator call the native
// `security-review` first. These hooks keep that order and make the call
// visible instead: they label it and, when the host's task schema offers it,
// run it in the background, then return the next App framing steps with its
// handle. They never change the reviewer's prompt, agent type or result, and
// never write plans, tasks or sessions themselves.

export const SECURITY_PREFIX = '🛡️ Security · ';
const REVIEWER = 'security-review';
const COORDINATOR = 'squad';

/** Mission name from the model's description, without any reviewer or label prefix. */
export function missionFrom(description) {
  const text = typeof description === 'string' ? description.trim() : '';
  const mission = text
    .replace(/^(?:🛡️|🛡|🔒)\s*Security\s*·\s*/u, '')
    .replace(/^security[\s-]+review\b[\s:·—–-]*/iu, '')
    .trim();
  return mission ? mission.charAt(0).toUpperCase() + mission.slice(1) : 'Project review';
}

function coordinatorReviewer(input) {
  const args = input?.toolArgs;
  return !input?.agentId && input?.toolName === 'task' && args !== null && typeof args === 'object' &&
    !Array.isArray(args) && args.agent_type === REVIEWER;
}

// The restitution owner is a synthesis of the finished report, never a second
// review: it is created only once the report exists, and never as a waiting child.
const SYNTHESIS = 'create the restitution owner with create_session, clearly named as a synthesis for its owner role ' +
  '(for example "🏗️ Lead · Security report synthesis"), never with the reviewer\'s own label, and carrying the complete report ' +
  '(it explains the examined scope, coverage, limitations and findings, even zero findings, and starts no review, scan or security-review)';

// A host question blocks the turn until answered: work that needs only the
// report must be dispatched with it, never queued behind its answer.
const FOLLOW_UP = 'also create the branded App owner for each follow-up the user requested that needs only the report ' +
  '(for example "🔧 Backend · Dependency updates")';
const ANSWER = 'Neither restitution nor requested follow-up waits for that answer; when it arrives, forward any chosen remediation ' +
  'to the matching owner (reuse it rather than creating a duplicate) or dispatch one new owner for it.';

function runningGuidance(label) {
  return `Squad App framing: the native security-review "${label}" now runs in the background, ` +
    'so the host\'s "security-review first" order is already satisfied. It is the only agent doing this review: ' +
    'do not start another review, scan or audit, and do not create the restitution owner yet (a waiting child looks like a second review). ' +
    'Now, while it runs: (1) one-sentence acknowledgment naming the security review and any follow-up work the user asked for; ' +
    '(2) one read batch: this request\'s SQL tasks and squad_session_plan_read; ' +
    '(3) one tool batch: record the SQL tasks (native review in_progress; App restitution and each requested follow-up pending, gated on the report) ' +
    'and publish or update the native plan naming the restitution owner. Then wait for the review\'s completion notification without polling. ' +
    `When its report returns: present any host-required findings table, then in one tool batch ${SYNTHESIS}, ${FOLLOW_UP}, ` +
    'update the SQL tasks and native plan with their verified app_urls, and ask any host-required follow-up question. ' +
    `${ANSWER} If create_session is unavailable, say so and keep restitution in this chat.`;
}

function returnedGuidance(label) {
  return `Squad App framing: the native security-review "${label}" has returned its report. ` +
    `Present any host-required findings table, then in one tool batch ${SYNTHESIS}, ${FOLLOW_UP}, ` +
    'update the SQL tasks and native plan with their verified app_urls, and ask any host-required follow-up question. ' +
    `${ANSWER} If create_session is unavailable, say so and keep restitution in this chat.`;
}

/**
 * Hooks act only on the foreground coordinator's own native reviewer call while
 * the Squad agent is selected; every other call, agent or failure is a no-op.
 */
export function createSecurityFramingHooks(getSession) {
  // Hook inputs carry no tool call ID: match pre and post calls in order.
  const pending = [];

  async function squadSelected() {
    try {
      const current = await getSession()?.rpc?.agent?.getCurrent?.();
      const name = current?.agent?.name;
      return typeof name === 'string' && name.trim().toLowerCase() === COORDINATOR;
    } catch {
      return false;
    }
  }

  async function applies(input) {
    return coordinatorReviewer(input) && await squadSelected();
  }

  return {
    async onPreToolUse(input) {
      if (!(await applies(input))) return undefined;
      const args = input.toolArgs;
      const label = SECURITY_PREFIX + missionFrom(args.description);
      // An explicit mode proves the host schema offers it; never add an unknown argument.
      const background = Object.hasOwn(args, 'mode');
      pending.push({ label, background });
      return { modifiedArgs: { ...args, description: label, ...(background ? { mode: 'background' } : {}) } };
    },

    async onPostToolUse(input) {
      if (!(await applies(input))) return undefined;
      const call = pending.shift() ?? {
        label: SECURITY_PREFIX + missionFrom(input.toolArgs.description),
        background: input.toolArgs.mode === 'background',
      };
      return { additionalContext: call.background ? runningGuidance(call.label) : returnedGuidance(call.label) };
    },

    async onPostToolUseFailure(input) {
      if (await applies(input)) pending.shift();
      return undefined;
    },
  };
}
