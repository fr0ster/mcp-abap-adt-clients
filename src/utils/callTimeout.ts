import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';

/**
 * A connection that puts the caller's deadline on every request made through it.
 *
 * **Why a wrapper and not a parameter.** This library sets no client-side
 * deadline of its own — every request carries `timeout: 0`, which the wires
 * read as "do not abort" — and the way to ask for one is
 * `IAdtOperationOptions.timeout`. The low-level functions take positional
 * arguments and end in `connection.makeAdtRequest({ …, timeout: 0 })` at
 * hundreds of places, none of which can see the caller's option. Threading a
 * parameter through all of them would change every signature to carry a value
 * almost every call leaves undefined.
 *
 * A member wraps its connection once instead, and everything below inherits the
 * deadline — including a low-level function that issues more than one request,
 * and including requests this library has not written yet.
 *
 * **`undefined` returns the connection itself**, so a caller who asks for
 * nothing gets exactly the object and exactly the behaviour they had before.
 * The wrapper only ever exists when someone asked for a deadline.
 *
 * The caller's value wins over the one the request already carries: an
 * explicit `options.timeout` is the caller saying how long they are willing to
 * wait.
 */
export function withCallTimeout(
  connection: IAbapConnection,
  timeout?: number,
): IAbapConnection {
  if (timeout === undefined) return connection;

  return new Proxy(connection, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof value !== 'function') return value;
      if (property !== 'makeAdtRequest') return value.bind(target);

      return (request: Parameters<IAbapConnection['makeAdtRequest']>[0]) =>
        (value as IAbapConnection['makeAdtRequest']).call(target, {
          ...request,
          timeout,
        });
    },
  });
}
