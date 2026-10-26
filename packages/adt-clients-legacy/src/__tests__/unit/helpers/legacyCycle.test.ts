/**
 * The live cycles' cleanup (`helpers/legacyCycle.ts`), run against a
 * recording fake of 7.40 SP04: the legacy program handler on a connection
 * that answers as the system answered (B4-cycles-20261026-2019: validate
 * `200`, read `404` / `200`, `LOCK` with a handle, `DELETE ?lockHandle=`,
 * `UNLOCK`), behind the recorder the live suites read.
 *
 * A cycle that fails after its create is cleaned: what this run created is
 * deleted under a lock — the one the run still holds, or a fresh one — the
 * lock released and the object read back; the body's failure stands, with
 * whatever was left behind named. A name that was not free is never
 * touched.
 */

import { analyseException } from '@mcp-abap-adt/adt-strategies';
import type { IProgramConfig } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  ISessionLifecycleAware,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { integrationHeadersOf } from '../../../../../adt-clients/src/__tests__/helpers/adtHeaders';
import { expectResult } from '../../../../../adt-clients/src/__tests__/helpers/contract';
import { recordRequests } from '../../../../../adt-clients/src/__tests__/helpers/requestRecorder';
import { AdtClientLegacy } from '../../../clients/AdtClientLegacy';
import { cycleObject, runCycle, stepLine } from '../../helpers/legacyCycle';
import { queryOf, sentSince } from '../../helpers/legacyLive';

const NAME = 'ZLG7_C_PROG';
const CASE = 'legacy_cycle_program';
const PROG = `/sap/bc/adt/programs/programs/${NAME.toLowerCase()}`;
const LOCK_ANSWER =
  '<?xml version="1.0" encoding="utf-8"?><asx:abap xmlns:asx="http://www.sap.com/abapxml" version="1.0"><asx:values><DATA><LOCK_HANDLE>H1</LOCK_HANDLE></DATA></asx:values></asx:abap>';

const logger = { debug() {}, info() {}, warn() {}, error() {} };

/** What a request answered; thrown with the status for a refusal. */
function answer(status: number, data = '') {
  const response = { status, data, headers: {} };
  if (status >= 400)
    throw Object.assign(new Error(`Request failed with status ${status}`), {
      response,
    });
  return response;
}

/** One program on a fake 7.40 SP04, and the recorder in front of it. */
function fakeSystem(state: { exists: boolean; refuseDelete?: boolean }) {
  const connection = {
    setSessionType: () => {},
    getSessionId: () => 'session',
    makeAdtRequest: async (request: { method: string; url: string }) => {
      const [path, query = ''] = request.url.split('?');
      const action = new URLSearchParams(query).get('_action');
      if (path === '/sap/bc/adt/programs/validation') return answer(200);
      if (
        request.method === 'POST' &&
        path === '/sap/bc/adt/programs/programs'
      ) {
        state.exists = true;
        return answer(200);
      }
      if (path === PROG && action === 'LOCK') return answer(200, LOCK_ANSWER);
      if (path === PROG && action === 'UNLOCK') return answer(200);
      if (path === PROG && request.method === 'GET')
        return state.exists
          ? answer(200, `<program:abapProgram adtcore:name="${NAME}"/>`)
          : answer(404);
      if (path === PROG && request.method === 'DELETE') {
        if (state.refuseDelete) return answer(400);
        state.exists = false;
        return answer(200);
      }
      throw new Error(
        `the fake has no answer for ${request.method} ${request.url}`,
      );
    },
  } as unknown as IAbapConnection & ISessionLifecycleAware;
  const recorder = recordRequests(connection);
  const client = new AdtClientLegacy(recorder.connection, logger);
  const config: IProgramConfig = { programName: NAME };
  const prog = cycleObject({
    caseName: CASE,
    label: 'program',
    name: NAME,
    config,
    handler: () => client.getProgram(),
    validateConfig: { ...config, packageName: '$TMP', description: 'cycle' },
  });
  const create = async () => {
    prog.markCreated();
    expectResult(
      await prog.handler.create(
        { programName: NAME, packageName: '$TMP', description: 'cycle' },
        {
          headers: integrationHeadersOf(prog.handler, 'create'),
          analyse: analyseException,
        },
      ),
      'create',
    );
  };
  return { recorder, prog, create };
}

async function failureOf(work: Promise<void>): Promise<Error> {
  const thrown = await work.then(
    () => undefined,
    (error: unknown) => error,
  );
  if (!(thrown instanceof Error)) throw new Error('expected the cycle to fail');
  return thrown;
}

