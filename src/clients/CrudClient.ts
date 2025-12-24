/**
 * CrudClient - Full CRUD operations for SAP ADT
 *
 * Extends ReadOnlyClient with Create, Update, Lock, Unlock, Activate, Check, Validate operations.
 * Methods return `this` for chaining. Results stored in state and accessible via getters.
 */

import type { IAdtResponse as AxiosResponse } from '@mcp-abap-adt/interfaces';
import {
  BehaviorDefinitionBuilder,
  type IBehaviorDefinitionConfig,
} from '../core/behaviorDefinition';
import {
  BehaviorImplementationBuilder,
  type IBehaviorImplementationConfig,
} from '../core/behaviorImplementation';
import {
  ClassBuilder,
  type ClassUnitTestDefinition,
  type ClassUnitTestRunOptions,
  getClassUnitTestResult,
  getClassUnitTestStatus,
  type IClassBuilderConfig,
  startClassUnitTestRun,
} from '../core/class';
import {
  DataElementBuilder,
  type IDataElementConfig,
} from '../core/dataElement';
import { DomainBuilder, type IDomainConfig } from '../core/domain';
import {
  FunctionGroupBuilder,
  type IFunctionGroupConfig,
} from '../core/functionGroup';
import {
  FunctionModuleBuilder,
  type IFunctionModuleConfig,
} from '../core/functionModule';
import { type IInterfaceConfig, InterfaceBuilder } from '../core/interface';
import {
  type IMetadataExtensionConfig,
  MetadataExtensionBuilder,
} from '../core/metadataExtension';
import { type IPackageConfig, PackageBuilder } from '../core/package';
import { type IProgramConfig, ProgramBuilder } from '../core/program';
import {
  type IServiceDefinitionConfig,
  ServiceDefinitionBuilder,
} from '../core/serviceDefinition';
import { type IStructureConfig, StructureBuilder } from '../core/structure';
import { type ITableConfig, TableBuilder } from '../core/table';
import { TransportBuilder } from '../core/transport';
import { type IViewConfig, ViewBuilder } from '../core/view';
import { headerValueToString } from '../utils/internalUtils';
import { ReadOnlyClient } from './ReadOnlyClient';

interface CrudClientState {
  createResult?: AxiosResponse;
  lockHandle?: string;
  unlockResult?: AxiosResponse;
  updateResult?: AxiosResponse;
  testClassUpdateResult?: AxiosResponse;
  testClassLockHandle?: string;
  testClassActivateResult?: AxiosResponse;
  abapUnitRunResponse?: AxiosResponse;
  abapUnitRunStatus?: AxiosResponse;
  abapUnitRunResult?: AxiosResponse;
  abapUnitRunId?: string;
  activateResult?: AxiosResponse;
  deleteResult?: AxiosResponse;
  checkResult?: AxiosResponse;
  validationResponse?: AxiosResponse;
  // Builders - one per object type, reused across operations (one session per client)
  domainBuilder?: DomainBuilder;
  currentDomainName?: string;
  classBuilder?: ClassBuilder;
  currentClassName?: string;
  interfaceBuilder?: InterfaceBuilder;
  currentInterfaceName?: string;
  programBuilder?: ProgramBuilder;
  currentProgramName?: string;
  dataElementBuilder?: DataElementBuilder;
  currentDataElementName?: string;
  structureBuilder?: StructureBuilder;
  currentStructureName?: string;
  tableBuilder?: TableBuilder;
  currentTableName?: string;
  viewBuilder?: ViewBuilder;
  currentViewName?: string;
  functionModuleBuilder?: FunctionModuleBuilder;
  currentFunctionModuleName?: string;
  functionGroupBuilder?: FunctionGroupBuilder;
  currentFunctionGroupName?: string;
  packageBuilder?: PackageBuilder;
  currentPackageName?: string;
  serviceDefinitionBuilder?: ServiceDefinitionBuilder;
  currentServiceDefinitionName?: string;
  // Note: readResult is in ReadOnlyClient's separate private state
}

export class CrudClient extends ReadOnlyClient {
  private crudState: CrudClientState = {};

  // State getters (readResult inherited from ReadOnlyClient)
  getCreateResult(): AxiosResponse | undefined {
    return this.crudState.createResult;
  }
  getLockHandle(): string | undefined {
    return this.crudState.lockHandle;
  }
  getUnlockResult(): AxiosResponse | undefined {
    return this.crudState.unlockResult;
  }
  getUpdateResult(): AxiosResponse | undefined {
    return this.crudState.updateResult;
  }
  getTestClassUpdateResult(): AxiosResponse | undefined {
    return this.crudState.testClassUpdateResult;
  }
  getTestClassLockHandle(): string | undefined {
    return this.crudState.testClassLockHandle;
  }
  getTestClassActivateResult(): AxiosResponse | undefined {
    return this.crudState.testClassActivateResult;
  }
  getAbapUnitRunResponse(): AxiosResponse | undefined {
    return this.crudState.abapUnitRunResponse;
  }
  getAbapUnitRunId(): string | undefined {
    return this.crudState.abapUnitRunId;
  }
  getAbapUnitStatusResponse(): AxiosResponse | undefined {
    return this.crudState.abapUnitRunStatus;
  }
  getAbapUnitResultResponse(): AxiosResponse | undefined {
    return this.crudState.abapUnitRunResult;
  }
  getActivateResult(): AxiosResponse | undefined {
    return this.crudState.activateResult;
  }
  getDeleteResult(): AxiosResponse | undefined {
    return this.crudState.deleteResult;
  }
  getCheckResult(): AxiosResponse | undefined {
    return this.crudState.checkResult;
  }
  getValidationResponse(): AxiosResponse | undefined {
    return this.crudState.validationResponse;
  }

  // ==================== Program operations ====================

  private getProgramBuilder(
    config: Partial<IProgramConfig> & Pick<IProgramConfig, 'programName'>,
  ): ProgramBuilder {
    // Reuse existing builder if it's for the same program (same session)
    if (
      this.crudState.programBuilder &&
      this.crudState.currentProgramName === config.programName
    ) {
      // Update transportRequest if provided in config
      if (config.transportRequest !== undefined) {
        this.crudState.programBuilder.setRequest(config.transportRequest);
      }
      return this.crudState.programBuilder;
    }
    // Create new builder for new program
    this.crudState.programBuilder = new ProgramBuilder(
      this.connection,
      { ...config, description: config.description || '' },
      this.logger,
    );
    this.crudState.currentProgramName = config.programName;
    return this.crudState.programBuilder;
  }

  async createProgram(
    config: Partial<IProgramConfig> &
      Pick<IProgramConfig, 'programName' | 'packageName' | 'description'>,
  ): Promise<this> {
    const builder = this.getProgramBuilder(config);
    await builder.create();
    this.crudState.createResult = builder.getState().createResult;
    return this;
  }

  async lockProgram(
    config: Pick<IProgramConfig, 'programName'>,
  ): Promise<this> {
    const builder = this.getProgramBuilder(config);
    await builder.lock();
    this.crudState.lockHandle = builder.getState().lockHandle;
    return this;
  }

