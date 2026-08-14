/**
 * AdtRequestLegacy - Transport request handler for legacy SAP systems (BASIS < 7.50)
 *
 * Legacy systems use /sap/bc/cts/ instead of /sap/bc/adt/cts/ for transport endpoints.
 *
 * Supported operations:
 * - read: GET /sap/bc/cts/transportrequests (returns full list, filtered client-side)
 * - list: GET /sap/bc/cts/transportrequests (no saved-configuration search; configUri rejected)
 *
 * Unsupported operations:
 * - create: Legacy CTS REST API does not support creating transport requests.
 *   The endpoint rejects all POST payloads — no useraction value is accepted.
 *   Use SE01/SE09/SE10 transaction to create transports on legacy systems.
 * - update, delete: Whether the legacy endpoint supports changing a description
 *   or deleting a request has never been captured. Both are refused rather than
 *   guessed against the modern `/sap/bc/adt/cts/transportrequests/<NR>` shape.
 */

import type {
  HttpError,
  IAbapConnection,
  IAdtOperationOptions,
  IAdtSystemContext,
  IListTransportsOptions,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import { AdtRequest } from './AdtRequest';
import { getTransportLegacy, listTransportsLegacy } from './readLegacy';
import type { ITransportConfig, ITransportState } from './types';

export class AdtRequestLegacy extends AdtRequest {
  private readonly conn: IAbapConnection;

  constructor(
    connection: IAbapConnection,
    logger?: ILogger,
    systemContext?: IAdtSystemContext,
  ) {
    super(connection, logger, systemContext);
    this.conn = connection;
  }

  /**
   * Create transport request — NOT supported on legacy systems.
   *
   * Legacy CTS endpoint (/sap/bc/cts/transportrequests) does not support
   * creating transport requests via REST API. The endpoint rejects all
   * POST payloads with "user action is not supported".
   */
  override async create(
    _config: ITransportConfig,
    _options?: IAdtOperationOptions,
  ): Promise<ITransportState> {
    throw new Error(
      'Creating transport requests is not supported on legacy SAP systems (BASIS < 7.50). ' +
        'The /sap/bc/cts/transportrequests endpoint does not support create operations. ' +
        'Use SE01/SE09/SE10 transaction to create transports.',
    );
  }

  /**
   * Read transport request (legacy path).
   *
   * GET /sap/bc/cts/transportrequests returns the full transport list
   * for the current user. The response is filtered client-side.
   */
  override async read(
    config: Partial<ITransportConfig>,
    _version?: 'active' | 'inactive',
  ): Promise<ITransportState | undefined> {
    if (!config.transportNumber) {
      throw new Error('Transport request number is required');
    }

    try {
      const response = await getTransportLegacy(
        this.conn,
        config.transportNumber,
      );

      return {
        transportNumber: config.transportNumber,
        readResult: response,
        errors: [],
      };
    } catch (error: unknown) {
      const e = error as HttpError;
      if (e.response?.status === 404) {
        return undefined;
      }
      throw error;
    }
  }

  /**
   * List transport requests (legacy path).
   *
   * `/sap/bc/cts/transportrequests` returns the full list for the current user.
   * It is not a saved-configuration search, so there is no configUri to pass —
   * and accepting one silently would report a filter that never applied.
   */
  override async list(
    options?: IListTransportsOptions,
  ): Promise<ITransportState> {
    if (options?.configUri) {
      throw new Error(
        'configUri is not supported on legacy SAP systems: ' +
          '/sap/bc/cts/transportrequests is not a saved-configuration search and ' +
          'always returns the full list for the current user.',
      );
    }

    const response = await listTransportsLegacy(this.conn);
    return { listResult: response, errors: [] };
  }

  /**
   * Not supported on legacy systems.
   *
   * `/sap/bc/cts/transportrequests` has never been captured, and assuming the
   * modern parser fits it would be exactly the guess this design exists to
   * stop. Supported once someone captures a legacy payload.
   */
  override async listNodes(): Promise<never> {
    throw new Error(
      'listNodes() is not supported on legacy SAP systems: the payload of ' +
        '/sap/bc/cts/transportrequests has never been captured, so no parser can ' +
        'honestly claim to read it. Use list() and parse the response yourself.',
    );
  }

  /**
   * Update transport request description — NOT supported on legacy systems.
   *
   * `AdtRequest.update()` targets the modern `/sap/bc/adt/cts/transportrequests/<NR>`
   * endpoint, which legacy systems (BASIS < 7.50) do not have. Whether the legacy
   * `/sap/bc/cts/transportrequests` resource supports changing a description at all
   * — and if so, in what shape — has never been captured. Inventing a payload for
   * an uncaptured endpoint is exactly the guessing this design exists to stop.
   */
  override async update(
    _config: Partial<ITransportConfig>,
    _options?: IAdtOperationOptions,
  ): Promise<ITransportState> {
    throw new Error(
      'Updating transport requests is not supported on legacy SAP systems (BASIS < 7.50). ' +
        'The legacy /sap/bc/cts/transportrequests endpoint has never been captured, so ' +
        'whether or how it supports changing a description is unknown. ' +
        'Use SE01/SE09/SE10 transaction to update transports.',
    );
  }

  /**
   * Delete transport request — NOT supported on legacy systems.
   *
   * `AdtRequest.delete()` targets the modern `/sap/bc/adt/cts/transportrequests/<NR>`
   * endpoint, which legacy systems (BASIS < 7.50) do not have. Whether the legacy
   * `/sap/bc/cts/transportrequests` resource supports deleting a request at all has
   * never been captured. Inventing a payload for an uncaptured endpoint is exactly
   * the guessing this design exists to stop.
   */
  override async delete(
    _config: Partial<ITransportConfig>,
  ): Promise<ITransportState> {
    throw new Error(
      'Deleting transport requests is not supported on legacy SAP systems (BASIS < 7.50). ' +
        'The legacy /sap/bc/cts/transportrequests endpoint has never been captured, so ' +
        'whether it supports deleting a request is unknown. ' +
        'Use SE01/SE09/SE10 transaction to delete transports.',
    );
  }
}
