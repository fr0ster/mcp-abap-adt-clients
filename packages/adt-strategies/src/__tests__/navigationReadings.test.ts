import { navigationTarget, readNavigationTarget } from '../results/navigation';
import { answerFor } from './corpus';

/**
 * Where a reference leads, against the navigation answers recorded on ABAP
 * cloud and on premise (2026-11-28): the include before the `#` and the
 * `start` of the fragment; anything else reads as no target.
 */
describe('readNavigationTarget', () => {
  it.each([
    [
      'navigate-form-abap-cloud',
      '/sap/bc/adt/functions/groups/seworkingarea/includes/lseworkingareaf02/source/main',
      { line: 128, column: 5 },
    ],
    [
      'navigate-module-abap-cloud',
      '/sap/bc/adt/functions/groups/seworkingarea/includes/lseworkingareai01/source/main',
      { line: 6, column: 7 },
    ],
    [
      'navigate-local-class-abap-cloud',
      '/sap/bc/adt/functions/groups/seworkingarea/includes/lseworkingareafcl/source/main',
      { line: 447, column: 6 },
    ],
    [
      'navigate-type-abap-cloud',
      '/sap/bc/adt/functions/groups/seworkingarea/includes/lseworkingareatop/source/main',
      { line: 19, column: 8 },
    ],
    [
      'navigate-local-method-implementation-abap-cloud',
      '/sap/bc/adt/functions/groups/seworkingarea/includes/lseworkingareafc1/source/main',
      { line: 1993, column: 9 },
    ],
    [
      'navigate-form-s4-2025',
      '/sap/bc/adt/programs/programs/zabapgit_standalone/source/main',
      { line: 154532, column: 5 },
    ],
    [
      'navigate-local-method-definition-s4-2025',
      '/sap/bc/adt/programs/programs/zabapgit_standalone/source/main',
      { line: 133603, column: 9 },
    ],
  ])('%s: the include and the start', (caseName, include, start) => {
    expect(navigationTarget(answerFor(caseName))).toEqual({ include, start });
  });

  it('reads the refusal of a local method’s definition link as no target', () => {
    expect(
      navigationTarget(
        answerFor('navigate-local-method-definition-refused-abap-cloud'),
      ),
    ).toBeUndefined();
  });

  it.each([
    ['an empty answer', ''],
    [
      'no objectReference',
      '<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core"/>',
    ],
    [
      'a reference without a fragment',
      '<adtcore:objectReference adtcore:uri="/sap/bc/adt/oo/classes/zcl_x/source/main" xmlns:adtcore="http://www.sap.com/adt/core"/>',
    ],
    [
      'a fragment without start',
      '<adtcore:objectReference adtcore:uri="/sap/bc/adt/oo/classes/zcl_x/source/main#type=CLAS%2FOM;name=X" xmlns:adtcore="http://www.sap.com/adt/core"/>',
    ],
    [
      'a start that does not read',
      '<adtcore:objectReference adtcore:uri="/sap/bc/adt/oo/classes/zcl_x/source/main#start=a,1" xmlns:adtcore="http://www.sap.com/adt/core"/>',
    ],
    ['not XML', 'plain text'],
  ])('reads %s as no target', (_what, document) => {
    expect(readNavigationTarget(document)).toBeUndefined();
  });
});