  async unlockProgram(
    config: Pick<IProgramConfig, 'programName'>,
    lockHandle?: string,
  ): Promise<this> {
    const builder = this.getProgramBuilder(config);
    (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    await builder.unlock();
    this.crudState.unlockResult = builder.getState().unlockResult;
    this.crudState.lockHandle = undefined;
    return this;
  }

  async updateProgram(
    config: Partial<IProgramConfig> &
      Pick<IProgramConfig, 'programName' | 'sourceCode'>,
    lockHandle?: string,
  ): Promise<this> {
    const builder = this.getProgramBuilder(config);
    // Set sourceCode if provided
    if (config.sourceCode) {
      (builder as any).sourceCode = config.sourceCode;
    }
    (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    await builder.update();
    this.crudState.updateResult = builder.getState().updateResult;
    return this;
  }

  async activateProgram(
    config: Pick<IProgramConfig, 'programName'>,
  ): Promise<this> {
    const builder = this.getProgramBuilder(config);
    await builder.activate();
    this.crudState.activateResult = builder.getState().activateResult;
    return this;
  }

  async checkProgram(
    config: Pick<IProgramConfig, 'programName'>,
    version?: 'active' | 'inactive',
    sourceCode?: string,
  ): Promise<AxiosResponse> {
    const builder = this.getProgramBuilder(config);
    const result = await builder.check(version, sourceCode);
    this.crudState.checkResult = result;
    return result;
  }

  async validateProgram(
    config: Partial<IProgramConfig> &
      Pick<IProgramConfig, 'programName' | 'packageName' | 'description'>,
  ): Promise<AxiosResponse> {
    const builder = this.getProgramBuilder(config);
    const result = await builder.validate();
    this.crudState.validationResponse = result;
    return result;
  }

  async deleteProgram(
    config: Pick<IProgramConfig, 'programName' | 'transportRequest'>,
  ): Promise<this> {
    const builder = this.getProgramBuilder(config);
    await builder.delete();
    this.crudState.deleteResult = builder.getState().deleteResult;
    // Clear builder after delete
    if (this.crudState.currentProgramName === config.programName) {
      this.crudState.programBuilder = undefined;
      this.crudState.currentProgramName = undefined;
    }
    return this;
  }

  // ==================== Class operations ====================

  private getClassBuilder(
    config: Partial<IClassBuilderConfig> &
      Pick<IClassBuilderConfig, 'className'>,
  ): ClassBuilder {
    // Reuse existing builder if it's for the same class (same session)
    if (
      this.crudState.classBuilder &&
      this.crudState.currentClassName === config.className
    ) {
      // Update transportRequest if provided in config
      if (config.transportRequest !== undefined) {
        this.crudState.classBuilder.setRequest(config.transportRequest);
      }
      return this.crudState.classBuilder;
    }
    // Create new builder for new class
    this.crudState.classBuilder = new ClassBuilder(
      this.connection,
      { ...config, description: config.description || '' },
      this.logger,
    );
    this.crudState.currentClassName = config.className;
    return this.crudState.classBuilder;
  }

  async createClass(
    config: Partial<IClassBuilderConfig> &
      Pick<IClassBuilderConfig, 'className' | 'packageName' | 'description'>,
  ): Promise<this> {
    const builder = this.getClassBuilder(config);
    await builder.create();
    this.crudState.createResult = builder.getState().createResult;
    return this;
  }

  async lockClass(
    config: Pick<IClassBuilderConfig, 'className'>,
  ): Promise<this> {
    const builder = this.getClassBuilder(config);
    await builder.lock();
    this.crudState.lockHandle = builder.getState().lockHandle;
    return this;
  }

  async unlockClass(
    config: Pick<IClassBuilderConfig, 'className'>,
    lockHandle?: string,
  ): Promise<this> {
    const builder = this.getClassBuilder(config);
    (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    await builder.unlock();
    this.crudState.unlockResult = builder.getState().unlockResult;
    this.crudState.lockHandle = undefined;
    return this;
  }

  async updateClass(
    config: Partial<IClassBuilderConfig> &
      Pick<IClassBuilderConfig, 'className' | 'sourceCode'>,
    lockHandle?: string,
  ): Promise<this> {
    const builder = this.getClassBuilder(config);
    // Set sourceCode if provided
    if (config.sourceCode) {
      (builder as any).sourceCode = config.sourceCode;
    }
    (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    await builder.update();
    this.crudState.updateResult = builder.getState().updateResult;
    return this;
  }

  async updateClassTestIncludes(
    config: Partial<IClassBuilderConfig> &
      Pick<IClassBuilderConfig, 'className' | 'testClassCode'>,
    lockHandle?: string,
  ): Promise<this> {
    const builder = this.getClassBuilder(config);
    if (config.testClassCode) {
      builder.setTestClassCode(config.testClassCode);
    }
    if (lockHandle || this.crudState.testClassLockHandle) {
      (builder as any).testLockHandle =
        lockHandle || this.crudState.testClassLockHandle;
    } else {
      await builder.lockTestClasses();
      this.crudState.testClassLockHandle = builder.getState().testLockHandle;
    }
    await builder.updateTestClasses();
    this.crudState.testClassUpdateResult = builder.getState().testClassesResult;
    return this;
  }

  async updateClassLocalTypes(
    config: Partial<IClassBuilderConfig> &
      Pick<IClassBuilderConfig, 'className' | 'localTypesCode'>,
    lockHandle?: string,
  ): Promise<this> {
    const builder = this.getClassBuilder(config);
    if (config.localTypesCode) {
      builder.setLocalTypesCode(config.localTypesCode);
    }
    if (lockHandle || this.crudState.lockHandle) {
      (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    }
    await builder.updateLocalTypes();
    return this;
  }

  async updateClassDefinitions(
    config: Partial<IClassBuilderConfig> &
      Pick<IClassBuilderConfig, 'className' | 'definitionsCode'>,
    lockHandle?: string,
  ): Promise<this> {
    const builder = this.getClassBuilder(config);
    if (config.definitionsCode) {
      builder.setDefinitionsCode(config.definitionsCode);
    }
    if (lockHandle || this.crudState.lockHandle) {
      (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    }
    await builder.updateDefinitions();
    return this;
  }

  async updateClassMacros(
    config: Partial<IClassBuilderConfig> &
      Pick<IClassBuilderConfig, 'className' | 'macrosCode'>,
    lockHandle?: string,
  ): Promise<this> {
    const builder = this.getClassBuilder(config);
    if (config.macrosCode) {
      builder.setMacrosCode(config.macrosCode);
    }
    if (lockHandle || this.crudState.lockHandle) {
      (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    }
    await builder.updateMacros();
    return this;
  }

  async lockTestClasses(
    config: Pick<IClassBuilderConfig, 'className'>,
  ): Promise<this> {
    const builder = this.getClassBuilder(config);
    await builder.lockTestClasses();
    this.crudState.testClassLockHandle = builder.getState().testLockHandle;
    return this;
  }

  async unlockTestClasses(
    config: Pick<IClassBuilderConfig, 'className'>,
    lockHandle?: string,
  ): Promise<this> {
    const builder = this.getClassBuilder(config);
    (builder as any).testLockHandle =
      lockHandle || this.crudState.testClassLockHandle;
    await builder.unlockTestClasses();
    this.crudState.testClassLockHandle = undefined;
    return this;
  }

  async activateTestClasses(
    config: Partial<IClassBuilderConfig> &
      Pick<IClassBuilderConfig, 'className' | 'testClassName'>,
  ): Promise<this> {
    const builder = this.getClassBuilder(config);
    if (config.testClassName) {
      builder.setTestClassName(config.testClassName);
    }
    await builder.activateTestClasses();
    this.crudState.testClassActivateResult =
      builder.getState().testActivateResult;
    return this;
  }

  async activateClass(
    config: Pick<IClassBuilderConfig, 'className'>,
  ): Promise<this> {
    const builder = this.getClassBuilder(config);
    await builder.activate();
    this.crudState.activateResult = builder.getState().activateResult;
    return this;
  }

  async checkClass(
    config: Pick<IClassBuilderConfig, 'className'>,
    version?: 'active' | 'inactive',
    sourceCode?: string,
  ): Promise<AxiosResponse> {
    const builder = this.getClassBuilder(config);
    const result = await builder.check(version, sourceCode);
    this.crudState.checkResult = result;
    return result;
  }

  async checkClassTestClass(
    config: Pick<IClassBuilderConfig, 'className' | 'testClassCode'>,
  ): Promise<this> {
    const builder = this.getClassBuilder(config);
    await builder.checkTestClass(config.testClassCode);
    return this;
  }

  async checkClassLocalTypes(
    config: Pick<IClassBuilderConfig, 'className' | 'localTypesCode'>,
  ): Promise<this> {
    const builder = this.getClassBuilder(config);
    await builder.checkLocalTypes(config.localTypesCode);
    return this;
  }

  async checkClassDefinitions(
    config: Pick<IClassBuilderConfig, 'className' | 'definitionsCode'>,
  ): Promise<this> {
    const builder = this.getClassBuilder(config);
    await builder.checkDefinitions(config.definitionsCode);
    return this;
  }

  async checkClassMacros(
    config: Pick<IClassBuilderConfig, 'className' | 'macrosCode'>,
  ): Promise<this> {
    const builder = this.getClassBuilder(config);
    await builder.checkMacros(config.macrosCode);
    return this;
  }

  async validateClass(
    config: Partial<IClassBuilderConfig> &
      Pick<IClassBuilderConfig, 'className' | 'packageName' | 'description'>,
  ): Promise<AxiosResponse> {
    const builder = this.getClassBuilder(config);
    const result = await builder.validate();
    this.crudState.validationResponse = result;
    return result;
  }

  async deleteClass(
    config: Pick<IClassBuilderConfig, 'className' | 'transportRequest'>,
  ): Promise<this> {
    const builder = this.getClassBuilder(config);
    await builder.delete();
    this.crudState.deleteResult = builder.getState().deleteResult;
    // Clear builder after delete
    if (this.crudState.currentClassName === config.className) {
      this.crudState.classBuilder = undefined;
      this.crudState.currentClassName = undefined;
    }
    return this;
  }

  async runClassUnitTests(
    tests: ClassUnitTestDefinition[],
    options?: ClassUnitTestRunOptions,
  ): Promise<this> {
    const response = await startClassUnitTestRun(
      this.connection,
      tests,
      options,
    );
    this.crudState.abapUnitRunResponse = response;
    const location =
      headerValueToString(response.headers?.location) ||
      headerValueToString(response.headers?.['content-location']) ||
      headerValueToString(response.headers?.['sap-adt-location']);
    if (location) {
      const runId = location.split('/').pop();
      if (runId) {
        this.crudState.abapUnitRunId = runId;
      }
    }
    return this;
  }

  async getClassUnitTestRunStatus(
    runId: string,
    withLongPolling: boolean = true,
  ): Promise<this> {
    const response = await getClassUnitTestStatus(
      this.connection,
      runId,
      withLongPolling,
    );
    this.crudState.abapUnitRunStatus = response;
    return this;
  }

  async getClassUnitTestRunResult(
    runId: string,
    options?: { withNavigationUris?: boolean; format?: 'abapunit' | 'junit' },
  ): Promise<this> {
    const response = await getClassUnitTestResult(
      this.connection,
      runId,
      options,
    );
    this.crudState.abapUnitRunResult = response;
    return this;
  }

  // ==================== Interface operations ====================

  private getInterfaceBuilder(
    config: Partial<IInterfaceConfig> & Pick<IInterfaceConfig, 'interfaceName'>,
  ): InterfaceBuilder {
    // Reuse existing builder if it's for the same interface (same session)
    if (
      this.crudState.interfaceBuilder &&
      this.crudState.currentInterfaceName === config.interfaceName
    ) {
      // Update transportRequest if provided in config
      if (config.transportRequest !== undefined) {
        this.crudState.interfaceBuilder.setRequest(config.transportRequest);
      }
      return this.crudState.interfaceBuilder;
    }
    // Create new builder for new interface
    this.crudState.interfaceBuilder = new InterfaceBuilder(
      this.connection,
      { ...config, description: config.description || '' },
      this.logger,
    );
    this.crudState.currentInterfaceName = config.interfaceName;
    return this.crudState.interfaceBuilder;
  }

  async createInterface(
    config: Partial<IInterfaceConfig> &
      Pick<IInterfaceConfig, 'interfaceName' | 'packageName' | 'description'>,
  ): Promise<this> {
    const builder = this.getInterfaceBuilder(config);
    await builder.create();
    this.crudState.createResult = builder.getState().createResult;
    return this;
  }

  async lockInterface(
    config: Pick<IInterfaceConfig, 'interfaceName'>,
  ): Promise<this> {
    const builder = this.getInterfaceBuilder(config);
    await builder.lock();
    this.crudState.lockHandle = builder.getState().lockHandle;
    return this;
  }

  async unlockInterface(
    config: Pick<IInterfaceConfig, 'interfaceName'>,
    lockHandle?: string,
  ): Promise<this> {
    const builder = this.getInterfaceBuilder(config);
    (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    await builder.unlock();
    this.crudState.unlockResult = builder.getState().unlockResult;
    this.crudState.lockHandle = undefined;
    return this;
  }

  async updateInterface(
    config: Partial<IInterfaceConfig> &
      Pick<IInterfaceConfig, 'interfaceName' | 'sourceCode'>,
    lockHandle?: string,
  ): Promise<this> {
    const builder = this.getInterfaceBuilder(config);
    // Set sourceCode if provided
    if (config.sourceCode) {
      (builder as any).sourceCode = config.sourceCode;
    }
    (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    await builder.update();
    this.crudState.updateResult = builder.getState().updateResult;
    return this;
  }

  async activateInterface(
    config: Pick<IInterfaceConfig, 'interfaceName'>,
  ): Promise<this> {
    const builder = this.getInterfaceBuilder(config);
    await builder.activate();
    this.crudState.activateResult = builder.getState().activateResult;
    return this;
  }

  async checkInterface(
    config: Pick<IInterfaceConfig, 'interfaceName'>,
    sourceCode?: string,
    version: 'active' | 'inactive' = 'inactive',
  ): Promise<AxiosResponse> {
    const builder = this.getInterfaceBuilder(config);
    const result = await builder.check(version, sourceCode);
    this.crudState.checkResult = result;
    return result;
  }

  async validateInterface(
    config: Partial<IInterfaceConfig> &
      Pick<IInterfaceConfig, 'interfaceName' | 'packageName' | 'description'>,
  ): Promise<AxiosResponse> {
    const builder = this.getInterfaceBuilder(config);
    const result = await builder.validate();
    this.crudState.validationResponse = result;
    return result;
  }

  async deleteInterface(
    config: Pick<IInterfaceConfig, 'interfaceName' | 'transportRequest'>,
  ): Promise<this> {
    const builder = this.getInterfaceBuilder(config);
    await builder.delete();
    this.crudState.deleteResult = builder.getState().deleteResult;
    // Clear builder after delete
    if (this.crudState.currentInterfaceName === config.interfaceName) {
      this.crudState.interfaceBuilder = undefined;
      this.crudState.currentInterfaceName = undefined;
    }
    return this;
  }

  // ==================== FunctionModule operations ====================

  private getFunctionModuleBuilder(
    config: Partial<IFunctionModuleConfig> &
      Pick<IFunctionModuleConfig, 'functionModuleName' | 'functionGroupName'>,
  ): FunctionModuleBuilder {
    // Reuse existing builder if it's for the same function module (same session)
    const key = `${config.functionGroupName}/${config.functionModuleName}`;
    if (
      this.crudState.functionModuleBuilder &&
      this.crudState.currentFunctionModuleName === key
    ) {
      // Update transportRequest if provided in config
      if (config.transportRequest !== undefined) {
        this.crudState.functionModuleBuilder.setRequest(
          config.transportRequest,
        );
      }
      return this.crudState.functionModuleBuilder;
    }
    // Create new builder for new function module
    this.crudState.functionModuleBuilder = new FunctionModuleBuilder(
      this.connection,
      { ...config, description: config.description || '' },
      this.logger,
    );
    this.crudState.currentFunctionModuleName = key;
    return this.crudState.functionModuleBuilder;
  }

  async createFunctionModule(
    config: Partial<IFunctionModuleConfig> &
      Pick<
        IFunctionModuleConfig,
        | 'functionModuleName'
        | 'functionGroupName'
        | 'packageName'
        | 'description'
        | 'sourceCode'
      >,
  ): Promise<this> {
    const builder = this.getFunctionModuleBuilder(config);
    await builder.create();
    this.crudState.createResult = builder.getState().createResult;
    return this;
  }

  async lockFunctionModule(
    config: Pick<
      IFunctionModuleConfig,
      'functionModuleName' | 'functionGroupName'
    >,
  ): Promise<this> {
    const builder = this.getFunctionModuleBuilder(config);
    await builder.lock();
    this.crudState.lockHandle = builder.getState().lockHandle;
    return this;
  }

  async unlockFunctionModule(
    config: Pick<
      IFunctionModuleConfig,
      'functionModuleName' | 'functionGroupName'
    >,
    lockHandle?: string,
  ): Promise<this> {
    const builder = this.getFunctionModuleBuilder(config);
    (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    await builder.unlock();
    this.crudState.unlockResult = builder.getState().unlockResult;
    this.crudState.lockHandle = undefined;
    return this;
  }

  async updateFunctionModule(
    config: Partial<IFunctionModuleConfig> &
      Pick<
        IFunctionModuleConfig,
        'functionModuleName' | 'functionGroupName' | 'sourceCode'
      >,
    lockHandle?: string,
  ): Promise<this> {
    const builder = this.getFunctionModuleBuilder(config);
    // Set sourceCode if provided
    if (config.sourceCode) {
      (builder as any).sourceCode = config.sourceCode;
    }
    (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    await builder.update();
    this.crudState.updateResult = builder.getState().updateResult;
    return this;
  }

  async activateFunctionModule(
    config: Pick<
      IFunctionModuleConfig,
      'functionModuleName' | 'functionGroupName'
    >,
  ): Promise<this> {
    const builder = this.getFunctionModuleBuilder(config);
    await builder.activate();
    this.crudState.activateResult = builder.getState().activateResult;
    return this;
  }

  async checkFunctionModule(
    config: Pick<
      IFunctionModuleConfig,
      'functionModuleName' | 'functionGroupName'
    >,
    version?: 'active' | 'inactive',
    sourceCode?: string,
  ): Promise<AxiosResponse> {
    const builder = this.getFunctionModuleBuilder(config);
    const result = await builder.check(version, sourceCode);
    this.crudState.checkResult = result;
    return result;
  }

  async validateFunctionModule(
    config: Partial<IFunctionModuleConfig> &
      Pick<
        IFunctionModuleConfig,
        | 'functionModuleName'
        | 'functionGroupName'
        | 'packageName'
        | 'description'
      >,
  ): Promise<AxiosResponse> {
    const builder = this.getFunctionModuleBuilder(config);
    const result = await builder.validate();
    this.crudState.validationResponse = result;
    return result;
  }

  async deleteFunctionModule(
    config: Pick<
      IFunctionModuleConfig,
      'functionModuleName' | 'functionGroupName' | 'transportRequest'
    >,
  ): Promise<this> {
    const builder = this.getFunctionModuleBuilder(config);
    await builder.delete();
    this.crudState.deleteResult = builder.getState().deleteResult;
    // Clear builder after delete
    const key = `${config.functionGroupName}/${config.functionModuleName}`;
    if (this.crudState.currentFunctionModuleName === key) {
      this.crudState.functionModuleBuilder = undefined;
      this.crudState.currentFunctionModuleName = undefined;
    }
    return this;
  }

  // ==================== FunctionGroup operations ====================

  async createFunctionGroup(
    config: Partial<IFunctionGroupConfig> &
      Pick<
        IFunctionGroupConfig,
        'functionGroupName' | 'packageName' | 'description'
      >,
  ): Promise<this> {
    const builder = new FunctionGroupBuilder(
      this.connection,
      config,
      this.logger,
    );
    await builder.create();
    this.crudState.createResult = builder.getState().createResult;
    return this;
  }

  async lockFunctionGroup(
    config: Partial<IFunctionGroupConfig> &
      Pick<IFunctionGroupConfig, 'functionGroupName'>,
  ): Promise<this> {
    const builder = new FunctionGroupBuilder(
      this.connection,
      { ...config, description: config.description || '' },
      this.logger,
    );
    await builder.lock();
    this.crudState.lockHandle = builder.getState().lockHandle;
    return this;
  }

  async unlockFunctionGroup(
    config: Partial<IFunctionGroupConfig> &
      Pick<IFunctionGroupConfig, 'functionGroupName'>,
    lockHandle?: string,
  ): Promise<this> {
    const builder = new FunctionGroupBuilder(
      this.connection,
      { ...config, description: config.description || '' },
      this.logger,
    );
    (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    await builder.unlock();
    this.crudState.unlockResult = builder.getState().unlockResult;
    this.crudState.lockHandle = undefined;
    return this;
  }

  async activateFunctionGroup(
    config: Partial<IFunctionGroupConfig> &
      Pick<IFunctionGroupConfig, 'functionGroupName'>,
  ): Promise<this> {
    const builder = new FunctionGroupBuilder(
      this.connection,
      { ...config, description: config.description || '' },
      this.logger,
    );
    await builder.activate();
    this.crudState.activateResult = builder.getState().activateResult;
    return this;
  }

  async checkFunctionGroup(
    config: Partial<IFunctionGroupConfig> &
      Pick<IFunctionGroupConfig, 'functionGroupName'>,
  ): Promise<AxiosResponse> {
    const builder = new FunctionGroupBuilder(
      this.connection,
      { ...config, description: config.description || '' },
      this.logger,
    );
    const result = await builder.check();
    this.crudState.checkResult = result;
    return result;
  }

  async validateFunctionGroup(
    config: Partial<IFunctionGroupConfig> &
      Pick<IFunctionGroupConfig, 'functionGroupName' | 'description'>,
  ): Promise<AxiosResponse> {
    // packageName is required for validation to work correctly
    // Without it, SAP ADT returns "Resource FUGR_MAINPROGRAM: wrong input data"
    const builder = new FunctionGroupBuilder(this.connection, {
      ...config,
      description: config.description,
      packageName: config.packageName, // Ensure packageName is passed to builder
    });
    const result = await builder.validate();
    this.crudState.validationResponse = result;
    return result;
  }

  async deleteFunctionGroup(
    config: Partial<IFunctionGroupConfig> &
      Pick<IFunctionGroupConfig, 'functionGroupName'>,
  ): Promise<this> {
    const builder = new FunctionGroupBuilder(
      this.connection,
      {
        ...config,
        description: config.description || '',
        transportRequest: config.transportRequest,
      },
      this.logger,
    );
    await builder.delete();
    this.crudState.deleteResult = builder.getState().deleteResult;
    return this;
  }

  // ==================== DataElement operations ====================

  private getDataElementBuilder(
    config: Partial<IDataElementConfig> &
      Pick<IDataElementConfig, 'dataElementName'>,
  ): DataElementBuilder {
    // Reuse existing builder if it's for the same data element (same session)
    if (
      this.crudState.dataElementBuilder &&
      this.crudState.currentDataElementName === config.dataElementName
    ) {
      // Update config using individual setters
      const builder = this.crudState.dataElementBuilder;
      if (config.packageName) builder.setPackage(config.packageName);
      if (config.description !== undefined)
        builder.setDescription(config.description);
      if (config.dataType !== undefined) builder.setDataType(config.dataType);
      if (config.length !== undefined) builder.setLength(config.length);
      if (config.decimals !== undefined) builder.setDecimals(config.decimals);
      if (config.shortLabel !== undefined)
        builder.setShortLabel(config.shortLabel);
      if (config.mediumLabel !== undefined)
        builder.setMediumLabel(config.mediumLabel);
      if (config.longLabel !== undefined)
        builder.setLongLabel(config.longLabel);
      if (config.headingLabel !== undefined)
        builder.setHeadingLabel(config.headingLabel);
      if (config.typeKind !== undefined) builder.setTypeKind(config.typeKind);
      if (config.typeName !== undefined) builder.setTypeName(config.typeName);
      if (config.transportRequest !== undefined)
        builder.setRequest(config.transportRequest);
      return builder;
    }
    // Create new builder for new data element
    this.crudState.dataElementBuilder = new DataElementBuilder(
      this.connection,
      { ...config, description: config.description || '' },
      this.logger,
    );
    this.crudState.currentDataElementName = config.dataElementName;
    return this.crudState.dataElementBuilder;
  }

  async createDataElement(
    config: Partial<IDataElementConfig> &
      Pick<
        IDataElementConfig,
        'dataElementName' | 'packageName' | 'description' | 'typeKind'
      >,
  ): Promise<this> {
    const builder = this.getDataElementBuilder(config);
    // Ensure all config is set (especially typeKind which is required)
    if (config.typeKind) builder.setTypeKind(config.typeKind);
    if (config.packageName) builder.setPackage(config.packageName);
    if (config.description) builder.setDescription(config.description);
    if (config.dataType) builder.setDataType(config.dataType);
    if (config.typeName) builder.setTypeName(config.typeName);
    if (config.length !== undefined) builder.setLength(config.length);
    if (config.decimals !== undefined) builder.setDecimals(config.decimals);
    await builder.create();
    this.crudState.createResult = builder.getState().createResult;
    return this;
  }

  async lockDataElement(
    config: Pick<IDataElementConfig, 'dataElementName'>,
  ): Promise<this> {
    const builder = this.getDataElementBuilder(config);
    await builder.lock();
    this.crudState.lockHandle = builder.getState().lockHandle;
    return this;
  }

  async unlockDataElement(
    config: Pick<IDataElementConfig, 'dataElementName'>,
    lockHandle?: string,
  ): Promise<this> {
    const builder = this.getDataElementBuilder(config);
    (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    await builder.unlock();
    this.crudState.unlockResult = builder.getState().unlockResult;
    this.crudState.lockHandle = undefined;
    return this;
  }

  async updateDataElement(
    config: Partial<IDataElementConfig> &
      Pick<
        IDataElementConfig,
        'dataElementName' | 'packageName' | 'description'
      >,
    lockHandle?: string,
  ): Promise<this> {
    const builder = this.getDataElementBuilder(config);
    (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    await builder.update();
    this.crudState.updateResult = builder.getState().updateResult;
    return this;
  }

  async activateDataElement(
    config: Pick<IDataElementConfig, 'dataElementName'>,
  ): Promise<this> {
    const builder = this.getDataElementBuilder(config);
    await builder.activate();
    this.crudState.activateResult = builder.getState().activateResult;
    return this;
  }

  async checkDataElement(
    config: Pick<IDataElementConfig, 'dataElementName'>,
    version: 'active' | 'inactive' = 'inactive',
  ): Promise<AxiosResponse> {
    const builder = this.getDataElementBuilder(config);
    const result = await builder.check(version);
    this.crudState.checkResult = result;
    return result;
  }

  async validateDataElement(
    config: Partial<IDataElementConfig> &
      Pick<
        IDataElementConfig,
        'dataElementName' | 'packageName' | 'description'
      >,
  ): Promise<AxiosResponse> {
    const builder = this.getDataElementBuilder(config);
    const result = await builder.validate();
    this.crudState.validationResponse = result;
    return result;
  }

  async deleteDataElement(
    config: Pick<IDataElementConfig, 'dataElementName' | 'transportRequest'>,
  ): Promise<this> {
    const builder = this.getDataElementBuilder(config);
    await builder.delete();
    this.crudState.deleteResult = builder.getState().deleteResult;
    // Clear builder after delete
    if (this.crudState.currentDataElementName === config.dataElementName) {
      this.crudState.dataElementBuilder = undefined;
      this.crudState.currentDataElementName = undefined;
    }
    return this;
  }

  // ==================== Domain operations ====================

  private getDomainBuilder(
    config: Partial<IDomainConfig> & Pick<IDomainConfig, 'domainName'>,
  ): DomainBuilder {
    // Reuse existing builder if it's for the same domain (same session)
    if (
      this.crudState.domainBuilder &&
      this.crudState.currentDomainName === config.domainName
    ) {
      // Update transportRequest if provided in config
      if (config.transportRequest !== undefined) {
        this.crudState.domainBuilder.setRequest(config.transportRequest);
      }
      return this.crudState.domainBuilder;
    }
    // Create new builder for new domain
    this.crudState.domainBuilder = new DomainBuilder(
      this.connection,
      { ...config, description: config.description || '' },
      this.logger,
    );
    this.crudState.currentDomainName = config.domainName;
    return this.crudState.domainBuilder;
  }

  async createDomain(
    config: Partial<IDomainConfig> &
      Pick<IDomainConfig, 'domainName' | 'packageName' | 'description'>,
  ): Promise<this> {
    const builder = this.getDomainBuilder(config);
    await builder.create();
    this.crudState.createResult = builder.getState().createResult;
    return this;
  }

  async lockDomain(config: Pick<IDomainConfig, 'domainName'>): Promise<this> {
    const builder = this.getDomainBuilder(config);
    await builder.lock();
    this.crudState.lockHandle = builder.getState().lockHandle;
    return this;
  }

  async unlockDomain(
    config: Pick<IDomainConfig, 'domainName'>,
    lockHandle?: string,
  ): Promise<this> {
    const builder = this.getDomainBuilder(config);
    (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    await builder.unlock();
    this.crudState.unlockResult = builder.getState().unlockResult;
    this.crudState.lockHandle = undefined;
    return this;
  }

  async updateDomain(
    config: Partial<IDomainConfig> &
      Pick<IDomainConfig, 'domainName' | 'packageName' | 'description'>,
    lockHandle?: string,
  ): Promise<this> {
    const builder = this.getDomainBuilder(config);
    (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    await builder.update();
    this.crudState.updateResult = builder.getState().updateResult;
    return this;
  }

  async activateDomain(
    config: Pick<IDomainConfig, 'domainName'>,
  ): Promise<this> {
    const builder = this.getDomainBuilder(config);
    await builder.activate();
    this.crudState.activateResult = builder.getState().activateResult;
    return this;
  }

  async checkDomain(
    config: Pick<IDomainConfig, 'domainName'>,
    version: 'active' | 'inactive' = 'inactive',
  ): Promise<AxiosResponse> {
    const builder = this.getDomainBuilder(config);
    const result = await builder.check(version);
    this.crudState.checkResult = result;
    return result;
  }

  async validateDomain(
    config: Pick<IDomainConfig, 'domainName' | 'packageName' | 'description'>,
  ): Promise<AxiosResponse> {
    const builder = this.getDomainBuilder(config);
    const result = await builder.validate();
    this.crudState.validationResponse = result;
    return result;
  }

  async deleteDomain(
    config: Pick<IDomainConfig, 'domainName' | 'transportRequest'>,
  ): Promise<this> {
    const builder = this.getDomainBuilder(config);
    await builder.delete();
    this.crudState.deleteResult = builder.getState().deleteResult;
    // Clear builder after delete
    if (this.crudState.currentDomainName === config.domainName) {
      this.crudState.domainBuilder = undefined;
      this.crudState.currentDomainName = undefined;
    }
    return this;
  }

  // ==================== Structure operations ====================

  private getStructureBuilder(
    config: Partial<IStructureConfig> & Pick<IStructureConfig, 'structureName'>,
  ): StructureBuilder {
    // Reuse existing builder if it's for the same structure (same session)
    if (
      this.crudState.structureBuilder &&
      this.crudState.currentStructureName === config.structureName
    ) {
      // Update config using setters
      const builder = this.crudState.structureBuilder;
      if (config.description !== undefined)
        builder.setDescription(config.description);
      if (config.ddlCode !== undefined) builder.setDdlCode(config.ddlCode);
      if (config.packageName !== undefined)
        builder.setPackage(config.packageName);
      if (config.transportRequest !== undefined)
        builder.setRequest(config.transportRequest);
      return builder;
    }
    // Create new builder for new structure - ensure all config fields are passed including ddlCode
    this.crudState.structureBuilder = new StructureBuilder(
      this.connection,
      { ...config, description: config.description || '' },
      this.logger,
    );
    this.crudState.currentStructureName = config.structureName;
    return this.crudState.structureBuilder;
  }

  async createStructure(
    config: Partial<IStructureConfig> &
      Pick<
        IStructureConfig,
        'structureName' | 'packageName' | 'description' | 'ddlCode'
      >,
  ): Promise<this> {
    const builder = this.getStructureBuilder(config);
    await builder.create();
    this.crudState.createResult = builder.getState().createResult;
    return this;
  }

  async lockStructure(
    config: Pick<IStructureConfig, 'structureName'>,
  ): Promise<this> {
    const builder = this.getStructureBuilder(config);
    await builder.lock();
    this.crudState.lockHandle = builder.getState().lockHandle;
    return this;
  }

  async unlockStructure(
    config: Pick<IStructureConfig, 'structureName'>,
    lockHandle?: string,
  ): Promise<this> {
    const builder = this.getStructureBuilder(config);
    (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    await builder.unlock();
    this.crudState.unlockResult = builder.getState().unlockResult;
    this.crudState.lockHandle = undefined;
    return this;
  }

  async updateStructure(
    config: Partial<IStructureConfig> &
      Pick<IStructureConfig, 'structureName' | 'ddlCode'>,
    lockHandle?: string,
  ): Promise<this> {
    const builder = this.getStructureBuilder(config);
    // Set ddlCode using the setter method
    if (config.ddlCode) {
      builder.setDdlCode(config.ddlCode);
    }
    // Set lockHandle if provided (builder should already have it from lock(), but allow override)
    if (lockHandle || this.crudState.lockHandle) {
      (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    }
    await builder.update();
    this.crudState.updateResult = builder.getState().updateResult;
    return this;
  }

  async activateStructure(
    config: Pick<IStructureConfig, 'structureName'>,
  ): Promise<this> {
    const builder = this.getStructureBuilder(config);
    await builder.activate();
    this.crudState.activateResult = builder.getState().activateResult;
    return this;
  }

  async checkStructure(
    config: Pick<IStructureConfig, 'structureName'>,
    sourceCode?: string,
    version: 'active' | 'inactive' = 'inactive',
  ): Promise<AxiosResponse> {
    const builder = this.getStructureBuilder(config);
    const result = await builder.check(version, sourceCode);
    this.crudState.checkResult = result;
    return result;
  }

  async validateStructure(
    config: Partial<IStructureConfig> &
      Pick<IStructureConfig, 'structureName' | 'packageName' | 'description'>,
  ): Promise<AxiosResponse> {
    const builder = this.getStructureBuilder(config);
    const result = await builder.validate();
    this.crudState.validationResponse = result;
    return result;
  }

  async deleteStructure(
    config: Pick<IStructureConfig, 'structureName' | 'transportRequest'>,
  ): Promise<this> {
    const builder = this.getStructureBuilder(config);
    await builder.delete();
    this.crudState.deleteResult = builder.getState().deleteResult;
    // Clear builder after delete
    if (this.crudState.currentStructureName === config.structureName) {
      this.crudState.structureBuilder = undefined;
      this.crudState.currentStructureName = undefined;
    }
    return this;
  }

  // ==================== Table operations ====================

  private getTableBuilder(
    config: Partial<ITableConfig> & Pick<ITableConfig, 'tableName'>,
  ): TableBuilder {
    // Reuse existing builder if it's for the same table (same session)
    if (
      this.crudState.tableBuilder &&
      this.crudState.currentTableName === config.tableName
    ) {
      // Update config using setters
      const builder = this.crudState.tableBuilder;
      if (config.description !== undefined)
        builder.setDescription(config.description);
      if (config.ddlCode !== undefined) builder.setDdlCode(config.ddlCode);
      if (config.packageName !== undefined)
        builder.setPackage(config.packageName);
      if (config.transportRequest !== undefined)
        builder.setRequest(config.transportRequest);
      return builder;
    }
    // Create new builder for new table - ensure all config fields are passed including ddlCode
    this.crudState.tableBuilder = new TableBuilder(
      this.connection,
      { ...config, description: config.description || '' },
      this.logger,
    );
    this.crudState.currentTableName = config.tableName;
    return this.crudState.tableBuilder;
  }

  async createTable(
    config: Partial<ITableConfig> &
      Pick<
        ITableConfig,
        'tableName' | 'packageName' | 'description' | 'ddlCode'
      >,
  ): Promise<this> {
    const builder = this.getTableBuilder(config);
    await builder.create();
    this.crudState.createResult = builder.getState().createResult;
    return this;
  }

  async lockTable(config: Pick<ITableConfig, 'tableName'>): Promise<this> {
    const builder = this.getTableBuilder(config);
    await builder.lock();
    this.crudState.lockHandle = builder.getState().lockHandle;
    return this;
  }

  async unlockTable(
    config: Pick<ITableConfig, 'tableName'>,
    lockHandle?: string,
  ): Promise<this> {
    const builder = this.getTableBuilder(config);
    (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    await builder.unlock();
    this.crudState.unlockResult = builder.getState().unlockResult;
    this.crudState.lockHandle = undefined;
    return this;
  }

  async updateTable(
    config: Partial<ITableConfig> & Pick<ITableConfig, 'tableName' | 'ddlCode'>,
    lockHandle?: string,
  ): Promise<this> {
    const builder = this.getTableBuilder(config);
    // Set ddlCode using the setter method
    if (config.ddlCode) {
      builder.setDdlCode(config.ddlCode);
    }
    // Set lockHandle if provided (builder should already have it from lock(), but allow override)
    if (lockHandle || this.crudState.lockHandle) {
      (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    }
    await builder.update();
    this.crudState.updateResult = builder.getState().updateResult;
    return this;
  }

  async activateTable(config: Pick<ITableConfig, 'tableName'>): Promise<this> {
    const builder = this.getTableBuilder(config);
    await builder.activate();
    this.crudState.activateResult = builder.getState().activateResult;
    return this;
  }

  async checkTable(
    config: Pick<ITableConfig, 'tableName'>,
    sourceCode?: string,
    version: 'active' | 'inactive' | 'new' = 'new',
  ): Promise<AxiosResponse> {
    const builder = this.getTableBuilder(config);
    const result = await builder.check('abapCheckRun', sourceCode, version);
    this.crudState.checkResult = result;
    return result;
  }

  async validateTable(
    config: Partial<ITableConfig> &
      Pick<ITableConfig, 'tableName' | 'packageName' | 'description'>,
  ): Promise<AxiosResponse> {
    const builder = this.getTableBuilder(config);
    const result = await builder.validate();
    this.crudState.validationResponse = result;
    return result;
  }

  async deleteTable(
    config: Pick<ITableConfig, 'tableName' | 'transportRequest'>,
  ): Promise<this> {
    const builder = this.getTableBuilder(config);
    await builder.delete();
    this.crudState.deleteResult = builder.getState().deleteResult;
    // Clear builder after delete
    if (this.crudState.currentTableName === config.tableName) {
      this.crudState.tableBuilder = undefined;
      this.crudState.currentTableName = undefined;
    }
    return this;
  }

  // ==================== View operations ====================

  private getViewBuilder(
    config: Partial<IViewConfig> & Pick<IViewConfig, 'viewName'>,
  ): ViewBuilder {
    // Reuse existing builder if it's for the same view (same session)
    if (
      this.crudState.viewBuilder &&
      this.crudState.currentViewName === config.viewName
    ) {
      // Update transportRequest if provided in config
      if (config.transportRequest !== undefined) {
        this.crudState.viewBuilder.setRequest(config.transportRequest);
      }
      return this.crudState.viewBuilder;
    }
    // Create new builder for new view
    this.crudState.viewBuilder = new ViewBuilder(
      this.connection,
      { ...config, description: config.description || '' },
      this.logger,
    );
    this.crudState.currentViewName = config.viewName;
    return this.crudState.viewBuilder;
  }

  async createView(
    config: Partial<IViewConfig> &
      Pick<
        IViewConfig,
        'viewName' | 'packageName' | 'description' | 'ddlSource'
      >,
  ): Promise<this> {
    const builder = this.getViewBuilder(config);
    await builder.create();
    this.crudState.createResult = builder.getState().createResult;
    return this;
  }

  async lockView(config: Pick<IViewConfig, 'viewName'>): Promise<this> {
    const builder = this.getViewBuilder(config);
    await builder.lock();
    this.crudState.lockHandle = builder.getState().lockHandle;
    return this;
  }

  async unlockView(
    config: Pick<IViewConfig, 'viewName'>,
    lockHandle?: string,
  ): Promise<this> {
    const builder = this.getViewBuilder(config);
    (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    await builder.unlock();
    this.crudState.unlockResult = builder.getState().unlockResult;
    this.crudState.lockHandle = undefined;
    return this;
  }

  async updateView(
    config: Partial<IViewConfig> & Pick<IViewConfig, 'viewName' | 'ddlSource'>,
    lockHandle?: string,
  ): Promise<this> {
    const builder = this.getViewBuilder(config);
    // Set ddlSource if provided - use setDdlSource method to properly set it in config
    if (config.ddlSource) {
      builder.setDdlSource(config.ddlSource);
    }
    (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    await builder.update();
    this.crudState.updateResult = builder.getState().updateResult;
    return this;
  }

  async activateView(config: Pick<IViewConfig, 'viewName'>): Promise<this> {
    const builder = this.getViewBuilder(config);
    await builder.activate();
    this.crudState.activateResult = builder.getState().activateResult;
    return this;
  }

  async checkView(
    config: Pick<IViewConfig, 'viewName'>,
    sourceCode?: string,
    version: 'active' | 'inactive' = 'inactive',
  ): Promise<AxiosResponse> {
    const builder = this.getViewBuilder(config);
    const result = await builder.check(version, sourceCode);
    this.crudState.checkResult = result;
    return result;
  }

  async validateView(
    config: Partial<IViewConfig> &
      Pick<IViewConfig, 'viewName' | 'packageName' | 'description'>,
  ): Promise<AxiosResponse> {
    const builder = this.getViewBuilder(config);
    const result = await builder.validate();
    this.crudState.validationResponse = result;
    return result;
  }

  async deleteView(
    config: Pick<IViewConfig, 'viewName' | 'transportRequest'>,
  ): Promise<this> {
    const builder = this.getViewBuilder(config);
    await builder.delete();
    this.crudState.deleteResult = builder.getState().deleteResult;
    // Clear builder after delete
    if (this.crudState.currentViewName === config.viewName) {
      this.crudState.viewBuilder = undefined;
      this.crudState.currentViewName = undefined;
    }
    return this;
  }

  // ==================== Package operations ====================

  private getPackageBuilder(
    config: Partial<IPackageConfig> &
      Pick<IPackageConfig, 'packageName' | 'superPackage'>,
  ): PackageBuilder {
    // Reuse existing builder if it's for the same package (same session)
    if (
      this.crudState.packageBuilder &&
      this.crudState.currentPackageName === config.packageName
    ) {
      // Update config using individual setters
      const builder = this.crudState.packageBuilder;
      if (config.description !== undefined)
        builder.setDescription(config.description);
      if (config.softwareComponent !== undefined)
        builder.setSoftwareComponent(config.softwareComponent);
      if (config.transportLayer !== undefined)
        builder.setTransportLayer(config.transportLayer);
      if (config.applicationComponent !== undefined)
        builder.setApplicationComponent(config.applicationComponent);
      if (config.packageType !== undefined)
        builder.setPackageType(config.packageType);
      if (config.transportRequest !== undefined)
        builder.setRequest(config.transportRequest);
      if (config.responsible !== undefined)
        builder.setResponsible(config.responsible);
      return builder;
    }
    // Create new builder for new package - ensure all config fields are passed including softwareComponent
    this.crudState.packageBuilder = new PackageBuilder(
      this.connection,
      { ...config, description: config.description || '' },
      this.logger,
    );
    this.crudState.currentPackageName = config.packageName;
    return this.crudState.packageBuilder;
  }

  async createPackage(
    config: Partial<IPackageConfig> &
      Pick<
        IPackageConfig,
        'packageName' | 'superPackage' | 'description' | 'softwareComponent'
      >,
  ): Promise<this> {
    const builder = this.getPackageBuilder(config);
    // Ensure softwareComponent is set (it's required for creation)
    // This is important even if it was passed in config, as it might not be set if builder was reused
    if (config.softwareComponent) {
      builder.setSoftwareComponent(config.softwareComponent);
    }

    try {
      await builder.create();
      this.crudState.createResult = builder.getState().createResult;
      return this;
    } catch (error: any) {
      // If software component is invalid, try to get it from parent package
      const errorMessage = String(error.message || '').toLowerCase();
      const errorData = error.response?.data || '';
      const errorText =
        typeof errorData === 'string'
          ? errorData.toLowerCase()
          : JSON.stringify(errorData).toLowerCase();

      const isSoftwareComponentError =
        error.response?.status === 400 &&
        (errorMessage.includes('software component') ||
          errorMessage.includes('not a valid software component') ||
          errorText.includes('software component') ||
          errorText.includes('not a valid software component'));

      if (isSoftwareComponentError && config.superPackage) {
        // Read parent package to get its software component
        try {
          const parentPackage = await this.readPackage(config.superPackage);
          if (parentPackage?.softwareComponent) {
            builder.setSoftwareComponent(parentPackage.softwareComponent);
            // Retry creation with parent's software component
            await builder.create();
            this.crudState.createResult = builder.getState().createResult;
            return this;
          }
        } catch (_readError) {
          // If reading parent package fails, throw original error
          throw error;
        }
      }

      // Re-throw original error if not a software component error or if parent read failed
      throw error;
    }
  }

  async validatePackage(
    config: Partial<IPackageConfig> &
      Pick<IPackageConfig, 'packageName' | 'superPackage' | 'description'>,
  ): Promise<AxiosResponse> {
    const builder = this.getPackageBuilder(config);
    const result = await builder.validate();
    this.crudState.validationResponse = result;
    return result;
  }

  async deletePackage(
    config: Pick<IPackageConfig, 'packageName' | 'transportRequest'>,
  ): Promise<this> {
    const builder = this.getPackageBuilder(config);
    await builder.delete();
    this.crudState.deleteResult = builder.getState().deleteResult;
    // Clear builder after delete
    if (this.crudState.currentPackageName === config.packageName) {
      this.crudState.packageBuilder = undefined;
      this.crudState.currentPackageName = undefined;
    }
    return this;
  }

  async lockPackage(
    config: Pick<IPackageConfig, 'packageName' | 'superPackage'>,
  ): Promise<this> {
    const builder = this.getPackageBuilder(config);
    await builder.lock();
    this.crudState.lockHandle = builder.getState().lockHandle;
    return this;
  }

  async unlockPackage(
    config: Pick<IPackageConfig, 'packageName' | 'superPackage'>,
    lockHandle?: string,
  ): Promise<this> {
    const builder = this.getPackageBuilder(config);
    (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    await builder.unlock();
    this.crudState.unlockResult = builder.getState().unlockResult;
    this.crudState.lockHandle = undefined;
    return this;
  }

  async updatePackage(
    config: Partial<IPackageConfig> &
      Pick<
        IPackageConfig,
        'packageName' | 'superPackage' | 'updatedDescription'
      >,
    lockHandle?: string,
  ): Promise<this> {
    const builder = this.getPackageBuilder(config);
    // Set updatedDescription if provided
    if (config.updatedDescription) {
      (builder as any).updatedDescription = config.updatedDescription;
    }
    (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    await builder.update();
    this.crudState.updateResult = builder.getState().updateResult;
    return this;
  }

  async checkPackage(
    config: Pick<IPackageConfig, 'packageName' | 'superPackage'>,
  ): Promise<AxiosResponse> {
    const builder = this.getPackageBuilder(config);
    const result = await builder.check();
    this.crudState.checkResult = result;
    return result;
  }

  // ==================== Transport operations ====================

  async createTransport(
    description: string,
    transportType?: 'workbench' | 'customizing',
  ): Promise<this> {
    const builder = new TransportBuilder(
      this.connection,
      { description, transportType },
      this.logger,
    );
    await builder.create();
    this.crudState.createResult = builder.getState().createResult;
    return this;
  }

  // ==================== BehaviorDefinition operations ====================

  async createBehaviorDefinition(
    config: Partial<IBehaviorDefinitionConfig> &
      Pick<
        IBehaviorDefinitionConfig,
        | 'name'
        | 'packageName'
        | 'description'
        | 'rootEntity'
        | 'implementationType'
      >,
  ): Promise<this> {
    const builder = new BehaviorDefinitionBuilder(
      this.connection,
      config,
      this.logger,
    );
    await builder.create();
    this.crudState.createResult = builder.getState().createResult;
    return this;
  }

  async lockBehaviorDefinition(
    config: Partial<IBehaviorDefinitionConfig> &
      Pick<IBehaviorDefinitionConfig, 'name'>,
  ): Promise<this> {
    const builder = new BehaviorDefinitionBuilder(this.connection, {
      ...config,
      description: config.description || '',
      rootEntity: config.rootEntity || '',
    });
    await builder.lock();
    this.crudState.lockHandle =
      builder.getLockHandle() || builder.getState().lockHandle;
    return this;
  }

  async unlockBehaviorDefinition(
    config: Partial<IBehaviorDefinitionConfig> &
      Pick<IBehaviorDefinitionConfig, 'name'>,
    lockHandle?: string,
  ): Promise<this> {
    const builder = new BehaviorDefinitionBuilder(this.connection, {
      ...config,
      description: config.description || '',
      rootEntity: config.rootEntity || '',
    });
    (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    await builder.unlock();
    this.crudState.unlockResult = builder.getState().unlockResult;
    this.crudState.lockHandle = undefined;
    return this;
  }

  async updateBehaviorDefinition(
    config: Partial<IBehaviorDefinitionConfig> &
      Pick<IBehaviorDefinitionConfig, 'name' | 'sourceCode'>,
    lockHandle?: string,
  ): Promise<this> {
    const builder = new BehaviorDefinitionBuilder(this.connection, {
      ...config,
      description: config.description || '',
      rootEntity: config.rootEntity || '',
    });
    const effectiveLockHandle = lockHandle || this.crudState.lockHandle;
    if (!effectiveLockHandle) {
      throw new Error(
        `Lock handle is required for update. Call lockBehaviorDefinition() first or provide lockHandle parameter.`,
      );
    }
    (builder as any).lockHandle = effectiveLockHandle;
    await builder.update();
    this.crudState.updateResult = builder.getState().updateResult;
    return this;
  }

  async activateBehaviorDefinition(
    config: Partial<IBehaviorDefinitionConfig> &
      Pick<IBehaviorDefinitionConfig, 'name'>,
  ): Promise<this> {
    const builder = new BehaviorDefinitionBuilder(this.connection, {
      ...config,
      description: config.description || '',
      rootEntity: config.rootEntity || '',
    });
    await builder.activate();
    this.crudState.activateResult = builder.getState().activateResult;
    return this;
  }

  async checkBehaviorDefinition(
    config: Partial<IBehaviorDefinitionConfig> &
      Pick<IBehaviorDefinitionConfig, 'name'>,
    sourceCode?: string,
    version: 'active' | 'inactive' = 'inactive',
  ): Promise<this> {
    const builder = new BehaviorDefinitionBuilder(this.connection, {
      ...config,
      description: config.description || '',
      rootEntity: config.rootEntity || '',
    });
    await builder.check(version, sourceCode);
    this.crudState.checkResult = builder.getState().checkResults?.[0];
    return this;
  }

  async validateBehaviorDefinition(
    config: Partial<IBehaviorDefinitionConfig> &
      Pick<
        IBehaviorDefinitionConfig,
        'rootEntity' | 'implementationType' | 'description' | 'packageName'
      >,
  ): Promise<this> {
    const builder = new BehaviorDefinitionBuilder(this.connection, {
      ...config,
      name: config.name || '',
      description: config.description,
      rootEntity: config.rootEntity,
      implementationType: config.implementationType,
    });
    await builder.validate();
    this.crudState.validationResponse = builder.getState().validationResponse;
    return this;
  }

  async deleteBehaviorDefinition(
    config: Partial<IBehaviorDefinitionConfig> &
      Pick<IBehaviorDefinitionConfig, 'name'>,
  ): Promise<this> {
    const builder = new BehaviorDefinitionBuilder(this.connection, {
      ...config,
      description: config.description || '',
      rootEntity: config.rootEntity || '',
      transportRequest: config.transportRequest,
    });
    await builder.checkDeletion();
    await builder.delete();
    this.crudState.deleteResult = builder.getState().deleteResult;
    return this;
  }

  // ==================== Behavior Implementation operations ====================

  /**
   * Create behavior implementation class - full workflow
   * Creates class, locks, updates main source and implementations, unlocks and activates.
   */
  async createBehaviorImplementation(
    config: Partial<IBehaviorImplementationConfig> &
      Pick<
        IBehaviorImplementationConfig,
        'className' | 'packageName' | 'behaviorDefinition'
      >,
  ): Promise<this> {
    const builder = new BehaviorImplementationBuilder(this.connection, {
      ...config,
      description:
        config.description ||
        `Behavior Implementation for ${config.behaviorDefinition}`,
      behaviorDefinition: config.behaviorDefinition,
    });
    await builder.createBehaviorImplementation();
    this.crudState.createResult = builder.getState().createResult;
    this.crudState.activateResult = builder.getState().activateResult;
    return this;
  }

  /**
   * Update behavior implementation main source with "FOR BEHAVIOR OF" clause
   * Must be called after lockClass()
   */
  async updateBehaviorImplementationMainSource(
    config: Pick<
      IBehaviorImplementationConfig,
      'className' | 'behaviorDefinition'
    >,
    lockHandle?: string,
  ): Promise<this> {
    const builder = new BehaviorImplementationBuilder(this.connection, {
      className: config.className,
      behaviorDefinition: config.behaviorDefinition,
      description: '',
    });
    (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    await builder.updateMainSource();
    this.crudState.updateResult = builder.getState().updateResult;
    return this;
  }

  /**
   * Update behavior implementation implementations include
   * Must be called after lockClass() and updateBehaviorImplementationMainSource()
   *
   * @param config - Configuration object:
   *   - `className`: Behavior implementation class name (required)
   *   - `behaviorDefinition`: Behavior definition name (required)
   *   - `implementationCode`: Optional custom code for implementations include (local handler class).
   *                          If not provided, default code is generated.
   * @param lockHandle - Optional lock handle. If not provided, uses lock handle from previous lockClass() call.
   */
  async updateBehaviorImplementation(
    config: Pick<
      IBehaviorImplementationConfig,
      'className' | 'behaviorDefinition' | 'implementationCode'
    >,
    lockHandle?: string,
  ): Promise<this> {
    const builder = new BehaviorImplementationBuilder(this.connection, {
      className: config.className,
      behaviorDefinition: config.behaviorDefinition,
      description: '',
      implementationCode: config.implementationCode,
    });
    (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    await builder.updateImplementations();
    this.crudState.updateResult = builder.getState().updateResult;
    return this;
  }

  /**
   * Validate behavior implementation class name
   */
  async validateBehaviorImplementation(
    config: Partial<IBehaviorImplementationConfig> &
      Pick<
        IBehaviorImplementationConfig,
        'className' | 'packageName' | 'behaviorDefinition'
      >,
  ): Promise<AxiosResponse> {
    const { validateBehaviorImplementationName } = await import(
      '../core/behaviorImplementation/validation'
    );
    const result = await validateBehaviorImplementationName(
      this.connection,
      config.className,
      config.packageName,
      config.description,
      config.behaviorDefinition,
    );
    this.crudState.validationResponse = result;
    return result;
  }

  /**
   * Get BehaviorImplementationBuilder instance for advanced operations
   */
  getBehaviorImplementationBuilderInstance(
    config: Partial<IBehaviorImplementationConfig> &
      Pick<IBehaviorImplementationConfig, 'className' | 'behaviorDefinition'>,
  ): BehaviorImplementationBuilder {
    return new BehaviorImplementationBuilder(this.connection, {
      ...config,
      description:
        config.description ||
        `Behavior Implementation for ${config.behaviorDefinition}`,
      behaviorDefinition: config.behaviorDefinition || '',
    });
  }

  // ==================== MetadataExtension operations ====================

  async createMetadataExtension(
    config: Partial<IMetadataExtensionConfig> &
      Pick<IMetadataExtensionConfig, 'name' | 'packageName' | 'description'>,
  ): Promise<this> {
    const builder = new MetadataExtensionBuilder(
      this.connection,
      { ...config, name: config.name || '' },
      this.logger,
    );
    await builder.create();
    this.crudState.createResult = builder.getState().createResult;
    return this;
  }

  async lockMetadataExtension(
    config: Partial<IMetadataExtensionConfig> &
      Pick<IMetadataExtensionConfig, 'name'>,
  ): Promise<this> {
    const builder = new MetadataExtensionBuilder(
      this.connection,
      { ...config, name: config.name || '' },
      this.logger,
    );
    await builder.lock();
    this.crudState.lockHandle = builder.getState().lockHandle;
    return this;
  }

  async unlockMetadataExtension(
    config: Partial<IMetadataExtensionConfig> &
      Pick<IMetadataExtensionConfig, 'name'>,
    lockHandle?: string,
  ): Promise<this> {
    const builder = new MetadataExtensionBuilder(
      this.connection,
      { ...config, name: config.name || '' },
      this.logger,
    );
    (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    await builder.unlock();
    this.crudState.unlockResult = builder.getState().unlockResult;
    this.crudState.lockHandle = undefined;
    return this;
  }

  async updateMetadataExtension(
    config: Partial<IMetadataExtensionConfig> &
      Pick<IMetadataExtensionConfig, 'name' | 'sourceCode'>,
    lockHandle?: string,
  ): Promise<this> {
    const builder = new MetadataExtensionBuilder(
      this.connection,
      { ...config, name: config.name || '' },
      this.logger,
    );
    (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    await builder.update();
    this.crudState.updateResult = builder.getState().updateResult;
    return this;
  }

  async activateMetadataExtension(
    config: Partial<IMetadataExtensionConfig> &
      Pick<IMetadataExtensionConfig, 'name'>,
  ): Promise<this> {
    const builder = new MetadataExtensionBuilder(
      this.connection,
      { ...config, name: config.name || '' },
      this.logger,
    );
    await builder.activate();
    this.crudState.activateResult = builder.getState().activateResult;
    return this;
  }

  async checkMetadataExtension(
    config: Partial<IMetadataExtensionConfig> &
      Pick<IMetadataExtensionConfig, 'name'>,
    sourceCode?: string,
    version: 'active' | 'inactive' = 'inactive',
  ): Promise<this> {
    const builder = new MetadataExtensionBuilder(
      this.connection,
      { ...config, name: config.name || '' },
      this.logger,
    );
    await builder.check(version, sourceCode);
    this.crudState.checkResult = builder.getState().checkResult;
    return this;
  }

  async validateMetadataExtension(
    config: Partial<IMetadataExtensionConfig> &
      Pick<IMetadataExtensionConfig, 'name' | 'description' | 'packageName'>,
  ): Promise<this> {
    const builder = new MetadataExtensionBuilder(
      this.connection,
      { ...config, name: config.name || '' },
      this.logger,
    );
    await builder.validate();
    this.crudState.validationResponse = builder.getState().validationResponse;
    return this;
  }

  async deleteMetadataExtension(
    config: Partial<IMetadataExtensionConfig> &
      Pick<IMetadataExtensionConfig, 'name'>,
  ): Promise<this> {
    const builder = new MetadataExtensionBuilder(
      this.connection,
      { ...config, name: config.name || '' },
      this.logger,
    );
    await builder.delete();
    this.crudState.deleteResult = builder.getState().deleteResult;
    return this;
  }

  // ==================== Batch operations ====================

  /**
   * Activate multiple ABAP objects in batch
   * Uses ADT activation/runs endpoint for batch activation with session support
   */
  async activateObjectsGroup(
    objects: Array<{ type: string; name: string }>,
    preaudit: boolean = false,
  ): Promise<AxiosResponse> {
    const { activateObjectsGroup } = await import(
      '../core/shared/groupActivation'
    );
    const result = await activateObjectsGroup(
      this.connection,
      objects,
      preaudit,
    );
    this.crudState.activateResult = result;
    return result;
  }

  /**
   * Check if multiple ABAP objects can be deleted (group deletion check)
   * Uses ADT deletion/check endpoint for batch deletion check
   */
  async checkDeletionGroup(
    objects: Array<{ type: string; name: string }>,
  ): Promise<AxiosResponse> {
    const { checkDeletionGroup } = await import('../core/shared/groupDeletion');
    const result = await checkDeletionGroup(this.connection, objects);
    this.crudState.checkResult = result;
    return result;
  }

  /**
   * Delete multiple ABAP objects in batch
   * Uses ADT deletion/delete endpoint for batch deletion
   */
  async deleteObjectsGroup(
    objects: Array<{ type: string; name: string }>,
    transportRequest?: string,
  ): Promise<AxiosResponse> {
    const { deleteObjectsGroup } = await import('../core/shared/groupDeletion');
    const result = await deleteObjectsGroup(
      this.connection,
      objects,
      transportRequest,
    );
    this.crudState.deleteResult = result;
    return result;
  }

  /**
   * Get list of inactive objects (objects not yet activated)
   * Returns array of ObjectReference (type + name) with optional xmlStr for debugging
   */
  async getInactiveObjects(options?: { includeRawXml?: boolean }): Promise<{
    objects: Array<{ type: string; name: string }>;
    xmlStr?: string;
  }> {
    const { getInactiveObjects } = await import(
      '../core/shared/getInactiveObjects'
    );
    return await getInactiveObjects(this.connection, options);
  }

  /**
   * Parse activation response to extract status and messages
   */
  parseActivationResponse(responseData: string | any): {
    activated: boolean;
    checked: boolean;
    generated: boolean;
    messages: Array<{
      type: string;
      text: string;
      line?: number;
      column?: number;
    }>;
  } {
    const {
      parseActivationResponse,
    } = require('../utils/managementOperations');
    return parseActivationResponse(responseData);
  }

  // ==================== Service Definition operations ====================

  private getServiceDefinitionBuilder(
    config: Partial<IServiceDefinitionConfig> &
      Pick<IServiceDefinitionConfig, 'serviceDefinitionName'>,
  ): ServiceDefinitionBuilder {
    // Reuse existing builder if it's for the same service definition (same session)
    if (
      this.crudState.serviceDefinitionBuilder &&
      this.crudState.currentServiceDefinitionName ===
        config.serviceDefinitionName
    ) {
      return this.crudState.serviceDefinitionBuilder;
    }
    // Create new builder for new service definition
    // Only include description if it's explicitly provided in config
    const builderConfig: IServiceDefinitionConfig = {
      serviceDefinitionName: config.serviceDefinitionName,
      ...(config.packageName && { packageName: config.packageName }),
      ...(config.transportRequest && {
        transportRequest: config.transportRequest,
      }),
      ...(config.description && { description: config.description }),
      ...(config.sourceCode && { sourceCode: config.sourceCode }),
    };
    this.crudState.serviceDefinitionBuilder = new ServiceDefinitionBuilder(
      this.connection,
      builderConfig,
      this.logger,
    );
    this.crudState.currentServiceDefinitionName = config.serviceDefinitionName;
    return this.crudState.serviceDefinitionBuilder;
  }

  async createServiceDefinition(
    config: Partial<IServiceDefinitionConfig> &
      Pick<
        IServiceDefinitionConfig,
        'serviceDefinitionName' | 'packageName' | 'description'
      >,
  ): Promise<this> {
    const builder = this.getServiceDefinitionBuilder(config);
    // Ensure packageName is set on builder before create
    if (config.packageName) {
      builder.setPackage(config.packageName);
    }
    if (config.description) {
      builder.setDescription(config.description);
    }
    await builder.create();
    this.crudState.createResult = builder.getState().createResult;
    return this;
  }

  async lockServiceDefinition(
    config: Pick<IServiceDefinitionConfig, 'serviceDefinitionName'>,
  ): Promise<this> {
    const builder = this.getServiceDefinitionBuilder(config);
    await builder.lock();
    this.crudState.lockHandle = builder.getState().lockHandle;
    return this;
  }

  async unlockServiceDefinition(
    config: Pick<IServiceDefinitionConfig, 'serviceDefinitionName'>,
    lockHandle?: string,
  ): Promise<this> {
    const builder = this.getServiceDefinitionBuilder(config);
    (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    await builder.unlock();
    this.crudState.unlockResult = builder.getState().unlockResult;
    this.crudState.lockHandle = undefined;
    return this;
  }

  async updateServiceDefinition(
    config: Partial<IServiceDefinitionConfig> &
      Pick<IServiceDefinitionConfig, 'serviceDefinitionName' | 'sourceCode'>,
    lockHandle?: string,
  ): Promise<this> {
    const builder = this.getServiceDefinitionBuilder(config);
    // Set sourceCode if provided
    if (config.sourceCode) {
      builder.setSourceCode(config.sourceCode);
    }
    (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    await builder.update();
    this.crudState.updateResult = builder.getState().updateResult;
    return this;
  }

  async activateServiceDefinition(
    config: Pick<IServiceDefinitionConfig, 'serviceDefinitionName'>,
  ): Promise<this> {
    const builder = this.getServiceDefinitionBuilder(config);
    await builder.activate();
    this.crudState.activateResult = builder.getState().activateResult;
    return this;
  }

  async checkServiceDefinition(
    config: Pick<IServiceDefinitionConfig, 'serviceDefinitionName'>,
    sourceCode?: string,
    version: 'active' | 'inactive' = 'inactive',
  ): Promise<AxiosResponse> {
    const builder = this.getServiceDefinitionBuilder(config);
    const result = await builder.check(version, sourceCode);
    this.crudState.checkResult = builder.getState().checkResult;
    return result;
  }

  async validateServiceDefinition(
    config: Partial<IServiceDefinitionConfig> &
      Pick<IServiceDefinitionConfig, 'serviceDefinitionName' | 'description'>,
  ): Promise<AxiosResponse> {
    const builder = this.getServiceDefinitionBuilder(config);
    // Ensure description is set on builder before validate
    if (config.description) {
      builder.setDescription(config.description);
    }
    const result = await builder.validate();
    this.crudState.validationResponse = builder.getState().validationResponse;
    return result;
  }

  async deleteServiceDefinition(
    config: Pick<IServiceDefinitionConfig, 'serviceDefinitionName'>,
    transportRequest?: string,
  ): Promise<this> {
    const builder = this.getServiceDefinitionBuilder({
      ...config,
      transportRequest,
    });
    await builder.delete();
    this.crudState.deleteResult = builder.getState().deleteResult;
    return this;
  }

  /**
   * Get ServiceDefinitionBuilder instance for advanced operations
   */
  getServiceDefinitionBuilderInstance(
    config: Partial<IServiceDefinitionConfig> &
      Pick<IServiceDefinitionConfig, 'serviceDefinitionName'>,
  ): ServiceDefinitionBuilder {
    return this.getServiceDefinitionBuilder(config);
  }
}
