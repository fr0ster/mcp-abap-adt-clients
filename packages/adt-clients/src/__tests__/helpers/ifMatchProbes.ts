/**
 * The write-guard sequence the `IfMatch*.test.ts` live suites run on one
 * document: a source or an object's own XML document, which an update writes
 * with `ifMatch` (interfaces-adt 25.2.0), sent as `If-Match`.
 *
 * 1. read the document, version `inactive` — the newest version of an object
 *    never activated — and take the ETag SAP answered with it;
 * 2. under one lock: write with that ETag — accepted;
 * 3. read again: a new ETag;
 * 4. write again with the first ETag — refused `412`
 *    `ExceptionPreconditionFailed`, nothing written;
 * 5. write with the new ETag — accepted.
 *
 * What SAP answers was measured on premise and on the cloud (2026-11-03) for a
 * program's and a class's source and a domain's document; the other write
 * paths are what these suites measure. The ETag has a resolution of one
 * second (measured: two writes within one second answered the same ETag), so
 * the first write waits the case's `update` delay (`operation_delays`) after
 * the object's create: a write in the same second as the read would keep the
 * ETag the read answered, and the refusal of step 4 would prove nothing.
 */

import type { IAdtResponse } from '@mcp-abap-adt/interfaces-adt';
import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import {
  cleanupRefusal,
  expectFailure,
  expectResult,
  releasing,
} from './contract';
import { presenceOf } from './objectPresence';
import { logTestStep } from './testProgressLogger';

/** One document an update writes, and the members around its write. */
export interface IGuardedDocument {
  /** What the document is, for messages — e.g. `source of program ZIFM_P…`. */
  readonly what: string;
  /** Read the document, version `inactive`, the whole wire answer. */
  readDocument(): Promise<IAdtResponse<IAdtWireResponse>>;
  /** Lock what the write needs locked; the handle. */
  takeLock(): Promise<IAdtResponse<string>>;
  /** Write `document` under `lockHandle`, sending `ifMatch` as `If-Match`. */
  writeDocument(
    document: string,
    lockHandle: string,
    ifMatch: string,
  ): Promise<IAdtResponse<unknown>>;
  /** Release the handle. */
  releaseLock(lockHandle: string): Promise<IAdtResponse<unknown>>;
  /**
   * The document of write `n` (1, 2 or 3), from what the first read
   * answered: a source is written whole, a metadata document as read with
   * one field changed. Each differs from the others.
   */
  documentFor(current: string, n: 1 | 2 | 3): string;
}

/** The ETag of a wire answer, whatever the header's case. */
export function etagOf(wire: IAdtWireResponse, what: string): string {
  for (const [name, value] of Object.entries(wire.headers)) {
    if (name.toLowerCase() !== 'etag') continue;
    if (typeof value === 'string' && value !== '') return value;
  }
  throw new Error(`${what}: the read answered no ETag`);
}

/** Run the write-guard sequence on `target`; fails the test on any step. */
export async function proveIfMatch(
  target: IGuardedDocument,
  delayMs: number,
  logger: ILogger,
): Promise<void> {
  logTestStep(`read the ${target.what}`, logger);
  const first = expectResult(
    await target.readDocument(),
    `read ${target.what}`,
  );
  const firstEtag = etagOf(first, `read ${target.what}`);
  const current = String(first.data);
  logger.info?.(`first ETag: ${firstEtag}`);

  logTestStep(`lock for the ${target.what}`, logger);
  const handle = expectResult(
    await target.takeLock(),
    `lock for the ${target.what}`,
  );
  await releasing(
    async () => {
      // One second is the ETag's resolution (measured); the case's delay is
      // longer, so the first write is in another second than the create.
      await new Promise<void>((resolve) => setTimeout(resolve, delayMs));

      logTestStep('write with the ETag the read answered', logger);
      expectResult(
        await target.writeDocument(
          target.documentFor(current, 1),
          handle,
          firstEtag,
        ),
        `write ${target.what} with the ETag it was read with`,
      );

      logTestStep(`read the ${target.what} again`, logger);
      const second = expectResult(
        await target.readDocument(),
        `read ${target.what} again`,
      );
      const secondEtag = etagOf(second, `read ${target.what} again`);
      logger.info?.(`second ETag: ${secondEtag}`);
      expect(secondEtag).not.toBe(firstEtag);

      logTestStep('write with the first ETag: refused', logger);
      const refused = expectFailure(
        await target.writeDocument(
          target.documentFor(current, 2),
          handle,
          firstEtag,
        ),
        `write ${target.what} with a stale ETag`,
      );
      expect({
        status: refused.response?.status,
        type: refused.adtType,
      }).toEqual({ status: 412, type: 'ExceptionPreconditionFailed' });

      logTestStep('write with the new ETag', logger);
      expectResult(
        await target.writeDocument(
          target.documentFor(current, 3),
          handle,
          secondEtag,
        ),
        `write ${target.what} with the ETag it was read with again`,
      );
    },
    () => target.releaseLock(handle),
    `unlock for the ${target.what}`,
  );
}

/**
 * Delete an object this run created and read it back: `''` when it is gone
 * (or never was), else what went wrong, for `raiseAfterCleanup`.
 */
export async function removeAndReadBack(
  remove: () => Promise<IAdtResponse<unknown>>,
  readBack: () => Promise<IAdtResponse<unknown>>,
  what: string,
): Promise<string> {
  const refused = await cleanupRefusal(remove, `delete ${what}`);
  if (refused) return refused;
  const presence = presenceOf(await readBack(), what);
  if (presence.present === false) return '';
  return presence.present === true
    ? `${what} is still there after its delete`
    : presence.reason;
}
