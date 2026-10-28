import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { parse } from 'yaml';
import {
  CONTRACT_DESTINATION,
  OWNERSHIP_DESTINATION,
  UNOWNED_MUTABLE_ROUTER_SKILL,
  WORKFLOW_NAMES,
  materializeRuntime,
  compileWithPinnedActions,
  verifyInstall,
  verifyStagedInstall,
  workflowWithSource,
  verifyStagedObjects,
} from '../workflows/shared/squad-install-verifier.mjs';
import { createFirstInstallFixture } from './helpers/gh-aw-install-fixture.js';

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return { ...actual, spawnSync: vi.fn(actual.spawnSync) };
});

const revision = 'a'.repeat(40);
const roots: string[] = [];
const verifier = resolve('workflows/shared/squad-install-verifier.mjs');

function git(root: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' });
}

function write(root: string, path: string, content: string | Buffer): void {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), content);
}

function consumer(): string {
  const root = mkdtempSync(join(tmpdir(), 'squad-install-staging-'));
  roots.push(root);
  git(root, 'init', '--quiet');
  git(root, 'config', 'core.autocrlf', 'false');
  const fixture = createFirstInstallFixture(revision, 'package');
  for (const [path, content] of fixture.consumerFiles) write(root, path, content);
  write(root, OWNERSHIP_DESTINATION, `${JSON.stringify(fixture.provenance, null, 2)}\n`);
  write(root, '.gitattributes', '* -text\n');
  write(root, '.gitignore', 'packages/\nlogs/\n*.local\n');
  write(root, '.github/aw/packages/unrelated.json', '{"private":true}\n');
  write(root, 'packages/unrelated.txt', 'ignored consumer file\n');
  write(root, '.github/aw/logs/private.log', 'ignored diagnostic\n');
  write(root, '.github/skills/secret.local', 'ignored local file\n');
  materializeRuntime(root);
  git(root, 'add', '--', '.gitattributes', '.github/aw/', '.github/workflows/', '.github/skills/');
  return root;
}

function stagedPaths(root: string): string[] {
  return git(root, 'ls-files', '-z').split('\0').filter(Boolean).sort();
}

function seedUnownedMutableRouter(root: string): void {
  write(root, UNOWNED_MUTABLE_ROUTER_SKILL, [
    '---',
    'name: agentic-workflows',
    '---',
    '',
    'Load mutable prompts from the current github/gh-aw repository.',
    '',
  ].join('\n'));
}

afterEach(() => {
  vi.clearAllMocks();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
}, 45_000);

describe('workflow source binding across checkout line endings', () => {
  it.each(['\n', '\r\n'])('preserves every original byte except the inserted source with %j', (eol) => {
    const original = ['---', 'on: workflow_dispatch', 'permissions: {}', '---', '', 'Keep the body.', ''].join(eol);
    const bound = workflowWithSource(original, 'squad', revision, false);
    const inserted = `${eol}source: bradygaster/squad/workflows/package/squad.md@${revision}`;
    expect(bound).toBe(original.replace(`${eol}---${eol}`, `${inserted}${eol}---${eol}`));
    expect(bound.replace(inserted, '')).toBe(original);
  });

  it.each(['body only', '---\nunterminated', '---\r\nunterminated'])('rejects malformed frontmatter %j', (content) => {
    expect(() => workflowWithSource(content, 'squad', revision, false)).toThrow(/frontmatter/);
  });
});

