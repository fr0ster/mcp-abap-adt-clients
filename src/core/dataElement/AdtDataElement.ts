/**
 * AdtDataElement - High-level CRUD operations for Data Element objects
 * 
 * Implements IAdtObject interface with automatic operation chains,
 * error handling, and resource cleanup.
 * 
 * Uses low-level functions directly (not Builder classes).
 * 
 * Session management:
 * - stateful: only when doing lock/update/unlock operations
 * - stateless: obligatory after unlock
 * - If no lock/unlock, no stateful needed
 * - activate uses same session/cookies (no stateful needed)
 * 
 * Operation chains:
 * - Create: validate → create → check → lock → check(inactive) → update → unlock → check → activate
 * - Update: lock → check(inactive) → update → unlock → check → activate
 * - Delete: check(deletion) → delete
 */

import { IAbapConnection, IAdtObject, IAdtOperationOptions } from '@mcp-abap-adt/interfaces';
import { AxiosResponse } from 'axios';
import type { ILogger } from '@mcp-abap-adt/interfaces';
import { IDataElementConfig, IDataElementState } from './types';
import { validateDataElementName } from './validation';
import { create as createDataElement } from './create';
import { checkDataElement } from './check';
import { lockDataElement } from './lock';
import { updateDataElement } from './update';
import { unlockDataElement } from './unlock';
import { activateDataElement } from './activation';
import { checkDeletion, deleteDataElement } from './delete';
import { getDataElement, getDataElementTransport } from './read';
import { getSystemInformation } from '../../utils/systemInfo';
import { IDomainConfig, IDomainState } from '../domain';
import { IClassState } from '../class/types';
import { getClassTransport } from '../class/read';

export class AdtDataElement implements IAdtObject<IDataElementConfig, IDataElementState> {
  private readonly connection: IAbapConnection;
  private readonly logger?: ILogger;
  public readonly objectType: string = 'DataElement';

  constructor(connection: IAbapConnection, logger?: ILogger) {
    this.connection = connection;
    this.logger = logger;
  }

  /**
   * Validate data element configuration before creation
   */
  async validate(config: Partial<IDataElementConfig>): Promise<IDataElementState> {
    if (!config.dataElementName) {
      throw new Error('Data element name is required for validation');
    }

    const validationResponse = await validateDataElementName(
      this.connection,
      config.dataElementName,
      config.packageName,
      config.description
    );

    return {
      validationResponse: validationResponse,
      errors: []
    };
  }

  /**
   * Create data element with full operation chain
   */
  async create(
    config: IDataElementConfig,
    options?: IAdtOperationOptions
  ): Promise<IDataElementState> {
    if (!config.dataElementName) {
      throw new Error('Data element name is required');
    }
    if (!config.packageName) {
      throw new Error('Package name is required');
    }
    if (!config.description) {
      throw new Error('Description is required');
    }
    if (!config.typeKind) {
      throw new Error('Type kind is required');
    }

    let objectCreated = false;
    const state: IDataElementState = {
      errors: []
    };

    try {
      // Create data element
      this.logger?.info?.('Creating data element');
      const createResponse = await createDataElement(
        this.connection,
        {
          data_element_name: config.dataElementName,
          package_name: config.packageName,
          transport_request: config.transportRequest,
          description: config.description,
          type_kind: config.typeKind,
          type_name: config.typeName,
          data_type: config.dataType,
          length: config.length,
          decimals: config.decimals,
          short_label: config.shortLabel,
          medium_label: config.mediumLabel,
          long_label: config.longLabel,
          heading_label: config.headingLabel,
          search_help: config.searchHelp,
          search_help_parameter: config.searchHelpParameter,
          set_get_parameter: config.setGetParameter
        }
      );
      state.createResult = createResponse;
      objectCreated = true;
      this.logger?.info?.('Data element created');

      return state;
    } catch (error: any) {
      // Cleanup on error - ensure stateless
      this.connection.setSessionType('stateless');

      if (objectCreated && options?.deleteOnFailure) {
        try {
          this.logger?.warn?.('Deleting data element after failure');
          // No stateful needed - delete doesn't use lock/unlock
          await deleteDataElement(this.connection, {
            data_element_name: config.dataElementName,
            transport_request: config.transportRequest
          });
        } catch (deleteError) {
          this.logger?.warn?.('Failed to delete data element after failure:', deleteError);
        }
      }

      this.logger?.error('Create failed:', error);
      throw error;
    }
  }

