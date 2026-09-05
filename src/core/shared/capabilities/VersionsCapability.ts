import type { IAdtResponse, IAdtVersionable } from '@mcp-abap-adt/interfaces';
import { answering } from '../../../utils/adtResponse';
import { rawDocument } from '../../../utils/resultStrategy';
import type { ObjectVersion } from '../results';
import type { ICapabilityContext, IVersionsStrategy } from './types';

/**
 * Shared version history for source-backed objects. Types without a
 * /source/main resource do NOT compose this capability and do not implement
 * IAdtVersionable — absence is expressed structurally, not by throwing.
 */
export class VersionsCapability<TConfig>
  implements IAdtVersionable<TConfig, ObjectVersion[], string>
{
  constructor(
    // LAZY: see LockCapability — read at call time so it can be a class field.
    private readonly getCtx: () => ICapabilityContext,
    private readonly strategy: IVersionsStrategy<TConfig>,
  ) {}

  async getVersions(
    config: Partial<TConfig>,
  ): Promise<IAdtResponse<ObjectVersion[]>> {
    const name = this.strategy.nameOf(config);
    // The strategy already reads the feed into entries, so the answer is built
    // around what it produced rather than re-read from a wire it did not keep.
    return answering(
      async () => ({
        data: await this.strategy.list(this.getCtx(), name),
        status: 200,
        statusText: 'OK',
        headers: {},
      }),
      (answer) => answer.data as ObjectVersion[],
    );
  }

  async getVersionSource(contentUri: string): Promise<IAdtResponse<string>> {
    return answering(
      async () => ({
        data: await this.strategy.source(this.getCtx(), contentUri),
        status: 200,
        statusText: 'OK',
        headers: {},
      }),
      rawDocument,
    );
  }
}
