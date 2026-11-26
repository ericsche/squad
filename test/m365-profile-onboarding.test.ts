import { afterEach, describe, expect, it, vi } from 'vitest';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { compileCharterFull } from '../packages/squad-sdk/src/agents/charter-compiler.js';
import Ajv from 'ajv';

const canonical = resolve('.squad-templates');
const extensionDir = join(canonical, 'extensions', 'squad-provider-onboarding');
const profile = 'microsoft-365-agents-sdk-dotnet';
const provider = 'agents-for-net@microsoft-agents-sdk';
const skillNames = [
  'agents-sdk-dotnet',
  'agents-sdk-dotnet-debugging',
  'agents-sdk-dotnet-otel',
  'agents-sdk-dotnet-activityhandler-migration',
  'bf-to-agents-sdk-dotnet-migration',
  'teams-sdk-to-agents-sdk-dotnet-migration',
];
const args = { profile, event: 'profile-added', member: 'M365 Engineer' };
const invocation = { sessionId: 'specialist-session', toolCallId: 'call-1' };
const capabilitySkills = {
  development: undefined,
  debugging: 'agents-sdk-dotnet-debugging',
  otel: 'agents-sdk-dotnet-otel',
  'activityhandler-migration': 'agents-sdk-dotnet-activityhandler-migration',
  'bot-framework-migration': 'bf-to-agents-sdk-dotnet-migration',
  'teams-sdk-migration': 'teams-sdk-to-agents-sdk-dotnet-migration',
} as const;
type OnboardingInput = {
  profile?: unknown; event?: unknown; member?: unknown; capability?: unknown; consent?: unknown; provider?: unknown;
};
const selfPrepare = { ...args, event: 'specialist-initialization', provider };

type Plugin = {
  name: string; marketplace: string; enabled: boolean; installed?: boolean;
  managed?: boolean; managedDesiredEnabled?: boolean; version?: string;
};

function fixture(options: { installed?: boolean; disabled?: boolean; skillsNotExposed?: boolean; coreOnly?: boolean; orphanedProviderSkill?: boolean; consent?: boolean } = {}) {
  const plugins: Plugin[] = options.installed
    ? [{ name: 'agents-for-dotnet', marketplace: 'microsoft-agents-sdk', enabled: !options.disabled }]
    : [];
  const marketplaces = options.installed
    ? [{ name: 'microsoft-agents-sdk', source: 'GitHub: microsoft/Agents' }]
    : [];
  const skills = options.installed && !options.disabled && !options.skillsNotExposed
    ? (options.coreOnly ? skillNames.slice(0, 1) : skillNames).map(name => ({ name, enabled: true, source: 'plugin', pluginName: 'agents-for-dotnet' }))
    : [];
  if (options.orphanedProviderSkill) skills.push({ name: 'agents-sdk-dotnet', enabled: true, source: 'plugin', pluginName: 'agents-for-dotnet' });
  const calls: string[] = [];
  const mutations: string[] = [];
  const session = {
    sessionId: invocation.sessionId,
    capabilities: { ui: { elicitation: true } },
    log: vi.fn(async () => {}),
    ui: { confirm: vi.fn(async () => { calls.push('consent'); return options.consent ?? true; }) },
    rpc: {
      plugins: {
        list: vi.fn(async () => ({ plugins: structuredClone(plugins) })),
        install: vi.fn(async (input: { source: string }) => {
          calls.push('install'); mutations.push('install');
          expect(input.source).toBe(provider);
          const plugin = { name: 'agents-for-dotnet', marketplace: 'microsoft-agents-sdk', enabled: true };
          plugins.push(plugin);
          return { plugin, skillsInstalled: skillNames.length };
        }),
        enable: vi.fn(async (input: { names: string[] }) => {
          calls.push('enable'); mutations.push('enable');
          expect(input.names).toEqual(['agents-for-dotnet@microsoft-agents-sdk']);
          plugins[0]!.enabled = true;
        }),
        reload: vi.fn(async (input: unknown) => {
          calls.push('reload');
          expect(input).toEqual({ reloadMcp: false, reloadCustomAgents: false, reloadHooks: false, reloadExtensions: false });
        }),
        marketplaces: {
          list: vi.fn(async () => ({ marketplaces: structuredClone(marketplaces) })),
          add: vi.fn(async (input: { source: string }) => {
            calls.push('add'); mutations.push('add');
            expect(input).toEqual({ source: 'microsoft/Agents' });
            marketplaces.push({ name: 'microsoft-agents-sdk', source: 'GitHub: microsoft/Agents' });
            return { name: 'microsoft-agents-sdk' };
          }),
        },
      },
      skills: {
        list: vi.fn(async () => ({ skills: structuredClone(skills) })),
        reload: vi.fn(async () => {
          calls.push('skills-reload');
          if (plugins.some(p => p.enabled)) {
            skills.splice(0, skills.length, ...skillNames.map(name => ({
              name, enabled: true, source: 'plugin', pluginName: 'agents-for-dotnet',
            })));
          }
          return { errors: [], warnings: [] };
        }),
      },
    },
  };
  return { session, plugins, marketplaces, skills, calls, mutations };
}

async function toolsFor(session: unknown) {
  const { createM365OnboardingTools } = await import(
    '../.squad-templates/extensions/squad-provider-onboarding/onboarding-tools.mjs'
  );
  return createM365OnboardingTools(() => session);
}

async function call(f: ReturnType<typeof fixture>, operation = 'onboard', input: OnboardingInput = args, caller = invocation) {
  const tools = await toolsFor(f.session);
  const result = await tools.find((tool: { name: string }) =>
    tool.name === `squad_m365_profile_${operation}`,
  ).handler(input, caller);
  return { data: JSON.parse(result.textResultForLlm), resultType: result.resultType };
}

afterEach(() => vi.restoreAllMocks());

