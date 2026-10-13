import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
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
