/**
 * DomainBuilder - Fluent API for domain operations with Promise chaining
 *
 * Supports:
 * - Method chaining: builder.create().then(b => b.lock()).then(b => b.update())...
 * - Error handling: .catch() for error callbacks
 * - Cleanup: .finally() for guaranteed execution
 * - Result storage: all results stored in logger/state
 * - Chain interruption: chain stops on first error (standard Promise behavior)
 *
 * @example
 * ```typescript
 * const builder = new DomainBuilder(connection, logger, {
 *   domainName: 'Z_TEST_DOMAIN',
 *   packageName: 'ZOK_TEST_PKG_01'
 * });
 *
 * await builder
 *   .create()
 *   .then(b => b.lock())
 *   .then(b => b.update())
 *   .then(b => b.check())
 *   .then(b => b.unlock())
 *   .then(b => b.activate())
 *   .catch(error => {
 *     logger.error('Operation failed:', error);
 *   })
 *   .finally(() => {
 *     // Cleanup - always executes
 *   });
 * ```
 */

import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import type { AxiosResponse } from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { getSystemInformation } from '../../utils/systemInfo';
import type { IBuilder } from '../shared/IBuilder';
import { activateDomain } from './activation';
import { checkDomainSyntax } from './check';
import { create } from './create';
import { deleteDomain } from './delete';
import { lockDomain } from './lock';
import { getDomain, getDomainTransport } from './read';
import type {
  ICreateDomainParams,
  IDomainConfig,
  IDomainState,
  IFixedValue,
  IUpdateDomainParams,
} from './types';
import { unlockDomain } from './unlock';
import { updateDomain } from './update';
import { validateDomainName } from './validation';

export class DomainBuilder implements IBuilder<IDomainState> {
  private connection: IAbapConnection;
  private logger?: ILogger;
  private config: IDomainConfig;
  private lockHandle?: string;
  private state: IDomainState;

  constructor(
    connection: IAbapConnection,
    config: IDomainConfig,
    logger?: ILogger,
  ) {
    this.connection = connection;
    this.logger = logger ?? {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    };
    this.config = { ...config };
    this.state = {
      errors: [],
    };
  }

  // Builder methods - return this for chaining
  setPackage(packageName: string): this {
    this.config.packageName = packageName;
    this.logger?.debug('Package set:', packageName);
    return this;
  }

  setRequest(transportRequest: string): this {
    this.config.transportRequest = transportRequest;
    this.logger?.debug('Transport request set:', transportRequest);
    return this;
  }

  setName(domainName: string): this {
    this.config.domainName = domainName;
    this.logger?.debug('Domain name set:', domainName);
    return this;
  }

  setDescription(description: string): this {
    this.config.description = description;
    return this;
  }

  setDatatype(datatype: string): this {
    this.config.datatype = datatype;
    return this;
  }

  setLength(length: number): this {
    this.config.length = length;
    return this;
  }

  setDecimals(decimals: number): this {
    this.config.decimals = decimals;
    return this;
  }

  setConversionExit(conversion_exit: string): this {
    this.config.conversion_exit = conversion_exit;
    return this;
  }

  setLowercase(lowercase: boolean): this {
    this.config.lowercase = lowercase;
    return this;
  }

  setSignExists(sign_exists: boolean): this {
    this.config.sign_exists = sign_exists;
    return this;
  }

  setValueTable(value_table: string): this {
    this.config.value_table = value_table;
    return this;
  }

  setFixedValues(fixed_values: IFixedValue[]): this {
    this.config.fixed_values = fixed_values;
    return this;
  }

  // Operation methods that don't modify state - return result directly
  async validate(): Promise<AxiosResponse> {
    try {
      this.logger?.info('Validating domain name:', this.config.domainName);
      const result = await validateDomainName(
        this.connection,
        this.config.domainName,
        this.config.packageName,
        this.config.description,
      );
      // Store raw response for backward compatibility
      this.state.validationResponse = result;
      this.logger?.info('Domain name validation successful');
      return result;
    } catch (error: any) {
      this.state.errors.push({
        method: 'validate',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date(),
      });
      this.logger?.error('Validation failed:', error);
      throw error;
    }
  }

