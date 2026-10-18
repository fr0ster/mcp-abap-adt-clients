/**
 * A namespaced enhancement name is percent-encoded once. getEnhancementUri
 * encodes the name itself (through the registry's seg), so a module that
 * encoded it first sent `%252fnsp%252fzenh` — `/NSP/` encoded twice.
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import { activateEnhancement } from '../../../../core/enhancement/activation';
import { lockEnhancement } from '../../../../core/enhancement/lock';
import { getEnhancementMetadata } from '../../../../core/enhancement/read';
import { unlockEnhancement } from '../../../../core/enhancement/unlock';
import { headersFor } from '../../../helpers/adtHeaders';

function connection() {
  return {
    setSessionType: jest.fn(),
    makeAdtRequest: jest.fn().mockResolvedValue({ status: 200, data: '' }),
  } as unknown as IAbapConnection;
}
const urlOf = (c: IAbapConnection): string =>
  (c.makeAdtRequest as jest.Mock).mock.calls[0][0].url;
const bodyOf = (c: IAbapConnection): string =>
  String((c.makeAdtRequest as jest.Mock).mock.calls[0][0].data ?? '');

const ONCE = '/sap/bc/adt/enhancements/enhoxhb/%2Fnsp%2Fzenh';

describe('a namespaced enhancement is encoded once', () => {
  it('lock', async () => {
    const c = connection();
    await lockEnhancement(c, 'enhoxhb', '/NSP/ZENH');
    expect(urlOf(c)).toContain(ONCE);
  });
  it('unlock', async () => {
    const c = connection();
    await unlockEnhancement(c, 'enhoxhb', '/NSP/ZENH', 'LH');
    expect(urlOf(c)).toContain(ONCE);
  });
  it('read', async () => {
    const c = connection();
    await getEnhancementMetadata(c, 'enhoxhb', '/NSP/ZENH');
    expect(urlOf(c)).toContain(ONCE);
  });
  it('activation names it once in the object reference', async () => {
    const c = connection();
    await activateEnhancement(
      c,
      headersFor('AdtEnhancement.activate'),
      'enhoxhb',
      '/NSP/ZENH',
    );
    expect(bodyOf(c)).toContain(ONCE);
    expect(bodyOf(c)).not.toContain('%252');
  });
});
