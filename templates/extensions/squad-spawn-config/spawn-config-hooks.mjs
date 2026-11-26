// Dependency-free apart from Node built-ins; tests inject the joined session and file access.
//
// The coordinator is told to pass `.squad/config.json` model and reasoning-effort
// preferences when it creates an App sub-session, but it does not always read
// the config first. This hook fills in what the coordinator left out, so a
// configured member (for example `agentModelOverrides.backend`) always gets its
// model, and dev and security work gets the work default below when no config
// preference applies. It never overrides a model or effort the call already
// sets, and it writes nothing. The security-framing extension uses
// `reviewerPreferences` for the native security reviewer, whose call it owns.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const EFFORTS = new Set(['low', 'medium', 'high', 'xhigh', 'max']);
const COORDINATOR = 'squad';

/** Work default for dev and security work, used only when the host offers the model. */
export const WORK_MODEL = 'mai-code-2';
export const WORK_EFFORT = 'high';

// Dev means a code-writing role (implementation, tests, infrastructure); security
// means a security role, or any mission about security.
const DEV_ROLE = /\b(?:dev|develop\w*|engineer\w*|programm\w*|coder|coding|implement\w*|backend|back-end|frontend|front-end|full[- ]?stack|mobile|test\w*|qa|quality|sdet|devops|infra\w*|platform|sre)\b/i;
// Developer relations roles name development without writing the code.
const NON_DEV_ROLE = /\b(?:devrel|developer[\s-]+(?:advocate|advocacy|relations|evangelist))\b/gi;
const SECURITY_ROLE = /\b(?:secur\w*|appsec|auth(?:entication|orization|n|z)?|compliance|pentest\w*|threat\w*|vulnerab\w*)\b/i;
const SECURITY_MISSION = /\b(?:secur\w*|appsec|vulnerab\w*|cve\w*|threat\w*|pentest\w*|exploit\w*)\b/i;

const nodeFs = {
  exists: (path) => existsSync(path),
  read: (path) => (existsSync(path) ? readFileSync(path, 'utf8') : undefined),
};

/** Member key from the sub-session name (`🔧 Backend · Mission` -> `backend`), else the kickoff identity. */
export function memberFrom(args) {
  const name = typeof args?.name === 'string' ? args.name : '';
  const label = name.split(' · ')[0].replace(/^[^\p{L}\p{N}]+/u, '').trim();
  if (name.includes(' · ') && label) return label.toLowerCase();
  const prompt = args?.kickoff?.prompt;
  const match = typeof prompt === 'string' ? /\bcanonical(?: identity)?\s+([a-z0-9][\w-]*)/i.exec(prompt) : null;
  return match ? match[1].toLowerCase() : undefined;
}

/** Mission part of the sub-session name (`🔧 Backend · Mission` -> `Mission`). */
export function missionOf(args) {
  const name = typeof args?.name === 'string' ? args.name : '';
  const index = name.indexOf(' · ');
  return index === -1 ? '' : name.slice(index + 3).trim();
}

