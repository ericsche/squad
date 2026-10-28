import { afterEach, expect } from 'vitest';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { TerminalHarness } from '../harness.js';
import { StepDefinitions, registerStep } from '../support/runner.js';

/**
 * CLI step definitions for Gherkin acceptance tests.
 */
export function registerCLISteps(registry: StepDefinitions): void {
  const directories = new Set<string>();
  const harnesses = new Set<TerminalHarness>();
  const createDirectory = (): string => {
    const directory = mkdtempSync(join(tmpdir(), 'squad-e2e-'));
    directories.add(directory);
    return directory;
  };
  afterEach(async () => {
    for (const harness of harnesses) await harness.close();
    harnesses.clear();
    for (const directory of directories) rmSync(directory, { recursive: true, force: true });
    directories.clear();
  });

  async function run(args: string[], cwd: string): Promise<TerminalHarness> {
    if (!cwd) throw new Error('Missing isolated acceptance fixture directory');
    const harness = await TerminalHarness.spawnWithArgs(args, {
      cwd,
      env: { SQUAD_NO_PERSONAL: '1' },
    });
    harnesses.add(harness);
    await harness.waitForExit(15000);
    return harness;
  }
  // --- Given steps ---

  registerStep(
    'Given',
    /the current directory has a "(.+)" directory/,
    async (stepText, context) => {
      const match = stepText.match(/the current directory has a "(.+)" directory/);
      if (!match) throw new Error('Pattern match failed');

      const dirName = match[1];
      if (dirName !== '.squad') throw new Error(`Unsupported scaffold fixture: ${dirName}`);
      const directory = createDirectory();
      context.tempDir = directory;
      execFileSync('git', ['init', '--quiet'], { cwd: directory });
      const initialized = await run(['init', '--no-workflows', '--no-vscode-default', '--state-backend', 'local'], directory);
      expect(initialized.getExitCode(), initialized.getOutput()).toBe(0);
      await initialized.close();
      const dirPath = join(directory, dirName);

      if (!existsSync(dirPath)) {
        throw new Error(`Directory ${dirPath} does not exist`);
      }

      context.squadDirExists = true;
    },
    registry
  );

  registerStep(
    'Given',
    /a directory without a "\.squad" directory/,
    async (_stepText, context) => {
      const tempDir = createDirectory();
      context.tempDir = tempDir;
    },
    registry
  );

  // --- When steps ---

  registerStep(
    'When',
    /I run "(.+)" in the temp directory/,
    async (stepText, context) => {
      const match = stepText.match(/I run "(.+)" in the temp directory/);
      if (!match) throw new Error('Pattern match failed');

      const command = match[1];
      const args = command.replace(/^squad\s*/, '').split(/\s+/).filter(Boolean);
      const cwd = context.tempDir as string;

      const harness = await run(args, cwd);

      context.harness = harness;
      context.output = harness.getOutput();
      context.exitCode = harness.getExitCode();
    },
    registry
  );

  registerStep(
    'When',
    /I run "(.+)"/,
    async (stepText, context) => {
      const match = stepText.match(/I run "(.+)"/);
      if (!match) throw new Error('Pattern match failed');

      const command = match[1];
      const args = command.replace(/^squad\s*/, '').split(/\s+/).filter(Boolean);

      const cwd = typeof context.tempDir === 'string' ? context.tempDir : createDirectory();
      context.tempDir = cwd;
      const harness = await run(args, cwd);

      context.harness = harness;
      context.output = harness.getOutput();
      context.exitCode = harness.getExitCode();
    },
    registry
  );

  // --- Then steps ---

  registerStep(
    'Then',
    /the output does not contain "(.+)"/,
    async (stepText, context) => {
      const match = stepText.match(/the output does not contain "(.+)"/);
      if (!match) throw new Error('Pattern match failed');

      const unexpectedText = match[1];
      const output = context.output as string;

      expect(output).not.toContain(unexpectedText);
    },
    registry
  );

  registerStep(
    'Then',
    /the output contains "(.+)"/,
    async (stepText, context) => {
      const match = stepText.match(/the output contains "(.+)"/);
      if (!match) throw new Error('Pattern match failed');

      const expectedText = match[1];
      const output = context.output as string;

      expect(output).toContain(expectedText);
    },
    registry
  );

  registerStep(
    'Then',
    /the output matches pattern "(.+)"/,
    async (stepText, context) => {
      const match = stepText.match(/the output matches pattern "(.+)"/);
      if (!match) throw new Error('Pattern match failed');

      const pattern = match[1];
      const output = context.output as string;

      expect(output).toMatch(new RegExp(pattern));
    },
    registry
  );

  registerStep(
    'Then',
    /the exit code is (\d+)/,
    async (stepText, context) => {
      const match = stepText.match(/the exit code is (\d+)/);
      if (!match) throw new Error('Pattern match failed');

      const expectedCode = parseInt(match[1], 10);
      const exitCode = context.exitCode as number | null;

      expect(exitCode).toBe(expectedCode);
    },
    registry
  );

  registerStep(
    'Then',
    /the temp directory has no "(.+)" entry/,
    async (stepText, context) => {
      // Guards against regressions where a `--help` intercept misfires and
      // the underlying command still scaffolds files (e.g. `squad init --help`
      // writing `.squad/`, `.github/`, `.gitignore`).
      const match = stepText.match(/the temp directory has no "(.+)" entry/);
      if (!match) throw new Error('Pattern match failed');

      const entry = match[1];
      const tempDir = context.tempDir as string | undefined;
      if (!tempDir) {
        throw new Error('No temp directory in context — use the Given step that creates one');
      }
      const target = join(tempDir, entry);
      expect(
        existsSync(target),
        `expected no '${entry}' under temp dir but found ${target}`
      ).toBe(false);
    },
    registry
  );
}