describe('recommended guidance default (instruction contract, not live model acceptance)', () => {
  it('does not gate ordinary work on provider verification or startup installation', () => {
    const reference = readFileSync(join(canonical, 'plugin-marketplace.md'), 'utf8');
    const coordinator = readFileSync(join(canonical, 'squad.agent.md'), 'utf8');
    const adding = coordinator.split('### Adding Team Members')[1]!.split('### Removing Team Members')[0]!;
    expect(reference).toContain('Recommended guidance is not a business-work prerequisite');
    expect(reference).toContain('Do not require provider verification merely to invoke a skill already legitimately exposed by the host');
    expect(reference).toContain('Do not call verify or onboard automatically at member addition or child startup');
    expect(reference).toContain('Continue otherwise-authorized work with existing project context, official documentation and standard tools');
    expect(reference).toContain('A native skill invocation proves invocation, not provider provenance');
    expect(adding).toContain('Recommended guidance');
    expect(adding).not.toContain('preparation pending');
    expect(coordinator).not.toContain('**M365 provider gate:**');
  });

  it('the generated charter and inlined block allow native skills without the optional installation bridge', () => {
    const reference = readFileSync(join(canonical, 'plugin-marketplace.md'), 'utf8').replace(/\r\n?/g, '\n');
    const declaration = reference.match(/```markdown\n(## X-External Provider[\s\S]+?)\n```/)?.[1] ?? '';
    const block = reference.match(/```text\n(EXTERNAL_PROVIDER_PREPARATION[\s\S]+?)\n```/)?.[1] ?? '';
    expect(declaration).toContain('**Recommended guidance:**');
    expect(declaration).toContain('**Recommended provider:**');
    expect(declaration).not.toContain('Core required skill');
    expect(declaration).toContain('Use relevant skills already available through the actual skill tool');
    expect(block).toContain('Missing optional bridge, provider metadata or skill guidance does not block ordinary work');
    expect(block).toContain('Do not repeat a declined installation request without a new explicit user request');
    expect(block).toContain('An explicit repository or mission requirement remains binding');
    expect(block).not.toContain('bootstrap-blocked');
    expect(block).not.toContain('Only after successful invocation may you report this action');
  });

  it.each(['missing', 'declined', 'host-error', 'host-unavailable'])('optional %s preserves actual failure evidence without vetoing otherwise-permitted work', async failure => {
    const f = fixture({ consent: false });
    if (failure === 'host-error') {
      f.marketplaces.push({ name: 'microsoft-agents-sdk', source: 'GitHub: microsoft/Agents' });
      f.session.ui.confirm.mockResolvedValueOnce(true);
      f.session.rpc.plugins.install.mockRejectedValueOnce(new Error('Failed to install plugin: Access is denied. (os error 5)'));
    }
    const session = failure === 'host-unavailable' ? { ...f.session, rpc: undefined } : f.session;
    const tools = await toolsFor(session);
    const result = await tools[failure === 'missing' || failure === 'host-unavailable' ? 1 : 0].handler(
      failure === 'missing' || failure === 'host-unavailable' ? { profile, member: args.member } : selfPrepare, invocation,
    );
    const data = JSON.parse(result.textResultForLlm);
    expect(data).toMatchObject({
      status: failure, verified: false, guidanceLoadVerified: false,
      guidancePolicy: 'recommended', businessAuthorization: 'not-evaluated',
    });
    expect(data.action).toContain('Continue otherwise-authorized work');
    expect(data.action).toContain('independent repository or mission requirements');
    expect(data.action).not.toMatch(/Keep.*(?:SDK|capability|support).*blocked/i);
    expect(f.session.ui.confirm.mock.calls.length).toBeLessThanOrEqual(1);
    if (failure === 'host-error') {
      expect(data).toMatchObject({ stage: 'install', attemptedMutations: ['install'], mutations: [] });
      expect(data.message).toContain('Access is denied. (os error 5)');
      expect(data.action).toContain('partial/uncertain');
      expect(f.session.rpc.plugins.install).toHaveBeenCalledOnce();
    } else {
      expect(data.attemptedMutations).toEqual([]);
      expect(f.mutations).toEqual([]);
    }
    expect(data.action).toContain('Do not automatically retry');
  });

  it('a visible native skill can be invoked without claiming a verified provider association', async () => {
    const f = fixture();
    f.skills.push({ name: 'agents-sdk-dotnet', enabled: true, source: 'project', pluginName: '' });
    const { data } = await call(f, 'verify', { profile, member: args.member });
    expect(data).toMatchObject({
      status: 'missing', verified: false, guidanceLoadVerified: false, skillEvidence: [],
      guidancePolicy: 'recommended', businessAuthorization: 'not-evaluated',
    });
    expect(data).not.toHaveProperty('providerAssociation');
    expect(data.action).toContain('Continue otherwise-authorized work');
    expect(f.calls).toEqual([]);
  });
});