  /**
   * Read data element
   */
  async read(
    config: Partial<IDataElementConfig>,
    version: 'active' | 'inactive' = 'active',
    options?: { withLongPolling?: boolean }
  ): Promise<IDataElementState | undefined> {
    if (!config.dataElementName) {
      throw new Error('Data element name is required');
    }

    try {
      const response = await getDataElement(
        this.connection,
        config.dataElementName,
        options?.withLongPolling !== undefined ? { withLongPolling: options.withLongPolling } : undefined
      );
      return {
        readResult: response,
        errors: []
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        return undefined;
      }
      this.logger?.error('Read failed:', error);
      throw error;
    }
  }

  /**
   * Read data element metadata (object characteristics: package, responsible, description, etc.)
   * For data elements, read() already returns metadata since there's no source code.
   */
  async readMetadata(
    config: Partial<IDataElementConfig>,
    options?: { withLongPolling?: boolean }
  ): Promise<IDataElementState> {
    const state: IDataElementState = { errors: [] };
    if (!config.dataElementName) {
      const error = new Error('Data element name is required');
      state.errors.push({ method: 'readMetadata', error, timestamp: new Date() });
      throw error;
    }
    try {
      // For objects without source code, read() already returns metadata
      const readState = await this.read(config, 'active', options);
      if (readState) {
        state.metadataResult = readState.readResult;
        state.readResult = readState.readResult;
      } else {
        const error = new Error(`Data element '${config.dataElementName}' not found`);
        state.errors.push({ method: 'readMetadata', error, timestamp: new Date() });
        throw error;
      }
      this.logger?.info?.('Data element metadata read successfully');
      return state;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      state.errors.push({ method: 'readMetadata', error: err, timestamp: new Date() });
      this.logger?.error('readMetadata', err);
      throw err;
    }
  }

