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
  expect(content).toMatch(/kickoff\.mode[^.\n]*autopilot[^.\n]*explicit/i);
  expect(content).toContain('request_id');
  expect(content).toMatch(/(do not|never)[^.\n]*auto[- ]approve/i);
  expect(content.replace(/\s+/g, ' ')).toMatch(/Autopilot[^.]*not[^.]*expand[^.]*scope[^.]*permissions/i);
}

function assertAutopilotSpecialists(content: string): void {
  const text = content.replace(/\s+/g, ' ');
  expect(text, 'named App specialists need an explicit autopilot kickoff')
    .toMatch(/kickoff\.mode[^.]*autopilot[^.]*explicit/i);
  expect(text).toMatch(/user[^.]*manually[^.]*different mode/i);
  expect(text).toMatch(/Autopilot[^.]*not[^.]*expand[^.]*scope[^.]*permissions/i);
  expect(text).toMatch(/(?:Do not|Never)[^.]*pending[^.]*plan[^.]*gate/i);
}

function assertAutopilotKickoff(content: string): void {
  const example = content.match(/create_session\(\{([\s\S]*?)\n\}\)/)?.[1];
  expect(example).toBeDefined();
  expect(example, 'App kickoff must explicitly select autopilot').toContain('mode: "autopilot"');
  expect(example).not.toMatch(/mode:.*(?:interactive|background|sync)/);
}

describe('autopilot App specialist mode: instruction contracts, not live host state', () => {
  it.each(['coordinator', 'spawn', 'client'] as const)('%s launches named specialists autonomously without expanding authorization', key => {
    assertAutopilotSpecialists(sources[key]);
  });

  it('sets autopilot in the actual App kickoff example and preserves native scheduling', () => {
    assertAutopilotKickoff(sources.spawn);
    expect(sources.spawn).toMatch(/Native[^.\n]*sync[^.\n]*background[^.\n]*scheduling[^.\n]*not[^.\n]*App/i);
    expect(sources.response.replace(/\s+/g, ' ')).toMatch(/kickoff\.mode[^.]*autopilot/);
    const docs = read('docs/src/content/docs/scenarios/client-compatibility.md').replace(/\s+/g, ' ');
    expect(docs).toMatch(/kickoff\.mode[^.]*autopilot[^.]*default/i);
    expect(docs).toMatch(/follow-ups[^.]*omit[^.]*mode[^.]*preserve/i);
  });

  it('keeps follow-ups from overriding user choice or bypassing pending gates', () => {
    const text = sources.after.replace(/\s+/g, ' ');
    expect(text).toMatch(/send_session_message[^.]*omit[^.]*mode[^.]*preserve/i);
    expect(text).toMatch(/(?:Never|Do not)[^.]*change[^.]*mode[^.]*follow-up/i);
    expect(text).toMatch(/pending[^.]*plan[^.]*gate[^.]*Autopilot/i);
    expect(text).toContain('request_id');
  });

  it('rejects restored interactive defaults and missing scope or pending-gate safeguards', () => {
    const fixture = 'Set kickoff.mode to autopilot explicitly. The user may manually select a different mode. Autopilot does not expand scope or permissions. Never bypass pending plan or input gates.';
    assertAutopilotSpecialists(fixture);
    expect(() => assertAutopilotSpecialists(fixture.replace('autopilot explicitly', 'interactive explicitly'))).toThrow();
    expect(() => assertAutopilotSpecialists(fixture.replace('Autopilot does not expand scope or permissions.', ''))).toThrow();
    expect(() => assertAutopilotSpecialists(fixture.replace('Never bypass pending plan or input gates.', ''))).toThrow();
    assertAutopilotKickoff(sources.spawn);
    const interactiveExample = sources.spawn.replace(/^    mode: "autopilot"/m, '    mode: "interactive"');
    expect(interactiveExample).not.toBe(sources.spawn);
    expect(() => assertAutopilotKickoff(interactiveExample)).toThrow(/kickoff/);
  });
});

function assertNativeLifecycle(content: string): void {
  content = content.replace(/\s+/g, ' ');
  expect(content).toMatch(/sync[^.]*?(?:cannot[^.]*write_agent|write_agent[^.]*(?:cannot|not|reject))/i);
  expect(content).toMatch(/same[- ](task|mission)/i);
  expect(content).toMatch(/compatible lifecycle/i);
  expect(content).toMatch(/(not|never|no)[^.\n]*(unrelated|worker pool)/i);
}

