// Exercises the publish path of tools/publish-changed.js without publishing.
//
// Everything up to the publish is covered by running the script against the real
// repository, but what it does with npm — the arguments, the order, stopping
// after a failure, and the poll that asks whether the registry serves what was
// just sent — only happens during a real `npm publish`. That is the part a
// botched release would hit first, so it is exercised here instead.
//
// Each case builds a throwaway git repository, copies the script into it (the
// script takes its root from its own location, so a fixture repo is the only way
// to run it against anything but this one), and puts a fake `npm` first on PATH.
// The fake records every argv and answers from a JSON state file. `git` is not
// shadowed: the guards run for real.
//
//   node tools/test-publish-changed.js
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'tools', 'publish-changed.js');
const SEMVER = path.join(ROOT, 'node_modules', 'semver');

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

// The declaration and the lock are the independent sources. Comparing the
// installed copy with itself — which an earlier version of this file did, by
// reading node_modules/semver/package.json on both sides — holds whatever is
// installed there, including a stub.
const declaredRange = () =>
  readJson(path.join(ROOT, 'package.json')).devDependencies.semver;
const lockedVersion = () =>
  readJson(path.join(ROOT, 'package-lock.json')).packages['node_modules/semver']
    .version;
// Read on demand, never at load: reading it at load threw MODULE_NOT_FOUND
// before the explicit "run npm ci" check below could say the same in words.
const installedVersion = () =>
  readJson(path.join(SEMVER, 'package.json')).version;

// Ambient git settings reach both the fixture commits and the guards the script
// runs. Overriding GIT_CONFIG_GLOBAL and GIT_CONFIG_SYSTEM was not enough, and a
// longer list of names would be wrong by omission for the same reason: git takes
// configuration through GIT_CONFIG_COUNT with numbered GIT_CONFIG_KEY_n and
// GIT_CONFIG_VALUE_n, through GIT_CONFIG_PARAMETERS, and it can be pointed at a
// different repository entirely with GIT_DIR and GIT_WORK_TREE. All four were
// measured to hide an untracked file from `git status --porcelain`.
//
// So this is a rule rather than a list: nothing named GIT_* is inherited, and the
// few we want are set explicitly.
// Computed per call, never snapshotted at load: the cases below put hostile
// GIT_* variables into process.env, and a snapshot would filter an environment
// they were not in yet — so the suite would pass however weak the rule became.
const gitEnv = () => ({
  ...Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_')),
  ),
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_SYSTEM: '/dev/null',
  GIT_TERMINAL_PROMPT: '0',
});

const git = (cwd, args) =>
  execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: 'pipe',
    env: gitEnv(),
  });

/**
 * A repository with `packages` ({ dir, version }) in that order, each committed
 * and tagged the way tagFor() expects, plus the script and a fake npm.
 */
function fixture(packages) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'publish-changed-'));

  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify(
      {
        name: 'fixture',
        private: true,
        scripts: { check: 'npm run build && npm run test:check' },
        publishOrder: packages.map((p) => `packages/${p.dir}`),
      },
      null,
      2,
    ),
  );

  for (const p of packages) {
    const pkgDir = path.join(dir, 'packages', p.dir);
    fs.mkdirSync(pkgDir, { recursive: true });
    fs.writeFileSync(
      path.join(pkgDir, 'package.json'),
      JSON.stringify(
        { name: `@fixture/${p.dir}`, version: p.version },
        null,
        2,
      ),
    );
  }

  fs.mkdirSync(path.join(dir, 'tools'));
  fs.copyFileSync(SCRIPT, path.join(dir, 'tools', 'publish-changed.js'));

  // The fixture's own `semver` is a proxy that records being loaded and then
  // delegates to this repository's copy. Two things follow, and both were
  // defects here before:
  //
  // Symlinking the whole node_modules let node walk past a missing dependency
  // and resolve whatever an ancestor of the temporary directory held — on this
  // machine /tmp/node_modules carries a stray semver, so the suite passed with
  // the declared dependency uninstalled. Nothing outside the fixture can
  // satisfy this require now.
  //
  // And a probe file resolving semver proved only what a sibling file would do.
  // The marker is written by whoever actually required it, so the evidence comes
  // from the script under test.
  if (!fs.existsSync(SEMVER))
    throw new Error(
      `${SEMVER} is missing. Run npm ci: this suite must resolve the semver this` +
        ' repository declares, never one that happens to be installed elsewhere.',
    );
  const marker = `${dir}.semver-loaded`;
  const proxy = path.join(dir, 'node_modules', 'semver');
  fs.mkdirSync(proxy, { recursive: true });
  fs.writeFileSync(
    path.join(proxy, 'package.json'),
    JSON.stringify({
      name: 'semver',
      version: '0.0.0-fixture',
      main: 'index.js',
    }),
  );
  // Escape-free lines; paths arrive through JSON.stringify. The marker lives
  // OUTSIDE the repository: written inside, it would dirty the tree and the
  // script's own first guard would refuse the run.
  fs.writeFileSync(
    path.join(proxy, 'index.js'),
    [
      "const fs = require('node:fs');",
      `fs.appendFileSync(${JSON.stringify(marker)}, __filename);`,
      `module.exports = require(${JSON.stringify(SEMVER)});`,
    ].join('\n'),
  );

  git(dir, ['init', '-q']);
  git(dir, ['config', 'user.email', 'test@example.com']);
  git(dir, ['config', 'user.name', 'test']);
  git(dir, ['config', 'commit.gpgSign', 'false']);
  git(dir, ['config', 'tag.gpgSign', 'false']);
  git(dir, ['config', 'core.hooksPath', '/dev/null']);
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-qm', 'fixture']);
  for (const p of packages) git(dir, ['tag', `${p.dir}-v${p.version}`]);

  return dir;
}

/**
 * The fake npm: records argv, answers from state, and publishes into state.
 *
 * Its files live outside the fixture repository. Putting them inside left the
 * tree dirty after the fixture commit, and the script's first guard refused the
 * run — correctly, which is how this was found.
 */
