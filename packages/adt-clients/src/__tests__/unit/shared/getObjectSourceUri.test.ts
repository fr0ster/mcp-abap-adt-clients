/**
 * Unit test for AdtUtils.getObjectSourceUri
 * Verifies active vs inactive version query handling across object types.
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtUtils } from '../../../core/shared/AdtUtils';
import { noopLogger } from '../../../utils/noopLogger';
import { createTestsLogger } from '../../helpers/testLogger';
import { logTestStep } from '../../helpers/testProgressLogger';

describe('AdtUtils.getObjectSourceUri', () => {
  const testsLogger = createTestsLogger();
  const utils = new AdtUtils({} as IAbapConnection, noopLogger);
  const objectName = 'ZADT_TEST_OBJ';
  const functionGroup = 'ZADT_TEST_FG';

  const sourceTypes: Array<{
    type: Parameters<AdtUtils['getObjectSourceUri']>[0];
    needsGroup?: boolean;
  }> = [
    { type: 'CLAS/OC' },
    { type: 'INTF/OI' },
    { type: 'PROG/P' },
    { type: 'DDLS/DF' },
    { type: 'TABL/DS' },
    { type: 'TABL/DT' },
    { type: 'FUGR/FF', needsGroup: true },
  ];

  // The addresses the friendly names built before interfaces-adt 21.0.0
  // (`class`, `interface`, `program`, `view`, `structure`, `table`,
  // `functionmodule`), unchanged under the codes that replace them.
  it.each([
    ['CLAS/OC', '/sap/bc/adt/oo/classes/zadt_test_obj/source/main'],
    ['INTF/OI', '/sap/bc/adt/oo/interfaces/zadt_test_obj/source/main'],
    ['PROG/P', '/sap/bc/adt/programs/programs/zadt_test_obj/source/main'],
    ['DDLS/DF', '/sap/bc/adt/ddic/ddl/sources/zadt_test_obj/source/main'],
    ['TABL/DS', '/sap/bc/adt/ddic/structures/zadt_test_obj/source/main'],
    ['TABL/DT', '/sap/bc/adt/ddic/tables/zadt_test_obj/source/main'],
    [
      'FUGR/FF',
      '/sap/bc/adt/functions/groups/zadt_test_fg/fmodules/zadt_test_obj/source/main',
    ],
  ] as const)('%s reads %s', (type, uri) => {
    expect(utils.getObjectSourceUri(type, objectName, functionGroup)).toBe(uri);
  });

  it('a table type has no source: TTYP/DA is no AdtSourceTypeCode', () => {
    // @ts-expect-error -- the tables list no `source` for TTYP/DA
    utils.getObjectSourceUri('TTYP/DA', objectName);
    expect(utils.supportsSourceCode('TTYP/DA')).toBe(false);
    expect(utils.supportsSourceCode('CLAS/OC')).toBe(true);
  });

  it('adds version=inactive for inactive reads', () => {
    logTestStep('build inactive uris', testsLogger);
    for (const { type, needsGroup } of sourceTypes) {
      const uri = utils.getObjectSourceUri(
        type,
        objectName,
        needsGroup ? functionGroup : undefined,
        'inactive',
      );
      testsLogger.info?.(`inactive ${type}: ${uri}`);
      expect(uri).toContain('version=inactive');
    }
  });

  it('adds version=active for active reads', () => {
    logTestStep('build active uris', testsLogger);
    for (const { type, needsGroup } of sourceTypes) {
      const uri = utils.getObjectSourceUri(
        type,
        objectName,
        needsGroup ? functionGroup : undefined,
        'active',
      );
      testsLogger.info?.(`active ${type}: ${uri}`);
      expect(uri).toContain('version=active');
    }
  });
});
