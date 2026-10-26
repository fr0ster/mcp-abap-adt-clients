// Runs tools/publish-changed.js with a fake npm against THIS repository's
// manifests, and proves that `release:publish -- --dry-run` plans every
// package in dependency order and publishes nothing.
//
// tools/test-publish-changed.js proves the publisher against fixture packages
// it makes up; it says nothing about whether this root's `publishOrder` names
// the packages that are here, in an order a release can go out in. That is
// what this checks:
//
//   1. `publishOrder` names every package directory under packages/ that holds
//      a public package, each once, and each after the siblings it depends on
//      (dependencies, peer and dev dependencies alike).
//   2. The real script, run in place on the real repository with a registry
//      that already serves every local version: it lists each package in
//      `publishOrder`, finds nothing to publish, and calls `npm publish` and
//      `npm run` never.
//   3. The real script in a copy of the repository's manifests, every package
//      committed and tagged `<dir>-v<version>`, with a registry that serves
//      none of the local versions, run as `release:publish -- --dry-run`: it
//      plans every package in `publishOrder`, says nothing was published, and
//      calls `npm publish` and `npm run` never.
//
// The fake npm is a file first on PATH; git is not shadowed.
//
//   node tools/test-publish-root.js
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'tools', 'publish-changed.js');
const SEMVER = path.join(ROOT, 'node_modules', 'semver');

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const rootManifest = readJson(path.join(ROOT, 'package.json'));
const { publishOrder } = rootManifest;
const manifests = publishOrder.map((dir) => ({
  dir,
  manifest: readJson(path.join(ROOT, dir, 'package.json')),
}));

// Nothing named GIT_* is inherited, as in tools/test-publish-changed.js: the
// fixture's commits and the script's guards must not read the caller's git.
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

/** A fake npm answering `view` from `versions`; it records every call. */
function fakeNpm(versions) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'publish-root-npm-'));
  const bin = path.join(home, 'bin');
  fs.mkdirSync(bin);
  const logPath = path.join(home, 'npm-log.jsonl');
  fs.writeFileSync(logPath, '');
  fs.writeFileSync(
    path.join(bin, 'npm'),
    `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(logPath)}, JSON.stringify(args) + '\\n');
const versions = ${JSON.stringify(versions)};
if (args[0] === 'view') {
  const all = versions[args[1]];
  if (all === undefined) {
    process.stderr.write('npm error code E404\\n');
    process.exit(1);
  }
  process.stdout.write(
    JSON.stringify(args[2] === 'versions' ? all : { latest: all[all.length - 1] }),
  );
  process.exit(0);
}
// Anything else -- a publish, a check step -- is what a dry run must not do.
process.stderr.write('fake npm: unexpected ' + JSON.stringify(args) + '\\n');
process.exit(1);
`,
  );
  fs.chmodSync(path.join(bin, 'npm'), 0o755);
  return { bin, logPath };
}

function run(script, cwd, bin, args) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd,
    encoding: 'utf8',
    input: '',
    env: {
      ...gitEnv(),
      PATH: `${bin}${path.delimiter}${process.env.PATH}`,
      PUBLISH_POLL_ATTEMPTS: '1',
      PUBLISH_POLL_MS: '1',
    },
  });
}

const calls = (logPath) =>
  fs
    .readFileSync(logPath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));

/** The package names of the plan table, in the order printed. */
function tableNames(stdout) {
  const names = manifests.map((m) => m.manifest.name);
  return stdout
    .split('\n')
    .map((line) => line.split(' ')[0])
    .filter((word) => names.includes(word));
}

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

