import { ADT_NO_FAILURE } from '@mcp-abap-adt/interfaces-adt';
import { analyseActivation } from '../refusals/analyse';
import { stillInactiveAmong } from '../refusals/read';
import { utilInactiveObjects } from '../results/utils';
import { stepTagged } from './corpus';

/**
 * The activation answers of the 30.1.0 / 46.1.0 research, recorded
 * 2026-11-19 (`corpus/adt/answers`, each sidecar's note).
 */
describe('an activation SAP executed with errors (V6)', () => {
  it.each([
    [
      's4-2025',
      'Activation was cancelled.; Value in field Data Class (value ZZNOP not permitted); TABL ZMCP_TV443E was not activated',
    ],
    ['abap-cloud', 'Value in field Data Class; value ZZNOP not permitted'],
  ])(
    'is refused by its messages, not passed by activationExecuted="true" (%s)',
    (release, words) => {
      const answer = stepTagged(
        `activation-table-data-class-refused-${release}`,
        'activate',
      );
      expect(String(answer.data)).toContain('activationExecuted="true"');
      const verdict = analyseActivation(ADT_NO_FAILURE, answer);
      if (verdict === ADT_NO_FAILURE) throw new Error('expected a failure');
      expect(verdict.message).toContain(`Activation failed: ${words}`);
      expect(verdict.messages.every((m) => m.type === 'E')).toBe(true);
      expect(verdict.stillInactive).toEqual([]);
    },
  );
});

describe("a class's text elements on the inactive list (V8)", () => {
  const CLASS = '/sap/bc/adt/oo/classes/zcl_mcp_tv70d2';
  const TEXTS = '/sap/bc/adt/textelements/classes/zcl_mcp_tv70d2';

  it('read with the address SAP listed them at, beside the class-pool name', () => {
    const listed = utilInactiveObjects(
      stepTagged('activation-class-text-elements-s4-2025', 'inactiveobjects'),
    );
    expect(listed.objects).toContainEqual({
      type: 'PROG/PX',
      name: 'ZCL_MCP_TV70D2================CP',
      uri: TEXTS,
      parentUri: CLASS,
    });
  });

  it('count as named by an activation that named the CLAS/OCX reference, by uri', () => {
    const still = stillInactiveAmong(
      [CLASS, TEXTS],
      stepTagged('activation-class-text-elements-s4-2025', 'inactiveobjects'),
    );
    expect(still?.map((o) => [o.type, o.name])).toEqual([
      ['CLAS/OC', 'ZCL_MCP_TV70D2'],
      ['PROG/PX', 'ZCL_MCP_TV70D2================CP'],
    ]);
  });

  it('count as named by uri even when the class alone was named, by parentUri', () => {
    const still = stillInactiveAmong(
      [CLASS],
      stepTagged('activation-class-text-elements-s4-2025', 'inactiveobjects'),
    );
    expect(still?.map((o) => o.name)).toEqual([
      'ZCL_MCP_TV70D2',
      'ZCL_MCP_TV70D2================CP',
    ]);
  });
});

describe("a function group's text elements on the cloud", () => {
  const GROUP = '/sap/bc/adt/functions/groups/zmcp_txc5563';
  const TEXTS = '/sap/bc/adt/textelements/functiongroups/zmcp_txc5563';
  const CASE = 'text-elements-function-group-abap-cloud';

  it('are listed as PROG/PX SAPL{GROUP} at their own address, and leave the list with the group', () => {
    const before = stepsOf(CASE, 'inactiveobjects');
    expect(utilInactiveObjects(before[0]).objects).toEqual([
      { type: 'FUGR/F', name: 'ZMCP_TXC5563', uri: GROUP },
      {
        type: 'PROG/PX',
        name: 'SAPLZMCP_TXC5563',
        uri: TEXTS,
        parentUri: GROUP,
      },
    ]);
    expect(stillInactiveAmong([GROUP, TEXTS], before[1])).toEqual([]);
    expect(
      analyseActivation(ADT_NO_FAILURE, stepTagged(CASE, 'activate')),
    ).toBe(ADT_NO_FAILURE);
  });
});

/** Every step of a case recorded under `tag`, in order. */
function stepsOf(caseName: string, tag: string) {
  return [1, 2, 3, 4, 5].flatMap((step) => {
    try {
      return [stepTagged(caseName, `0${step}-${tag}`)];
    } catch {
      return [];
    }
  });
}
