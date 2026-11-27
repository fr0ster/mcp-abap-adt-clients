/**
 * C7 of #304: the message class message's one lock chain becomes four
 * members, one request each, and the caller composes them. This is the
 * equivalence: the requests the old chain sent — their order, method, URL,
 * body and the session each went on — are the snapshot (written by the old
 * chain before the split), and the caller's recipe below, the README's, sends
 * the same, the 403 fallbacks included.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AuthRefusedError } from '@mcp-abap-adt/connection';
import {
  ADT_NO_FAILURE,
  type IAdtError,
  type IAnalyse,
} from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAbapRequestOptions,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtMessageClass } from '../../../../core/messageClass/AdtMessageClass';
import { AdtMessageClassMessage } from '../../../../core/messageClass/AdtMessageClassMessage';
import {
  messageClassDocuments,
  messageDocuments,
} from '../../../../core/messageClass/types';
import { buildMessageClassXml } from '../../../../core/messageClass/xml';
import { writeMessage } from '../../../helpers/messageWrite';

const CLASS_DOCUMENT = buildMessageClassXml({
  name: 'ZMC',
  description: 'messages',
  messages: [
    { msgno: '001', msgtext: 'first' },
    { msgno: '002', msgtext: 'second' },
  ],
});
const LOCKED = (handle: string) =>
  `<?xml version="1.0"?><asx:abap xmlns:asx="http://www.sap.com/abapxml"><asx:values><DATA><LOCK_HANDLE>${handle}</LOCK_HANDLE></DATA></asx:values></asx:abap>`;

type Scenario =
  | 'granted'
  | 'message lock refused'
  | 'class-for-message lock refused'
  | 'class lock fails'
  | 'read fails'
  | 'write fails';

function recorder(scenario: Scenario) {
  const sent: {
    session: string;
    method: string;
    url: string;
    data: unknown;
  }[] = [];
  let session = 'stateless';
  const connection: IAbapConnection = {
    makeAdtRequest: async (request: IAbapRequestOptions) => {
      const url = String(request.url);
      sent.push({ session, method: request.method, url, data: request.data });
      const refuse = (status = 403) =>
        Promise.reject({
          response: { status, statusText: 'Refused', headers: {}, data: '' },
        });
      if (scenario === 'class lock fails' && url.includes('onSave=X'))
        return refuse(500);
      if (scenario === 'read fails' && request.method === 'GET')
        return refuse(500);
      if (scenario === 'write fails' && request.method === 'PUT')
        return refuse(500);
      if (url.includes('_action=LOCK_MSG'))
        return scenario === 'message lock refused'
          ? refuse()
          : { status: 200, statusText: 'OK', headers: {}, data: LOCKED('MH') };
      if (url.includes('_action=LOCK') && url.includes('onSave=X'))
        return scenario === 'class-for-message lock refused'
          ? refuse()
          : { status: 200, statusText: 'OK', headers: {}, data: LOCKED('CH') };
      if (url.includes('_action=LOCK'))
        return {
          status: 200,
          statusText: 'OK',
          headers: {},
          data: LOCKED('PH'),
        };
      if (request.method === 'GET')
        return {
          status: 200,
          statusText: 'OK',
          headers: {},
          data: CLASS_DOCUMENT,
        };
      return { status: 200, statusText: 'OK', headers: {}, data: '' };
    },
    getBaseUrl: async () => '',
    getSessionId: () => 'S',
    setSessionType: (type) => {
      session = type;
    },
    connect: async () => undefined,
  };
  return { connection, sent };
}

const headers = { accept: 'application/xml', contentType: 'application/xml' };
const SCENARIOS: Scenario[] = [
  'granted',
  'message lock refused',
  'class-for-message lock refused',
];
const WRITES = [
  [
    'upsert an existing message',
    { className: 'ZMC', msgno: '001', msgtext: 'changed' },
    false,
  ],
  [
    'upsert a new message',
    { className: 'ZMC', msgno: '003', msgtext: 'third' },
    false,
  ],
  ['remove a message', { className: 'ZMC', msgno: '002' }, true],
] as const;

/** The recipe over fresh handlers on one connection. */
function writeOn(
  connection: IAbapConnection,
  config: { className: string; msgno: string; msgtext?: string },
  removing: boolean,
) {
  return writeMessage(
    new AdtMessageClass(connection, { results: messageClassDocuments }),
    new AdtMessageClassMessage(connection, { results: messageDocuments }),
    { ...config, removeMessage: removing },
    { headers },
  );
}

