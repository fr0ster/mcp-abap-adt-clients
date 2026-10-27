/**
 * AdtRequestLegacy - Transport request handler for legacy SAP systems
 * (SAP_BASIS 7.40, measured on 7.40 SP04), over RFC.
 *
 * Legacy systems use `/sap/bc/cts/` instead of `/sap/bc/adt/cts/`.
 *
 * Served:
 * - `list`: GET /sap/bc/cts/transportrequests, the user's full list as it came
 *   (measured on 7.40 SP04; the measured user had no requests, so a populated
 *   list was not seen). Not a saved-configuration search, so `configUri` is
 *   refused.
 * - `readMetadata`: the same GET.
 *
 * Refused without a request, answered through `failed()`:
 * - `create` — measured on 7.40 SP04: the POST answered `400` "user action is
 *   not supported".
 * - `updateMetadata`, `delete` — not measured; create and modify are refused.
 * - the other members on `/sap/bc/adt/cts/*`, which 7.40 does not advertise
 *   (`searchConfigurations`, `checkDeletion`, `readObjects`, `readActionLog`,
 *   `addObject`, `removeObject`, `moveObjects`, `sortAndCompress`,
 *   `createTask`, `changeTaskType`).
 *
 * They answer the refusal rather than throwing it — a consumer that supports
 * both kinds of system will call them, and that is a normal case, not an
 * exception.
 */

import {
  AdtRequest,
  answering,
  failed,
  TRANSPORT_REQUEST,
  type transportDocuments,
} from '@mcp-abap-adt/adt-clients';
import type {
  AdtTaskType,
  IAbapObjectEntry,
  IAdtAnalyseOptions,
  IAdtError,
  IAdtHeaders,
  IAdtOperationOptions,
  IAdtResponse,
  IListTransportsOptions,
  IResultStrategy,
  ITransportConfig,
  ITransportResults,
} from '@mcp-abap-adt/interfaces-adt';
import { AdtObjectErrorCodes } from '@mcp-abap-adt/interfaces-adt';
import {
  getTransportLegacy,
  listTransportsLegacy,
  TRANSPORT_REQUEST_LEGACY,
} from './readLegacy';

const unsupported = (what: string, why: string): IAdtError => ({
  origin: 'refusal',
  code: AdtObjectErrorCodes.UNSUPPORTED_OPERATION,
  message:
    `${what} is not supported on a legacy system (7.40 SP04). ${why} ` +
    'Use SE01/SE09/SE10 to manage transports there.',
});

/** Why the modern transport members refuse: their collection is not on 7.40. */
const NOT_ADVERTISED = `${TRANSPORT_REQUEST.collection} is not advertised on 7.40 SP04, so this member has no endpoint there.`;

export class AdtRequestLegacy<
  R extends ITransportResults = typeof transportDocuments,
