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
import type { ILogger } from '@mcp-abap-adt/interfaces';
import { IDomainConfig, IDomainState } from './types';
import { validateDomainName } from './validation';
import { create as createDomain } from './create';
import { checkDomainSyntax } from './check';
import { lockDomain } from './lock';
import { updateDomain } from './update';
import { unlockDomain } from './unlock';
import { activateDomain } from './activation';
import { checkDeletion, deleteDomain } from './delete';
import { getDomain, getDomainTransport } from './read';
import { getSystemInformation } from '../../utils/systemInfo';
import { getClassTransport } from '../class/read';

export class AdtDomain implements IAdtObject<IDomainConfig, IDomainState> {
  private readonly connection: IAbapConnection;
  private readonly logger?: ILogger;
  public readonly objectType: string = 'Domain';

  constructor(connection: IAbapConnection, logger?: ILogger) {
    this.connection = connection;
    this.logger = logger;
  }

  /**
   * Validate domain configuration before creation
   */
  async validate(config: Partial<IDomainConfig>): Promise<IDomainState> {
    if (!config.domainName) {
      throw new Error('Domain name is required for validation');
    }

    const validationResponse = await validateDomainName(
      this.connection,
      config.domainName,
      config.packageName,
      config.description
    );

    return {
      validationResponse: validationResponse,
      errors: []
    };
  }

