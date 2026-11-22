/**
 * The abapGit live suite's recovery ledger and the cloud-run correlation.
 *
 * **Correlation (spec §7).** Before a cloud run is submitted, the suite notes
 * the repository's log key in R1 (`L0`). The run is this run's — and over —
 * only once R1 shows a log key other than `L0` **and** a terminal status
 * (`S`, `W`, `E`, `A`); blank (initial) and `R` mean waiting, and a terminal
 * status under `L0` is the previous run's. The wait ends on SAP's answer or
 * the caller's own cancel; nothing here picks a deadline.
 *
 * **Recovery.** Every fixture is recorded here before it is relied on and as
 * soon as it exists — the branches, the package, each object, the repository
 * key, and a submitted cloud run with its `L0`. A run that is cancelled, or
 * that cannot correlate its job, keeps its fixtures and its entry; the next
 * run works the ledger first: for each entry of its own backend and system it
 * waits as above, then cleans up exactly what the entry names, and removes
 * the entry. Nothing the entry does not name is ever deleted.
 *
 * The file is gitignored and sits beside the test config.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';

export type AbapGitBackend = 'onprem' | 'cloud';

/** R1's terminal run statuses (`IF_ABAPGIT_APP_LOG=>c_run_status`). */
export const TERMINAL_STATUSES: readonly string[] = ['S', 'W', 'E', 'A'];

export const LEDGER_FILE = join(__dirname, 'abapgit-live.ledger.json');

/** A cloud run submitted and not yet seen terminal under a new log key. */
export interface IPendingRun {
  /** What was submitted (`push`, `pullRepo`, …), for messages. */
  readonly what: string;
  /** R1's log key for the repository before the submit; `null`: none. */
  readonly l0: string | null;
}

export interface ILedgerEntry {
  readonly runId: string;
  readonly backend: AbapGitBackend;
  /** The system the run reached: its address and client, no credential. */
  readonly systemKey: string;
  /** The remote URL SAP was given. */
  readonly url: string;
  /** Branches this run created in the remote. */
  readonly branches: readonly string[];
  /** The package this run created, once created. */
  readonly package?: string | undefined;
  /** The request the package and objects were recorded in (onprem). */
  readonly transportRequest?: string | undefined;
  /** Interfaces this run created, once created. */
  readonly interfaces: readonly string[];
  /** The repository key, once linked. */
  readonly repoKey?: string | undefined;
  /** A cloud run whose end has not been seen. */
  readonly pending?: IPendingRun | undefined;
}

/** One repository's run state in R1. */
export interface IRunRow {
  readonly runStatus: string | undefined;
  readonly appLogKey: string | undefined;
}

export type RunState = 'waiting' | 'terminal' | 'gone';

/**
 * Where a submitted run stands, read off R1's row for its repository:
 * `terminal` only with a log key other than `l0` and a terminal status.
 */
export function runState(
  row: IRunRow | undefined,
  l0: string | null,
): RunState {
  if (row === undefined) return 'gone';
  const fresh =
    row.appLogKey !== undefined && row.appLogKey !== '' && row.appLogKey !== l0;
  const terminal =
    row.runStatus !== undefined && TERMINAL_STATUSES.includes(row.runStatus);
  return fresh && terminal ? 'terminal' : 'waiting';
}

/** The caller cancelled the wait. */
export class RunWaitCancelled extends Error {
  constructor(what: string, l0: string | null, last: IRunRow | undefined) {
    super(
      `the wait for ${what} was cancelled before R1 showed a log key other than ${l0 ?? '(none)'} with a terminal status (last seen: status ${last?.runStatus ?? '(none)'}, log key ${last?.appLogKey ?? '(none)'})`,
    );
    this.name = 'RunWaitCancelled';
  }
}

function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const done = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal.addEventListener('abort', done, { once: true });
  });
}

/**
 * Poll R1 (through `readRow`) until the run is terminal under a new log key.
 * Answers that row; rejects with {@link RunWaitCancelled} when `signal`
 * aborts first, and when the repository leaves R1 (nothing left to wait on).
 */
export async function waitForRun(
  readRow: () => Promise<IRunRow | undefined>,
  pending: IPendingRun,
  signal: AbortSignal,
  intervalMs = 3000,
): Promise<IRunRow & { readonly appLogKey: string }> {
  let last: IRunRow | undefined;
  for (;;) {
    if (signal.aborted)
      throw new RunWaitCancelled(pending.what, pending.l0, last);
    last = await readRow();
    const state = runState(last, pending.l0);
    if (state === 'terminal' && last?.appLogKey)
      return { ...last, appLogKey: last.appLogKey };
    if (state === 'gone')
      throw new Error(
        `the repository left the repository list while waiting for ${pending.what}`,
      );
    await pause(intervalMs, signal);
  }
}