/** Nearest `.squad/` (config and team roster) from the working directory up to the repository root. */
export function readSquadFiles(startDir, fs = nodeFs) {
  if (typeof startDir !== 'string' || !startDir.trim()) return undefined;
  let dir = startDir.replace(/^\\\\\?\\/, '');
  for (;;) {
    const raw = fs.read(join(dir, '.squad', 'config.json'));
    const team = fs.read(join(dir, '.squad', 'team.md'));
    if (raw !== undefined || team !== undefined) {
      let config;
      try {
        const parsed = raw === undefined ? undefined : JSON.parse(raw);
        config = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : undefined;
      } catch {
        config = undefined;
      }
      return { config, team };
    }
    if (fs.exists(join(dir, '.git'))) return undefined;
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

/** Nearest `.squad/config.json` from the working directory up to the repository root. */
export function readSquadConfig(startDir, fs = nodeFs) {
  return readSquadFiles(startDir, fs)?.config;
}

/** Role column of the member's row in `.squad/team.md`. */
export function memberRole(team, member) {
  if (typeof team !== 'string' || !member) return undefined;
  for (const line of team.split(/\r?\n/)) {
    if (!line.trim().startsWith('|')) continue;
    const cells = line.split('|').slice(1, -1).map((cell) => cell.replace(/[*`]/g, '').trim());
    if (cells.length < 2) continue;
    if (cells[0].replace(/^[^\p{L}\p{N}]+/u, '').trim().toLowerCase() === member) return cells[1];
  }
  return undefined;
}

/** `security`, `dev` or undefined, from the member's roster role (else its label) and the mission. */
export function workKind({ role, label, mission } = {}) {
  const identity = role ?? label ?? '';
  if (SECURITY_ROLE.test(identity) || SECURITY_MISSION.test(mission ?? '')) return 'security';
  return DEV_ROLE.test(identity.replace(NON_DEV_ROLE, ' ')) ? 'dev' : undefined;
}

/** The work default yields to the economy and opt-in hydrafusion profiles. */
export function workDefaultsApply(config) {
  const profile = typeof config?.modelProfile === 'string' ? config.modelProfile.trim().toLowerCase() : '';
  if (profile === 'hydrafusion' || config?.economyMode === true) return false;
  return !(profile === 'economy' && config?.economyMode !== false);
}

function entry(map, member) {
  if (!map || typeof map !== 'object' || Array.isArray(map)) return undefined;
  const key = Object.keys(map).find((k) => k.toLowerCase() === member);
  return key === undefined ? undefined : map[key];
}

function preference(value) {
  return typeof value === 'string' && value.trim() && value.trim().toLowerCase() !== 'auto' ? value.trim() : undefined;
}

function effortPreference(value) {
  const effort = preference(value)?.toLowerCase();
  return effort && EFFORTS.has(effort) ? effort : undefined;
}

/** Config precedence: per-member override, then the squad-wide default; `auto` or an invalid value means no preference. */
export function spawnPreferences(config, member) {
  const model = preference(entry(config?.agentModelOverrides, member)) ?? preference(config?.defaultModel);
  const effort = effortPreference(entry(config?.agentReasoningEffortOverrides, member)) ?? effortPreference(config?.defaultReasoningEffort);
  return { model, effort };
}

async function squadSelected(session) {
  try {
    const current = await session?.rpc?.agent?.getCurrent?.();
    const name = current?.agent?.name;
    return typeof name === 'string' && name.trim().toLowerCase() === COORDINATOR;
  } catch {
    return false;
  }
}

/** Host model entry, `null` when the host list does not offer it, `undefined` when unknown. */
async function hostModel(session, id) {
  try {
    const result = await session?.rpc?.model?.list?.();
    if (!Array.isArray(result?.list)) return undefined;
    return result.list.find((model) => model && typeof model === 'object' && model.id === id) ?? null;
  } catch {
    return undefined;
  }
}

/**
 * Missing `model` / `reasoning_effort` for one spawn. Precedence: the call's own
 * values, then config (per-member override, then squad default), then the work
 * default for dev or security work. A configured model the host does not list is
 * skipped; the work default needs the host to list it.
 */
export async function fillPreferences(session, { config, member, kind, model: callModel, effort: callEffort }) {
  const configured = spawnPreferences(config, member);
  const work = kind && workDefaultsApply(config) ? { model: WORK_MODEL, effort: WORK_EFFORT } : undefined;
  const patch = {};
  let target = callModel;
  if (callModel === undefined) {
    const model = configured.model ?? work?.model;
    const offered = model ? await hostModel(session, model) : null;
    // A model the host does not offer would fail the launch: keep the inherited model.
    if (model && (configured.model ? offered !== null : Boolean(offered))) {
      patch.model = model;
      target = model;
    }
  }
  if (callEffort === undefined) {
    if (target === undefined && (configured.effort || work)) {
      // The child inherits the session model when no model is passed: check the effort against it.
      try { target = (await session?.rpc?.model?.getCurrent?.())?.modelId; } catch { target = undefined; }
    }
    const effort = configured.effort ?? (work && target === work.model ? work.effort : undefined);
    if (effort) {
      const info = target === undefined ? undefined : await hostModel(session, target);
      const supported = info?.supportedReasoningEfforts;
      if (!Array.isArray(supported) || supported.includes(effort)) patch.reasoning_effort = effort;
    }
  }
  return patch;
}

/** Config key for the coordinator's native security reviewer (`agentModelOverrides["security-review"]`). */
export const REVIEWER_KEY = 'security-review';

/** Missing model and effort for the coordinator's native security reviewer: its config key, then security work. */
export async function reviewerPreferences(session, workingDirectory, args, fs = nodeFs) {
  const config = readSquadFiles(workingDirectory, fs)?.config;
  return fillPreferences(session, { config, member: REVIEWER_KEY, kind: 'security', model: args?.model, effort: args?.reasoning_effort });
}

export function createSpawnConfigHooks(getSession, fs = nodeFs) {
  return {
    async onPreToolUse(input) {
      if (input?.agentId || input?.toolName !== 'create_session') return undefined;
      const args = input.toolArgs;
      const kickoff = args?.kickoff;
      // Without a kickoff the call has nowhere to carry a model.
      if (!kickoff || typeof kickoff !== 'object' || Array.isArray(kickoff)) return undefined;
      if (kickoff.model !== undefined && kickoff.reasoning_effort !== undefined) return undefined;
      const session = getSession();
      if (!(await squadSelected(session))) return undefined;
      const member = memberFrom(args);
      if (!member) return undefined;
      const squad = readSquadFiles(input.workingDirectory ?? input.cwd, fs);
      const kind = workKind({ role: memberRole(squad?.team, member), label: member, mission: missionOf(args) });
      const patch = await fillPreferences(session, {
        config: squad?.config, member, kind, model: kickoff.model, effort: kickoff.reasoning_effort,
      });
      if (Object.keys(patch).length === 0) return undefined;
      return { modifiedArgs: { ...args, kickoff: { ...kickoff, ...patch } } };
    },
  };
}