function installFakeNpm(_dir, state) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'publish-changed-npm-'));
  const bin = path.join(home, 'bin');
  fs.mkdirSync(bin);
  const statePath = path.join(home, 'npm-state.json');
  const logPath = path.join(home, 'npm-log.jsonl');
  fs.writeFileSync(statePath, JSON.stringify(state));
  fs.writeFileSync(logPath, '');

  fs.writeFileSync(
    path.join(bin, 'npm'),
    // process.execPath, not `env node`: the runner and the fake npm must be the
    // same Node, and PATH here is deliberately rewritten.
    `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(logPath)}, JSON.stringify(args) + '\\n');
const statePath = ${JSON.stringify(statePath)};
const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));

if (args[0] === 'view') {
  const name = args[1];
  const field = args[2];
  // A registry that cannot be read at all: not E404, which is an answer, but
  // the shape a timeout, a 5xx or a reset arrives in.
  if (state.viewFails) {
    process.stderr.write('npm error code ETIMEDOUT\\nnpm error network request timed out\\n');
    process.exit(1);
  }
  // A read path that catches up rather than one that is instantly right: the
  // version is withheld for the first few views and served after. Without this
  // a fake registry answers correctly on the first ask, and a script that only
  // ever asks once looks identical to one that waits.
  if (state.serveAfterViews && state.serveAfterViews[name] !== undefined) {
    state.viewCounts = state.viewCounts ?? {};
    state.viewCounts[name] = (state.viewCounts[name] ?? 0) + 1;
    const withheld = state.viewCounts[name] <= state.serveAfterViews[name];
    fs.writeFileSync(statePath, JSON.stringify(state));
    if (withheld) {
      const all = state.versions[name] ?? [];
      process.stdout.write(
        JSON.stringify(field === 'versions' ? all.slice(0, -1) : { latest: all[all.length - 2] }),
      );
      process.exit(0);
    }
  }
  const versions = state.versions[name] ?? null;
  if (versions === null) {
    process.stderr.write('npm error code E404\\n');
    process.exit(1);
  }
  if (field === 'versions') process.stdout.write(JSON.stringify(versions));
  else process.stdout.write(JSON.stringify({ latest: versions[versions.length - 1] }));
  process.exit(0);
}

// A check step: it says something on each stream, so the cases can tell where
// its output went, and fails when told to.
if (args[0] === 'run') {
  process.stdout.write('output of ' + args[1] + '\\n');
  if (state.failCheck || state.failStep === args[1]) {
    process.stderr.write('error in ' + args[1] + '\\n');
    process.exit(1);
  }
  process.stderr.write('warning in ' + args[1] + '\\n');
  // Something changes the tree after the guards and before the publish: the
  // last step of the check is the latest moment a fake can reach.
  if (args[1] === 'test:check' && state.touchDuringCheck)
    fs.appendFileSync(state.touchDuringCheck, 'changed\\n');
  if (args[1] === 'test:check' && state.commitDuringCheck)
    require('node:child_process').execFileSync('git', ['commit', '-q', '--allow-empty', '-m', 'moved'], { cwd: state.commitDuringCheck, env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' } });
  process.exit(0);
}

if (args[0] === 'publish') {
  // npm takes a spec as a local folder only when it is plainly one ('./',
  // '../', '/', 'file:'). 'packages/<dir>' reads as the GitHub shorthand
  // 'user/repo', and the real npm goes to git ls-remote and fails, as it did
  // on the first release that published by path.
  if (!/^(\\.{1,2}\\/|\\/|file:)/.test(args[1])) {
    process.stderr.write(
      'npm error command git ls-remote ssh://git@github.com/' + args[1] + '.git\\n',
    );
    process.exit(128);
  }
  // Published by path, as the script does: the name is the package's own.
  const name = JSON.parse(
    fs.readFileSync(require('node:path').join(args[1], 'package.json'), 'utf8'),
  ).name;
  // npm refusing a version the registry already holds: it exits non-zero, and
  // the version is there. This is what a re-run meets when the read that built
  // the plan was stale.
  if (state.refusedButServed === name) {
    const local = JSON.parse(
      fs.readFileSync(state.manifests[name], 'utf8'),
    ).version;
    state.versions[name] = [...(state.versions[name] ?? []), local];
    fs.writeFileSync(statePath, JSON.stringify(state));
    process.stderr.write('npm error code EPUBLISHCONFLICT\\n');
    process.exit(1);
  }
  // Reads start failing once a publish has been ATTEMPTED: the plan is built
  // from reads that worked, and everything after it meets the outage --
  // including the check that follows a refusal.
  if (state.viewFailsAfterPublish) {
    state.viewFails = true;
    fs.writeFileSync(statePath, JSON.stringify(state));
  }
  if (state.failPublish === name) process.exit(1);
  if (!state.neverServe) {
    const local = JSON.parse(
      fs.readFileSync(state.manifests[name], 'utf8'),
    ).version;
    state.versions[name] = [...(state.versions[name] ?? []), local];
    fs.writeFileSync(statePath, JSON.stringify(state));
  }
  process.exit(0);
}

process.stderr.write('fake npm: unexpected ' + JSON.stringify(args) + '\\n');
process.exit(1);
`,
  );
  fs.chmodSync(path.join(bin, 'npm'), 0o755);
  return { bin, logPath };
}

// `input` is what the operator types; the default is the Enter that lets the
// publishes go.
function run(dir, bin, args = [], extraEnv = {}, input = '\n') {
  return spawnSync(
    process.execPath,
    [path.join(dir, 'tools', 'publish-changed.js'), ...args],
    {
      cwd: dir,
      encoding: 'utf8',
      input,
      env: {
        // gitEnv(), not process.env: the script runs git itself, so ambient
        // settings reach its guards too. Measured: several of them make
        // `git status --porcelain` answer empty while untracked files exist,
        // which blinds the dirty-tree guard. Isolating only the fixture setup
        // left that half exposed.
        ...gitEnv(),
        PATH: `${bin}${path.delimiter}${process.env.PATH}`,
        PUBLISH_POLL_ATTEMPTS: '3',
        PUBLISH_POLL_MS: '1',
        ...extraEnv,
      },
    },
  );
}

const readLog = (logPath) =>
  fs
    .readFileSync(logPath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));

const publishes = (log) =>
  log.filter((args) => args[0] === 'publish').map((args) => args.join(' '));

const failures = [];
const check = (name, fn) => {
  try {
    fn();
    console.log(`  ok  ${name}`);
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
    console.log(`FAIL  ${name}`);
  }
};

// --- cases ----------------------------------------------------------------

check('the installed semver is the declared and the locked one', () => {
  const semver = require('semver');
  const installed = installedVersion();
  assert.ok(
    semver.satisfies(installed, declaredRange()),
    `installed semver ${installed} does not satisfy ${declaredRange()}`,
  );
  assert.strictEqual(
    installed,
    lockedVersion(),
    'installed semver differs from package-lock.json',
  );
});

