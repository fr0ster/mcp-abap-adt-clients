/**
 * Where-used asks about the same address every other group operation does.
 *
 * It kept a vocabulary of its own until now — `intf/if`, `stru/dt`, no
 * behavior definition — beside `buildObjectUri`, which is verified against
 * every family's activate address. These cases pin that the two agree, and
 * that a code outside the ADT type tables does not compile — and, from a
 * caller outside the type system, is thrown before any request.
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import { AdtUtils } from '../../../core/shared/AdtUtils';
import { utilDocuments } from '../../../core/shared/utilResultSet';
import { whereUsedObjectUri } from '../../../core/shared/whereUsed';
import { buildObjectUri } from '../../../utils/activationUtils';
import { headersOf } from '../../helpers/adtHeaders';

const logger = {
  log: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
} as unknown as ILogger;

const recording = () => {
  const urls: string[] = [];
  const connection = {
    setSessionType: jest.fn(),
    makeAdtRequest: jest.fn(async (request: { url: string }) => {
      urls.push(request.url);
      return { status: 200, statusText: 'OK', data: '<r/>', headers: {} };
    }),
  } as unknown as IAbapConnection;
  return { connection, urls };
};

describe('whereUsedObjectUri', () => {
  it.each([
    ['ZCL_X', 'CLAS/OC'],
    ['ZIF_X', 'INTF/OI'],
    ['ZSTRUCT', 'TABL/DS'],
    ['ZI_TRAVEL', 'BDEF/BDO'],
  ] as const)(
    'builds the same address as buildObjectUri for %s (%s)',
    (name, type) => {
      expect(whereUsedObjectUri(name, type)).toBe(buildObjectUri(name, type));
    },
  );

  it('reads a function module as GROUP|FM', () => {
    expect(whereUsedObjectUri('ZFG|Z_FM', 'FUGR/FF')).toBe(
      '/sap/bc/adt/functions/groups/zfg/fmodules/z_fm',
    );
    expect(() => whereUsedObjectUri('Z_FM', 'FUGR/FF')).toThrow(
      /GROUP\|FM_NAME/,
    );
  });

  it('a code outside the tables does not compile, and is thrown at run time', () => {
    // `intf/if` and `stru/dt` were where-used's own spellings; ADT uses
    // neither. A caller outside the type system still gets no request.
    // @ts-expect-error -- INTF/IF is no code of the tables
    expect(() => whereUsedObjectUri('ZIF_X', 'INTF/IF')).toThrow(
      /No ADT address is known for object type/,
    );
    // @ts-expect-error -- a friendly name is no code of the tables
    expect(() => whereUsedObjectUri('ZCL_X', 'class')).toThrow(
      /No ADT address is known for object type/,
    );
    // @ts-expect-error -- an empty code is no code of the tables
    expect(() => whereUsedObjectUri('ZX', '')).toThrow(/object type/);
  });
});

describe('AdtUtils where-used members', () => {
  it('ask about the shared address', async () => {
    const { connection, urls } = recording();
    const utils = new AdtUtils(connection, logger, utilDocuments);

    await utils.getWhereUsed(
      {
        object_name: 'ZI_TRAVEL',
        object_type: 'BDEF/BDO',
      },
      { headers: headersOf(utils, 'getWhereUsed') },
    );
    await utils.getWhereUsedScope(
      {
        object_name: 'ZCL_X',
        object_type: 'CLAS/OC',
      },
      { headers: headersOf(utils, 'getWhereUsedScope') },
    );

    expect(urls).toEqual([
      `/sap/bc/adt/repository/informationsystem/usageReferences?uri=${encodeURIComponent('/sap/bc/adt/bo/behaviordefinitions/zi_travel')}`,
      `/sap/bc/adt/repository/informationsystem/usageReferences/scope?uri=${encodeURIComponent('/sap/bc/adt/oo/classes/zcl_x')}`,
    ]);
  });

  it('throw an unknown type before any request is made', async () => {
    const { connection, urls } = recording();
    const utils = new AdtUtils(connection, logger, utilDocuments);

    await expect(
      utils.getWhereUsed(
        // @ts-expect-error -- NOPE/XX is no code of the tables
        { object_name: 'ZX', object_type: 'NOPE/XX' },
        { headers: headersOf(utils, 'getWhereUsed') },
      ),
    ).rejects.toThrow(/No ADT address is known for object type/);
    await expect(
      utils.getWhereUsedScope(
        // @ts-expect-error -- an empty code is no code of the tables
        { object_name: 'ZX', object_type: '' },
        { headers: headersOf(utils, 'getWhereUsedScope') },
      ),
    ).rejects.toThrow(/object type/);
    expect(urls).toEqual([]);
  });
});
