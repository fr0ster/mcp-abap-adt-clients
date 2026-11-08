/**
 * The connection contract is installed once per package (the root `.npmrc`
 * sets `install-strategy=nested`), so this package and adt-clients each
 * resolve `@mcp-abap-adt/interfaces-adt-connection` from their own
 * `node_modules`. Every legacy class hands adt-clients' superclass the
 * connection it was given, so the two copies must be one contract: same
 * version, interfaces only. Compile-only: `test:check` (and ts-jest) refuse
 * this file when an `IAbapConnection` of one copy is not accepted where the
 * other's is expected — as they did while the copies were 3.0.0 and 4.0.0.
 */
import type { AdtClient } from '@mcp-abap-adt/adt-clients';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';

/** The connection adt-clients' constructor takes: its own copy's type. */
type ClientsConnection = ConstructorParameters<typeof AdtClient>[0];

const toClients = (connection: IAbapConnection): ClientsConnection =>
  connection;
const toLegacy = (connection: ClientsConnection): IAbapConnection => connection;

describe('one connection contract', () => {
  it('a connection of either copy is accepted where the other is expected (compile-only)', () => {
    expect([toClients, toLegacy]).toHaveLength(2);
  });
});