check(
  'the script under test loads the fixture semver, not another copy',
  () => {
    const dir = fixture([{ dir: 'alpha', version: '1.1.0' }]);
    const marker = `${dir}.semver-loaded`;
    assert.ok(
      !fs.existsSync(marker),
      'the marker exists before the script ran',
    );

    const { bin } = installFakeNpm(dir, {
      versions: { '@fixture/alpha': ['1.0.0'] },
      manifests: {
        '@fixture/alpha': path.join(dir, 'packages/alpha/package.json'),
      },
    });
    const result = run(dir, bin);
    assert.strictEqual(result.status, 0, result.stdout + result.stderr);

    // Written by the module the script itself required, which exists only inside
    // this fixture and delegates only to this repository's copy.
    assert.ok(
      fs.existsSync(marker),
      'the script ran without loading the fixture semver',
    );
    assert.strictEqual(
      fs.readFileSync(marker, 'utf8'),
      path.join(dir, 'node_modules', 'semver', 'index.js'),
    );
  },
);

// Every one of these was measured to hide an untracked file from
// `git status --porcelain`, so every one is a way to blind the dirty-tree guard.
// There is a case per class because the isolation is a rule about names, and a
// rule earns a test for each class it claims to cover — the first version of it
// handled only the first entry here.
const BLINDING_GIT_ENVS = [
  [
    'GIT_CONFIG_GLOBAL naming a config file',
    (dir) => {
      const file = `${dir}.gitconfig`;
      fs.writeFileSync(file, '[status]\n\tshowUntrackedFiles = no\n');
      return { GIT_CONFIG_GLOBAL: file };
    },
  ],
  [
    'GIT_CONFIG_COUNT with a numbered key and value',
    () => ({
      GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: 'status.showUntrackedFiles',
      GIT_CONFIG_VALUE_0: 'no',
    }),
  ],
  [
    'GIT_CONFIG_PARAMETERS',
    () => ({ GIT_CONFIG_PARAMETERS: "'status.showUntrackedFiles'='no'" }),
  ],
  [
    'GIT_DIR and GIT_WORK_TREE naming another repository',
    (dir) => {
      // An empty repository answers "clean" for everything, so the guard would
      // be reading a tree that is not the one about to be published.
      const other = `${dir}.other`;
      fs.mkdirSync(other);
      git(other, ['init', '-q']);
      return { GIT_DIR: path.join(other, '.git'), GIT_WORK_TREE: other };
    },
  ],
];

for (const [label, blinding] of BLINDING_GIT_ENVS)
  check(`the dirty-tree guard survives ${label}`, () => {
    const dir = fixture([{ dir: 'alpha', version: '1.1.0' }]);
    fs.writeFileSync(path.join(dir, 'packages/alpha/stray.txt'), 'uncommitted');

    const hostile = blinding(dir);
    const previous = Object.keys(hostile).map((name) => [
      name,
      process.env[name],
    ]);
    Object.assign(process.env, hostile);

    try {
      const { bin } = installFakeNpm(dir, {
        versions: { '@fixture/alpha': ['1.0.0'] },
        manifests: {
          '@fixture/alpha': path.join(dir, 'packages/alpha/package.json'),
        },
      });
      const result = run(dir, bin);
      // Exit 1 is not enough on its own: with GIT_DIR forwarded the run also
      // fails, but on the missing tag in the other repository. The dirty tree
      // has to be what stopped it.
      assert.strictEqual(result.status, 1, result.stdout + result.stderr);
      assert.match(result.stderr, /the working tree is dirty/);
    } finally {
      for (const [name, value] of previous)
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
    }
  });

// The cases above run the script under gitEnv(), which strips the hostile
// variables before the script sees them, so they prove the test runner's
// isolation rather than the script's. These hand the script the triggering
// configuration itself: the guard must pass what it needs to git explicitly.
const HIDING_UNTRACKED = [
  [
    'status.showUntrackedFiles=no in the repository configuration',
    (dir) => {
      git(dir, ['config', 'status.showUntrackedFiles', 'no']);
      return {};
    },
  ],
  [
    'status.showUntrackedFiles=no through GIT_CONFIG_COUNT in the script environment',
    () => ({
      GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: 'status.showUntrackedFiles',
      GIT_CONFIG_VALUE_0: 'no',
    }),
  ],
];

for (const [label, hide] of HIDING_UNTRACKED)
  check(`an untracked source file stops the run with ${label}`, () => {
    const dir = fixture([{ dir: 'alpha', version: '1.1.0' }]);
    fs.mkdirSync(path.join(dir, 'packages/alpha/src'), { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'packages/alpha/src/untracked.ts'),
      'export const x = 1;\n',
    );
    const env = hide(dir);
    // The triggering configuration must really hide the file from the default
    // command, or the case proves nothing.
    const seen = execFileSync('git', ['status', '--porcelain'], {
      cwd: dir,
      encoding: 'utf8',
      env: { ...gitEnv(), ...env },
    });
    assert.strictEqual(seen.trim(), '', 'the configuration hides nothing');

    const { bin, logPath } = installFakeNpm(dir, {
      versions: { '@fixture/alpha': ['1.0.0'] },
      manifests: {
        '@fixture/alpha': path.join(dir, 'packages/alpha/package.json'),
      },
    });
    const result = run(dir, bin, [], env);
    assert.strictEqual(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stderr, /the working tree is dirty/);
    assert.deepStrictEqual(publishes(readLog(logPath)), []);
  });

// Exclusion that lives outside the committed tree hides an untracked file from
// every git command that reads it, `--untracked-files=all` included.
const HIDING_BY_EXCLUDE = [
  [
    'core.excludesFile set through the script environment',
    (dir) => {
      const file = `${dir}.excludes`;
      fs.writeFileSync(file, 'untracked.ts\n');
      return {
        GIT_CONFIG_COUNT: '1',
        GIT_CONFIG_KEY_0: 'core.excludesFile',
        GIT_CONFIG_VALUE_0: file,
      };
    },
  ],
  [
    '.git/info/exclude',
    (dir) => {
      fs.appendFileSync(path.join(dir, '.git/info/exclude'), 'untracked.ts\n');
      return {};
    },
  ],
];

const alphaManifests = (dir) => ({
  versions: { '@fixture/alpha': ['1.0.0'] },
  manifests: {
    '@fixture/alpha': path.join(dir, 'packages/alpha/package.json'),
  },
});

