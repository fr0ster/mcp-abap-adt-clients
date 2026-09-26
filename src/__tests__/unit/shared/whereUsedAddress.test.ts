/**
 * Where-used asks about the same address every other group operation does.
 *
 * It kept a vocabulary of its own until now — `intf/if`, `stru/dt`, no
 * behavior definition — beside `buildObjectUri`, which is verified against
 * every family's activate address. These cases pin that the two agree, that the
 * friendly names callers pass still resolve, and that a type neither knows is
 * the caller's argument, thrown before any request.
 */

import { AdtObjectErrorCodes } from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import { AdtUtils } from '../../../core/shared/AdtUtils';
import { AdtUtilsLegacy } from '../../../core/shared/AdtUtilsLegacy';
import { whereUsedObjectUri } from '../../../core/shared/whereUsed';
import { buildObjectUri } from '../../../utils/activationUtils';

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
  ])('builds the same address as buildObjectUri for %s (%s)', (name, type) => {
    expect(whereUsedObjectUri(name, type)).toBe(buildObjectUri(name, type));
  });

  it('accepts the code in any case', () => {
    expect(whereUsedObjectUri('ZCL_X', 'clas/oc')).toBe(
      buildObjectUri('ZCL_X', 'CLAS/OC'),
    );
  });

  it.each([
    ['class', 'CLAS/OC'],
    ['program', 'PROG/P'],
    ['include', 'PROG/I'],
    ['function', 'FUGR/F'],
    ['functiongroup', 'FUGR/F'],
    ['interface', 'INTF/OI'],
    ['package', 'DEVC/K'],
    ['table', 'TABL/DT'],
    ['structure', 'STRU/DS'],
    ['domain', 'DOMA/DD'],
    ['dataelement', 'DTEL/DE'],
    ['view', 'DDLS/DF'],
  ])('maps the friendly name %s to %s', (alias, code) => {
    expect(whereUsedObjectUri('ZOBJ', alias)).toBe(
      buildObjectUri('ZOBJ', code),
    );
  });

  it('reads a function module as GROUP|FM', () => {
    expect(whereUsedObjectUri('ZFG|Z_FM', 'functionmodule')).toBe(
      '/sap/bc/adt/functions/groups/zfg/fmodules/z_fm',
    );
    expect(() => whereUsedObjectUri('Z_FM', 'functionmodule')).toThrow(
      /GROUP\|FM_NAME/,
    );
  });

  it('throws for a type neither vocabulary knows, and for none at all', () => {
    // `intf/if` and `stru/dt` were where-used's own spellings; ADT uses neither.
    expect(() => whereUsedObjectUri('ZIF_X', 'intf/if')).toThrow(
      /Unsupported object type/,
    );
    expect(() => whereUsedObjectUri('ZX', 'NOPE/XX')).toThrow(
      /Unsupported object type/,
    );
    expect(() => whereUsedObjectUri('ZX', '')).toThrow(/object type/);
  });
});

describe('AdtUtils where-used members', () => {
  it('ask about the shared address', async () => {
    const { connection, urls } = recording();
    const utils = new AdtUtils(connection, logger);

    await utils.getWhereUsed({
      object_name: 'ZI_TRAVEL',
      object_type: 'BDEF/BDO',
    });
    await utils.getWhereUsedScope({
      object_name: 'ZCL_X',
      object_type: 'class',
    });

    expect(urls).toEqual([
      `/sap/bc/adt/repository/informationsystem/usageReferences?uri=${encodeURIComponent('/sap/bc/adt/bo/behaviordefinitions/zi_travel')}`,
      `/sap/bc/adt/repository/informationsystem/usageReferences/scope?uri=${encodeURIComponent('/sap/bc/adt/oo/classes/zcl_x')}`,
    ]);
  });

  it('throw an unknown type before any request is made', async () => {
    const { connection, urls } = recording();
    const utils = new AdtUtils(connection, logger);

    await expect(
      utils.getWhereUsed({ object_name: 'ZX', object_type: 'NOPE/XX' }),
    ).rejects.toThrow(/Unsupported object type/);
    await expect(
      utils.getWhereUsedScope({ object_name: 'ZX', object_type: '' }),
    ).rejects.toThrow(/object type/);
    expect(urls).toEqual([]);
  });
});

describe('AdtUtilsLegacy refusals', () => {
  it('answer an unsupported operation, not a connection failure, and ask nothing', async () => {
    const { connection, urls } = recording();
    const utils = new AdtUtilsLegacy(connection, logger);

    for (const answer of [
      await utils.getSqlQuery({ sql_query: 'SELECT * FROM T000' }),
      await utils.getTableColumns('T000'),
      await utils.getTableContents({ table_name: 'T000' } as never),
    ]) {
      expect(answer.ok).toBe(false);
      if (answer.ok) continue;
      expect(answer.getError().origin).toBe('refusal');
      expect(answer.getError().code).toBe(
        AdtObjectErrorCodes.UNSUPPORTED_OPERATION,
      );
    }
    expect(urls).toEqual([]);
  });
});
