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
 * What a handler, runner or executor is constructed with after its connection
 * (and after a logger it requires, which stays positional): its result set,
 * required, and the parts of the context named by `K`, optional.
 *
 * `results` is required because a constructor cannot choose its generic per
 * overload: a caller naming its own `R` hands its results, and the shipped
 * documents are the default of the getter, typed by its overloads.
 */
export type AdtHandlerOptions<R, K extends keyof IAdtHandlerContext = never> = {
  results: R;
} & Pick<IAdtHandlerContext, K>;
