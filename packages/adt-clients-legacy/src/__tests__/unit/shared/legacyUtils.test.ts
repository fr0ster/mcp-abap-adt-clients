/**
 * `getUtils()` on the legacy client (spec §10.2). Measured over RFC on
 * SAP_BASIS 7.40 SP04: `usageReferences`, `virtualfolders/contents`,
 * `objecttypes`, a table's source and domain and data element metadata
 * answered `404`; a legacy group activation is synchronous and yields no run
 * id. Each of those answers the library's refusal without a request, naming
 * the operation and the endpoint 7.40 lacks. `readObjectMetadata` and
 * `readObjectSource` refuse the DDIC types 7.40 does not serve, by their codes
 * of the ADT type tables, and send for the types it does; an unknown type is
 * still the caller's mistake and is thrown, as on the modern client.
 */

import {
  AdtObjectErrorCodes,
  type AdtSourceTypeCode,
  type AdtTypeCode,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import { headersOf } from '../../../../../adt-clients/src/__tests__/helpers/adtHeaders';
import { AdtClientLegacy } from '../../../clients/AdtClientLegacy';
import type { AdtUtilsLegacy } from '../../../core/shared/AdtUtilsLegacy';

interface Sent {
  method: string;
  url: string;
}

function recordingConnection() {
  const sent: Sent[] = [];
  const connection = {
    getBaseUrl: async () => 'https://example',
    getSessionId: () => null,
    setSessionType: () => {},
    makeAdtRequest: async (request: { url: string; method: string }) => {
      sent.push({ method: request.method, url: request.url });
      return { status: 200, statusText: 'OK', headers: {}, data: '<x/>' };
    },
  } as unknown as IAbapConnection;
  return { connection, sent };
}

function legacyUtils() {
  const { connection, sent } = recordingConnection();
  const utils = new AdtClientLegacy(connection).getUtils() as AdtUtilsLegacy;
  return { utils, sent };
}

interface Answer {
  ok: boolean;
  getError?: () => { origin: string; code: string; message: string };
}

function expectRefusal(
  response: unknown,
  sent: Sent[],
  operation: string,
  endpoint: string,
) {
  const answer = response as Answer;
  expect(sent).toEqual([]);
  expect(answer.ok).toBe(false);
  const error = answer.getError?.();
  expect(error?.origin).toBe('refusal');
  expect(error?.code).toBe(AdtObjectErrorCodes.UNSUPPORTED_OPERATION);
  expect(error?.message).toContain(operation);
  expect(error?.message).toContain(endpoint);
}

const RIS = '/sap/bc/adt/repository/informationsystem';

describe('legacy utilities', () => {
  describe('members 7.40 does not serve answer the refusal without a request', () => {
    const MEMBERS: [
      member: string,
      endpoint: string,
      call: (utils: AdtUtilsLegacy) => Promise<unknown>,
    ][] = [
      [
        'getWhereUsed',
        `${RIS}/usageReferences`,
        (utils) =>
          utils.getWhereUsed(
            { object_name: 'ZCL_GUARD', object_type: 'CLAS/OC' },
            { headers: headersOf(utils, 'getWhereUsed') },
          ),
      ],
      [
        'getWhereUsedScope',
        `${RIS}/usageReferences/scope`,
        (utils) =>
          utils.getWhereUsedScope(
            { object_name: 'ZCL_GUARD', object_type: 'CLAS/OC' },
            { headers: headersOf(utils, 'getWhereUsedScope') },
          ),
      ],
      [
        'getVirtualFoldersContents',
        `${RIS}/virtualfolders/contents`,
        (utils) =>
          utils.getVirtualFoldersContents(
            { objectSearchPattern: 'ZGUARD*' },
            { headers: headersOf(utils, 'getVirtualFoldersContents') },
          ),
      ],
      ['getAllTypes', `${RIS}/objecttypes`, (utils) => utils.getAllTypes()],
      [
        'getActivationRun',
        '/sap/bc/adt/activation/runs',
        (utils) => utils.getActivationRun('GUARD'),
      ],
      [
        'getActivationResults',
        '/sap/bc/adt/activation/results',
        (utils) => utils.getActivationResults('GUARD'),
      ],
    ];

    it.each(MEMBERS)('%s', async (member, endpoint, call) => {
      const { utils, sent } = legacyUtils();
      expectRefusal(await call(utils), sent, member, endpoint);
    });

    it('getWhereUsed refuses before reading the type, an unknown one included', async () => {
      const { utils, sent } = legacyUtils();
      const answer = await utils.getWhereUsed(
        // @ts-expect-error -- 'nosuchtype' is no code of the tables
        { object_name: 'ZGUARD', object_type: 'nosuchtype' },
        { headers: headersOf(utils, 'getWhereUsed') },
      );
      expectRefusal(answer, sent, 'getWhereUsed', `${RIS}/usageReferences`);
    });

    it('getVirtualFoldersContents names fetchNodeStructure with DEVC/K for package contents', async () => {
      const { utils } = legacyUtils();
      const answer = (await utils.getVirtualFoldersContents(
        { objectSearchPattern: 'ZGUARD*' },
        { headers: headersOf(utils, 'getVirtualFoldersContents') },
      )) as Answer;
      const message = answer.getError?.().message;
      expect(message).toContain('fetchNodeStructure');
      expect(message).toContain('DEVC/K');
    });

    it.each([['getWhereUsed'], ['getWhereUsedScope']] as const)(
      '%s names the RIS sequence 7.40 serves where-used through',
      async (member) => {
        const { utils } = legacyUtils();
        const answer = (await utils[member](
          { object_name: 'ZCL_GUARD', object_type: 'CLAS/OC' },
          { headers: headersOf(utils, member) },
        )) as Answer;
        const message = answer.getError?.().message;
        expect(message).toContain(
          'fullnamemapping → metadata → whereused?RIS_REQUEST_TYPE=WHERE_USED_LAZY',
        );
        expect(message).toContain('which this library does not implement');
      },
    );

    it('getAllTypes names repository/typestructure, which 7.40 serves object types through, and its member', async () => {
      const { utils } = legacyUtils();
      const answer = (await utils.getAllTypes()) as Answer;
      const message = answer.getError?.().message;
      expect(message).toContain('repository/typestructure');
      expect(message).toContain('getTypeStructure');
    });

    it('getTypeStructure sends, as on the modern client', async () => {
      const { utils, sent } = legacyUtils();
      const answer = await utils.getTypeStructure();
      expect(answer.ok).toBe(true);
      expect(sent).toEqual([
        { method: 'POST', url: '/sap/bc/adt/repository/typestructure' },
      ]);
    });

    it.each([['getActivationRun'], ['getActivationResults']] as const)(
      '%s says a legacy group activation has no run id',
      async (member) => {
        const { utils } = legacyUtils();
        const answer = (await utils[member]('GUARD')) as Answer;
        expect(answer.getError?.().message).toContain('no run id');
      },
    );
  });

  const METADATA_REFUSED: [code: AdtTypeCode, endpoint: string][] = [
    ['DOMA/DD', '/sap/bc/adt/ddic/domains'],
    ['DTEL/DE', '/sap/bc/adt/ddic/dataelements'],
    ['TABL/DS', '/sap/bc/adt/ddic/structures'],
    ['TABL/DT', '/sap/bc/adt/ddic/tables'],
    ['TTYP/DA', '/sap/bc/adt/ddic/tabletypes'],
    ['DEVC/K', '/sap/bc/adt/packages/{name}'],
  ];
  const SOURCE_REFUSED: [code: AdtSourceTypeCode, endpoint: string][] = [
    ['TABL/DS', '/sap/bc/adt/ddic/structures'],
    ['TABL/DT', '/sap/bc/adt/ddic/tables'],
  ];
  /**
   * The table type is the one family here no run measured (it is only absent
   * from discovery); the others answered `404`, and their refusal says so.
   */
  const expectEvidence = (answer: unknown, endpoint: string) => {
    const message = (answer as Answer).getError?.().message ?? '';
    if (endpoint === '/sap/bc/adt/ddic/tabletypes') {
      expect(message).toContain('does not advertise');
      expect(message).toContain('not measured');
      expect(message).not.toContain('has no');
    } else {
      expect(message).toContain('has no');
      expect(message).not.toContain('not measured');
    }
  };

  describe('readObjectMetadata', () => {
    it.each(METADATA_REFUSED)(
      'refuses %s without a request',
      async (code, endpoint) => {
        const { utils, sent } = legacyUtils();
        const answer = await utils.readObjectMetadata(code, 'ZGUARD');
        expectRefusal(answer, sent, 'readObjectMetadata', endpoint);
        expect((answer as Answer).getError?.().message).toContain(code);
        expectEvidence(answer, endpoint);
      },
    );

    it.each([
      ['CLAS/OC', '/sap/bc/adt/oo/classes/zguard'],
      ['PROG/P', '/sap/bc/adt/programs/programs/zguard'],
      ['INTF/OI', '/sap/bc/adt/oo/interfaces/zguard'],
      ['FUGR/FF', '/sap/bc/adt/functions/groups/zfg/fmodules/zguard'],
      ['DDLS/DF', '/sap/bc/adt/ddic/ddl/sources/zguard'],
      ['FUGR/F', '/sap/bc/adt/functions/groups/zguard'],
    ] as const)('sends for %s', async (type, url) => {
      const { utils, sent } = legacyUtils();
      const answer = await utils.readObjectMetadata(type, 'ZGUARD', 'ZFG');
      expect(answer.ok).toBe(true);
      expect(sent).toEqual([{ method: 'GET', url }]);
    });

    it('still throws for an unknown type', async () => {
      const { utils, sent } = legacyUtils();
      await expect(
        // @ts-expect-error -- 'nosuchtype' is no code of the tables
        utils.readObjectMetadata('nosuchtype', 'ZGUARD'),
      ).rejects.toThrow("No ADT address is known for object type 'nosuchtype'");
      expect(sent).toEqual([]);
    });
  });

  describe('readObjectSource', () => {
    it.each(SOURCE_REFUSED)(
      'refuses %s without a request',
      async (code, endpoint) => {
        const { utils, sent } = legacyUtils();
        const answer = await utils.readObjectSource(code, 'ZGUARD');
        expectRefusal(answer, sent, 'readObjectSource', endpoint);
        expect((answer as Answer).getError?.().message).toContain(code);
        expectEvidence(answer, endpoint);
      },
    );

    it.each([
      ['CLAS/OC', '/sap/bc/adt/oo/classes/zguard/source/main'],
      ['PROG/P', '/sap/bc/adt/programs/programs/zguard/source/main'],
      ['INTF/OI', '/sap/bc/adt/oo/interfaces/zguard/source/main'],
      [
        'FUGR/FF',
        '/sap/bc/adt/functions/groups/zfg/fmodules/zguard/source/main',
      ],
      ['DDLS/DF', '/sap/bc/adt/ddic/ddl/sources/zguard/source/main'],
    ] as const)('sends for %s', async (type, url) => {
      const { utils, sent } = legacyUtils();
      const answer = await utils.readObjectSource(type, 'ZGUARD', 'ZFG');
      expect(answer.ok).toBe(true);
      expect(sent).toEqual([{ method: 'GET', url }]);
    });

    it('still throws for a code with no source, from a caller outside the types', async () => {
      const { utils, sent } = legacyUtils();
      for (const type of ['nosuchtype', 'FUGR/F', 'DOMA/DD', 'TTYP/DA']) {
        await expect(
          // @ts-expect-error -- none of these is an AdtSourceTypeCode
          utils.readObjectSource(type, 'ZGUARD'),
        ).rejects.toThrow(
          `Object type ${type} does not support source code reading`,
        );
      }
      expect(sent).toEqual([]);
    });
  });

  describe('members that send nothing are unchanged', () => {
    it('modifyWhereUsedScope edits the XML it is given', () => {
      const { utils, sent } = legacyUtils();
      const xml =
        '<usagereferences:objectTypes xmlns:usagereferences="http://www.sap.com/adt/ris/usageReferences">' +
        '<usagereferences:type isSelected="false" name="CLAS/OC"/>' +
        '</usagereferences:objectTypes>';
      expect(utils.modifyWhereUsedScope(xml, { enableAll: true })).toContain(
        'isSelected="true"',
      );
      expect(sent).toEqual([]);
    });

    it('supportsSourceCode and getObjectSourceUri describe the address', () => {
      const { utils, sent } = legacyUtils();
      expect(utils.supportsSourceCode('TABL/DT')).toBe(true);
      expect(utils.supportsSourceCode('DOMA/DD')).toBe(false);
      expect(utils.getObjectSourceUri('TABL/DT', 'ZGUARD')).toBe(
        '/sap/bc/adt/ddic/tables/zguard/source/main',
      );
      expect(sent).toEqual([]);
    });
  });
});
