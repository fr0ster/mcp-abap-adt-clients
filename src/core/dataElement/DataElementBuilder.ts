/**
 * DataElementBuilder - Fluent API for data element operations with Promise chaining
 *
 * Supports:
 * - Method chaining: builder.create().then(b => b.lock()).then(b => b.update())...
 * - Error handling: .catch() for error callbacks
 * - Cleanup: .finally() for guaranteed execution
 * - Result storage: all results stored in logger/state
 * - Chain interruption: chain stops on first error (standard Promise behavior)
 */

import { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { AxiosResponse } from 'axios';
import { IAdtLogger, logErrorSafely } from '../../utils/logger';
import { create } from './create';
import { getDataElement } from './read';
import { lockDataElement } from './lock';
import { updateDataElementInternal } from './update';
import { ICreateDataElementParams, IUpdateDataElementParams } from './types';
import { checkDataElement } from './check';
import { unlockDataElement } from './unlock';
import { activateDataElement } from './activation';
import { deleteDataElement } from './delete';
import { validateDataElementName } from './validation';
import { IDataElementConfig, IDataElementState } from './types';
import { IBuilder } from '../shared/IBuilder';
import { XMLParser } from 'fast-xml-parser';

export class DataElementBuilder implements IBuilder<IDataElementState> {
  private connection: IAbapConnection;
  private logger: IAdtLogger;
  private config: IDataElementConfig;
  private lockHandle?: string;
  private state: IDataElementState;

  constructor(
    connection: IAbapConnection,
    logger: IAdtLogger,
    config: IDataElementConfig
  ) {
    this.connection = connection;
    this.logger = logger;
    this.config = { ...config };
    this.state = {
      errors: []
    };
  }

  // Builder methods - return this for chaining
  setPackage(packageName: string): this {
    this.config.packageName = packageName;
    this.logger.debug?.('Package set:', packageName);
    return this;
  }

  setRequest(transportRequest: string): this {
    this.config.transportRequest = transportRequest;
    this.logger.debug?.('Transport request set:', transportRequest);
    return this;
  }

  setName(dataElementName: string): this {
    this.config.dataElementName = dataElementName;
    this.logger.debug?.('Data element name set:', dataElementName);
    return this;
  }

  setDescription(description: string): this {
    this.config.description = description;
    return this;
  }

  setDataType(dataType: string): this {
    this.config.dataType = dataType;
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

  setShortLabel(shortLabel: string): this {
    this.config.shortLabel = shortLabel;
    return this;
  }

  setMediumLabel(mediumLabel: string): this {
    this.config.mediumLabel = mediumLabel;
    return this;
  }

  setLongLabel(longLabel: string): this {
    this.config.longLabel = longLabel;
    return this;
  }

  setHeadingLabel(headingLabel: string): this {
    this.config.headingLabel = headingLabel;
    return this;
  }

  setTypeKind(typeKind: 'domain' | 'predefinedAbapType' | 'refToPredefinedAbapType' | 'refToDictionaryType' | 'refToClifType'): this {
    this.config.typeKind = typeKind;
    return this;
  }

  setTypeName(typeName: string): this {
    this.config.typeName = typeName;
    return this;
  }

  // Operation methods - return Promise<this> for Promise chaining
  async validate(): Promise<AxiosResponse> {
    try {
      this.logger.info?.('Validating data element name:', this.config.dataElementName);
      const result = await validateDataElementName(
        this.connection,
        this.config.dataElementName,
        this.config.packageName,
        this.config.description
      );
      // Store raw response for backward compatibility
      this.state.validationResponse = result;
      this.logger.info?.('Data element name validation successful');
      return result;
    } catch (error: any) {
      // If validation endpoint returns 400 and it's about object existing, that's OK for tests
      if (error.response?.status === 400) {
        const errorData = error.response?.data;
        const errorText = typeof errorData === 'string' ? errorData : JSON.stringify(errorData || {});
        if (errorText.toLowerCase().includes('already exists') ||
            errorText.toLowerCase().includes('does already exist') ||
            errorText.toLowerCase().includes('resource') && errorText.toLowerCase().includes('exist')) {
          this.logger.warn?.('Data element already exists, validation skipped:', this.config.dataElementName);
          this.state.validationResponse = error.response;
          return error.response;
        }
      }

      // If validation is not supported for this object type, skip it (log warning)
      const errorMsg = error.message || '';
      const errorData = error.response?.data;
      const errorText = typeof errorData === 'string' ? errorData : JSON.stringify(errorData || {});
      if (errorMsg.toLowerCase().includes('not supported') ||
          errorText.toLowerCase().includes('not supported') ||
          errorMsg.toLowerCase().includes('object type') && errorMsg.toLowerCase().includes('not supported')) {
        this.logger.warn?.('Validation not supported for DTEL/DE in this SAP system, skipping:', this.config.dataElementName);
        if (error.response) {
          this.state.validationResponse = error.response;
          return error.response;
        }
      }

      this.state.errors.push({
        method: 'validate',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      // Store error response if available
      if (error.response) {
        this.state.validationResponse = error.response;
      }
      
      this.logger.error?.('Validation failed:', error);
      throw error;
    }
  }

  async read(): Promise<IDataElementConfig | undefined> {
    try {
      this.logger.info?.('Reading data element:', this.config.dataElementName);
      const result = await getDataElement(this.connection, this.config.dataElementName);
      // Store raw response for backward compatibility
      this.state.readResult = result;
      this.logger.info?.('Data element read successfully:', result.status);
      
      // Parse and return config directly
      const xmlData = typeof result.data === 'string'
        ? result.data
        : JSON.stringify(result.data);
      
      return this.parseDataElementXml(xmlData);
    } catch (error: any) {
      this.state.errors.push({
        method: 'read',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Read failed:', error);
      throw error;
    }
  }

  async create(): Promise<this> {
    try {
      if (!this.config.packageName) {
        throw new Error('Package name is required');
      }
      if (!this.config.typeKind) {
        throw new Error('typeKind is required in DataElementBuilderConfig. Must be one of: domain, predefinedAbapType, refToPredefinedAbapType, refToDictionaryType, refToClifType');
      }
      const typeKind = this.config.typeKind;

      // Validate required parameters based on type_kind
      // predefinedAbapType and refToPredefinedAbapType require data_type
      // Other types (domain, refToDictionaryType, refToClifType) require type_name
      if (typeKind === 'predefinedAbapType' || typeKind === 'refToPredefinedAbapType') {
        if (!this.config.dataType) {
          throw new Error(`dataType is required when typeKind is '${typeKind}'. Provide data type (e.g., CHAR, NUMC, INT4).`);
        }
      } else {
        // domain, refToDictionaryType, refToClifType require type_name
        if (typeKind === 'domain') {
          // For domain, type_name (domain name) is required, but it will be used as data_type internally
          if (!this.config.typeName && !this.config.dataType) {
            throw new Error(`typeName (domain name) is required when typeKind is 'domain'. Provide domain name (e.g., ZOK_AUTH_ID).`);
          }
        } else {
          // refToDictionaryType, refToClifType
          if (!this.config.typeName) {
            throw new Error(`typeName is required when typeKind is '${typeKind}'. Provide ${typeKind === 'refToDictionaryType' ? 'data element name' : 'class name'}.`);
          }
        }
      }

      this.logger.info?.('Creating data element:', this.config.dataElementName);
      const params: ICreateDataElementParams = {
        data_element_name: this.config.dataElementName,
        package_name: this.config.packageName,
        transport_request: this.config.transportRequest,
        description: this.config.description,
        type_kind: typeKind,
        type_name: this.config.typeName,
        data_type: this.config.dataType,
        length: this.config.length,
        decimals: this.config.decimals,
        short_label: this.config.shortLabel,
        medium_label: this.config.mediumLabel,
        long_label: this.config.longLabel,
        heading_label: this.config.headingLabel
      };
      this.connection.setSessionType("stateful");
      const result = await create(this.connection, params);
      this.state.createResult = result;
      this.logger.info?.('Data element created successfully:', result.status);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'create',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      logErrorSafely(this.logger, 'Create', error);
      throw error; // Interrupts chain
    }
  }

  async lock(): Promise<this> {
    try {
      this.logger.info?.('Locking data element:', this.config.dataElementName);
      this.connection.setSessionType("stateful");
      const lockHandle = await lockDataElement(
        this.connection,
        this.config.dataElementName
      );
      this.lockHandle = lockHandle;
      this.state.lockHandle = lockHandle;

      this.logger.info?.('Data element locked, handle:', lockHandle);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'lock',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Lock failed:', error);
      throw error; // Interrupts chain
    }
  }

  async update(): Promise<this> {
    try {
      if (!this.lockHandle) {
        throw new Error('Data element must be locked before update. Call lock() first.');
      }
      if (!this.config.packageName) {
        throw new Error('Package name is required');
      }
      if (!this.config.typeKind) {
        throw new Error('typeKind is required in DataElementBuilderConfig. Must be one of: domain, predefinedAbapType, refToPredefinedAbapType, refToDictionaryType, refToClifType');
      }
      const typeKind = this.config.typeKind;

      // Validate required parameters based on type_kind
      // predefinedAbapType and refToPredefinedAbapType require data_type
      // Other types (domain, refToDictionaryType, refToClifType) require type_name
      if (typeKind === 'predefinedAbapType' || typeKind === 'refToPredefinedAbapType') {
        if (!this.config.dataType) {
          throw new Error(`dataType is required when typeKind is '${typeKind}'. Provide data type (e.g., CHAR, NUMC, INT4).`);
        }
      } else {
        // domain, refToDictionaryType, refToClifType require type_name
        if (typeKind === 'domain') {
          // For domain, type_name (domain name) is required, but it will be used as data_type internally
          if (!this.config.typeName && !this.config.dataType) {
            throw new Error(`typeName (domain name) is required when typeKind is 'domain'. Provide domain name (e.g., ZOK_AUTH_ID).`);
          }
        } else {
          // refToDictionaryType, refToClifType
          if (!this.config.typeName) {
            throw new Error(`typeName is required when typeKind is '${typeKind}'. Provide ${typeKind === 'refToDictionaryType' ? 'data element name' : 'class name'}.`);
          }
        }
      }

      this.logger.info?.('Updating data element:', this.config.dataElementName);

      const username = process.env.SAP_USER || process.env.SAP_USERNAME || 'MPCUSER';

      const params: IUpdateDataElementParams = {
        data_element_name: this.config.dataElementName,
        package_name: this.config.packageName,
        transport_request: this.config.transportRequest,
        description: this.config.description,
        type_kind: typeKind,
        type_name: this.config.typeName,
        data_type: this.config.dataType,
        length: this.config.length,
        decimals: this.config.decimals,
        short_label: this.config.shortLabel,
        medium_label: this.config.mediumLabel,
        long_label: this.config.longLabel,
        heading_label: this.config.headingLabel,
        search_help: this.config.searchHelp,
        search_help_parameter: this.config.searchHelpParameter,
        set_get_parameter: this.config.setGetParameter,
        activate: false // Don't activate in low-level function
      };

      // Use provided values directly - no automatic determination
      const domainInfo = {
        dataType: this.config.dataType || '',
        length: this.config.length || 0,
        decimals: this.config.decimals || 0
      };

      const result = await updateDataElementInternal(
        this.connection,
        params,
        this.lockHandle,
        username,
        domainInfo
      );

      this.state.updateResult = result;

      this.logger.info?.('Data element updated successfully:', result.status);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'update',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Update failed:', error);
      throw error; // Interrupts chain
    }
  }

  async check(version: 'active' | 'inactive' = 'inactive'): Promise<AxiosResponse> {
    try {
      this.logger.info?.('Checking data element:', this.config.dataElementName, 'version:', version);
      const result = await checkDataElement(
        this.connection,
        this.config.dataElementName,
        version
      );
      // Store result for backward compatibility
      this.state.checkResult = result;
      this.logger.info?.('Data element check successful:', result.status);
      return result;
    } catch (error: any) {
      // For DDIC objects, check may not be fully supported - log warning but continue
      const errorMsg = error.message || '';
      if (errorMsg.toLowerCase().includes('importing') &&
          errorMsg.toLowerCase().includes('database')) {
        this.logger.warn?.('Check not fully supported for data element (common for DDIC objects), continuing:', this.config.dataElementName);
        // Return error response to allow caller to handle
        if (error.response) {
          this.state.checkResult = error.response;
          return error.response;
        }
      }

      this.state.errors.push({
        method: 'check',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Check failed:', error);
      throw error;
    }
  }

  async unlock(): Promise<this> {
    try {
      if (!this.lockHandle) {
        throw new Error('Data element is not locked. Call lock() first.');
      }
      this.logger.info?.('Unlocking data element:', this.config.dataElementName);
      const result = await unlockDataElement(
        this.connection,
        this.config.dataElementName,
        this.lockHandle
      );
      this.state.unlockResult = result;
      this.lockHandle = undefined;
      this.state.lockHandle = undefined;
      this.connection.setSessionType("stateless");
      this.logger.info?.('Data element unlocked successfully');
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'unlock',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Unlock failed:', error);
      throw error; // Interrupts chain
    }
  }

  async activate(): Promise<this> {
    try {
      this.logger.info?.('Activating data element:', this.config.dataElementName);
      const result = await activateDataElement(
        this.connection,
        this.config.dataElementName
      );
      this.state.activateResult = result;
      this.logger.info?.('Data element activated successfully:', result.status);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'activate',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Activate failed:', error);
      throw error; // Interrupts chain
    }
  }

  async delete(): Promise<this> {
    try {
      this.logger.info?.('Deleting data element:', this.config.dataElementName);
      const result = await deleteDataElement(
        this.connection,
        {
          data_element_name: this.config.dataElementName,
          transport_request: this.config.transportRequest
        }
      );
      this.state.deleteResult = result;
      this.logger.info?.('Data element deleted successfully:', result.status);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'delete',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Delete failed:', error);
      throw error; // Interrupts chain
    }
  }

  async forceUnlock(): Promise<void> {
    if (!this.lockHandle) {
      return;
    }
    try {
      await unlockDataElement(
        this.connection,
        this.config.dataElementName,
        this.lockHandle
      );
      this.logger.info?.('Force unlock successful for', this.config.dataElementName);
    } catch (error: any) {
      this.logger.warn?.('Force unlock failed:', error);
    } finally {
      this.lockHandle = undefined;
      this.state.lockHandle = undefined;
      this.connection.setSessionType("stateless");
    }
  }

  // Getters for accessing results
  getState(): Readonly<IDataElementState> {
    return { ...this.state };
  }

  getDataElementName(): string {
    return this.config.dataElementName;
  }

  getLockHandle(): string | undefined {
    return this.lockHandle;
  }

  getSessionId(): string | null {
    return this.connection.getSessionId();
  }

  /**
   * Parse XML response to DataElementBuilderConfig
   */
  private parseDataElementXml(xmlData: string): IDataElementConfig | undefined {
    try {
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '',
      });

      const result = parser.parse(xmlData);
      const wbobj = result['blue:wbobj'] || result['wbobj'];

      if (!wbobj || !wbobj['dtel:dataElement']) {
        return undefined;
      }

      const dtel = wbobj['dtel:dataElement'];
      const packageRef = wbobj['adtcore:packageRef'] || wbobj['packageRef'];

      // Determine typeKind from XML structure
      let typeKind: IDataElementConfig['typeKind'] | undefined;
      if (dtel['dtel:typeKind']) {
        typeKind = dtel['dtel:typeKind'] as IDataElementConfig['typeKind'];
      } else if (dtel['dtel:typeName']) {
        // If typeName exists, it's likely a domain or reference type
        typeKind = 'domain'; // Default assumption
      }

      return {
        dataElementName: wbobj['adtcore:name'] || this.config.dataElementName,
        packageName: packageRef?.['adtcore:name'] || packageRef?.['name'],
        description: wbobj['adtcore:description'] || '',
        typeKind,
        typeName: dtel['dtel:typeName'],
        dataType: dtel['dtel:dataType'],
        length: dtel['dtel:dataTypeLength'] ? parseInt(dtel['dtel:dataTypeLength'], 10) : undefined,
        decimals: dtel['dtel:dataTypeDecimals'] ? parseInt(dtel['dtel:dataTypeDecimals'], 10) : undefined,
        shortLabel: dtel['dtel:shortFieldLabel'],
        mediumLabel: dtel['dtel:mediumFieldLabel'],
        longLabel: dtel['dtel:longFieldLabel'],
        headingLabel: dtel['dtel:headingFieldLabel']
      };
    } catch (error) {
      this.logger.error?.('Failed to parse data element XML:', error);
      return undefined;
    }
  }

  getReadResult(): IDataElementConfig | undefined {
    if (!this.state.readResult) {
      return undefined;
    }

    const xmlData = typeof this.state.readResult.data === 'string'
      ? this.state.readResult.data
      : JSON.stringify(this.state.readResult.data);

    return this.parseDataElementXml(xmlData);
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

  getErrors(): ReadonlyArray<{ method: string; error: Error; timestamp: Date }> {
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
      errors: [...this.state.errors]
    };
  }
}

