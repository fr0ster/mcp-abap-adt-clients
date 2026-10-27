// Publishes exactly the packages whose version is not on the registry yet.
//
// Publishing every workspace by hand republishes what has not changed, and npm
// answers each of those with "You cannot publish over the previously published
// versions". Those lines are not harmless: four of them scrolling past teach the
// eye to skip the fifth, which is a real failure. So nothing already published is
// ever attempted, and a publish that errors stops the run.
//
// **A slow registry read does not stop it.** This waited for each version to be
// SERVED before publishing the next package, on the reasoning that nothing
// should go out depending on a version that might not exist. Three releases in
// two days ended the same way: the first package published, the read-through
// took longer than the wait, the run exited, and the second package was never
// attempted. A half-published release, caused entirely by the safeguard.
//
// The wait bought nothing the next publish needs. `npm run check` runs ONCE,
// before any of this, over tarballs built here; it never reads the registry.
// And `npm publish` uploads a tarball, it does not resolve the ranges in the
// manifest it uploads, so publishing B never asks whether A is being served.
// What reads those ranges is a consumer installing afterwards, and by then the
// question is whether A is on the registry at all -- which the verification at
// the end answers, for every package at once.
//
// So: publish everything, then verify everything. A version the registry has
// not served by the end is reported by name and exits 2, distinct from a
// publish that failed. Nothing is lost either way, because re-running skips
// whatever is already there.
//
// It also runs `npm run check` ONCE. Publishing every workspace ran every
// package's prepublishOnly, which is the same full check five times over; the
// publishes here pass --ignore-scripts because the check has already run.
//
// **The check writes to a log file, not to the terminal.** Its output is long
// enough that a terminal's scrollback dropped the error of a failed build, and
// the publish that followed asked for the browser login in the middle of it.
// So each step of the check (`npm run a && npm run b ...`, run one by one) gets
// one summary line on the terminal; a failed step prints the tail of its own
// output and the log's path, and nothing is published. Then the run waits for
// Enter, once, before the first `npm publish`: the operator comes back for the
// login prompt instead of watching for it.
//
// What it guarantees: the tarball holds the tree the release tag names. A tag
// that is merely an ancestor of HEAD does not give that — a commit after the tag
// can change a package without bumping its version, and the tarball then carries
// content the tagged version never had. So the tree must equal the tag's tree.
//
//   npm run release:publish
//   npm run release:publish -- --dry-run
//   npm run release:publish -- --tag=next     # for a prerelease version
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const semver = require('semver');

const ROOT = path.resolve(__dirname, '..');

// Every argument is one this script reads, or the run stops before anything
// else. An unread one is not harmless: `--dryrun` or `--dry_run` would be
// skipped and the run would publish for real, and a second `--tag=` would be
// dropped in favour of the first.
const ARGS = process.argv.slice(2);
for (const arg of ARGS) {
  if (arg !== '--dry-run' && !arg.startsWith('--tag=')) {
    console.error(
      `\npublish: unknown argument ${JSON.stringify(arg)}; ` +
        'the arguments are --dry-run and --tag=<dist-tag>. Nothing was published.',
    );
    process.exit(1);
  }
}
for (const name of ['--dry-run', '--tag=']) {
  if (
    ARGS.filter((a) => a === name || (name.endsWith('=') && a.startsWith(name)))
      .length > 1
  ) {
    console.error(
      `\npublish: ${name.replace('=', '')} is given more than once. Nothing was published.`,
    );
    process.exit(1);
  }
}
if (ARGS.includes('--tag=')) {
  console.error('\npublish: --tag= names no dist-tag. Nothing was published.');
  process.exit(1);
}

const DRY_RUN = ARGS.includes('--dry-run');
// The npm dist-tag to publish under. Without it npm publishes to `latest`,
// which is why a prerelease requires it explicitly.
const NPM_TAG =
  ARGS.find((a) => a.startsWith('--tag='))?.slice('--tag='.length) ?? null;