check(
  'publishOrder names every public package, each after its siblings',
  () => {
    const present = fs
      .readdirSync(path.join(ROOT, 'packages'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => `packages/${entry.name}`)
      .filter((dir) => fs.existsSync(path.join(ROOT, dir, 'package.json')))
      .filter((dir) => !readJson(path.join(ROOT, dir, 'package.json')).private);
    assert.deepStrictEqual(
      [...publishOrder].sort(),
      present.sort(),
      'publishOrder and the package directories differ',
    );
    assert.strictEqual(new Set(publishOrder).size, publishOrder.length);

    const position = new Map(
      manifests.map((m, index) => [m.manifest.name, index]),
    );
    manifests.forEach(({ dir, manifest }, index) => {
      const deps = Object.keys({
        ...manifest.dependencies,
        ...manifest.peerDependencies,
        ...manifest.devDependencies,
      });
      for (const dep of deps)
        if (position.has(dep))
          assert.ok(
            position.get(dep) < index,
            `${dir} depends on ${dep}, which publishOrder puts after it`,
          );
    });
  },
);

check(
  'in place: every package listed in publishOrder, nothing published',
  () => {
    const versions = Object.fromEntries(
      manifests.map((m) => [m.manifest.name, [m.manifest.version]]),
    );
    const { bin, logPath } = fakeNpm(versions);
    const result = run(SCRIPT, ROOT, bin, ['--dry-run']);
    assert.strictEqual(result.status, 0, result.stdout + result.stderr);
    assert.deepStrictEqual(
      tableNames(result.stdout),
      manifests.map((m) => m.manifest.name),
    );
    assert.match(result.stdout, /Nothing to publish/);
    const done = calls(logPath);
    assert.deepStrictEqual(
      done.filter((args) => args[0] !== 'view'),
      [],
      'the script called npm for something other than a registry read',
    );
  },
);

check('--dry-run with every version pending plans all, publishes none', () => {
  if (!fs.existsSync(SEMVER))
    throw new Error(`${SEMVER} is missing. Run npm ci.`);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'publish-root-'));
  fs.copyFileSync(
    path.join(ROOT, 'package.json'),
    path.join(dir, 'package.json'),
  );
  for (const { dir: pkg } of manifests) {
    fs.mkdirSync(path.join(dir, pkg), { recursive: true });
    fs.copyFileSync(
      path.join(ROOT, pkg, 'package.json'),
      path.join(dir, pkg, 'package.json'),
    );
  }
  fs.mkdirSync(path.join(dir, 'tools'));
  fs.copyFileSync(SCRIPT, path.join(dir, 'tools', 'publish-changed.js'));
  // The script resolves semver next to itself; this repository's copy, and
  // nothing an ancestor of the temporary directory happens to hold.
  const proxy = path.join(dir, 'node_modules', 'semver');
  fs.mkdirSync(proxy, { recursive: true });
  fs.writeFileSync(
    path.join(proxy, 'package.json'),
    JSON.stringify({
      name: 'semver',
      version: '0.0.0-proxy',
      main: 'index.js',
    }),
  );
  fs.writeFileSync(
    path.join(proxy, 'index.js'),
    `module.exports = require(${JSON.stringify(SEMVER)});\n`,
  );
  fs.writeFileSync(path.join(dir, '.gitignore'), 'node_modules/\n');

  git(dir, ['init', '-q']);
  git(dir, ['config', 'user.email', 'test@example.com']);
  git(dir, ['config', 'user.name', 'test']);
  git(dir, ['config', 'commit.gpgSign', 'false']);
  git(dir, ['config', 'tag.gpgSign', 'false']);
  git(dir, ['config', 'core.hooksPath', '/dev/null']);
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-qm', 'fixture']);
  for (const { dir: pkg, manifest } of manifests)
    git(dir, ['tag', `${path.basename(pkg)}-v${manifest.version}`]);

  // Each package is on the registry, at a version below the local one.
  const versions = Object.fromEntries(
    manifests.map((m) => [m.manifest.name, ['0.0.1']]),
  );
  const { bin, logPath } = fakeNpm(versions);
  const result = run(path.join(dir, 'tools', 'publish-changed.js'), dir, bin, [
    '--dry-run',
  ]);
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  assert.deepStrictEqual(
    tableNames(result.stdout),
    manifests.map((m) => m.manifest.name),
  );
  const plan = manifests
    .map((m) => `${m.manifest.name}@${m.manifest.version}`)
    .join(', ');
  assert.ok(
    result.stdout.includes(`in dependency order: ${plan}\n`),
    `the plan is not ${plan}:\n${result.stdout}`,
  );
  assert.match(result.stdout, /--dry-run: nothing was published\./);
  assert.deepStrictEqual(
    calls(logPath).filter((args) => args[0] !== 'view'),
    [],
    'the script called npm for something other than a registry read',
  );
});

if (failures.length) {
  console.error(`\n${failures.join('\n')}`);
  process.exit(1);
}
console.log(
  `publish path, this repository: ${manifests.map((m) => m.dir).join(', ')}`,
);