for (const [label, hide] of HIDING_BY_EXCLUDE)
  check(
    `an untracked source file stops the run when hidden by ${label}`,
    () => {
      const dir = fixture([{ dir: 'alpha', version: '1.1.0' }]);
      fs.mkdirSync(path.join(dir, 'packages/alpha/src'), { recursive: true });
      fs.writeFileSync(
        path.join(dir, 'packages/alpha/src/untracked.ts'),
        'export const x = 1;\n',
      );
      const env = hide(dir);
      const seen = execFileSync(
        'git',
        ['status', '--porcelain', '--untracked-files=all'],
        { cwd: dir, encoding: 'utf8', env: { ...gitEnv(), ...env } },
      );
      assert.strictEqual(seen.trim(), '', 'the exclusion hides nothing');

      const { bin, logPath } = installFakeNpm(dir, alphaManifests(dir));
      const result = run(dir, bin, [], env);
      assert.strictEqual(result.status, 1, result.stdout + result.stderr);
      assert.match(result.stderr, /the working tree is dirty/);
      assert.deepStrictEqual(publishes(readLog(logPath)), []);
    },
  );

check('a file ignored by a committed .gitignore does not stop the run', () => {
  const dir = fixture([{ dir: 'alpha', version: '1.1.0' }]);
  fs.writeFileSync(path.join(dir, '.gitignore'), 'dist/\n');
  git(dir, ['add', '.gitignore']);
  git(dir, ['commit', '-qm', 'ignore dist']);
  git(dir, ['tag', '-f', 'alpha-v1.1.0']); // the tag must name HEAD's tree
  fs.mkdirSync(path.join(dir, 'packages/alpha/dist'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'packages/alpha/dist/x.js'), 'built\n');

  const { bin, logPath } = installFakeNpm(dir, alphaManifests(dir));
  const result = run(dir, bin);
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  assert.deepStrictEqual(publishes(readLog(logPath)), [
    'publish ./packages/alpha --ignore-scripts',
  ]);
});

check('a modified tracked file stops the run', () => {
  const dir = fixture([{ dir: 'alpha', version: '1.1.0' }]);
  fs.appendFileSync(path.join(dir, 'packages/alpha/package.json'), '\n');

  const { bin, logPath } = installFakeNpm(dir, alphaManifests(dir));
  const result = run(dir, bin);
  assert.strictEqual(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stderr, /the working tree is dirty/);
  assert.deepStrictEqual(publishes(readLog(logPath)), []);
});

// run() strips GIT_* for the cases above; here the script itself receives the
// redirection variables, pointing at a clean clone that has the same tags.
for (const [label, redirect] of [
  [
    'GIT_DIR and GIT_WORK_TREE',
    (clone) => ({
      GIT_DIR: path.join(clone, '.git'),
      GIT_WORK_TREE: clone,
    }),
  ],
  ['GIT_DIR alone', (clone) => ({ GIT_DIR: path.join(clone, '.git') })],
])
  check(
    `the guards inspect the repository, not ${label} naming a clean clone`,
    () => {
      const dir = fixture([{ dir: 'alpha', version: '1.1.0' }]);
      const clone = `${dir}.clone`;
      git(path.dirname(dir), ['clone', '-q', dir, clone]);
      git(clone, ['fetch', '-q', '--tags']);
      fs.mkdirSync(path.join(dir, 'packages/alpha/src'), { recursive: true });
      fs.writeFileSync(
        path.join(dir, 'packages/alpha/src/untracked.ts'),
        'export const x = 1;\n',
      );

      const { bin, logPath } = installFakeNpm(dir, alphaManifests(dir));
      const result = run(dir, bin, [], redirect(clone));
      assert.strictEqual(result.status, 1, result.stdout + result.stderr);
      assert.match(result.stderr, /the working tree is dirty/);
      assert.deepStrictEqual(publishes(readLog(logPath)), []);
    },
  );

check(
  'the guards ignore a repository-local core.worktree naming a clean copy',
  () => {
    const dir = fixture([{ dir: 'alpha', version: '1.1.0' }]);
    const copy = `${dir}.copy`;
    git(path.dirname(dir), ['clone', '-q', dir, copy]);
    fs.mkdirSync(path.join(dir, 'packages/alpha/src'), { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'packages/alpha/src/untracked.ts'),
      'export const x = 1;\n',
    );
    git(dir, ['config', 'core.worktree', copy]);
    // The configuration stays in place: it is what the script must withstand.
    const { bin, logPath } = installFakeNpm(dir, alphaManifests(dir));
    const result = run(dir, bin);
    assert.strictEqual(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stderr, /the working tree is dirty/);
    assert.deepStrictEqual(publishes(readLog(logPath)), []);
  },
);

const FLAGGED = /index entries are flagged/;

check('core.ignoreStat hiding an edited tracked file stops the run', () => {
  const dir = fixture([{ dir: 'alpha', version: '1.1.0' }]);
  const file = path.join(dir, 'packages/alpha/package.json');
  git(dir, ['config', 'core.ignoreStat', 'true']);
  // ignoreStat sets assume-unchanged on entries git itself updates.
  fs.utimesSync(file, new Date(), new Date());
  git(dir, ['add', '-A']);
  fs.appendFileSync(file, '\n');
  assert.strictEqual(
    git(dir, ['status', '--porcelain', '--untracked-files=no']).trim(),
    '',
    'ignoreStat hides nothing',
  );

  const { bin, logPath } = installFakeNpm(dir, alphaManifests(dir));
  const result = run(dir, bin);
  assert.strictEqual(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stderr, FLAGGED);
  assert.deepStrictEqual(publishes(readLog(logPath)), []);
});

check('a skip-worktree tracked file stops the run', () => {
  const dir = fixture([{ dir: 'alpha', version: '1.1.0' }]);
  const rel = 'packages/alpha/package.json';
  git(dir, ['update-index', '--skip-worktree', rel]);
  fs.appendFileSync(path.join(dir, rel), '\n');

  const { bin, logPath } = installFakeNpm(dir, alphaManifests(dir));
  const result = run(dir, bin);
  assert.strictEqual(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stderr, FLAGGED);
  assert.deepStrictEqual(publishes(readLog(logPath)), []);
});

check('a clean tree with no index flags still publishes', () => {
  const dir = fixture([{ dir: 'alpha', version: '1.1.0' }]);
  const { bin, logPath } = installFakeNpm(dir, alphaManifests(dir));
  const result = run(dir, bin);
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  assert.deepStrictEqual(publishes(readLog(logPath)), [
    'publish ./packages/alpha --ignore-scripts',
  ]);
});

check('publishes every pending package, in workspace order', () => {
  const dir = fixture([
    { dir: 'alpha', version: '1.1.0' },
    { dir: 'beta', version: '2.1.0' },
  ]);
  const { bin, logPath } = installFakeNpm(dir, {
    versions: { '@fixture/alpha': ['1.0.0'], '@fixture/beta': ['2.0.0'] },
    manifests: {
      '@fixture/alpha': path.join(dir, 'packages/alpha/package.json'),
      '@fixture/beta': path.join(dir, 'packages/beta/package.json'),
    },
  });

  const result = run(dir, bin);
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  assert.deepStrictEqual(publishes(readLog(logPath)), [
    'publish ./packages/alpha --ignore-scripts',
    'publish ./packages/beta --ignore-scripts',
  ]);
  assert.match(result.stdout, /Published 2 package\(s\)/);
});