> extends AdtRequest<R> {
  /**
   * Refused: the legacy CTS endpoint rejects every POST payload with "user
   * action is not supported" — no useraction value is accepted.
   */
  override async create<E extends IAdtError = IAdtError>(): Promise<
    IAdtResponse<ReturnType<R['created']>, E>
  > {
    return failed<ReturnType<R['created']>, E>(
      unsupported(
        'Creating transport requests',
        `The ${TRANSPORT_REQUEST_LEGACY.collection} endpoint rejects every create payload.`,
      ) as E,
    );
  }

  /**
   * Read one request from the legacy list.
   *
   * `/sap/bc/cts/transportrequests` answers the full list for the current user
   * whatever the path names, so `config.transportNumber` cannot reach the
   * request. The list is answered as it came: picking the request out of it is
   * the `metadata` strategy's, and calling its absence a failure is the
   * caller's `analyse`. Until 23.0.0 a list not mentioning the number was
   * thrown as a fabricated 404.
   */
  override async readMetadata<E extends IAdtError = IAdtError>(
    _config: Partial<ITransportConfig>,
    options?: { withLongPolling?: boolean } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['metadata']>, E>> {
    return answering(
      () => getTransportLegacy(this.connection),
      this.results.metadata as IResultStrategy<ReturnType<R['metadata']>>,
      options?.analyse,
    );
  }

  /**
   * List the current user's requests.
   *
   * Not a saved-configuration search, so there is no configUri to pass — and
   * accepting one silently would report a filter that never applied.
   *
   * The reading is the one the implementation was built with, like every other
   * member. The legacy payload has never been captured, so a tree reading such
   * as `parseTransportTree` may well not read it — and if so it says which
   * element it expected and what it found, which is a consumer's cue to inject
   * a reading for their system.
   */
  override async list<E extends IAdtError = IAdtError>(
    // Wider than the contract on purpose: the legacy endpoint is not a saved
    // search, so there is no `configUri` to require — and one that is passed
    // is refused below rather than ignored.
    options?: Partial<IListTransportsOptions> & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['list']>, E>> {
    if (options?.configUri) {
      return failed<ReturnType<R['list']>, E>(
        unsupported(
          'configUri',
          `${TRANSPORT_REQUEST_LEGACY.collection} is not a saved-configuration search and always returns the full list for the current user.`,
        ) as E,
      );
    }

    return answering(
      () => listTransportsLegacy(this.connection),
      this.results.list as IResultStrategy<ReturnType<R['list']>>,
      options?.analyse,
    );
  }

  /** Refused: the legacy endpoint's update shape has never been captured. */
  override async updateMetadata<E extends IAdtError = IAdtError>(): Promise<
    IAdtResponse<ReturnType<R['metadataUpdated']>, E>
  > {
    return failed<ReturnType<R['metadataUpdated']>, E>(
      unsupported(
        'Updating transport requests',
        `The legacy ${TRANSPORT_REQUEST_LEGACY.collection} endpoint has never been captured, so whether or how it supports changing a description is unknown.`,
      ) as E,
    );
  }

  /** Refused: the legacy endpoint's delete shape has never been captured. */
  override async delete<E extends IAdtError = IAdtError>(): Promise<
    IAdtResponse<ReturnType<R['deleted']>, E>
  > {
    return failed<ReturnType<R['deleted']>, E>(
      unsupported(
        'Deleting transport requests',
        `The legacy ${TRANSPORT_REQUEST_LEGACY.collection} endpoint has never been captured, so whether it supports deleting a request is unknown.`,
      ) as E,
    );
  }

  /** Refused without a request: searching transport configurations is on `/sap/bc/adt/cts/*`, which 7.40 does not advertise. */
  override async searchConfigurations<E extends IAdtError = IAdtError>(
    _options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['searchConfigurations']>, E>> {
    return failed<ReturnType<R['searchConfigurations']>, E>(
      unsupported('Searching transport configurations', NOT_ADVERTISED) as E,
    );
  }

  /** Refused without a request: checking the deletion of a transport request is on `/sap/bc/adt/cts/*`, which 7.40 does not advertise. */
  override async checkDeletion<E extends IAdtError = IAdtError>(
    _config: Partial<ITransportConfig>,
    _options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletionCheck']>, E>> {
    return failed<ReturnType<R['deletionCheck']>, E>(
      unsupported(
        'Checking the deletion of a transport request',
        NOT_ADVERTISED,
      ) as E,
    );
  }

  /** Refused without a request: reading the objects of a transport request is on `/sap/bc/adt/cts/*`, which 7.40 does not advertise. */
  override async readObjects<E extends IAdtError = IAdtError>(
    _transportNumber: string,
    _options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['objects']>, E>> {
    return failed<ReturnType<R['objects']>, E>(
      unsupported(
        'Reading the objects of a transport request',
        NOT_ADVERTISED,
      ) as E,
    );
  }

  /** Refused without a request: reading the action log of a transport request is on `/sap/bc/adt/cts/*`, which 7.40 does not advertise. */
  override async readActionLog<E extends IAdtError = IAdtError>(
    _transportNumber: string,
    _options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['actionLog']>, E>> {
    return failed<ReturnType<R['actionLog']>, E>(
      unsupported(
        'Reading the action log of a transport request',
        NOT_ADVERTISED,
      ) as E,
    );
  }

  /** Refused without a request: adding an object to a transport request is on `/sap/bc/adt/cts/*`, which 7.40 does not advertise. */
  override async addObject<E extends IAdtError = IAdtError>(
    _transportNumber: string,
    _object: IAbapObjectEntry,
    _options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['addedObject']>, E>> {
    return failed<ReturnType<R['addedObject']>, E>(
      unsupported(
        'Adding an object to a transport request',
        NOT_ADVERTISED,
      ) as E,
    );
  }

  /** Refused without a request: removing an object from a transport request is on `/sap/bc/adt/cts/*`, which 7.40 does not advertise. */
  override async removeObject<E extends IAdtError = IAdtError>(
    _transportNumber: string,
    _object: IAbapObjectEntry & { position: string },
    _options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['removedObject']>, E>> {
    return failed<ReturnType<R['removedObject']>, E>(
      unsupported(
        'Removing an object from a transport request',
        NOT_ADVERTISED,
      ) as E,
    );
  }

  /** Refused without a request: moving objects between transport requests is on `/sap/bc/adt/cts/*`, which 7.40 does not advertise. */
  override async moveObjects<E extends IAdtError = IAdtError>(
    _sourceTask: string,
    _targetNumber: string,
    _objects: readonly (IAbapObjectEntry & { position: string })[],
    _options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['movedObjects']>, E>> {
    return failed<ReturnType<R['movedObjects']>, E>(
      unsupported(
        'Moving objects between transport requests',
        NOT_ADVERTISED,
      ) as E,
    );
  }

  /** Refused without a request: sorting and compressing a transport task is on `/sap/bc/adt/cts/*`, which 7.40 does not advertise. */
  override async sortAndCompress<E extends IAdtError = IAdtError>(
    _taskNumber: string,
    _options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['sortedAndCompressed']>, E>> {
    return failed<ReturnType<R['sortedAndCompressed']>, E>(
      unsupported(
        'Sorting and compressing a transport task',
        NOT_ADVERTISED,
      ) as E,
    );
  }

  /** Refused without a request: creating a task under a transport request is on `/sap/bc/adt/cts/*`, which 7.40 does not advertise. */
  override async createTask<E extends IAdtError = IAdtError>(
    _transportNumber: string,
    _options: { headers: IAdtHeaders } & {
      targetUser: string;
    } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['createdTask']>, E>> {
    return failed<ReturnType<R['createdTask']>, E>(
      unsupported(
        'Creating a task under a transport request',
        NOT_ADVERTISED,
      ) as E,
    );
  }

  /** Refused without a request: changing the type of a transport task is on `/sap/bc/adt/cts/*`, which 7.40 does not advertise. */
  override async changeTaskType<E extends IAdtError = IAdtError>(
    _taskNumber: string,
    _type: AdtTaskType,
    _options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['taskTypeChanged']>, E>> {
    return failed<ReturnType<R['taskTypeChanged']>, E>(
      unsupported('Changing the type of a transport task', NOT_ADVERTISED) as E,
    );
  }
}
