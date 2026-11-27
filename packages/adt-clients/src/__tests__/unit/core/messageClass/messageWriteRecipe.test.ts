/**
 * C7 of #304: the message class message's one lock chain becomes four
 * members, one request each, and the caller composes them. This is the
 * equivalence: the requests the old chain sent — their order, method, URL,
 * body and the session each went on — are the snapshot (written by the old
 * chain before the split), and the caller's recipe below, the README's, sends
 * the same, the 403 fallbacks included.
 */
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
