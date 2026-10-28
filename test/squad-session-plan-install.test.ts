import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

const fixture = vi.hoisted(() => ({ templatesDir: '' }));
vi.mock('../packages/squad-cli/src/cli/core/templates.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../packages/squad-cli/src/cli/core/templates.js')>();
  return { ...actual, getTemplatesDir: () => fixture.templatesDir };
});

import { TEMPLATE_MANIFEST } from '../packages/squad-cli/src/cli/core/templates.js';
import { ensureUserOwnedTemplates, runUpgrade } from '../packages/squad-cli/src/cli/core/upgrade.js';
import { runInit } from '../packages/squad-cli/src/cli/core/init.js';

const filenames = ['extension.mjs', 'plan-tools.mjs'];
const canonical = resolve('.squad-templates');
let sandbox: string;
let project: string;
let oldHome: string | undefined;

function installed(name: string): string {
  return join(project, '.github', 'extensions', 'squad-session-plan', name);
}

function assertInstalled(): void {
  for (const name of filenames) {
    expect(existsSync(installed(name)), `missing installed ${name}`).toBe(true);
    expect(readFileSync(installed(name), 'utf8')).toBe(
      readFileSync(join(fixture.templatesDir, 'extensions', 'squad-session-plan', name), 'utf8'),
    );
  }
}

