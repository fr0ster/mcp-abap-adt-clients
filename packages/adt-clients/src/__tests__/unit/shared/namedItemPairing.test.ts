import { utilNamedItems } from '@mcp-abap-adt/adt-strategies';
import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces-adt-connection';
import type { INamedItem } from '../../../core/shared/utilResults';

/**
 * adt-clients' `INamedItem` pairs with adt-strategies' `utilNamedItems`
 * (46.3.0): the documented `types: utilNamedItems` slot answers items this
 * type takes, a description absent where the list carries none. Until then
 * `description` was required here and optional there, and the assignment
 * below failed to compile (TS2322).
 */
const answer: IAdtWireResponse = {
  status: 200,
  statusText: 'OK',
  headers: {},
  data: '<nameditem:namedItemList xmlns:nameditem="http://www.sap.com/adt/nameditem"><nameditem:namedItem><nameditem:name>NODESC</nameditem:name></nameditem:namedItem></nameditem:namedItemList>',
};

describe('INamedItem pairs with utilNamedItems', () => {
  it('takes what the reading answers, a description absent', () => {
    const items: INamedItem[] = utilNamedItems(answer);
    expect(items).toEqual([{ name: 'NODESC' }]);
    expect(items[0] !== undefined && 'description' in items[0]).toBe(false);
  });
});
