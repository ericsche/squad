// Dependency-free apart from Node built-ins; tests inject the joined session and file access.
//
// The coordinator is told to pass `.squad/config.json` model and reasoning-effort
// preferences when it creates an App sub-session, but it does not always read
// the config first. This hook fills in what the coordinator left out, so a
// configured member (for example `agentModelOverrides.backend`) always gets its
// model. It never overrides a model or effort the call already sets, and it
// writes nothing.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const EFFORTS = new Set(['low', 'medium', 'high', 'xhigh', 'max']);
const COORDINATOR = 'squad';

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

/** Nearest `.squad/config.json` from the working directory up to the repository root. */
export function readSquadConfig(startDir, fs = nodeFs) {
  if (typeof startDir !== 'string' || !startDir.trim()) return undefined;
  let dir = startDir.replace(/^\\\\\?\\/, '');
  for (;;) {
    const raw = fs.read(join(dir, '.squad', 'config.json'));
    if (raw !== undefined) {
      try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : undefined;
      } catch {
        return undefined;
      }
    }
    if (fs.exists(join(dir, '.git'))) return undefined;
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
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

export function createSpawnConfigHooks(getSession, fs = nodeFs) {
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
      const { model, effort } = spawnPreferences(readSquadConfig(input.workingDirectory ?? input.cwd, fs), member);

      const patch = {};
      let target = kickoff.model;
      if (model && kickoff.model === undefined) {
        const offered = await hostModel(session, model);
        // A model the host does not offer would fail the launch: keep the inherited model.
        if (offered !== null) {
          patch.model = model;
          target = model;
        }
      }
      if (effort && kickoff.reasoning_effort === undefined) {
        // The child inherits the session model when no model is passed: check the effort against it.
        if (target === undefined) {
          try { target = (await session?.rpc?.model?.getCurrent?.())?.modelId; } catch { target = undefined; }
        }
        const info = target === undefined ? undefined : await hostModel(session, target);
        const supported = info?.supportedReasoningEfforts;
        if (!Array.isArray(supported) || supported.includes(effort)) patch.reasoning_effort = effort;
      }
      if (Object.keys(patch).length === 0) return undefined;
      return { modifiedArgs: { ...args, kickoff: { ...kickoff, ...patch } } };
    },
  };
}
