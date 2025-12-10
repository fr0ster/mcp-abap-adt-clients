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

import { IAbapConnection, IAdtObject, IAdtOperationOptions } from '@mcp-abap-adt/interfaces';
import { IAdtLogger, logErrorSafely } from '../../utils/logger';
import { createTransport } from './create';
import { getTransport } from './read';
import { getClassTransport } from '../class/read';
import { ITransportConfig, ITransportState } from './types';

export class AdtRequest implements IAdtObject<ITransportConfig, ITransportState> {
  private readonly connection: IAbapConnection;
  private readonly logger?: IAdtLogger;
  public readonly objectType: string = 'Request';

  constructor(connection: IAbapConnection, logger?: IAdtLogger) {
    this.connection = connection;
    this.logger = logger;
  }

  /**
   * Validate transport request configuration before creation
   * Note: ADT doesn't provide validation endpoint for transport requests
   */
  async validate(config: Partial<ITransportConfig>): Promise<ITransportState> {
    if (!config.description) {
      throw new Error('Transport request description is required for validation');
    }

    // ADT doesn't provide validation endpoint for transport requests
    // Return empty state
    return {
      errors: []
    };
  }

  /**
   * Create transport request
   */
  async create(
    config: ITransportConfig,
    options?: IAdtOperationOptions
  ): Promise<ITransportState> {
    if (!config.description) {
      throw new Error('Transport request description is required');
    }

    try {
      this.logger?.info?.('Creating transport request');
      const response = await createTransport(this.connection, {
        transport_type: config.transportType === 'customizing' ? 'customizing' : 'workbench',
        description: config.description,
        target_system: config.targetSystem,
        owner: config.owner
      });

      const transportNumber = response.data?.transport_request;
      
      if (!transportNumber) {
        throw new Error('Failed to create transport request: transport number not returned');
      }

      this.logger?.info?.('Transport request created:', transportNumber);

      return {
        transportNumber,
        errors: []
      };
    } catch (error: any) {
      logErrorSafely(this.logger, 'Create', error);
      throw error;
    }
  }

  /**
   * Read transport request
   */
  async read(
    config: Partial<ITransportConfig>,
    version: 'active' | 'inactive' = 'active'
  ): Promise<ITransportState | undefined> {
    if (!config.transportNumber) {
      throw new Error('Transport request number is required');
    }

    try {
      const response = await getTransport(this.connection, config.transportNumber);
      
      // Parse response data to extract transport request details
      // Response format depends on ADT API
      const data = response.data;
      
      return {
        transportNumber: config.transportNumber,
        readResult: response,
        errors: []
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
  async readMetadata(config: Partial<ITransportConfig>): Promise<ITransportState> {
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
    config: Partial<ITransportConfig>,
    options?: IAdtOperationOptions
  ): Promise<ITransportState> {
    throw new Error('Update operation is not supported for Transport Request objects in ADT');
  }

  /**
   * Delete transport request
   * Note: Transport requests cannot be deleted via ADT
   */
  async delete(config: Partial<ITransportConfig>): Promise<ITransportState> {
    throw new Error('Delete operation is not supported for Transport Request objects in ADT');
  }

  /**
   * Activate transport request
   * Note: Transport requests are not activated (they are containers for objects)
   */
  async activate(config: Partial<ITransportConfig>): Promise<ITransportState> {
    throw new Error('Activate operation is not supported for Transport Request objects in ADT');
  }

  /**
   * Check transport request
   * Note: Transport requests don't have check operation
   */
  async check(
    config: Partial<ITransportConfig>,
    status?: string
  ): Promise<ITransportState> {
    throw new Error('Check operation is not supported for Transport Request objects in ADT');
  }

  /**
   * Read transport request information for the class
   */
  async readTransport(config: Partial<ITransportConfig>): Promise<ITransportState> {
    throw new Error('readTransport operation is not supported for Transport Request objects in ADT');
  }
}