/** The ledger file: entries by run id, written whole on every change. */
export class AbapGitLedger {
  constructor(private readonly file: string = LEDGER_FILE) {}

  entries(): ILedgerEntry[] {
    if (!existsSync(this.file)) return [];
    const parsed: unknown = JSON.parse(readFileSync(this.file, 'utf8'));
    if (!Array.isArray(parsed))
      throw new Error(`${this.file} is not a ledger: expected a JSON array`);
    return parsed as ILedgerEntry[];
  }

  /** The entries of one backend and system: the only ones a run touches. */
  entriesOf(backend: AbapGitBackend, systemKey: string): ILedgerEntry[] {
    return this.entries().filter(
      (entry) => entry.backend === backend && entry.systemKey === systemKey,
    );
  }

  find(runId: string): ILedgerEntry | undefined {
    return this.entries().find((entry) => entry.runId === runId);
  }

  /** Record the entry, replacing the one of its run id. */
  put(entry: ILedgerEntry): void {
    const others = this.entries().filter((e) => e.runId !== entry.runId);
    this.write([...others, entry]);
  }

  /** Change the entry of `runId`; refused when there is none. */
  amend(
    runId: string,
    change: (entry: ILedgerEntry) => ILedgerEntry,
  ): ILedgerEntry {
    const entry = this.find(runId);
    if (!entry) throw new Error(`no ledger entry for run ${runId}`);
    const next = change(entry);
    this.put(next);
    return next;
  }

  remove(runId: string): void {
    this.write(this.entries().filter((entry) => entry.runId !== runId));
  }

  private write(entries: readonly ILedgerEntry[]): void {
    mkdirSync(dirname(this.file), { recursive: true });
    const temporary = `${this.file}.${process.pid}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(entries, null, 2)}\n`, {
      mode: 0o600,
    });
    renameSync(temporary, this.file);
  }
}

/** What cleaning up one ledger entry needs, injected by the suite. */
export interface ICleanupSteps {
  /** R1's row for the key, or `undefined` when R1 does not list it. */
  readonly readRow: (repoKey: string) => Promise<IRunRow | undefined>;
  readonly unlink: (repoKey: string) => Promise<void>;
  readonly deleteInterface: (
    name: string,
    transportRequest: string | undefined,
  ) => Promise<void>;
  readonly deletePackage: (
    name: string,
    transportRequest: string | undefined,
  ) => Promise<void>;
  readonly deleteBranch: (name: string) => Promise<void>;
}

/**
 * Clean up exactly what `entry` names, in the spec's order: wait for a
 * pending cloud run, unlink (asserting R1 no longer lists the key), delete
 * the objects, the package, the branches; then remove the entry. Each step
 * that succeeds is struck from the entry first, so a cleanup cut short
 * resumes where it stopped. The wait is bounded by `signal` alone.
 */
export async function cleanUpEntry(
  ledger: AbapGitLedger,
  runId: string,
  steps: ICleanupSteps,
  signal: AbortSignal,
  intervalMs?: number,
): Promise<void> {
  let entry = ledger.find(runId);
  if (!entry) return;
  const { repoKey } = entry;
  if (entry.pending && repoKey) {
    await waitForRun(
      () => steps.readRow(repoKey),
      entry.pending,
      signal,
      intervalMs,
    );
    entry = ledger.amend(runId, (e) => ({ ...e, pending: undefined }));
  }
  if (repoKey) {
    if ((await steps.readRow(repoKey)) !== undefined)
      await steps.unlink(repoKey);
    if ((await steps.readRow(repoKey)) !== undefined)
      throw new Error(`repository ${repoKey} is still listed after unlink`);
    entry = ledger.amend(runId, (e) => ({ ...e, repoKey: undefined }));
  }
  for (const name of entry.interfaces) {
    await steps.deleteInterface(name, entry.transportRequest);
    entry = ledger.amend(runId, (e) => ({
      ...e,
      interfaces: e.interfaces.filter((n) => n !== name),
    }));
  }
  if (entry.package) {
    await steps.deletePackage(entry.package, entry.transportRequest);
    entry = ledger.amend(runId, (e) => ({ ...e, package: undefined }));
  }
  for (const name of entry.branches) {
    await steps.deleteBranch(name);
    entry = ledger.amend(runId, (e) => ({
      ...e,
      branches: e.branches.filter((n) => n !== name),
    }));
  }
  ledger.remove(runId);
}
