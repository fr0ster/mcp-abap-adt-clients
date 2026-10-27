/**
 * What the live run B4 (7.40 SP04, record B4-cycles-20261026-2019) measured
 * 7.40 does not serve is refused without a request, and the refusal says it
 * was measured: `readTransport` of every legacy handler that has one, the
 * DDL version reads, and the message class's metadata update.
 */

import { AdtObjectErrorCodes } from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import { headersOf } from '../../../../../adt-clients/src/__tests__/helpers/adtHeaders';
import { AdtClientLegacy } from '../../../clients/AdtClientLegacy';
import { LEGACY_REFUSED, LEGACY_SENDS } from '../../helpers/legacyMembers';

const MEASURED: [getter: string, member: string][] = [
  ['getClass', 'readTransport'],
  ['getLocalTestClass', 'readTransport'],
  ['getLocalTypes', 'readTransport'],
  ['getLocalDefinitions', 'readTransport'],
  ['getLocalMacros', 'readTransport'],
  ['getProgram', 'readTransport'],
  ['getInterface', 'readTransport'],
  ['getFunctionGroup', 'readTransport'],
  ['getFunctionModule', 'readTransport'],
  ['getDdl', 'readTransport'],
  ['getDdl', 'getVersions'],
  ['getDdl', 'getVersionSource'],
  ['getMessageClass', 'updateMetadata'],
];

describe('members measured not served on 7.40 SP04 are refused', () => {
  it.each(MEASURED)(
    '%s().%s sends nothing and says it was measured',
    async (getter, member) => {
      const row = LEGACY_REFUSED[getter]?.[member];
      if (!row) throw new Error(`no refused row for ${getter}.${member}`);
      expect(LEGACY_SENDS[getter]?.[member]).toBeUndefined();
      const sent: string[] = [];
      const connection = {
        getBaseUrl: async () => 'https://example',
        getSessionId: () => null,
        setSessionType: () => {},
        makeAdtRequest: async (request: { url: string }) => {
          sent.push(request.url);
          return { status: 200, statusText: 'OK', headers: {}, data: '' };
        },
      } as unknown as IAbapConnection;
      const client = new AdtClientLegacy(connection) as unknown as Record<
        string,
        () => Record<string, unknown>
      >;
      const handler = client[getter]?.call(client) as Record<string, unknown>;

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
      expect(error?.message).toContain('measured on 7.40 SP04');
    },
  );
});
