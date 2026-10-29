/**
 * `getUtils()` sends no request it did not send before 38.0.0 (review fix 3):
 * its generic reads serve the codes they served then (and `FUGR/F`, whose
 * Accept was measured), a group activation activates only what the tables
 * activate, and every other code is refused — by its type, and, from a
 * caller outside the type system, before any request. Also: a parented code
 * names its parent in the generic reads and where-used (fix 6), the generic
 * source address spells an enhancement's version as its own builder does
 * (fix 7), and `VIEW/DV` keeps its group-operation address (fix 10).
 */
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import { getEnhancementSource } from '../../../core/enhancement/read';
import { AdtUtils } from '../../../core/shared/AdtUtils';
import { utilDocuments } from '../../../core/shared/utilResultSet';
import { whereUsedObjectUri } from '../../../core/shared/whereUsed';
import { DDIC_VIEW } from '../../../endpoints/objects';
import { buildObjectUri } from '../../../utils/activationUtils';
import { noopLogger } from '../../../utils/noopLogger';
import { headersOf } from '../../helpers/adtHeaders';

interface Sent {
  url: string;
  method: string;
  data?: unknown;
  headers?: Record<string, string>;
}

function recording() {
  const sent: Sent[] = [];
  const connection = {
    setSessionType: jest.fn(),
    makeAdtRequest: jest.fn(async (request: Sent) => {
      sent.push(request);
      return { status: 200, statusText: 'OK', data: '<x/>', headers: {} };
    }),
  } as unknown as IAbapConnection;
  return {
    utils: new AdtUtils(connection, {
      logger: noopLogger,
      results: utilDocuments,
    }),
    sent,
  };
}

describe('readObjectMetadata serves the codes it served, and only those', () => {
  it.each([
    'BDEF/BDO',
    'SRVD/SRV',
    'DDLX/EX',
    'DCLS/DL',
    'ENHO/XHH',
    'PROG/I',
  ] as const)('refuses %s without a request', async (code) => {
    const { utils, sent } = recording();
    await expect(
      // @ts-expect-error -- readObjectMetadata reads no such code
      utils.readObjectMetadata(code, 'ZGUARD'),
    ).rejects.toThrow(`readObjectMetadata reads no ${code}`);
    expect(sent).toEqual([]);
  });

  it('sends for a code it reads, with its Accept', async () => {
    const { utils, sent } = recording();
    await utils.readObjectMetadata('DOMA/DD', 'ZGUARD');
    expect(sent.map((r) => [r.method, r.url, r.headers?.Accept])).toEqual([
      [
        'GET',
        '/sap/bc/adt/ddic/domains/zguard',
        'application/vnd.sap.adt.domains.v2+xml, application/vnd.sap.adt.domains.v1+xml',
      ],
    ]);
  });

  it('a function module names its group: without it, it does not compile', async () => {
    const { utils, sent } = recording();
    // @ts-expect-error -- FUGR/FF is read under its function group
    await expect(utils.readObjectMetadata('FUGR/FF', 'Z_FM')).rejects.toThrow(
      /parent/,
    );
    expect(sent).toEqual([]);
    await utils.readObjectMetadata('FUGR/FF', 'Z_FM', 'ZFG');
    expect(sent.map((r) => r.url)).toEqual([
      '/sap/bc/adt/functions/groups/zfg/fmodules/z_fm',
    ]);
  });
});

describe('readObjectSource serves the codes it served, and only those', () => {
  it.each([
    'PROG/I',
    'FUGR/I',
    'DCLS/DL',
    'BDEF/BDO',
    'ENHO/XHH',
    'FTG2/FT',
  ] as const)('refuses %s without a request', async (code) => {
    const { utils, sent } = recording();
    await expect(
      // @ts-expect-error -- readObjectSource reads no such code
      utils.readObjectSource(code, 'ZGUARD'),
    ).rejects.toThrow(
      `Object type ${code} does not support source code reading`,
    );
    expect(sent).toEqual([]);
    expect(utils.supportsSourceCode(code)).toBe(false);
  });

  it('a function module names its group: without it, it does not compile', async () => {
    const { utils, sent } = recording();
    // @ts-expect-error -- FUGR/FF is read under its function group
    await expect(utils.readObjectSource('FUGR/FF', 'Z_FM')).rejects.toThrow(
      /parent/,
    );
    expect(sent).toEqual([]);
  });
});