  async create(): Promise<this> {
    try {
      if (!this.config.packageName) {
        throw new Error('Package name is required');
      }
      this.logger?.info('Creating empty domain:', this.config.domainName);

      // Get masterSystem and responsible (only for cloud systems)
      const systemInfo = await getSystemInformation(this.connection);
      const masterSystem = systemInfo?.systemID;
      const username =
        systemInfo?.userName ||
        process.env.SAP_USER ||
        process.env.SAP_USERNAME ||
        'MPCUSER';

      // Enable stateful session mode
      this.connection.setSessionType('stateful');

      const params: ICreateDomainParams = {
        domain_name: this.config.domainName,
        package_name: this.config.packageName,
        transport_request: this.config.transportRequest,
        description: this.config.description,
        datatype: this.config.datatype,
        length: this.config.length,
        decimals: this.config.decimals,
        conversion_exit: this.config.conversion_exit,
        lowercase: this.config.lowercase,
        sign_exists: this.config.sign_exists,
        value_table: this.config.value_table,
        fixed_values: this.config.fixed_values,
      };

      // Create empty domain only (initial POST to register the name)
      const result = await create(
        this.connection,
        params,
        username,
        masterSystem,
      );
      this.state.createResult = result;
      this.logger?.info('Empty domain created successfully:', result.status);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'create',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date(),
      });
      this.logger?.error('Create failed:', error);
      throw error; // Interrupts chain
    }
  }

  async lock(): Promise<this> {
    try {
      this.logger?.info('Locking domain:', this.config.domainName);

      // Enable stateful session mode
      this.connection.setSessionType('stateful');

      const lockHandle = await lockDomain(
        this.connection,
        this.config.domainName,
      );
      this.lockHandle = lockHandle;
      this.state.lockHandle = lockHandle;

      this.logger?.info(`'Domain locked  handle:' ${`lockHandle`}`);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'lock',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date(),
      });
      this.logger?.error('Lock failed:', error);
      throw error; // Interrupts chain
    }
  }

  async update(): Promise<this> {
    try {
      if (!this.lockHandle) {
        throw new Error(
          'Domain must be locked before update. Call lock() first.',
        );
      }
      if (!this.config.packageName) {
        throw new Error('Package name is required');
      }

      // Get masterSystem and responsible (only for cloud systems)
      const systemInfo = await getSystemInformation(this.connection);
      const masterSystem = systemInfo?.systemID;
      const username =
        systemInfo?.userName ||
        process.env.SAP_USER ||
        process.env.SAP_USERNAME ||
        'MPCUSER';

      this.logger?.info(
        'Updating domain (UPDATE workflow):',
        this.config.domainName,
      );
      const updateParams: IUpdateDomainParams = {
        domain_name: this.config.domainName,
        package_name: this.config.packageName,
        transport_request: this.config.transportRequest,
        description: this.config.description,
        datatype: this.config.datatype,
        length: this.config.length,
        decimals: this.config.decimals,
        conversion_exit: this.config.conversion_exit,
        lowercase: this.config.lowercase,
        sign_exists: this.config.sign_exists,
        value_table: this.config.value_table,
        fixed_values: this.config.fixed_values,
        activate: false, // Don't activate in low-level function
      };

      // Use updateDomain (low-level) - stateful session already set by lock()
      // Connection object maintains sessionMode state between builder instances
      const result = await updateDomain(
        this.connection,
        updateParams,
        this.lockHandle,
        username,
        masterSystem,
      );

      this.state.updateResult = result;
      this.logger?.info('Domain updated successfully:', result.status);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'update',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date(),
      });
      this.logger?.error('Update failed:', error);
      throw error; // Interrupts chain
    }
  }

  async check(
    version: 'active' | 'inactive' = 'inactive',
  ): Promise<AxiosResponse> {
    try {
      this.logger?.info(
        `'Checking domain:'  this.config.domainName  'version:' ${`version`}`,
      );

      // Generate XML content to check (same as will be sent in PUT)
      let xmlContent: string | undefined;
      if (this.config.packageName) {
        // Only generate XML if we have enough config to build it
        const systemInfo = await getSystemInformation(this.connection);
        const masterSystem = systemInfo?.systemID;
        const username =
          systemInfo?.userName ||
          process.env.SAP_USER ||
          process.env.SAP_USERNAME ||
          'MPCUSER';

        const datatype = this.config.datatype || 'CHAR';
        const length = this.config.length || 100;
        const decimals = this.config.decimals || 0;

        let fixValuesXml = '';
        if (this.config.fixed_values && this.config.fixed_values.length > 0) {
          const fixValueItems = this.config.fixed_values
            .map(
              (fv) =>
                `      <doma:fixValue>\n        <doma:low>${fv.low}</doma:low>\n        <doma:text>${fv.text}</doma:text>\n      </doma:fixValue>`,
            )
            .join('\n');
          fixValuesXml = `    <doma:fixValues>\n${fixValueItems}\n    </doma:fixValues>`;
        } else {
          fixValuesXml = '    <doma:fixValues/>';
        }

        const description = this.config.description || this.config.domainName;
        const masterSystemAttr = masterSystem
          ? ` adtcore:masterSystem="${masterSystem}"`
          : '';

        xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<doma:domain xmlns:doma="http://www.sap.com/dictionary/domain"
             xmlns:adtcore="http://www.sap.com/adt/core"
             adtcore:description="${description}"
             adtcore:language="EN"
             adtcore:name="${this.config.domainName.toUpperCase()}"
             adtcore:type="DOMA/DD"
             adtcore:masterLanguage="EN"${masterSystemAttr}
             adtcore:responsible="${username}">
  <adtcore:packageRef adtcore:name="${this.config.packageName.toUpperCase()}"/>
  <doma:content>
    <doma:typeInformation>
      <doma:datatype>${datatype}</doma:datatype>
      <doma:length>${length}</doma:length>
      <doma:decimals>${decimals}</doma:decimals>
    </doma:typeInformation>
    <doma:outputInformation>
      <doma:length>${length}</doma:length>
      <doma:conversionExit>${this.config.conversion_exit || ''}</doma:conversionExit>
      <doma:signExists>${this.config.sign_exists || false}</doma:signExists>
      <doma:lowercase>${this.config.lowercase || false}</doma:lowercase>
    </doma:outputInformation>
    <doma:valueInformation>
      <doma:valueTableRef adtcore:name="${this.config.value_table || ''}"/>
      <doma:appendExists>false</doma:appendExists>
${fixValuesXml}
    </doma:valueInformation>
  </doma:content>
</doma:domain>`;
      }

      const result = await checkDomainSyntax(
        this.connection,
        this.config.domainName,
        version,
        xmlContent,
      );
      // Store result for backward compatibility
      this.state.checkResult = result;
      this.logger?.info('Domain check successful:', result.status);
      return result;
    } catch (error: any) {
      this.state.errors.push({
        method: 'check',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date(),
      });
      this.logger?.error('Check failed:', error);
      throw error;
    }
  }

  async unlock(): Promise<this> {
    try {
      if (!this.lockHandle) {
        throw new Error('Domain is not locked. Call lock() first.');
      }
      this.logger?.info('Unlocking domain:', this.config.domainName);
      const result = await unlockDomain(
        this.connection,
        this.config.domainName,
        this.lockHandle,
      );
      this.state.unlockResult = result;
      this.lockHandle = undefined;
      this.state.lockHandle = undefined;
      this.connection.setSessionType('stateless');
      this.logger?.info('Domain unlocked successfully');
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'unlock',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date(),
      });
      this.logger?.error('Unlock failed:', error);
      throw error; // Interrupts chain
    }
  }

  async activate(): Promise<this> {
    try {
      this.logger?.info('Activating domain:', this.config.domainName);
      const result = await activateDomain(
        this.connection,
        this.config.domainName,
      );
      this.state.activateResult = result;
      this.logger?.info('Domain activated successfully:', result.status);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'activate',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date(),
      });
      this.logger?.error('Activate failed:', error);
      throw error; // Interrupts chain
    }
  }

  async delete(): Promise<this> {
    try {
      this.logger?.info('Deleting domain:', this.config.domainName);
      const result = await deleteDomain(this.connection, {
        domain_name: this.config.domainName,
        transport_request: this.config.transportRequest,
      });
      this.state.deleteResult = result;
      this.logger?.info('Domain deleted successfully:', result.status);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'delete',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date(),
      });
      this.logger?.error('Delete failed:', error);
      throw error; // Interrupts chain
    }
  }

  async read(
    _version?: 'active' | 'inactive',
    options?: { withLongPolling?: boolean },
  ): Promise<IDomainConfig | undefined> {
    try {
      this.logger?.info('Reading domain:', this.config.domainName);
      const result = await getDomain(
        this.connection,
        this.config.domainName,
        options,
      );
      // Store raw response for backward compatibility
      this.state.readResult = result;
      this.logger?.info('Domain read successfully:', result.status);

      // Parse and return config directly
      const xmlData =
        typeof result.data === 'string'
          ? result.data
          : JSON.stringify(result.data);

      return this.parseDomainXml(xmlData);
    } catch (error: any) {
      this.state.errors.push({
        method: 'read',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date(),
      });
      this.logger?.error('Read failed:', error);
      throw error;
    }
  }

  async readTransport(): Promise<this> {
    try {
      this.logger?.info(
        'Reading transport request for domain:',
        this.config.domainName,
      );
      const result = await getDomainTransport(
        this.connection,
        this.config.domainName,
      );
      this.state.transportResult = result;
      this.logger?.info('Transport request read successfully:', result.status);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'readTransport',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date(),
      });
      this.logger?.error('Read transport failed:', error);
      throw error; // Interrupts chain
    }
  }

  async forceUnlock(): Promise<void> {
    if (!this.lockHandle) {
      return;
    }
    try {
      await unlockDomain(
        this.connection,
        this.config.domainName,
        this.lockHandle,
      );
      this.logger?.info('Force unlock successful for', this.config.domainName);
    } catch (error: any) {
      this.logger?.warn('Force unlock failed:', error);
    } finally {
      this.lockHandle = undefined;
      this.state.lockHandle = undefined;
      this.connection.setSessionType('stateless');
    }
  }

  // Getters for accessing results
  getState(): Readonly<IDomainState> {
    return { ...this.state };
  }

  getDomainName(): string {
    return this.config.domainName;
  }

  getLockHandle(): string | undefined {
    return this.lockHandle;
  }

  getSessionId(): string | null {
    return this.connection.getSessionId();
  }

  getCreateResult(): AxiosResponse | undefined {
    return this.state.createResult;
  }

  getUpdateResult(): AxiosResponse | undefined {
    return this.state.updateResult;
  }

  getCheckResult(): AxiosResponse | undefined {
    return this.state.checkResult;
  }

  getUnlockResult(): AxiosResponse | undefined {
    return this.state.unlockResult;
  }

  getActivateResult(): AxiosResponse | undefined {
    return this.state.activateResult;
  }

  getDeleteResult(): AxiosResponse | undefined {
    return this.state.deleteResult;
  }

  /**
   * Parse XML response to DomainBuilderConfig
   */
  private parseDomainXml(xmlData: string): IDomainConfig | undefined {
    try {
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '',
      });

      const result = parser.parse(xmlData);
      const domain = result['doma:domain'];

      if (!domain) {
        return undefined;
      }

      // Extract fixed values if present
      const fixValues =
        domain['doma:content']?.['doma:valueInformation']?.['doma:fixValues']?.[
          'doma:fixValue'
        ];
      const fixedValues = Array.isArray(fixValues)
        ? fixValues.map((fv: any) => ({
            low: fv['doma:low'] || '',
            text: fv['doma:text'] || '',
          }))
        : fixValues
          ? [
              {
                low: fixValues['doma:low'] || '',
                text: fixValues['doma:text'] || '',
              },
            ]
          : undefined;

      // Parse length and decimals - GET returns "000010", PUT needs "100"
      const lengthStr =
        domain['doma:content']?.['doma:typeInformation']?.['doma:length'];
      const length = lengthStr ? parseInt(lengthStr, 10) : undefined;

      const decimalsStr =
        domain['doma:content']?.['doma:typeInformation']?.['doma:decimals'];
      const decimals = decimalsStr ? parseInt(decimalsStr, 10) : undefined;

      // Parse conversion exit - can be empty string or missing
      const conversionExit =
        domain['doma:content']?.['doma:outputInformation']?.[
          'doma:conversionExit'
        ];
      const conversion_exit =
        conversionExit && conversionExit.trim() !== ''
          ? conversionExit
          : undefined;

      // Parse boolean values - GET returns "false"/"true" as strings
      const lowercaseStr =
        domain['doma:content']?.['doma:outputInformation']?.['doma:lowercase'];
      const lowercase = lowercaseStr === 'true' || lowercaseStr === true;

      const signExistsStr =
        domain['doma:content']?.['doma:outputInformation']?.['doma:signExists'];
      const sign_exists = signExistsStr === 'true' || signExistsStr === true;

      // Parse value table - can be empty or have adtcore:name attribute
      const valueTableRef =
        domain['doma:content']?.['doma:valueInformation']?.[
          'doma:valueTableRef'
        ];
      const value_table =
        valueTableRef?.['adtcore:name'] ||
        (typeof valueTableRef === 'string' && valueTableRef.trim() !== ''
          ? valueTableRef
          : undefined);

      return {
        domainName: domain['adtcore:name'] || this.config.domainName,
        packageName: domain['adtcore:packageRef']?.['adtcore:name'],
        description: domain['adtcore:description'] || '',
        datatype:
          domain['doma:content']?.['doma:typeInformation']?.['doma:datatype'],
        length,
        decimals,
        conversion_exit,
        lowercase,
        sign_exists,
        value_table,
        fixed_values: fixedValues,
      };
    } catch (error) {
      this.logger?.error('Failed to parse domain XML:', error);
      return undefined;
    }
  }

  getReadResult(): IDomainConfig | undefined {
    if (!this.state.readResult) {
      return undefined;
    }

    const xmlData =
      typeof this.state.readResult.data === 'string'
        ? this.state.readResult.data
        : JSON.stringify(this.state.readResult.data);

    return this.parseDomainXml(xmlData);
  }

  getTransportResult(): AxiosResponse | undefined {
    return this.state.transportResult;
  }

  getErrors(): ReadonlyArray<{
    method: string;
    error: Error;
    timestamp: Date;
  }> {
    return [...this.state.errors];
  }

  // Helper method to get all results
  getResults(): {
    create?: AxiosResponse;
    update?: AxiosResponse;
    check?: AxiosResponse;
    unlock?: AxiosResponse;
    activate?: AxiosResponse;
    delete?: AxiosResponse;
    lockHandle?: string;
    errors: Array<{ method: string; error: Error; timestamp: Date }>;
  } {
    return {
      create: this.state.createResult,
      update: this.state.updateResult,
      check: this.state.checkResult,
      unlock: this.state.unlockResult,
      activate: this.state.activateResult,
      delete: this.state.deleteResult,
      lockHandle: this.lockHandle,
      errors: [...this.state.errors],
    };
  }
}