describe('specialist-owned initial preparation through existing same-session tools', () => {
  it('self-initialization installs the declared absent provider only after same-session host consent', async () => {
    const f = fixture();
    const { data } = await call(f, 'onboard', selfPrepare);
    expect(data).toMatchObject({
      status: 'available', verified: true, event: 'specialist-initialization',
      sessionId: invocation.sessionId, capability: 'development',
      guidanceLoadRequired: ['agents-sdk-dotnet'], guidanceLoadVerified: false,
      specialistVerificationRequired: false,
    });
    expect(f.calls).toEqual(['consent', 'add', 'install', 'reload', 'skills-reload']);
    expect(f.session.ui.confirm.mock.calls[0]![0]).toContain(invocation.sessionId);
    expect(f.session.ui.confirm.mock.calls[0]![0]).toContain('sharing this host profile');
  });

  it('ready shared provider is inspected in this specialist and never reinstalled/reconfirmed at a new boundary', async () => {
    const f = fixture({ installed: true, coreOnly: true });
    for (let boundary = 0; boundary < 2; boundary++) {
      expect((await call(f, 'onboard', selfPrepare)).data).toMatchObject({
        status: 'available', verified: true, missingSkills: [], missingOptionalSkills: skillNames.slice(1),
        guidanceLoadRequired: ['agents-sdk-dotnet'], guidanceLoadVerified: false,
      });
    }
    expect(f.session.rpc.plugins.list).toHaveBeenCalledTimes(2);
    expect(f.calls).toEqual([]);
    expect(f.mutations).toEqual([]);
  });

  it('a specialized initialization checks core plus its task skill and cannot mark invocation as loaded from metadata', async () => {
    const f = fixture({ installed: true });
    const { data } = await call(f, 'onboard', { ...selfPrepare, capability: 'otel' });
    expect(data).toMatchObject({
      status: 'available', capability: 'otel',
      guidanceLoadRequired: ['agents-sdk-dotnet', 'agents-sdk-dotnet-otel'], guidanceLoadVerified: false,
    });
    expect(f.calls).toEqual([]);
  });

  it.each(['not-exposed', 'disabled', 'source-mismatch'])('installed required skill $0 stays blocked without reinstall/update/enable', async state => {
    const f = fixture({ installed: true });
    if (state === 'not-exposed') f.skills.shift();
    else if (state === 'disabled') f.skills[0]!.enabled = false;
    else f.skills[0]!.source = 'project';
    expect((await call(f, 'onboard', selfPrepare)).data).toMatchObject({
      status: 'capability-unavailable', verified: false, guidanceLoadVerified: false,
      skillIssues: [{ name: 'agents-sdk-dotnet', required: true, reason: state }],
    });
    expect(f.calls).toEqual([]);
    expect(f.mutations).toEqual([]);
  });

  it('disabled provider at specialist initialization is explicit and does not auto-enable or prompt repeatedly', async () => {
    const f = fixture({ installed: true, disabled: true });
    expect((await call(f, 'onboard', selfPrepare)).data.status).toBe('disabled');
    expect(f.calls).toEqual([]);
    expect(f.session.ui.confirm).not.toHaveBeenCalled();
  });

  it.each([undefined, 'untrusted-plugin@untrusted-market', 'https://untrusted.example/plugin', null])('rejects unrelated or absent declared provider %j before host I/O', async declared => {
    const f = fixture();
    expect((await call(f, 'onboard', { ...selfPrepare, provider: declared })).data.status).toBe('invalid');
    expect(f.session.rpc.plugins.list).not.toHaveBeenCalled();
    expect(f.calls).toEqual([]);
  });

  it('verify also rejects an unrelated declaration rather than selecting an arbitrary dependency', async () => {
    const f = fixture({ installed: true });
    expect((await call(f, 'verify', { ...args, provider: 'different-provider' })).data.status).toBe('invalid');
    expect(f.session.rpc.plugins.list).not.toHaveBeenCalled();
  });

  it('missing bridge APIs in specialist context are an explicit prerequisite, not a parent-context install fallback', async () => {
    const f = fixture();
    const session = { ...f.session, rpc: undefined };
    const tools = await toolsFor(session);
    const result = await tools[0].handler(selfPrepare, invocation);
    expect(JSON.parse(result.textResultForLlm)).toMatchObject({
      status: 'host-unavailable', verified: false, mutations: [], attemptedMutations: [],
    });
    expect(f.calls).toEqual([]);
  });

  it.each(['parent-session', 'native-agent'])('specialist preparation refuses $0 authority', async authority => {
    const f = fixture();
    const caller = authority === 'parent-session'
      ? { ...invocation, sessionId: 'parent-session' }
      : { ...invocation, agentId: 'native-agent' };
    expect((await call(f, 'onboard', selfPrepare, caller)).data.status).toBe('context-mismatch');
    expect(f.session.rpc.plugins.list).not.toHaveBeenCalled();
    expect(f.calls).toEqual([]);
  });

  it('refusal does not count as readiness or domain authorization and leaves unrelated member/state intact', async () => {
    const f = fixture({ consent: false });
    f.marketplaces.push({ name: 'my-tools', source: 'GitHub: user/my-tools' });
    f.plugins.push({ name: 'my-plugin', marketplace: 'my-tools', enabled: true });
    const before = structuredClone({ plugins: f.plugins, marketplaces: f.marketplaces });
    expect((await call(f, 'onboard', selfPrepare)).data).toMatchObject({
      status: 'declined', verified: false, guidanceLoadVerified: false, mutations: [], attemptedMutations: [],
    });
    expect({ plugins: f.plugins, marketplaces: f.marketplaces }).toEqual(before);
    expect(f.calls).toEqual(['consent']);
  });

  it('known provider skill exposure without a matched plugin record is inconsistent, not an install invitation', async () => {
    const f = fixture();
    f.skills.push({ name: 'agents-sdk-dotnet', enabled: true, source: 'plugin', pluginName: 'agents-for-dotnet' });
    const { data } = await call(f, 'onboard', selfPrepare);
    expect(data).toMatchObject({
      status: 'inventory-inconsistent', verified: false,
      providerInventory: { matchedPluginRecord: false, knownPluginSkillRows: 1 },
      mutations: [], attemptedMutations: [],
    });
    expect(f.calls).toEqual([]);
    expect(data.message).not.toContain('not installed');
  });

  it.each(['agents-for-dotnet@microsoft-agents-sdk', 'Agents-For-DotNet', 'dotnet-provider-renamed'])('unrecognized selected .NET provider representation %s blocks installs without loosening source checks', async name => {
    const f = fixture();
    f.marketplaces.push({ name: 'microsoft-agents-sdk', source: 'GitHub: microsoft/Agents' });
    f.plugins.push({ name, marketplace: 'microsoft-agents-sdk', enabled: true });
    const { data } = await call(f, 'onboard', selfPrepare);
    expect(data.status).toBe('inventory-inconsistent');
    expect(f.calls).toEqual([]);
    expect(JSON.stringify(data)).not.toContain(name);
  });

  it('qualified provider metadata without a reliable marketplace association cannot cause a duplicate install', async () => {
    const f = fixture();
    f.plugins.push({ name: 'agents-for-dotnet@microsoft-agents-sdk', marketplace: '', enabled: true });
    expect((await call(f, 'onboard', selfPrepare)).data.status).toBe('inventory-inconsistent');
    expect(f.calls).toEqual([]);
  });

  it('true missing means no matched observable session record, not proof of physical uninstall', async () => {
    const f = fixture();
    const { data } = await call(f, 'verify', { ...args, provider });
    expect(data.status).toBe('missing');
    expect(data.message).toContain('No matching provider record is observable in this session inventory');
    expect(data.message).not.toContain('not installed');
    expect(f.calls).toEqual([]);
  });

  it('self-init policy block, partial failure and unexposed post-install snapshot remain explicit', async () => {
    const managed = fixture({ installed: true, disabled: true });
    Object.assign(managed.plugins[0]!, { managed: true, managedDesiredEnabled: false });
    expect((await call(managed, 'onboard', selfPrepare)).data.status).toBe('policy-blocked');
    expect(managed.calls).toEqual([]);
    const partial = fixture();
    partial.session.rpc.plugins.install.mockRejectedValueOnce(new Error('Offline'));
    expect((await call(partial, 'onboard', selfPrepare)).data).toMatchObject({
      status: 'host-error', stage: 'install', verified: false, mutations: ['register-marketplace'],
    });
    expect((await call(partial, 'onboard', selfPrepare)).data.status).toBe('available');
    expect(partial.mutations).toEqual(['add', 'install']);
    expect(partial.session.ui.confirm).toHaveBeenCalledTimes(2);
    const notExposed = fixture();
    notExposed.session.rpc.skills.reload.mockImplementationOnce(async () => ({ errors: [], warnings: [] }));
    expect((await call(notExposed, 'onboard', selfPrepare)).data).toMatchObject({
      status: 'capability-unavailable', verified: false, guidanceLoadRequired: [], guidanceLoadVerified: false,
    });
  });

  it('new boundaries re-inspect skill overrides without reusing prior availability', async () => {
    const f = fixture({ installed: true });
    expect((await call(f, 'onboard', selfPrepare)).data.status).toBe('available');
    f.skills[0]!.enabled = false;
    expect((await call(f, 'onboard', selfPrepare)).data.status).toBe('capability-unavailable');
    expect(f.calls).toEqual([]);
  });

  it('a record explicitly reported not installed is contradictory evidence, not a permission to reinstall', async () => {
    const f = fixture({ installed: true, skillsNotExposed: true });
    f.plugins[0]!.installed = false;
    expect((await call(f, 'onboard', selfPrepare)).data.status).toBe('inventory-inconsistent');
    expect(f.calls).toEqual([]);
  });

  it('contradictory provider skill exposure arriving during confirmation blocks every configuration change', async () => {
    const f = fixture();
    f.session.ui.confirm.mockImplementationOnce(async () => {
      f.skills.push({ name: 'agents-sdk-dotnet', enabled: true, source: 'plugin', pluginName: 'agents-for-dotnet' });
      return true;
    });
    expect((await call(f, 'onboard', selfPrepare)).data.status).toBe('inventory-inconsistent');
    expect(f.mutations).toEqual([]);
    expect(f.calls).toEqual([]);
  });

  it('an existing provider disabled by another actor during registration is not enabled by specialist preparation', async () => {
    const f = fixture();
    f.session.rpc.plugins.marketplaces.add.mockImplementationOnce(async () => {
      f.calls.push('add');
      f.mutations.push('add');
      f.marketplaces.push({ name: 'microsoft-agents-sdk', source: 'GitHub: microsoft/Agents' });
      f.plugins.push({ name: 'agents-for-dotnet', marketplace: 'microsoft-agents-sdk', enabled: false });
      return { name: 'microsoft-agents-sdk' };
    });
    expect((await call(f, 'onboard', selfPrepare)).data).toMatchObject({
      status: 'disabled', verified: false, mutations: ['register-marketplace'],
    });
    expect(f.session.rpc.plugins.install).not.toHaveBeenCalled();
    expect(f.session.rpc.plugins.enable).not.toHaveBeenCalled();
    expect(f.calls).toEqual(['consent', 'add']);
  });

  it('foreground session replacement during host confirmation invalidates setup instead of reusing consent', async () => {
    const f = fixture();
    let current = f.session;
    const tools = (await import('../.squad-templates/extensions/squad-provider-onboarding/onboarding-tools.mjs'))
      .createM365OnboardingTools(() => current);
    f.session.ui.confirm.mockImplementationOnce(async () => {
      current = { ...f.session, sessionId: 'replacement-session' };
      return true;
    });
    const result = await tools[0].handler(selfPrepare, invocation);
    expect(JSON.parse(result.textResultForLlm)).toMatchObject({
      status: 'context-mismatch', verified: false, mutations: [], attemptedMutations: [],
    });
    expect(f.mutations).toEqual([]);
  });

  it('caller-supplied loaded-guidance hints cannot certify actual skill invocation', async () => {
    const f = fixture({ installed: true });
    const untrustedInput = { ...selfPrepare, guidanceLoadVerified: true, consent: true };
    const { data } = await call(f, 'onboard', untrustedInput);
    expect(data).toMatchObject({ status: 'available', guidanceLoadVerified: false, guidanceLoadRequired: ['agents-sdk-dotnet'] });
    expect(f.calls).toEqual([]);
  });

  it('project-local skill text or a file path alone does not constitute provider exposure or invocation', async () => {
    const f = fixture();
    f.skills.push({ name: 'agents-sdk-dotnet', enabled: true, source: 'project', pluginName: '' });
    const { data } = await call(f, 'verify', { ...args, provider });
    expect(data).toMatchObject({ status: 'missing', verified: false, guidanceLoadVerified: false, skillEvidence: [] });
    expect(f.calls).toEqual([]);
  });

  it('specialist-init schemas require the fixed declaration while preserving legacy profile-added without capability', async () => {
    const tools = await toolsFor(fixture().session);
    expect(tools[0].parameters.properties.event.enum).toEqual(['profile-added', 'specialist-initialization']);
    expect(tools[0].parameters.properties.provider.const).toBe(provider);
    expect(tools[0].parameters.allOf[0]).toMatchObject({
      if: { properties: { event: { const: 'specialist-initialization' } } },
      then: { required: ['provider'] }, else: { not: { required: ['capability'] } },
    });
    expect(tools[0].parameters.required).toEqual(['profile', 'member', 'event']);
    const legacy = fixture();
    expect((await call(legacy)).data).toMatchObject({
      status: 'available', event: 'profile-added', capability: 'development',
      specialistVerificationRequired: true, guidanceLoadVerified: false,
    });
    expect(legacy.calls[0]).toBe('consent');
  });

  it('actual tool JSON schemas enforce lifecycle/declaration and reject model-provided permission or loading fields', async () => {
    const f = fixture();
    const tools = await toolsFor(f.session);
    const ajv = new Ajv({ strict: false });
    const validate = ajv.compile(tools[0].parameters);
    expect(validate(args), JSON.stringify(validate.errors)).toBe(true);
    expect(validate(selfPrepare), JSON.stringify(validate.errors)).toBe(true);
    expect(validate({ ...selfPrepare, capability: 'otel' }), JSON.stringify(validate.errors)).toBe(true);
    for (const input of [
      { ...selfPrepare, provider: undefined },
      { ...selfPrepare, provider: 'https://untrusted.example/plugin' },
      { ...selfPrepare, event: 'task-start' },
      { ...selfPrepare, capability: 'arbitrary' },
      { ...args, capability: 'development' },
      { ...selfPrepare, consent: true },
      { ...selfPrepare, guidanceLoadVerified: true },
    ]) expect(validate(input), `unexpected schema acceptance: ${JSON.stringify(input)}`).toBe(false);
    expect(f.session.rpc.plugins.list).not.toHaveBeenCalled();
    expect(f.calls).toEqual([]);
  });
});