// `latest` is the tag a plain `npm publish` moves, so naming it explicitly must
// not buy anything. Both dist-tag guards key on this rather than on whether a
// --tag was passed: `--tag=latest` bypassed both when they asked the latter.
const TARGETS_LATEST = NPM_TAG === null || NPM_TAG === 'latest';

// How long to wait, at the END of the run, for the registry to serve what was
// just published. Only tools/test-publish-changed.js overrides these, so that
// the case where the registry never serves a version does not take the full
// wait.
//
// 40 x 3s = 120s, and the number matters far less than it used to: this wait no
// longer stands between two publishes, so exceeding it costs a report rather
// than a release. Measured lag, every time after a publish that succeeded: 30s
// (interfaces-auth 1.1.0, 2026-09-20), and over 60s twice on 2026-09-21. Each
// bounds the lag from below only, since the version was being served by the
// time anyone looked again.
const POLL_ATTEMPTS = Number(process.env.PUBLISH_POLL_ATTEMPTS ?? 40);
const POLL_MS = Number(process.env.PUBLISH_POLL_MS ?? 3000);
// A zero, negative or non-numeric override would silently remove the wait, and
// the check it exists for would report a version the registry has not served.
// Attempts are counted, so a fraction is a mistake rather than a shorter wait.
if (!Number.isInteger(POLL_ATTEMPTS) || POLL_ATTEMPTS <= 0) {
  console.error('\npublish: PUBLISH_POLL_ATTEMPTS must be a positive integer.');
  process.exit(1);
}
if (!Number.isFinite(POLL_MS) || POLL_MS <= 0) {
  console.error('\npublish: PUBLISH_POLL_MS must be a positive number.');
  process.exit(1);
}

/** Sleep without going async, so the whole run stays a readable sequence. */
const sleep = (ms) =>
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

/** Captured output; for commands whose result this script reads. */
const capture = (cmd, args, options = {}) =>
  execFileSync(cmd, args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });

/**
 * Inherited stdio; for commands the operator must see and answer.
 * `npm publish` prompts for two-factor authentication and waits on ENTER —
 * piping its stdio would hang the run with the prompt invisible.
 */
const interactive = (cmd, args) =>
  execFileSync(cmd, args, { cwd: ROOT, stdio: 'inherit' });

const fail = (message) => {
  console.error(`\npublish: ${message}`);
  process.exit(1);
};

/** Asks the registry, never the cache. Returns null when it has no answer. */
function registryJson(name, field) {
  try {
    // --prefer-online: npm's metadata cache answered a just-published version
    // with the previous one, which is indistinguishable from a failed publish.
    return JSON.parse(
      capture('npm', ['view', name, field, '--json', '--prefer-online']),
    );
  } catch (error) {
    const text = `${error.stdout ?? ''}${error.stderr ?? ''}`;
    if (text.includes('E404')) return null;
    throw error;
  }
}

/** Every version of a package on the registry; [] when it has none. */
function publishedVersions(name) {
  const parsed = registryJson(name, 'versions');
  if (parsed === null) return [];
  return Array.isArray(parsed) ? parsed : [parsed];
}

/** The most recent read failure, for the report to quote. */
let lastReadFailure = null;

/**
 * Whether the registry serves this version: `true`, `false`, or `null` for
 * "could not be asked".
 *
 * **Three answers, because there are three states.** `registryJson` turns only
 * `E404` into an answer and rethrows everything else, which is right while
 * planning — publishing on the strength of a read that failed is exactly the
 * mistake to avoid. After publishing it is wrong: a timeout, a 5xx or a reset
 * would come out of the verification loop as an unhandled throw, exiting 1
 * with a stack trace on a release where every publish succeeded — the very
 * code this run uses for "a publish failed".
 *
 * So a read failure here is a third state that keeps its own message. Nothing
 * is republished on the strength of it either way.
 */
function servesVersion(name, version) {
  try {
    return publishedVersions(name).includes(version);
  } catch (error) {
    lastReadFailure = error?.message ?? String(error);
    return null;
  }
}

/** What the package's `latest` dist-tag points at, or null. */
function latestTag(name) {
  return registryJson(name, 'dist-tags')?.latest ?? null;
}

