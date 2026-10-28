/**
 * What phase 2 of the full run may send: one predicate, built once from
 * `--only`, `--except` and the endpoints phase 1 recorded as unauthorized,
 * consulted before every request phase 2 makes — setup included. It answers,
 * per `handler.member` (the key the rest of the tool matches on), the reason
 * the member is not sent, or `undefined` when it may be.
 *
 * Cleanup of an object phase 2 itself made is the one exception: it runs on
 * the cleanup client, which this predicate never guards.
 */

import { passesFilter } from './corpus';

/** The reason `handler.member` is not sent, or `undefined`. */
export type Phase2Skip = (member: string) => string | undefined;

export interface IPhase2Filter {
  only?: readonly string[] | undefined;
  except?: readonly string[] | undefined;
  /** Phase 1's unauthorized members: `handler.member` → its endpoint (method + path). */
  unauthorized?: ReadonlyMap<string, string> | undefined;
}

export function phase2Skip(filter: IPhase2Filter): Phase2Skip {
  const only = filter.only?.length ? filter.only : undefined;
  const except = filter.except ?? [];
  const unauthorized = filter.unauthorized ?? new Map<string, string>();
  return (member) => {
    const refused = unauthorized.get(member);
    if (refused !== undefined)
      return `not authorized for this user: ${refused}`;
    const text = except.find((part) => member.includes(part));
    if (text !== undefined) return `excluded by --except: ${text}`;
    if (!passesFilter({ only }, member)) return 'not selected by --only';
    return undefined;
  };
}

/** What a guarded member throws instead of sending: its reason is the failure text. */
export class Phase2Skipped extends Error {
  constructor(readonly reason: string) {
    super(`skipped: ${reason}`);
  }
}

/**
 * The client with every handler's every member checked against `skip` before
 * it runs: a refused member rejects with {@link Phase2Skipped} and sends
 * nothing. A handler is what a `get…()` method of the client returns.
 */
export function guardedClient<T extends object>(
  client: T,
  skip: Phase2Skip,
): T {
  const guardHandler = (handler: object, label: string): object =>
    new Proxy(handler, {
      get(target, property) {
        const value: unknown = Reflect.get(target, property, target);
        if (typeof value !== 'function' || typeof property !== 'string')
          return value;
        return (...args: unknown[]): unknown => {
          const reason = skip(`${label}.${property}`);
          if (reason !== undefined)
            return Promise.reject(new Phase2Skipped(reason));
          return value.apply(target, args);
        };
      },
    });
  return new Proxy(client, {
    get(target, property) {
      const value: unknown = Reflect.get(target, property, target);
      if (
        typeof value !== 'function' ||
        typeof property !== 'string' ||
        !/^get[A-Z]/.test(property)
      )
        return value;
      return (...args: unknown[]): unknown => {
        const handler: unknown = value.apply(target, args);
        return typeof handler === 'object' && handler !== null
          ? guardHandler(handler, `${property}()`)
          : handler;
      };
    },
  });
}
