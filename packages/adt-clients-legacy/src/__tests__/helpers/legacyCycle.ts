/**
 * What the live cycles (`src/__tests__/integration/legacy/cycles/`) share:
 * one object of a cycle, which this run creates and removes, and the check of
 * the full ordered sequence a step sent.
 *
 * A cycle creates its own objects in `$TMP` (no transport) and deletes them
 * itself, as its last steps. The cleanup behind it ({@link runCycle}) is the
 * net for a cycle that stopped half-way: it touches only an object this run
 * created — a name it proved free (`validate`) and absent before a create
 * that answered ok; after a create that failed it deletes nothing and names
 * the object if it is there — releases a lock the run still holds with that very handle, deletes what is
 * still there (lock, `DELETE ?lockHandle=`, unlock, as 7.40 SP04 deletes),
 * reads it back, and names every object left behind.
 */

import {
  analyseException,
  analyseValidation,
} from '@mcp-abap-adt/adt-strategies';
import type {
  IAdtResponse,
  IAdtValidatable,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import { integrationHeadersOf } from '../../../../adt-clients/src/__tests__/helpers/adtHeaders';
import {
  expectResult,
  raiseAfterCleanup,
} from '../../../../adt-clients/src/__tests__/helpers/contract';
import { judged } from '../../../../adt-clients/src/__tests__/helpers/judged';
import { presenceOf } from '../../../../adt-clients/src/__tests__/helpers/objectPresence';
import type {
  RecordedRequest,
  RequestRecorder,
} from '../../../../adt-clients/src/__tests__/helpers/requestRecorder';
import {
  deleteLocked,
  LEGACY_740,
  type LegacyDeletable,
  queryOf,
  sentSince,
} from './legacyLive';

/** A handler a cycle creates, locks, deletes and validates through. */
export interface LegacyCycleHandler<C>
  extends LegacyDeletable<C>,
    Pick<IAdtValidatable<C, unknown>, 'validate'> {}

/** What a cycle names: its label, its name and how to reach it. */
export interface CycleObjectSpec<
  C,
  H extends LegacyCycleHandler<C> = LegacyCycleHandler<C>,
> {
  readonly caseName: string;
  readonly label: string;
  readonly name: string;
  /** The config every member of the handler takes for this object. */
  readonly config: C;
  readonly handler: () => H;
  /**
   * What `validate` is asked before the create (the name, the package, the
   * description); the object's own config when absent.
   */
  readonly validateConfig?: Partial<C>;
  /**
   * The object has no delete of its own and goes with its container (a
   * function include with its group): the cleanup only releases a lock the
   * run still holds on it, and deletes nothing.
   */
  readonly removedWith?: string;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * One object of a cycle. It may be removed only once this run created it:
 * {@link requireFree} proves the name free first, {@link createOwned} records
 * that the create answered ok. The lock the run holds on it is kept here, so a
 * cycle that stops between `lock` and `unlock` is cleaned with that handle.
 */
export class CycleObject<
  C,
  H extends LegacyCycleHandler<C> = LegacyCycleHandler<C>,
> {
  private created = false;
  /** The create went out and did not answer ok: never this run's to delete. */
  private createFailed = false;
  private heldHandle: string | undefined;

  constructor(private readonly spec: CycleObjectSpec<C, H>) {}

  get label(): string {
    return this.spec.label;
  }

  get name(): string {
    return this.spec.name;
  }

  get config(): C {
    return this.spec.config;
  }

  get handler(): H {
    return this.spec.handler();
  }

  /** The handle of the lock the run holds now; `undefined` when none. */
  get held(): string | undefined {
    return this.heldHandle;
  }

  /** Whether the run created this object (so the cleanup may touch it). */
  get isCreated(): boolean {
    return this.created;
  }

  private get what(): string {
    return `${this.spec.label} ${this.spec.name}`;
  }

  /**
   * `validate` answers the name free, and the read answers it absent; else
   * the run stops before it creates anything. Deletes nothing: an object of
   * this name that exists is not this run's.
   */
  async requireFree(): Promise<void> {
    expectResult(
      await this.handler.validate(
        this.spec.validateConfig ?? this.spec.config,
        { analyse: judged(analyseValidation) },
      ),
      `${LEGACY_740}/${this.spec.caseName}: validate ${this.what}`,
    );
    const there = presenceOf(
      await this.handler.readMetadata(this.spec.config, {
        analyse: analyseException,
      }),
      this.what,
    );
    if (there.present === 'unknown') throw new Error(there.reason);
    if (there.present)
      throw new Error(
        `${LEGACY_740}/${this.spec.caseName}: ${this.what} already exists; name one that does not`,
      );
  }

  /**
   * Run the create, after {@link requireFree}. The object is this run's —
   * so the cleanup may delete it — only when the create answered ok. A
   * create that failed (another run took the name in between, say) makes
   * nothing this run's: the cleanup deletes nothing and names the object
   * when it is there, for removal by hand. Answers what the create answered.
   */
  async createOwned<T>(
    make: () => Promise<IAdtResponse<T>>,
  ): Promise<IAdtResponse<T>> {
    let answer: IAdtResponse<T>;
    try {
      answer = await make();
    } catch (error) {
      this.createFailed = true;
      throw error;
    }
    if (answer.ok) this.created = true;
    else this.createFailed = true;
    return answer;
  }

  /** `lock`, the handle kept for the cleanup; the answer as it came. */
  async lock(): Promise<IAdtResponse<string>> {
    const answer = await this.handler.lock(this.spec.config, {
      analyse: analyseException,
    });
    if (answer.ok && answer.getResult().value)
      this.heldHandle = answer.getResult().value;
    return answer;
  }

  /** `unlock` with the held handle; it is dropped once the unlock answered ok. */
  async unlock(): Promise<IAdtResponse<void>> {
    const handle = this.heldHandle;
    if (handle === undefined) throw new Error(`${this.what}: no lock is held`);
    const answer = await this.handler.unlock(this.spec.config, handle, {
      analyse: analyseException,
    });
    if (answer.ok) this.heldHandle = undefined;
    return answer;
  }

  /** The held handle, or the failure naming that none is held. */
  handle(): string {
    if (this.heldHandle === undefined)
      throw new Error(`${this.what}: no lock is held`);
    return this.heldHandle;
  }

  /**
   * Remove this object if the run created it and it is still there, release
   * a lock the run still holds on it, and read it back. Answers what is left
   * behind, naming the object, or `undefined`.
   */
  async cleanup(): Promise<string | undefined> {
    if (this.createFailed && !this.created) return this.failedCreateLeftover();
    if (!this.created) return undefined;
    const problems: string[] = [];
    try {
      const handle = this.heldHandle;
      if (this.spec.removedWith !== undefined) {
        if (handle !== undefined) {
          const answer = await this.unlock();
          if (!answer.ok)
            problems.push(`unlock failed: ${answer.getError().message}`);
        }
        return problems.length > 0
          ? `${this.what}: ${problems.join('; ')}`
          : undefined;
      }
      const there = presenceOf(
        await this.handler.readMetadata(this.spec.config, {
          analyse: analyseException,
        }),
        this.what,
      );
      if (there.present === 'unknown') {
        problems.push(there.reason);
        // The lock this run holds is released whatever the read answered.
        if (handle !== undefined) {
          const unlocked = await this.unlock();
          if (!unlocked.ok)
            problems.push(`unlock failed: ${unlocked.getError().message}`);
        }
        return `${this.what}: ${problems.join('; ')}`;
      }
      if (handle !== undefined) {
        if (there.present) {
          const deleted = await this.handler.delete(this.spec.config, {
            headers: integrationHeadersOf(this.handler, 'delete'),
            lockHandle: handle,
            analyse: analyseException,
          });
          if (!deleted.ok)
            problems.push(
              `delete under the held lock failed: ${deleted.getError().message}`,
            );
        }
        const unlocked = await this.unlock();
        if (!unlocked.ok)
          problems.push(`unlock failed: ${unlocked.getError().message}`);
      } else if (there.present) {
        expectResult(
          await deleteLocked(this.handler, this.spec.config, this.what),
          `delete ${this.what}`,
        );
      }
      const after = presenceOf(
        await this.handler.readMetadata(this.spec.config, {
          analyse: analyseException,
        }),
        this.what,
      );
      if (after.present === 'unknown') problems.push(after.reason);
      else if (after.present) problems.push('still there after the cleanup');
    } catch (error) {
      problems.push(messageOf(error));
    }
    return problems.length > 0
      ? `${this.what}: ${problems.join('; ')}`
      : undefined;
  }

  /** After a failed create: the object, if it is there, named and left alone. */
  private async failedCreateLeftover(): Promise<string | undefined> {
    try {
      const there = presenceOf(
        await this.handler.readMetadata(this.spec.config, {
          analyse: analyseException,
        }),
        this.what,
      );
      if (there.present === false) return undefined;
      if (there.present === 'unknown')
        return `${this.what}: the create failed, and whether the object is there is unknown (${there.reason}); check it and its owner by hand`;
      return `${this.what}: the create failed and the object is there — it may be another run's; check its owner and remove it by hand`;
    } catch (error) {
      return `${this.what}: the create failed, and the read after it threw: ${messageOf(error)}`;
    }
  }
}

/** One object of a cycle (see {@link CycleObject}). */
export function cycleObject<C, H extends LegacyCycleHandler<C>>(
  spec: CycleObjectSpec<C, H>,
): CycleObject<C, H> {
  return new CycleObject(spec);
}

/**
 * Run a cycle's body, then clean every object in `cleanupOrder` (a module
 * before its group), each attempted. The body's failure is rethrown with
 * every object left behind added to it; a body that passed fails on the
 * leftovers alone.
 */
export async function runCycle(
  caseName: string,
  cleanupOrder: readonly Pick<CycleObject<unknown>, 'cleanup'>[],
  body: () => Promise<void>,
): Promise<void> {
  let failed: { error: unknown } | undefined;
  try {
    await body();
  } catch (error) {
    // A value that is not an Error is wrapped, so the leftovers can be
    // attached to it (raiseAfterCleanup adds them to an Error only).
    failed = {
      error:
        error instanceof Error
          ? error
          : new Error(String(error), { cause: error }),
    };
  }
  const left: string[] = [];
  for (const object of cleanupOrder) {
    const problem = await object.cleanup();
    if (problem !== undefined) left.push(problem);
  }
  raiseAfterCleanup(
    failed,
    left.length > 0
      ? [
          `${LEGACY_740}/${caseName}: cleanup left ${left.length} object(s) behind — remove them by hand:\n  ${left.join('\n  ')}`,
        ]
      : [],
  );
}

/** `METHOD path`, and the `_action` a request carried (`LOCK`, `UNLOCK`, …). */
export function stepLine(request: RecordedRequest): string {
  const action = queryOf(request, '_action');
  const path = request.url.split('?')[0];
  return action === undefined
    ? `${request.method} ${path}`
    : `${request.method} ${path} ${action}`;
}

/** One request a step sends: its line (a pattern where an id varies) and status. */
export type SentStep = readonly [line: string | RegExp, status: number];

/**
 * Assert the full ordered sequence sent since `mark`: every request, each
 * with its status, and nothing else. Answers the requests for further reads.
 */
export function expectSent(
  recorder: RequestRecorder<IAbapConnection>,
  mark: number,
  expected: readonly SentStep[],
): RecordedRequest[] {
  const sent = sentSince(recorder, mark);
  expect(sent.map((r) => [stepLine(r), r.status])).toEqual(
    expected.map(([line, status]) => [
      typeof line === 'string' ? line : expect.stringMatching(line),
      status,
    ]),
  );
  return sent;
}

/** A header's value, its name compared without case. */
export function headerOf(
  request: RecordedRequest | undefined,
  name: string,
): string | undefined {
  const headers = request?.headers ?? {};
  const key = Object.keys(headers).find(
    (k) => k.toLowerCase() === name.toLowerCase(),
  );
  return key === undefined ? undefined : headers[key];
}

/** The answer of a member 7.40 refuses: a refusal, and nothing was sent. */
export function expectRefusedUnsent(
  answer: IAdtResponse<unknown>,
  recorder: RequestRecorder<IAbapConnection>,
  mark: number,
): void {
  expect(answer.ok).toBe(false);
  if (answer.ok) return;
  expect(answer.getError().origin).toBe('refusal');
  expect(sentSince(recorder, mark)).toEqual([]);
}
