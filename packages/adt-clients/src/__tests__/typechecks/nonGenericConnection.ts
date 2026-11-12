/**
 * A connection whose `makeAdtRequest` takes no type parameters — the shape
 * `@mcp-abap-adt/interfaces-adt-connection` 5 declares — is taken where the
 * library takes a connection: `AdtClient`'s constructor and `createAdtClient`.
 *
 * Under interfaces-adt-connection 4 it was refused: its generic
 * `makeAdtRequest<T, D>` let the caller choose `T`, and a connection answering
 * `IAdtWireResponse` (`data: unknown`) is not assignable to a caller's `T`.
 *
 * Type-level only, compiled by `npm run test:check`; nothing here runs.
 */

import type {
  IAbapConnection,
  IAbapRequestOptions,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtClient } from '../../clients/AdtClient';
import { createAdtClient } from '../../clients/createAdtClient';

/** A connection written to the v5 contract, with no type parameter anywhere. */
interface INonGenericConnection {
  connect(): Promise<void>;
  getBaseUrl(): Promise<string | undefined>;
  getSessionId(): string | null;
  setSessionType(type: 'stateful' | 'stateless'): void;
  makeAdtRequest(options: IAbapRequestOptions): Promise<IAdtWireResponse>;
}

export const nonGenericConnectionIsTaken = (
  connection: INonGenericConnection,
): void => {
  const contract: IAbapConnection = connection;
  new AdtClient(connection);
  void createAdtClient(connection, { variant: 'onprem' });
  void createAdtClient(connection, { variant: 'cloud' });
  void contract;
};
