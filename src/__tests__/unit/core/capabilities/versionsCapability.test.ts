import type {
  ICapabilityContext,
  IVersionsStrategy,
} from '../../../../core/shared/capabilities/types';
import { VersionsCapability } from '../../../../core/shared/capabilities/VersionsCapability';

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
    const v = await cap.getVersions({ name: 'ZBAR' });
    expect(v).toHaveLength(1);
    expect(v[0].title).toBe('ZBAR');
  });

  it('getVersionSource delegates to the strategy', async () => {
    const cap = new VersionsCapability<Cfg>(getCtx, strategy);
    expect(await cap.getVersionSource('/uri/1')).toBe('source-of:/uri/1');
  });

  it('getVersions rethrows a missing name', () => {
    const cap = new VersionsCapability<Cfg>(getCtx, strategy);
    // getVersions is NOT async (byte-identical to the current handlers, whose
    // getVersions throws synchronously on a missing name), so nameOf's throw
    // propagates synchronously — assert a sync throw, not a rejection.
    expect(() => cap.getVersions({})).toThrow('name is required');
  });
});
