import type {
  IAdtContentTypes,
  IAdtSystemContext,
} from '@mcp-abap-adt/interfaces-adt';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import type { LockRegistry } from './LockRegistry';

/**
 * The context a client hands a handler it builds, each part by name and each
 * optional. A handler takes only the parts it reads; `AdtHandlerOptions`
 * picks them.
 */
export interface IAdtHandlerContext {
  logger?: ILogger | undefined;
  systemContext?: IAdtSystemContext | undefined;
  contentTypes?: IAdtContentTypes | undefined;
  lockRegistry?: LockRegistry | undefined;
}

/**
 * What a handler, runner or executor is constructed with after its connection:
 * its result set, required, and the parts of the context named by `K`,
 * optional. A class that requires a logger takes `AdtLoggedOptions` instead.
 *
 * `results` is required because a constructor cannot choose its generic per
 * overload: a caller naming its own `R` hands its results, and the shipped
 * documents are the default of the getter (or the static `create`), typed by
 * its overloads.
 */
export type AdtHandlerOptions<R, K extends keyof IAdtHandlerContext = never> = {
  results: R;
} & Pick<IAdtHandlerContext, K>;

/**
 * What a static `create` takes when it answers the shipped documents: the
 * parts of the context named by `K`, and no `results` (`create<R>` takes
 * those, with `AdtHandlerOptions`).
 */
export type AdtShippedOptions<K extends keyof IAdtHandlerContext = never> = {
  results?: undefined;
} & Pick<IAdtHandlerContext, K>;

/**
 * What a class that requires a logger is constructed with after its
 * connection: its result set and its logger, both required. The type is the
 * only check: a call without the logger does not compile.
 */
export type AdtLoggedOptions<R> = {
  results: R;
  logger: ILogger;
};