  /**
   * Update data element with full operation chain
   * Always starts with lock
   * If options.low is true, performs only low-level update without lock/check/unlock chain
   */
  async update(
    config: Partial<IDataElementConfig>,
    options?: IAdtOperationOptions
  ): Promise<IDataElementState> {
    if (!config.dataElementName) {
      throw new Error('Data element name is required');
    }
    if (!config.packageName) {
      throw new Error('Package name is required for update');
    }
    if (!config.typeKind) {
      throw new Error('Type kind is required for update');
    }

    // Low-level mode: if lockHandle is provided, perform only update operation
    if (options?.lockHandle) {
      this.logger?.info?.('Low-level update: performing update only (lockHandle provided)');
      const systemInfo = await getSystemInformation(this.connection);
      const username = systemInfo?.userName || process.env.SAP_USER || process.env.SAP_USERNAME || 'MPCUSER';

      const domainInfo = {
        dataType: config.dataType || '',
        length: config.length || 0,
        decimals: config.decimals || 0
      };

      const updateResponse = await updateDataElement(
        this.connection,
        {
          data_element_name: config.dataElementName,
          package_name: config.packageName,
          transport_request: config.transportRequest,
          description: config.description,
          type_kind: config.typeKind,
          type_name: config.typeName,
          data_type: config.dataType,
          length: config.length,
          decimals: config.decimals,
          short_label: config.shortLabel,
          medium_label: config.mediumLabel,
          long_label: config.longLabel,
          heading_label: config.headingLabel,
          search_help: config.searchHelp,
          search_help_parameter: config.searchHelpParameter,
          set_get_parameter: config.setGetParameter
        },
        options.lockHandle
      );
      this.logger?.info?.('Data element updated (low-level)');
      return {
        updateResult: updateResponse,
        errors: []
      };
    }

    let lockHandle: string | undefined;
    const state: IDataElementState = {
      errors: []
    };

    try {
      // 1. Lock (update always starts with lock, stateful ONLY before lock)
      this.logger?.info?.('Step 1: Locking data element');
      this.connection.setSessionType('stateful');
      lockHandle = await lockDataElement(this.connection, config.dataElementName);
      state.lockHandle = lockHandle;
      this.logger?.info?.('Data element locked, handle:', lockHandle);

      // 2. Check inactive with XML for update (if provided)
      const xmlToCheck = options?.xmlContent;
      if (xmlToCheck) {
        this.logger?.info?.('Step 2: Checking inactive version with update content');
        const checkResponse = await checkDataElement(this.connection, config.dataElementName, 'inactive', xmlToCheck);
        state.checkResult = checkResponse;
        this.logger?.info?.('Check inactive with update content passed');
      }

      // 3. Update
      if (lockHandle) {
        this.logger?.info?.('Step 3: Updating data element');
        await updateDataElement(
          this.connection,
          {
            data_element_name: config.dataElementName,
            package_name: config.packageName,
            transport_request: config.transportRequest,
            description: config.description,
            type_kind: config.typeKind,
            type_name: config.typeName,
            data_type: config.dataType,
            length: config.length,
            decimals: config.decimals,
            short_label: config.shortLabel,
            medium_label: config.mediumLabel,
            long_label: config.longLabel,
            heading_label: config.headingLabel,
            search_help: config.searchHelp,
            search_help_parameter: config.searchHelpParameter,
            set_get_parameter: config.setGetParameter
          },
          lockHandle
        );
        // updateDataElement returns void, so we don't store it in state
        this.logger?.info?.('Data element updated');

        // 3.5. Read with long polling to ensure object is ready after update
        this.logger?.info?.('read (wait for object ready after update)');
        try {
          await this.read(
            { dataElementName: config.dataElementName },
            'active',
            { withLongPolling: true }
          );
          this.logger?.info?.('object is ready after update');
        } catch (readError) {
          this.logger?.warn?.('read with long polling failed after update:', readError);
          // Continue anyway - unlock might still work
        }
      }

      // 4. Unlock (obligatory stateless after unlock)
      if (lockHandle) {
        this.logger?.info?.('Step 4: Unlocking data element');
        const unlockResponse = await unlockDataElement(this.connection, config.dataElementName, lockHandle);
        state.unlockResult = unlockResponse;
        this.connection.setSessionType('stateless');
        lockHandle = undefined;
        this.logger?.info?.('Data element unlocked');
      }

      // 5. Final check (no stateful needed)
      this.logger?.info?.('Step 5: Final check');
      const checkResponse2 = await checkDataElement(this.connection, config.dataElementName, 'inactive');
      state.checkResult = checkResponse2;
      this.logger?.info?.('Final check passed');

      // 6. Activate (if requested, no stateful needed - uses same session/cookies)
      if (options?.activateOnUpdate) {
        this.logger?.info?.('Step 6: Activating data element');
        const activateResponse = await activateDataElement(this.connection, config.dataElementName);
        state.activateResult = activateResponse;
        this.logger?.info?.('Data element activated, status:', activateResponse.status);

        // 6.5. Read with long polling to ensure object is ready after activation
        this.logger?.info?.('read (wait for object ready after activation)');
        try {
          const readState = await this.read(
            { dataElementName: config.dataElementName },
            'active',
            { withLongPolling: true }
          );
          if (readState) {
            state.readResult = readState.readResult;
          }
          this.logger?.info?.('object is ready after activation');
        } catch (readError) {
          this.logger?.warn?.('read with long polling failed after activation:', readError);
          // Continue anyway - activation was successful
        }
      } else {
        // Read if not activated
        const readResponse = await getDataElement(this.connection, config.dataElementName, undefined);
        state.readResult = readResponse;
      }

      return state;
    } catch (error: any) {
      // Cleanup on error - unlock if locked (lockHandle saved for force unlock)
      if (lockHandle) {
        try {
          this.logger?.warn?.('Unlocking data element during error cleanup');
          // We're already in stateful after lock, just unlock and set stateless
          await unlockDataElement(this.connection, config.dataElementName, lockHandle);
          this.connection.setSessionType('stateless');
        } catch (unlockError) {
          this.logger?.warn?.('Failed to unlock during cleanup:', unlockError);
        }
      } else {
        // Ensure stateless if lock failed
        this.connection.setSessionType('stateless');
      }

      if (options?.deleteOnFailure) {
        try {
          this.logger?.warn?.('Deleting data element after failure');
          // No stateful needed - delete doesn't use lock/unlock
          await deleteDataElement(this.connection, {
            data_element_name: config.dataElementName,
            transport_request: config.transportRequest
          });
        } catch (deleteError) {
          this.logger?.warn?.('Failed to delete data element after failure:', deleteError);
        }
      }

      this.logger?.error('Update failed:', error);
      throw error;
    }
  }