/** The release tag this package's version is published from. */
function tagFor(dir, version) {
  // Every package is tagged `<dir>-v<version>`. The bare `v<version>` form was
  // the facade's, which had the repository's name; it is deleted, and no
  // package inherits the plain tag.
  return `${dir}-v${version}`;
}

/**
 * Variables that make git look at a repository, index or object store other
 * than ROOT's. Inherited, they would send every guard to a clean clone with the
 * same tags while npm publishes from ROOT.
 */
const GIT_REDIRECTS = [
  'GIT_DIR',
  'GIT_WORK_TREE',
  'GIT_INDEX_FILE',
  'GIT_OBJECT_DIRECTORY',
  'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  'GIT_COMMON_DIR',
  'GIT_NAMESPACE',
  'GIT_CEILING_DIRECTORIES',
  'GIT_DISCOVERY_ACROSS_FILESYSTEM',
];

/** Captured output of `git <args>` run in ROOT, with no redirection inherited. */
function captureGit(args) {
  const env = { ...process.env };
  for (const name of GIT_REDIRECTS) delete env[name];
  // Pinned explicitly: `-C` alone leaves a repository-local `core.worktree`
  // free to point status and ls-files at another tree. `core.ignoreCase=true`
  // matches .gitignore patterns without case, so `build/` hid an untracked
  // `BUILD/` that npm would pack (measured); the guard matches as written.
  return capture(
    'git',
    [
      `--git-dir=${path.join(ROOT, '.git')}`,
      `--work-tree=${ROOT}`,
      '-c',
      'core.ignoreCase=false',
      ...args,
    ],
    { env },
  );
}

/** True when `git <args>` exits 0; for the questions git answers by status. */
function gitSucceeds(args) {
  try {
    captureGit(args);
    return true;
  } catch {
    return false;
  }
}

// --- the argument ---------------------------------------------------------

// npm refuses a dist-tag that is a valid SemVer range, the empty string
// included. It refuses it at publish time, though — after the check has run and,
// in a multi-package release, after earlier packages have already gone out. A
// malformed tag should cost nothing, so it fails here instead.
if (NPM_TAG !== null && semver.validRange(NPM_TAG) !== null)
  fail(
    `--tag=${NPM_TAG === '' ? '' : NPM_TAG} is not a usable dist-tag: npm refuses a tag name that is a\n` +
      'valid SemVer range, and would refuse it only once publishing had started.',
  );

// --- the plan -------------------------------------------------------------

// `publishOrder` is in dependency order, and publishing follows it: a package
// must never reach the registry before something it depends on. The packages
// are not workspaces — each depends on its siblings as published.
const { publishOrder } = readJson(path.join(ROOT, 'package.json'));

const plan = publishOrder.map((workspace) => {
  const dir = path.basename(workspace);
  const manifest = readJson(path.join(ROOT, workspace, 'package.json'));
  const versions = publishedVersions(manifest.name);
  return {
    dir,
    name: manifest.name,
    local: manifest.version,
    versions,
    latest: versions.length > 0 ? latestTag(manifest.name) : null,
    published: versions.includes(manifest.version),
  };
});

const width = Math.max(...plan.map((p) => p.name.length));
console.log(`${'PACKAGE'.padEnd(width)}  LOCAL       LATEST      ACTION`);
for (const p of plan) {
  const action = p.published ? 'up to date' : 'PUBLISH';
  console.log(
    `${p.name.padEnd(width)}  ${p.local.padEnd(10)}  ${(p.latest ?? 'none').padEnd(10)}  ${action}`,
  );
}

const pending = plan.filter((p) => !p.published);

if (pending.length === 0) {
  console.log('\nNothing to publish: every local version is on the registry.');
  process.exit(0);
}

// --- the guards -----------------------------------------------------------
//
// Each one refuses to publish something that cannot be traced back to this
// repository's history, or that would move the `latest` dist-tag backwards.

/**
 * Every guard on the tree and the tags. Run before the check and again after
 * the pause: the pause waits for as long as the operator is away, and what is
 * published is the tree as it is when Enter is pressed, not as it was checked.
 */
