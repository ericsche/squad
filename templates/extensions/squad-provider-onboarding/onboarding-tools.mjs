const PROFILE = 'microsoft-365-agents-sdk-dotnet';
const MARKETPLACE = 'microsoft-agents-sdk';
const SOURCE = 'microsoft/Agents';
const PROVIDER = `agents-for-net@${MARKETPLACE}`;
const PLUGIN_NAMES = ['agents-for-net', 'agents-for-dotnet'];
const SKILLS = [
  'agents-sdk-dotnet',
  'agents-sdk-dotnet-debugging',
  'agents-sdk-dotnet-otel',
  'agents-sdk-dotnet-activityhandler-migration',
  'bf-to-agents-sdk-dotnet-migration',
  'teams-sdk-to-agents-sdk-dotnet-migration',
];
const CAPABILITIES = new Map([
  ['development', ['agents-sdk-dotnet']],
  ['debugging', ['agents-sdk-dotnet', 'agents-sdk-dotnet-debugging']],
  ['otel', ['agents-sdk-dotnet', 'agents-sdk-dotnet-otel']],
  ['activityhandler-migration', ['agents-sdk-dotnet', 'agents-sdk-dotnet-activityhandler-migration']],
  ['bot-framework-migration', ['agents-sdk-dotnet', 'bf-to-agents-sdk-dotnet-migration']],
  ['teams-sdk-migration', ['agents-sdk-dotnet', 'teams-sdk-to-agents-sdk-dotnet-migration']],
]);
const OPTIONAL = 'Recommended guidance is optional enrichment, not a business-work prerequisite. ' +
  'Continue otherwise-authorized work with existing project context, official documentation and standard tools. ' +
  'Respect independent repository or mission requirements, permissions, tests and security controls; this result does not authorize or certify business work. ' +
  'Use relevant skills already legitimately exposed by the host without requiring this bridge or provider attestation first, unless an independent rule explicitly requires that evidence. ' +
  'Do not claim provider verification or skill invocation from a name alone. ' +
  'Disclose an optional limitation once, without blocking dispatch or task progress solely on that limitation. ' +
  'Do not automatically retry, repeat a declined consent request, or install/update/enable/reload plugins; optional setup requires a new explicit user request and real native consent.';
const GUIDED = 'Only for separately user-requested optional setup, use plugin management in this same host ' +
  'to review the Microsoft Agents SDK marketplace (microsoft/Agents) and .NET provider. ' +
  'Do not mutate a separate PATH CLI profile. Provider verification remains unknown/false until actual session evidence validates it.';
const UNAVAILABLE = 'Optional provider guidance is not validated in this snapshot. Loading cause is unknown; ' +
  'no refresh, reinstall or activation remedy is established. Inspect host status/diagnostics only if that optional investigation is requested. ' +
  'Existing skills may still be usable through the actual skill tool; provider attestation and skill invocation are different evidence.';
const INCONSISTENT = 'Provider identity cannot be established consistently in this session inventory. ' +
  'Stop provider changes and ask the host to inspect only the selected Microsoft provider metadata. ' +
  'Do not assume physical uninstall, reinstall/update/enable, repeatedly refresh, use a parent ' +
  'snapshot or inspect private personal configuration to make this check pass.';

/** @param {HostPlugin | undefined} plugin */
function isProvider(plugin) {
  return plugin && PLUGIN_NAMES.includes(plugin.name) && plugin.marketplace === MARKETPLACE;
}

/** @param {HostMarketplace | undefined} marketplace */
function trustedMarketplace(marketplace) {
  return !!marketplace && typeof marketplace.source === 'string' &&
    ['github: microsoft/agents', 'microsoft/agents'].includes(marketplace.source.trim().toLowerCase());
}

