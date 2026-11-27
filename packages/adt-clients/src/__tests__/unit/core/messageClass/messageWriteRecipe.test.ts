/**
 * C7 of #304: the message class message's one lock chain becomes four
 * members, one request each, and the caller composes them. This is the
 * equivalence: the requests the old chain sent — their order, method, URL,
 * body and the session each went on — are the snapshot (written by the old
 * chain), and the caller's recipe sends the same, the 403 fallbacks included.
 */
import type {
  IAbapConnection,
  IAbapRequestOptions,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtMessageClassMessage } from '../../../../core/messageClass/AdtMessageClassMessage';
import { messageDocuments } from '../../../../core/messageClass/types';
import { buildMessageClassXml } from '../../../../core/messageClass/xml';

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
  | 'class-for-message lock refused';

export function recorder(scenario: Scenario) {
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
      const refuse = () =>
        Promise.reject({
          response: {
            status: 403,
            statusText: 'Forbidden',
            headers: {},
            data: '',
          },
        });
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

describe('a message write sends what the old chain sent', () => {
  for (const scenario of SCENARIOS)
    for (const [what, config, removing] of WRITES)
      it(`${what}, ${scenario}`, async () => {
        const { connection, sent } = recorder(scenario);
        const message = new AdtMessageClassMessage(connection, {
          results: messageDocuments,
        });
        if (removing) await message.delete(config, { headers });
        else await message.update(config, { headers });
        expect(sent).toMatchSnapshot();
      });
});