describe('a message write sends what the old chain sent', () => {
  for (const scenario of SCENARIOS)
    for (const [what, config, removing] of WRITES)
      it(`${what}, ${scenario}`, async () => {
        const { connection, sent } = recorder(scenario);
        await writeOn(connection, config, removing);
        expect(sent).toMatchSnapshot();
      });
});

describe('each message member sends one request', () => {
  const config = { className: 'ZMC', msgno: '001' };
  it.each([
    ['lockMessage', (m: AdtMessageClassMessage) => m.lockMessage(config)],
    [
      'lockClassForMessage',
      (m: AdtMessageClassMessage) => m.lockClassForMessage(config),
    ],
    ['unlockMessages', (m: AdtMessageClassMessage) => m.unlockMessages(config)],
    [
      'update',
      (m: AdtMessageClassMessage) =>
        m.update(
          { ...config, msgtext: 't' },
          {
            headers,
            classDocument: CLASS_DOCUMENT,
            classLockHandle: 'CH',
            messageLockHandle: 'MH',
          },
        ),
    ],
  ] as const)('%s', async (_, call) => {
    const { connection, sent } = recorder('granted');
    await call(
      new AdtMessageClassMessage(connection, { results: messageDocuments }),
    );
    expect(sent).toHaveLength(1);
  });
});

/**
 * The recipe gives up exactly the locks it took, as the old chain's scope
 * ends did: nothing after a failed read (the read comes first), the message's
 * after a failed class lock, the class's and then the message's after a failed
 * write.
 */
describe('the recipe gives up the locks it took on every way out', () => {
  const config = { className: 'ZMC', msgno: '001', msgtext: 'changed' };
  const shape = (sent: { method: string; url: string }[]) =>
    sent.map(
      ({ method, url }) =>
        `${method} ${url.replace(/\?.*_action=/, ' ').replace(/&.*/, '')}`,
    );
  it.each([
    ['read fails', ['GET /sap/bc/adt/messageclass/zmc?version=workingArea']],
    [
      'class lock fails',
      [
        'GET /sap/bc/adt/messageclass/zmc?version=workingArea',
        'POST /sap/bc/adt/messageclass/zmc/messages/001 LOCK_MSG',
        'POST /sap/bc/adt/messageclass/zmc LOCK',
        'POST /sap/bc/adt/messageclass/zmc/messages/001 UNLOCK_ALL',
      ],
    ],
    [
      'write fails',
      [
        'GET /sap/bc/adt/messageclass/zmc?version=workingArea',
        'POST /sap/bc/adt/messageclass/zmc/messages/001 LOCK_MSG',
        'POST /sap/bc/adt/messageclass/zmc LOCK',
        'PUT /sap/bc/adt/messageclass/zmc?lockHandle=CH',
        'POST /sap/bc/adt/messageclass/zmc UNLOCK',
        'POST /sap/bc/adt/messageclass/zmc/messages/001 UNLOCK_ALL',
      ],
    ],
  ] as const)('%s', async (scenario, expected) => {
    const { connection, sent } = recorder(scenario);
    const answer = await writeOn(connection, config, false);
    expect(answer.ok).toBe(false);
    expect(shape(sent)).toEqual(expected);
  });
});

// ── #333 review: answers, strategies, errors, analyse and thrown values ────