/** @param {HostSession} session @param {string[]} requiredSkills @returns {Promise<Inspection>} */
async function inspect(session, requiredSkills) {
  const [pluginResult, marketplaceResult, skillResult] = await Promise.all([
    session.rpc.plugins.list(), session.rpc.plugins.marketplaces.list(), session.rpc.skills.list(),
  ]);
  if (!Array.isArray(pluginResult?.plugins) || !Array.isArray(marketplaceResult?.marketplaces) ||
    !Array.isArray(skillResult?.skills)) {
    throw new Error('Host returned an invalid plugin/marketplace/skill inventory; availability is unknown.');
  }
  const providers = pluginResult.plugins.filter(isProvider);
  const marketplaces = marketplaceResult.marketplaces.filter(item => item?.name === MARKETPLACE);
  if (pluginResult.plugins.some(plugin => PLUGIN_NAMES.includes(plugin?.name) && !isProvider(plugin))) {
    return { problem: 'source-conflict', message: 'A .NET provider name is already installed from another or unverifiable source. Review its host metadata; do not duplicate or replace it automatically.' };
  }
  const plugin = providers[0];
  const marketplace = marketplaces[0];
  if (providers.length > 1 || marketplaces.length > 1) {
    return { problem: 'source-conflict', message: 'Ambiguous Microsoft provider or marketplace identity; no automatic changes are safe.' };
  }
  if (marketplace && !trustedMarketplace(marketplace)) {
    return {
      problem: 'source-conflict',
      message: `${MARKETPLACE} is registered from an unexpected source; expected ${SOURCE}. Do not overwrite or repoint it.`,
    };
  }
  if (marketplace?.available === false || plugin?.managed &&
    (plugin.managedDesiredEnabled === false || plugin.installed === false)) {
    return { problem: 'policy-blocked', message: 'Host-managed provider/marketplace policy blocks availability. Resolve this through the host or administrator, not a local override.' };
  }
  const knownPluginSkillRows = skillResult.skills.filter(skill => SKILLS.includes(skill?.name) && skill.source === 'plugin').length;
  const unrecognizedSelectedProviderRows = pluginResult.plugins.filter(candidate =>
    typeof candidate?.name === 'string' && !isProvider(candidate) &&
    (candidate.marketplace === MARKETPLACE || /^agents-for-(?:net|dotnet)(?:@[^ \t\r\n]+)?$/i.test(candidate.name)) &&
    (/(?:dotnet|(?:^|[-/])net(?:$|[-@]))/i.test(candidate.name) || skillResult.skills.some(skill =>
      SKILLS.includes(skill?.name) && skill.source === 'plugin' && skill.pluginName === candidate.name,
    )),
  ).length;
  if ((!plugin && knownPluginSkillRows > 0) || unrecognizedSelectedProviderRows > 0 || plugin?.installed === false) {
    return {
      problem: 'inventory-inconsistent',
      message: 'No unambiguous usable provider record matches the known plugin skill exposure or selected .NET provider metadata. Physical installation state is not established.',
      providerInventory: { matchedPluginRecord: !!plugin, knownPluginSkillRows, unrecognizedSelectedProviderRows },
    };
  }
  if (plugin && !marketplace) {
    return { problem: 'source-conflict', message: 'Installed provider has no verifiable marketplace source. Review its origin in the host before proceeding.' };
  }
  if (plugin && typeof plugin.enabled !== 'boolean') {
    throw new Error('Host returned an invalid provider enabled state; availability is unknown.');
  }
  /** @type {SkillEvidence[]} */
  const skillEvidence = [];
  /** @type {SkillIssue[]} */
  const skillIssues = [];
  for (const name of SKILLS) {
    const candidates = skillResult.skills.filter(skill => skill?.name === name);
    const associated = candidates.filter(skill => plugin && skill.source === 'plugin' && skill.pluginName === plugin.name);
    const exposed = associated.find(skill => plugin?.enabled && plugin.installed !== false && skill.enabled === true);
    if (exposed && plugin) {
      skillEvidence.push({ name: exposed.name, source: 'plugin', pluginName: plugin.name, enabled: true });
    } else {
      const reason = associated.some(skill => skill.enabled === false) || plugin?.enabled === false && associated.length
        ? 'disabled' : candidates.length ? 'source-mismatch' : 'not-exposed';
      skillIssues.push({ name, required: requiredSkills.includes(name), reason });
    }
  }
  const skills = skillEvidence.map(skill => skill.name);
  const missingSkills = requiredSkills.filter(name => !skills.includes(name));
  const missingOptionalSkills = SKILLS.filter(name => !requiredSkills.includes(name) && !skills.includes(name));
  const providerAssociation = plugin && marketplace ? {
    catalogSpec: PROVIDER, installedName: plugin.name, marketplace: plugin.marketplace,
    marketplaceSourceMatched: trustedMarketplace(marketplace),
  } : undefined;
  // Only selected-provider authority is compared; unrelated user settings never
  // become an input to this tool or a reason to overwrite configuration.
  const authority = JSON.stringify({
    marketplace: marketplace ? { source: marketplace.source, managed: marketplace.managed, available: marketplace.available } : null,
    plugin: plugin ? {
      name: plugin.name, enabled: plugin.enabled, version: plugin.version,
      managed: plugin.managed, managedDesiredEnabled: plugin.managedDesiredEnabled, installed: plugin.installed,
    } : null,
  });
  return {
    plugin, marketplace, missingSkills, missingOptionalSkills, skills, skillEvidence, skillIssues,
    runtimeInventoryComplete: skills.length === SKILLS.length, providerAssociation, authority,
  };
}

