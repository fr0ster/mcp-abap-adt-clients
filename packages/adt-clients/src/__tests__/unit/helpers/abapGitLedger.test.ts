/**
 * The abapGit live suite's correlation and recovery, over a stubbed R1.
 *
 * A cloud job is over only when R1 shows a log key other than the one noted
 * before the submit (L0) and a terminal status; cleanup stays blocked until
 * then. A cancelled or uncorrelated run keeps its fixtures and a ledger entry
 * with its backend and L0; a later run — a fresh reader of the file — waits
 * the same way, a terminal status under L0 included, then cleans up exactly
 * what the entry names and clears it.
 */

import {
  existsSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  AbapGitLedger,
  acquireRunLock,
  cleanUpEntry,
  type ICleanupSteps,
  type ILedgerEntry,
  type IRunRow,
  RunLockHeld,
  RunWaitCancelled,
  readRunLock,
  releasingRunLock,
  runState,
  waitForRun,
} from '../../helpers/abapGitLedger';

/** R1 answering `rows` in turn, the last one for good. */
function scriptedR1(rows: (IRunRow | undefined)[]) {
  let at = 0;
  const reads: (IRunRow | undefined)[] = [];
  return {
    reads,
    read: async (): Promise<IRunRow | undefined> => {
      const row = rows[Math.min(at, rows.length - 1)];
      at += 1;
      reads.push(row);
      return row;
    },
  };
}

const row = (runStatus: string | undefined, appLogKey: string | undefined) => ({
  runStatus,
  appLogKey,
});

const live = () => new AbortController().signal;

describe('the cloud-run correlation', () => {
  it('waits through terminal/L0, R/L0 and terminal/L0 after the submit; ends on terminal/L1', async () => {
    // Before the submit R1 shows a finished earlier run: L0.
    const l0 = 'L0';
    expect(runState(row('S', l0), l0)).toBe('waiting');
    const r1 = scriptedR1([
      row('R', l0),
      row('S', l0),
      row(' ', 'L1'),
      row('R', 'L1'),
      row('W', 'L1'),
    ]);
    const ended = await waitForRun(r1.read, { what: 'pull', l0 }, live(), 0);
    expect(ended).toEqual({ runStatus: 'W', appLogKey: 'L1' });
    expect(r1.reads).toHaveLength(5);
  });

  it('takes any log key when there was none before', () => {
    expect(runState(row('E', 'L1'), null)).toBe('terminal');
    expect(runState(row('E', undefined), null)).toBe('waiting');
    expect(runState(row(undefined, 'L1'), null)).toBe('waiting');
    expect(runState(undefined, null)).toBe('gone');
  });

  it('a cancelled wait rejects, naming L0 and the last row', async () => {
    const cancelled = new AbortController();
    const r1 = scriptedR1([row('R', 'L0')]);
    const waiting = waitForRun(
      r1.read,
      { what: 'pull', l0: 'L0' },
      cancelled.signal,
      5,
    );
    cancelled.abort();
    await expect(waiting).rejects.toBeInstanceOf(RunWaitCancelled);
    await expect(
      waitForRun(r1.read, { what: 'pull', l0: 'L0' }, cancelled.signal, 5),
    ).rejects.toThrow(/other than L0/);
  });
});