/**
 * What the old chain did (`update` / `delete` before the split, run at
 * 68deaf9a with distinct `written` / `deleted` strategies and an `analyse`
 * spy), with one request faulted at a time: refused with SAP's answer,
 * failed with no answer, or a credential refusal the provider raised. Each
 * case's requests, outcome and `analyse` calls.
 */

/** The documented recipe (MIGRATION-48.md), `analyse` on the write alone, as the old chain judged only the PUT. */
async function recipe(
  messageClass: AdtMessageClass,
  message: AdtMessageClassMessage<{
    read: string;
    written: string;
    deleted: string;
  }>,
  config: { className: string; msgno: string; msgtext?: string },
  removing: boolean,
  analyse: IAnalyse<IAdtError>,
) {
  const klass = { name: config.className };
  const address = { className: config.className, msgno: config.msgno };
  const read = await messageClass.readMetadata(klass, {
    version: 'workingArea',
  });
  if (!read.ok) return read;
  const messageLock = await message.lockMessage(address);
  if (!messageLock.ok && messageLock.getError().response?.status !== 403)
    return messageLock;
  // The locks held, newest last; each is given up on every way out, the
  // class first, then the message, as the old chain's scope ends did.
  const held: (() => Promise<unknown>)[] = [
    () => message.unlockMessages(address),
  ];
  const window = async () => {
    let classLock = await message.lockClassForMessage(address);
    if (!classLock.ok && classLock.getError().response?.status === 403)
      classLock = await messageClass.lock(klass);
    if (!classLock.ok) return classLock;
    const classLockHandle = classLock.getResult().value;
    held.push(() => messageClass.unlock(klass, classLockHandle));
    const classDocument = String(read.getResult().value);
    const messageLockHandle = messageLock.ok
      ? messageLock.getResult().value
      : classLockHandle;
    const written = removing
      ? await message.update(
          { ...address, removeMessage: true },
          {
            headers,
            classDocument,
            classLockHandle,
            messageLockHandle,
            analyse,
          },
        )
      : await message.update(
          { ...address, msgtext: config.msgtext ?? '' },
          {
            headers,
            classDocument,
            classLockHandle,
            messageLockHandle,
            analyse,
          },
        );
    if (!written.ok) return written;
    const classUnlocked = await messageClass.unlock(klass, classLockHandle);
    if (!classUnlocked.ok) return classUnlocked; // given up again below
    held.pop();
    const messageUnlocked = await message.unlockMessages(address);
    if (!messageUnlocked.ok) return messageUnlocked; // given up again below
    held.pop();
    return written;
  };
  const outcome = await window().then(
    (answer) => ({ answer }),
    (error: unknown) => ({ error }),
  );
  // Every lock still held is given up, newest first, whatever an earlier one
  // threw; the first error thrown — the window's, else a cleanup's — is the
  // one that leaves, as in the old chain.
  let thrown = 'error' in outcome ? outcome : undefined;
  for (const release of held.reverse()) {
    try {
      await release();
    } catch (error) {
      thrown ??= { error };
    }
  }
  if (thrown) throw thrown.error;
  if ('error' in outcome) throw outcome.error;
  return outcome.answer;
}

const OLD_CHAIN: Record<
  string,
  { sent: string[]; outcome: unknown; analyseCalls: number }
> = JSON.parse(
  readFileSync(join(__dirname, '__fixtures__/oldMessageChain.json'), 'utf8'),
);

const STEPS = [
  'read',
  'lockMessage',
  'lockClassForMessage',
  'put',
  'unlockClass',
  'unlockMessages',
] as const;
const KINDS = ['answered', 'unanswered', 'credential'] as const;

function stepOf(method: string, url: string): string {
  if (method === 'GET') return 'read';
  if (method === 'PUT') return 'put';
  if (url.includes('_action=LOCK_MSG')) return 'lockMessage';
  if (url.includes('UNLOCK_ALL')) return 'unlockMessages';
  if (url.includes('_action=UNLOCK')) return 'unlockClass';
  if (url.includes('_action=LOCK')) return 'lockClassForMessage';
  return 'other';
}