check('passes --tag through to npm publish', () => {
  const dir = fixture([{ dir: 'alpha', version: '1.1.0-beta.1' }]);
  const { bin, logPath } = installFakeNpm(dir, {
    versions: { '@fixture/alpha': ['1.0.0'] },
    manifests: {
      '@fixture/alpha': path.join(dir, 'packages/alpha/package.json'),
    },
  });

  const result = run(dir, bin, ['--tag=next']);
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  assert.deepStrictEqual(publishes(readLog(logPath)), [
    'publish ./packages/alpha --ignore-scripts --tag next',
  ]);
});

for (const [name, args, words] of [
  ['a misspelt --dry-run', ['--dryrun'], /unknown argument "--dryrun"/],
  ['an argument without dashes', ['dry-run'], /unknown argument "dry-run"/],
  [
    'a second --tag',
    ['--tag=next', '--tag=beta'],
    /--tag is given more than once/,
  ],
  [
    'a second --dry-run',
    ['--dry-run', '--dry-run'],
    /--dry-run is given more than once/,
  ],
  ['an empty --tag', ['--tag='], /--tag= names no dist-tag/],
]) {
  check(`${name} publishes nothing and runs nothing`, () => {
    const dir = fixture([{ dir: 'alpha', version: '1.1.0' }]);
    const { bin, logPath } = installFakeNpm(dir, alphaManifests(dir));
    const result = run(dir, bin, args);
    assert.strictEqual(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stderr, words);
    assert.match(result.stderr, /Nothing was published/);
    // Refused before the check, the registry reads or a publish: npm is never
    // called at all.
    assert.deepStrictEqual(readLog(logPath), []);
  });
}

check('a failed publish stops the run before the next package', () => {
  const dir = fixture([
    { dir: 'alpha', version: '1.1.0' },
    { dir: 'beta', version: '2.1.0' },
  ]);
  const { bin, logPath } = installFakeNpm(dir, {
    versions: { '@fixture/alpha': ['1.0.0'], '@fixture/beta': ['2.0.0'] },
    manifests: {
      '@fixture/alpha': path.join(dir, 'packages/alpha/package.json'),
      '@fixture/beta': path.join(dir, 'packages/beta/package.json'),
    },
    failPublish: '@fixture/alpha',
  });

  const result = run(dir, bin);
  assert.strictEqual(result.status, 1);
  assert.match(
    result.stderr,
    /did not publish\. Later packages were not attempted/,
  );
  assert.deepStrictEqual(publishes(readLog(logPath)), [
    'publish ./packages/alpha --ignore-scripts',
  ]);
  // The first package failed, so nothing is on the registry — say that rather
  // than leaving the operator to guess, and say re-running is how to continue.
  assert.match(result.stderr, /Nothing was published by this run/);
  assert.match(result.stderr, /nothing of its\s+own to collide with/);
  // And say that the registry was asked to the end of the budget rather than
  // once, so "did not publish" is a finding and not an assumption about what
  // npm's exit code meant.
  assert.match(
    result.stderr,
    /The registry was asked for \d+s and does not have it/,
  );
});

check('the second package failing names what the first one published', () => {
  const dir = fixture([
    { dir: 'alpha', version: '1.1.0' },
    { dir: 'beta', version: '2.1.0' },
  ]);
  const { bin } = installFakeNpm(dir, {
    versions: { '@fixture/alpha': ['1.0.0'], '@fixture/beta': ['2.0.0'] },
    manifests: {
      '@fixture/alpha': path.join(dir, 'packages/alpha/package.json'),
      '@fixture/beta': path.join(dir, 'packages/beta/package.json'),
    },
    failPublish: '@fixture/beta',
  });

  const result = run(dir, bin);
  assert.strictEqual(result.status, 1);
  // This is the shape a hardware key produces: one touch given, the next
  // prompt missed. What matters afterwards is which packages are already out.
  assert.match(
    result.stderr,
    /Published by this run and confirmed:\n\s+@fixture\/alpha@1\.1\.0/,
  );
  assert.match(result.stderr, /two-factor prompt timed\s+out/);
  // alpha is visible, so a re-run is safe and the report says so rather than
  // hedging. The opposite case is the test below.
  assert.match(result.stderr, /All of them are visible/);
});

check(
  'a version the registry never serves is reported, not treated as a failure',
  () => {
    const dir = fixture([{ dir: 'alpha', version: '1.1.0' }]);
    const { bin } = installFakeNpm(dir, {
      versions: { '@fixture/alpha': ['1.0.0'] },
      manifests: {
        '@fixture/alpha': path.join(dir, 'packages/alpha/package.json'),
      },
      neverServe: true,
    });

    const result = run(dir, bin);
    // 2, not 1: published-but-not-visible and publish-failed call for different
    // next steps, and they exited identically before.
    assert.strictEqual(result.status, 2);
    assert.match(result.stdout, /Published 1 package/);
    // The package IS on the registry; only the reading of it is late. Said in
    // those words, because the operator's next question is whether to publish
    // again — and doing that would fail on a version that already exists.
    assert.match(result.stderr, /IS PUBLISHED but not confirmed/);
    assert.match(result.stderr, /nothing needs publishing again/);
    assert.match(result.stderr, /@fixture\/alpha@1\.1\.0/);
  },
);

/**
 * **The regression this whole shape exists for.** Waiting for each version to
 * be served before publishing the next one stranded three releases in two
 * days: the first package published, the read-through was slow, the run
 * exited, and the second was never attempted. A slow read must not cost a
 * release, so every package goes out and the verification happens once, after.
 */
check('a slow registry read does not stop the packages after it', () => {
  const dir = fixture([
    { dir: 'alpha', version: '1.1.0' },
    { dir: 'beta', version: '2.1.0' },
  ]);
  const { bin, logPath } = installFakeNpm(dir, {
    versions: { '@fixture/alpha': ['1.0.0'], '@fixture/beta': ['2.0.0'] },
    manifests: {
      '@fixture/alpha': path.join(dir, 'packages/alpha/package.json'),
      '@fixture/beta': path.join(dir, 'packages/beta/package.json'),
    },
    neverServe: true,
  });

  const result = run(dir, bin);
  assert.deepStrictEqual(publishes(readLog(logPath)), [
    'publish ./packages/alpha --ignore-scripts',
    'publish ./packages/beta --ignore-scripts',
  ]);
  assert.strictEqual(result.status, 2);
  assert.match(result.stdout, /Published 2 package/);
  assert.match(result.stderr, /2 of 2 IS PUBLISHED but not confirmed/);
});

