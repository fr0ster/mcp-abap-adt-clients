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
import { IAdtLogger, logErrorSafely } from '../../utils/logger';
import { DataElementBuilderConfig } from './types';
import { validateDataElementName } from './validation';
import { create as createDataElement } from './create';
import { checkDataElement } from './check';
import { lockDataElement } from './lock';
import { updateDataElement } from './update';
import { unlockDataElement } from './unlock';
import { activateDataElement } from './activation';
import { checkDeletion, deleteDataElement } from './delete';
import { getDataElement } from './read';
import { getSystemInformation } from '../../utils/systemInfo';

export class AdtDataElement implements IAdtObject<DataElementBuilderConfig, DataElementBuilderConfig> {
  private readonly connection: IAbapConnection;
  private readonly logger: IAdtLogger;
  public readonly objectType: string = 'DataElement';

  constructor(connection: IAbapConnection, logger: IAdtLogger) {
    this.connection = connection;
    this.logger = logger;
  }

  /**
   * Validate data element configuration before creation
   */
  async validate(config: Partial<DataElementBuilderConfig>): Promise<AxiosResponse> {
    if (!config.dataElementName) {
      throw new Error('Data element name is required for validation');
    }

    return await validateDataElementName(
      this.connection,
      config.dataElementName,
      config.packageName,
      config.description
    );
  }