describe('M365 profile onboarding instruction contract (not an LLM behavior evaluation)', () => {
  it('does not vendor external provider skills during member addition', () => {
    const coordinator = readFileSync(join(canonical, 'squad.agent.md'), 'utf8');
    const adding = coordinator.split('### Adding Team Members')[1]!.split('### Removing Team Members')[0]!;
    expect(adding, 'member-add instructions still vendor host-owned plugins').not.toContain('copy the plugin content');
    expect(adding).toContain('Do not call verify/onboard or install at member addition');
    expect(coordinator.split('## Init Mode')[1]!.split('## Team Mode')[0]!).toContain('M365');
    const reference = readFileSync(join(canonical, 'plugin-marketplace.md'), 'utf8');
    expect(reference).toContain('squad_m365_profile_verify');
    expect(reference).toContain('Microsoft Agent Framework');
    expect(reference).toContain('agents-for-dotnet');
    expect(reference).toContain('Recommended base guidance');
    expect(reference).toContain('runtimeInventoryComplete');
    expect(reference).not.toContain('requires all six');
    expect(adding).toContain('recommended skills/provider');
    expect(adding).toContain('not mandatory dependencies');
    expect(adding).not.toContain('refresh-required');
    expect(adding).toContain('Do not call verify/onboard or install at member addition');
    expect(adding).toContain('Generated member recommendation section');
    expect(adding).toContain('Dispatch the actual authorized mission');
    const spawn = coordinator.split('### How to Spawn an Agent')[1]!.split('### ❌ What NOT')[0]!;
    expect(spawn).toContain('Recommended guidance block');
    expect(spawn).toContain('after its actual charter');
    expect(spawn).toContain('Missing optional bridge, provider evidence or skills');
    expect(spawn).toContain('Independent explicit repository/mission requirements');
    expect(reference).toContain('guidanceLoadVerified: false');
    expect(reference).toContain('skill tool');
    expect(reference).toContain('event: profile-added');
    expect(reference).toContain('"event": "specialist-initialization"');
    expect(reference).toContain('not proof of a physical uninstall');
  });

  it('generated optional recommendation survives actual charter compilation with responsibilities/model/deferred exercise preserved', () => {
    const reference = readFileSync(join(canonical, 'plugin-marketplace.md'), 'utf8').replace(/\r\n?/g, '\n');
    const declaration = reference.match(/```markdown\n(## X-External Provider[\s\S]+?)\n```/)?.[1];
    expect(declaration, 'generated declaration code block is missing').toBeDefined();
    const charter = [
      '# m365 — Microsoft 365 Engineer', '',
      '## Identity', '- **ID:** m365', '- **Purpose:** Build Microsoft 365 Agents SDK applications.', '',
      '## Accountable Responsibilities', '- SDK development in C#.', '',
      '## Non-Responsibilities', '- No automatic cloud provisioning or application generation.', '',
      '## Collaboration and Review Authority', '- Return unmet prerequisites to the coordinator.', '',
      '## Model', '- **Preferred:** auto', '',
      '## Onboarding Assignment', '- Deferred domain exercise: do not run without separate authorization.', '',
      declaration, '',
    ].join('\n');
    const compiled = compileCharterFull({
      agentName: 'm365', charterPath: '/repo/.squad/agents/m365/charter.md', charterContent: charter,
    });
    expect(compiled.prompt).toContain(declaration);
    expect(compiled.prompt).toContain('## Accountable Responsibilities\n- SDK development in C#.');
    expect(compiled.prompt).toContain('## Model\n- **Preferred:** auto');
    expect(compiled.prompt).toContain('Deferred domain exercise: do not run without separate authorization.');
    expect(compiled.prompt).toContain('**Recommended guidance:**');
    expect(compiled.prompt).toContain('**Default policy:** Optional and nonblocking');
    expect(compiled.prompt).toContain('independent explicit repository/mission obligations remain binding');
    expect(compiled.prompt).toContain('actual skill tool');
  });

  it('the inlined guidance block uses native skills without imposing provider inspection and preserves explicit requirements', () => {
    const reference = readFileSync(join(canonical, 'plugin-marketplace.md'), 'utf8').replace(/\r\n?/g, '\n');
    const block = reference.match(/```text\n(EXTERNAL_PROVIDER_PREPARATION[\s\S]+?)\n```/)?.[1] ?? '';
    expect(block).toContain('YOUR own foreground App project session');
    expect(block).not.toContain('bootstrap-blocked');
    expect(block).toContain('provider verification is not required merely to invoke them');
    expect(block).toContain('separate explicit user request');
    expect(block).toContain('shared host scope');
    expect(block).toContain('actual skill tool');
    expect(block).toContain('A SKILL.md file read or parent snapshot is not invocation');
    expect(block).toContain('An explicit repository or mission requirement remains binding');
    expect(reference).toContain('not deterministic Markdown-to-install resolution');
  });

  it('an independently required repo capability remains a real gate when the optional recommendation is compiled alongside it', () => {
    const reference = readFileSync(join(canonical, 'plugin-marketplace.md'), 'utf8').replace(/\r\n?/g, '\n');
    const declaration = reference.match(/```markdown\n(## X-External Provider[\s\S]+?)\n```/)?.[1] ?? '';
    const explicitRequirement = 'Repository requirement: Before editing C#, confirm the Microsoft SDK provider is installed and load SDK guidance. If evidence is unmet, pause C# changes.';
    const charter = [
      '# m365 — SDK Engineer', '', '## Identity', '- **ID:** m365', '- **Purpose:** Implement authorized SDK work.', '',
      '## Accountable Responsibilities', '- Governed C# implementation.', '',
      '## Non-Responsibilities', '- No permission or installation bypass.', '',
      '## Collaboration and Review Authority', explicitRequirement, '',
      '## Model', '- **Preferred:** auto', '', declaration, '',
    ].join('\n');
    const compiled = compileCharterFull({
      agentName: 'm365', charterPath: '/repo/.squad/agents/m365/charter.md', charterContent: charter,
    });
    expect(compiled.prompt).toContain(explicitRequirement);
    expect(compiled.prompt).toContain('Independent explicit repository/mission requirements still control the relevant action');
    expect(reference).toContain('unmet evidence blocks only the governed action');
    expect(reference).toContain('Already-issued mandatory mission prompts and charters are not silently changed');
    expect(reference).toContain('a preexisting user-owned requirement needs its own explicit');
  });
});