function faulted(fault: string | undefined, kind: string | undefined) {
  const sent: string[] = [];
  const connection: IAbapConnection = {
    getBaseUrl: async () => '',
    getSessionId: () => 'S',
    connect: async () => undefined,
    setSessionType: () => {},
    makeAdtRequest: async (request: IAbapRequestOptions) => {
      const step = stepOf(request.method, String(request.url));
      sent.push(step);
      if (step === fault) {
        if (kind === 'answered')
          return Promise.reject({
            response: {
              status: 500,
              statusText: 'E',
              headers: {},
              data: 'refused',
            },
            message: 'refused',
          });
        if (kind === 'unanswered')
          return Promise.reject(
            Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' }),
          );
        return Promise.reject(
          new AuthRefusedError(
            {} as never,
            'request',
            new Error('the provider gave up'),
          ),
        );
      }
      const ok = (data: string) => ({
        status: 200,
        statusText: 'OK',
        headers: {},
        data,
      });
      if (step === 'lockMessage') return ok(LOCKED('MH'));
      if (step === 'lockClassForMessage') return ok(LOCKED('CH'));
      if (step === 'read') return ok(CLASS_DOCUMENT);
      return ok('');
    },
  };
  return { connection, sent };
}

/**
 * Where the recipe answers differently from the old chain, on purpose:
 * - a read SAP refused, or one with no answer, is an answer (every member
 *   answers; the old chain's raw read threw it);
 * - a removal is read by the `deleted` strategy (the old chain read it with
 *   `written` and cast it to the deleted type).
 */
const INTENDED: Record<string, unknown> = {
  'upsert read answered': { ok: false, mine: false, origin: 'connection' },
  'upsert read unanswered': { ok: false, mine: false, origin: 'connection' },
  'remove read answered': { ok: false, mine: false, origin: 'connection' },
  'remove read unanswered': { ok: false, mine: false, origin: 'connection' },
  'remove none': { ok: true, value: 'D' },
};

describe('the recipe answers as the old chain did, a fault at a time', () => {
  const MINE: IAdtError = { origin: 'refusal', message: 'mine' };
  const cases: [string, boolean, string | undefined, string | undefined][] = [];
  for (const removing of [false, true])
    for (const fault of [undefined, ...STEPS])
      for (const kind of fault ? KINDS : [undefined])
        cases.push([
          `${removing ? 'remove' : 'upsert'} ${fault ?? 'none'} ${kind ?? ''}`.trim(),
          removing,
          fault,
          kind,
        ]);
  it.each(cases)('%s', async (name, removing, fault, kind) => {
    const { connection, sent } = faulted(fault, kind);
    let calls = 0;
    const analyse: IAnalyse<IAdtError> = (verdict) => {
      calls += 1;
      return verdict === ADT_NO_FAILURE ? ADT_NO_FAILURE : MINE;
    };
    const message = new AdtMessageClassMessage(connection, {
      results: { ...messageDocuments, written: () => 'W', deleted: () => 'D' },
    });
    const messageClass = new AdtMessageClass(connection, {
      results: messageClassDocuments,
    });
    const config = removing
      ? { className: 'ZMC', msgno: '001' }
      : { className: 'ZMC', msgno: '001', msgtext: 'changed' };
    let outcome: unknown;
    try {
      const answer = await recipe(
        messageClass,
        message,
        config,
        removing,
        analyse,
      );
      outcome = answer.ok
        ? { ok: true, value: answer.getResult().value }
        : {
            ok: false,
            mine: answer.getError() === MINE,
            origin: answer.getError().origin,
          };
    } catch (error) {
      outcome = {
        threw:
          error instanceof AuthRefusedError
            ? 'AuthRefusedError'
            : String(error),
      };
    }
    const old = (
      OLD_CHAIN as Record<
        string,
        { sent: string[]; outcome: unknown; analyseCalls: number }
      >
    )[name];
    expect(sent).toEqual(old?.sent);
    expect(calls).toBe(old?.analyseCalls);
    expect(outcome).toEqual(name in INTENDED ? INTENDED[name] : old?.outcome);
  });
});