describe('the recovery ledger', () => {
  let dir: string;
  let file: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'abapgit-ledger-'));
    file = join(dir, 'ledger.json');
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const entry: ILedgerEntry = {
    runId: 'RUN1',
    backend: 'cloud',
    systemKey: 'https://system client=100',
    url: 'https://git.example.invalid/r.git',
    branches: ['b1', 'b2'],
    package: 'ZAGL_RUN1',
    interfaces: ['ZIF_AGL_RUN1'],
    repoKey: 'K1',
    pending: { what: 'pullRepo', l0: 'L0' },
  };

  function recordingSteps(rows: (IRunRow | undefined)[]) {
    const done: string[] = [];
    const remotes: string[] = [];
    const r1 = scriptedR1(rows);
    let linked = true;
    const steps: ICleanupSteps = {
      readRow: async () => (linked ? r1.read() : undefined),
      unlink: async (key) => {
        done.push(`unlink ${key}`);
        linked = false;
      },
      deleteInterface: async (name) => {
        done.push(`interface ${name}`);
      },
      deletePackage: async (name) => {
        done.push(`package ${name}`);
      },
      deleteBranch: async (name, remoteUrl) => {
        done.push(`branch ${name}`);
        remotes.push(remoteUrl);
      },
    };
    return { done, steps, r1, remotes };
  }

  it('an uncorrelated run keeps its fixtures and its entry with the backend and L0', async () => {
    const ledger = new AbapGitLedger(file);
    ledger.put(entry);
    const { done, steps } = recordingSteps([row('R', 'L0')]);
    const cancelled = new AbortController();
    const cleaning = cleanUpEntry(ledger, 'RUN1', steps, cancelled.signal, 5);
    cancelled.abort();
    await expect(cleaning).rejects.toBeInstanceOf(RunWaitCancelled);
    expect(done).toEqual([]);
    // A fresh process reads only the file.
    expect(new AbapGitLedger(file).find('RUN1')).toEqual(entry);
  });

  it('a later run waits past terminal/L0, then cleans up what the entry names and clears it', async () => {
    new AbapGitLedger(file).put(entry);
    const restarted = new AbapGitLedger(file);
    expect(restarted.entriesOf('cloud', entry.systemKey)).toHaveLength(1);
    expect(restarted.entriesOf('onprem', entry.systemKey)).toEqual([]);
    const { done, steps, r1, remotes } = recordingSteps([
      row('S', 'L0'),
      row('R', 'L1'),
      row('S', 'L1'),
    ]);
    await cleanUpEntry(restarted, 'RUN1', steps, live(), 0);
    // Nothing was cleaned up while R1 showed terminal/L0 or R/L1.
    expect(r1.reads.slice(0, 3)).toEqual([
      row('S', 'L0'),
      row('R', 'L1'),
      row('S', 'L1'),
    ]);
    // Each branch is deleted in the remote the entry recorded.
    expect(remotes).toEqual([entry.url, entry.url]);
    expect(done).toEqual([
      'unlink K1',
      'interface ZIF_AGL_RUN1',
      'package ZAGL_RUN1',
      'branch b1',
      'branch b2',
    ]);
    expect(new AbapGitLedger(file).entries()).toEqual([]);
  });

  it('a cleanup cut short resumes where it stopped: what is done is struck from the entry', async () => {
    const ledger = new AbapGitLedger(file);
    ledger.put({ ...entry, pending: undefined });
    const { steps } = recordingSteps([row('S', 'L1')]);
    const failing: ICleanupSteps = {
      ...steps,
      deletePackage: async () => {
        throw new Error('refused');
      },
    };
    await expect(
      cleanUpEntry(ledger, 'RUN1', failing, live(), 0),
    ).rejects.toThrow('refused');
    const left = new AbapGitLedger(file).find('RUN1');
    expect(left?.repoKey).toBeUndefined();
    expect(left?.interfaces).toEqual([]);
    expect(left?.package).toBe('ZAGL_RUN1');
    expect(left?.branches).toEqual(['b1', 'b2']);
  });

  it('refuses to report an unlink R1 still lists', async () => {
    const ledger = new AbapGitLedger(file);
    ledger.put({ ...entry, pending: undefined });
    const { steps } = recordingSteps([row('S', 'L1')]);
    const ignored: ICleanupSteps = { ...steps, unlink: async () => {} };
    await expect(
      cleanUpEntry(ledger, 'RUN1', ignored, live(), 0),
    ).rejects.toThrow(/still listed after unlink/);
    expect(new AbapGitLedger(file).find('RUN1')?.repoKey).toBe('K1');
  });
});

describe('the run lock', () => {
  let dir: string;
  let file: string;
  const content = { pid: 4242, startedAt: '2026-11-22T10:00:00.000Z' };
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'abapgit-lock-'));
    file = join(dir, 'abapgit-live.lock');
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('the lock holds its whole content as soon as the file exists, and no temporary file is left', () => {
    const release = acquireRunLock(file, content);
    // The file appears by a hard link of a fully written file: there is no
    // moment it exists empty or half written.
    expect(readRunLock(file)).toEqual(content);
    expect(readdirSync(dir)).toEqual(['abapgit-live.lock']);
    release();
    expect(existsSync(file)).toBe(false);
  });

  it('an existing lock refuses, alive or not, naming its file, pid and start; it stays as it was', () => {
    const release = acquireRunLock(file, content);
    let refusal: unknown;
    try {
      acquireRunLock(file, { pid: 5151, startedAt: 'later' });
    } catch (error) {
      refusal = error;
    }
    expect(refusal).toBeInstanceOf(RunLockHeld);
    const message = (refusal as Error).message;
    expect(message).toContain(file);
    expect(message).toContain('pid 4242');
    expect(message).toContain('started 2026-11-22T10:00:00.000Z');
    expect(message).toContain('remove');
    expect(readRunLock(file)).toEqual(content);
    expect(readdirSync(dir)).toEqual(['abapgit-live.lock']);
    release();
    // A lock no live process holds refuses all the same: no takeover.
    writeFileSync(file, JSON.stringify({ pid: 999999999, startedAt: 'x' }));
    expect(() => acquireRunLock(file, content)).toThrow(RunLockHeld);
  });

  it('the release runs when the teardown throws, and the teardown error is kept', async () => {
    const release = acquireRunLock(file, content);
    await expect(
      releasingRunLock(release, async () => {
        JSON.parse('not a ledger');
      }),
    ).rejects.toThrow(SyntaxError);
    expect(existsSync(file)).toBe(false);
  });
});
