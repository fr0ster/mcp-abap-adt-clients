/**
 * AdtDomain - High-level CRUD operations for Domain objects
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
import { DomainBuilderConfig } from './types';
import { validateDomainName } from './validation';
import { create as createDomain } from './create';
import { checkDomainSyntax } from './check';
import { lockDomain } from './lock';
import { updateDomain } from './update';
import { unlockDomain } from './unlock';
import { activateDomain } from './activation';
import { checkDeletion, deleteDomain } from './delete';
import { getDomain } from './read';
import { getSystemInformation } from '../../utils/systemInfo';

export class AdtDomain implements IAdtObject<DomainBuilderConfig, DomainBuilderConfig> {
  private readonly connection: IAbapConnection;
  private readonly logger?: IAdtLogger;
  public readonly objectType: string = 'Domain';

  constructor(connection: IAbapConnection, logger?: IAdtLogger) {
    this.connection = connection;
    this.logger = logger;
  }

  /**
   * Validate domain configuration before creation
   */
  async validate(config: Partial<DomainBuilderConfig>): Promise<AxiosResponse> {
    if (!config.domainName) {
      throw new Error('Domain name is required for validation');
    }

    return await validateDomainName(
      this.connection,
      config.domainName,
      config.packageName,
      config.description
    );
  }

  /**
   * Create domain with full operation chain
   */
  async create(
    config: DomainBuilderConfig,
    options?: IAdtOperationOptions
  ): Promise<DomainBuilderConfig> {
    if (!config.domainName) {
      throw new Error('Domain name is required');
    }
    if (!config.packageName) {
      throw new Error('Package name is required');
    }
    if (!config.description) {
      throw new Error('Description is required');
    }

    let objectCreated = false;
    let lockHandle: string | undefined;
    const systemInfo = await getSystemInformation(this.connection);
    const username = systemInfo?.userName || '';
    const masterSystem = systemInfo?.systemID;
    const timeout = options?.timeout || 1000;

    try {
      // 1. Validate (no stateful needed)
      this.logger?.info?.('Step 1: Validating domain configuration');
      await validateDomainName(
        this.connection,
        config.domainName,
        config.packageName,
        config.description
      );
      this.logger?.info?.('Validation passed');

      // 2. Create (no stateful needed)
      this.logger?.info?.('Step 2: Creating domain');
      await createDomain(
        this.connection,
        {
          domain_name: config.domainName,
          package_name: config.packageName,
          transport_request: config.transportRequest,
          description: config.description,
          datatype: config.datatype,
          length: config.length,
          decimals: config.decimals,
          conversion_exit: config.conversion_exit,
          lowercase: config.lowercase,
          sign_exists: config.sign_exists,
          value_table: config.value_table,
          fixed_values: config.fixed_values
        },
        username,
        masterSystem
      );
      objectCreated = true;
      this.logger?.info?.('Domain created');

      // 3. Check after create (no stateful needed)
      this.logger?.info?.('Step 3: Checking created domain');
      await checkDomainSyntax(this.connection, config.domainName, 'inactive');
      this.logger?.info?.('Check after create passed');

      // 4. Lock (stateful ONLY before lock)
      this.logger?.info?.('Step 4: Locking domain');
      this.connection.setSessionType('stateful');
      lockHandle = await lockDomain(this.connection, config.domainName);
      this.logger?.info?.('Domain locked, handle:', lockHandle);

      // 5. Check inactive with XML for update (if provided)
      const xmlToCheck = options?.xmlContent;
      if (xmlToCheck) {
        this.logger?.info?.('Step 5: Checking inactive version with update content');
        await checkDomainSyntax(this.connection, config.domainName, 'inactive', xmlToCheck);
        this.logger?.info?.('Check inactive with update content passed');
      }

      // 6. Update (if XML provided)
      if (xmlToCheck && lockHandle) {
        this.logger?.info?.('Step 6: Updating domain with XML');
        await updateDomain(
          this.connection,
          {
            domain_name: config.domainName,
            package_name: config.packageName,
            transport_request: config.transportRequest,
            description: config.description,
            datatype: config.datatype,
            length: config.length,
            decimals: config.decimals,
            conversion_exit: config.conversion_exit,
            lowercase: config.lowercase,
            sign_exists: config.sign_exists,
            value_table: config.value_table,
            fixed_values: config.fixed_values
          },
          lockHandle,
          username,
          masterSystem
        );
        this.logger?.info?.('Domain updated');
      }

      // 7. Unlock (obligatory stateless after unlock)
      if (lockHandle) {
        this.logger?.info?.('Step 7: Unlocking domain');
        await unlockDomain(this.connection, config.domainName, lockHandle);
        this.connection.setSessionType('stateless');
        lockHandle = undefined;
        this.logger?.info?.('Domain unlocked');
      }

      // 8. Final check (no stateful needed)
      this.logger?.info?.('Step 8: Final check');
      await checkDomainSyntax(this.connection, config.domainName, 'inactive');
      this.logger?.info?.('Final check passed');

      // 9. Activate (if requested, no stateful needed - uses same session/cookies)
      if (options?.activateOnCreate) {
        this.logger?.info?.('Step 9: Activating domain');
        const activateResponse = await activateDomain(this.connection, config.domainName);
        this.logger?.info?.('Domain activated, status:', activateResponse.status);
        
        // Don't read after activation - object may not be ready yet
        // Return basic info (activation returns 201)
        return {
          domainName: config.domainName,
          packageName: config.packageName
        };
      }

      // Read and return result (no stateful needed)
      const readResponse = await getDomain(this.connection, config.domainName);
      return {
        domainName: config.domainName,
        packageName: config.packageName
      };
    } catch (error: any) {
      // Cleanup on error - unlock if locked (lockHandle saved for force unlock)
      if (lockHandle) {
        try {
          this.logger?.warn?.('Unlocking domain during error cleanup');
          // We're already in stateful after lock, just unlock and set stateless
          await unlockDomain(this.connection, config.domainName, lockHandle);
          this.connection.setSessionType('stateless');
        } catch (unlockError) {
          this.logger?.warn?.('Failed to unlock during cleanup:', unlockError);
        }
      } else {
        // Ensure stateless if no lock was acquired
        this.connection.setSessionType('stateless');
      }

      if (objectCreated && options?.deleteOnFailure) {
        try {
          this.logger?.warn?.('Deleting domain after failure');
          // No stateful needed - delete doesn't use lock/unlock
          await deleteDomain(this.connection, {
            domain_name: config.domainName,
            transport_request: config.transportRequest
          });
        } catch (deleteError) {
          this.logger?.warn?.('Failed to delete domain after failure:', deleteError);
        }
      }

      logErrorSafely(this.logger, 'Create', error);
      throw error;
    }
  }

  /**
   * Read domain
   */
  async read(
    config: Partial<DomainBuilderConfig>,
    version: 'active' | 'inactive' = 'active'
  ): Promise<DomainBuilderConfig | undefined> {
    if (!config.domainName) {
      throw new Error('Domain name is required');
    }

    try {
      const response = await getDomain(this.connection, config.domainName);
      return {
        domainName: config.domainName
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        return undefined;
      }
      throw error;
    }
  }

  /**
   * Update domain with full operation chain
   * Always starts with lock
   */
  async update(
    config: Partial<DomainBuilderConfig>,
    options?: IAdtOperationOptions
  ): Promise<DomainBuilderConfig> {
    if (!config.domainName) {
      throw new Error('Domain name is required');
    }
    if (!config.packageName) {
      throw new Error('Package name is required for update');
    }

    let lockHandle: string | undefined;
    const systemInfo = await getSystemInformation(this.connection);
    const username = systemInfo?.userName || '';
    const masterSystem = systemInfo?.systemID;
    const timeout = options?.timeout || 1000;

    try {
      // 1. Lock (update always starts with lock, stateful ONLY before lock)
      this.logger?.info?.('Step 1: Locking domain');
      this.connection.setSessionType('stateful');
      lockHandle = await lockDomain(this.connection, config.domainName);
      this.logger?.info?.('Domain locked, handle:', lockHandle);

      // 2. Check inactive with XML for update (if provided)
      const xmlToCheck = options?.xmlContent;
      if (xmlToCheck) {
        this.logger?.info?.('Step 2: Checking inactive version with update content');
        await checkDomainSyntax(this.connection, config.domainName, 'inactive', xmlToCheck);
        this.logger?.info?.('Check inactive with update content passed');
      }

      // 3. Update
      if (lockHandle) {
        this.logger?.info?.('Step 3: Updating domain');
        await updateDomain(
          this.connection,
          {
            domain_name: config.domainName,
            package_name: config.packageName,
            transport_request: config.transportRequest,
            description: config.description,
            datatype: config.datatype,
            length: config.length,
            decimals: config.decimals,
            conversion_exit: config.conversion_exit,
            lowercase: config.lowercase,
            sign_exists: config.sign_exists,
            value_table: config.value_table,
            fixed_values: config.fixed_values
          },
          lockHandle,
          username,
          masterSystem
        );
        this.logger?.info?.('Domain updated');
      }

      // 4. Unlock (obligatory stateless after unlock)
      if (lockHandle) {
        this.logger?.info?.('Step 4: Unlocking domain');
        await unlockDomain(this.connection, config.domainName, lockHandle);
        this.connection.setSessionType('stateless');
        lockHandle = undefined;
        this.logger?.info?.('Domain unlocked');
      }

      // 5. Final check (no stateful needed)
      this.logger?.info?.('Step 5: Final check');
      await checkDomainSyntax(this.connection, config.domainName, 'inactive');
      this.logger?.info?.('Final check passed');

      // 6. Activate (if requested, no stateful needed - uses same session/cookies)
      if (options?.activateOnUpdate) {
        this.logger?.info?.('Step 6: Activating domain');
        const activateResponse = await activateDomain(this.connection, config.domainName);
        this.logger?.info?.('Domain activated, status:', activateResponse.status);
        
        // Don't read after activation - object may not be ready yet
        // Return basic info (activation returns 201)
        return {
          domainName: config.domainName
        };
      }

      // Read and return result (no stateful needed)
      const readResponse = await getDomain(this.connection, config.domainName);
      return {
        domainName: config.domainName
      };
    } catch (error: any) {
      // Cleanup on error - unlock if locked (lockHandle saved for force unlock)
      if (lockHandle) {
        try {
          this.logger?.warn?.('Unlocking domain during error cleanup');
          // We're already in stateful after lock, just unlock and set stateless
          await unlockDomain(this.connection, config.domainName, lockHandle);
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
          this.logger?.warn?.('Deleting domain after failure');
          // No stateful needed - delete doesn't use lock/unlock
          await deleteDomain(this.connection, {
            domain_name: config.domainName,
            transport_request: config.transportRequest
          });
        } catch (deleteError) {
          this.logger?.warn?.('Failed to delete domain after failure:', deleteError);
        }
      }

      logErrorSafely(this.logger, 'Update', error);
      throw error;
    }
  }

  /**
   * Delete domain
   */
  async delete(config: Partial<DomainBuilderConfig>): Promise<AxiosResponse> {
    if (!config.domainName) {
      throw new Error('Domain name is required');
    }

    try {
      // Check for deletion (no stateful needed)
      this.logger?.info?.('Checking domain for deletion');
      await checkDeletion(this.connection, {
        domain_name: config.domainName,
        transport_request: config.transportRequest
      });
      this.logger?.info?.('Deletion check passed');

      // Delete (no stateful needed - no lock/unlock)
      this.logger?.info?.('Deleting domain');
      const result = await deleteDomain(this.connection, {
        domain_name: config.domainName,
        transport_request: config.transportRequest
      });
      this.logger?.info?.('Domain deleted');

      return result;
    } catch (error: any) {
      logErrorSafely(this.logger, 'Delete', error);
      throw error;
    }
  }

  /**
   * Activate domain
   * No stateful needed - uses same session/cookies
   */
  async activate(config: Partial<DomainBuilderConfig>): Promise<AxiosResponse> {
    if (!config.domainName) {
      throw new Error('Domain name is required');
    }

    try {
      const result = await activateDomain(this.connection, config.domainName);
      return result;
    } catch (error: any) {
      logErrorSafely(this.logger, 'Activate', error);
      throw error;
    }
  }

  /**
   * Check domain
   */
  async check(
    config: Partial<DomainBuilderConfig>,
    status?: string
  ): Promise<AxiosResponse> {
    if (!config.domainName) {
      throw new Error('Domain name is required');
    }

    // Map status to version
    const version: 'active' | 'inactive' = status === 'active' ? 'active' : 'inactive';
    return await checkDomainSyntax(this.connection, config.domainName, version);
  }
}