/**
 * Bounded bridge to the joined host session, not a general installer. No I/O,
 * approval, config writes or plugin changes occur on construction/reload.
 * @param {() => HostSession | undefined} getSession
 * @returns {import('@github/copilot-sdk').Tool<OnboardingArgs>[]}
 */
export function createM365OnboardingTools(getSession) {
  let queue = Promise.resolve();

  /** @template T @param {() => Promise<T>} action @returns {Promise<T>} */
  function serialize(action) {
    const pending = queue.then(action);
    queue = pending.then(() => undefined, () => undefined);
    return pending;
  }

  /** @param {'onboard' | 'verify'} operation @param {OnboardingArgs} args @param {ToolInvocation} invocation */
  async function run(operation, args, invocation) {
    /** @type {HostSession | undefined} */
    let session;
    let stage = 'preflight';
    let capability = 'development';
    let requiredSkills = ['agents-sdk-dotnet'];
    /** @type {string[]} */
    const mutations = [];
    /** @type {string[]} */
    const attemptedMutations = [];
    /** @type {string[]} */
    const warnings = [];
    /** @type {{errorCount: number, warningCount: number, errorSkills: string[]} | undefined} */
    let reloadDiagnostics;
    let installedByThisCall = false;

    /** @param {string} status @param {ResultDetails} details @returns {Promise<import('@github/copilot-sdk').ToolResultObject>} */
    async function result(status, details = {}) {
      const data = {
        status, profile: PROFILE, provider: PROVIDER, member: args?.member ?? null,
        capability, requiredSkills,
        guidancePolicy: 'recommended',
        businessAuthorization: 'not-evaluated',
        ...(operation === 'onboard' ? { event: args?.event } : {}),
        sessionId: session?.sessionId ?? null, stage, verified: status === 'available',
        specialistVerificationRequired: operation === 'onboard' && args?.event === 'profile-added',
        guidanceLoadRequired: status === 'available' ? requiredSkills : [],
        guidanceLoadVerified: false,
        mutations, attemptedMutations, warnings,
        ...(reloadDiagnostics ? { reloadDiagnostics } : {}), ...details,
        action: `${details.action ? `${details.action} ` : ''}${OPTIONAL}`,
      };
      const resultType = status === 'available' ? 'success'
        : ['declined', 'cancelled', 'context-mismatch'].includes(status) ? 'denied'
          : status === 'not-applicable' ? 'rejected' : 'failure';
      if (status !== 'available' && status !== 'not-applicable' || warnings.length || reloadDiagnostics?.errorCount) {
        const message = `[squad-provider-onboarding] Optional provider inspection/setup ${status}: ${details.message ?? ''} ${warnings.join('; ')}`;
        try {
          if (status === 'invalid') console.error(message);
          else if (typeof session?.log === 'function') await session.log(message, { level: 'warning' });
          else console.error(message);
        } catch (error) {
          console.error(message, 'Host timeline logging also failed:', error);
        }
      }
      return { textResultForLlm: JSON.stringify(data), resultType };
    }

    function cancelled() {
      return invocation?.signal?.aborted === true;
    }

    /** @param {Extract<Inspection, {problem: string}>} state */
    function problem(state) {
      return result(state.problem, {
        message: state.message,
        action: state.problem === 'inventory-inconsistent' ? INCONSISTENT : GUIDED,
        ...(state.providerInventory ? { providerInventory: state.providerInventory } : {}),
      });
    }

    /** @param {Inspection} state */
    function availability(state) {
      if (state.problem !== undefined) return problem(state);
      const evidence = {
        skills: state.skills, missingSkills: state.missingSkills, missingOptionalSkills: state.missingOptionalSkills,
        skillEvidence: state.skillEvidence, skillIssues: state.skillIssues,
        runtimeInventoryComplete: state.runtimeInventoryComplete,
        ...(state.providerAssociation ? { providerAssociation: state.providerAssociation } : {}),
      };
      if (!state.plugin || state.plugin.installed === false) {
        return result('missing', {
          ...evidence,
          message: 'No matching provider record is observable in this session inventory. Physical installation state is not established.',
          action: GUIDED,
        });
      }
      if (!state.plugin.enabled) {
        return result('disabled', { ...evidence, message: 'The selected provider is disabled in this host context.', action: GUIDED });
      }
      if (state.missingSkills.length) {
        return result('capability-unavailable', {
          ...evidence, message: `The optional provider verification criteria for ${capability} are not met in this session. See skillIssues for observable reasons; loading cause is unknown.`,
          action: UNAVAILABLE,
        });
      }
      return result('available', {
        ...evidence,
        message: `Optional provider guidance for ${capability} passes this session's verification criteria. This is not business readiness, complete inventory, or proof of invocation.`,
        action: operation === 'onboard'
          ? (args?.event === 'profile-added'
            ? 'Availability is local to this legacy explicit-setup caller; do not claim another specialist has verified or loaded it.'
            : 'Use relevant available guidance through the actual skill tool when useful. This explicit setup result does not invoke skills or authorize domain work.')
          : 'Provider availability evidence is local to this caller snapshot, not another or future session. Native skill invocation, if relevant, is separate evidence.',
      });
    }

    /**
     * @template T
     * @param {string} action
     * @param {() => Promise<T>} callback
     * @returns {Promise<{cancelled: true} | {cancelled: false, value: T}>}
     */
    async function mutate(action, callback) {
      if (cancelled()) return { cancelled: true };
      attemptedMutations.push(action);
      const value = await callback();
      mutations.push(action);
      return { cancelled: false, value };
    }

    try {
      session = getSession();
      if (args?.profile !== PROFILE || operation === 'onboard' &&
        args?.event !== 'profile-added' && args?.event !== 'specialist-initialization') {
        return await result('not-applicable', { message: 'Only the opted-in Microsoft 365 Agents SDK .NET profile-add or specialist-initialization flow may request preparation.' });
      }
      if (!session?.sessionId || invocation?.sessionId !== session.sessionId ||
        'agentId' in invocation && invocation.agentId) {
        return await result('context-mismatch', { message: 'Use the actual foreground specialist/coordinator session. A native subagent cannot establish its availability from the parent RPC snapshot.', action: GUIDED });
      }
      if (args?.provider !== undefined && args.provider !== PROVIDER ||
        operation === 'onboard' && args?.event === 'specialist-initialization' && args?.provider !== PROVIDER) {
        return await result('invalid', { message: 'The declared provider must be exactly agents-for-net@microsoft-agents-sdk. Specialist initialization requires this explicit fixed-provider declaration.' });
      }
      if (operation === 'onboard' && args?.event === 'profile-added' && args?.capability !== undefined) {
        return await result('invalid', { message: 'Profile-add onboarding evaluates development only. Use read-only verification for a specialized task capability.' });
      }
      if ((operation === 'verify' || args?.event === 'specialist-initialization') && args?.capability !== undefined) {
        const selected = typeof args.capability === 'string' ? CAPABILITIES.get(args.capability) : undefined;
        if (!selected || typeof args.capability !== 'string') {
          return await result('invalid', { message: 'capability must be one of the fixed Microsoft 365 .NET guidance capabilities.' });
        }
        capability = args.capability;
        requiredSkills = [...selected];
      }
      if (typeof args?.member !== 'string' || !args.member.trim() || args.member.length > 120) {
        return await result('invalid', { message: 'A non-empty selected member name of at most 120 characters is required.' });
      }
      if (cancelled()) return await result('cancelled', { message: 'Invocation cancelled before inspection.' });
      const plugins = session.rpc?.plugins;
      if (typeof plugins?.list !== 'function' || typeof plugins?.marketplaces?.list !== 'function' ||
        typeof session.rpc?.skills?.list !== 'function') {
        return await result('host-unavailable', { message: 'The joined host lacks public session-scoped provider inspection APIs.', action: GUIDED });
      }
      stage = 'inspect';
      let state = await inspect(session, requiredSkills);
      if (state.problem !== undefined) return await problem(state);
      // Inspection and verification are read-only. An enabled but unexposed provider
      // must not be reinstalled, re-enabled, or silently refreshed by inspection.
      if (operation === 'verify' || state.plugin?.enabled ||
        args?.event === 'specialist-initialization' && state.plugin) return await availability(state);
      if (typeof session.ui?.confirm !== 'function' || session.capabilities?.ui?.elicitation !== true ||
        typeof plugins.install !== 'function' || typeof plugins.enable !== 'function' ||
        typeof plugins.marketplaces.add !== 'function') {
        return await result('host-unavailable', { message: 'Host-owned explicit confirmation or required provider mutation APIs are unavailable.', action: GUIDED });
      }

      const consentAuthority = state.authority;
      const plan = state.plugin ? 'enable the already installed provider'
        : `${state.marketplace ? '' : 'register the Microsoft marketplace and '}download/install and enable its .NET provider`;
      stage = 'consent';
      const approved = await session.ui.confirm(
        `Install or activate optional Microsoft 365 development guidance for ${args.member}?\n\n` +
        `This will ${plan} in this host's plugin configuration, using Microsoft (microsoft/Agents), ` +
        `provider ${PROVIDER}, in current session ${session.sessionId}. ` +
        'The external skills may also be available to other sessions sharing this host profile. ' +
        'Squad will not copy Microsoft skills into the repository, install NuGet/cloud/auth tools, ' +
        'install other plugins, or change update settings. Recommended guidance is not required for otherwise-permitted work. ' +
        'Team creation, child startup and a business request are not install consent. Allow this specific change?',
      );
      if (approved !== true) return await result('declined', { message: 'Optional provider setup declined or cancelled. No provider change was attempted by this call. Preserve the refusal; do not retry without a new explicit user request.' });
      if (cancelled()) return await result('cancelled', { message: 'Invocation cancelled while confirmation was open; no configuration changed.' });
      if (getSession() !== session || session.sessionId !== invocation.sessionId) {
        return await result('context-mismatch', { message: 'The joined specialist session changed while confirmation was open; no provider change is authorized.', action: INCONSISTENT });
      }
      stage = 'revalidate';
      state = await inspect(session, requiredSkills);
      if (state.problem !== undefined) return await problem(state);
      if (state.authority !== consentAuthority) {
        return await result('approval-stale', { message: 'Provider/source/action changed while confirmation was open. No mutation attempted; inspect again and request fresh host consent.', action: GUIDED });
      }

      if (!state.marketplace) {
        stage = 'register-marketplace';
        const added = await mutate('register-marketplace', () => plugins.marketplaces.add({ source: SOURCE }));
        if (added.cancelled) {
          return await result('cancelled', { message: 'Cancelled before marketplace registration.' });
        }
        state = await inspect(session, requiredSkills);
        if (state.problem !== undefined) return await problem(state);
        if (added.value?.name !== MARKETPLACE || !trustedMarketplace(state.marketplace)) {
          return await result('source-conflict', { message: 'Host registration did not establish the intended Microsoft marketplace. Registration may have persisted; do not overwrite/remove other user state.', action: GUIDED });
        }
      }
      if (!state.plugin) {
        stage = 'install';
        // Recheck source immediately before resolving the marketplace spec.
        state = await inspect(session, requiredSkills);
        if (state.problem !== undefined) return await problem(state);
        if (!trustedMarketplace(state.marketplace)) return await result('source-conflict', { message: 'Microsoft marketplace disappeared before install.', action: GUIDED });
        if (!state.plugin) {
          const installed = await mutate('install', () => plugins.install({ source: PROVIDER }));
          if (installed.cancelled) {
            return await result('cancelled', { message: 'Cancelled before installation.' });
          }
          if (!isProvider(installed.value?.plugin)) {
            return await result('source-conflict', { message: 'Host install returned a different provider identity; no further mutation is authorized.', action: GUIDED });
          }
          installedByThisCall = true;
          if (installed.value.deprecationWarning) warnings.push(installed.value.deprecationWarning);
          state = await inspect(session, requiredSkills);
          if (state.problem !== undefined) return await problem(state);
        }
      }
      if (!state.plugin) return await result('host-error', { message: 'Host install did not retain the intended provider.', action: GUIDED });
      if (!state.plugin.enabled) {
        if (args?.event === 'specialist-initialization' && !installedByThisCall) {
          return await availability(state);
        }
        stage = 'enable';
        const name = `${state.plugin.name}@${MARKETPLACE}`;
        const enabled = await mutate('enable', () => plugins.enable({ names: [name] }));
        if (enabled.cancelled) {
          return await result('cancelled', { message: 'Cancelled before enabling the provider.' });
        }
      }
      if (cancelled()) return await result('cancelled', { message: 'Cancelled after a host change. Some setup may have persisted; inspect before retrying.', action: GUIDED });
      stage = 'reload';
      if (typeof plugins.reload !== 'function' || typeof session.rpc.skills.reload !== 'function') {
        warnings.push('Provider setup completed, but public cache refresh APIs are unavailable. Availability is evaluated from current skill evidence, not assumed from installation.');
        return await availability(await inspect(session, requiredSkills));
      }
      // The verified provider is skills-only. Never restart MCP, hooks, agents or
      // this extension as a side effect of loading those skills.
      await plugins.reload({ reloadMcp: false, reloadCustomAgents: false, reloadHooks: false, reloadExtensions: false });
      const diagnostics = await session.rpc.skills.reload();
      if (!Array.isArray(diagnostics?.errors) || !Array.isArray(diagnostics?.warnings) ||
        !diagnostics.errors.every(error => typeof error === 'string') ||
        !diagnostics.warnings.every(warning => typeof warning === 'string')) {
        throw new Error('Host returned invalid skill reload diagnostics; availability is unknown.');
      }
      // Reload diagnostics can cover unrelated skills and contain private paths.
      // Surface counts and known inventory names, not the host's raw diagnostics.
      reloadDiagnostics = {
        errorCount: diagnostics.errors.length,
        warningCount: diagnostics.warnings.length,
        errorSkills: SKILLS.filter(name => {
          const mention = new RegExp(`(?:^|[^a-z0-9_-])${name}(?:$|[^a-z0-9_-])`);
          return diagnostics.errors.some(error => mention.test(error));
        }),
      };
      if (diagnostics.errors.length || diagnostics.warnings.length) {
        warnings.push(`Host reported ${diagnostics.errors.length} skill reload error(s) and ${diagnostics.warnings.length} warning(s). ` +
          'Inspect full diagnostics in the host; this result exposes only counts and known skill names. Required-action readiness still depends on observed skill/provider evidence.');
      }
      stage = 'verify';
      return await availability(await inspect(session, requiredSkills));
    } catch (error) {
      const unsupported = error !== null && typeof error === 'object' && 'code' in error && error.code === -32601;
      return await result(unsupported ? 'host-unavailable' : 'host-error', {
        message: error instanceof Error ? error.message : String(error),
        action: (attemptedMutations.length ? 'A host change was attempted; its outcome may be partial/uncertain. Inspect before retrying. ' : '') + GUIDED,
      });
    }
  }

  const properties = {
    profile: { type: 'string', const: PROFILE, description: 'Profile for optional Microsoft 365 Agents SDK .NET guidance, not a prerequisite of ordinary work or generic C#/Microsoft Agent Framework.' },
    member: { type: 'string', minLength: 1, maxLength: 120, description: 'Selected team member name; Squad derives this from the roster.' },
    provider: { type: 'string', const: PROVIDER, description: 'Fixed recommended external provider. Required for a specialist-initialization setup call, not for using an already exposed native skill. Never an arbitrary plugin URL.' },
  };
  const capabilitySchema = {
    type: 'string', enum: [...CAPABILITIES.keys()], default: 'development',
    description: 'Optional inspection/setup target. Its requiredSkills are criteria for this provider check, not added business prerequisites. Legacy profile-added remains development-only.',
  };
  return [
    {
      name: 'squad_m365_profile_onboard',
      description: 'Separately user-requested OPTIONAL setup of the fixed Microsoft .NET guidance provider. Never call automatically on member addition, child startup or an ordinary task, and never retry a refusal without a new explicit user request. Lifecycle labels are not consent. Native host confirmation is mandatory before mutations; source/context/policy guards remain. Missing bridge/guidance does not block otherwise-permitted work. Provider availability is not skill invocation or business authorization.',
      parameters: {
        type: 'object',
        properties: {
          ...properties, capability: capabilitySchema,
          event: { type: 'string', enum: ['profile-added', 'specialist-initialization'], description: 'Compatibility context for an explicitly requested optional setup only; these events never trigger installation or confer consent.' },
        },
        required: ['profile', 'member', 'event'],
        allOf: [{
          if: { properties: { event: { const: 'specialist-initialization' } }, required: ['event'] },
          then: { required: ['provider'] },
          else: { not: { required: ['capability'] } },
        }],
        additionalProperties: false,
      },
      handler: (args, invocation) => serialize(() => run('onboard', args, invocation)),
    },
    {
      name: 'squad_m365_profile_verify',
      description: 'Optional read-only inspection of Microsoft .NET provider guidance in this actual session. Do not require this call merely to use a native skill already legitimately exposed by the host. Missing/unverified evidence stays false but is not a default business-work veto. Independent explicit repository/mission controls remain binding. No install, enable, reload or configuration writes; no cache-cause assumption.',
      parameters: {
        type: 'object',
        properties: {
          ...properties,
          capability: capabilitySchema,
        },
        required: ['profile', 'member'], additionalProperties: false,
      },
      handler: (args, invocation) => run('verify', args, invocation),
    },
  ];
}
/** @typedef {import('@github/copilot-sdk').CopilotSession} HostSession */
/** @typedef {import('@github/copilot-sdk').ToolInvocation} ToolInvocation */
/** @typedef {Awaited<ReturnType<HostSession['rpc']['plugins']['list']>>['plugins'][number]} HostPlugin */
/** @typedef {Awaited<ReturnType<HostSession['rpc']['plugins']['marketplaces']['list']>>['marketplaces'][number]} HostMarketplace */
/** @typedef {{profile?: unknown, event?: unknown, member?: unknown, capability?: unknown, provider?: unknown}} OnboardingArgs */
/** @typedef {{name: string, source: 'plugin', pluginName: string, enabled: true}} SkillEvidence */
/** @typedef {{name: string, required: boolean, reason: 'not-exposed' | 'disabled' | 'source-mismatch'}} SkillIssue */
/** @typedef {{catalogSpec: string, installedName: string, marketplace: string, marketplaceSourceMatched: boolean}} ProviderAssociation */
/** @typedef {{matchedPluginRecord: boolean, knownPluginSkillRows: number, unrecognizedSelectedProviderRows: number}} ProviderInventory */
/** @typedef {{message?: string, action?: string, skills?: string[], missingSkills?: string[], missingOptionalSkills?: string[], skillEvidence?: SkillEvidence[], skillIssues?: SkillIssue[], runtimeInventoryComplete?: boolean, providerAssociation?: ProviderAssociation, providerInventory?: ProviderInventory}} ResultDetails */
/**
 * @typedef {{
 *   problem: string, message: string, providerInventory?: ProviderInventory, plugin?: undefined, marketplace?: undefined,
 *   missingSkills?: undefined, authority?: undefined
 * } | {
 *   problem?: undefined, message?: undefined, plugin?: HostPlugin,
 *   marketplace?: HostMarketplace, missingSkills: string[], missingOptionalSkills: string[], skills: string[],
 *   skillEvidence: SkillEvidence[], skillIssues: SkillIssue[], runtimeInventoryComplete: boolean,
 *   providerAssociation?: ProviderAssociation, authority: string
 * }} Inspection
 */
