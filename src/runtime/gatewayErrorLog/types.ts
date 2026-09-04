/**
 * The gateway error log's shapes.
 *
 * Declared in the feeds module, which is where the endpoint that answers them
 * lives — `IGatewayErrorLog<TList, TError>` names only that there are two.
 */

export type {
  ICallStackEntry,
  IGatewayErrorDetail,
  IGatewayErrorEntry,
  IGatewayException,
  ISourceCodeLine,
} from '../feeds/types';