describe('a group activation activates what the tables activate', () => {
  it.each(['MSAG/N'] as const)(
    'refuses %s, whose API lists no activate, without a request',
    async (code) => {
      const { utils, sent } = recording();
      await expect(
        utils.activateObjectsGroup(
          // @ts-expect-error -- the tables list no activate for this code
          [{ name: 'ZGUARD', type: code }],
          false,
          { headers: headersOf(utils, 'activateObjectsGroup') },
        ),
      ).rejects.toThrow(/list no activate/);
      expect(sent).toEqual([]);
    },
  );
});

describe('a package is activated in a group, as before 38.0.0', () => {
  it('DEVC/K is sent, though its table lists no activate', async () => {
    const { utils, sent } = recording();
    await utils.activateObjectsGroup(
      [{ name: 'ZPKG_GUARD', type: 'DEVC/K' }],
      false,
      { headers: headersOf(utils, 'activateObjectsGroup') },
    );
    expect(sent).toHaveLength(1);
    expect(String(sent[0]?.data)).toContain('/sap/bc/adt/packages/zpkg_guard');
  });
});

describe('where-used names a parent it can address', () => {
  it('a function include, whose group it has no field for, does not compile, and throws', () => {
    // @ts-expect-error -- where-used cannot address FUGR/I
    expect(() => whereUsedObjectUri('LZFGTOP', 'FUGR/I')).toThrow(/parent/);
  });
});

describe('the generic source address spells an enhancement version as its builder does', () => {
  it('inactive is workingArea, through both', async () => {
    const { utils } = recording();
    const sent: Sent[] = [];
    const connection = {
      makeAdtRequest: jest.fn(async (request: Sent) => {
        sent.push(request);
        return { status: 200, statusText: 'OK', data: '', headers: {} };
      }),
    } as unknown as IAbapConnection;
    await getEnhancementSource(connection, 'enhoxhh', 'ZENH', 'inactive');
    const generic = utils.getObjectSourceUri(
      'ENHO/XHH',
      'ZENH',
      undefined,
      'inactive',
    );
    expect(generic).toBe(sent[0]?.url);
    expect(generic).toContain('version=workingArea');
    expect(
      utils.getObjectSourceUri('ENHO/XHH', 'ZENH', undefined, 'active'),
    ).toContain('version=active');
    // Every other code keeps the word.
    expect(
      utils.getObjectSourceUri('CLAS/OC', 'ZCL_X', undefined, 'inactive'),
    ).toContain('version=inactive');
  });
});

describe('VIEW/DV keeps its group-operation address', () => {
  it('is addressed under /ddic/views, as before 38.0.0', () => {
    expect(buildObjectUri('ZV_GUARD', 'VIEW/DV')).toBe(
      DDIC_VIEW.uri('ZV_GUARD'),
    );
    expect(whereUsedObjectUri('ZV_GUARD', 'VIEW/DV')).toBe(
      DDIC_VIEW.uri('ZV_GUARD'),
    );
  });

  it('is activated and deleted by a group operation', async () => {
    const { utils, sent } = recording();
    // VIEW/DV is no code of interfaces-adt 21.0.0's tables, so the members,
    // which implement its atoms, cannot type it: a caller outside the type
    // system still gets its request.
    const viewDv = JSON.parse('"VIEW/DV"');
    await utils.activateObjectsGroup(
      [{ name: 'ZV_GUARD', type: viewDv }],
      false,
      { headers: headersOf(utils, 'activateObjectsGroup') },
    );
    await utils.deleteObjectsGroup(
      [{ name: 'ZV_GUARD', type: viewDv }],
      undefined,
      { headers: headersOf(utils, 'deleteObjectsGroup') },
    );
    expect(sent).toHaveLength(2);
    for (const request of sent) {
      expect(String(request.data)).toContain(DDIC_VIEW.uri('ZV_GUARD'));
    }
  });
});
