import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces-adt-connection';
import { readActivationRefusal, stillInactiveAmong } from '../refusals/read';
import { utilInactiveObjects } from '../results/utils';
import { stepTagged } from './corpus';

/**
 * Both readings of the inactive list — `utilInactiveObjects` and the
 * activation verdict (`stillInactiveAmong`) — read through one reader
 * (`inactiveList.ts`), and neither answers a list it cannot read as empty.
 * Pinned on the recorded S/4HANA 2025 list and three changes to it (written
 * from it, the review's cases): its entry tags renamed, its prefix rebound,
 * a character reference in a URI.
 */
const recorded = stepTagged(
  'activation-group-alone-s4-2025',
  'inactiveobjects',
);
const body = String(recorded.data);
const GROUP = '/sap/bc/adt/functions/groups/zact751p9325';
const REFUSAL = 'utilInactiveObjects: the answer is no inactive-objects list';

const withBody = (data: string): IAdtWireResponse => ({ ...recorded, data });
const names = (data: string) =>
  utilInactiveObjects(withBody(data)).objects.map((o) => o.name);
const stillNamed = (data: string) =>
  stillInactiveAmong([GROUP], withBody(data))?.map((o) => o.name) ?? null;

describe('the inactive list, read once for both readings', () => {
  it('reads the recorded list alike in both', () => {
    expect(names(body)).toEqual(['ZACT751P9325', 'SAPLZACT751P9325']);
    expect(stillNamed(body)).toEqual(['ZACT751P9325', 'SAPLZACT751P9325']);
  });

  it('refuses the list with its entry tags renamed, in both', () => {
    const renamed = body
      .split('<ioc:entry>')
      .join('<ioc:item>')
      .split('</ioc:entry>')
      .join('</ioc:item>');
    expect(() => names(renamed)).toThrow(REFUSAL);
    expect(stillNamed(renamed)).toBeNull();
  });

  it('reads the list with its prefix rebound to the same namespace, in both', () => {
    const rebound = body
      .split('ioc:')
      .join('i:')
      .split('xmlns:ioc=')
      .join('xmlns:i=');
    expect(names(rebound)).toEqual(['ZACT751P9325', 'SAPLZACT751P9325']);
    expect(stillNamed(rebound)).toEqual(['ZACT751P9325', 'SAPLZACT751P9325']);
  });

  it('refuses the same names in another namespace, in both', () => {
    const foreign = body
      .split('http://www.sap.com/abapxml/inactiveCtsObjects')
      .join('urn:another');
    expect(() => names(foreign)).toThrow(REFUSAL);
    expect(stillNamed(foreign)).toBeNull();
  });

  it('decodes a character reference in a URI alike in both', () => {
    const referenced = body
      .split(`adtcore:uri="${GROUP}"`)
      .join('adtcore:uri="/sap/bc/adt/functions/groups/zact75&#x31;p9325"');
    expect(
      utilInactiveObjects(withBody(referenced)).objects.find(
        (o) => o.name === 'ZACT751P9325',
      )?.uri,
    ).toBe(GROUP);
    expect(stillNamed(referenced)).toEqual([
      'ZACT751P9325',
      'SAPLZACT751P9325',
    ]);
  });

  it('refuses the list with a reference stripped of its name, in both', () => {
    const stripped = body.split('adtcore:name="SAPLZACT751P9325" ').join('');
    expect(stripped).not.toBe(body);
    expect(() => names(stripped)).toThrow(REFUSAL);
    expect(stillNamed(stripped)).toBeNull();
  });

  it('refuses a namespaced list holding only text, in both', () => {
    const textOnly =
      '<?xml version="1.0" encoding="utf-8"?><ioc:inactiveObjects xmlns:ioc="http://www.sap.com/abapxml/inactiveCtsObjects">nothing here</ioc:inactiveObjects>';
    expect(() => names(textOnly)).toThrow(REFUSAL);
    expect(stillNamed(textOnly)).toBeNull();
  });

  it('the activation verdict does not read an unreadable list as nothing inactive', () => {
    const stripped = body.split('adtcore:name="SAPLZACT751P9325" ').join('');
    const verdict = readActivationRefusal(
      '<?xml version="1.0" encoding="utf-8"?><chkl:messages xmlns:chkl="http://www.sap.com/abapxml/checklist"><chkl:properties activationExecuted="false"/></chkl:messages>',
      { named: [GROUP], inactiveObjects: withBody(stripped) },
    );
    expect(verdict).not.toBeNull();
  });

  it('a renamed list in an activation answer is not activated, with nothing named', () => {
    const renamed = body.split('ioc:entry').join('ioc:item');
    const refusal = readActivationRefusal(renamed);
    expect(refusal).not.toBeNull();
  });
});
