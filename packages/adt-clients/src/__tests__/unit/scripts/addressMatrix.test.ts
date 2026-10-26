/**
 * What the address matrix reads for a registry record. A record that builds no
 * address by name — a collection alone — is read at its collection, not
 * crashed on.
 */

import { addressFor } from '../../../../scripts/lib/addressMatrix';
import { PROGRAM } from '../../../endpoints/objects';

describe('addressFor', () => {
  it('builds a named address through the record', () => {
    expect(addressFor(PROGRAM, ['ZREP'])).toEqual({
      url: '/sap/bc/adt/programs/programs/zrep',
      byName: true,
    });
  });
  it('reads a collection-only record at its collection', () => {
    expect(
      addressFor({ collection: '/sap/bc/adt/x/collection' }, ['ANY']),
    ).toEqual({
      url: '/sap/bc/adt/x/collection',
      byName: false,
    });
  });
  it('answers nothing for a record with neither', () => {
    expect(addressFor({ root: '/x' }, [])).toBeUndefined();
  });
});
