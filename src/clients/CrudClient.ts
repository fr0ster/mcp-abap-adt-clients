/**
 * CrudClient - Full CRUD operations for SAP ADT
 *
 * Extends ReadOnlyClient with Create, Update, Lock, Unlock, Activate, Check, Validate operations.
 * Methods return `this` for chaining. Results stored in state and accessible via getters.
 */

import { ReadOnlyClient } from './ReadOnlyClient';
import { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { AxiosResponse } from 'axios';
import { ProgramBuilder, ProgramBuilderConfig } from '../core/program';
import {
  ClassBuilder,
  ClassBuilderConfig,
  startClassUnitTestRun,
  getClassUnitTestStatus,
  getClassUnitTestResult,
  ClassUnitTestDefinition,
  ClassUnitTestRunOptions
} from '../core/class';
import { InterfaceBuilder, InterfaceBuilderConfig } from '../core/interface';
import { DataElementBuilder, DataElementBuilderConfig } from '../core/dataElement';
import { DomainBuilder, DomainBuilderConfig } from '../core/domain';
import { StructureBuilder, StructureBuilderConfig } from '../core/structure';
import { TableBuilder, TableBuilderConfig } from '../core/table';
import { ViewBuilder, ViewBuilderConfig } from '../core/view';
import { FunctionGroupBuilder, FunctionGroupBuilderConfig } from '../core/functionGroup';
import { FunctionModuleBuilder, FunctionModuleBuilderConfig } from '../core/functionModule';
import { PackageBuilder, PackageBuilderConfig } from '../core/package';
import { TransportBuilder } from '../core/transport';
import { BehaviorDefinitionBuilder, BehaviorDefinitionBuilderConfig } from '../core/behaviorDefinition';
import { BehaviorImplementationBuilder, BehaviorImplementationBuilderConfig } from '../core/behaviorImplementation';
import { MetadataExtensionBuilder, MetadataExtensionBuilderConfig } from '../core/metadataExtension';
import { ServiceDefinitionBuilder, ServiceDefinitionBuilderConfig } from '../core/serviceDefinition';

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
  
  constructor(connection: IAbapConnection) {
    super(connection);
  }

  // State getters (readResult inherited from ReadOnlyClient)
  getCreateResult(): AxiosResponse | undefined { return this.crudState.createResult; }
  getLockHandle(): string | undefined { return this.crudState.lockHandle; }
  getUnlockResult(): AxiosResponse | undefined { return this.crudState.unlockResult; }
  getUpdateResult(): AxiosResponse | undefined { return this.crudState.updateResult; }
  getTestClassUpdateResult(): AxiosResponse | undefined { return this.crudState.testClassUpdateResult; }
  getTestClassLockHandle(): string | undefined { return this.crudState.testClassLockHandle; }
  getTestClassActivateResult(): AxiosResponse | undefined { return this.crudState.testClassActivateResult; }
  getAbapUnitRunResponse(): AxiosResponse | undefined { return this.crudState.abapUnitRunResponse; }
  getAbapUnitRunId(): string | undefined { return this.crudState.abapUnitRunId; }
  getAbapUnitStatusResponse(): AxiosResponse | undefined { return this.crudState.abapUnitRunStatus; }
  getAbapUnitResultResponse(): AxiosResponse | undefined { return this.crudState.abapUnitRunResult; }
  getActivateResult(): AxiosResponse | undefined { return this.crudState.activateResult; }
  getDeleteResult(): AxiosResponse | undefined { return this.crudState.deleteResult; }
  getCheckResult(): AxiosResponse | undefined { return this.crudState.checkResult; }
  getValidationResponse(): AxiosResponse | undefined { return this.crudState.validationResponse; }

  // ==================== Program operations ====================
  
  private getProgramBuilder(config: Partial<ProgramBuilderConfig> & Pick<ProgramBuilderConfig, 'programName'>): ProgramBuilder {
    // Reuse existing builder if it's for the same program (same session)
    if (this.crudState.programBuilder && this.crudState.currentProgramName === config.programName) {
      return this.crudState.programBuilder;
    }
    // Create new builder for new program
    this.crudState.programBuilder = new ProgramBuilder(this.connection, {}, { ...config, description: config.description || '' });
    this.crudState.currentProgramName = config.programName;
    return this.crudState.programBuilder;
  }

  async createProgram(config: Partial<ProgramBuilderConfig> & Pick<ProgramBuilderConfig, 'programName' | 'packageName' | 'description'>): Promise<this> {
    const builder = this.getProgramBuilder(config);
    await builder.create();
    this.crudState.createResult = builder.getState().createResult;
    return this;
  }

  async lockProgram(config: Pick<ProgramBuilderConfig, 'programName'>): Promise<this> {
    const builder = this.getProgramBuilder(config);
    await builder.lock();
    this.crudState.lockHandle = builder.getState().lockHandle;
    return this;
  }

  async unlockProgram(config: Pick<ProgramBuilderConfig, 'programName'>, lockHandle?: string): Promise<this> {
    const builder = this.getProgramBuilder(config);
    (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    await builder.unlock();
    this.crudState.unlockResult = builder.getState().unlockResult;
    this.crudState.lockHandle = undefined;
    return this;
  }

  async updateProgram(config: Partial<ProgramBuilderConfig> & Pick<ProgramBuilderConfig, 'programName' | 'sourceCode'>, lockHandle?: string): Promise<this> {
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

  async activateProgram(config: Pick<ProgramBuilderConfig, 'programName'>): Promise<this> {
    const builder = this.getProgramBuilder(config);
    await builder.activate();
    this.crudState.activateResult = builder.getState().activateResult;
    return this;
  }

  async checkProgram(config: Pick<ProgramBuilderConfig, 'programName'>, version?: 'active' | 'inactive', sourceCode?: string): Promise<AxiosResponse> {
    const builder = this.getProgramBuilder(config);
    const result = await builder.check(version, sourceCode);
    this.crudState.checkResult = result;
    return result;
  }

  async validateProgram(config: Partial<ProgramBuilderConfig> & Pick<ProgramBuilderConfig, 'programName' | 'packageName' | 'description'>): Promise<AxiosResponse> {
    const builder = this.getProgramBuilder(config);
    const result = await builder.validate();
    this.crudState.validationResponse = result;
    return result;
  }

  async deleteProgram(config: Pick<ProgramBuilderConfig, 'programName' | 'transportRequest'>): Promise<this> {
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
  
  private getClassBuilder(config: Partial<ClassBuilderConfig> & Pick<ClassBuilderConfig, 'className'>): ClassBuilder {
    // Reuse existing builder if it's for the same class (same session)
    if (this.crudState.classBuilder && this.crudState.currentClassName === config.className) {
      return this.crudState.classBuilder;
    }
    // Create new builder for new class
    this.crudState.classBuilder = new ClassBuilder(this.connection, {}, { ...config, description: config.description || '' });
    this.crudState.currentClassName = config.className;
    return this.crudState.classBuilder;
  }

  async createClass(config: Partial<ClassBuilderConfig> & Pick<ClassBuilderConfig, 'className' | 'packageName' | 'description'>): Promise<this> {
    const builder = this.getClassBuilder(config);
    await builder.create();
    this.crudState.createResult = builder.getState().createResult;
    return this;
  }

  async lockClass(config: Pick<ClassBuilderConfig, 'className'>): Promise<this> {
    const builder = this.getClassBuilder(config);
    await builder.lock();
    this.crudState.lockHandle = builder.getState().lockHandle;
    return this;
  }

  async unlockClass(config: Pick<ClassBuilderConfig, 'className'>, lockHandle?: string): Promise<this> {
    const builder = this.getClassBuilder(config);
    (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    await builder.unlock();
    this.crudState.unlockResult = builder.getState().unlockResult;
    this.crudState.lockHandle = undefined;
    return this;
  }

  async updateClass(config: Partial<ClassBuilderConfig> & Pick<ClassBuilderConfig, 'className' | 'sourceCode'>, lockHandle?: string): Promise<this> {
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

  async updateClassTestIncludes(config: Partial<ClassBuilderConfig> & Pick<ClassBuilderConfig, 'className' | 'testClassCode'>, lockHandle?: string): Promise<this> {
    const builder = this.getClassBuilder(config);
    if (config.testClassCode) {
      builder.setTestClassCode(config.testClassCode);
    }
    if (lockHandle || this.crudState.testClassLockHandle) {
      (builder as any).testLockHandle = lockHandle || this.crudState.testClassLockHandle;
    } else {
      await builder.lockTestClasses();
      this.crudState.testClassLockHandle = builder.getState().testLockHandle;
    }
    await builder.updateTestClasses();
    this.crudState.testClassUpdateResult = builder.getState().testClassesResult;
    return this;
  }

  async updateClassLocalTypes(config: Partial<ClassBuilderConfig> & Pick<ClassBuilderConfig, 'className' | 'localTypesCode'>, lockHandle?: string): Promise<this> {
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

  async updateClassDefinitions(config: Partial<ClassBuilderConfig> & Pick<ClassBuilderConfig, 'className' | 'definitionsCode'>, lockHandle?: string): Promise<this> {
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

  async updateClassMacros(config: Partial<ClassBuilderConfig> & Pick<ClassBuilderConfig, 'className' | 'macrosCode'>, lockHandle?: string): Promise<this> {
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

  async lockTestClasses(config: Pick<ClassBuilderConfig, 'className'>): Promise<this> {
    const builder = this.getClassBuilder(config);
    await builder.lockTestClasses();
    this.crudState.testClassLockHandle = builder.getState().testLockHandle;
    return this;
  }

  async unlockTestClasses(config: Pick<ClassBuilderConfig, 'className'>, lockHandle?: string): Promise<this> {
    const builder = this.getClassBuilder(config);
    (builder as any).testLockHandle = lockHandle || this.crudState.testClassLockHandle;
    await builder.unlockTestClasses();
    this.crudState.testClassLockHandle = undefined;
    return this;
  }

  async activateTestClasses(config: Partial<ClassBuilderConfig> & Pick<ClassBuilderConfig, 'className' | 'testClassName'>): Promise<this> {
    const builder = this.getClassBuilder(config);
    if (config.testClassName) {
      builder.setTestClassName(config.testClassName);
    }
    await builder.activateTestClasses();
    this.crudState.testClassActivateResult = builder.getState().testActivateResult;
    return this;
  }

  async activateClass(config: Pick<ClassBuilderConfig, 'className'>): Promise<this> {
    const builder = this.getClassBuilder(config);
    await builder.activate();
    this.crudState.activateResult = builder.getState().activateResult;
    return this;
  }

  async checkClass(config: Pick<ClassBuilderConfig, 'className'>, version?: 'active' | 'inactive', sourceCode?: string): Promise<AxiosResponse> {
    const builder = this.getClassBuilder(config);
    const result = await builder.check(version, sourceCode);
    this.crudState.checkResult = result;
    return result;
  }

  async checkClassTestClass(config: Pick<ClassBuilderConfig, 'className' | 'testClassCode'>): Promise<this> {
    const builder = this.getClassBuilder(config);
    await builder.checkTestClass(config.testClassCode);
    return this;
  }

  async checkClassLocalTypes(config: Pick<ClassBuilderConfig, 'className' | 'localTypesCode'>): Promise<this> {
    const builder = this.getClassBuilder(config);
    await builder.checkLocalTypes(config.localTypesCode);
    return this;
  }

  async checkClassDefinitions(config: Pick<ClassBuilderConfig, 'className' | 'definitionsCode'>): Promise<this> {
    const builder = this.getClassBuilder(config);
    await builder.checkDefinitions(config.definitionsCode);
    return this;
  }

  async checkClassMacros(config: Pick<ClassBuilderConfig, 'className' | 'macrosCode'>): Promise<this> {
    const builder = this.getClassBuilder(config);
    await builder.checkMacros(config.macrosCode);
    return this;
  }

  async validateClass(config: Partial<ClassBuilderConfig> & Pick<ClassBuilderConfig, 'className' | 'packageName' | 'description'>): Promise<AxiosResponse> {
    const builder = this.getClassBuilder(config);
    const result = await builder.validate();
    this.crudState.validationResponse = result;
    return result;
  }

  async deleteClass(config: Pick<ClassBuilderConfig, 'className' | 'transportRequest'>): Promise<this> {
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
    options?: ClassUnitTestRunOptions
  ): Promise<this> {
    const response = await startClassUnitTestRun(this.connection, tests, options);
    this.crudState.abapUnitRunResponse = response;
    const location =
      response.headers?.['location'] ||
      response.headers?.['content-location'] ||
      response.headers?.['sap-adt-location'];
    if (location) {
      const runId = location.split('/').pop();
      if (runId) {
        this.crudState.abapUnitRunId = runId;
      }
    }
    return this;
  }

  async getClassUnitTestRunStatus(runId: string, withLongPolling: boolean = true): Promise<this> {
    const response = await getClassUnitTestStatus(this.connection, runId, withLongPolling);
    this.crudState.abapUnitRunStatus = response;
    return this;
  }

  async getClassUnitTestRunResult(
    runId: string,
    options?: { withNavigationUris?: boolean; format?: 'abapunit' | 'junit' }
  ): Promise<this> {
    const response = await getClassUnitTestResult(this.connection, runId, options);
    this.crudState.abapUnitRunResult = response;
    return this;
  }

  // ==================== Interface operations ====================
  
  private getInterfaceBuilder(config: Partial<InterfaceBuilderConfig> & Pick<InterfaceBuilderConfig, 'interfaceName'>): InterfaceBuilder {
    // Reuse existing builder if it's for the same interface (same session)
    if (this.crudState.interfaceBuilder && this.crudState.currentInterfaceName === config.interfaceName) {
      return this.crudState.interfaceBuilder;
    }
    // Create new builder for new interface
    this.crudState.interfaceBuilder = new InterfaceBuilder(this.connection, {}, { ...config, description: config.description || '' });
    this.crudState.currentInterfaceName = config.interfaceName;
    return this.crudState.interfaceBuilder;
  }

  async createInterface(config: Partial<InterfaceBuilderConfig> & Pick<InterfaceBuilderConfig, 'interfaceName' | 'packageName' | 'description'>): Promise<this> {
    const builder = this.getInterfaceBuilder(config);
    await builder.create();
    this.crudState.createResult = builder.getState().createResult;
    return this;
  }

  async lockInterface(config: Pick<InterfaceBuilderConfig, 'interfaceName'>): Promise<this> {
    const builder = this.getInterfaceBuilder(config);
    await builder.lock();
    this.crudState.lockHandle = builder.getState().lockHandle;
    return this;
  }

  async unlockInterface(config: Pick<InterfaceBuilderConfig, 'interfaceName'>, lockHandle?: string): Promise<this> {
    const builder = this.getInterfaceBuilder(config);
    (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    await builder.unlock();
    this.crudState.unlockResult = builder.getState().unlockResult;
    this.crudState.lockHandle = undefined;
    return this;
  }

  async updateInterface(config: Partial<InterfaceBuilderConfig> & Pick<InterfaceBuilderConfig, 'interfaceName' | 'sourceCode'>, lockHandle?: string): Promise<this> {
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

  async activateInterface(config: Pick<InterfaceBuilderConfig, 'interfaceName'>): Promise<this> {
    const builder = this.getInterfaceBuilder(config);
    await builder.activate();
    this.crudState.activateResult = builder.getState().activateResult;
    return this;
  }

  async checkInterface(config: Pick<InterfaceBuilderConfig, 'interfaceName'>, sourceCode?: string, version: 'active' | 'inactive' = 'inactive'): Promise<AxiosResponse> {
    const builder = this.getInterfaceBuilder(config);
    const result = await builder.check(version, sourceCode);
    this.crudState.checkResult = result;
    return result;
  }

  async validateInterface(config: Partial<InterfaceBuilderConfig> & Pick<InterfaceBuilderConfig, 'interfaceName' | 'packageName' | 'description'>): Promise<AxiosResponse> {
    const builder = this.getInterfaceBuilder(config);
    const result = await builder.validate();
    this.crudState.validationResponse = result;
    return result;
  }

  async deleteInterface(config: Pick<InterfaceBuilderConfig, 'interfaceName' | 'transportRequest'>): Promise<this> {
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
  
  private getFunctionModuleBuilder(config: Partial<FunctionModuleBuilderConfig> & Pick<FunctionModuleBuilderConfig, 'functionModuleName' | 'functionGroupName'>): FunctionModuleBuilder {
    // Reuse existing builder if it's for the same function module (same session)
    const key = `${config.functionGroupName}/${config.functionModuleName}`;
    if (this.crudState.functionModuleBuilder && this.crudState.currentFunctionModuleName === key) {
      return this.crudState.functionModuleBuilder;
    }
    // Create new builder for new function module
    this.crudState.functionModuleBuilder = new FunctionModuleBuilder(this.connection, {}, { ...config, description: config.description || '' });
    this.crudState.currentFunctionModuleName = key;
    return this.crudState.functionModuleBuilder;
  }

  async createFunctionModule(config: Partial<FunctionModuleBuilderConfig> & Pick<FunctionModuleBuilderConfig, 'functionModuleName' | 'functionGroupName' | 'packageName' | 'description' | 'sourceCode'>): Promise<this> {
    const builder = this.getFunctionModuleBuilder(config);
    await builder.create();
    this.crudState.createResult = builder.getState().createResult;
    return this;
  }

  async lockFunctionModule(config: Pick<FunctionModuleBuilderConfig, 'functionModuleName' | 'functionGroupName'>): Promise<this> {
    const builder = this.getFunctionModuleBuilder(config);
    await builder.lock();
    this.crudState.lockHandle = builder.getState().lockHandle;
    return this;
  }

  async unlockFunctionModule(config: Pick<FunctionModuleBuilderConfig, 'functionModuleName' | 'functionGroupName'>, lockHandle?: string): Promise<this> {
    const builder = this.getFunctionModuleBuilder(config);
    (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    await builder.unlock();
    this.crudState.unlockResult = builder.getState().unlockResult;
    this.crudState.lockHandle = undefined;
    return this;
  }

  async updateFunctionModule(config: Partial<FunctionModuleBuilderConfig> & Pick<FunctionModuleBuilderConfig, 'functionModuleName' | 'functionGroupName' | 'sourceCode'>, lockHandle?: string): Promise<this> {
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

  async activateFunctionModule(config: Pick<FunctionModuleBuilderConfig, 'functionModuleName' | 'functionGroupName'>): Promise<this> {
    const builder = this.getFunctionModuleBuilder(config);
    await builder.activate();
    this.crudState.activateResult = builder.getState().activateResult;
    return this;
  }

  async checkFunctionModule(config: Pick<FunctionModuleBuilderConfig, 'functionModuleName' | 'functionGroupName'>, version?: 'active' | 'inactive', sourceCode?: string): Promise<AxiosResponse> {
    const builder = this.getFunctionModuleBuilder(config);
    const result = await builder.check(version, sourceCode);
    this.crudState.checkResult = result;
    return result;
  }

  async validateFunctionModule(config: Partial<FunctionModuleBuilderConfig> & Pick<FunctionModuleBuilderConfig, 'functionModuleName' | 'functionGroupName' | 'packageName' | 'description'>): Promise<AxiosResponse> {
    const builder = this.getFunctionModuleBuilder(config);
    const result = await builder.validate();
    this.crudState.validationResponse = result;
    return result;
  }

  async deleteFunctionModule(config: Pick<FunctionModuleBuilderConfig, 'functionModuleName' | 'functionGroupName' | 'transportRequest'>): Promise<this> {
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
  
  async createFunctionGroup(config: Partial<FunctionGroupBuilderConfig> & Pick<FunctionGroupBuilderConfig, 'functionGroupName' | 'packageName' | 'description'>): Promise<this> {
    const builder = new FunctionGroupBuilder(this.connection, {}, config);
    await builder.create();
    this.crudState.createResult = builder.getState().createResult;
    return this;
  }

  async lockFunctionGroup(config: Partial<FunctionGroupBuilderConfig> & Pick<FunctionGroupBuilderConfig, 'functionGroupName'>): Promise<this> {
    const builder = new FunctionGroupBuilder(this.connection, {}, { ...config, description: config.description || '' });
    await builder.lock();
    this.crudState.lockHandle = builder.getState().lockHandle;
    return this;
  }

  async unlockFunctionGroup(config: Partial<FunctionGroupBuilderConfig> & Pick<FunctionGroupBuilderConfig, 'functionGroupName'>, lockHandle?: string): Promise<this> {
    const builder = new FunctionGroupBuilder(this.connection, {}, { ...config, description: config.description || '' });
    (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    await builder.unlock();
    this.crudState.unlockResult = builder.getState().unlockResult;
    this.crudState.lockHandle = undefined;
    return this;
  }

  async activateFunctionGroup(config: Partial<FunctionGroupBuilderConfig> & Pick<FunctionGroupBuilderConfig, 'functionGroupName'>): Promise<this> {
    const builder = new FunctionGroupBuilder(this.connection, {}, { ...config, description: config.description || '' });
    await builder.activate();
    this.crudState.activateResult = builder.getState().activateResult;
    return this;
  }

  async checkFunctionGroup(config: Partial<FunctionGroupBuilderConfig> & Pick<FunctionGroupBuilderConfig, 'functionGroupName'>): Promise<AxiosResponse> {
    const builder = new FunctionGroupBuilder(this.connection, {}, { ...config, description: config.description || '' });
    const result = await builder.check();
    this.crudState.checkResult = result;
    return result;
  }

  async validateFunctionGroup(config: Partial<FunctionGroupBuilderConfig> & Pick<FunctionGroupBuilderConfig, 'functionGroupName' | 'description'>): Promise<AxiosResponse> {
    // packageName is required for validation to work correctly
    // Without it, SAP ADT returns "Resource FUGR_MAINPROGRAM: wrong input data"
    const builder = new FunctionGroupBuilder(this.connection, {}, { 
      ...config, 
      description: config.description,
      packageName: config.packageName // Ensure packageName is passed to builder
    });
    const result = await builder.validate();
    this.crudState.validationResponse = result;
    return result;
  }

  async deleteFunctionGroup(config: Partial<FunctionGroupBuilderConfig> & Pick<FunctionGroupBuilderConfig, 'functionGroupName'>): Promise<this> {
    const builder = new FunctionGroupBuilder(this.connection, {}, { ...config, description: config.description || '', transportRequest: config.transportRequest });
    await builder.delete();
    this.crudState.deleteResult = builder.getState().deleteResult;
    return this;
  }


  // ==================== DataElement operations ====================
  
  private getDataElementBuilder(config: Partial<DataElementBuilderConfig> & Pick<DataElementBuilderConfig, 'dataElementName'>): DataElementBuilder {
    // Reuse existing builder if it's for the same data element (same session)
    if (this.crudState.dataElementBuilder && this.crudState.currentDataElementName === config.dataElementName) {
      // Update config using individual setters
      const builder = this.crudState.dataElementBuilder;
      if (config.packageName) builder.setPackage(config.packageName);
      if (config.description !== undefined) builder.setDescription(config.description);
      if (config.dataType !== undefined) builder.setDataType(config.dataType);
      if (config.length !== undefined) builder.setLength(config.length);
      if (config.decimals !== undefined) builder.setDecimals(config.decimals);
      if (config.shortLabel !== undefined) builder.setShortLabel(config.shortLabel);
      if (config.mediumLabel !== undefined) builder.setMediumLabel(config.mediumLabel);
      if (config.longLabel !== undefined) builder.setLongLabel(config.longLabel);
      if (config.headingLabel !== undefined) builder.setHeadingLabel(config.headingLabel);
      if (config.typeKind !== undefined) builder.setTypeKind(config.typeKind);
      if (config.typeName !== undefined) builder.setTypeName(config.typeName);
      if (config.transportRequest !== undefined) builder.setRequest(config.transportRequest);
      return builder;
    }
    // Create new builder for new data element
    this.crudState.dataElementBuilder = new DataElementBuilder(this.connection, {}, { ...config, description: config.description || '' });
    this.crudState.currentDataElementName = config.dataElementName;
    return this.crudState.dataElementBuilder;
  }

  async createDataElement(config: Partial<DataElementBuilderConfig> & Pick<DataElementBuilderConfig, 'dataElementName' | 'packageName' | 'description' | 'typeKind'>): Promise<this> {
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

  async lockDataElement(config: Pick<DataElementBuilderConfig, 'dataElementName'>): Promise<this> {
    const builder = this.getDataElementBuilder(config);
    await builder.lock();
    this.crudState.lockHandle = builder.getState().lockHandle;
    return this;
  }

  async unlockDataElement(config: Pick<DataElementBuilderConfig, 'dataElementName'>, lockHandle?: string): Promise<this> {
    const builder = this.getDataElementBuilder(config);
    (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    await builder.unlock();
    this.crudState.unlockResult = builder.getState().unlockResult;
    this.crudState.lockHandle = undefined;
    return this;
  }

  async updateDataElement(config: Partial<DataElementBuilderConfig> & Pick<DataElementBuilderConfig, 'dataElementName' | 'packageName' | 'description'>, lockHandle?: string): Promise<this> {
    const builder = this.getDataElementBuilder(config);
    (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    await builder.update();
    this.crudState.updateResult = builder.getState().updateResult;
    return this;
  }

  async activateDataElement(config: Pick<DataElementBuilderConfig, 'dataElementName'>): Promise<this> {
    const builder = this.getDataElementBuilder(config);
    await builder.activate();
    this.crudState.activateResult = builder.getState().activateResult;
    return this;
  }

  async checkDataElement(config: Pick<DataElementBuilderConfig, 'dataElementName'>, version: 'active' | 'inactive' = 'inactive'): Promise<AxiosResponse> {
    const builder = this.getDataElementBuilder(config);
    const result = await builder.check(version);
    this.crudState.checkResult = result;
    return result;
  }

  async validateDataElement(config: Partial<DataElementBuilderConfig> & Pick<DataElementBuilderConfig, 'dataElementName' | 'packageName' | 'description'>): Promise<AxiosResponse> {
    const builder = this.getDataElementBuilder(config);
    const result = await builder.validate();
    this.crudState.validationResponse = result;
    return result;
  }

  async deleteDataElement(config: Pick<DataElementBuilderConfig, 'dataElementName' | 'transportRequest'>): Promise<this> {
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
  
  private getDomainBuilder(config: Partial<DomainBuilderConfig> & Pick<DomainBuilderConfig, 'domainName'>): DomainBuilder {
    // Reuse existing builder if it's for the same domain (same session)
    if (this.crudState.domainBuilder && this.crudState.currentDomainName === config.domainName) {
      return this.crudState.domainBuilder;
    }
    // Create new builder for new domain
    this.crudState.domainBuilder = new DomainBuilder(this.connection, {}, { ...config, description: config.description || '' });
    this.crudState.currentDomainName = config.domainName;
    return this.crudState.domainBuilder;
  }

  async createDomain(config: Partial<DomainBuilderConfig> & Pick<DomainBuilderConfig, 'domainName' | 'packageName' | 'description'>): Promise<this> {
    const builder = this.getDomainBuilder(config);
    await builder.create();
    this.crudState.createResult = builder.getState().createResult;
    return this;
  }

  async lockDomain(config: Pick<DomainBuilderConfig, 'domainName'>): Promise<this> {
    const builder = this.getDomainBuilder(config);
    await builder.lock();
    this.crudState.lockHandle = builder.getState().lockHandle;
    return this;
  }

  async unlockDomain(config: Pick<DomainBuilderConfig, 'domainName'>, lockHandle?: string): Promise<this> {
    const builder = this.getDomainBuilder(config);
    (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    await builder.unlock();
    this.crudState.unlockResult = builder.getState().unlockResult;
    this.crudState.lockHandle = undefined;
    return this;
  }

  async updateDomain(config: Partial<DomainBuilderConfig> & Pick<DomainBuilderConfig, 'domainName' | 'packageName' | 'description'>, lockHandle?: string): Promise<this> {
    const builder = this.getDomainBuilder(config);
    (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    await builder.update();
    this.crudState.updateResult = builder.getState().updateResult;
    return this;
  }

  async activateDomain(config: Pick<DomainBuilderConfig, 'domainName'>): Promise<this> {
    const builder = this.getDomainBuilder(config);
    await builder.activate();
    this.crudState.activateResult = builder.getState().activateResult;
    return this;
  }

  async checkDomain(config: Pick<DomainBuilderConfig, 'domainName'>, version: 'active' | 'inactive' = 'inactive'): Promise<AxiosResponse> {
    const builder = this.getDomainBuilder(config);
    const result = await builder.check(version);
    this.crudState.checkResult = result;
    return result;
  }

  async validateDomain(config: Pick<DomainBuilderConfig, 'domainName' | 'packageName' | 'description'>): Promise<AxiosResponse> {
    const builder = this.getDomainBuilder(config);
    const result = await builder.validate();
    this.crudState.validationResponse = result;
    return result;
  }

  async deleteDomain(config: Pick<DomainBuilderConfig, 'domainName' | 'transportRequest'>): Promise<this> {
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
  
  private getStructureBuilder(config: Partial<StructureBuilderConfig> & Pick<StructureBuilderConfig, 'structureName'>): StructureBuilder {
    // Reuse existing builder if it's for the same structure (same session)
    if (this.crudState.structureBuilder && this.crudState.currentStructureName === config.structureName) {
      // Update config using setters
      const builder = this.crudState.structureBuilder;
      if (config.description !== undefined) builder.setDescription(config.description);
      if (config.ddlCode !== undefined) builder.setDdlCode(config.ddlCode);
      if (config.packageName !== undefined) builder.setPackage(config.packageName);
      if (config.transportRequest !== undefined) builder.setRequest(config.transportRequest);
      return builder;
    }
    // Create new builder for new structure - ensure all config fields are passed including ddlCode
    this.crudState.structureBuilder = new StructureBuilder(this.connection, {}, { ...config, description: config.description || '' });
    this.crudState.currentStructureName = config.structureName;
    return this.crudState.structureBuilder;
  }

  async createStructure(config: Partial<StructureBuilderConfig> & Pick<StructureBuilderConfig, 'structureName' | 'packageName' | 'description' | 'ddlCode'>): Promise<this> {
    const builder = this.getStructureBuilder(config);
    await builder.create();
    this.crudState.createResult = builder.getState().createResult;
    return this;
  }

  async lockStructure(config: Pick<StructureBuilderConfig, 'structureName'>): Promise<this> {
    const builder = this.getStructureBuilder(config);
    await builder.lock();
    this.crudState.lockHandle = builder.getState().lockHandle;
    return this;
  }

  async unlockStructure(config: Pick<StructureBuilderConfig, 'structureName'>, lockHandle?: string): Promise<this> {
    const builder = this.getStructureBuilder(config);
    (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    await builder.unlock();
    this.crudState.unlockResult = builder.getState().unlockResult;
    this.crudState.lockHandle = undefined;
    return this;
  }

  async updateStructure(config: Partial<StructureBuilderConfig> & Pick<StructureBuilderConfig, 'structureName' | 'ddlCode'>, lockHandle?: string): Promise<this> {
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

  async activateStructure(config: Pick<StructureBuilderConfig, 'structureName'>): Promise<this> {
    const builder = this.getStructureBuilder(config);
    await builder.activate();
    this.crudState.activateResult = builder.getState().activateResult;
    return this;
  }

  async checkStructure(config: Pick<StructureBuilderConfig, 'structureName'>, sourceCode?: string, version: 'active' | 'inactive' = 'inactive'): Promise<AxiosResponse> {
    const builder = this.getStructureBuilder(config);
    const result = await builder.check(version, sourceCode);
    this.crudState.checkResult = result;
    return result;
  }

  async validateStructure(config: Partial<StructureBuilderConfig> & Pick<StructureBuilderConfig, 'structureName' | 'packageName' | 'description'>): Promise<AxiosResponse> {
    const builder = this.getStructureBuilder(config);
    const result = await builder.validate();
    this.crudState.validationResponse = result;
    return result;
  }

  async deleteStructure(config: Pick<StructureBuilderConfig, 'structureName' | 'transportRequest'>): Promise<this> {
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
  
  private getTableBuilder(config: Partial<TableBuilderConfig> & Pick<TableBuilderConfig, 'tableName'>): TableBuilder {
    // Reuse existing builder if it's for the same table (same session)
    if (this.crudState.tableBuilder && this.crudState.currentTableName === config.tableName) {
      // Update config using setters
      const builder = this.crudState.tableBuilder;
      if (config.description !== undefined) builder.setDescription(config.description);
      if (config.ddlCode !== undefined) builder.setDdlCode(config.ddlCode);
      if (config.packageName !== undefined) builder.setPackage(config.packageName);
      if (config.transportRequest !== undefined) builder.setRequest(config.transportRequest);
      return builder;
    }
    // Create new builder for new table - ensure all config fields are passed including ddlCode
    this.crudState.tableBuilder = new TableBuilder(this.connection, {}, { ...config, description: config.description || '' });
    this.crudState.currentTableName = config.tableName;
    return this.crudState.tableBuilder;
  }

  async createTable(config: Partial<TableBuilderConfig> & Pick<TableBuilderConfig, 'tableName' | 'packageName' | 'description' | 'ddlCode'>): Promise<this> {
    const builder = this.getTableBuilder(config);
    await builder.create();
    this.crudState.createResult = builder.getState().createResult;
    return this;
  }

  async lockTable(config: Pick<TableBuilderConfig, 'tableName'>): Promise<this> {
    const builder = this.getTableBuilder(config);
    await builder.lock();
    this.crudState.lockHandle = builder.getState().lockHandle;
    return this;
  }

  async unlockTable(config: Pick<TableBuilderConfig, 'tableName'>, lockHandle?: string): Promise<this> {
    const builder = this.getTableBuilder(config);
    (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    await builder.unlock();
    this.crudState.unlockResult = builder.getState().unlockResult;
    this.crudState.lockHandle = undefined;
    return this;
  }

  async updateTable(config: Partial<TableBuilderConfig> & Pick<TableBuilderConfig, 'tableName' | 'ddlCode'>, lockHandle?: string): Promise<this> {
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

  async activateTable(config: Pick<TableBuilderConfig, 'tableName'>): Promise<this> {
    const builder = this.getTableBuilder(config);
    await builder.activate();
    this.crudState.activateResult = builder.getState().activateResult;
    return this;
  }

  async checkTable(config: Pick<TableBuilderConfig, 'tableName'>, sourceCode?: string, version: 'active' | 'inactive' | 'new' = 'new'): Promise<AxiosResponse> {
    const builder = this.getTableBuilder(config);
    const result = await builder.check('abapCheckRun', sourceCode, version);
    this.crudState.checkResult = result;
    return result;
  }

  async validateTable(config: Partial<TableBuilderConfig> & Pick<TableBuilderConfig, 'tableName' | 'packageName' | 'description'>): Promise<AxiosResponse> {
    const builder = this.getTableBuilder(config);
    const result = await builder.validate();
    this.crudState.validationResponse = result;
    return result;
  }

  async deleteTable(config: Pick<TableBuilderConfig, 'tableName' | 'transportRequest'>): Promise<this> {
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
  
  private getViewBuilder(config: Partial<ViewBuilderConfig> & Pick<ViewBuilderConfig, 'viewName'>): ViewBuilder {
    // Reuse existing builder if it's for the same view (same session)
    if (this.crudState.viewBuilder && this.crudState.currentViewName === config.viewName) {
      return this.crudState.viewBuilder;
    }
    // Create new builder for new view
    this.crudState.viewBuilder = new ViewBuilder(this.connection, {}, { ...config, description: config.description || '' });
    this.crudState.currentViewName = config.viewName;
    return this.crudState.viewBuilder;
  }

  async createView(config: Partial<ViewBuilderConfig> & Pick<ViewBuilderConfig, 'viewName' | 'packageName' | 'description' | 'ddlSource'>): Promise<this> {
    const builder = this.getViewBuilder(config);
    await builder.create();
    this.crudState.createResult = builder.getState().createResult;
    return this;
  }

  async lockView(config: Pick<ViewBuilderConfig, 'viewName'>): Promise<this> {
    const builder = this.getViewBuilder(config);
    await builder.lock();
    this.crudState.lockHandle = builder.getState().lockHandle;
    return this;
  }

  async unlockView(config: Pick<ViewBuilderConfig, 'viewName'>, lockHandle?: string): Promise<this> {
    const builder = this.getViewBuilder(config);
    (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    await builder.unlock();
    this.crudState.unlockResult = builder.getState().unlockResult;
    this.crudState.lockHandle = undefined;
    return this;
  }

  async updateView(config: Partial<ViewBuilderConfig> & Pick<ViewBuilderConfig, 'viewName' | 'ddlSource'>, lockHandle?: string): Promise<this> {
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

  async activateView(config: Pick<ViewBuilderConfig, 'viewName'>): Promise<this> {
    const builder = this.getViewBuilder(config);
    await builder.activate();
    this.crudState.activateResult = builder.getState().activateResult;
    return this;
  }

  async checkView(config: Pick<ViewBuilderConfig, 'viewName'>, sourceCode?: string, version: 'active' | 'inactive' = 'inactive'): Promise<AxiosResponse> {
    const builder = this.getViewBuilder(config);
    const result = await builder.check(version, sourceCode);
    this.crudState.checkResult = result;
    return result;
  }

  async validateView(config: Partial<ViewBuilderConfig> & Pick<ViewBuilderConfig, 'viewName' | 'packageName' | 'description'>): Promise<AxiosResponse> {
    const builder = this.getViewBuilder(config);
    const result = await builder.validate();
    this.crudState.validationResponse = result;
    return result;
  }

  async deleteView(config: Pick<ViewBuilderConfig, 'viewName' | 'transportRequest'>): Promise<this> {
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
  
  private getPackageBuilder(config: Partial<PackageBuilderConfig> & Pick<PackageBuilderConfig, 'packageName' | 'superPackage'>): PackageBuilder {
    // Reuse existing builder if it's for the same package (same session)
    if (this.crudState.packageBuilder && this.crudState.currentPackageName === config.packageName) {
      // Update config using individual setters
      const builder = this.crudState.packageBuilder;
      if (config.description !== undefined) builder.setDescription(config.description);
      if (config.softwareComponent !== undefined) builder.setSoftwareComponent(config.softwareComponent);
      if (config.transportLayer !== undefined) builder.setTransportLayer(config.transportLayer);
      if (config.applicationComponent !== undefined) builder.setApplicationComponent(config.applicationComponent);
      if (config.packageType !== undefined) builder.setPackageType(config.packageType);
      if (config.transportRequest !== undefined) builder.setRequest(config.transportRequest);
      if (config.responsible !== undefined) builder.setResponsible(config.responsible);
      return builder;
    }
    // Create new builder for new package - ensure all config fields are passed including softwareComponent
    this.crudState.packageBuilder = new PackageBuilder(this.connection, {}, { ...config, description: config.description || '' });
    this.crudState.currentPackageName = config.packageName;
    return this.crudState.packageBuilder;
  }

  async createPackage(config: Partial<PackageBuilderConfig> & Pick<PackageBuilderConfig, 'packageName' | 'superPackage' | 'description' | 'softwareComponent'>): Promise<this> {
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
      const errorText = typeof errorData === 'string' ? errorData.toLowerCase() : JSON.stringify(errorData).toLowerCase();
      
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
        } catch (readError) {
          // If reading parent package fails, throw original error
          throw error;
        }
      }
      
      // Re-throw original error if not a software component error or if parent read failed
      throw error;
    }
  }

  async validatePackage(config: Partial<PackageBuilderConfig> & Pick<PackageBuilderConfig, 'packageName' | 'superPackage' | 'description'>): Promise<AxiosResponse> {
    const builder = this.getPackageBuilder(config);
    const result = await builder.validate();
    this.crudState.validationResponse = result;
    return result;
  }

  async deletePackage(config: Pick<PackageBuilderConfig, 'packageName' | 'transportRequest'>): Promise<this> {
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

  async lockPackage(config: Pick<PackageBuilderConfig, 'packageName' | 'superPackage'>): Promise<this> {
    const builder = this.getPackageBuilder(config);
    await builder.lock();
    this.crudState.lockHandle = builder.getState().lockHandle;
    return this;
  }

  async unlockPackage(config: Pick<PackageBuilderConfig, 'packageName' | 'superPackage'>, lockHandle?: string): Promise<this> {
    const builder = this.getPackageBuilder(config);
    (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    await builder.unlock();
    this.crudState.unlockResult = builder.getState().unlockResult;
    this.crudState.lockHandle = undefined;
    return this;
  }

  async updatePackage(config: Partial<PackageBuilderConfig> & Pick<PackageBuilderConfig, 'packageName' | 'superPackage' | 'updatedDescription'>, lockHandle?: string): Promise<this> {
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

  async checkPackage(config: Pick<PackageBuilderConfig, 'packageName' | 'superPackage'>): Promise<AxiosResponse> {
    const builder = this.getPackageBuilder(config);
    const result = await builder.check();
    this.crudState.checkResult = result;
    return result;
  }

  // ==================== Transport operations ====================
  
  async createTransport(description: string, transportType?: 'workbench' | 'customizing'): Promise<this> {
    const builder = new TransportBuilder(this.connection, {}, { description, transportType });
    await builder.create();
    this.crudState.createResult = builder.getState().createResult;
    return this;
  }

  // ==================== BehaviorDefinition operations ====================
  
  async createBehaviorDefinition(config: Partial<BehaviorDefinitionBuilderConfig> & Pick<BehaviorDefinitionBuilderConfig, 'name' | 'packageName' | 'description' | 'rootEntity' | 'implementationType'>): Promise<this> {
    const builder = new BehaviorDefinitionBuilder(this.connection, {}, config);
    await builder.create();
    this.crudState.createResult = builder.getState().createResult;
    return this;
  }

  async lockBehaviorDefinition(config: Partial<BehaviorDefinitionBuilderConfig> & Pick<BehaviorDefinitionBuilderConfig, 'name'>): Promise<this> {
    const builder = new BehaviorDefinitionBuilder(this.connection, {}, { ...config, description: config.description || '', rootEntity: config.rootEntity || '' });
    await builder.lock();
    this.crudState.lockHandle = builder.getLockHandle() || builder.getState().lockHandle;
    return this;
  }

  async unlockBehaviorDefinition(config: Partial<BehaviorDefinitionBuilderConfig> & Pick<BehaviorDefinitionBuilderConfig, 'name'>, lockHandle?: string): Promise<this> {
    const builder = new BehaviorDefinitionBuilder(this.connection, {}, { ...config, description: config.description || '', rootEntity: config.rootEntity || '' });
    (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    await builder.unlock();
    this.crudState.unlockResult = builder.getState().unlockResult;
    this.crudState.lockHandle = undefined;
    return this;
  }

  async updateBehaviorDefinition(config: Partial<BehaviorDefinitionBuilderConfig> & Pick<BehaviorDefinitionBuilderConfig, 'name' | 'sourceCode'>, lockHandle?: string): Promise<this> {
    const builder = new BehaviorDefinitionBuilder(this.connection, {}, { ...config, description: config.description || '', rootEntity: config.rootEntity || '' });
    const effectiveLockHandle = lockHandle || this.crudState.lockHandle;
    if (!effectiveLockHandle) {
      throw new Error(`Lock handle is required for update. Call lockBehaviorDefinition() first or provide lockHandle parameter.`);
    }
    (builder as any).lockHandle = effectiveLockHandle;
    await builder.update();
    this.crudState.updateResult = builder.getState().updateResult;
    return this;
  }

  async activateBehaviorDefinition(config: Partial<BehaviorDefinitionBuilderConfig> & Pick<BehaviorDefinitionBuilderConfig, 'name'>): Promise<this> {
    const builder = new BehaviorDefinitionBuilder(this.connection, {}, { ...config, description: config.description || '', rootEntity: config.rootEntity || '' });
    await builder.activate();
    this.crudState.activateResult = builder.getState().activateResult;
    return this;
  }

  async checkBehaviorDefinition(config: Partial<BehaviorDefinitionBuilderConfig> & Pick<BehaviorDefinitionBuilderConfig, 'name'>, sourceCode?: string, version: 'active' | 'inactive' = 'inactive'): Promise<this> {
    const builder = new BehaviorDefinitionBuilder(this.connection, {}, { ...config, description: config.description || '', rootEntity: config.rootEntity || '' });
    await builder.check(version, sourceCode);
    this.crudState.checkResult = builder.getState().checkResults?.[0];
    return this;
  }

  async validateBehaviorDefinition(config: Partial<BehaviorDefinitionBuilderConfig> & Pick<BehaviorDefinitionBuilderConfig, 'rootEntity' | 'implementationType' | 'description' | 'packageName'>): Promise<this> {
    const builder = new BehaviorDefinitionBuilder(this.connection, {}, { ...config, name: config.name || '', description: config.description, rootEntity: config.rootEntity, implementationType: config.implementationType });
    await builder.validate();
    this.crudState.validationResponse = builder.getState().validationResponse;
    return this;
  }

  async deleteBehaviorDefinition(config: Partial<BehaviorDefinitionBuilderConfig> & Pick<BehaviorDefinitionBuilderConfig, 'name'>): Promise<this> {
    const builder = new BehaviorDefinitionBuilder(this.connection, {}, { ...config, description: config.description || '', rootEntity: config.rootEntity || '', transportRequest: config.transportRequest });
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
  async createBehaviorImplementation(config: Partial<BehaviorImplementationBuilderConfig> & Pick<BehaviorImplementationBuilderConfig, 'className' | 'packageName' | 'behaviorDefinition'>): Promise<this> {
    const builder = new BehaviorImplementationBuilder(this.connection, {}, { 
      ...config, 
      description: config.description || `Behavior Implementation for ${config.behaviorDefinition}`,
      behaviorDefinition: config.behaviorDefinition
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
  async updateBehaviorImplementationMainSource(config: Pick<BehaviorImplementationBuilderConfig, 'className' | 'behaviorDefinition'>, lockHandle?: string): Promise<this> {
    const builder = new BehaviorImplementationBuilder(this.connection, {}, { 
      className: config.className,
      behaviorDefinition: config.behaviorDefinition,
      description: ''
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
    config: Pick<BehaviorImplementationBuilderConfig, 'className' | 'behaviorDefinition' | 'implementationCode'>,
    lockHandle?: string
  ): Promise<this> {
    const builder = new BehaviorImplementationBuilder(this.connection, {}, { 
      className: config.className,
      behaviorDefinition: config.behaviorDefinition,
      description: '',
      implementationCode: config.implementationCode
    });
    (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    await builder.updateImplementations();
    this.crudState.updateResult = builder.getState().updateResult;
    return this;
  }

  /**
   * Validate behavior implementation class name
   */
  async validateBehaviorImplementation(config: Partial<BehaviorImplementationBuilderConfig> & Pick<BehaviorImplementationBuilderConfig, 'className' | 'packageName' | 'behaviorDefinition'>): Promise<AxiosResponse> {
    const { validateBehaviorImplementationName } = await import('../core/behaviorImplementation/validation');
    const result = await validateBehaviorImplementationName(
      this.connection,
      config.className,
      config.packageName,
      config.description,
      config.behaviorDefinition
    );
    this.crudState.validationResponse = result;
    return result;
  }

  /**
   * Get BehaviorImplementationBuilder instance for advanced operations
   */
  getBehaviorImplementationBuilderInstance(config: Partial<BehaviorImplementationBuilderConfig> & Pick<BehaviorImplementationBuilderConfig, 'className' | 'behaviorDefinition'>): BehaviorImplementationBuilder {
    return new BehaviorImplementationBuilder(this.connection, {}, {
      ...config,
      description: config.description || `Behavior Implementation for ${config.behaviorDefinition}`,
      behaviorDefinition: config.behaviorDefinition || ''
    });
  }

  // ==================== MetadataExtension operations ====================
  
  async createMetadataExtension(config: Partial<MetadataExtensionBuilderConfig> & Pick<MetadataExtensionBuilderConfig, 'name' | 'packageName' | 'description'>): Promise<this> {
    const builder = new MetadataExtensionBuilder(this.connection, {}, config);
    await builder.create();
    this.crudState.createResult = builder.getState().createResult;
    return this;
  }

  async lockMetadataExtension(config: Partial<MetadataExtensionBuilderConfig> & Pick<MetadataExtensionBuilderConfig, 'name'>): Promise<this> {
    const builder = new MetadataExtensionBuilder(this.connection, {}, { ...config, description: config.description || '' });
    await builder.lock();
    this.crudState.lockHandle = builder.getState().lockHandle;
    return this;
  }

  async unlockMetadataExtension(config: Partial<MetadataExtensionBuilderConfig> & Pick<MetadataExtensionBuilderConfig, 'name'>, lockHandle?: string): Promise<this> {
    const builder = new MetadataExtensionBuilder(this.connection, {}, { ...config, description: config.description || '' });
    (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    await builder.unlock();
    this.crudState.unlockResult = builder.getState().unlockResult;
    this.crudState.lockHandle = undefined;
    return this;
  }

  async updateMetadataExtension(config: Partial<MetadataExtensionBuilderConfig> & Pick<MetadataExtensionBuilderConfig, 'name' | 'sourceCode'>, lockHandle?: string): Promise<this> {
    const builder = new MetadataExtensionBuilder(this.connection, {}, { ...config, description: config.description || '' });
    (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    await builder.update();
    this.crudState.updateResult = builder.getState().updateResult;
    return this;
  }

  async activateMetadataExtension(config: Partial<MetadataExtensionBuilderConfig> & Pick<MetadataExtensionBuilderConfig, 'name'>): Promise<this> {
    const builder = new MetadataExtensionBuilder(this.connection, {}, { ...config, description: config.description || '' });
    await builder.activate();
    this.crudState.activateResult = builder.getState().activateResult;
    return this;
  }

  async checkMetadataExtension(config: Partial<MetadataExtensionBuilderConfig> & Pick<MetadataExtensionBuilderConfig, 'name'>, sourceCode?: string, version: 'active' | 'inactive' = 'inactive'): Promise<this> {
    const builder = new MetadataExtensionBuilder(this.connection, {}, { ...config, description: config.description || '' });
    await builder.check(version, sourceCode);
    this.crudState.checkResult = builder.getState().checkResult;
    return this;
  }

  async validateMetadataExtension(config: Partial<MetadataExtensionBuilderConfig> & Pick<MetadataExtensionBuilderConfig, 'name' | 'description' | 'packageName'>): Promise<this> {
    const builder = new MetadataExtensionBuilder(this.connection, {}, { ...config, description: config.description, packageName: config.packageName });
    await builder.validate();
    this.crudState.validationResponse = builder.getState().validationResponse;
    return this;
  }

  async deleteMetadataExtension(config: Partial<MetadataExtensionBuilderConfig> & Pick<MetadataExtensionBuilderConfig, 'name'>): Promise<this> {
    const builder = new MetadataExtensionBuilder(this.connection, {}, { ...config, description: config.description || '', transportRequest: config.transportRequest });
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
    preaudit: boolean = false
  ): Promise<AxiosResponse> {
    const { activateObjectsGroup } = await import('../core/shared/groupActivation');
    const result = await activateObjectsGroup(this.connection, objects, preaudit);
    this.crudState.activateResult = result;
    return result;
  }

  /**
   * Check if multiple ABAP objects can be deleted (group deletion check)
   * Uses ADT deletion/check endpoint for batch deletion check
   */
  async checkDeletionGroup(
    objects: Array<{ type: string; name: string }>
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
    transportRequest?: string
  ): Promise<AxiosResponse> {
    const { deleteObjectsGroup } = await import('../core/shared/groupDeletion');
    const result = await deleteObjectsGroup(this.connection, objects, transportRequest);
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
    const { getInactiveObjects } = await import('../core/shared/getInactiveObjects');
    return await getInactiveObjects(this.connection, options);
  }

  /**
   * Parse activation response to extract status and messages
   */
  parseActivationResponse(responseData: string | any): {
    activated: boolean;
    checked: boolean;
    generated: boolean;
    messages: Array<{ type: string; text: string; line?: number; column?: number }>;
  } {
    const { parseActivationResponse } = require('../utils/managementOperations');
    return parseActivationResponse(responseData);
  }

  // ==================== Service Definition operations ====================
  
  private getServiceDefinitionBuilder(config: Partial<ServiceDefinitionBuilderConfig> & Pick<ServiceDefinitionBuilderConfig, 'serviceDefinitionName'>): ServiceDefinitionBuilder {
    // Reuse existing builder if it's for the same service definition (same session)
    if (this.crudState.serviceDefinitionBuilder && this.crudState.currentServiceDefinitionName === config.serviceDefinitionName) {
      return this.crudState.serviceDefinitionBuilder;
    }
    // Create new builder for new service definition
    // Only include description if it's explicitly provided in config
    const builderConfig: ServiceDefinitionBuilderConfig = {
      serviceDefinitionName: config.serviceDefinitionName,
      ...(config.packageName && { packageName: config.packageName }),
      ...(config.transportRequest && { transportRequest: config.transportRequest }),
      ...(config.description && { description: config.description }),
      ...(config.sourceCode && { sourceCode: config.sourceCode })
    };
    this.crudState.serviceDefinitionBuilder = new ServiceDefinitionBuilder(this.connection, {}, builderConfig);
    this.crudState.currentServiceDefinitionName = config.serviceDefinitionName;
    return this.crudState.serviceDefinitionBuilder;
  }

  async createServiceDefinition(config: Partial<ServiceDefinitionBuilderConfig> & Pick<ServiceDefinitionBuilderConfig, 'serviceDefinitionName' | 'packageName' | 'description'>): Promise<this> {
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

  async lockServiceDefinition(config: Pick<ServiceDefinitionBuilderConfig, 'serviceDefinitionName'>): Promise<this> {
    const builder = this.getServiceDefinitionBuilder(config);
    await builder.lock();
    this.crudState.lockHandle = builder.getState().lockHandle;
    return this;
  }

  async unlockServiceDefinition(config: Pick<ServiceDefinitionBuilderConfig, 'serviceDefinitionName'>, lockHandle?: string): Promise<this> {
    const builder = this.getServiceDefinitionBuilder(config);
    (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    await builder.unlock();
    this.crudState.unlockResult = builder.getState().unlockResult;
    this.crudState.lockHandle = undefined;
    return this;
  }

  async updateServiceDefinition(config: Partial<ServiceDefinitionBuilderConfig> & Pick<ServiceDefinitionBuilderConfig, 'serviceDefinitionName' | 'sourceCode'>, lockHandle?: string): Promise<this> {
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

  async activateServiceDefinition(config: Pick<ServiceDefinitionBuilderConfig, 'serviceDefinitionName'>): Promise<this> {
    const builder = this.getServiceDefinitionBuilder(config);
    await builder.activate();
    this.crudState.activateResult = builder.getState().activateResult;
    return this;
  }

  async checkServiceDefinition(config: Pick<ServiceDefinitionBuilderConfig, 'serviceDefinitionName'>, sourceCode?: string, version: 'active' | 'inactive' = 'inactive'): Promise<AxiosResponse> {
    const builder = this.getServiceDefinitionBuilder(config);
    const result = await builder.check(version, sourceCode);
    this.crudState.checkResult = builder.getState().checkResult;
    return result;
  }

  async validateServiceDefinition(config: Partial<ServiceDefinitionBuilderConfig> & Pick<ServiceDefinitionBuilderConfig, 'serviceDefinitionName' | 'description'>): Promise<AxiosResponse> {
    const builder = this.getServiceDefinitionBuilder(config);
    // Ensure description is set on builder before validate
    if (config.description) {
      builder.setDescription(config.description);
    }
    const result = await builder.validate();
    this.crudState.validationResponse = builder.getState().validationResponse;
    return result;
  }

  async deleteServiceDefinition(config: Pick<ServiceDefinitionBuilderConfig, 'serviceDefinitionName'>, transportRequest?: string): Promise<this> {
    const builder = this.getServiceDefinitionBuilder({ ...config, transportRequest });
    await builder.delete();
    this.crudState.deleteResult = builder.getState().deleteResult;
    return this;
  }

  /**
   * Get ServiceDefinitionBuilder instance for advanced operations
   */
  getServiceDefinitionBuilderInstance(config: Partial<ServiceDefinitionBuilderConfig> & Pick<ServiceDefinitionBuilderConfig, 'serviceDefinitionName'>): ServiceDefinitionBuilder {
    return this.getServiceDefinitionBuilder(config);
  }
}
