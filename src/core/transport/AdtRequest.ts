/**
 * AdtRequest - High-level CRUD operations for Transport Request objects
 *
 * Implements IAdtObject interface with automatic operation chains,
 * error handling, and resource cleanup.
 *
 * Uses low-level functions directly (not Builder classes).
 *
 * Session management:
 * - No stateful needed for transport operations
 * - Transport requests don't use lock/unlock
 *
 * Operation chains:
 * - Create: create (no validation, no check, no activate)
 * - Read: read (get transport request details)
 * - Update: GET current XML, patch the description, PUT (read-modify-write —
 *   the only field ADT lets a client change on a request)
 * - Delete: DELETE the item resource (ADT accepts this only for an empty request)
 * - Activate: not supported (transport requests are not activated)
 * - Check: not supported (transport requests don't have check operation)
 */

import type {
  IAdtSystemContext,
  ITransportTree,
} from '@mcp-abap-adt/interfaces';
import {
  type HttpError,
  hasDeferredResponses,
  type IAbapConnection,
  type IAdtObject,
  type IAdtOperationOptions,
  type IListTransportsOptions,
  type ILogger,
  type IObjectVersion,
  TRANSPORT_SEARCH_CONFIGURATIONS_URL,
  TransportSearchConfigurationMissing,
} from '@mcp-abap-adt/interfaces';
import { safeErrorMessage } from '../../utils/internalUtils';
import { throwUnsupportedVersions } from '../shared/versions';
import { createTransport } from './create';
import { deleteTransport } from './delete';
import { getTransportSearchConfigurations, listTransports } from './list';
import { parseTransportTree } from './parseTransportTree';
import { getTransport } from './read';
import type { ITransportConfig, ITransportState } from './types';
import { updateTransport } from './update';
export class AdtRequest
  implements IAdtObject<ITransportConfig, ITransportState>
{
  private readonly connection: IAbapConnection;
  private readonly logger?: ILogger;
  private readonly systemContext: IAdtSystemContext;
  public readonly objectType: string = 'Request';

  constructor(
    connection: IAbapConnection,
    logger?: ILogger,
    systemContext?: IAdtSystemContext,
  ) {
    this.connection = connection;
    this.logger = logger;
    this.systemContext = systemContext ?? {};
  }

  /**
   * Validate transport request configuration before creation
   * Note: ADT doesn't provide validation endpoint for transport requests
   */
  async validate(config: Partial<ITransportConfig>): Promise<ITransportState> {
    if (!config.description) {
      throw new Error(
        'Transport request description is required for validation',
      );
    }

    // ADT doesn't provide validation endpoint for transport requests
    // Return empty state
    return {
      errors: [],
    };
  }

  /**
   * Create transport request
   */
  async create(
    config: ITransportConfig,
    _options?: IAdtOperationOptions,
  ): Promise<ITransportState> {
    if (!config.description) {
      throw new Error('Transport request description is required');
    }

    try {
      this.logger?.info?.('Creating transport request');
      const response = await createTransport(this.connection, {
        transport_type:
          config.transportType === 'customizing' ? 'customizing' : 'workbench',
        description: config.description,
        target_system: config.targetSystem,
        owner: config.owner ?? this.systemContext.responsible,
      });

      const transportNumber = response.data?.transport_request;

      if (!transportNumber) {
        throw new Error(
          'Failed to create transport request: transport number not returned',
        );
      }

      this.logger?.info?.('Transport request created:', transportNumber);

      return {
        createResult: response,
        transportNumber,
        errors: [],
      };
    } catch (error: unknown) {
      this.logger?.error('Create failed:', safeErrorMessage(error));
      throw error;
    }
  }

  /**
   * Read transport request
   */
  async read(
    config: Partial<ITransportConfig>,
    _version?: 'active' | 'inactive',
  ): Promise<ITransportState | undefined> {
    if (!config.transportNumber) {
      throw new Error('Transport request number is required');
    }

    try {
      const response = await getTransport(
        this.connection,
        config.transportNumber,
      );

      // Parse response data to extract transport request details
      // Response format depends on ADT API
      const _data = response.data;

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
   * List transport requests.
   *
   * With `configUri`: one request. Without: two — the configurations, then the
   * list. The five filter parameters this used to take were never read by the
   * server; filtering is a property of the saved configuration.
   */
  async list(options?: IListTransportsOptions): Promise<ITransportState> {
    const configUri =
      options?.configUri ?? (await this.resolveSearchConfiguration());

    this.logger?.info?.('Listing transport requests', { configUri });
    const response = await listTransports(this.connection, { configUri });

    return { listResult: response, errors: [] };
  }

  /**
   * The transport tree, parsed.
   *
   * Adds no request to `list()` — with a `configUri` that is one call, without
   * one it is two, exactly as `list()` alone.
   *
   * Rejects on a body the parser does not recognise: the signature promises
   * `ITransportTree`, and a reader takes a signature for a guarantee, so the
   * guarantee here is "this shape or an error" — never a silently empty tree.
   * An empty `tm:root` is not that failure: it resolves with `requests: []`,
   * the permanent correct answer on a system holding no transport requests.
   *
   * A consumer whose system answers in a shape the default parser does not fit
   * passes its own and keeps a type; telling it to fall back on the raw
   * response would be telling it to go untyped, which is the defect this
   * exists to remove.
   */
  async listNodes(options?: IListTransportsOptions): Promise<ITransportTree>;
  async listNodes<T>(
    parse: (data: unknown) => T,
    options?: IListTransportsOptions,
  ): Promise<T>;
  async listNodes<T>(
    first?: IListTransportsOptions | ((data: unknown) => T),
    second?: IListTransportsOptions,
  ): Promise<ITransportTree | T> {
    const parse = typeof first === 'function' ? first : undefined;
    const options = typeof first === 'function' ? second : first;

    const state = await this.list(options);
    const data = state.listResult?.data;

    return parse ? parse(data) : parseTransportTree(data);
  }

  /**
   * Which saved search to run when the caller named none.
   *
   * Deterministic or it throws — never "the first one", which would silently
   * run somebody else's filters.
   *
   * The deferred-connection check lives HERE and not in `list()`: an explicit
   * `configUri` waits for nothing, so a batch call that supplies one is
   * legitimate. Guarding earlier would reject it.
   */
  protected async resolveSearchConfiguration(): Promise<string> {
    if (hasDeferredResponses(this.connection)) {
      throw new Error(
        'configUri is required on a batch client: resolving a search ' +
          'configuration needs a response that a batch cannot deliver until ' +
          'execute().',
      );
    }

    const configurations = await getTransportSearchConfigurations(
      this.connection,
    );

    if (configurations.length === 0) {
      throw new TransportSearchConfigurationMissing(
        TRANSPORT_SEARCH_CONFIGURATIONS_URL,
      );
    }

    if (configurations.length === 1) {
      return configurations[0].uri;
    }

    // Several. Picking one would mean guessing which attribute marks a default,
    // and the payload on the only system we have carries no such marker — one
    // configuration cannot show what several would look like. So: say so, and
    // let the caller choose. This branch gets a rule when a system with several
    // configurations has actually been read.
    throw new Error(
      `This system has ${configurations.length} transport search configurations ` +
        'and none can be shown to be the default; pass configUri explicitly. ' +
        `Available: ${configurations.map((c) => c.uri).join(', ')}`,
    );
  }

  /**
   * Read transport request metadata
   * For transport requests, read() already returns all metadata (description, owner, etc.)
   */
  async readMetadata(
    config: Partial<ITransportConfig>,
  ): Promise<ITransportState> {
    // For transport requests, metadata is the same as read() result
    const readResult = await this.read(config);
    if (!readResult) {
      throw new Error('Transport request not found');
    }
    return readResult;
  }

  /**
   * Update transport request description
   *
   * ADT's only mutable field on a request is its description. Read-modify-write:
   * GET the current XML, patch the description into it, PUT it back — building
   * the body from scratch would drop every server-managed field the client does
   * not model.
   */
  async update(
    config: Partial<ITransportConfig>,
    _options?: IAdtOperationOptions,
  ): Promise<ITransportState> {
    if (!config.transportNumber) {
      throw new Error('Transport request number is required');
    }
    if (!config.description) {
      throw new Error('Transport request description is required for update');
    }

    try {
      this.logger?.info?.(
        'Updating transport request description:',
        config.transportNumber,
      );
      const response = await updateTransport(
        this.connection,
        config.transportNumber,
        config.description,
      );

      return {
        transportNumber: config.transportNumber,
        updateResult: response,
        errors: [],
      };
    } catch (error: unknown) {
      this.logger?.error('Update failed:', safeErrorMessage(error));
      throw error;
    }
  }

  /**
   * Delete transport request
   *
   * ADT accepts this only for a request that holds no objects; a non-empty
   * request is rejected by the server, not by this client.
   */
  async delete(config: Partial<ITransportConfig>): Promise<ITransportState> {
    if (!config.transportNumber) {
      throw new Error('Transport request number is required');
    }

    try {
      this.logger?.info?.(
        'Deleting transport request:',
        config.transportNumber,
      );
      const response = await deleteTransport(
        this.connection,
        config.transportNumber,
      );

      return {
        transportNumber: config.transportNumber,
        deleteResult: response,
        errors: [],
      };
    } catch (error: unknown) {
      this.logger?.error('Delete failed:', safeErrorMessage(error));
      throw error;
    }
  }

  /**
   * Activate transport request
   * Note: Transport requests are not activated (they are containers for objects)
   */
  async activate(_config: Partial<ITransportConfig>): Promise<ITransportState> {
    throw new Error(
      'Activate operation is not supported for Transport Request objects in ADT',
    );
  }

  /**
   * Check transport request
   * Note: Transport requests don't have check operation
   */
  async check(
    _config: Partial<ITransportConfig>,
    _status?: string,
  ): Promise<ITransportState> {
    throw new Error(
      'Check operation is not supported for Transport Request objects in ADT',
    );
  }

  /**
   * Read transport request information for the class
   */
  async readTransport(
    _config: Partial<ITransportConfig>,
  ): Promise<ITransportState> {
    throw new Error(
      'readTransport operation is not supported for Transport Request objects in ADT',
    );
  }

  /**
   * Lock transport request (not supported)
   */
  async lock(_config: Partial<ITransportConfig>): Promise<string> {
    throw new Error('Lock operation is not supported for transport requests');
  }

  /**
   * Unlock transport request (not supported)
   */
  async unlock(
    _config: Partial<ITransportConfig>,
    _lockHandle: string,
  ): Promise<ITransportState> {
    throw new Error('Unlock operation is not supported for transport requests');
  }

  async getVersions(
    _config: Partial<ITransportConfig>,
  ): Promise<IObjectVersion[]> {
    throwUnsupportedVersions('transport request');
  }

  async getVersionSource(_contentUri: string): Promise<string> {
    throwUnsupportedVersions('transport request');
  }
}