/**
 * **The re-run this file's whole subject creates.** A release stops between two
 * packages; the operator re-runs; the registry's read path is still behind, so
 * the plan puts the already-published package back in. npm refuses it, and if
 * that refusal is fatal the run stops again — before the package that still
 * needs publishing. The same stranding, one layer down.
 *
 * A refusal is therefore a question, not a verdict: ask the registry, and a
 * version it serves is one there is nothing left to do for.
 */
check(
  'a publish npm refuses for a version the registry serves is not a failure',
  () => {
    const dir = fixture([
      { dir: 'alpha', version: '1.1.0' },
      { dir: 'beta', version: '2.1.0' },
    ]);
    const { bin, logPath } = installFakeNpm(dir, {
      versions: { '@fixture/alpha': ['1.0.0'], '@fixture/beta': ['2.0.0'] },
      manifests: {
        '@fixture/alpha': path.join(dir, 'packages/alpha/package.json'),
        '@fixture/beta': path.join(dir, 'packages/beta/package.json'),
      },
      refusedButServed: '@fixture/alpha',
    });

    const result = run(dir, bin);
    // The point: beta was published although alpha's publish exited non-zero.
    assert.deepStrictEqual(publishes(readLog(logPath)), [
      'publish ./packages/alpha --ignore-scripts',
      'publish ./packages/beta --ignore-scripts',
    ]);
    assert.strictEqual(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /already published\. Continuing/);
  },
);

/**
 * A publish that is refused and a version the registry does not serve either is
 * a real failure, and still stops the run. The check above must not have made
 * every refusal survivable.
 */
check(
  'a refused publish the registry cannot vouch for still stops the run',
  () => {
    const dir = fixture([
      { dir: 'alpha', version: '1.1.0' },
      { dir: 'beta', version: '2.1.0' },
    ]);
    const { bin, logPath } = installFakeNpm(dir, {
      versions: { '@fixture/alpha': ['1.0.0'], '@fixture/beta': ['2.0.0'] },
      manifests: {
        '@fixture/alpha': path.join(dir, 'packages/alpha/package.json'),
        '@fixture/beta': path.join(dir, 'packages/beta/package.json'),
      },
      failPublish: '@fixture/alpha',
    });

    const result = run(dir, bin);
    assert.strictEqual(result.status, 1);
    assert.deepStrictEqual(publishes(readLog(logPath)), [
      'publish ./packages/alpha --ignore-scripts',
    ]);
    assert.match(result.stderr, /does not have it/);
  },
);

/**
 * **A read that fails is not a read that answers "no".** `registryJson` turns
 * E404 into an answer and rethrows the rest, which is right while planning and
 * wrong afterwards: a timeout in the verification loop came out as an unhandled
 * throw, exiting 1 with a stack trace on a release where every publish
 * succeeded — and 1 is this run's code for "a publish failed".
 */
check(
  'a registry that cannot be read after publishing exits 2, not a stack trace',
  () => {
    const dir = fixture([{ dir: 'alpha', version: '1.1.0' }]);
    const { bin } = installFakeNpm(dir, {
      versions: { '@fixture/alpha': ['1.0.0'] },
      manifests: {
        '@fixture/alpha': path.join(dir, 'packages/alpha/package.json'),
      },
      viewFailsAfterPublish: true,
    });

    const result = run(dir, bin);
    assert.strictEqual(result.status, 2, result.stdout + result.stderr);
    assert.match(result.stdout, /Published 1 package/);
    assert.match(result.stderr, /could not be read/);
    assert.match(result.stderr, /nothing needs publishing again/);
    // An unhandled throw is what this replaces; it must not be how it reports.
    assert.doesNotMatch(result.stderr, /at Object\.|at Module\._compile/);
  },
);

/**
 * **A read that failed is not a version that is absent.** After a refused
 * publish the script asks the registry whether the version is there. If that
 * question cannot be asked — a timeout, a 5xx, a reset — the answer is
 * neither yes nor no, and reporting it as "the registry does not serve this
 * version" would have an operator act on something nobody established. The
 * publish may well have been accepted.
 */
check(
  'a refusal the registry could not be asked about says so, not "absent"',
  () => {
    const dir = fixture([{ dir: 'alpha', version: '1.1.0' }]);
    const { bin } = installFakeNpm(dir, {
      versions: { '@fixture/alpha': ['1.0.0'] },
      manifests: {
        '@fixture/alpha': path.join(dir, 'packages/alpha/package.json'),
      },
      failPublish: '@fixture/alpha',
      viewFailsAfterPublish: true,
    });

    const result = run(dir, bin);
    assert.strictEqual(result.status, 1);
    assert.match(result.stderr, /is UNKNOWN/);
    assert.match(result.stderr, /It may have been accepted/);
    assert.match(
      result.stderr,
      /npm view @fixture\/alpha versions --prefer-online/,
    );
    // The finding it must NOT report, because it was not made.
    assert.doesNotMatch(result.stderr, /does not have it/);
  },
);

/**
 * The stop that starts the next stop. alpha publishes, the read path does not
 * show it yet, beta's two-factor prompt times out. Told to re-run, the
 * operator gets alpha back in the plan, npm refuses it, and the run ends
 * before beta again — so the advice has to name the condition.
 */
check('a stop with something already published says what to wait for', () => {
  const dir = fixture([
    { dir: 'alpha', version: '1.1.0' },
    { dir: 'beta', version: '2.1.0' },
  ]);
  const { bin } = installFakeNpm(dir, {
    versions: { '@fixture/alpha': ['1.0.0'], '@fixture/beta': ['2.0.0'] },
    manifests: {
      '@fixture/alpha': path.join(dir, 'packages/alpha/package.json'),
      '@fixture/beta': path.join(dir, 'packages/beta/package.json'),
    },
    // alpha publishes and the registry keeps answering with the old list.
    neverServe: true,
    failPublish: '@fixture/beta',
  });

  const result = run(dir, bin);
  assert.strictEqual(result.status, 1);
  assert.match(
    result.stderr,
    /Published by this run and NOT yet visible:\n\s+@fixture\/alpha@1\.1\.0/,
  );
  assert.match(result.stderr, /Wait until each of those shows up/);
  assert.match(result.stderr, /npm refuses them/);
});

/**
 * **The difference between asking once and waiting.** A refusal is decided by
 * asking the registry, and the registry is exactly what is behind — so the
 * first answer is the one least worth trusting. Here the version appears on
 * the third read: a script that asks once calls this a failed publish and
 * stops before beta; one that spends the budget finds it and carries on.
 */
