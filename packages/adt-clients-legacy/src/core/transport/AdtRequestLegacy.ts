/**
 * AdtRequestLegacy - Transport request handler for legacy SAP systems
 * (SAP_BASIS 7.40, measured on 7.40 SP04), over RFC.
 *
 * Legacy systems use `/sap/bc/cts/` instead of `/sap/bc/adt/cts/`.
 *
 * Served:
 * - `list`: GET /sap/bc/cts/transportrequests, the user's full list as it came
 *   (measured on 7.40 SP04; the measured user had no requests, so a populated
 *   list was not seen). Not a saved-configuration search and reads no query,
 *   so `configUri` and the root's query by user are refused.
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
  type AdtPerformedBy,
  AdtRequest,
  answering,
  failed,
  type IListTransportsBySearch,
  type ListTransportsParams,
  type ResultValuesOf,
  TRANSPORT_REQUEST,
  type TransportValues,
  type transportDocuments,
} from '@mcp-abap-adt/adt-clients';
import type {
  AdtObjectIdentity,
  AdtRequiredUpdateOptions,
  AdtTaskType,
  IAbapObjectEntry,
  IAdtAnalyseOptions,
  IAdtCreateOptions,
  IAdtError,
  IAdtHeaders,
  IAdtLockFreeWrite,
  IAdtOperationOptions,
  IAdtResponse,
  IAdtUpdateOptions,
  IAnalyse,
  ITransportConfig,
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
  T extends TransportValues = ResultValuesOf<typeof transportDocuments>,
> extends AdtRequest<T, 'basis740'> {
  /**
   * Refused: the legacy CTS endpoint rejects every POST payload with "user
   * action is not supported" — no useraction value is accepted.
   */
  override create<E extends IAdtError>(
    this: this & AdtPerformedBy<'request', 'create'>,
    config: Omit<ITransportConfig, 'source'> & { source?: never },
    options: { headers: IAdtHeaders } & IAdtCreateOptions<E> & {
        analyse: IAnalyse<E>;
      },
  ): Promise<IAdtResponse<T['created'], E | IAdtError>>;
  override create(
    this: this & AdtPerformedBy<'request', 'create'>,
    config: Omit<ITransportConfig, 'source'> & { source?: never },
    options: { headers: IAdtHeaders } & IAdtCreateOptions<IAdtError>,
  ): Promise<IAdtResponse<T['created'], IAdtError>>;
  override async create<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'request', 'create'>,
    _config: Omit<ITransportConfig, 'source'> & { source?: never },
    _options: { headers: IAdtHeaders } & IAdtCreateOptions<E>,
  ): Promise<IAdtResponse<T['created'], E | IAdtError>> {
    return failed<T['created']>(
      unsupported(
        'Creating transport requests',
        `The ${TRANSPORT_REQUEST_LEGACY.collection} endpoint rejects every create payload.`,
      ),
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
  override readMetadata<E extends IAdtError>(
    _config: AdtObjectIdentity<ITransportConfig, 'transportNumber'>,
    options: ({ withLongPolling?: boolean } & IAdtOperationOptions<E>) & {
      analyse: IAnalyse<E>;
    },
  ): Promise<IAdtResponse<T['metadata'], E | IAdtError>>;
  override readMetadata(
    _config: AdtObjectIdentity<ITransportConfig, 'transportNumber'>,
    options?: { withLongPolling?: boolean } & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['metadata'], IAdtError>>;
  override async readMetadata<E extends IAdtError = IAdtError>(
    _config: AdtObjectIdentity<ITransportConfig, 'transportNumber'>,
    options?: { withLongPolling?: boolean } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['metadata'], E | IAdtError>> {
    return answering(
      () => getTransportLegacy(this.connection),
      this.results.metadata,
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
  override list<E extends IAdtError>(
    options: ((Partial<IListTransportsBySearch> | ListTransportsParams) &
      IAdtAnalyseOptions<E>) & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['list'], E | IAdtError>>;
  override list(
    options?: (Partial<IListTransportsBySearch> | ListTransportsParams) &
      IAdtAnalyseOptions<IAdtError>,
  ): Promise<IAdtResponse<T['list'], IAdtError>>;
  override async list<E extends IAdtError = IAdtError>(
    // Wider than the contract on purpose: the legacy endpoint is not a saved
    // search, so there is no `configUri` to require — and one that is passed
    // is refused below rather than ignored. The root's query by user is
    // accepted for the same reason it is refused: the override takes every
    // argument the root takes.
    // `configUri` optional here, every query field still excluded beside it.
    options?: (Partial<IListTransportsBySearch> | ListTransportsParams) &
      IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['list'], E | IAdtError>> {
    const refused = options?.configUri
      ? 'configUri'
      : options?.user !== undefined
        ? 'user'
        : undefined;
    if (refused !== undefined) {
      return failed<T['list']>(
        unsupported(
          refused,
          `${TRANSPORT_REQUEST_LEGACY.collection} is not a saved-configuration search, reads no query, and always returns the full list for the current user.`,
        ),
      );
    }

    return answering(
      () => listTransportsLegacy(this.connection),
      this.results.list,
      options?.analyse,
    );
  }

  /** Refused: the legacy endpoint's update shape has never been captured. */
  override updateMetadata<E extends IAdtError>(
    this: this & AdtPerformedBy<'request', 'updateMetadata'>,
    config: AdtObjectIdentity<ITransportConfig, 'transportNumber'>,
    options: { headers: IAdtHeaders } & IAdtUpdateOptions<E> &
      IAdtLockFreeWrite &
      AdtRequiredUpdateOptions<'source'> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['metadataUpdated'], E | IAdtError>>;
  override updateMetadata(
    this: this & AdtPerformedBy<'request', 'updateMetadata'>,
    config: AdtObjectIdentity<ITransportConfig, 'transportNumber'>,
    options: { headers: IAdtHeaders } & IAdtUpdateOptions<IAdtError> &
      IAdtLockFreeWrite &
      AdtRequiredUpdateOptions<'source'>,
  ): Promise<IAdtResponse<T['metadataUpdated'], IAdtError>>;
  override async updateMetadata<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'request', 'updateMetadata'>,
    _config: AdtObjectIdentity<ITransportConfig, 'transportNumber'>,
    _options: { headers: IAdtHeaders } & IAdtUpdateOptions<E> &
      IAdtLockFreeWrite &
      AdtRequiredUpdateOptions<'source'>,
  ): Promise<IAdtResponse<T['metadataUpdated'], E | IAdtError>> {
    return failed<T['metadataUpdated']>(
      unsupported(
        'Updating transport requests',
        `The legacy ${TRANSPORT_REQUEST_LEGACY.collection} endpoint has never been captured, so whether or how it supports changing a description is unknown.`,
      ),
    );
  }

  /** Refused: the legacy endpoint's delete shape has never been captured. */
  override delete<E extends IAdtError>(
    this: this & AdtPerformedBy<'request', 'delete'>,
    config: AdtObjectIdentity<ITransportConfig, 'transportNumber'>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E> & {
        analyse: IAnalyse<E>;
      },
  ): Promise<IAdtResponse<T['deleted'], E | IAdtError>>;
  override delete(
    this: this & AdtPerformedBy<'request', 'delete'>,
    config: AdtObjectIdentity<ITransportConfig, 'transportNumber'>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['deleted'], IAdtError>>;
  override async delete<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'request', 'delete'>,
    _config: AdtObjectIdentity<ITransportConfig, 'transportNumber'>,
    _options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['deleted'], E | IAdtError>> {
    return failed<T['deleted']>(
      unsupported(
        'Deleting transport requests',
        `The legacy ${TRANSPORT_REQUEST_LEGACY.collection} endpoint has never been captured, so whether it supports deleting a request is unknown.`,
      ),
    );
  }

  /** Refused without a request: searching transport configurations is on `/sap/bc/adt/cts/*`, which 7.40 does not advertise. */
  override searchConfigurations<E extends IAdtError>(
    this: this & AdtPerformedBy<'request', 'searchConfigurations'>,
    _options: IAdtOperationOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['searchConfigurations'], E | IAdtError>>;
  override searchConfigurations(
    this: this & AdtPerformedBy<'request', 'searchConfigurations'>,
    _options?: IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['searchConfigurations'], IAdtError>>;
  override async searchConfigurations<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'request', 'searchConfigurations'>,
    _options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['searchConfigurations'], E | IAdtError>> {
    return failed<T['searchConfigurations']>(
      unsupported('Searching transport configurations', NOT_ADVERTISED),
    );
  }

  /** Refused without a request: checking the deletion of a transport request is on `/sap/bc/adt/cts/*`, which 7.40 does not advertise. */
  override checkDeletion<E extends IAdtError>(
    this: this & AdtPerformedBy<'request', 'deletionCheck'>,
    _config: AdtObjectIdentity<ITransportConfig, 'transportNumber'>,
    _options: { headers: IAdtHeaders } & IAdtOperationOptions<E> & {
        analyse: IAnalyse<E>;
      },
  ): Promise<IAdtResponse<T['deletionCheck'], E | IAdtError>>;
  override checkDeletion(
    this: this & AdtPerformedBy<'request', 'deletionCheck'>,
    _config: AdtObjectIdentity<ITransportConfig, 'transportNumber'>,
    _options: { headers: IAdtHeaders } & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['deletionCheck'], IAdtError>>;
  override async checkDeletion<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'request', 'deletionCheck'>,
    _config: AdtObjectIdentity<ITransportConfig, 'transportNumber'>,
    _options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['deletionCheck'], E | IAdtError>> {
    return failed<T['deletionCheck']>(
      unsupported(
        'Checking the deletion of a transport request',
        NOT_ADVERTISED,
      ),
    );
  }

  /** Refused without a request: reading the objects of a transport request is on `/sap/bc/adt/cts/*`, which 7.40 does not advertise. */
  override readObjects<E extends IAdtError>(
    this: this & AdtPerformedBy<'request', 'readObjects'>,
    _transportNumber: string,
    _options: IAdtOperationOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['objects'], E | IAdtError>>;
  override readObjects(
    this: this & AdtPerformedBy<'request', 'readObjects'>,
    _transportNumber: string,
    _options?: IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['objects'], IAdtError>>;
  override async readObjects<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'request', 'readObjects'>,
    _transportNumber: string,
    _options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['objects'], E | IAdtError>> {
    return failed<T['objects']>(
      unsupported('Reading the objects of a transport request', NOT_ADVERTISED),
    );
  }

  /** Refused without a request: reading the action log of a transport request is on `/sap/bc/adt/cts/*`, which 7.40 does not advertise. */
  override readActionLog<E extends IAdtError>(
    this: this & AdtPerformedBy<'request', 'readActionLog'>,
    _transportNumber: string,
    _options: IAdtOperationOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['actionLog'], E | IAdtError>>;
  override readActionLog(
    this: this & AdtPerformedBy<'request', 'readActionLog'>,
    _transportNumber: string,
    _options?: IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['actionLog'], IAdtError>>;
  override async readActionLog<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'request', 'readActionLog'>,
    _transportNumber: string,
    _options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['actionLog'], E | IAdtError>> {
    return failed<T['actionLog']>(
      unsupported(
        'Reading the action log of a transport request',
        NOT_ADVERTISED,
      ),
    );
  }

  /** Refused without a request: adding an object to a transport request is on `/sap/bc/adt/cts/*`, which 7.40 does not advertise. */
  override addObject<E extends IAdtError>(
    this: this & AdtPerformedBy<'request', 'addObject'>,
    _transportNumber: string,
    _object: IAbapObjectEntry,
    _options: { headers: IAdtHeaders } & IAdtOperationOptions<E> & {
        analyse: IAnalyse<E>;
      },
  ): Promise<IAdtResponse<T['addedObject'], E | IAdtError>>;
  override addObject(
    this: this & AdtPerformedBy<'request', 'addObject'>,
    _transportNumber: string,
    _object: IAbapObjectEntry,
    _options: { headers: IAdtHeaders } & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['addedObject'], IAdtError>>;
  override async addObject<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'request', 'addObject'>,
    _transportNumber: string,
    _object: IAbapObjectEntry,
    _options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['addedObject'], E | IAdtError>> {
    return failed<T['addedObject']>(
      unsupported('Adding an object to a transport request', NOT_ADVERTISED),
    );
  }

  /** Refused without a request: removing an object from a transport request is on `/sap/bc/adt/cts/*`, which 7.40 does not advertise. */
  override removeObject<E extends IAdtError>(
    this: this & AdtPerformedBy<'request', 'removeObject'>,
    _transportNumber: string,
    _object: IAbapObjectEntry & { position: string },
    _options: { headers: IAdtHeaders } & IAdtOperationOptions<E> & {
        analyse: IAnalyse<E>;
      },
  ): Promise<IAdtResponse<T['removedObject'], E | IAdtError>>;
  override removeObject(
    this: this & AdtPerformedBy<'request', 'removeObject'>,
    _transportNumber: string,
    _object: IAbapObjectEntry & { position: string },
    _options: { headers: IAdtHeaders } & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['removedObject'], IAdtError>>;
  override async removeObject<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'request', 'removeObject'>,
    _transportNumber: string,
    _object: IAbapObjectEntry & { position: string },
    _options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['removedObject'], E | IAdtError>> {
    return failed<T['removedObject']>(
      unsupported(
        'Removing an object from a transport request',
        NOT_ADVERTISED,
      ),
    );
  }

  /** Refused without a request: moving objects between transport requests is on `/sap/bc/adt/cts/*`, which 7.40 does not advertise. */
  override moveObjects<E extends IAdtError>(
    this: this & AdtPerformedBy<'request', 'moveObjects'>,
    _sourceTask: string,
    _targetNumber: string,
    _objects: readonly (IAbapObjectEntry & { position: string })[],
    _options: { headers: IAdtHeaders } & IAdtOperationOptions<E> & {
        analyse: IAnalyse<E>;
      },
  ): Promise<IAdtResponse<T['movedObjects'], E | IAdtError>>;
  override moveObjects(
    this: this & AdtPerformedBy<'request', 'moveObjects'>,
    _sourceTask: string,
    _targetNumber: string,
    _objects: readonly (IAbapObjectEntry & { position: string })[],
    _options: { headers: IAdtHeaders } & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['movedObjects'], IAdtError>>;
  override async moveObjects<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'request', 'moveObjects'>,
    _sourceTask: string,
    _targetNumber: string,
    _objects: readonly (IAbapObjectEntry & { position: string })[],
    _options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['movedObjects'], E | IAdtError>> {
    return failed<T['movedObjects']>(
      unsupported('Moving objects between transport requests', NOT_ADVERTISED),
    );
  }

  /** Refused without a request: sorting and compressing a transport task is on `/sap/bc/adt/cts/*`, which 7.40 does not advertise. */
  override sortAndCompress<E extends IAdtError>(
    this: this & AdtPerformedBy<'request', 'sortAndCompress'>,
    _taskNumber: string,
    _options: IAdtOperationOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['sortedAndCompressed'], E | IAdtError>>;
  override sortAndCompress(
    this: this & AdtPerformedBy<'request', 'sortAndCompress'>,
    _taskNumber: string,
    _options?: IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['sortedAndCompressed'], IAdtError>>;
  override async sortAndCompress<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'request', 'sortAndCompress'>,
    _taskNumber: string,
    _options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['sortedAndCompressed'], E | IAdtError>> {
    return failed<T['sortedAndCompressed']>(
      unsupported('Sorting and compressing a transport task', NOT_ADVERTISED),
    );
  }

  /** Refused without a request: creating a task under a transport request is on `/sap/bc/adt/cts/*`, which 7.40 does not advertise. */
  override createTask<E extends IAdtError>(
    this: this & AdtPerformedBy<'request', 'createTask'>,
    _transportNumber: string,
    _options: { headers: IAdtHeaders } & {
      targetUser: string;
    } & IAdtOperationOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['createdTask'], E | IAdtError>>;
  override createTask(
    this: this & AdtPerformedBy<'request', 'createTask'>,
    _transportNumber: string,
    _options: { headers: IAdtHeaders } & {
      targetUser: string;
    } & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['createdTask'], IAdtError>>;
  override async createTask<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'request', 'createTask'>,
    _transportNumber: string,
    _options: { headers: IAdtHeaders } & {
      targetUser: string;
    } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['createdTask'], E | IAdtError>> {
    return failed<T['createdTask']>(
      unsupported('Creating a task under a transport request', NOT_ADVERTISED),
    );
  }

  /** Refused without a request: changing the type of a transport task is on `/sap/bc/adt/cts/*`, which 7.40 does not advertise. */
  override changeTaskType<E extends IAdtError>(
    this: this & AdtPerformedBy<'request', 'changeTaskType'>,
    _taskNumber: string,
    _type: AdtTaskType,
    _options: { headers: IAdtHeaders } & IAdtOperationOptions<E> & {
        analyse: IAnalyse<E>;
      },
  ): Promise<IAdtResponse<T['taskTypeChanged'], E | IAdtError>>;
  override changeTaskType(
    this: this & AdtPerformedBy<'request', 'changeTaskType'>,
    _taskNumber: string,
    _type: AdtTaskType,
    _options: { headers: IAdtHeaders } & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['taskTypeChanged'], IAdtError>>;
  override async changeTaskType<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'request', 'changeTaskType'>,
    _taskNumber: string,
    _type: AdtTaskType,
    _options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['taskTypeChanged'], E | IAdtError>> {
    return failed<T['taskTypeChanged']>(
      unsupported('Changing the type of a transport task', NOT_ADVERTISED),
    );
  }
}
