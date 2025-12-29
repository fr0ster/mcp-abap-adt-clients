/**
 * Unit test for AdtUtils.getObjectSourceUri
 * Verifies active vs inactive version query handling across object types.
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { AdtUtils } from '../../../core/shared/AdtUtils';
import { noopLogger } from '../../../utils/noopLogger';
import { logTestStep } from '../../helpers/testProgressLogger';
import { createTestsLogger } from '../../helpers/testLogger';

describe('AdtUtils.getObjectSourceUri', () => {
  const testsLogger = createTestsLogger();
  const utils = new AdtUtils({} as IAbapConnection, noopLogger);
  const objectName = 'ZADT_TEST_OBJ';
  const functionGroup = 'ZADT_TEST_FG';

  const sourceTypes: Array<{
    type: Parameters<AdtUtils['getObjectSourceUri']>[0];
    needsGroup?: boolean;
  }> = [
    { type: 'class' },
    { type: 'interface' },
    { type: 'program' },
    { type: 'view' },
    { type: 'structure' },
    { type: 'table' },
    { type: 'tabletype' },
    { type: 'functionmodule', needsGroup: true },
  ];

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