describe('bounded staged object batch transport', () => {
  it('reads exact binary, NUL, Unicode, newline and empty blobs once and rejects malformed responses', async () => {
    const root = mkdtempSync(join(tmpdir(), 'squad-object-batch-'));
    roots.push(root);
    git(root, 'init', '--quiet');
    const contents = [Buffer.alloc(0), Buffer.from([0, 10, 255, 13, 0]),
      Buffer.from('Unicode 雪\nembedded\nheaders blob 0\r\n')];
    const blobs = contents.map((content, index) => ({
      path: `required-${index}`,
      object: execFileSync('git', ['hash-object', '-w', '--stdin'], { cwd: root, input: content, encoding: 'utf8' }).trim(),
      size: content.length,
      digest: createHash('sha256').update(content).digest('hex'),
    }));
    const actual = await vi.importActual<typeof import('node:child_process')>('node:child_process');
    vi.mocked(spawnSync).mockClear();
    expect(() => verifyStagedObjects(root, blobs)).not.toThrow();
    expect(spawnSync).toHaveBeenCalledTimes(1);
    expect(vi.mocked(spawnSync).mock.calls[0][1]).toEqual(['cat-file', '--batch']);
    const frame = (index: number) => Buffer.concat([
      Buffer.from(`${blobs[index].object} blob ${blobs[index].size}\n`), contents[index], Buffer.from('\n'),
    ]);
    const valid = Buffer.concat(contents.map((_, index) => frame(index)));
    for (const response of [
      Buffer.alloc(0),
      valid.subarray(0, valid.length - 1),
      Buffer.concat([valid, Buffer.from('extra\n')]),
      Buffer.concat([frame(1), frame(0), frame(2)]),
      Buffer.concat([frame(0), frame(0), frame(2)]),
      Buffer.from(`${blobs[0].object} missing\n`),
      Buffer.from(`${blobs[0].object} tree 0\n\n`),
      Buffer.from(`${blobs[0].object} blob 1\nx\n`),
      Buffer.concat([Buffer.from(`${'a'.repeat(40)} blob 0\n\n`), frame(1), frame(2)]),
      Buffer.from('unterminated'),
    ]) {
      vi.mocked(spawnSync).mockImplementationOnce(() => ({
        status: 0, stdout: response, stderr: Buffer.alloc(0),
      }) as ReturnType<typeof spawnSync>);
      expect(() => verifyStagedObjects(root, blobs)).toThrow();
    }
    expect(() => verifyStagedObjects(root, [{ ...blobs[0], object: `${blobs[0].object}\nHEAD` }])).toThrow(/request/);
    expect(() => verifyStagedObjects(root, [{ ...blobs[0], size: -1 }])).toThrow(/request/);
    vi.mocked(spawnSync).mockImplementation(actual.spawnSync);
  });
});