  /**
   * Delete data element
   */
  async delete(config: Partial<IDataElementConfig>): Promise<IDataElementState> {
    if (!config.dataElementName) {
      throw new Error('Data element name is required');
    }

    const state: IDataElementState = {
      errors: []
    };

    try {
      // Check for deletion (no stateful needed)
      this.logger?.info?.('Checking data element for deletion');
      const checkResponse = await checkDeletion(this.connection, {
        data_element_name: config.dataElementName,
        transport_request: config.transportRequest
      });
      state.checkResult = checkResponse;
      this.logger?.info?.('Deletion check passed');

      // Delete (no stateful needed - no lock/unlock)
      this.logger?.info?.('Deleting data element');
      const deleteResponse = await deleteDataElement(this.connection, {
        data_element_name: config.dataElementName,
        transport_request: config.transportRequest
      });
      state.deleteResult = deleteResponse;
      this.logger?.info?.('Data element deleted');

      return state;
    } catch (error: any) {
      this.logger?.error('Delete failed:', error);
      throw error;
    }
  }

  /**
   * Activate data element
   * No stateful needed - uses same session/cookies
   */
  async activate(config: Partial<IDataElementConfig>): Promise<IDataElementState> {
    if (!config.dataElementName) {
      throw new Error('Data element name is required');
    }

    const state: IDataElementState = {
      errors: []
    };

    try {
      const activateResponse = await activateDataElement(this.connection, config.dataElementName);
      state.activateResult = activateResponse;
      return state;
    } catch (error: any) {
      this.logger?.error('Activate failed:', error);
      throw error;
    }
  }

  /**
   * Check data element
   */
  async check(
    config: Partial<IDataElementConfig>,
    status?: string
  ): Promise<IDataElementState> {
    if (!config.dataElementName) {
      throw new Error('Data element name is required');
    }

    const state: IDataElementState = {
      errors: []
    };

    // Map status to version
    const version: 'active' | 'inactive' = status === 'active' ? 'active' : 'inactive';
    const checkResponse = await checkDataElement(this.connection, config.dataElementName, version);
    state.checkResult = checkResponse;
    return state;
  }

  /**
   * Read transport request information for the data element
   */
  async readTransport(
    config: Partial<IDataElementConfig>,
    options?: { withLongPolling?: boolean }
  ): Promise<IDataElementState> {
    const state: IDataElementState = {
      errors: []
    };

    if (!config.dataElementName) {
      const error = new Error('Data element name is required');
      state.errors.push({
        method: 'readTransport',
        error,
        timestamp: new Date()
      });
      throw error;
    }

    try {
      const response = await getDataElementTransport(
        this.connection,
        config.dataElementName,
        options?.withLongPolling !== undefined ? { withLongPolling: options.withLongPolling } : undefined
      );
      state.transportResult = response;
      this.logger?.info?.('Transport request read successfully');
      return state;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      state.errors.push({
        method: 'readTransport',
        error: err,
        timestamp: new Date()
      });
      this.logger?.error('readTransport', err);
      throw err;
    }
  }

  /**
   * Lock data element for modification
   */
  async lock(config: Partial<IDataElementConfig>): Promise<string> {
    if (!config.dataElementName) {
      throw new Error('Data element name is required');
    }

    this.connection.setSessionType('stateful');
    return await lockDataElement(this.connection, config.dataElementName);
  }

  /**
   * Unlock data element
   */
  async unlock(config: Partial<IDataElementConfig>, lockHandle: string): Promise<IDataElementState> {
    if (!config.dataElementName) {
      throw new Error('Data element name is required');
    }

    const result = await unlockDataElement(this.connection, config.dataElementName, lockHandle);
    this.connection.setSessionType('stateless');
    return {
      unlockResult: result,
      errors: []
    };
  }
}
