import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces-adt-connection';
import { stillInactiveAmong } from '../refusals/read';
import { stepTagged } from './corpus';

/**
 * `stillInactiveAmong` reads every object and every reference of an entry
 * (0.28.0), as `utilInactiveObjects` does.
 */
const recorded = stepTagged(
  'activation-group-alone-s4-2025',
  'inactiveobjects',
);
const GROUP = '/sap/bc/adt/functions/groups/zact751p9325';
const MAIN = '/sap/bc/adt/functions/groups/zact751p9325/source/main';

describe('stillInactiveAmong reads every object of an entry', () => {
  it('names the recorded S/4HANA 2025 listing’s group and its include', () => {
    expect(stillInactiveAmong([GROUP], recorded)?.map((o) => o.name)).toEqual([
      'ZACT751P9325',
      'SAPLZACT751P9325',
    ]);
  });

  // Written from the recorded listing: its two object entries joined into one
  // entry, as two `ioc:object`, and the include given a second `ioc:ref`. No
  // recording holds an entry with several; the reading must not depend on it.
  it('reads both objects of one entry, and both references of one object', () => {
    const body = String(recorded.data);
    const first = body.indexOf('<ioc:entry>', body.indexOf('<ioc:entry>') + 1);
    const objects = [
      ...body.matchAll(/<ioc:object [\s\S]*?<\/ioc:object>/g),
    ].map((m) => m[0]);
    const doubled = objects[1].replace(
      '</ioc:object>',
      `<ioc:ref adtcore:uri="${GROUP}/includes/lzact751p9325top" adtcore:type="FUGR/I" adtcore:name="LZACT751P9325TOP" adtcore:parentUri="${GROUP}" xmlns:adtcore="http://www.sap.com/adt/core"/></ioc:object>`,
    );
    const joined = `${body.slice(0, first)}<ioc:entry>${objects[0]}${doubled}<ioc:transport/></ioc:entry></ioc:inactiveObjects>`;
    const answer: IAdtWireResponse = { ...recorded, data: joined };
    expect(stillInactiveAmong([GROUP], answer)?.map((o) => o.name)).toEqual([
      'ZACT751P9325',
      'SAPLZACT751P9325',
      'LZACT751P9325TOP',
    ]);
    expect(stillInactiveAmong([MAIN], answer)?.map((o) => o.name)).toEqual([
      'SAPLZACT751P9325',
    ]);
  });
});