function guard() {
  // Two questions, because neither command alone is immune to configuration:
  // tracked changes (`--untracked-files=no`), and untracked files with only the
  // repository's own .gitignore files applied. `--exclude-standard` is left out
  // on purpose: it reads core.excludesFile and .git/info/exclude, which are not in
  // the committed tree and can hide a source file that would be published.
  //
  // Tracked changes are asked of the whole tree: an edited build script or
  // configuration changes what the check proves. Untracked files are asked only
  // of the packages' directories, the only places a tarball is packed from; a
  // file of the operator's machine at the root (an editor's or an agent's local
  // settings) is no part of any release and blocked one.
  if (
    captureGit(['status', '--porcelain', '--untracked-files=no']).trim() !==
      '' ||
    captureGit([
      'ls-files',
      '--others',
      '--exclude-per-directory=.gitignore',
      '--',
      ...publishOrder,
    ]).trim() !== ''
  )
    fail(
      'the working tree is dirty. Publish only what is committed, or the tarball\n' +
        'holds changes no commit and no tag describes.',
    );

  // `assume-unchanged` (also what core.ignoreStat sets) and `skip-worktree` tell
  // git not to look at a tracked file, so an edited one is invisible to the status
  // above. `ls-files -v` marks the first with a lowercase tag and the second with
  // `S` (`s` when both are set).
  const flagged = captureGit(['ls-files', '-v'])
    .split('\n')
    .filter((line) => {
      const tag = line.charAt(0);
      return tag === 'S' || (tag !== '' && tag !== tag.toUpperCase());
    })
    .map((line) => line.slice(2));
  if (flagged.length > 0)
    fail(
      `${flagged.length} index entries are flagged assume-unchanged or skip-worktree, which hide edits\n` +
        'from the dirty-tree guard (core.ignoreStat sets the first):\n' +
        `${flagged
          .slice(0, 10)
          .map((f) => `  ${f}`)
          .join('\n')}\n` +
        'Clear them with `git update-index --no-assume-unchanged` and\n' +
        '`git update-index --no-skip-worktree`, then check the tree again.',
    );

  for (const p of pending) {
    if (!semver.valid(p.local))
      fail(`${p.name} has version "${p.local}", which is not valid semver.`);

    const tag = tagFor(p.dir, p.local);

    if (!gitSucceeds(['rev-parse', '-q', '--verify', `refs/tags/${tag}`]))
      fail(
        `${p.name} ${p.local} has no tag ${tag}.\n` +
          'A published version that is not tagged cannot be checked out again.',
      );

    if (!gitSucceeds(['merge-base', '--is-ancestor', tag, 'HEAD']))
      fail(
        `${tag} is not an ancestor of HEAD.\n` +
          'HEAD is not the history that tag belongs to.',
      );

    // Ancestry alone is not traceability: a commit after the tag can change a
    // package without bumping it, and the tarball would then carry content the
    // tagged version never had. The tree has to BE the tagged tree.
    if (!gitSucceeds(['diff', '--quiet', tag, 'HEAD'])) {
      const changed = captureGit(['diff', '--name-only', tag, 'HEAD'])
        .trim()
        .split('\n')
        .slice(0, 10);
      fail(
        `HEAD differs from ${tag}, so the tarball would not be what that tag names:\n` +
          `${changed.map((f) => `  ${f}`).join('\n')}\n` +
          `Publish the tagged tree (git checkout ${tag}) or bump and tag again.`,
      );
    }

    // A prerelease published without a dist-tag becomes `latest`, which is how a
    // beta reaches everyone who asked for the stable line.
    if (semver.prerelease(p.local) && TARGETS_LATEST)
      fail(
        `${p.name} ${p.local} is a prerelease and this publish targets \`latest\`\n` +
          `(${NPM_TAG === null ? 'no --tag was given' : '--tag=latest names it explicitly'}).\n` +
          'A prerelease on `latest` reaches everyone who asked for the stable line.\n' +
          'Pass --tag=next, or another name that is not `latest`.',
      );

    // Only `latest` can be moved backwards, so this asks about the dist-tag
    // rather than about the greatest version that exists.
    if (TARGETS_LATEST && p.latest !== null && semver.gt(p.latest, p.local))
      fail(
        `${p.name} ${p.local} is lower than the published latest ${p.latest}.\n` +
          'Publishing it to `latest` would move that tag backwards. Pass a --tag\n' +
          'other than `latest` to publish it somewhere else.',
      );
  }
}

