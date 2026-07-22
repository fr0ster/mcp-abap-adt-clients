import type { IAdtVersionable, IObjectVersion } from '@mcp-abap-adt/interfaces';
import type { ICapabilityContext, IVersionsStrategy } from './types';

/**
 * Shared version history for source-backed objects. Types without a
 * /source/main resource do NOT compose this capability and do not implement
 * IAdtVersionable — absence is expressed structurally, not by throwing.
 */
export class VersionsCapability<TConfig> implements IAdtVersionable<TConfig> {
  constructor(
    // LAZY: see LockCapability — read at call time so it can be a class field.
    private readonly getCtx: () => ICapabilityContext,
    private readonly strategy: IVersionsStrategy<TConfig>,
  ) {}

  getVersions(config: Partial<TConfig>): Promise<IObjectVersion[]> {
    const name = this.strategy.nameOf(config);
    return this.strategy.list(this.getCtx(), name);
  }

  getVersionSource(contentUri: string): Promise<string> {
    return this.strategy.source(this.getCtx(), contentUri);
  }
}
