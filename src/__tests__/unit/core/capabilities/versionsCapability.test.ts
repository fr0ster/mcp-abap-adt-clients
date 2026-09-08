import type {
  ICapabilityContext,
  IVersionsStrategy,
} from '../../../../core/shared/capabilities/types';
import { VersionsCapability } from '../../../../core/shared/capabilities/VersionsCapability';
import { expectResult } from '../../../helpers/contract';

type Cfg = { name?: string };
const ctx: ICapabilityContext = { connection: {} as any, logger: undefined };
const getCtx = () => ctx;

const strategy: IVersionsStrategy<Cfg> = {
  nameOf: (c) => {
    if (!c.name) throw new Error('name is required');
    return c.name;
  },
  list: async (_ctx, name) => [{ versionId: '000001', title: name } as any],
  source: async (_ctx, uri) => `source-of:${uri}`,
};

describe('VersionsCapability', () => {
  it('getVersions delegates to the strategy', async () => {
    const cap = new VersionsCapability<Cfg>(getCtx, strategy);
    const v = expectResult(await cap.getVersions({ name: 'ZBAR' }), 'versions');
    expect(v).toHaveLength(1);
    expect(v[0].title).toBe('ZBAR');
  });

  it('getVersionSource delegates to the strategy', async () => {
    const cap = new VersionsCapability<Cfg>(getCtx, strategy);
    expect(
      expectResult(await cap.getVersionSource('/uri/1'), 'version source'),
    ).toBe('source-of:/uri/1');
  });

  it('getVersions rethrows a missing name', async () => {
    const cap = new VersionsCapability<Cfg>(getCtx, strategy);
    // A caller error, not a verdict about the server: the name is missing
    // before anything is asked, so it throws rather than coming back as the
    // failure half of an answer about a request that never happened.
    await expect(cap.getVersions({})).rejects.toThrow('name is required');
  });
});