describe('M365 profile onboarding with mocked joined-session public APIs (no real plugin installation)', () => {
  it('absent provider: consent precedes registration/install and local skills are verified', async () => {
    const f = fixture();
    const { data, resultType } = await call(f);
    expect(f.calls).toEqual(['consent', 'add', 'install', 'reload', 'skills-reload']);
    expect(data).toMatchObject({
      status: 'available', sessionId: invocation.sessionId, member: args.member,
      provider, verified: true, specialistVerificationRequired: true, mutations: ['register-marketplace', 'install'],
    });
    expect(data.skills).toEqual(skillNames);
    expect(resultType).toBe('success');
    expect(f.session.ui.confirm.mock.calls[0]![0]).toContain('microsoft/Agents');
    expect(f.session.ui.confirm.mock.calls[0]![0]).toContain('host');
  });

  it('installed and exposed provider: no consent, reinstall, registration, or reload', async () => {
    const f = fixture({ installed: true });
    const { data } = await call(f);
    expect(data.status).toBe('available');
    expect(data.skills).toEqual(skillNames);
    expect(f.calls).toEqual([]);
    expect(f.mutations).toEqual([]);
  });

  it('supports the marketplace catalog name when the host retains it as the installed name', async () => {
    const f = fixture({ installed: true });
    f.plugins[0]!.name = 'agents-for-net';
    for (const skill of f.skills) skill.pluginName = 'agents-for-net';
    expect((await call(f)).data.status).toBe('available');
    expect(f.mutations).toEqual([]);
  });

  it('disabled provider: asks to enable it, without downloading or registering again', async () => {
    const f = fixture({ installed: true, disabled: true });
    expect((await call(f)).data.status).toBe('available');
    expect(f.calls).toEqual(['consent', 'enable', 'reload', 'skills-reload']);
    expect(f.mutations).toEqual(['enable']);
  });

  it.each([false, null, 'true'])('declined/cancelled/non-boolean consent %s never mutates configuration', async consent => {
    const f = fixture();
    f.session.ui.confirm.mockResolvedValueOnce(consent as boolean);
    const { data, resultType } = await call(f);
    expect(data.status).toBe('declined');
    expect(data.verified).toBe(false);
    expect(resultType).toBe('denied');
    expect(f.mutations).toEqual([]);
    expect(f.session.log).toHaveBeenCalled();
  });

  it('does not treat tool arguments as user consent', async () => {
    const f = fixture({ consent: false });
    await call(f, 'onboard', { ...args, consent: true } as typeof args);
    expect(f.session.ui.confirm).toHaveBeenCalledOnce();
    expect(f.mutations).toEqual([]);
  });

  it('missing public host APIs or elicitation returns a guided prerequisite, never a PATH CLI fallback', async () => {
    const f = fixture();
    f.session.capabilities.ui.elicitation = false;
    const { data } = await call(f);
    expect(data.status).toBe('host-unavailable');
    expect(data.action).toContain('same host');
    expect(f.mutations).toEqual([]);
    expect(f.session.ui.confirm).not.toHaveBeenCalled();
  });

  it('managed policy disabling the provider is explicit and cannot be bypassed by consent', async () => {
    const f = fixture({ installed: true, disabled: true });
    Object.assign(f.plugins[0]!, { managed: true, managedDesiredEnabled: false });
    const { data } = await call(f);
    expect(data.status).toBe('policy-blocked');
    expect(data.verified).toBe(false);
    expect(f.calls).toEqual([]);
    expect(f.mutations).toEqual([]);
  });

  it('managed desired-but-not-installed provider reports blocked reconciliation, not ready', async () => {
    const f = fixture({ installed: true, skillsNotExposed: true });
    Object.assign(f.plugins[0]!, { managed: true, installed: false, managedDesiredEnabled: true });
    expect((await call(f)).data.status).toBe('policy-blocked');
    expect(f.mutations).toEqual([]);
  });

  it('host repository-policy errors are surfaced at the enable stage without success-shaped fallback', async () => {
    const f = fixture({ installed: true, disabled: true });
    f.session.rpc.plugins.enable.mockRejectedValueOnce(new Error('Repository enabledPlugins policy denies activation'));
    const { data, resultType } = await call(f);
    expect(data).toMatchObject({ status: 'host-error', stage: 'enable', verified: false });
    expect(data.message).toContain('Repository enabledPlugins policy');
    expect(resultType).toBe('failure');
    expect(f.calls).toEqual(['consent']);
  });

  it('offline install failure retains registration and retry skips it without deleting prior user state', async () => {
    const f = fixture();
    f.marketplaces.push({ name: 'my-tools', source: 'GitHub: user/my-tools' });
    f.plugins.push({ name: 'my-plugin', marketplace: 'my-tools', enabled: false });
    f.session.rpc.plugins.install.mockRejectedValueOnce(new Error('Network unavailable'));
    const first = await call(f);
    expect(first.data).toMatchObject({ status: 'host-error', stage: 'install', verified: false, mutations: ['register-marketplace'] });
    expect(first.data.message).toContain('Network unavailable');
    expect(f.marketplaces).toContainEqual({ name: 'my-tools', source: 'GitHub: user/my-tools' });
    expect(f.plugins[0]).toEqual({ name: 'my-plugin', marketplace: 'my-tools', enabled: false });
    expect((await call(f)).data.status).toBe('available');
    expect(f.mutations).toEqual(['add', 'install']);
    expect(f.calls.filter(item => item === 'consent')).toHaveLength(2);
  });

  it('a conflicting marketplace identity cannot silently redirect trust', async () => {
    const f = fixture();
    f.marketplaces.push({ name: 'microsoft-agents-sdk', source: 'GitHub: stranger/Agents' });
    const { data } = await call(f);
    expect(data.status).toBe('source-conflict');
    expect(data.message).toContain('unexpected source');
    expect(JSON.stringify(data)).not.toContain('stranger/Agents');
    expect(f.calls).toEqual([]);
    expect(f.mutations).toEqual([]);
  });

  it('revalidates marketplace identity after consent and before any mutation', async () => {
    const f = fixture();
    f.session.ui.confirm.mockImplementationOnce(async () => {
      f.marketplaces.push({ name: 'microsoft-agents-sdk', source: 'GitHub: stranger/Agents' });
      return true;
    });
    expect((await call(f)).data.status).toBe('source-conflict');
    expect(f.mutations).toEqual([]);
  });

  it('changed activation authority invalidates earlier approval instead of silently authorizing a different action', async () => {
    const f = fixture({ installed: true, disabled: true });
    f.session.ui.confirm.mockImplementationOnce(async () => {
      f.plugins[0]!.enabled = true;
      return true;
    });
    const { data } = await call(f);
    expect(data.status).toBe('approval-stale');
    expect(data.verified).toBe(false);
    expect(f.mutations).toEqual([]);
  });

  it('a same-named direct/foreign installation is not overwritten or duplicated', async () => {
    const f = fixture();
    f.plugins.push({ name: 'agents-for-dotnet', marketplace: '', enabled: true });
    expect((await call(f)).data.status).toBe('source-conflict');
    expect(f.calls).toEqual([]);
    expect(f.mutations).toEqual([]);
  });

  it('checks the registration result and retained source before installing', async () => {
    const f = fixture();
    f.session.rpc.plugins.marketplaces.add.mockImplementationOnce(async () => {
      f.marketplaces.push({ name: 'different-marketplace', source: 'GitHub: microsoft/Agents' });
      return { name: 'different-marketplace' };
    });
    const { data } = await call(f);
    expect(data.status).toBe('source-conflict');
    expect(f.session.rpc.plugins.install).not.toHaveBeenCalled();
  });

  it('rejects a different plugin returned by host install and never enables it', async () => {
    const f = fixture();
    f.session.rpc.plugins.install.mockResolvedValueOnce({
      plugin: { name: 'different-plugin', marketplace: 'microsoft-agents-sdk', enabled: false }, skillsInstalled: 6,
    });
    expect((await call(f)).data.status).toBe('source-conflict');
    expect(f.session.rpc.plugins.enable).not.toHaveBeenCalled();
  });

  it('an installed provider whose skills are not exposed reports capability unavailability without diagnosing cache staleness', async () => {
    const f = fixture({ installed: true, skillsNotExposed: true });
    expect((await call(f)).data.status).toBe('capability-unavailable');
    expect(f.calls).toEqual([]);
    expect(f.mutations).toEqual([]);
    expect(f.session.ui.confirm).not.toHaveBeenCalled();
  });

  it('a cache reload that still lacks the core skill remains capability-unavailable', async () => {
    const f = fixture();
    f.session.rpc.skills.reload.mockImplementationOnce(async () => ({ errors: [], warnings: [] }));
    const { data } = await call(f);
    expect(data).toMatchObject({ status: 'capability-unavailable', verified: false, missingSkills: ['agents-sdk-dotnet'] });
    expect(data.action).toContain('Continue otherwise-authorized work');
  });

  it('matching names from another source or disabled skills do not prove provider availability', async () => {
    const f = fixture({ installed: true });
    f.skills[0]!.source = 'project';
    f.skills[1]!.enabled = false;
    f.skills[2]!.pluginName = 'unrelated-plugin';
    f.session.rpc.skills.reload.mockImplementationOnce(async () => ({ errors: [], warnings: [] }));
    const { data } = await call(f);
    expect(data.status).toBe('capability-unavailable');
    expect(data.missingSkills).toEqual(['agents-sdk-dotnet']);
    expect(data.missingOptionalSkills).toEqual(skillNames.slice(1, 3));
  });

  it('skill reload diagnostics are surfaced, not discarded as successful verification', async () => {
    const f = fixture();
    f.session.rpc.skills.reload.mockResolvedValueOnce({ errors: ['agents-sdk-dotnet: invalid frontmatter'], warnings: [] });
    const { data } = await call(f);
    expect(data.status).toBe('capability-unavailable');
    expect(data.reloadDiagnostics).toEqual({ errorCount: 1, warningCount: 0, errorSkills: ['agents-sdk-dotnet'] });
  });

  it('optional reload errors remain explicit without overriding actual core capability evidence', async () => {
    const f = fixture();
    f.session.rpc.skills.reload.mockImplementationOnce(async () => {
      f.skills.push({ name: 'agents-sdk-dotnet', enabled: true, source: 'plugin', pluginName: 'agents-for-dotnet' });
      return { errors: ['teams-sdk-to-agents-sdk-dotnet-migration: invalid frontmatter'], warnings: ['Optional skill loading failed'] };
    });
    const { data } = await call(f);
    expect(data).toMatchObject({
      status: 'available', verified: true, missingSkills: [],
      missingOptionalSkills: skillNames.slice(1), runtimeInventoryComplete: false,
      reloadDiagnostics: {
        errorCount: 1, warningCount: 1, errorSkills: ['teams-sdk-to-agents-sdk-dotnet-migration'],
      },
    });
    expect(data.warnings[0]).toContain('1 skill reload error(s) and 1 warning(s)');
    expect(f.session.log).toHaveBeenCalled();
  });

  it('reload diagnostics do not disclose unrelated skill names or personal host paths', async () => {
    const f = fixture();
    f.session.rpc.skills.reload.mockImplementationOnce(async () => {
      f.skills.push({ name: 'agents-sdk-dotnet', enabled: true, source: 'plugin', pluginName: 'agents-for-dotnet' });
      return {
        errors: ['C:\\Users\\private-user\\private-plugin\\other-skill: parse error'],
        warnings: ['private-org-only-skill is shadowed in private-config.json'],
      };
    });
    const { data } = await call(f);
    expect(data).toMatchObject({
      status: 'available', reloadDiagnostics: { errorCount: 1, warningCount: 1, errorSkills: [] },
    });
    expect(JSON.stringify(data)).not.toMatch(/private-user|private-plugin|other-skill|private-org|private-config/);
    expect(JSON.stringify(f.session.log.mock.calls)).not.toMatch(/private-user|private-plugin|other-skill|private-org|private-config/);
  });

  it('a provider setup result with no public cache refresh API is judged by current exposed core evidence', async () => {
    const f = fixture();
    const session = {
      ...f.session,
      rpc: { ...f.session.rpc, plugins: { ...f.session.rpc.plugins, reload: undefined } },
    };
    f.session.rpc.plugins.install.mockImplementationOnce(async input => {
      expect(input.source).toBe(provider);
      f.calls.push('install');
      f.mutations.push('install');
      const plugin = { name: 'agents-for-dotnet', marketplace: 'microsoft-agents-sdk', enabled: true };
      f.plugins.push(plugin);
      f.skills.push({ name: 'agents-sdk-dotnet', enabled: true, source: 'plugin', pluginName: 'agents-for-dotnet' });
      return { plugin, skillsInstalled: 1 };
    });
    const tools = await toolsFor(session);
    const result = await tools[0].handler(args, invocation);
    const data = JSON.parse(result.textResultForLlm);
    expect(data).toMatchObject({ status: 'available', verified: true, skills: ['agents-sdk-dotnet'], missingSkills: [] });
    expect(data.warnings).toContain('Provider setup completed, but public cache refresh APIs are unavailable. Availability is evaluated from current skill evidence, not assumed from installation.');
    expect(f.calls).toEqual(['consent', 'add', 'install']);
  });

  it('invalid reload diagnostics fail explicitly rather than returning a capability success-shaped fallback', async () => {
    const f = fixture();
    f.session.rpc.skills.reload.mockImplementationOnce(async () => JSON.parse('{"errors":null,"warnings":[]}'));
    const { data, resultType } = await call(f);
    expect(data).toMatchObject({ status: 'host-error', stage: 'reload', verified: false });
    expect(data.message).toContain('invalid skill reload diagnostics');
    expect(resultType).toBe('failure');
  });

  describe('capability-scoped readiness regressions against the executable provider helper', () => {
    it('core-only development is available without claiming complete optional inventory', async () => {
      const f = fixture({ installed: true });
      f.skills.splice(1);
      const { data, resultType } = await call(f);
      expect(data).toMatchObject({
        status: 'available', verified: true, capability: 'development',
        requiredSkills: ['agents-sdk-dotnet'], skills: ['agents-sdk-dotnet'],
        missingSkills: [], missingOptionalSkills: skillNames.slice(1),
        runtimeInventoryComplete: false, specialistVerificationRequired: true,
        providerAssociation: {
          catalogSpec: provider, installedName: 'agents-for-dotnet',
          marketplace: 'microsoft-agents-sdk', marketplaceSourceMatched: true,
        },
      });
      expect(data.skillEvidence).toEqual([{
        name: 'agents-sdk-dotnet', source: 'plugin', pluginName: 'agents-for-dotnet', enabled: true,
      }]);
      expect(data.skillIssues).toEqual(skillNames.slice(1).map(name => ({ name, required: false, reason: 'not-exposed' })));
      expect(resultType).toBe('success');
      expect(f.calls).toEqual([]);
      expect(f.mutations).toEqual([]);
    });

    it('the real five-skill snapshot is available for development but unavailable for Teams SDK migration', async () => {
      const f = fixture({ installed: true });
      f.skills.pop();
      const base = await call(f, 'verify');
      expect(base.data).toMatchObject({
        status: 'available', verified: true, capability: 'development',
        skills: skillNames.slice(0, -1), missingSkills: [],
        missingOptionalSkills: ['teams-sdk-to-agents-sdk-dotnet-migration'],
        runtimeInventoryComplete: false, specialistVerificationRequired: false,
      });
      const migration = await call(f, 'verify', { ...args, capability: 'teams-sdk-migration' });
      expect(migration.data).toMatchObject({
        status: 'capability-unavailable', verified: false, capability: 'teams-sdk-migration',
        requiredSkills: ['agents-sdk-dotnet', 'teams-sdk-to-agents-sdk-dotnet-migration'],
        missingSkills: ['teams-sdk-to-agents-sdk-dotnet-migration'],
        missingOptionalSkills: [],
        skillIssues: [{ name: 'teams-sdk-to-agents-sdk-dotnet-migration', required: true, reason: 'not-exposed' }],
      });
      expect(migration.resultType).toBe('failure');
      expect(f.calls).toEqual([]);
      expect(f.mutations).toEqual([]);
    });

    const specialized = Object.entries(capabilitySkills).flatMap(([capability, skill]) =>
      typeof skill === 'string' ? [[capability, skill]] : [],
    );
    it.each(specialized.flatMap(([capability, skill]) => [
      { capability, skill, state: 'not-exposed' },
      { capability, skill, state: 'disabled' },
      { capability, skill, state: 'source-mismatch' },
    ]))('$skill $state does not block development but blocks its $capability capability', async ({ capability, skill, state }) => {
      const f = fixture({ installed: true });
      const index = f.skills.findIndex(row => row.name === skill);
      if (state === 'not-exposed') f.skills.splice(index, 1);
      else if (state === 'disabled') f.skills[index]!.enabled = false;
      else f.skills[index]!.pluginName = 'foreign-provider';
      const base = await call(f, 'verify');
      expect(base.data).toMatchObject({ status: 'available', verified: true, missingSkills: [], missingOptionalSkills: [skill] });
      const specializedResult = await call(f, 'verify', { ...args, capability });
      expect(specializedResult.data).toMatchObject({
        status: 'capability-unavailable', verified: false,
        requiredSkills: ['agents-sdk-dotnet', skill], missingSkills: [skill],
        skillIssues: [{ name: skill, required: true, reason: state }],
      });
      expect(JSON.stringify(specializedResult.data)).not.toContain('foreign-provider');
      expect(f.calls).toEqual([]);
    });

    it.each(Object.keys(capabilitySkills).flatMap(capability => [
      { capability, state: 'disabled' },
      { capability, state: 'project' },
      { capability, state: 'foreign-plugin' },
      { capability, state: 'not-exposed' },
    ]))('invalid core $state blocks $capability even when every optional skill is present', async ({ capability, state }) => {
      const f = fixture({ installed: true });
      if (state === 'disabled') f.skills[0]!.enabled = false;
      else if (state === 'project') f.skills[0]!.source = 'project';
      else if (state === 'foreign-plugin') f.skills[0]!.pluginName = 'foreign-provider';
      else f.skills.shift();
      const { data } = await call(f, 'verify', { ...args, capability });
      expect(data).toMatchObject({
        status: 'capability-unavailable', verified: false, missingSkills: ['agents-sdk-dotnet'],
        skillIssues: [{
          name: 'agents-sdk-dotnet', required: true,
          reason: ['project', 'foreign-plugin'].includes(state) ? 'source-mismatch' : state,
        }],
      });
      expect(data.skillEvidence.some((row: { name: string }) => row.name === 'agents-sdk-dotnet')).toBe(false);
      expect(f.calls).toEqual([]);
    });

    it.each(['agents-for-dotnet', 'agents-for-net'])('returns actual observed %s provider association, not a flat-name assumption', async installedName => {
      const f = fixture({ installed: true });
      f.plugins[0]!.name = installedName;
      for (const row of f.skills) row.pluginName = installedName;
      const { data } = await call(f, 'verify');
      expect(data.providerAssociation).toEqual({
        catalogSpec: provider, installedName, marketplace: 'microsoft-agents-sdk', marketplaceSourceMatched: true,
      });
      expect(data.skillEvidence).toEqual(skillNames.map(name => ({
        name, source: 'plugin', pluginName: installedName, enabled: true,
      })));
      expect(data.runtimeInventoryComplete).toBe(true);
    });

    it.each(['unknown', '', null, 1, [], { development: true }, 'toString', '__proto__'])('rejects capability selector %j before any host I/O', async capability => {
      const f = fixture({ installed: true });
      expect((await call(f, 'verify', { ...args, capability })).data.status).toBe('invalid');
      expect(f.session.rpc.plugins.list).not.toHaveBeenCalled();
      expect(f.session.rpc.skills.list).not.toHaveBeenCalled();
      expect(f.session.rpc.plugins.marketplaces.list).not.toHaveBeenCalled();
      expect(f.session.log).not.toHaveBeenCalled();
      expect(f.calls).toEqual([]);
    });

    it('onboarding remains development-only and cannot be converted to a specialized task installer', async () => {
      const f = fixture();
      expect((await call(f, 'onboard', { ...args, capability: 'teams-sdk-migration' })).data.status).toBe('invalid');
      expect(f.session.rpc.plugins.list).not.toHaveBeenCalled();
      expect(f.calls).toEqual([]);
    });

    it('exposes a closed optional capability schema only on read-only verification', async () => {
      const f = fixture({ installed: true });
      const tools = await toolsFor(f.session);
      expect(tools[0].parameters.properties.capability.enum).toEqual(Object.keys(capabilitySkills));
      expect(tools[0].parameters.allOf[0].else).toEqual({ not: { required: ['capability'] } });
      expect(tools[1].parameters.properties.capability).toMatchObject({
        type: 'string', enum: Object.keys(capabilitySkills), default: 'development',
      });
      expect(tools[1].parameters.required).toEqual(['profile', 'member']);
      expect(f.calls).toEqual([]);
    });

    it('repeated absence in an older installed snapshot has unknown cause, not a guaranteed refresh remedy', async () => {
      const f = fixture({ installed: true, skillsNotExposed: true });
      f.plugins[0]!.version = '1.0.0';
      for (let pass = 0; pass < 2; pass++) {
        const { data } = await call(f, 'verify');
        expect(data).toMatchObject({
          status: 'capability-unavailable', verified: false,
          missingSkills: ['agents-sdk-dotnet'],
          skillIssues: skillNames.map(name => ({ name, required: name === 'agents-sdk-dotnet', reason: 'not-exposed' })),
        });
        expect(`${data.message} ${data.action}`).not.toMatch(/stale|refresh-required|refresh fixes|restart fixes/i);
      }
      expect(f.calls).toEqual([]);
      f.skills.push({ name: 'agents-sdk-dotnet', enabled: true, source: 'plugin', pluginName: 'agents-for-dotnet' });
      expect((await call(f, 'verify')).data.status).toBe('available');
      expect(f.calls).toEqual([]);
    });

    it('Bot Framework compat migration requires only core plus its own migration skill, not ActivityHandler modernization', async () => {
      const f = fixture({ installed: true });
      f.skills.splice(0, f.skills.length, ...f.skills.filter(row =>
        ['agents-sdk-dotnet', 'bf-to-agents-sdk-dotnet-migration'].includes(row.name),
      ));
      const { data } = await call(f, 'verify', { ...args, capability: 'bot-framework-migration' });
      expect(data).toMatchObject({
        status: 'available', verified: true,
        requiredSkills: ['agents-sdk-dotnet', 'bf-to-agents-sdk-dotnet-migration'],
        missingSkills: [],
      });
      expect(data.missingOptionalSkills).toContain('agents-sdk-dotnet-activityhandler-migration');
      expect(f.calls).toEqual([]);
    });
  });

  it('verification runs in the caller specialist session and never installs missing dependencies', async () => {
    const f = fixture();
    const { data } = await call(f, 'verify', { profile, member: args.member } as typeof args);
    expect(data).toMatchObject({ status: 'missing', sessionId: invocation.sessionId, verified: false });
    expect(f.calls).toEqual([]);
    expect(f.mutations).toEqual([]);
    const installed = fixture({ installed: true });
    expect((await call(installed, 'verify', { profile, member: args.member } as typeof args)).data)
      .toMatchObject({ status: 'available', sessionId: invocation.sessionId, verified: true });
  });

  it.each(['dotnet', 'microsoft-agent-framework', '', undefined])('unrelated profile %s never triggers installation', async candidate => {
    const f = fixture();
    expect((await call(f, 'onboard', { ...args, profile: candidate } as typeof args)).data.status).toBe('not-applicable');
    expect(f.calls).toEqual([]);
    expect(f.session.rpc.plugins.list).not.toHaveBeenCalled();
  });

  it('a normal task is not a profile-add event and never triggers installation', async () => {
    const f = fixture();
    expect((await call(f, 'onboard', { ...args, event: 'task-start' })).data.status).toBe('not-applicable');
    expect(f.calls).toEqual([]);
  });

  it('rejects cross-session and attributed native subagent calls instead of verifying a parent snapshot', async () => {
    const f = fixture({ installed: true });
    expect((await call(f, 'verify', args, { ...invocation, sessionId: 'parent-session' })).data.status).toBe('context-mismatch');
    expect((await call(f, 'onboard', args, { ...invocation, agentId: 'native-subagent' } as typeof invocation)).data.status).toBe('context-mismatch');
    expect(f.session.rpc.plugins.list).not.toHaveBeenCalled();
  });

  it('cancelled invocations cannot mutate, including cancellation while consent is open', async () => {
    const f = fixture();
    const controller = new AbortController();
    f.session.ui.confirm.mockImplementationOnce(async () => { controller.abort(); return true; });
    const { data } = await call(f, 'onboard', args, { ...invocation, signal: controller.signal } as typeof invocation);
    expect(data.status).toBe('cancelled');
    expect(f.mutations).toEqual([]);
  });

  it('factory construction/reload performs no RPC, prompts or configuration changes', async () => {
    const f = fixture();
    const tools = await toolsFor(f.session);
    expect(tools.map((tool: { name: string }) => tool.name)).toEqual(['squad_m365_profile_onboard', 'squad_m365_profile_verify']);
    expect(f.session.rpc.plugins.list).not.toHaveBeenCalled();
    expect(f.calls).toEqual([]);
  });

  it('serializes same-instance onboarding so concurrent calls cannot duplicate setup/consent', async () => {
    const f = fixture();
    const tools = await toolsFor(f.session);
    const onboard = tools[0]!;
    const results = await Promise.all([
      onboard.handler(args, invocation),
      onboard.handler(args, { ...invocation, toolCallId: 'call-2' }),
    ]);
    expect(results.map((value: { textResultForLlm: string }) => JSON.parse(value.textResultForLlm).status)).toEqual(['available', 'available']);
    expect(f.mutations).toEqual(['add', 'install']);
    expect(f.session.ui.confirm).toHaveBeenCalledOnce();
  });

  it('invalid host inventory and unsupported public methods fail explicitly without configuration mutation', async () => {
    const f = fixture();
    f.session.rpc.plugins.list.mockImplementationOnce(async () => JSON.parse('{"plugins":null}'));
    expect((await call(f)).data).toMatchObject({ status: 'host-error', verified: false });
    f.session.rpc.plugins.list.mockRejectedValueOnce(Object.assign(new Error('Method unavailable'), { code: -32601 }));
    expect((await call(f)).data).toMatchObject({ status: 'host-unavailable', verified: false });
    expect(f.mutations).toEqual([]);
    expect(f.session.log).toHaveBeenCalled();
  });
});