/**
 * Two faults: one in the lock window and one in a cleanup after it. The old
 * chain kept the first error and still ran every cleanup: a credential
 * refusal thrown in the window wins over one thrown by a cleanup, and a
 * cleanup's refusal is thrown only when the window answered (68deaf9a,
 * `__fixtures__/oldMessageChainTwoFaults.json`). Each error is its own
 * object, compared by identity.
 */
const OLD_TWO_FAULTS: Record<
  string,
  { sent: string[]; outcome: unknown; analyseCalls: number }
> = JSON.parse(
  readFileSync(
    join(__dirname, '__fixtures__/oldMessageChainTwoFaults.json'),
    'utf8',
  ),
);

describe('the recipe keeps the first error and runs every cleanup', () => {
  it.each(Object.keys(OLD_TWO_FAULTS))('%s', async (name) => {
    const [first, second] = name.split(' + ');
    const [s1, k1] = (first ?? '').split(' ');
    const [s2, k2] = (second ?? '').split(' ');
    const sent: string[] = [];
    const errors = new Map<unknown, string>();
    const seen = new Map<string, number>();
    const fault = (tag: string, kind: string | undefined) => {
      if (kind !== 'credential')
        return {
          response: { status: 500, statusText: 'E', headers: {}, data: tag },
          message: tag,
        };
      const refusal = new AuthRefusedError(
        {} as never,
        'request',
        new Error(tag),
      );
      errors.set(refusal, tag);
      return refusal;
    };
    const ok = (data: string) => ({
      status: 200,
      statusText: 'OK',
      headers: {},
      data,
    });
    const connection: IAbapConnection = {
      getBaseUrl: async () => '',
      getSessionId: () => 'S',
      connect: async () => undefined,
      setSessionType: () => {},
      makeAdtRequest: async (request: IAbapRequestOptions) => {
        const step = stepOf(request.method, String(request.url));
        sent.push(step);
        const count = (seen.get(step) ?? 0) + 1;
        seen.set(step, count);
        if (step === s1 && count === 1)
          return Promise.reject(fault(`${step}#1`, k1));
        if (step === s2) return Promise.reject(fault(`${step}#2`, k2));
        if (step === 'lockMessage') return ok(LOCKED('MH'));
        if (step === 'lockClassForMessage') return ok(LOCKED('CH'));
        if (step === 'read') return ok(CLASS_DOCUMENT);
        return ok('');
      },
    };
    let calls = 0;
    const MINE: IAdtError = { origin: 'refusal', message: 'mine' };
    const analyse: IAnalyse<IAdtError> = (verdict) => {
      calls += 1;
      return verdict === ADT_NO_FAILURE ? ADT_NO_FAILURE : MINE;
    };
    const message = new AdtMessageClassMessage(connection, {
      results: { ...messageDocuments, written: () => 'W', deleted: () => 'D' },
    });
    const messageClass = new AdtMessageClass(connection, {
      results: messageClassDocuments,
    });
    let outcome: unknown;
    try {
      const answer = await recipe(
        messageClass,
        message,
        { className: 'ZMC', msgno: '001', msgtext: 'x' },
        false,
        analyse,
      );
      outcome = answer.ok
        ? { ok: true, value: answer.getResult().value }
        : {
            ok: false,
            mine: answer.getError() === MINE,
            origin: answer.getError().origin,
            message: answer.getError().message,
          };
    } catch (error) {
      outcome = { threw: errors.get(error) ?? String(error) };
    }
    const old = OLD_TWO_FAULTS[name];
    expect(sent).toEqual(old?.sent);
    expect(calls).toBe(old?.analyseCalls);
    expect(outcome).toEqual(old?.outcome);
  });
});
