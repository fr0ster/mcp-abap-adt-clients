/**
 * A client contract as a consumer composes it: only from
 * `@mcp-abap-adt/interfaces-adt` (atoms, result-set contracts, config types),
 * naming only the factories and members it calls, each factory generic over
 * the result-set contract it is given.
 *
 * Nothing here comes from this package. The type-level tests that use it
 * prove the substitution the contract package promises: this package's
 * client satisfies it, and so does an object written by hand.
 *
 * Test-only; never published.
 */

import type {
  IAdtActivatable,
  IAdtCheckable,
  IAdtLockable,
  IAdtObjectAccess,
  IAdtReadable,
  IAdtUpdatable,
  IClassConfig,
  IClassResults,
  IMessageClassMessageConfig,
  IMessageClassMessageResults,
  IProgramConfig,
  IProgramResults,
  IUtilResults,
} from '@mcp-abap-adt/interfaces-adt';

/** What the consumer does with a class: read it and change it under a lock. */
export type IConsumerClass<R extends IClassResults> = IAdtReadable<
  IClassConfig,
  ReturnType<R['source']>
> &
  IAdtLockable<IClassConfig> &
  IAdtUpdatable<Partial<IClassConfig>, ReturnType<R['updated']>> &
  IAdtActivatable<IClassConfig, ReturnType<R['activation']>>;

/** What the consumer does with a program: read it and check it. */
export type IConsumerProgram<R extends IProgramResults> = IAdtReadable<
  IProgramConfig,
  ReturnType<R['source']>
> &
  IAdtCheckable<IProgramConfig, ReturnType<R['check']>>;

/** What the consumer does with a message: read it. */
export type IConsumerMessage<R extends IMessageClassMessageResults> =
  IAdtReadable<IMessageClassMessageConfig, ReturnType<R['read']>>;

/** What the consumer does across objects: read any object's source. */
export type IConsumerUtils<R extends IUtilResults> = IAdtObjectAccess<
  ReturnType<R['source']>,
  ReturnType<R['metadata']>,
  ReturnType<R['include']>
>;

/** The client the consumer accepts. */
export interface IConsumerClient {
  getClass<R extends IClassResults>(results: R): IConsumerClass<R>;
  getProgram<R extends IProgramResults>(results: R): IConsumerProgram<R>;
  getMessageClassMessage<R extends IMessageClassMessageResults>(
    results: R,
  ): IConsumerMessage<R>;
  getUtils<R extends IUtilResults>(results: R): IConsumerUtils<R>;
}