  /**
   * Create data element with full operation chain
   */
  async create(
    config: DataElementBuilderConfig,
    options?: IAdtOperationOptions
  ): Promise<DataElementBuilderConfig> {
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
    let lockHandle: string | undefined;
    const systemInfo = await getSystemInformation(this.connection);
    const username = systemInfo?.userName || '';
    const masterSystem = systemInfo?.systemID;
    const timeout = options?.timeout || 1000;

    try {
      // 1. Validate (no stateful needed)
      this.logger.info?.('Step 1: Validating data element configuration');
      await validateDataElementName(
        this.connection,
        config.dataElementName,
        config.packageName,
        config.description
      );
      this.logger.info?.('Validation passed');

      // 2. Create (no stateful needed)
      this.logger.info?.('Step 2: Creating data element');
      await createDataElement(
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
      objectCreated = true;
      this.logger.info?.('Data element created');

      // 3. Check after create (no stateful needed)
      this.logger.info?.('Step 3: Checking created data element');
      await checkDataElement(this.connection, config.dataElementName, 'inactive');
      this.logger.info?.('Check after create passed');

      // 4. Lock (stateful ONLY before lock)
      this.logger.info?.('Step 4: Locking data element');
      this.connection.setSessionType('stateful');
      lockHandle = await lockDataElement(this.connection, config.dataElementName);
      this.logger.info?.('Data element locked, handle:', lockHandle);

      // 5. Check inactive with XML for update (if provided)
      const xmlToCheck = options?.xmlContent;
      if (xmlToCheck) {
        this.logger.info?.('Step 5: Checking inactive version with update content');
        await checkDataElement(this.connection, config.dataElementName, 'inactive', xmlToCheck);
        this.logger.info?.('Check inactive with update content passed');
      }

      // 6. Update (if XML provided)
      if (xmlToCheck && lockHandle) {
        this.logger.info?.('Step 6: Updating data element with XML');
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
        this.logger.info?.('Data element updated');
      }

      // 7. Unlock (obligatory stateless after unlock)
      if (lockHandle) {
        this.logger.info?.('Step 7: Unlocking data element');
        await unlockDataElement(this.connection, config.dataElementName, lockHandle);
        this.connection.setSessionType('stateless');
        lockHandle = undefined;
        this.logger.info?.('Data element unlocked');
      }

      // 8. Final check (no stateful needed)
      this.logger.info?.('Step 8: Final check');
      await checkDataElement(this.connection, config.dataElementName, 'inactive');
      this.logger.info?.('Final check passed');

      // 9. Activate (if requested, no stateful needed - uses same session/cookies)
      if (options?.activateOnCreate) {
        this.logger.info?.('Step 9: Activating data element');
        const activateResponse = await activateDataElement(this.connection, config.dataElementName);
        this.logger.info?.('Data element activated, status:', activateResponse.status);
        
        // Don't read after activation - object may not be ready yet
        // Return basic info (activation returns 201)
        return {
          dataElementName: config.dataElementName,
          packageName: config.packageName
        };
      }

      // Read and return result (no stateful needed)
      const readResponse = await getDataElement(this.connection, config.dataElementName);
      return {
        dataElementName: config.dataElementName,
        packageName: config.packageName
      };
    } catch (error: any) {
      // Cleanup on error - unlock if locked (lockHandle saved for force unlock)
      if (lockHandle) {
        try {
          this.logger.warn?.('Unlocking data element during error cleanup');
          // We're already in stateful after lock, just unlock and set stateless
          await unlockDataElement(this.connection, config.dataElementName, lockHandle);
          this.connection.setSessionType('stateless');
        } catch (unlockError) {
          this.logger.warn?.('Failed to unlock during cleanup:', unlockError);
        }
      } else {
        // Ensure stateless if no lock was acquired
        this.connection.setSessionType('stateless');
      }

      if (objectCreated && options?.deleteOnFailure) {
        try {
          this.logger.warn?.('Deleting data element after failure');
          // No stateful needed - delete doesn't use lock/unlock
          await deleteDataElement(this.connection, {
            data_element_name: config.dataElementName,
            transport_request: config.transportRequest
          });
        } catch (deleteError) {
          this.logger.warn?.('Failed to delete data element after failure:', deleteError);
        }
      }

      logErrorSafely(this.logger, 'Create', error);
      throw error;
    }
  }

  /**
   * Read data element
   */
  async read(
    config: Partial<DataElementBuilderConfig>,
    version: 'active' | 'inactive' = 'active'
  ): Promise<DataElementBuilderConfig | undefined> {
    if (!config.dataElementName) {
      throw new Error('Data element name is required');
    }

    try {
      const response = await getDataElement(this.connection, config.dataElementName);
      return {
        dataElementName: config.dataElementName
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        return undefined;
      }
      throw error;
    }
  }

  /**
   * Update data element with full operation chain
   * Always starts with lock
   */
  async update(
    config: Partial<DataElementBuilderConfig>,
    options?: IAdtOperationOptions
  ): Promise<DataElementBuilderConfig> {
    if (!config.dataElementName) {
      throw new Error('Data element name is required');
    }
    if (!config.packageName) {
      throw new Error('Package name is required for update');
    }
    if (!config.typeKind) {
      throw new Error('Type kind is required for update');
    }

    let lockHandle: string | undefined;
    const timeout = options?.timeout || 1000;

    try {
      // 1. Lock (update always starts with lock, stateful ONLY before lock)
      this.logger.info?.('Step 1: Locking data element');
      this.connection.setSessionType('stateful');
      lockHandle = await lockDataElement(this.connection, config.dataElementName);
      this.logger.info?.('Data element locked, handle:', lockHandle);

      // 2. Check inactive with XML for update (if provided)
      const xmlToCheck = options?.xmlContent;
      if (xmlToCheck) {
        this.logger.info?.('Step 2: Checking inactive version with update content');
        await checkDataElement(this.connection, config.dataElementName, 'inactive', xmlToCheck);
        this.logger.info?.('Check inactive with update content passed');
      }

      // 3. Update
      if (lockHandle) {
        this.logger.info?.('Step 3: Updating data element');
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
        this.logger.info?.('Data element updated');
      }

      // 4. Unlock (obligatory stateless after unlock)
      if (lockHandle) {
        this.logger.info?.('Step 4: Unlocking data element');
        await unlockDataElement(this.connection, config.dataElementName, lockHandle);
        this.connection.setSessionType('stateless');
        lockHandle = undefined;
        this.logger.info?.('Data element unlocked');
      }

      // 5. Final check (no stateful needed)
      this.logger.info?.('Step 5: Final check');
      await checkDataElement(this.connection, config.dataElementName, 'inactive');
      this.logger.info?.('Final check passed');

      // 6. Activate (if requested, no stateful needed - uses same session/cookies)
      if (options?.activateOnUpdate) {
        this.logger.info?.('Step 6: Activating data element');
        const activateResponse = await activateDataElement(this.connection, config.dataElementName);
        this.logger.info?.('Data element activated, status:', activateResponse.status);
        
        // Don't read after activation - object may not be ready yet
        // Return basic info (activation returns 201)
        return {
          dataElementName: config.dataElementName
        };
      }

      // Read and return result (no stateful needed)
      const readResponse = await getDataElement(this.connection, config.dataElementName);
      return {
        dataElementName: config.dataElementName
      };
    } catch (error: any) {
      // Cleanup on error - unlock if locked (lockHandle saved for force unlock)
      if (lockHandle) {
        try {
          this.logger.warn?.('Unlocking data element during error cleanup');
          // We're already in stateful after lock, just unlock and set stateless
          await unlockDataElement(this.connection, config.dataElementName, lockHandle);
          this.connection.setSessionType('stateless');
        } catch (unlockError) {
          this.logger.warn?.('Failed to unlock during cleanup:', unlockError);
        }
      } else {
        // Ensure stateless if lock failed
        this.connection.setSessionType('stateless');
      }

      if (options?.deleteOnFailure) {
        try {
          this.logger.warn?.('Deleting data element after failure');
          // No stateful needed - delete doesn't use lock/unlock
          await deleteDataElement(this.connection, {
            data_element_name: config.dataElementName,
            transport_request: config.transportRequest
          });
        } catch (deleteError) {
          this.logger.warn?.('Failed to delete data element after failure:', deleteError);
        }
      }

      logErrorSafely(this.logger, 'Update', error);
      throw error;
    }
  }

  /**
   * Delete data element
   */
  async delete(config: Partial<DataElementBuilderConfig>): Promise<AxiosResponse> {
    if (!config.dataElementName) {
      throw new Error('Data element name is required');
    }

    try {
      // Check for deletion (no stateful needed)
      this.logger.info?.('Checking data element for deletion');
      await checkDeletion(this.connection, {
        data_element_name: config.dataElementName,
        transport_request: config.transportRequest
      });
      this.logger.info?.('Deletion check passed');

      // Delete (no stateful needed - no lock/unlock)
      this.logger.info?.('Deleting data element');
      const result = await deleteDataElement(this.connection, {
        data_element_name: config.dataElementName,
        transport_request: config.transportRequest
      });
      this.logger.info?.('Data element deleted');

      return result;
    } catch (error: any) {
      logErrorSafely(this.logger, 'Delete', error);
      throw error;
    }
  }

  /**
   * Activate data element
   * No stateful needed - uses same session/cookies
   */
  async activate(config: Partial<DataElementBuilderConfig>): Promise<AxiosResponse> {
    if (!config.dataElementName) {
      throw new Error('Data element name is required');
    }

    try {
      const result = await activateDataElement(this.connection, config.dataElementName);
      return result;
    } catch (error: any) {
      logErrorSafely(this.logger, 'Activate', error);
      throw error;
    }
  }

  /**
   * Check data element
   */
  async check(
    config: Partial<DataElementBuilderConfig>,
    status?: string
  ): Promise<AxiosResponse> {
    if (!config.dataElementName) {
      throw new Error('Data element name is required');
    }

    // Map status to version
    const version: 'active' | 'inactive' = status === 'active' ? 'active' : 'inactive';
    return await checkDataElement(this.connection, config.dataElementName, version);
  }
}