guard();
const HEAD = captureGit(['rev-parse', 'HEAD']).trim();

console.log(
  `\nTo publish${NPM_TAG ? ` under the "${NPM_TAG}" tag` : ''}, in dependency order: ${pending
    .map((p) => `${p.name}@${p.local}`)
    .join(', ')}`,
);

if (DRY_RUN) {
  console.log('--dry-run: nothing was published.');
  process.exit(0);
}

// --- the gate, once -------------------------------------------------------

if (pending.length > 1)
  console.log(
    `\n${pending.length} packages will be published one after another, and npm asks for\n` +
      'two-factor authentication for each one it does not exempt. Each prompt waits for you; a prompt that\n' +
      'times out fails that package and stops the run, leaving the ones before it\n' +
      'published. Re-running resumes — they show as up to date.',
  );

/**
 * The steps of the root `check` script, when it is a plain chain of
 * `npm run <name>` joined by ` && `; otherwise the one step `check`. Read as
 * text, never evaluated.
 */
function checkSteps() {
  const script = readJson(path.join(ROOT, 'package.json')).scripts?.check;
  if (typeof script !== 'string') return ['check'];
  const steps = [];
  for (const part of script.split(' && ')) {
    const command = part.trim();
    if (!command.startsWith('npm run ')) return ['check'];
    const name = command.slice('npm run '.length);
    if (name === '' || name.includes(' ')) return ['check'];
    steps.push(name);
  }
  return steps;
}

/** The last `count` lines of `file` from byte `from` on. */
function tail(file, from, count) {
  const text = fs.readFileSync(file).subarray(from).toString('utf8');
  const lines = text.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  return lines.slice(-count).join('\n');
}

const LOG = path.join(
  fs.mkdtempSync(path.join(os.tmpdir(), 'publish-check-')),
  'check.log',
);
console.log(
  `\nRunning npm run check once for the whole release; output: ${LOG}\n`,
);
for (const step of checkSteps()) {
  const from = fs.existsSync(LOG) ? fs.statSync(LOG).size : 0;
  fs.appendFileSync(LOG, `\n===== npm run ${step} =====\n`);
  const started = Date.now();
  const fd = fs.openSync(LOG, 'a');
  let ok = true;
  try {
    execFileSync('npm', ['run', step], {
      cwd: ROOT,
      stdio: ['ignore', fd, fd],
    });
  } catch {
    ok = false;
  } finally {
    fs.closeSync(fd);
  }
  const seconds = Math.round((Date.now() - started) / 1000);
  console.log(`${ok ? '  ok  ' : 'FAIL  '}npm run ${step} (${seconds}s)`);
  if (!ok) {
    console.error(`\n${tail(LOG, from, 40)}`);
    fail(
      `npm run ${step} failed. Nothing was published.\n` +
        `The whole output is in ${LOG}`,
    );
  }
}

/**
 * One line from stdin, read synchronously; null at the end of input. Only
 * whether it is empty matters, so the bytes are not decoded as a whole.
 */
function readLine() {
  const byte = Buffer.alloc(1);
  let line = '';
  for (;;) {
    let read;
    try {
      read = fs.readSync(0, byte, 0, 1, null);
    } catch (error) {
      if (error.code === 'EAGAIN') {
        sleep(50);
        continue;
      }
      if (error.code === 'EOF') return null;
      throw error;
    }
    if (read === 0) return line === '' ? null : line;
    const char = byte.toString('latin1');
    if (char === '\n') return line;
    if (char !== '\r') line += char;
  }
}

console.log(
  `\nThe check passed. Press Enter to publish ${pending.length} package(s); npm will\n` +
    'ask you to log in. Anything else, or the end of input, publishes nothing.',
);
const answer = readLine();
if (answer !== '')
  fail(
    `${answer === null ? 'No answer was given' : 'The answer was not Enter'}. Nothing was published.`,
  );