check('a refusal is decided on the budget, not on the first read', () => {
  const dir = fixture([
    { dir: 'alpha', version: '1.1.0' },
    { dir: 'beta', version: '2.1.0' },
  ]);
  const { bin, logPath } = installFakeNpm(dir, {
    versions: { '@fixture/alpha': ['1.0.0'], '@fixture/beta': ['2.0.0'] },
    manifests: {
      '@fixture/alpha': path.join(dir, 'packages/alpha/package.json'),
      '@fixture/beta': path.join(dir, 'packages/beta/package.json'),
    },
    refusedButServed: '@fixture/alpha',
    // The two views the plan makes are spent first, so the refusal meets a
    // read path that still says no.
    serveAfterViews: { '@fixture/alpha': 3 },
  });

  const result = run(dir, bin);
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  assert.deepStrictEqual(publishes(readLog(logPath)), [
    'publish ./packages/alpha --ignore-scripts',
    'publish ./packages/beta --ignore-scripts',
  ]);
  assert.match(result.stdout, /already published\. Continuing/);
});

/**
 * **A version this run met rather than made is not this run's work.** A
 * refusal the registry vouches for was published by an earlier run — the plan
 * held it because the read that built the plan was behind. Counting it as
 * published here would make the one report an operator reads during a partial
 * release describe a release that did not happen.
 */
check(
  'a version that was already there is not reported as published by this run',
  () => {
    const dir = fixture([
      { dir: 'alpha', version: '1.1.0' },
      { dir: 'beta', version: '2.1.0' },
    ]);
    const { bin } = installFakeNpm(dir, {
      versions: { '@fixture/alpha': ['1.0.0'], '@fixture/beta': ['2.0.0'] },
      manifests: {
        '@fixture/alpha': path.join(dir, 'packages/alpha/package.json'),
        '@fixture/beta': path.join(dir, 'packages/beta/package.json'),
      },
      refusedButServed: '@fixture/alpha',
      failPublish: '@fixture/beta',
    });

    const result = run(dir, bin);
    assert.strictEqual(result.status, 1);
    assert.match(
      result.stderr,
      /Already on the registry before this run, not published by it:\n\s+@fixture\/alpha@1\.1\.0/,
    );
    assert.match(result.stderr, /Nothing was published by this run/);
    // The claim it must not make.
    assert.doesNotMatch(
      result.stderr,
      /Published by this run and confirmed:\n\s+@fixture\/alpha/,
    );
  },
);

/**
 * **Both halves of the count have to mean the same thing.** One package met
 * as already published, one published here and not visible yet: the
 * numerator counted this run's unconfirmed publishes while the denominator
 * counted everything attempted, so the report said "1 of 2" about a run that
 * published one package. A ratio whose halves are drawn from different sets
 * is not a ratio.
 */
check(
  "the unconfirmed count is out of this run's publishes, not everything tried",
  () => {
    const dir = fixture([
      { dir: 'alpha', version: '1.1.0' },
      { dir: 'beta', version: '2.1.0' },
    ]);
    const { bin } = installFakeNpm(dir, {
      versions: { '@fixture/alpha': ['1.0.0'], '@fixture/beta': ['2.0.0'] },
      manifests: {
        '@fixture/alpha': path.join(dir, 'packages/alpha/package.json'),
        '@fixture/beta': path.join(dir, 'packages/beta/package.json'),
      },
      // alpha is refused and vouched for; beta publishes and stays invisible.
      refusedButServed: '@fixture/alpha',
      neverServe: true,
    });

    const result = run(dir, bin);
    assert.strictEqual(result.status, 2, result.stdout + result.stderr);
    assert.match(result.stdout, /Published 1 package\(s\)/);
    assert.match(result.stdout, /1 were already on the registry/);
    assert.match(result.stderr, /1 of 1 IS PUBLISHED but not confirmed/);
    assert.match(result.stderr, /@fixture\/beta@2\.1\.0/);
    // alpha was not published here, so it is not in the waiting list either.
    assert.doesNotMatch(
      result.stderr,
      /IS PUBLISHED but not confirmed[\s\S]*@fixture\/alpha/,
    );
  },
);

check('a failing check publishes nothing', () => {
  const dir = fixture([{ dir: 'alpha', version: '1.1.0' }]);
  const { bin, logPath } = installFakeNpm(dir, {
    versions: { '@fixture/alpha': ['1.0.0'] },
    manifests: {
      '@fixture/alpha': path.join(dir, 'packages/alpha/package.json'),
    },
    failCheck: true,
  });

  const result = run(dir, bin);
  assert.strictEqual(result.status, 1);
  assert.match(result.stderr, /npm run build failed\. Nothing was published/);
  assert.deepStrictEqual(publishes(readLog(logPath)), []);
});

check('a package the registry has never seen is publishable', () => {
  const dir = fixture([{ dir: 'alpha', version: '1.0.0' }]);
  const { bin, logPath } = installFakeNpm(dir, {
    versions: {},
    manifests: {
      '@fixture/alpha': path.join(dir, 'packages/alpha/package.json'),
    },
  });

  const result = run(dir, bin);
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  assert.deepStrictEqual(publishes(readLog(logPath)), [
    'publish ./packages/alpha --ignore-scripts',
  ]);
});

// --- the check's log and the pause ------------------------------------------

/** The log path the run named, read from its own words. */
const logOf = (result) => {
  const marker = 'output: ';
  const line = result.stdout.split('\n').find((l) => l.includes(marker));
  assert.ok(line, `no log path in:\n${result.stdout}`);
  return line.slice(line.indexOf(marker) + marker.length).trim();
};

check(
  'the check runs step by step into a log, one line each on the terminal',
  () => {
    const dir = fixture([{ dir: 'alpha', version: '1.1.0' }]);
    const { bin, logPath } = installFakeNpm(dir, alphaManifests(dir));
    const result = run(dir, bin);
    assert.strictEqual(result.status, 0, result.stdout + result.stderr);
    const runs = readLog(logPath)
      .filter((a) => a[0] === 'run')
      .map((a) => a[1]);
    assert.deepStrictEqual(runs, ['build', 'test:check']);
    assert.match(result.stdout, / {2}ok {2}npm run build \(\d+s\)/);
    assert.match(result.stdout, / {2}ok {2}npm run test:check \(\d+s\)/);
    // Neither stream of a step reaches the terminal; both are in the log.
    const terminal = result.stdout + result.stderr;
    assert.doesNotMatch(terminal, /output of|warning in/);
    const log = fs.readFileSync(logOf(result), 'utf8');
    for (const text of [
      'output of build',
      'warning in build',
      'output of test:check',
      'warning in test:check',
    ])
      assert.ok(log.includes(text), `${text} is not in the log`);
  },
);