function assertPlanDefaultsInstalled(): void {
  const agent = readFileSync(join(project, '.github', 'agents', 'squad.agent.md'), 'utf8').replace(/\r\n?/g, '\n');
  const bundled = readFileSync(join(canonical, 'squad.agent.md'), 'utf8').replace(/\r\n?/g, '\n');
  const plan = bundled.match(/### Visible Main-Session Plan[\s\S]*?(?=\n### )/)?.[0];
  expect(plan, 'missing canonical plan guidance').toBeDefined();
  expect(agent).toContain(plan!);
  expect(agent, 'installed defaults must use native SQL task state, not only Markdown').toContain('single authoritative task-state source');
}

beforeEach(() => {
  // OS temp + its own git root: init/upgrade must never resolve this real checkout.
  sandbox = mkdtempSync(join(tmpdir(), 'squad-session-plan-install-'));
  project = join(sandbox, 'project');
  mkdirSync(project);
  execFileSync('git', ['init', '--quiet'], { cwd: project });
  fixture.templatesDir = join(sandbox, 'templates');
  cpSync(canonical, fixture.templatesDir, { recursive: true });
  cpSync(join(canonical, 'squad.agent.md'), join(fixture.templatesDir, 'squad.agent.md.template'));
  oldHome = process.env.SQUAD_HOME_DIR_OVERRIDE;
  process.env.SQUAD_HOME_DIR_OVERRIDE = join(sandbox, 'home');
  mkdirSync(process.env.SQUAD_HOME_DIR_OVERRIDE);
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  if (oldHome === undefined) delete process.env.SQUAD_HOME_DIR_OVERRIDE;
  else process.env.SQUAD_HOME_DIR_OVERRIDE = oldHome;
  rmSync(sandbox, { recursive: true, force: true });
});

describe('current-session plan extension installation', () => {
  it('declares every extension file as user-owned at the discoverable project path', () => {
    const entries = TEMPLATE_MANIFEST.filter(entry => entry.source.startsWith('extensions/squad-session-plan/'));
    expect(entries.map(entry => entry.source.split('/').at(-1)).sort()).toEqual([...filenames].sort());
    for (const entry of entries) {
      expect(entry.destination).toBe(`../.github/${entry.source}`);
      expect(entry.overwriteOnUpgrade).toBe(false);
    }
  });

  it('installs all extension files through the shared init/upgrade ensure helper', () => {
    ensureUserOwnedTemplates(project, fixture.templatesDir);
    assertInstalled();
    expect(ensureUserOwnedTemplates(project, fixture.templatesDir)).toEqual([]);
  });

  it('preserves customized files, warns of differences, and restores only missing companions', () => {
    mkdirSync(join(project, '.github', 'extensions', 'squad-session-plan'), { recursive: true });
    writeFileSync(installed('extension.mjs'), '// user customization\n');
    const created = ensureUserOwnedTemplates(project, fixture.templatesDir);
    expect(readFileSync(installed('extension.mjs'), 'utf8')).toBe('// user customization\n');
    expect(created).toContain('../.github/extensions/squad-session-plan/plan-tools.mjs');
    expect(created).not.toContain('../.github/extensions/squad-session-plan/extension.mjs');
    expect(console.log).toHaveBeenCalledWith(expect.stringMatching(/squad-session-plan.*differs.*preserved/i));
  });

  it('squad init installs the native extension', async () => {
    await runInit(project);
    assertInstalled();
    assertPlanDefaultsInstalled();
  });

  it('squad init preserves an existing customized extension entry', async () => {
    mkdirSync(join(project, '.github', 'extensions', 'squad-session-plan'), { recursive: true });
    writeFileSync(installed('extension.mjs'), '// existing customized entry\n');
    await runInit(project);
    expect(readFileSync(installed('extension.mjs'), 'utf8')).toBe('// existing customized entry\n');
    expect(readFileSync(installed('plan-tools.mjs'), 'utf8')).toBe(
      readFileSync(join(canonical, 'extensions', 'squad-session-plan', 'plan-tools.mjs'), 'utf8'),
    );
  });

  it('does not report newline-only differences as customization or rewrite user files', () => {
    ensureUserOwnedTemplates(project, fixture.templatesDir);
    const content = readFileSync(installed('extension.mjs'), 'utf8').replace(/\r\n?/g, '\n').replace(/\n/g, '\r\n');
    writeFileSync(installed('extension.mjs'), content);
    ensureUserOwnedTemplates(project, fixture.templatesDir);
    expect(readFileSync(installed('extension.mjs'), 'utf8')).toBe(content);
    expect(console.log).not.toHaveBeenCalledWith(expect.stringMatching(/differs from the bundled template/));
  });

  // Real init + two upgrades can exceed the default 5s under parallel I/O load.
  it('squad upgrade installs a missing extension and preserves customizations on repeated upgrade', async () => {
    await runInit(project);
    rmSync(join(project, '.github', 'extensions'), { recursive: true, force: true });
    await runUpgrade(project);
    assertInstalled();
    assertPlanDefaultsInstalled();
    writeFileSync(installed('extension.mjs'), '// customized entry\n');
    writeFileSync(installed('plan-tools.mjs'), '// customized helper\n');
    await runUpgrade(project);
    expect(readFileSync(installed('extension.mjs'), 'utf8')).toBe('// customized entry\n');
    expect(readFileSync(installed('plan-tools.mjs'), 'utf8')).toBe('// customized helper\n');
  }, 15_000);

  it('canonical file set matches the manifest (no companion omitted from installation)', () => {
    expect(readdirSync(join(canonical, 'extensions', 'squad-session-plan')).sort()).toEqual([...filenames].sort());
  });
});

describe('cold-start team readiness through actual init', () => {
  const options = { includeWorkflows: false, includeVscodeDefault: false };
  const pendingMessage = 'Team not yet constituted. Squad will propose a team for your confirmation before starting domain work.';
  const configuredMessage = 'Existing specialist roster preserved.';
  const team = (rows: string, heading = 'Members') =>
    `# Custom team\n\n## ${heading}\n\n| Name | Role | Charter | Status |\n|---|---|---|---|\n${rows}\n`;
  const output = () => vi.mocked(console.log).mock.calls.flat().join('\n').replace(/\x1b\[[0-9;]*m/g, '');

  it('reports pending formation for a scaffold while preserving project instructions and skills', async () => {
    const instructions = '# Existing project instructions\nKeep the current architecture.\n';
    const skill = '---\nname: project-guide\ndescription: Existing project guide.\n---\nKeep this skill.\n';
    mkdirSync(join(project, '.github', 'skills', 'project-guide'), { recursive: true });
    writeFileSync(join(project, '.github', 'copilot-instructions.md'), instructions);
    writeFileSync(join(project, '.github', 'skills', 'project-guide', 'SKILL.md'), skill);

    await runInit(project, options);

    const roster = readFileSync(join(project, '.squad', 'team.md'), 'utf8');
    expect(roster).toMatch(/## Members\s+\| Name \| Role \| Charter \| Status \|\s+\|[-|]+\|\s+## Project Context/);
    const registry = JSON.parse(readFileSync(join(project, '.squad', 'casting', 'registry.json'), 'utf8'));
    expect(registry.agents).toEqual({});
    expect(readFileSync(join(project, '.github', 'copilot-instructions.md'), 'utf8')).toBe(instructions);
    expect(readFileSync(join(project, '.github', 'skills', 'project-guide', 'SKILL.md'), 'utf8')).toBe(skill);
    expect(output()).toContain('Squad files installed.');
    expect(output()).toContain(pendingMessage);
    expect(output()).not.toContain(configuredMessage);
    expect(output()).not.toMatch(/Team (?:hired|ready)/);
  });

  it.each([
    ['empty roster', ''],
    ['support and coding-agent rows only', [
      '| Squad | Coordinator | - | Active |',
      '| Scribe | Durable Decision Merger | - | Active |',
      '| Ralph | Work Monitor | - | Active |',
      '| Rai | RAI Reviewer | - | Active |',
      '| Fact Checker | Fact Checker | - | Active |',
      '| @copilot | Coding Agent | - | Active |',
    ].join('\n')],
    ['inactive specialist', '| Nori | Developer | .squad/agents/nori/charter.md | Retired |'],
  ])('does not confuse %s with a constituted team on re-init', async (_name, rows) => {
    await runInit(project, options);
    const content = team(rows);
    writeFileSync(join(project, '.squad', 'team.md'), content);
    vi.mocked(console.log).mockClear();

    await runInit(project, options);

    expect(readFileSync(join(project, '.squad', 'team.md'), 'utf8')).toBe(content);
    expect(output()).toContain(pendingMessage);
    expect(output()).not.toContain(configuredMessage);
  }, 15_000);

  it.each(['Members', 'Team Roster'])('preserves an existing populated %s team without calling it pending', async heading => {
    await runInit(project, options);
    const content = team('| Nori | Developer | .squad/agents/nori/charter.md | Active |', heading);
    const routing = '# Custom routing\n\n## Routing Table\n\n| Work Type | Route To | Examples |\n|---|---|---|\n| Implementation | Nori | code |\n';
    const charter = '# Nori\n\n## What I Own\n\nImplementing code.\n';
    writeFileSync(join(project, '.squad', 'team.md'), content);
    writeFileSync(join(project, '.squad', 'routing.md'), routing);
    mkdirSync(join(project, '.squad', 'agents', 'nori'), { recursive: true });
    writeFileSync(join(project, '.squad', 'agents', 'nori', 'charter.md'), charter);
    vi.mocked(console.log).mockClear();

    await runInit(project, options);

    expect(output()).toContain(configuredMessage);
    expect(output()).not.toContain(pendingMessage);
    expect(readFileSync(join(project, '.squad', 'team.md'), 'utf8')).toBe(content);
    expect(readFileSync(join(project, '.squad', 'routing.md'), 'utf8')).toBe(routing);
    expect(readFileSync(join(project, '.squad', 'agents', 'nori', 'charter.md'), 'utf8')).toBe(charter);
  }, 15_000);

  it('uses the linked team roster instead of labelling an empty project scaffold pending', async () => {
    await runInit(project, options);
    const shared = join(sandbox, 'shared-team', '.squad');
    cpSync(join(project, '.squad'), shared, { recursive: true });
    writeFileSync(join(shared, 'team.md'), team('| Nori | Developer | - | Active |'));
    const configPath = join(project, '.squad', 'config.json');
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    writeFileSync(configPath, JSON.stringify({ ...config, teamRoot: join(sandbox, 'shared-team') }));
    vi.mocked(console.log).mockClear();

    await runInit(project, options);

    expect(output()).toContain(configuredMessage);
    expect(output()).not.toContain(pendingMessage);
    expect(readFileSync(join(shared, 'team.md'), 'utf8')).toContain('Nori');
  }, 15_000);

  it('does not label a preserved populated legacy .ai-team roster pending', async () => {
    await runInit(project, options);
    const content = team('| Nori | Developer | - | Active |', 'Team Roster');
    writeFileSync(join(project, '.squad', 'team.md'), content);
    renameSync(join(project, '.squad'), join(project, '.ai-team'));
    vi.mocked(console.log).mockClear();

    await runInit(project, options);

    expect(output()).toContain(configuredMessage);
    expect(output()).not.toContain(pendingMessage);
    expect(readFileSync(join(project, '.ai-team', 'team.md'), 'utf8')).toBe(content);
  }, 15_000);
});
