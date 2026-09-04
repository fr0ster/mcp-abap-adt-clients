/**
 * AdtRequestLegacy - Transport request handler for legacy SAP systems
 * (BASIS < 7.50).
 *
 * Legacy systems use `/sap/bc/cts/` instead of `/sap/bc/adt/cts/`.
 *
 * Supported:
 * - `read`: GET /sap/bc/cts/transportrequests (the full list, filtered here)
 * - `list`: the same resource; not a saved-configuration search, so no configUri
 *
 * Refused, each with the same reason: the legacy endpoint's shape for that
 * operation has never been captured, and inventing a payload for an uncaptured
 * endpoint is exactly the guessing this design exists to stop. They answer the
 * refusal rather than throwing it — a consumer that supports both kinds of
 * system will call them, and that is a normal case, not an exception.
 */

import type {
  IAbapConnection,
  IAdtError,
  IAdtResponse,
  IAdtSystemContext,
  IListTransportsOptions,
  ILogger,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces';
import { AdtObjectErrorCodes } from '@mcp-abap-adt/interfaces';
import { answering, failed } from '../../utils/adtResponse';
import { AdtRequest } from './AdtRequest';
import { getTransportLegacy, listTransportsLegacy } from './readLegacy';
import type { ITransportConfig, ITransportResults } from './types';

const unsupported = (what: string, why: string): IAdtError => ({
  origin: 'refusal',
  code: AdtObjectErrorCodes.UNSUPPORTED_OPERATION,
  message:
    `${what} is not supported on legacy SAP systems (BASIS < 7.50). ${why} ` +
    'Use SE01/SE09/SE10 to manage transports there.',
});

export class AdtRequestLegacy<
  R extends ITransportResults<
    unknown,
    unknown,
    unknown,
    unknown,
    unknown
  > = ITransportResults,
> extends AdtRequest<R> {
  private readonly conn: IAbapConnection;

  constructor(
    connection: IAbapConnection,
    logger?: ILogger,
    systemContext?: IAdtSystemContext,
    results?: R,
  ) {
    super(connection, logger, systemContext, results);
    this.conn = connection;
  }

  /**
   * Refused: the legacy CTS endpoint rejects every POST payload with "user
   * action is not supported" — no useraction value is accepted.
   */
  override async create(): Promise<IAdtResponse<ReturnType<R['created']>>> {
    return failed(
      unsupported(
        'Creating transport requests',
        'The /sap/bc/cts/transportrequests endpoint rejects every create payload.',
      ),
    );
  }

  /**
   * Read one request from the legacy list.
   *
   * `/sap/bc/cts/transportrequests` answers the full list for the current user;
   * the one asked for is picked out of it here.
   */
  override async read(
    config: Partial<ITransportConfig>,
    _version?: 'active' | 'inactive',
    options?: { withLongPolling?: boolean },
  ): Promise<IAdtResponse<ReturnType<R['read']>>> {
    if (!config.transportNumber) {
      throw new Error('Transport request number is required');
    }
    const number = config.transportNumber;

    return answering(
      () => getTransportLegacy(this.conn, number),
      this.results.read as IResultStrategy<ReturnType<R['read']>>,
    );
  }

  /**
   * List the current user's requests.
   *
   * Not a saved-configuration search, so there is no configUri to pass — and
   * accepting one silently would report a filter that never applied.
   *
   * The default reading is **not** used here: the legacy payload has never been
   * captured, so `parseTransportTree` cannot honestly claim to read it. The
   * document comes back as it arrived, and a consumer who has a legacy payload
   * to work from injects a reading for it.
   */
  override async list(
    options?: IListTransportsOptions,
  ): Promise<IAdtResponse<ReturnType<R['list']>>> {
    if (options?.configUri) {
      return failed(
        unsupported(
          'configUri',
          '/sap/bc/cts/transportrequests is not a saved-configuration search and always returns the full list for the current user.',
        ),
      );
    }

    return answering(
      () => listTransportsLegacy(this.conn),
      (answer) => String(answer.data ?? '') as ReturnType<R['list']>,
    );
  }

  /** Refused: the legacy endpoint's update shape has never been captured. */
  override async update(): Promise<IAdtResponse<ReturnType<R['updated']>>> {
    return failed(
      unsupported(
        'Updating transport requests',
        'The legacy /sap/bc/cts/transportrequests endpoint has never been captured, so whether or how it supports changing a description is unknown.',
      ),
    );
  }

  /** Refused: the legacy endpoint's delete shape has never been captured. */
  override async delete(): Promise<IAdtResponse<ReturnType<R['deleted']>>> {
    return failed(
      unsupported(
        'Deleting transport requests',
        'The legacy /sap/bc/cts/transportrequests endpoint has never been captured, so whether it supports deleting a request is unknown.',
      ),
    );
  }
}