describe('gh-aw: verified ownership staging under consumer ignore rules', () => {
  beforeAll(() => {
    // Compile the real eight-workflow fixture once, outside the per-gate budget.
    createFirstInstallFixture(revision, 'package');
  }, 120_000);

  it('installs a coherent reset-capable package and excludes only the named historical Cast', async () => {
    const root = consumer();
    const reset = {
      schema: 'squad-bootstrap-reset/v1', id: 'retry-1',
      archived_pull_requests: [3], archived_issues: [],
    };
    write(root, '.squad/bootstrap-reset.json', JSON.stringify(reset));
    git(root, 'add', '--', '.squad/bootstrap-reset.json');
    git(root, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid',
      '-c', 'core.hooksPath=/dev/null', 'commit', '--quiet', '-m', 'reviewed reset preparation');
    expect(verifyInstall(root, { expectedRevision: revision }).failures).toEqual([]);
    const installed = await import(pathToFileURL(join(root,
      '.github/workflows/shared/squad-bootstrap-validator.mjs')).href);
    const lock = parse(readFileSync(join(root, '.github/workflows/squad-bootstrap.lock.yml'), 'utf8'));
    expect(lock.on.workflow_dispatch.inputs.fresh_start.type).toBe('string');
    const writer = lock.jobs.materialize_bootstrap.steps.find(
      (step: { name?: string }) => step.name === 'Validate and materialize both artifacts',
    );
    expect(writer.env.SQUAD_BOOTSTRAP_FRESH_START).toBe('${{ inputs.fresh_start }}');
    expect(writer.with.script).toContain('stateModule.authorizeBootstrapReset');
    expect(writer.with.script).toContain('...resetState');
    expect(installed.readBootstrapReset(root)).toEqual(reset);
    expect(installed.hasCommittedBootstrapTeam(root)).toBe(false);
    const state = {
      reset, repository: 'octo/example', defaultBranch: 'main', issues: [],
      pullRequests: [{
        number: 3, title: '[squad] Cast your Squad', state: 'closed', merged_at: null,
        head: { ref: 'squad/bootstrap-cast', repo: { full_name: 'octo/example' } },
        base: { ref: 'main', repo: { full_name: 'octo/example' } },
      }],
    };
    expect(installed.classifyBootstrapState(state).action).toBe('reset_armed');
    expect(installed.classifyBootstrapState({ ...state, resetAuthorized: true }).action).toBe('create_both');
    expect(installed.classifyBootstrapState({ ...state, reset: null }).action).toBe('opt_out');
  });

  it('bounds staged reads to required paths in a large unrelated consumer tree', () => {
    const root = consumer();
    const unrelated = 'consumer-data';
    for (let index = 0; index < 20_000; index += 1) {
      write(root, `${unrelated}/ordinary-file-${index.toString().padStart(5, '0')}.txt`, 'consumer content\n');
    }
    git(root, 'add', '--', unrelated);
    git(root, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid',
      '-c', 'core.hooksPath=/dev/null', 'commit', '--quiet', '-m', 'large consumer baseline');
    write(root, `${unrelated}/ordinary-file-00000.txt`, 'unstaged consumer edit\n');
    write(root, `${unrelated}/untracked.txt`, 'untracked consumer content\n');
    const before = stagedPaths(root);
    const tree = git(root, 'write-tree').trim();
    const unbounded = spawnSync('git', ['ls-tree', '-r', '-z', tree], { cwd: root });
    expect(unbounded.error).toMatchObject({ code: 'ENOBUFS' });
    const manifest = JSON.parse(readFileSync(join(root, CONTRACT_DESTINATION), 'utf8'));
    const required = [
      CONTRACT_DESTINATION,
      OWNERSHIP_DESTINATION,
      ...manifest.workflows.flatMap((entry: { destination: string; lock: string }) =>
        [entry.destination, entry.lock]),
      ...manifest.shared_runtime.flatMap((entry: { package_destination: string; destination: string }) =>
        [entry.package_destination, entry.destination]),
      ...manifest.skills.map((entry: { destination: string }) => entry.destination),
    ];
    const spawn = vi.mocked(spawnSync);
    spawn.mockClear();
    expect(verifyStagedInstall(root, { expectedRevision: revision, stageOwnership: true }).failures).toEqual([]);
    const queries = spawn.mock.calls.filter(([command, args]) => command === 'git' && args?.[0] === 'ls-tree');
    expect(queries).toHaveLength(1);
    expect(queries[0][1]).toEqual([
      'ls-tree', '-z', expect.any(String), '--', ...new Set(required),
      '.github/workflows/aw.json', UNOWNED_MUTABLE_ROUTER_SKILL,
    ]);
    const unrelatedObject = git(root, 'rev-parse', `HEAD:${unrelated}/ordinary-file-00000.txt`).trim();
    const blobReads = spawn.mock.calls.filter(([command, args]) => command === 'git' && args?.[0] === 'cat-file');
    expect(blobReads).toHaveLength(1);
    expect(blobReads[0][1]).toEqual(['cat-file', '--batch']);
    const batchOptions = blobReads[0][2] as { input: string; maxBuffer: number };
    expect(batchOptions.input.trim().split('\n')).toHaveLength(new Set(required).size);
    expect(batchOptions.input).not.toContain(unrelatedObject);
    expect(batchOptions.maxBuffer).toBeGreaterThan(0);
    expect(stagedPaths(root)).toEqual([...before, OWNERSHIP_DESTINATION].sort());
    expect(git(root, 'diff', '--cached', '--name-only').trim()).toBe(OWNERSHIP_DESTINATION);
    expect(git(root, 'diff', '--name-only').trim()).toBe(`${unrelated}/ordinary-file-00000.txt`);
    expect(readFileSync(join(root, unrelated, 'untracked.txt'), 'utf8')).toBe('untracked consumer content\n');
  }, 90_000);

  it('reproduces the silent omission, then force-stages only the exact required JSON', () => {
    const root = consumer();
    expect(verifyInstall(root, { expectedRevision: revision }).failures).toEqual([]);
    const before = stagedPaths(root);
    expect(before).not.toContain(OWNERSHIP_DESTINATION);
    expect(verifyStagedInstall(root).failures.join('\n')).toContain(
      `Required file is missing from staged tree: ${OWNERSHIP_DESTINATION}`,
    );

    expect(verifyStagedInstall(root, { expectedRevision: revision, stageOwnership: true }).failures).toEqual([]);
    expect(stagedPaths(root)).toEqual([...before, OWNERSHIP_DESTINATION].sort());
    expect(git(root, 'show', `:${OWNERSHIP_DESTINATION}`))
      .toBe(readFileSync(join(root, OWNERSHIP_DESTINATION), 'utf8'));
    for (const path of [
      '.github/aw/packages/unrelated.json', 'packages/unrelated.txt',
      '.github/aw/logs/private.log', '.github/skills/secret.local',
    ]) expect(stagedPaths(root)).not.toContain(path);
    expect(verifyStagedInstall(root, { stageOwnership: true }).failures).toEqual([]);

    git(root, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid',
      '-c', 'core.hooksPath=/dev/null', 'commit', '--quiet', '-m', 'fixture install');
    expect(git(root, 'diff', '--cached', '--name-only')).toBe('');
    expect(verifyStagedInstall(root).failures).toEqual([]);
  });

  it('fails closed on malformed, truncated or extra batch object data', async () => {
    const root = consumer();
    expect(verifyStagedInstall(root, { stageOwnership: true }).failures).toEqual([]);
    const actual = await vi.importActual<typeof import('node:child_process')>('node:child_process');
    const corruptions = [
      (bytes: Buffer) => Buffer.from(bytes.toString('utf8').replace(' blob ', ' tree ')),
      (bytes: Buffer) => bytes.subarray(0, bytes.length - 1),
      (bytes: Buffer) => Buffer.concat([bytes, Buffer.from('unexpected\n')]),
    ];
    for (const corrupt of corruptions) {
      vi.mocked(spawnSync).mockImplementation((command, args, options) => {
        const result = actual.spawnSync(command, args, options);
        if (command === 'git' && args?.[0] === 'cat-file') {
          return { ...result, stdout: corrupt(result.stdout as Buffer) };
        }
        return result;
      });
      expect(verifyStagedInstall(root).failures).not.toEqual([]);
    }
    vi.mocked(spawnSync).mockImplementation(actual.spawnSync);
    expect(verifyStagedInstall(root).failures).toEqual([]);
  }, 15_000);

  it('runs the shipped CLI gate successfully and returns nonzero when metadata is missing', () => {
    const root = consumer();
    const args = [verifier, '--verify-staged-install', '--stage-ownership', '--source-revision', revision];
    expect(spawnSync(process.execPath, args, { cwd: root }).status).toBe(0);
    rmSync(join(root, OWNERSHIP_DESTINATION));
    const failed = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8' });
    expect(failed.status).toBe(1);
    expect(failed.stderr).toContain('do not commit/push');
    expect(failed.stderr).toMatch(/ownership record|ownership metadata/);
  });

  it('requires the exact consumer expiry configuration in the staged tree', () => {
    const root = consumer();
    const path = '.github/workflows/aw.json';
    const config = JSON.stringify({ maintenance: { action_failure_issue_expires: 24 } });
    write(root, path, config);
    compileWithPinnedActions(root);
    git(root, 'add', '--', '.github/workflows/');
    expect(verifyStagedInstall(root, { stageOwnership: true }).failures).toEqual([]);
    write(root, path, `${config}\n`);
    expect(verifyInstall(root).failures).toEqual([]);
    expect(verifyStagedInstall(root).failures.join('\n')).toContain(`Staged digest mismatch for ${path}`);
    git(root, 'add', '--', path);
    expect(verifyStagedInstall(root).failures).toEqual([]);

    rmSync(join(root, path));
    compileWithPinnedActions(root);
    git(root, 'add', '--', ...WORKFLOW_NAMES.map(name => `.github/workflows/${name}.lock.yml`));
    expect(verifyInstall(root).failures).toEqual([]);
    expect(verifyStagedInstall(root).failures.join('\n')).toContain(
      `Unverified compiler configuration remains in staged tree: ${path}`,
    );
    git(root, 'add', '--', path);
    expect(verifyStagedInstall(root).failures).toEqual([]);
  }, 120_000);

  it('rejects the clean-install gh-aw router until it is removed, then accepts the exact Squad skill', () => {
    const root = consumer();
    seedUnownedMutableRouter(root);
    const args = [verifier, '--verify-install', '--source-revision', revision];
    const rejected = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8' });
    expect(rejected.status).toBe(1);
    expect(rejected.stderr).toContain(
      `Unowned mutable gh-aw router skill must be removed: ${UNOWNED_MUTABLE_ROUTER_SKILL}`,
    );
    expect(rejected.stderr).toContain([
      'Safe recovery:',
      `  gh aw add bradygaster/squad/workflows@${revision} --force`,
      `  rm -f ${UNOWNED_MUTABLE_ROUTER_SKILL}`,
      '  gh aw compile --strict',
      '  node .github/workflows/shared/squad-install-verifier.mjs --verify-install --strict-compile',
    ].join('\n'));

    rmSync(join(root, UNOWNED_MUTABLE_ROUTER_SKILL));
    const accepted = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8' });
    expect(accepted.status, accepted.stderr).toBe(0);
    expect(readFileSync(join(root, '.github/skills/gh-aw-enlistment/SKILL.md')))
      .toEqual(readFileSync(resolve('workflows/skills/gh-aw-enlistment/SKILL.md')));
  });

  it('accepts an explicitly staged router deletion and rejects an unstaged retained index entry', () => {
    const root = consumer();
    seedUnownedMutableRouter(root);
    git(root, 'add', '--', UNOWNED_MUTABLE_ROUTER_SKILL);
    git(root, 'add', '--force', '--', OWNERSHIP_DESTINATION);
    git(root, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid',
      '-c', 'core.hooksPath=/dev/null', 'commit', '--quiet', '-m', 'pre-existing gh-aw scaffold');

    rmSync(join(root, UNOWNED_MUTABLE_ROUTER_SKILL));
    expect(verifyInstall(root).failures).toEqual([]);
    expect(verifyStagedInstall(root).failures.join('\n')).toContain(
      `Unowned mutable gh-aw router skill remains in staged tree: ${UNOWNED_MUTABLE_ROUTER_SKILL}`,
    );

    git(root, 'add', '--', UNOWNED_MUTABLE_ROUTER_SKILL);
    expect(verifyStagedInstall(root).failures).toEqual([]);
    expect(git(root, 'diff', '--cached', '--diff-filter=D', '--name-only').trim())
      .toBe(UNOWNED_MUTABLE_ROUTER_SKILL);
    expect(stagedPaths(root)).not.toContain(UNOWNED_MUTABLE_ROUTER_SKILL);
    expect(stagedPaths(root)).toContain('.github/skills/gh-aw-enlistment/SKILL.md');
  });

  it('rejects a mutated Squad-owned enlistment skill after removing the tool-owned router', () => {
    const root = consumer();
    write(root, '.github/skills/gh-aw-enlistment/SKILL.md', 'mutated\n');
    expect(verifyInstall(root).failures.join('\n')).toContain(
      'Installed digest mismatch for .github/skills/gh-aw-enlistment/SKILL.md',
    );
  });

  it('fails clearly when Git cannot force-stage the required ignored metadata', () => {
    const root = consumer();
    write(root, '.git/index.lock', 'locked\n');
    const result = verifyStagedInstall(root, { stageOwnership: true });
    expect(result.failures.join('\n')).toMatch(/git failed:[\s\S]*index\.lock/);
    expect(stagedPaths(root)).not.toContain(OWNERSHIP_DESTINATION);
  });

  it('fails closed when the verified index cannot be snapshotted', () => {
    const root = consumer();
    expect(verifyStagedInstall(root, { stageOwnership: true }).failures).toEqual([]);
    write(root, '.git/index.lock', 'locked\n');
    expect(verifyStagedInstall(root).failures.join('\n')).toMatch(/git failed:[\s\S]*index\.lock/);
  });

  it.each([
    CONTRACT_DESTINATION,
    '.github/workflows/squad.md',
    '.github/workflows/squad.lock.yml',
    '.github/workflows/shared/squad.md',
    '.github/aw/squad/runtime/shared/squad.md',
    '.github/skills/gh-aw-enlistment/SKILL.md',
  ])('rejects an omitted required artifact without force-adding it: %s', (path) => {
    const root = consumer();
    git(root, 'update-index', '--force-remove', '--', path);
    write(root, '.gitignore', `packages/\nlogs/\n*.local\n/${path}\n`);
    const result = verifyStagedInstall(root, { stageOwnership: true });
    expect(result.failures.join('\n')).toContain(`Required file is missing from staged tree: ${path}`);
    expect(stagedPaths(root)).not.toContain(path);
  });

  it.each([OWNERSHIP_DESTINATION, '.github/workflows/squad.lock.yml'])(
    'rejects stale staged bytes even when working-tree verification succeeds: %s', (path) => {
      const root = consumer();
      expect(verifyStagedInstall(root, { stageOwnership: true }).failures).toEqual([]);
      const original = readFileSync(join(root, path));
      write(root, path, 'stale staged contents\n');
      git(root, 'add', '--force', '--', path);
      write(root, path, original);
      expect(verifyInstall(root).failures).toEqual([]);
      expect(verifyStagedInstall(root, { stageOwnership: true }).failures.join('\n'))
        .toContain(`Staged digest mismatch for ${path}`);
    },
  );

  it('rejects a symlink staged in place of a required regular file', () => {
    const root = consumer();
    expect(verifyStagedInstall(root, { stageOwnership: true }).failures).toEqual([]);
    const path = '.github/workflows/squad.md';
    const object = git(root, 'rev-parse', `:${path}`).trim();
    git(root, 'update-index', '--cacheinfo', `120000,${object},${path}`);
    expect(verifyStagedInstall(root).failures.join('\n'))
      .toContain(`Required staged path is not a regular file: ${path}`);
  });

  it('rejects a required path replaced by an index directory without reading its descendants', () => {
    const root = consumer();
    expect(verifyStagedInstall(root, { stageOwnership: true }).failures).toEqual([]);
    const path = '.github/workflows/squad.md';
    const object = git(root, 'rev-parse', `:${path}`).trim();
    git(root, 'update-index', '--force-remove', '--', path);
    git(root, 'update-index', '--add', '--cacheinfo', `100644,${object},${path}/unexpected.txt`);
    expect(verifyInstall(root).failures).toEqual([]);
    expect(verifyStagedInstall(root).failures.join('\n'))
      .toContain(`Required staged path is not a regular file: ${path}`);
  });
});
