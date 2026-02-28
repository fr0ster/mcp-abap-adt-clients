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
 * - Update: not supported (transport requests are immutable after creation)
 * - Delete: not supported (transport requests cannot be deleted via ADT)
 * - Activate: not supported (transport requests are not activated)
 * - Check: not supported (transport requests don't have check operation)
 */

import type {
  IAbapConnection,
  IAdtObject,
  IAdtOperationOptions,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import type { IAdtSystemContext } from '../../clients/AdtClient';
import { createTransport } from './create';
import { getTransport } from './read';
import type { ITransportConfig, ITransportState } from './types';

export class AdtRequest
  implements IAdtObject<ITransportConfig, ITransportState>
{
  private readonly connection: IAbapConnection;
  private readonly logger?: ILogger;
  private readonly systemContext: IAdtSystemContext;
  public readonly objectType: string = 'Request';

  constructor(connection: IAbapConnection, logger?: ILogger, systemContext?: IAdtSystemContext) {
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
    } catch (error: any) {
      this.logger?.error('Create failed:', error);
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
    } catch (error: any) {
      if (error.response?.status === 404) {
        return undefined;
      }
      throw error;
    }
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
   * Update transport request
   * Note: Transport requests are immutable after creation in ADT
   */
  async update(
    _config: Partial<ITransportConfig>,
    _options?: IAdtOperationOptions,
  ): Promise<ITransportState> {
    throw new Error(
      'Update operation is not supported for Transport Request objects in ADT',
    );
  }

  /**
   * Delete transport request
   * Note: Transport requests cannot be deleted via ADT
   */
  async delete(_config: Partial<ITransportConfig>): Promise<ITransportState> {
    throw new Error(
      'Delete operation is not supported for Transport Request objects in ADT',
    );
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
}