// Nothing that changed while the run waited is published: the same guards
// again, and HEAD must be the commit the check ran on.
guard();
if (captureGit(['rev-parse', 'HEAD']).trim() !== HEAD)
  fail(
    'HEAD moved while the run waited, so the check did not run on what would be\n' +
      'published. Nothing was published; run it again.',
  );

// --- publish --------------------------------------------------------------

/**
 * Wait, within one shared budget, for the registry to serve each of these.
 *
 * **Every decision this file makes about the registry goes through here**, so
 * none of them is taken on a single read. That was the flaw two reviews kept
 * finding corners of: a read is asked once, the answer is stale, and a
 * conclusion is drawn -- a refusal called a failure, a publish called
 * invisible, a re-run recommended into the same wall. One helper, one budget,
 * and the only conclusions drawn are the ones the budget has earned.
 *
 * Each entry comes back with `served`: `true`, `false` (asked to the end and
 * never there) or `null` (the registry could not be asked).
 */
function confirm(entries, attempts) {
  const waiting = entries.filter((e) => e.served !== true);
  for (
    let attempt = 1;
    attempt <= attempts && waiting.length > 0;
    attempt += 1
  ) {
    for (let i = waiting.length - 1; i >= 0; i -= 1) {
      const entry = waiting[i];
      entry.served = servesVersion(entry.package.name, entry.package.local);
      if (entry.served !== true) continue;
      console.log(
        `${entry.package.name}@${entry.package.local} is on the registry.`,
      );
      waiting.splice(i, 1);
    }
    if (waiting.length > 0) sleep(POLL_MS);
  }
  return entries;
}

/** `name@version`, one per line, indented for a report. */
const listed = (entries) =>
  entries.map((e) => `  ${e.package.name}@${e.package.local}`).join('\n');

const attempted = [];

for (const p of pending) {
  console.log(`\nPublishing ${p.name}@${p.local}\n`);
  const entry = { package: p, refused: false, served: undefined };
  try {
    // --ignore-scripts: prepublishOnly is `npm run check`, which just ran. It
    // stays in each package.json as the net for a publish by hand.
    // `./` makes the spec a folder: npm reads a bare `packages/<dir>` as the
    // GitHub shorthand `user/repo` and asks git for it. Runs from ROOT.
    const args = ['publish', `./packages/${p.dir}`, '--ignore-scripts'];
    if (NPM_TAG !== null) args.push('--tag', NPM_TAG);
    interactive('npm', args);
  } catch {
    entry.refused = true;
  }
  attempted.push(entry);

  // **A refused publish is not yet a failed one, and one read cannot tell.**
  // The likeliest way to meet a refusal is a re-run whose plan was built from
  // a read that is behind: the version IS published, and npm says so by
  // refusing it. So the same budget everything else gets is spent here before
  // anything is concluded -- and a refusal only stops the run once the
  // registry has been asked to the end and still does not have it.
  //
  // It stops then because what follows depends on it: these packages are
  // published in dependency order, and a package whose dependency was never
  // accepted would declare a version nobody can install.
  if (!entry.refused) continue;
  console.log(
    `\n${p.name}@${p.local} was refused. Asking the registry whether it is ` +
      'already published.\n',
  );
  confirm([entry], POLL_ATTEMPTS);
  if (entry.served === true) {
    console.log(`${p.name}@${p.local} is already published. Continuing.`);
    continue;
  }

  // Everything published so far is confirmed before the report, so the advice
  // in it can be specific instead of hedged. This costs nothing: those reads
  // would otherwise happen at the end of the run that is about to stop.
  // **"Published by this run" must mean it.** `attempted` also holds packages
  // npm refused and the registry then vouched for — published by an EARLIER
  // run, met again because the plan was built from a stale read. Counting
  // those as this run's work would make the one report an operator reads
  // during a partial release describe a release that did not happen.
  const done = attempted.filter((e) => e !== entry);
  confirm(done, POLL_ATTEMPTS);
  const ours = done.filter((e) => !e.refused);
  const earlier = done.filter((e) => e.refused);
  const visible = ours.filter((e) => e.served === true);
  const pendingVisibility = ours.filter((e) => e.served !== true);

  fail(
    `${p.name}@${p.local} did not publish. Later packages were not attempted.\n` +
      (entry.served === null
        ? 'The registry could not be read, so whether this version is published\n' +
          `is UNKNOWN${lastReadFailure ? `:\n  ${lastReadFailure.split('\n')[0]}` : '.'}\n` +
          'It may have been accepted. Settle that before anything else:\n' +
          `  npm view ${p.name} versions --prefer-online\n`
        : `The registry was asked for ${Math.round((POLL_ATTEMPTS * POLL_MS) / 1000)}s and does not have it, so this is not a\n` +
          'publish that had already happened. If the two-factor prompt timed\n' +
          'out, that is all this was.\n') +
      (earlier.length > 0
        ? `Already on the registry before this run, not published by it:\n${listed(earlier)}\n`
        : '') +
      (ours.length === 0
        ? 'Nothing was published by this run, so a re-run has nothing of its\n' +
          'own to collide with.'
        : `Published by this run and confirmed:\n${visible.length > 0 ? `${listed(visible)}\n` : '  (none)\n'}` +
          (pendingVisibility.length > 0
            ? 'Published by this run and NOT yet visible:\n' +
              `${listed(pendingVisibility)}\n` +
              'Wait until each of those shows up before re-running, or they go\n' +
              'back into the plan and npm refuses them:\n' +
              '  npm view <package> versions --prefer-online'
            : 'All of them are visible, so a re-run skips them and continues\n' +
              'from the one above.')),
  );
}