  /**
   * Create domain with full operation chain
   */
  async create(
    config: IDomainConfig,
    options?: IAdtOperationOptions
  ): Promise<IDomainState> {
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
    const state: IDomainState = {
      errors: []
    };

    try {
      // 1. Validate (no stateful needed)
      this.logger?.info?.('validate');
      const validationResponse = await validateDomainName(
        this.connection,
        config.domainName,
        config.packageName,
        config.description
      );
      state.validationResponse = validationResponse;
      this.logger?.info?.('validated');

      // 2. Create (no stateful needed)
      this.logger?.info?.('create');
      const createResponse = await createDomain(
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
      state.createResult = createResponse;
      objectCreated = true;
      this.logger?.info?.('created');

      // 3. Check after create (no stateful needed)
      this.logger?.info?.('check(inactive)');
      const checkResponse1 = await checkDomainSyntax(this.connection, config.domainName, 'inactive');
      state.checkResult = checkResponse1;
      this.logger?.info?.('checked(inactive)');

      // 4. Lock (stateful ONLY before lock)
      this.logger?.info?.('lock');
      this.connection.setSessionType('stateful');
      lockHandle = await lockDomain(this.connection, config.domainName);
      state.lockHandle = lockHandle;
      this.logger?.info?.('locked');

      // 5. Check inactive with XML for update (if provided)
      const xmlToCheck = options?.xmlContent;
      if (xmlToCheck) {
        this.logger?.info?.('check(inactive)');
        const checkResponse2 = await checkDomainSyntax(this.connection, config.domainName, 'inactive', xmlToCheck);
        state.checkResult = checkResponse2;
        this.logger?.info?.('checked(inactive)');
      }

      // 6. Update (if XML provided)
      if (xmlToCheck && lockHandle) {
        this.logger?.info?.('update');
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
        // updateDomain returns void, so we don't store it in state
        this.logger?.info?.('updated');
      }

      // 7. Unlock (obligatory stateless after unlock)
      if (lockHandle) {
        this.logger?.info?.('unlock');
        const unlockResponse = await unlockDomain(this.connection, config.domainName, lockHandle);
        state.unlockResult = unlockResponse;
        this.connection.setSessionType('stateless');
        lockHandle = undefined;
        this.logger?.info?.('unlocked');
      }

      // 8. Final check (no stateful needed)
      this.logger?.info?.('check(inactive)');
      const checkResponse3 = await checkDomainSyntax(this.connection, config.domainName, 'inactive');
      state.checkResult = checkResponse3;
      this.logger?.info?.('checked(inactive)');

      // 9. Activate (if requested, no stateful needed - uses same session/cookies)
      if (options?.activateOnCreate) {
        this.logger?.info?.('activate');
        const activateResponse = await activateDomain(this.connection, config.domainName);
        state.activateResult = activateResponse;
        this.logger?.info?.('activated');
      } else {
        // Read inactive version if not activated (metadata endpoint may return inactive version if active doesn't exist)
        const readResponse = await getDomain(this.connection, config.domainName);
        state.readResult = readResponse;
      }

      return state;
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

      this.logger?.error('Create failed:', error);
      throw error;
    }
  }

  /**
   * Read domain
   */
  async read(
    config: Partial<IDomainConfig>,
    version: 'active' | 'inactive' = 'active'
  ): Promise<IDomainState | undefined> {
    if (!config.domainName) {
      throw new Error('Domain name is required');
    }

    try {
      const response = await getDomain(this.connection, config.domainName);
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
   * Read domain metadata (object characteristics: package, responsible, description, etc.)
   * For domains, read() already returns metadata since there's no source code.
   */
  async readMetadata(config: Partial<IDomainConfig>): Promise<IDomainState> {
    const state: IDomainState = { errors: [] };
    if (!config.domainName) {
      const error = new Error('Domain name is required');
      state.errors.push({ method: 'readMetadata', error, timestamp: new Date() });
      throw error;
    }
    try {
      // For objects without source code, read() already returns metadata
      const readState = await this.read(config);
      if (readState) {
        state.metadataResult = readState.readResult;
        state.readResult = readState.readResult;
      } else {
        const error = new Error(`Domain '${config.domainName}' not found`);
        state.errors.push({ method: 'readMetadata', error, timestamp: new Date() });
        throw error;
      }
      this.logger?.info?.('Domain metadata read successfully');
      return state;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      state.errors.push({ method: 'readMetadata', error: err, timestamp: new Date() });
      this.logger?.error('readMetadata', err);
      throw err;
    }
  }

  /**
   * Update domain with full operation chain
   * Always starts with lock
   */
  async update(
    config: Partial<IDomainConfig>,
    options?: IAdtOperationOptions
  ): Promise<IDomainState> {
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
    const state: IDomainState = {
      errors: []
    };

    try {
      // 1. Lock (update always starts with lock, stateful ONLY before lock)
      this.logger?.info?.('lock');
      this.connection.setSessionType('stateful');
      lockHandle = await lockDomain(this.connection, config.domainName);
      state.lockHandle = lockHandle;
      this.logger?.info?.('locked');

      // 2. Check inactive with XML for update (if provided)
      const xmlToCheck = options?.xmlContent;
      if (xmlToCheck) {
        this.logger?.info?.('check(inactive)');
        const checkResponse = await checkDomainSyntax(this.connection, config.domainName, 'inactive', xmlToCheck);
        state.checkResult = checkResponse;
        this.logger?.info?.('checked(inactive)');
      }

      // 3. Update
      if (lockHandle) {
        this.logger?.info?.('update');
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
        // updateDomain returns void, so we don't store it in state
        this.logger?.info?.('updated');
      }

      // 4. Unlock (obligatory stateless after unlock)
      if (lockHandle) {
        this.logger?.info?.('unlock');
        const unlockResponse = await unlockDomain(this.connection, config.domainName, lockHandle);
        state.unlockResult = unlockResponse;
        this.connection.setSessionType('stateless');
        lockHandle = undefined;
        this.logger?.info?.('unlocked');
      }

      // 5. Final check (no stateful needed)
      this.logger?.info?.('check(inactive)');
      const checkResponse2 = await checkDomainSyntax(this.connection, config.domainName, 'inactive');
      state.checkResult = checkResponse2;
      this.logger?.info?.('checked(inactive)');

      // 6. Activate (if requested, no stateful needed - uses same session/cookies)
      if (options?.activateOnUpdate) {
        this.logger?.info?.('activate');
        const activateResponse = await activateDomain(this.connection, config.domainName);
        state.activateResult = activateResponse;
        this.logger?.info?.('activated');
      } else {
        // Read inactive version if not activated (metadata endpoint may return inactive version if active doesn't exist)
        const readResponse = await getDomain(this.connection, config.domainName);
        state.readResult = readResponse;
      }

      return state;
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

      this.logger?.error('Update failed:', error);
      throw error;
    }
  }

  /**
   * Delete domain
   */
  async delete(config: Partial<IDomainConfig>): Promise<IDomainState> {
    if (!config.domainName) {
      throw new Error('Domain name is required');
    }

    const state: IDomainState = {
      errors: []
    };

    try {
      // Check for deletion (no stateful needed)
      this.logger?.info?.('Checking domain for deletion');
      const checkResponse = await checkDeletion(this.connection, {
        domain_name: config.domainName,
        transport_request: config.transportRequest
      });
      state.checkResult = checkResponse;
      this.logger?.info?.('Deletion check passed');

      // Delete (no stateful needed - no lock/unlock)
      this.logger?.info?.('Deleting domain');
      const deleteResponse = await deleteDomain(this.connection, {
        domain_name: config.domainName,
        transport_request: config.transportRequest
      });
      state.deleteResult = deleteResponse;
      this.logger?.info?.('Domain deleted');

      return state;
    } catch (error: any) {
      this.logger?.error('Delete failed:', error);
      throw error;
    }
  }

  /**
   * Activate domain
   * No stateful needed - uses same session/cookies
   */
  async activate(config: Partial<IDomainConfig>): Promise<IDomainState> {
    if (!config.domainName) {
      throw new Error('Domain name is required');
    }

    const state: IDomainState = {
      errors: []
    };

    try {
      const activateResponse = await activateDomain(this.connection, config.domainName);
      state.activateResult = activateResponse;
      return state;
    } catch (error: any) {
      this.logger?.error('Activate failed:', error);
      throw error;
    }
  }

  /**
   * Check domain
   */
  async check(
    config: Partial<IDomainConfig>,
    status?: string
  ): Promise<IDomainState> {
    if (!config.domainName) {
      throw new Error('Domain name is required');
    }

    const state: IDomainState = {
      errors: []
    };

    // Map status to version
    const version: 'active' | 'inactive' = status === 'active' ? 'active' : 'inactive';
    const checkResponse = await checkDomainSyntax(this.connection, config.domainName, version);
    state.checkResult = checkResponse;
    return state;
  }

  /**
   * Read transport request information for the domain
   */
  async readTransport(config: Partial<IDomainConfig>): Promise<IDomainState> {
    const state: IDomainState = {
      errors: []
    };

    if (!config.domainName) {
      const error = new Error('Domain name is required');
      state.errors.push({
        method: 'readTransport',
        error,
        timestamp: new Date()
      });
      throw error;
    }

    try {
      const response = await getDomainTransport(this.connection, config.domainName);
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
}