describe('a live cycle that fails half-way is cleaned', () => {
  it('deletes what it created under a lock of its own, unlocks and reads it back; the failure stands', async () => {
    const state = { exists: false };
    const { recorder, prog, create } = fakeSystem(state);
    let mark = 0;

    const thrown = await failureOf(
      runCycle(CASE, [prog], async () => {
        await prog.requireFree();
        await create();
        mark = recorder.requests.length;
        throw new Error('a step after the create failed');
      }),
    );

    expect(thrown.message).toBe('a step after the create failed');
    const sent = sentSince(recorder, mark);
    expect(sent.map(stepLine)).toEqual([
      `GET ${PROG}`,
      `POST ${PROG} LOCK`,
      `DELETE ${PROG}`,
      `POST ${PROG} UNLOCK`,
      `GET ${PROG}`,
    ]);
    expect(queryOf(sent[2] ?? sent[0], 'lockHandle')).toBe('H1');
    expect(queryOf(sent[3] ?? sent[0], 'lockHandle')).toBe('H1');
    expect(state.exists).toBe(false);
  });

  it('deletes under the lock the run still holds and releases it, taking no second lock', async () => {
    const state = { exists: false };
    const { recorder, prog, create } = fakeSystem(state);
    let mark = 0;

    const thrown = await failureOf(
      runCycle(CASE, [prog], async () => {
        await prog.requireFree();
        await create();
        expectResult(await prog.lock(), 'lock');
        mark = recorder.requests.length;
        throw new Error('the write under the lock failed');
      }),
    );

    expect(thrown.message).toBe('the write under the lock failed');
    const sent = sentSince(recorder, mark);
    expect(sent.map(stepLine)).toEqual([
      `GET ${PROG}`,
      `DELETE ${PROG}`,
      `POST ${PROG} UNLOCK`,
      `GET ${PROG}`,
    ]);
    expect(queryOf(sent[1] ?? sent[0], 'lockHandle')).toBe('H1');
    expect(prog.held).toBeUndefined();
    expect(state.exists).toBe(false);
  });

  it('touches nothing when the name was not free', async () => {
    const state = { exists: true };
    const { recorder, prog } = fakeSystem(state);
    let mark = -1;

    const thrown = await failureOf(
      runCycle(CASE, [prog], async () => {
        try {
          await prog.requireFree();
        } finally {
          mark = recorder.requests.length;
        }
      }),
    );

    expect(thrown.message).toBe(
      `legacy_740/${CASE}: program ${NAME} already exists; name one that does not`,
    );
    expect(sentSince(recorder, mark)).toEqual([]);
    expect(state.exists).toBe(true);
  });

  it('names what it left behind, beside the failure of the body or alone', async () => {
    const state = { exists: false, refuseDelete: true };
    const { prog, create } = fakeSystem(state);

    const afterFailure = await failureOf(
      runCycle(CASE, [prog], async () => {
        await prog.requireFree();
        await create();
        throw new Error('a step failed');
      }),
    );
    expect(afterFailure.message).toContain('a step failed; then ');
    expect(afterFailure.message).toContain(
      `legacy_740/${CASE}: cleanup left 1 object(s) behind — remove them by hand:\n  program ${NAME}:`,
    );

    const alone = await failureOf(runCycle(CASE, [prog], async () => {}));
    expect(alone.message).toContain(`cleanup failed: legacy_740/${CASE}`);
    expect(alone.message).toContain(`program ${NAME}:`);
    expect(state.exists).toBe(true);
  });

  it('only releases a held lock on an object that goes with its container', async () => {
    const state = { exists: false };
    const { recorder, create, prog: owner } = fakeSystem(state);
    const part = cycleObject({
      caseName: CASE,
      label: 'program',
      name: NAME,
      config: { programName: NAME } as IProgramConfig,
      handler: () => owner.handler,
      removedWith: 'its container',
    });
    let mark = 0;

    await failureOf(
      runCycle(CASE, [part], async () => {
        await owner.requireFree();
        await create();
        part.markCreated();
        expectResult(await part.lock(), 'lock');
        mark = recorder.requests.length;
        throw new Error('the write failed');
      }),
    );

    expect(sentSince(recorder, mark).map(stepLine)).toEqual([
      `POST ${PROG} UNLOCK`,
    ]);
    expect(state.exists).toBe(true);
  });
});