check('a failed step prints its own tail and the log path, and stops', () => {
  const dir = fixture([{ dir: 'alpha', version: '1.1.0' }]);
  const { bin, logPath } = installFakeNpm(dir, {
    ...alphaManifests(dir),
    failStep: 'test:check',
  });
  const result = run(dir, bin);
  assert.strictEqual(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout, /FAIL {2}npm run test:check/);
  assert.match(result.stderr, /error in test:check/);
  // The tail is the failed step's: the step before it passed and is not repeated.
  assert.doesNotMatch(result.stderr, /output of build/);
  assert.match(
    result.stderr,
    /npm run test:check failed\. Nothing was published/,
  );
  assert.ok(result.stderr.includes(logOf(result)), 'the log path is not named');
  assert.doesNotMatch(result.stdout, /Press Enter/);
  assert.deepStrictEqual(publishes(readLog(logPath)), []);
});

check('a check that is not a plain chain runs as one step', () => {
  const dir = fixture([{ dir: 'alpha', version: '1.1.0' }]);
  const manifest = path.join(dir, 'package.json');
  const root = readJson(manifest);
  root.scripts.check = 'npm run build && node tools/x.js';
  fs.writeFileSync(manifest, JSON.stringify(root, null, 2));
  git(dir, ['commit', '-qam', 'check']);
  git(dir, ['tag', '-f', 'alpha-v1.1.0']);
  const { bin, logPath } = installFakeNpm(dir, alphaManifests(dir));
  const result = run(dir, bin);
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  const runs = readLog(logPath)
    .filter((a) => a[0] === 'run')
    .map((a) => a[1]);
  assert.deepStrictEqual(runs, ['check']);
});

for (const [label, input, words] of [
  ['the end of input', '', /No answer was given\. Nothing was published/],
  [
    'an answer other than Enter',
    'n\n',
    /The answer was not Enter\. Nothing was published/,
  ],
])
  check(`${label} at the pause publishes nothing`, () => {
    const dir = fixture([{ dir: 'alpha', version: '1.1.0' }]);
    const { bin, logPath } = installFakeNpm(dir, alphaManifests(dir));
    const result = run(dir, bin, [], {}, input);
    assert.strictEqual(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, /Press Enter to publish 1 package/);
    assert.match(result.stderr, words);
    assert.deepStrictEqual(publishes(readLog(logPath)), []);
  });

check('Enter after a carriage return still publishes', () => {
  const dir = fixture([{ dir: 'alpha', version: '1.1.0' }]);
  const { bin, logPath } = installFakeNpm(dir, alphaManifests(dir));
  const result = run(dir, bin, [], {}, '\r\n');
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  assert.deepStrictEqual(publishes(readLog(logPath)), [
    'publish ./packages/alpha --ignore-scripts',
  ]);
});

check('an untracked file outside the packages does not stop the run', () => {
  const dir = fixture([{ dir: 'alpha', version: '1.1.0' }]);
  fs.mkdirSync(path.join(dir, '.claude'));
  fs.writeFileSync(path.join(dir, '.claude/settings.local.json'), '{}\n');
  const { bin, logPath } = installFakeNpm(dir, alphaManifests(dir));
  const result = run(dir, bin);
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  assert.deepStrictEqual(publishes(readLog(logPath)), [
    'publish ./packages/alpha --ignore-scripts',
  ]);
});

check(
  'a modified tracked file outside the packages still stops the run',
  () => {
    const dir = fixture([{ dir: 'alpha', version: '1.1.0' }]);
    fs.appendFileSync(path.join(dir, 'package.json'), '\n');
    const { bin, logPath } = installFakeNpm(dir, alphaManifests(dir));
    const result = run(dir, bin);
    assert.strictEqual(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stderr, /the working tree is dirty/);
    assert.deepStrictEqual(publishes(readLog(logPath)), []);
  },
);

check('core.ignoreCase does not let .gitignore hide an untracked file', () => {
  const dir = fixture([{ dir: 'alpha', version: '1.1.0' }]);
  fs.writeFileSync(path.join(dir, '.gitignore'), 'build/\n');
  git(dir, ['add', '.gitignore']);
  git(dir, ['commit', '-qm', 'ignore build']);
  git(dir, ['tag', '-f', 'alpha-v1.1.0']);
  git(dir, ['config', 'core.ignoreCase', 'true']);
  fs.mkdirSync(path.join(dir, 'packages/alpha/BUILD'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'packages/alpha/BUILD/x.js'), 'x\n');
  // The configuration must really hide the file, or the case proves nothing.
  assert.strictEqual(
    git(dir, [
      'ls-files',
      '--others',
      '--exclude-per-directory=.gitignore',
    ]).trim(),
    '',
    'core.ignoreCase hides nothing',
  );
  const { bin, logPath } = installFakeNpm(dir, alphaManifests(dir));
  const result = run(dir, bin);
  assert.strictEqual(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stderr, /the working tree is dirty/);
  assert.deepStrictEqual(publishes(readLog(logPath)), []);
});

for (const [label, change] of [
  [
    'an edited package file',
    (dir) => ({
      touchDuringCheck: path.join(dir, 'packages/alpha/package.json'),
    }),
  ],
  [
    'a new untracked package file',
    (dir) => ({
      touchDuringCheck: path.join(dir, 'packages/alpha/new.js'),
    }),
  ],
])
  check(`${label} after the first guards publishes nothing`, () => {
    const dir = fixture([{ dir: 'alpha', version: '1.1.0' }]);
    const { bin, logPath } = installFakeNpm(dir, {
      ...alphaManifests(dir),
      ...change(dir),
    });
    const result = run(dir, bin);
    assert.strictEqual(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, /Press Enter/);
    assert.match(result.stderr, /the working tree is dirty/);
    assert.deepStrictEqual(publishes(readLog(logPath)), []);
  });

check('HEAD moving after the first guards publishes nothing', () => {
  const dir = fixture([{ dir: 'alpha', version: '1.1.0' }]);
  const { bin, logPath } = installFakeNpm(dir, {
    ...alphaManifests(dir),
    commitDuringCheck: dir,
  });
  const result = run(dir, bin);
  assert.strictEqual(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stderr, /HEAD moved while the run waited/);
  assert.deepStrictEqual(publishes(readLog(logPath)), []);
});

if (failures.length) {
  console.error(`\n${failures.join('\n')}`);
  process.exit(1);
}
console.log(
  'publish path: arguments, order, failure handling and the registry poll',
);