describe('M365 bridge template distribution (isolated temp project, not the user host)', () => {
  it('installs both user-owned companions and preserves customized files on retry', async () => {
    const { TEMPLATE_MANIFEST } = await import('../packages/squad-cli/src/cli/core/templates.js');
    const { ensureUserOwnedTemplates } = await import('../packages/squad-cli/src/cli/core/upgrade.js');
    const entries = TEMPLATE_MANIFEST.filter(entry => entry.source.startsWith('extensions/squad-provider-onboarding/'));
    expect(entries.map(entry => entry.source.split('/').at(-1)).sort()).toEqual(['extension.mjs', 'onboarding-tools.mjs']);
    for (const entry of entries) {
      expect(entry.destination).toBe(`../.github/${entry.source}`);
      expect(entry.overwriteOnUpgrade).toBe(false);
    }
    const dir = mkdtempSync(join(tmpdir(), 'squad-m365-onboarding-'));
    try {
      const templates = join(dir, 'templates');
      const project = join(dir, 'project');
      mkdirSync(project);
      cpSync(canonical, templates, { recursive: true });
      ensureUserOwnedTemplates(project, templates);
      const installed = join(project, '.github', 'extensions', 'squad-provider-onboarding');
      for (const name of ['extension.mjs', 'onboarding-tools.mjs']) {
        expect(existsSync(join(installed, name)), name).toBe(true);
        expect(readFileSync(join(installed, name), 'utf8')).toBe(readFileSync(join(extensionDir, name), 'utf8'));
      }
      writeFileSync(join(installed, 'extension.mjs'), '// customized by user\n');
      rmSync(join(installed, 'onboarding-tools.mjs'));
      vi.spyOn(console, 'log').mockImplementation(() => {});
      ensureUserOwnedTemplates(project, templates);
      expect(readFileSync(join(installed, 'extension.mjs'), 'utf8')).toBe('// customized by user\n');
      expect(readFileSync(join(installed, 'onboarding-tools.mjs'), 'utf8')).toBe(readFileSync(join(extensionDir, 'onboarding-tools.mjs'), 'utf8'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 15_000);
});

describe('executable source mutation checks (isolated mocks, not host installs)', () => {
  it.each([
    {
      name: 'bypassed host consent',
      from: "if (approved !== true) return await result('declined',",
      to: "if (false) return await result('declined',",
      options: { consent: false },
      check: (f: ReturnType<typeof fixture>, data: { status: string }) => {
        expect(data.status, 'declined onboarding must not pass the consent gate').toBe('declined');
        expect(f.mutations, 'declined onboarding must not mutate host configuration').toEqual([]);
      },
    },
    {
      name: 'required core evidence removed',
      from: 'const missingSkills = requiredSkills.filter(name =>',
      to: 'const missingSkills = [].filter(name =>',
      options: { installed: true, skillsNotExposed: true },
      check: (f: ReturnType<typeof fixture>, data: { status: string }) => {
        expect(data.status, 'installed metadata is not actual required core skill availability').toBe('capability-unavailable');
        expect(f.mutations).toEqual([]);
      },
    },
    {
      name: 'optional inventory enforced for development',
      from: 'const missingSkills = requiredSkills.filter(name =>',
      to: 'const missingSkills = SKILLS.filter(name =>',
      options: { installed: true, coreOnly: true },
      check: (f: ReturnType<typeof fixture>, data: { status: string }) => {
        expect(data.status, 'optional inventory gaps must not block valid core development guidance').toBe('available');
        expect(f.mutations).toEqual([]);
      },
    },
    {
      name: 'inconsistent inventory install guard removed',
      from: 'if ((!plugin && knownPluginSkillRows > 0) || unrecognizedSelectedProviderRows > 0 || plugin?.installed === false) {',
      to: 'if (false) {',
      options: { orphanedProviderSkill: true },
      check: (f: ReturnType<typeof fixture>, data: { status: string }) => {
        expect(data.status, 'known orphaned plugin skill exposure must block blind setup').toBe('inventory-inconsistent');
        expect(f.mutations).toEqual([]);
      },
    },
  ])('kills the $name mutant using the real helper source', async ({ from, to, options, check }) => {
    const source = readFileSync(join(extensionDir, 'onboarding-tools.mjs'), 'utf8');
    const mutated = source.replace(from, to);
    expect(mutated, `mutation target not found: ${from}`).not.toBe(source);
    const dir = mkdtempSync(join(tmpdir(), 'squad-provider-mutant-'));
    try {
      const path = join(dir, 'onboarding-tools.mjs');
      writeFileSync(path, mutated);
      const { createM365OnboardingTools } = await import(pathToFileURL(path).href);
      const f = fixture(options);
      const result = await createM365OnboardingTools(() => f.session)[0].handler(args, invocation);
      const data = JSON.parse(result.textResultForLlm);
      expect(() => check(f, data), 'the acceptance assertion must reject this real executable regression').toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
