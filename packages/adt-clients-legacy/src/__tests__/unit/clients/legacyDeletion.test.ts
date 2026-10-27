/**
 * SAP_BASIS 7.40 SP04 has no deletion API (spec §5, §4.3): `POST
 * /sap/bc/adt/deletion/check` answered `404` "No application class found for
 * URI" over RFC. So on the legacy client every `checkDeletion`, the group
 * check, and the deletes that go through `/sap/bc/adt/deletion/*` answer the
 * library's refusal without a request — and the deletes that never used that
 * API still send.
 */

import { AdtObjectErrorCodes } from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import { headersOf } from '../../../../../adt-clients/src/__tests__/helpers/adtHeaders';
import { AdtClientLegacy } from '../../../clients/AdtClientLegacy';
import { LEGACY_REFUSED, LEGACY_SENDS } from '../../helpers/legacyMembers';

const LOCK_BODY = `<?xml version="1.0" encoding="utf-8"?>
<asx:abap xmlns:asx="http://www.sap.com/abapxml"><asx:values><DATA><LOCK_HANDLE>GUARD-LOCK</LOCK_HANDLE></DATA></asx:values></asx:abap>`;

const MESSAGE_CLASS_BODY = `<?xml version="1.0" encoding="utf-8"?>
<mc:messageClass xmlns:mc="http://www.sap.com/adt/MessageClass" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:name="ZGUARD_MSG" adtcore:description="guard" adtcore:masterLanguage="EN">
  <adtcore:packageRef adtcore:name="$TMP"/>
  <mc:messages mc:msgno="001" mc:msgtext="guard"/>
</mc:messageClass>`;

interface Sent {
  method: string;
  path: string;
}

function recordingConnection() {
  const sent: Sent[] = [];
  const connection = {
    getBaseUrl: async () => 'https://example',
    getSessionId: () => null,
    setSessionType: () => {},
    makeAdtRequest: async (request: { url: string; method: string }) => {
      const url = new URL(request.url, 'https://example');
      sent.push({ method: request.method, path: url.pathname });
      return {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: /_action=(LOCK|UNLOCK)/.test(request.url)
          ? LOCK_BODY
          : url.pathname.includes('/messageclass/')
            ? MESSAGE_CLASS_BODY
            : '',
      };
    },
  } as unknown as IAbapConnection;
  return { connection, sent };
}

const CHECK = '/sap/bc/adt/deletion/check';
const DELETE = '/sap/bc/adt/deletion/delete';

/** Every member that used `/sap/bc/adt/deletion/*`, and the endpoint it names. */
const REFUSED: [getter: string, member: string, endpoint: string][] = [
  ['getClass', 'checkDeletion', CHECK],
  ['getProgram', 'checkDeletion', CHECK],
  ['getInterface', 'checkDeletion', CHECK],
  ['getFunctionGroup', 'checkDeletion', CHECK],
  ['getFunctionModule', 'checkDeletion', CHECK],
  ['getDdl', 'checkDeletion', CHECK],
  ['getPackage', 'checkDeletion', CHECK],
  ['getInclude', 'checkDeletion', CHECK],
  ['getFunctionInclude', 'checkDeletion', CHECK],
  ['getMessageClass', 'checkDeletion', CHECK],
  ['getUtils', 'checkDeletionGroup', CHECK],
  ['getFunctionInclude', 'delete', DELETE],
  ['getUtils', 'deleteObjectsGroup', DELETE],
];

/** Deletes that never went through the deletion API, and still send. */
const STILL_SENDS: [getter: string, member: string][] = [
  ['getLocalTestClass', 'delete'],
  ['getLocalTypes', 'delete'],
  ['getLocalDefinitions', 'delete'],
  ['getLocalMacros', 'delete'],
  ['getMessageClassMessage', 'delete'],
];

function handlerOf(
  client: AdtClientLegacy,
  getter: string,
): Record<string, unknown> {
  return (client as unknown as Record<string, () => Record<string, unknown>>)[
    getter
  ]?.call(client) as Record<string, unknown>;
}

describe('no deletion API on legacy', () => {
  it.each(REFUSED)(
    '%s().%s answers the refusal without a request',
    async (getter, member, endpoint) => {
      const row = LEGACY_REFUSED[getter]?.[member];
      if (!row) throw new Error(`no refused row for ${getter}.${member}`);
      const { connection, sent } = recordingConnection();
      const handler = handlerOf(new AdtClientLegacy(connection), getter);

      const answer = (await row.call(handler, headersOf)) as {
        ok: boolean;
        getError?: () => { origin: string; code: string; message: string };
      };

      expect(sent).toEqual([]);
      expect(answer.ok).toBe(false);
      const error = answer.getError?.();
      expect(error?.origin).toBe('refusal');
      expect(error?.code).toBe(AdtObjectErrorCodes.UNSUPPORTED_OPERATION);
      expect(error?.message).toContain(member);
      expect(error?.message).toContain(endpoint);
    },
  );

  /** Handlers whose legacy delete is the DELETE under the caller's lock (§4.2). */
  const DELETES_WITH_LOCK = [
    'getClass',
    'getProgram',
    'getInterface',
    'getFunctionGroup',
    'getFunctionModule',
    'getDdl',
    'getInclude',
    'getMessageClass',
  ];

  it.each([
    ...DELETES_WITH_LOCK.map((getter) => [getter, 'checkDeletion']),
    ['getUtils', 'checkDeletionGroup'],
  ])(
    '%s().%s says that delete with the lock handle is the delete',
    async (getter, member) => {
      const row = LEGACY_REFUSED[getter]?.[member];
      if (!row) throw new Error(`no refused row for ${getter}.${member}`);
      const handler = handlerOf(
        new AdtClientLegacy(recordingConnection().connection),
        getter,
      );
      const answer = (await row.call(handler, headersOf)) as {
        getError: () => { message: string };
      };
      expect(answer.getError().message).toContain('no deletion check');
      expect(answer.getError().message).toContain(
        "delete() with the object's lock handle",
      );
    },
  );

  it.each(['getPackage', 'getFunctionInclude'])(
    '%s().checkDeletion says there is no deletion check, and names no delete that refuses',
    async (getter) => {
      const row = LEGACY_REFUSED[getter]?.checkDeletion;
      if (!row) throw new Error(`no refused row for ${getter}.checkDeletion`);
      const handler = handlerOf(
        new AdtClientLegacy(recordingConnection().connection),
        getter,
      );
      const answer = (await row.call(handler, headersOf)) as {
        getError: () => { message: string };
      };
      expect(answer.getError().message).toContain('no deletion check');
      expect(answer.getError().message).not.toContain('lock handle');
    },
  );

  it.each(STILL_SENDS)(
    '%s().%s still sends, and nothing to the deletion API',
    async (getter, member) => {
      const row = LEGACY_SENDS[getter]?.[member];
      if (!row) throw new Error(`no sends row for ${getter}.${member}`);
      const { connection, sent } = recordingConnection();
      const handler = handlerOf(new AdtClientLegacy(connection), getter);

      await row.call(handler, headersOf);

      expect(sent.some((r) => r.method === 'PUT')).toBe(true);
      expect(sent.filter((r) => r.path.includes('/deletion/'))).toEqual([]);
    },
  );
});