// --- verify, once, at the end ---------------------------------------------

// The publish printing "+ name@version" is npm reporting what it SENT, not the
// registry reporting what it SERVES. Those differ for a while after a publish,
// and asking is the only way to tell a real failure from a late read.
//
// One budget for the whole release rather than one per package: the lag is the
// registry's, not each package's, and by the time the last publish is done the
// first has usually caught up. Whatever is still missing is asked about again
// each round, so nothing waits on a package ahead of it.
confirm(attempted, POLL_ATTEMPTS);

// Same distinction as the stop above: a package npm refused and the registry
// vouched for was published by an earlier run, and saying otherwise would
// overstate what happened here.
const ourPublishes = attempted.filter((e) => !e.refused);
const alreadyThere = attempted.filter((e) => e.refused);

console.log(`\nPublished ${ourPublishes.length} package(s).`);
if (alreadyThere.length > 0)
  console.log(
    `${alreadyThere.length} were already on the registry and were not published again:\n${listed(alreadyThere)}`,
  );

// Only this run's publishes can be waiting: one that was refused is here
// exactly because the registry vouched for it.
const unconfirmed = ourPublishes.filter((e) => e.served !== true);
if (unconfirmed.length > 0) {
  // Not `fail`: nothing here went wrong. Every version was accepted, and the
  // exit code says "published, not yet visible" rather than "publish failed",
  // because those call for different next steps and looked identical before.
  const unreadable = unconfirmed.filter((e) => e.served === null);
  console.error(
    `\npublish: ${unconfirmed.length} of ${ourPublishes.length} IS PUBLISHED but not confirmed, ` +
      `after ${Math.round((POLL_ATTEMPTS * POLL_MS) / 1000)}s:\n` +
      `${listed(unconfirmed)}\n` +
      (unreadable.length > 0
        ? 'The registry could not be read, so whether it serves them is unknown' +
          `${lastReadFailure ? `:\n  ${lastReadFailure.split('\n')[0]}` : '.'}\n`
        : 'The registry accepted them; only its read path is behind.\n') +
      'Nothing is lost and nothing needs publishing again. Check with:\n' +
      '  npm view <package> versions --prefer-online\n' +
      'and re-run only once that shows the version — a re-run before it would\n' +
      'put the package back in the plan and npm would refuse it.\n' +
      'PUBLISH_POLL_ATTEMPTS raises the wait.',
  );
  process.exit(2);
}
