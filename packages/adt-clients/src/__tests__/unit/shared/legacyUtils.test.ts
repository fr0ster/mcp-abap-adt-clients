/**
 * `getUtils()` on the legacy client (spec §10.2). Measured over RFC on
 * SAP_BASIS 7.40 SP04: `usageReferences`, `virtualfolders/contents`,
 * `objecttypes`, a table's source and domain and data element metadata
 * answered `404`; a legacy group activation is synchronous and yields no run
 * id. Each of those answers the library's refusal without a request, naming
 * the operation and the endpoint 7.40 lacks. `readObjectMetadata` and
 * `readObjectSource` refuse the DDIC types 7.40 does not serve — in every
 * alias, in any case — and send for the types it does; an unknown type is
 * still the caller's mistake and is thrown, as on the modern client.
 */

import {
  AdtObjectErrorCodes,
  type AdtObjectType,
  type AdtSourceObjectType,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtClientLegacy } from '../../../clients/AdtClientLegacy';
import type { AdtUtilsLegacy } from '../../../core/shared/AdtUtilsLegacy';
import { headersOf } from '../../helpers/adtHeaders';
import '../../helpers/legacyRegistrations';

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
            { object_name: 'ZCL_GUARD', object_type: 'class' },
            { headers: headersOf(utils, 'getWhereUsed') },
          ),
      ],
      [
        'getWhereUsedScope',
        `${RIS}/usageReferences/scope`,
        (utils) =>
          utils.getWhereUsedScope(
            { object_name: 'ZCL_GUARD', object_type: 'class' },
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
          { object_name: 'ZCL_GUARD', object_type: 'class' },
          { headers: headersOf(utils, member) },
        )) as Answer;
        const message = answer.getError?.().message;
        expect(message).toContain(
          'fullnamemapping → metadata → whereused?RIS_REQUEST_TYPE=WHERE_USED_LAZY',
        );
        expect(message).toContain('which this library does not implement');
      },
    );

    it('getAllTypes names repository/typestructure, which 7.40 serves object types through', async () => {
      const { utils } = legacyUtils();
      const answer = (await utils.getAllTypes()) as Answer;
      const message = answer.getError?.().message;
      expect(message).toContain('repository/typestructure');
      expect(message).toContain('which this library does not implement');
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

  const METADATA_REFUSED: [alias: string, endpoint: string][] = [
    ['domain', '/sap/bc/adt/ddic/domains'],
    ['doma/dd', '/sap/bc/adt/ddic/domains'],
    ['dataelement', '/sap/bc/adt/ddic/dataelements'],
    ['dtel', '/sap/bc/adt/ddic/dataelements'],
    ['dtel/de', '/sap/bc/adt/ddic/dataelements'],
    ['structure', '/sap/bc/adt/ddic/structures'],
    ['stru/dt', '/sap/bc/adt/ddic/structures'],
    ['table', '/sap/bc/adt/ddic/tables'],
    ['tabl/dt', '/sap/bc/adt/ddic/tables'],
    ['tabletype', '/sap/bc/adt/ddic/tabletypes'],
    ['ttyp/df', '/sap/bc/adt/ddic/tabletypes'],
    ['package', '/sap/bc/adt/packages/{name}'],
    ['devc/k', '/sap/bc/adt/packages/{name}'],
  ];
  const SOURCE_REFUSED = METADATA_REFUSED.filter(([alias]) =>
    [
      'structure',
      'stru/dt',
      'table',
      'tabl/dt',
      'tabletype',
      'ttyp/df',
    ].includes(alias),
  );
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
  const inEveryCase = (rows: [string, string][]) =>
    rows.flatMap(([alias, endpoint]) => [
      [alias, endpoint],
      [alias.toUpperCase(), endpoint],
    ]);

  describe('readObjectMetadata', () => {
    it.each(inEveryCase(METADATA_REFUSED))(
      'refuses %s without a request',
      async (alias, endpoint) => {
        const { utils, sent } = legacyUtils();
        const answer = await utils.readObjectMetadata(
          alias as AdtObjectType,
          'ZGUARD',
        );
        expectRefusal(answer, sent, 'readObjectMetadata', endpoint);
        expect((answer as Answer).getError?.().message).toContain(alias);
        expectEvidence(answer, endpoint);
      },
    );

    it.each([
      ['class', '/sap/bc/adt/oo/classes/zguard'],
      ['program', '/sap/bc/adt/programs/programs/zguard'],
      ['interface', '/sap/bc/adt/oo/interfaces/zguard'],
      ['functionmodule', '/sap/bc/adt/functions/groups/zfg/fmodules/zguard'],
      ['view', '/sap/bc/adt/ddic/ddl/sources/zguard'],
      ['functiongroup', '/sap/bc/adt/functions/groups/zguard'],
    ])('sends for %s', async (type, url) => {
      const { utils, sent } = legacyUtils();
      const answer = await utils.readObjectMetadata(
        type as AdtObjectType,
        'ZGUARD',
        'ZFG',
      );
      expect(answer.ok).toBe(true);
      expect(sent).toEqual([{ method: 'GET', url }]);
    });

    it('still throws for an unknown type', async () => {
      const { utils, sent } = legacyUtils();
      await expect(
        utils.readObjectMetadata('nosuchtype' as AdtObjectType, 'ZGUARD'),
      ).rejects.toThrow('Unsupported object type for metadata: nosuchtype');
      expect(sent).toEqual([]);
    });
  });

  describe('readObjectSource', () => {
    it.each(inEveryCase(SOURCE_REFUSED))(
      'refuses %s without a request',
      async (alias, endpoint) => {
        const { utils, sent } = legacyUtils();
        const answer = await utils.readObjectSource(
          alias as AdtSourceObjectType,
          'ZGUARD',
        );
        expectRefusal(answer, sent, 'readObjectSource', endpoint);
        expect((answer as Answer).getError?.().message).toContain(alias);
        expectEvidence(answer, endpoint);
      },
    );

    it.each([
      ['class', '/sap/bc/adt/oo/classes/zguard/source/main'],
      ['program', '/sap/bc/adt/programs/programs/zguard/source/main'],
      ['interface', '/sap/bc/adt/oo/interfaces/zguard/source/main'],
      [
        'functionmodule',
        '/sap/bc/adt/functions/groups/zfg/fmodules/zguard/source/main',
      ],
      ['view', '/sap/bc/adt/ddic/ddl/sources/zguard/source/main'],
    ])('sends for %s', async (type, url) => {
      const { utils, sent } = legacyUtils();
      const answer = await utils.readObjectSource(
        type as AdtSourceObjectType,
        'ZGUARD',
        'ZFG',
      );
      expect(answer.ok).toBe(true);
      expect(sent).toEqual([{ method: 'GET', url }]);
    });

    it.each([
      ['an unknown type', 'nosuchtype'],
      ['a type with no source', 'functiongroup'],
      ['a DDIC type with no source', 'domain'],
    ])('still throws for %s', async (_what, type) => {
      const { utils, sent } = legacyUtils();
      await expect(
        utils.readObjectSource(type as AdtSourceObjectType, 'ZGUARD'),
      ).rejects.toThrow(
        `Object type ${type} does not support source code reading`,
      );
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
      expect(utils.supportsSourceCode('table' as AdtObjectType)).toBe(true);
      expect(utils.supportsSourceCode('domain' as AdtObjectType)).toBe(false);
      expect(
        utils.getObjectSourceUri('table' as AdtSourceObjectType, 'ZGUARD'),
      ).toBe('/sap/bc/adt/ddic/tables/zguard/source/main');
      expect(sent).toEqual([]);
    });
  });
});