describe('runtime-required review composition: instruction contracts, not security findings or host execution', () => {
  function reviewProtocol(): string {
    return section(sources.coordinator, '### Runtime-Required Reviewers and Visible Follow-Up').replace(/\s+/g, ' ');
  }

  function assertReviewComposition(text: string): void {
    expect(text, 'the required native reviewer must precede App dispatch')
      .toMatch(/higher-priority[^.]*security-review[^.]*first[^.]*before[^.]*App/i);
    expect(text, 'a mandatory full review is neither an internal check nor an App session')
      .toMatch(/not a small internal check[^.]*not an App child/i);
    expect(text, 'visible follow-up reuses the result instead of a second audit')
      .toMatch(/Reuse the returned report[^.]*do not rerun[^.]*audit/i);
    expect(text, 'native result identity cannot create a fictitious App session')
      .toMatch(/native[^.]*agent_id[^.]*does not establish[^.]*App session/i);
  }

  function assertImplicitRestitution(text: string): void {
    expect(text).toContain('A substantive security review includes bounded App restitution');
    expect(text).toMatch(/even with zero findings[^.]*no separate follow-up request/i);
    expect(text, 'restitution must not depend on another request or positive findings')
      .not.toMatch(/when restitution or follow-up is within the user's request or explicitly approved|only if findings exist|only when follow-up is requested/i);
  }

  it('includes real App restitution for an ordinary read-only security review with zero findings', () => {
    const text = reviewProtocol();
    assertImplicitRestitution(text);
    expect(text).toMatch(/examined scope[^.]*coverage[^.]*limitations[^.]*result/i);
    expect(text).toMatch(/zero findings[^.]*not[^.]*security certification/i);
    expect(text).toMatch(/does not authorize[^.]*remediation[^.]*cloud[^.]*second audit/i);
    for (const key of ['spawn', 'client', 'response', 'after'] as const) {
      expect(sources[key].replace(/\s+/g, ' '), `${key}: zero-finding escape remains`)
        .toMatch(/restitution[^.]*even with zero findings/i);
    }
  });

  it('reconciles tasks and readable plan after the native result despite no code changes or findings', () => {
    const text = reviewProtocol();
    expect(text).toMatch(/After the native report returns[^.]*SQL[^.]*plan[^.]*zero findings/i);
    expect(text).toMatch(/read-only[^.]*repository files[^.]*not[^.]*task[^.]*plan metadata/i);
    expect(text).toMatch(/discover[^.]*schemas[^.]*before[^.]*unavailable/i);
    expect(text).toMatch(/native review completed[^.]*restitution in progress[^.]*handoff/i);
    expect(text).toMatch(/Do not invent[^.]*remediation[^.]*decision task/i);
    expect(text).toMatch(/changes-only[^.]*not[^.]*exhaustive project review/i);
  });

  it('rejects restoring the separate-follow-up condition or a positive-finding prerequisite', () => {
    const text = reviewProtocol();
    assertImplicitRestitution(text);
    for (const clause of [
      "After the report returns, when restitution or follow-up is within the user's request or explicitly approved, create the App owner.",
      'Create the App owner only if findings exist.',
    ]) {
      expect(() => assertImplicitRestitution(`${text} ${clause}`)).toThrow(/restitution must not depend/);
    }
  });

  it('honors native-first review while defining a genuine, authorized App follow-up without repeating the audit', () => {
    const text = reviewProtocol();
    assertReviewComposition(text);
    expect(text).toMatch(/Create or reuse one real restitution owner only after the report returns, never before or alongside the reviewer and never as a waiting child/i);
    expect(text).toMatch(/findings[^.]*severity[^.]*confidence[^.]*evidence[^.]*attribution/i);
    expect(text).toMatch(/actual[^.]*app_url[^.]*verified creation/i);
    expect(text).toMatch(/unavailable[^.]*report the limitation[^.]*no fabricated/i);
  });

  it('resolves a synthesis owner by active role and charter rather than inventing a security expert or architect name', () => {
    const text = section(sources.coordinator, '### Accountable Ownership').replace(/\s+/g, ' ');
    expect(text).toMatch(/active Lead\/Architect role[^.]*charter[^.]*scope/i);
    expect(text).toMatch(/not[^.]*literal[^.]*architect/i);
    const review = reviewProtocol();
    expect(review).toMatch(/synthesis[^.]*not[^.]*security expertise/i);
    expect(review).toMatch(/no suitable owner[^.]*user decision[^.]*do not[^.]*recast/i);
  });

  // App tests 5-7 (fork .6/.7/.8): the host applies "invoke security-review first" literally, so the
  // model called a bare reviewer before any framing written ahead of it, and create_session in or before
  // the reviewer batch made it drop the recipe entirely. App test 8 (.9): a restitution child created
  // while the review ran sat waiting and looked like a second, parallel audit. The reviewer now goes
  // first, alone and in the background; acknowledgment, tasks and plan follow its handle, and the
  // restitution owner is created only with the report, named as a synthesis.
  it('calls the required reviewer first and alone, then frames the mission while it runs', () => {
    const recipe = section(sources.coordinator, '### Security Requests in the App — First Response').replace(/\s+/g, ' ');
    expect(recipe, 'the reviewer is the first, solitary tool call, labelled and non-blocking')
      .toMatch(/First tool call, alone: the native `security-review` task with `description: "🛡️ Security · \{mission\}"` and `mode: "background"` when the schema offers it/i);
    expect(recipe, 'the extension enforces the label and background mode')
      .toMatch(/security-framing extension is loaded, it applies that label and background mode itself/i);
    expect(recipe, 'acknowledgment and reads follow the handle')
      .toMatch(/As soon as the reviewer returns its background handle: a one-sentence acknowledgment[^.]*squad_session_plan_read/i);
    expect(recipe, 'tasks and plan follow the reads, with no child yet')
      .toMatch(/Next tool batch: record the SQL tasks[^.]*publish or update the native plan naming the restitution owner/i);
    expect(recipe, 'no waiting child while the review runs')
      .toMatch(/Do not create the restitution owner yet: the native reviewer is the only agent doing this review, and a waiting child looks like a second one/i);
    expect(recipe).toMatch(/Then wait for the review's completion notification without polling/i);
    expect(recipe).toMatch(/If the reviewer ran synchronously, do steps 2-3 when its report returns/i);
    expect(recipe, 'the synthesis owner is created with the report')
      .toMatch(/When the report returns:[^.]*create the restitution owner with `create_session`, clearly named as a synthesis for its owner role \(for example `🏗️ Lead · Security report synthesis`, never the reviewer's own `🛡️ Security · \{mission\}` label\) and carrying the complete report/i);
    const text = reviewProtocol();
    expect(text).toMatch(/only after the report returns, never before or alongside the reviewer and never as a waiting child while it runs/i);
    expect(text).toMatch(/Name it clearly as a synthesis for its owner role[^.]*never with the reviewer's own `🛡️ Security · \{mission\}` label, and tell it to start no review, scan or `security-review`/i);
    for (const source of [recipe, text]) {
      expect(source, 'no framing, dispatch, substitution or waiting child may precede, join or shadow the reviewer')
        .not.toMatch(/no later than the reviewer's tool batch|First tool batch, metadata reads only|Do not call the reviewer in this batch|same tool batch as the reviewer call|run it inside one branded App security session|does not also run it natively|Second tool batch, never split|wait for the report message|tells it to wait for the report|verified link while the review runs/i);
    }
    for (const key of ['spawn', 'client', 'response'] as const) {
      const source = sources[key].replace(/\s+/g, ' ');
      expect(source, `${key}: reviewer first and alone`).toMatch(/first tool call, alone|first and alone/i);
      expect(source, `${key}: framing and sub-session follow the reviewer call`)
        .toMatch(/only after (?:the reviewer call (?:has returned|returns)|that call returns)/i);
      expect(source, `${key}: stale pre-reviewer framing or waiting child`)
        .not.toMatch(/no later than the reviewer's tool batch|waits for the report|wait for the report without/i);
    }
  });

  it('frames the mission visibly right after the required reviewer starts without changing the review', () => {
    const text = reviewProtocol();
    expect(text, 'nothing is written before the host-required reviewer')
      .toMatch(/Do not write framing before the reviewer[^.]*the native reviewer is the first tool call, alone/i);
    expect(text, 'the reviewer is labelled and non-blocking')
      .toMatch(/icon · specialist label · mission[^.]*`description` field, without implying an App session or link, and use `mode: "background"` when the schema offers it/i);
    expect(text).toMatch(/squad-security-framing[^.]*applies both when loaded/i);
    expect(text, 'tasks and plan follow the background handle')
      .toMatch(/As soon as the background handle returns, and before any other work, write the mission's visible context while the review runs: SQL[^.]*plan/i);
    expect(text).toMatch(/With a synchronous reviewer, write the same context when the report returns/i);
    expect(text, 'framing is metadata, not a review, probe, delegation or dispatch')
      .toMatch(/not a review, routing probe, delegation or App dispatch[^.]*never changes the reviewer's prompt, scope, agent or result/i);
    expect(text, 'the owner is created with the report and the host-required question, not after its answer')
      .toMatch(/findings table or follow-up question does not end the mission[^.]*same tool batch as any host-required question create or reuse that owner with the report[^.]*never delays or cancels restitution/i);
    expect(text, 'framing is skipped only for refusal, explicit prohibition or unavailable tools')
      .toMatch(/Skip the framing only when the user refused plan metadata, a higher-priority instruction explicitly prohibits it, or[^.]*plan tools are unavailable/i);
    expect(text).not.toMatch(/routing probes or plan writes|forbids any action before the reviewer/i);

    const firstResponse = section(sources.coordinator, '### Security Requests in the App — First Response').replace(/\s+/g, ' ');
    expect(firstResponse, 'the owner is created with the report and the host question')
      .toMatch(/one tool batch create the restitution owner with `create_session`[^.]*ask any host-required follow-up question/i);
    // App test 9 (.10): the host question blocked the turn for two hours, and the requested dependency
    // updates waited behind it and a second host question before any owner was created.
    expect(firstResponse, 'requested follow-up that needs only the report is dispatched with the host question')
      .toMatch(/in that same batch also create the branded App owner for each requested follow-up that needs only the report[^.]*ask any host-required follow-up question/i);
    expect(firstResponse).toMatch(/A host question blocks your turn until it is answered, so nothing that needs only the report may wait behind it: neither restitution nor requested follow-up waits for that answer/i);
    expect(firstResponse).toMatch(/forward any chosen remediation to the matching owner \(reuse it rather than creating a duplicate\)/i);
    expect(text).toMatch(/same tool batch as any host-required question create or reuse that owner with the report, create the branded owner of each requested follow-up that needs only the report[^.]*never delays or cancels restitution or requested follow-up/i);
    for (const source of [firstResponse, text]) {
      expect(source, 'requested follow-up must not queue behind the host question').not.toMatch(/dispatched afterwards|Then dispatch each requested follow-up/i);
    }
    expect(firstResponse).toMatch(/never the review's prompt, scope, agent or result/i);
    expect(sources.coordinator.indexOf('### Security Requests in the App — First Response'),
      'the recipe must precede the routing sections where the first action is chosen')
      .toBeLessThan(sources.coordinator.indexOf('### Routing'));

    for (const key of ['spawn', 'client', 'response', 'after'] as const) {
      expect(sources[key].replace(/\s+/g, ' '), `${key}: host follow-up continuation missing`)
        .toMatch(/findings table or (?:follow-up )?question does not end/i);
      expect(sources[key].replace(/\s+/g, ' '), `${key}: owner must be created with the question`)
        .toMatch(/question's tool batch|same tool batch as the question/i);
      expect(sources[key].replace(/\s+/g, ' '), `${key}: requested follow-up must not wait for the answer`)
        .toMatch(/follow-up that needs only the report/i);
    }
    for (const key of ['spawn', 'client', 'response'] as const) {
      expect(sources[key], `${key}: branded native reviewer label missing`).toContain('🛡️ Security · {mission}');
    }
  });

  it('keeps reference surfaces consistent without granting general recursive native delegation', () => {
    for (const key of ['spawn', 'client', 'response', 'after'] as const) {
      expect(sources[key], `${key}: missing required-reviewer composition`).toContain('runtime-required reviewer');
    }
    for (const key of ['coordinator', 'spawn'] as const) {
      expect(sources[key].replace(/\s+/g, ' ')).toMatch(/only if the higher-priority runtime permits[^.]*inside the existing App mission[^.]*not[^.]*general[^.]*delegation/i);
    }
  });

  it('rejects native-ID phantom sessions, audit duplication and violation of native-first ordering', () => {
    const text = reviewProtocol();
    assertReviewComposition(text);
    for (const [from, to] of [
      ['before App', 'after App'],
      ['do not rerun the audit', 'rerun the audit to populate the sidebar'],
      ['does not establish an App session', 'establishes an App session'],
    ]) {
      const mutant = text.replace(from, to);
      expect(mutant).not.toBe(text);
      expect(() => assertReviewComposition(mutant)).toThrow();
    }
  });
});

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

function assertAppProjectPlacement(content: string, input: string): void {
  const text = content.replace(/\s+/g, ' ');
  expect(text, `${input}: every project specialist mission needs project placement, even read-only`).toMatch(
    /From an App project session, ALL named specialist missions MUST use project children[^.]*including short\/read-only missions/,
  );
  expect(text, `${input}: project children must retain their parent's project association`).toMatch(
    /project_id[^.]*from the parent/,
  );
  expect(text, `${input}: project specialist missions need isolated worktrees`).toMatch(
    /session_kind: "project"[^.]*workspace_type: "worktree"/,
  );
  expect(text, `${input}: project association must not expand read-only authorization`).toMatch(
    /read-only[^.]*does not authorize implementation/i,
  );
  expect(text, `${input}: missing project/capability must be explicit, not an invented association`).toMatch(
    /parent project is missing[^.]*unsupported[^.]*report[^.]*limitation/i,
  );
  expect(text, `${input}: a project mission must not silently become chat`).toMatch(
    /do not invent[^.]*project[^.]*silently substitute chat/i,
  );
  expect(text, `${input}: old chat-first recommendations must be removed`).not.toMatch(
    /Choose the lightest persistent[^.]*chat|For read-only analysis use `session_kind: "chat"`|a read-only chat child when supplied context suffices|source access cannot be established for chat, use a supported project child/i,
  );
}

function assertOutsideProjectChat(content: string, input: string): void {
  const text = content.replace(/\s+/g, ' ');
  expect(text, `${input}: chat is an explicit outside-project choice with disclosed placement`).toMatch(
    /session_kind: "chat"[^.]*only when explicitly requested outside the project[^.]*placement under Chats/,
  );
  expect(text, `${input}: a chat child has no project checkout`).toMatch(/chat child has no checkout/i);
  expect(text, `${input}: coordination and source access do not establish project-tree placement`).toMatch(
    /parent linkage[^.]*source access[^.]*do not place[^.]*project tree/i,
  );
  expect(text, `${input}: renaming cannot convert chat to a project child`).toMatch(
    /renaming[^.]*does not convert[^.]*chat[^.]*project/i,
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

function assertPlanLayout(content: string): void {
  content = content.replace(/\r\n/g, '\n');
  const example = content.match(/```markdown\n([\s\S]*?)\n```/)?.[1];
  expect(example, 'missing native-plan context example').toBeDefined();
  expect(example!.match(/^#{1,2} .+$/gm), 'native context must not duplicate the SQL task view').toEqual([
    '# {Short task title}', '## Details',
  ]);
  expect(example!, 'no duplicate task state in native context').not.toMatch(/^- \[[ x]\]|^\|/m);
  expect(example!).toContain('**Next / limits:**');
  expect(content).toMatch(/fallback[^.\n]*Tasks[^.\n]*checklist[^.\n]*Details/i);
  expect(content).toMatch(/Historical setup[^.\n]*Details[^.\n]*not[^.\n]*count/i);
  expect(content).toMatch(/SHAs[^.\n]*paths[^.\n]*Details/i);
  expect(content).toMatch(/no ASCII bars[^.\n]*HTML\/CSS[^.\n]*faux widgets/i);
  expect(content).toMatch(/readable[^.\n]*purpose[^.\n]*scope[^.\n]*steps[^.\n]*constraints[^.\n]*acceptance/i);
  expect(content).toMatch(/custom Markdown[^.\n]*preserve[^.\n]*layout[^.\n]*semantics/i);
  expect(content).toMatch(/prompt guidance[^.\n]*not[^.\n]*enforced/i);
}

function assertPlanTruth(content: string): void {
  const text = content.replace(/\s+/g, ' ');
  for (const label of ['Pending', 'In progress', 'Blocked / Needs input', 'Completed', 'Failed', 'Cancelled']) {
    expect(text, `missing human-readable status ${label}`).toContain(label);
  }
  expect(text).toMatch(/completed count[^.]*verified[^.]*actionable[^.]*total/i);
  expect(text).toMatch(/unknown[^.]*omit[^.]*count[^.]*not yet scoped/i);
  expect(text).toMatch(/Failed and Cancelled[^.]*not completed[^.]*denominator/i);
  expect(text).toMatch(/scope changes[^.]*authorization[^.]*Details/i);
  expect(text).toMatch(/Never infer progress[^.]*idle[^.]*elapsed time[^.]*percentages/i);
  expect(text).toMatch(/Completed[^.]*all required[^.]*validation[^.]*integration[^.]*verified/i);
  expect(text).toMatch(/Blocked \/ Needs input[^.]*required next action[^.]*gate/i);
  expect(text).toMatch(/Check[^.]*only[^.]*Completed[^.]*unchecked[^.]*Failed[^.]*Cancelled/i);
}

function assertPlanRefresh(content: string): void {
  const text = content.replace(/\s+/g, ' ');
  expect(text).toMatch(/Before each publish\/update[^.]*reconcile[^.]*evidence/i);
  expect(text).toMatch(/Refresh[^.]*task states[^.]*owner[^.]*next[^.]*blocker[^.]*Details[^.]*together/i);
  expect(text).toMatch(/Recompute[^.]*fallback[^.]*summary[^.]*count[^.]*same task states/i);
  expect(text).toMatch(/Do not update only[^.]*checkbox[^.]*stale/i);
  expect(text).toMatch(/queued[^.]*Pending[^.]*parallel[^.]*blockers/i);
  expect(text).toMatch(/completed[^.]*next[^.]*none[^.]*required[^.]*outstanding/i);
}

function assertNativeTaskBridge(content: string): void {
  const text = content.replace(/\s+/g, ' ');
  expect(text).toContain('readSqlTodosWithDependencies()');
  expect(text).toContain('session.todos_changed');
  expect(text).toMatch(/SQL[^.]*single authoritative task-state source/i);
  expect(text).toMatch(/existing[^.]*sql[^.]*not[^.]*recreate[^.]*tables/i);
  expect(text).toMatch(/native[^.]*task[^.]*SQL[^.]*not[^.]*Markdown[^.]*check/i);
  expect(text).toMatch(/short gerund titles[^.]*current request[^.]*real dependencies/i);
  expect(text).toMatch(/pending[^.]*in_progress[^.]*done[^.]*blocked/);
  expect(text).toMatch(/Failed[^.]*Cancelled[^.]*blocked[^.]*description[^.]*not[^.]*done/);
  expect(text).toMatch(/preserve[^.]*unrelated[^.]*user[^.]*rows/i);
  expect(text).toMatch(/SQL[^.]*Markdown[^.]*not atomic[^.]*fail(?:s|ure)[^.]*report/i);
  expect(text).toMatch(/not[^.]*guarantee[^.]*screenshot/i);
}

function assertPlanSessionLinks(content: string): void {
  const text = content.replace(/\s+/g, ' ');
  expect(text, 'plan must source actual session URLs from the host').toMatch(
    /app_url[^.]*host result[^.]*list_sessions_and_chats[^.]*verbatim/i,
  );
  expect(text, 'no prelaunch phantom session link').toMatch(
    /Only after[^.]*creation succeeds[^.]*verify[^.]*child[^.]*project[^.]*link/i,
  );
  expect(text).toMatch(/each[^.]*work item[^.]*owner[^.]*own[^.]*actual[^.]*link/i);
  expect(text).toMatch(/Pending[^.]*failed launch[^.]*native fallback[^.]*no App session[^.]*no[^.]*fabricated link/i);
  expect(text).toMatch(/Never construct[^.]*URL[^.]*raw GUID[^.]*charter[^.]*navigation/i);
  expect(text).toMatch(/SQL titles[^.]*concise[^.]*session_id[^.]*task-row hyperlinks/i);
  expect(text).toMatch(/persisted Markdown[^.]*not[^.]*navigation[^.]*rendering/i);
}

describe('coordinator orchestration: canonical contracts', () => {
  it.each(['coordinator', 'spawn', 'client'] as const)('%s chooses dispatch without losing named specialist visibility', key => {
    assertDispatch(sources[key]);
  });

  describe('cold-start formation: instruction contracts, not model obedience', () => {
    const initSkill = read('.squad-templates/skills/coordinator-init-mode/SKILL.md');
    const initEntry = sources.coordinator.split('## Init Mode')[1]?.split('## Team Mode')[0] ?? '';
    const routing = read('.squad-templates/routing.md');

    function assertFormationEntry(text: string): void {
      expect(text.replace(/\s+/g, ' '), 'missing-team-only trigger must not skip an installed empty scaffold')
        .toMatch(/team\.md[^.]*absent[^.]*no active specialist/i);
    }

    it('aligns coordinator, skill discovery metadata and skill entry on absent or unconstituted teams', () => {
      assertFormationEntry(initEntry);
      const [metadata, body] = initSkill.slice(4).split(/\r?\n---\r?\n/);
      assertFormationEntry(metadata);
      assertFormationEntry(body);
      expect(initEntry).toMatch(/support identities[^.\n]*coding agent[^.\n]*do not count/i);
      expect(initSkill).not.toContain('treat as implicit "yes"');
      expect(initSkill).not.toContain('Ask: *"What are you building?');
    });

    it('reuses the ordinary goal and evidence, then confirms before substantive audit or dispatch', () => {
      const text = initSkill.replace(/\s+/g, ' ');
      expect(text).toMatch(/Reuse[^.]*user[^.]*goal[^.]*context[^.]*collected evidence/i);
      expect(text).toMatch(/Before[^.]*substantive domain work[^.]*audit[^.]*dispatch[^.]*confirmation/i);
      expect(text).toMatch(/preserve[^.]*existing[^.]*audit[^.]*plan/i);
      expect(text).toContain('Yes, hire this team');
      expect(text).toMatch(/After confirmation[^.]*roster[^.]*routes[^.]*registry[^.]*charters/i);
      expect(text).toMatch(/resume[^.]*original[^.]*goal[^.]*accountable specialist/i);
    });

    it('rejects a restored absent-file-only trigger', () => {
      const fixture = 'team.md is absent or there is no active specialist in Members';
      assertFormationEntry(fixture);
      expect(() => assertFormationEntry('No team.md exists; otherwise proceed to Team Mode')).toThrow(/missing-team-only/);
    });

    it('ships one-owner routing, not eager/anticipatory work, mandatory Scribe or blanket fan-out', () => {
      const text = routing.replace(/\s+/g, ' ');
      expect(text).toMatch(/one accountable specialist/i);
      expect(text).toMatch(/independently deliverable outcomes[^.]*distinct owners/i);
      expect(text).toMatch(/Scribe[^.]*only[^.]*accepted durable decisions[^.]*merg/i);
      expect(text).not.toMatch(/Eager by default|Scribe always runs|Anticipate downstream|anticipatory downstream|spawn all relevant agents|always as `mode: "background"`/i);
    });
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

  it('ordinary mission plan context: delegated work includes readable metadata without plan wording or extra SQL tasks', () => {
    const plan = section(sources.coordinator, '### Visible Main-Session Plan').replace(/\s+/g, ' ');
    expect(plan).toMatch(/ordinary substantive delegated mission[^.]*no separate plan request/i);
    expect(plan).toMatch(/single SQL task[^.]*context/i);
    expect(plan).toMatch(/read-only[^.]*repository[^.]*not[^.]*mission metadata/i);
    expect(plan).toMatch(/explicit[^.]*refusal[^.]*plan metadata[^.]*respect/i);
    expect(plan).toMatch(/trivial[^.]*unsolicited/i);
    expect(plan).toMatch(/discover[^.]*schemas[^.]*publish[^.]*absent/i);
    expect(plan).toMatch(/failure[^.]*limitation[^.]*fallback/i);
    expect(plan).toMatch(/not[^.]*approval[^.]*execution/i);
    expect(plan).toContain('app_url');
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

describe('task-first native plan defaults: instruction contracts, not model/UI execution', () => {
  const heading = '### Visible Main-Session Plan';

  it('pairs authoritative native task state with readable Details rather than duplicated Markdown state', () => {
    assertPlanLayout(section(sources.coordinator, heading));
  });

  it('rejects a generated native context containing a second task-state checklist', () => {
    const plan = section(sources.coordinator, heading).replace(/\r\n/g, '\n');
    const example = plan.match(/```markdown\n([\s\S]*?)\n```/)?.[1];
    expect(example, 'missing default layout to mutate').toBeDefined();
    const duplicated = plan.replace('## Details', '## Tasks\n- [x] Old guessed state\n\n## Details');
    expect(() => assertPlanLayout(duplicated)).toThrow(/duplicate/);
  });

  it('rejects history-inflated, guessed or cancelled-as-completed progress guidance', () => {
    const plan = section(sources.coordinator, heading);
    assertPlanTruth(plan);
    const cancelledAsDone = plan.replace(
      /Failed and Cancelled are not completed[^.]+\./,
      'Failed and Cancelled count as completed to clear the task view.',
    );
    expect(() => assertPlanTruth(cancelledAsDone)).toThrow();
  });

  it('requires evidence-based whole-plan refresh rather than checkbox-only stale summaries', () => {
    const plan = section(sources.coordinator, heading);
    assertPlanRefresh(plan);
    const staleSummary = plan.replace(
      /Refresh task states[^.]+\./,
      'Update only the active task row; leave the original summary and next action unchanged.',
    );
    expect(() => assertPlanRefresh(staleSummary)).toThrow();
    const after = sources.after.replace(/\s+/g, ' ');
    expect(after).toMatch(/SQL[^.]*task[^.]*Details[^.]*together/i);
    expect(after).toMatch(/summary[^.]*count[^.]*current[^.]*next[^.]*blocker[^.]*task/i);
    expect(after).toMatch(/queued[^.]*Pending[^.]*idle[^.]*completed/i);
    expect(after).toMatch(/integration[^.]*pending[^.]*Completed/i);
  });

  it('uses the documented SQL task bridge rather than claiming checkboxes create a native timeline', () => {
    const plan = section(sources.coordinator, heading);
    assertNativeTaskBridge(plan);
    const destructiveRefresh = plan.replace(
      /Keep stable task IDs and preserve unrelated[^.]+\./,
      'Delete all existing task rows and recreate this request to obtain a fresh display.',
    );
    expect(() => assertNativeTaskBridge(destructiveRefresh)).toThrow();
    const docs = read('docs/src/content/docs/features/current-session-plan.md');
    expect(docs).toContain('readSqlTodosWithDependencies()');
    expect(docs).toContain('session.todos_changed');
    expect(docs.replace(/\s+/g, ' ')).toMatch(/Markdown checklists[^.]*not[^.]*native[^.]*timeline/i);
    expect(docs.replace(/\s+/g, ' ')).toMatch(/visual[^.]*not[^.]*verified/i);
  });
});

describe('verified plan child-session links: instruction contracts, not host navigation', () => {
  const heading = '### Visible Main-Session Plan';

  it('sources real child links after verified launch and prevents fabricated pending/failure navigation', () => {
    assertPlanSessionLinks(section(sources.coordinator, heading));
  });

  it('reconciles each assigned work item with its real link rather than a stale or charter-only pointer', () => {
    const after = sources.after.replace(/\s+/g, ' ');
    expect(after).toMatch(/work item[^.]*owner[^.]*verified[^.]*App child[^.]*app_url/i);
    expect(after).toMatch(/Pending[^.]*failed launch[^.]*no[^.]*fabricated link/i);
    const docs = read('docs/src/content/docs/features/current-session-plan.md').replace(/\s+/g, ' ');
    expect(docs).toMatch(/app_url[^.]*list_sessions_and_chats[^.]*verbatim/i);
    expect(docs).toMatch(/Markdown link[^.]*not[^.]*native task-row[^.]*navigation/i);
  });

  // User feedback after App test 12: a later request rewrote the plan and folded earlier missions
  // into unlinked prose, so only the newest sub-session kept its link.
  it('keeps every earlier mission\'s session link when a later request rewrites the plan', () => {
    const plan = section(sources.coordinator, heading).replace(/\s+/g, ' ');
    expect(plan).toMatch(/When a later request in the same conversation rewrites or extends the plan, keep every earlier mission's session link next to its summary \(marked archived once archived\); never fold earlier missions into unlinked prose/i);
    expect(plan).toMatch(/\*\*Assigned work:\*\*[^}]*earlier missions in this conversation keep their own links/i);
    expect(sources.after.replace(/\s+/g, ' ')).toMatch(/earlier missions in the conversation keep their own session links/i);
  });

  it('rejects prelaunch and failed-launch phantom link guidance independently', () => {
    const plan = section(sources.coordinator, heading);
    assertPlanSessionLinks(plan);
    const prelaunch = plan.replace('Only after creation succeeds', 'Before attempting creation');
    const failed = plan.replace('no fabricated link', 'a guessed session link');
    expect(prelaunch).not.toBe(plan);
    expect(failed).not.toBe(plan);
    expect(() => assertPlanSessionLinks(prelaunch)).toThrow(/prelaunch/);
    expect(() => assertPlanSessionLinks(failed)).toThrow();
  });
});

describe('App specialist visibility: canonical contracts', () => {
  it.each(['coordinator', 'spawn', 'client', 'response'] as const)(
    '%s makes even short/read-only specialist missions visible, not native internal checks',
    key => assertAppVisibility(sources[key], paths[key]),
  );

  it.each(['coordinator', 'spawn', 'client', 'response'] as const)(
    '%s places every project specialist mission in a project worktree, including short/read-only work',
    key => assertAppProjectPlacement(sources[key], paths[key]),
  );

  it.each(['coordinator', 'spawn', 'client', 'response'] as const)(
    '%s limits chat to an explicit outside-project choice without promising project placement',
    key => assertOutsideProjectChat(sources[key], paths[key]),
  );

  // One child per mission keeps work isolated, but finished children piled up in the App sidebar
  // (user feedback after App test 11), so verified, integrated missions are archived.
  it('archives a finished request\'s verified, integrated children and never one with live or unintegrated work', () => {
    const rules = sources.coordinator.replace(/\s+/g, ' ');
    expect(rules, 'archive at the end of the request, not after each mission')
      .toMatch(/\*\*Lifecycle:\*\*[^*]*Archive at the end of the user's request, not after each mission: once every mission in the current request is verified completed \(handoff verified, its commits integrated into the parent or the mission read-only\) and the plan is marked completed, archive that request's finished children with `archive_session`/i);
    expect(rules, 'finished children stay available for follow-ups while the request continues')
      .toMatch(/Until then, keep finished children for same-mission follow-ups/i);
    expect(rules).not.toMatch(/archive that child with `archive_session`/i);
    expect(rules).toMatch(/Never archive a child that is busy, awaiting input or plan approval, holds unintegrated commits or uncommitted work, has an open pull request or an attached session automation, or may still receive a same-mission follow-up[^.]*never one the user asked to keep or that you did not create/i);
    expect(rules, 'continuation keeps the conversation through a user restore, or starts fresh from the report')
      .toMatch(/Only the user can restore an archived session, and only a restored session brings back its full working conversation[^:]*: for a later follow-up on that mission, ask the user to restore it, or start a new child carrying its previous kickoff and report/i);
    for (const key of ['after', 'client'] as const) {
      const text = sources[key].replace(/\s+/g, ' ');
      expect(text, `${key}: archive finished missions at the end of the request`)
        .toMatch(/whole request is done[^.]*archive|archive[^.]*whole request is done/i);
      expect(text, `${key}: never archive live or unintegrated work`)
        .toMatch(/Never archive a child that is busy, awaiting input, holds unintegrated work|never while it is busy, awaiting input, holding unintegrated work/i);
    }
    const docs = readFileSync(resolve(ROOT, 'docs/src/content/docs/scenarios/client-compatibility.md'), 'utf8').replace(/\s+/g, ' ');
    expect(docs).toMatch(/Finished missions are archived when your request is done[^]*never archives a sub-session that is busy, waiting for your answer, holding changes not yet integrated/i);
    expect(docs).toMatch(/Squad asks you to restore it or starts a new sub-session from its kickoff and report/i);
  });

  it('makes the actual project-child example select the parent project and isolated worktree', () => {
    const template = sources.spawn.match(/create_session\(\{([\s\S]*?)\n\}\)/)?.[1];
    expect(template, `${paths.spawn}: missing concrete project-child template`).toBeDefined();
    for (const field of [
      'project_id: "{parent_project_id}"',
      'session_kind: "project"',
      'workspace_type: "worktree"',
      'coordinate_with_creator: true',
    ]) {
      expect(template, `${paths.spawn}: project-child template is missing ${field}`).toContain(field);
    }
    expect(template, `${paths.spawn}: project mission cannot silently use chat`).not.toContain('session_kind: "chat"');
  });

  it('documents project placement separately from coordination and source access', () => {
    const path = 'docs/src/content/docs/scenarios/client-compatibility.md';
    const content = read(path);
    assertAppProjectPlacement(content, path);
    assertOutsideProjectChat(content, path);
  });

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
  const project = 'From an App project session, ALL named specialist missions MUST use project children with project_id from the parent, session_kind: "project" and workspace_type: "worktree", including short/read-only missions. Read-only scope does not authorize implementation. If the parent project is missing or project child creation is unsupported, report the limitation; do not invent association, create a project without authorization or silently substitute chat.';
  const chat = 'Use session_kind: "chat" only when explicitly requested outside the project, and disclose placement under Chats. A chat child has no checkout. Parent linkage and source access do not place a chat in the project tree. Renaming does not convert chat to a project session.';
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

  it('rejects read-only specialists routed to chat rather than the parent project', () => {
    assertAppProjectPlacement(project, 'project fixture');
    expect(() => assertAppProjectPlacement(project.replace('session_kind: "project"', 'session_kind: "chat"'), 'project-to-chat mutation')).toThrow();
    expect(() => assertAppProjectPlacement(project.replace('project_id from the parent', 'project_id from an invented project'), 'project association mutation')).toThrow();
    expect(() => assertAppProjectPlacement(project.replace('including short/read-only missions', 'except short/read-only missions'), 'read-only chat loophole')).toThrow();
    expect(() => assertAppProjectPlacement(`${project} Choose the lightest persistent child: chat when sources are supplied.`, 'restored chat-first guidance')).toThrow();
  });

  it('rejects coordination/source access or renaming as substitutes for project placement', () => {
    assertOutsideProjectChat(chat, 'chat fixture');
    expect(() => assertOutsideProjectChat(chat.replace('only when explicitly requested outside the project', 'whenever source access is available'), 'implicit chat mutation')).toThrow();
    expect(() => assertOutsideProjectChat(chat.replace('do not place', 'place'), 'parent linkage mutation')).toThrow();
    expect(() => assertOutsideProjectChat(chat.replace('does not convert', 'converts'), 'rename conversion mutation')).toThrow();
    expect(() => assertOutsideProjectChat(chat.replace('A chat child has no checkout', 'A chat child has an isolated checkout'), 'chat checkout mutation')).toThrow();
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
  const auth = 'inspect/read-only; propose/plan; authorized execution\nInspect and propose must not use implementation autopilot\nSet kickoff.mode to autopilot explicitly\nAutopilot does not expand scope or permissions.\nUse exact request_id; never auto-approve';
  const scribe = 'Scribe only when durable decisions need merging';
  const lifecycle = 'Native sync task agents: write_agent cannot follow up\nReuse same-mission context with compatible lifecycle, not unrelated worker pool';

  it('rejects the original commit-production-only App routing rule', () => {
    assertDispatch(dispatch);
    expect(() => assertDispatch(`${dispatch}\nUse \`create_session\` for agents that produce commits`)).toThrow();
  });

  it('rejects Autopilot guidance without bounded authorization', () => {
    assertAuthorization(auth);
    expect(() => assertAuthorization(auth.replace('Autopilot does not expand scope or permissions.', ''))).toThrow();
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
