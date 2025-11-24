/**
 * CrudClient - Full CRUD operations for SAP ADT
 *
 * Extends ReadOnlyClient with Create, Update, Lock, Unlock, Activate, Check, Validate operations.
 * Methods return `this` for chaining. Results stored in state and accessible via getters.
 */

import { ReadOnlyClient } from './ReadOnlyClient';
import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { ProgramBuilder } from '../core/program';
import {
  ClassBuilder,
  startClassUnitTestRun,
  getClassUnitTestStatus,
  getClassUnitTestResult,
  ClassUnitTestDefinition,
  ClassUnitTestRunOptions
} from '../core/class';
import { InterfaceBuilder } from '../core/interface';
import { DataElementBuilder } from '../core/dataElement';
import { DomainBuilder } from '../core/domain';
import { StructureBuilder } from '../core/structure';
import { TableBuilder } from '../core/table';
import { ViewBuilder } from '../core/view';
import { FunctionGroupBuilder } from '../core/functionGroup';
import { FunctionModuleBuilder } from '../core/functionModule';
import { PackageBuilder } from '../core/package';
import { TransportBuilder } from '../core/transport';
import { BehaviorDefinitionBuilder } from '../core/behaviorDefinition';
import { MetadataExtensionBuilder } from '../core/metadataExtension';

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
  validationResult?: any;
  // Note: readResult is in ReadOnlyClient's separate private state
}

export class CrudClient extends ReadOnlyClient {
  private crudState: CrudClientState = {};
  
  constructor(connection: AbapConnection) {
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
  getValidationResult(): any | undefined { return this.crudState.validationResult; }

  // ==================== Program operations ====================
  
  async createProgram(
    programName: string, 
    description: string, 
    packageName: string, 
    transportRequest?: string,
    options?: { masterSystem?: string; responsible?: string; programType?: string; application?: string }
  ): Promise<this> {
    const builder = new ProgramBuilder(this.connection, {}, { programName, description, packageName, transportRequest, ...options });
    await builder.create();
    this.crudState.createResult = builder.getState().createResult;
    return this;
  }

  async lockProgram(programName: string): Promise<this> {
    const builder = new ProgramBuilder(this.connection, {}, { programName, description: '' });
    await builder.lock();
    this.crudState.lockHandle = builder.getState().lockHandle;
    return this;
  }

  async unlockProgram(programName: string, lockHandle?: string): Promise<this> {
    const builder = new ProgramBuilder(this.connection, {}, { programName, description: '' });
    (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    await builder.unlock();
    this.crudState.unlockResult = builder.getState().unlockResult;
    this.crudState.lockHandle = undefined;
    return this;
  }

  async updateProgram(programName: string, sourceCode: string, lockHandle?: string): Promise<this> {
    const builder = new ProgramBuilder(this.connection, {}, { programName, description: '', sourceCode });
    (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    await builder.update();
    this.crudState.updateResult = builder.getState().updateResult;
    return this;
  }

  async activateProgram(programName: string): Promise<this> {
    const builder = new ProgramBuilder(this.connection, {}, { programName, description: '' });
    await builder.activate();
    this.crudState.activateResult = builder.getState().activateResult;
    return this;
  }

  async checkProgram(programName: string): Promise<this> {
    const builder = new ProgramBuilder(this.connection, {}, { programName, description: '' });
    await builder.check();
    this.crudState.checkResult = builder.getState().checkResult;
    return this;
  }

  async validateProgram(programName: string): Promise<this> {
    const builder = new ProgramBuilder(this.connection, {}, { programName, description: '' });
    await builder.validate();
    this.crudState.validationResult = builder.getState().validationResult;
    return this;
  }

  async deleteProgram(programName: string, transportRequest?: string): Promise<this> {
    const builder = new ProgramBuilder(this.connection, {}, { programName, description: '', transportRequest });
    await builder.delete();
    this.crudState.deleteResult = builder.getState().deleteResult;
    return this;
  }

  // ==================== Class operations ====================
  
  async createClass(
    className: string, 
    description: string, 
    packageName: string, 
    transportRequest?: string,
    options?: { superclass?: string; final?: boolean; abstract?: boolean; createProtected?: boolean; masterSystem?: string; responsible?: string }
  ): Promise<this> {
    const builder = new ClassBuilder(this.connection, {}, { className, description, packageName, transportRequest, ...options });
    await builder.create();
    this.crudState.createResult = builder.getState().createResult;
    return this;
  }

  async lockClass(className: string): Promise<this> {
    const builder = new ClassBuilder(this.connection, {}, { className, description: '' });
    await builder.lock();
    this.crudState.lockHandle = builder.getState().lockHandle;
    return this;
  }

  async unlockClass(className: string, lockHandle?: string): Promise<this> {
    const builder = new ClassBuilder(this.connection, {}, { className, description: '' });
    (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    await builder.unlock();
    this.crudState.unlockResult = builder.getState().unlockResult;
    this.crudState.lockHandle = undefined;
    return this;
  }

  async updateClass(className: string, sourceCode: string, lockHandle?: string): Promise<this> {
    const builder = new ClassBuilder(this.connection, {}, { className, description: '' });
    (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    builder.setCode(sourceCode);
    await builder.update();
    this.crudState.updateResult = builder.getState().updateResult;
    return this;
  }

  async updateClassTestIncludes(className: string, testClassSource: string, lockHandle?: string): Promise<this> {
    const builder = new ClassBuilder(this.connection, {}, { className, description: '' });
    builder.setTestClassCode(testClassSource);
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

  async lockTestClasses(className: string): Promise<this> {
    const builder = new ClassBuilder(this.connection, {}, { className, description: '' });
    await builder.lockTestClasses();
    this.crudState.testClassLockHandle = builder.getState().testLockHandle;
    return this;
  }

  async unlockTestClasses(className: string, lockHandle?: string): Promise<this> {
    const builder = new ClassBuilder(this.connection, {}, { className, description: '' });
    (builder as any).testLockHandle = lockHandle || this.crudState.testClassLockHandle;
    await builder.unlockTestClasses();
    this.crudState.testClassLockHandle = undefined;
    return this;
  }

  async activateTestClasses(className: string, testClassName: string): Promise<this> {
    const builder = new ClassBuilder(this.connection, {}, { className, description: '', testClassName });
    await builder.activateTestClasses();
    this.crudState.testClassActivateResult = builder.getState().testActivateResult;
    return this;
  }

  async activateClass(className: string): Promise<this> {
    const builder = new ClassBuilder(this.connection, {}, { className, description: '' });
    await builder.activate();
    this.crudState.activateResult = builder.getState().activateResult;
    return this;
  }

  async checkClass(className: string): Promise<this> {
    const builder = new ClassBuilder(this.connection, {}, { className, description: '' });
    await builder.check();
    this.crudState.checkResult = builder.getState().checkResult;
    return this;
  }

  async validateClass(className: string): Promise<this> {
    const builder = new ClassBuilder(this.connection, {}, { className, description: '' });
    await builder.validate();
    this.crudState.validationResult = builder.getState().validationResult;
    return this;
  }

  async deleteClass(className: string, transportRequest?: string): Promise<this> {
    const builder = new ClassBuilder(this.connection, {}, { className, description: '', transportRequest });
    await builder.delete();
    this.crudState.deleteResult = builder.getState().deleteResult;
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
  
  async createInterface(
    interfaceName: string, 
    description: string, 
    packageName: string, 
    transportRequest?: string,
    options?: { masterSystem?: string; responsible?: string }
  ): Promise<this> {
    const builder = new InterfaceBuilder(this.connection, {}, { interfaceName, description, packageName, transportRequest, ...options });
    await builder.create();
    this.crudState.createResult = builder.getState().createResult;
    return this;
  }

  async lockInterface(interfaceName: string): Promise<this> {
    const builder = new InterfaceBuilder(this.connection, {}, { interfaceName, description: '' });
    await builder.lock();
    this.crudState.lockHandle = builder.getState().lockHandle;
    return this;
  }

  async unlockInterface(interfaceName: string, lockHandle?: string): Promise<this> {
    const builder = new InterfaceBuilder(this.connection, {}, { interfaceName, description: '' });
    (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    await builder.unlock();
    this.crudState.unlockResult = builder.getState().unlockResult;
    this.crudState.lockHandle = undefined;
    return this;
  }

  async updateInterface(interfaceName: string, sourceCode: string, lockHandle?: string): Promise<this> {
    const builder = new InterfaceBuilder(this.connection, {}, { interfaceName, description: '', sourceCode });
    (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    await builder.update();
    this.crudState.updateResult = builder.getState().updateResult;
    return this;
  }

  async activateInterface(interfaceName: string): Promise<this> {
    const builder = new InterfaceBuilder(this.connection, {}, { interfaceName, description: '' });
    await builder.activate();
    this.crudState.activateResult = builder.getState().activateResult;
    return this;
  }

  async checkInterface(interfaceName: string): Promise<this> {
    const builder = new InterfaceBuilder(this.connection, {}, { interfaceName, description: '' });
    await builder.check();
    this.crudState.checkResult = builder.getState().checkResult;
    return this;
  }

  async validateInterface(interfaceName: string): Promise<this> {
    const builder = new InterfaceBuilder(this.connection, {}, { interfaceName, description: '' });
    await builder.validate();
    this.crudState.validationResult = builder.getState().validationResult;
    return this;
  }

  async deleteInterface(interfaceName: string, transportRequest?: string): Promise<this> {
    const builder = new InterfaceBuilder(this.connection, {}, { interfaceName, description: '', transportRequest });
    await builder.delete();
    this.crudState.deleteResult = builder.getState().deleteResult;
    return this;
  }


  // ==================== FunctionModule operations ====================
  
  async createFunctionModule(
    functionModuleName: string,
    functionGroupName: string,
    description: string,
    packageName: string,
    transportRequest?: string
  ): Promise<this> {
    const builder = new FunctionModuleBuilder(this.connection, {}, { 
      functionModuleName, 
      functionGroupName, 
      description, 
      packageName, 
      transportRequest 
    });
    await builder.create();
    this.crudState.createResult = builder.getState().createResult;
    return this;
  }

  async lockFunctionModule(functionModuleName: string, functionGroupName: string): Promise<this> {
    const builder = new FunctionModuleBuilder(this.connection, {}, { functionModuleName, functionGroupName, description: '' });
    await builder.lock();
    this.crudState.lockHandle = builder.getState().lockHandle;
    return this;
  }

  async unlockFunctionModule(functionModuleName: string, functionGroupName: string, lockHandle?: string): Promise<this> {
    const builder = new FunctionModuleBuilder(this.connection, {}, { functionModuleName, functionGroupName, description: '' });
    (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    await builder.unlock();
    this.crudState.unlockResult = builder.getState().unlockResult;
    this.crudState.lockHandle = undefined;
    return this;
  }

  async updateFunctionModule(functionModuleName: string, functionGroupName: string, sourceCode: string, lockHandle?: string): Promise<this> {
    const builder = new FunctionModuleBuilder(this.connection, {}, { functionModuleName, functionGroupName, description: '', sourceCode });
    (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    await builder.update();
    this.crudState.updateResult = builder.getState().updateResult;
    return this;
  }

  async activateFunctionModule(functionModuleName: string, functionGroupName: string): Promise<this> {
    const builder = new FunctionModuleBuilder(this.connection, {}, { functionModuleName, functionGroupName, description: '' });
    await builder.activate();
    this.crudState.activateResult = builder.getState().activateResult;
    return this;
  }

  async checkFunctionModule(functionModuleName: string, functionGroupName: string): Promise<this> {
    const builder = new FunctionModuleBuilder(this.connection, {}, { functionModuleName, functionGroupName, description: '' });
    await builder.check();
    this.crudState.checkResult = builder.getState().checkResult;
    return this;
  }

  async validateFunctionModule(functionModuleName: string, functionGroupName: string): Promise<this> {
    const builder = new FunctionModuleBuilder(this.connection, {}, { functionModuleName, functionGroupName, description: '' });
    await builder.validate();
    this.crudState.validationResult = builder.getState().validationResult;
    return this;
  }

  async deleteFunctionModule(functionModuleName: string, functionGroupName: string, transportRequest?: string): Promise<this> {
    const builder = new FunctionModuleBuilder(this.connection, {}, { functionModuleName, functionGroupName, description: '', transportRequest });
    await builder.delete();
    this.crudState.deleteResult = builder.getState().deleteResult;
    return this;
  }

  // ==================== FunctionGroup operations ====================
  
  async createFunctionGroup(functionGroupName: string, description: string, packageName: string, transportRequest?: string): Promise<this> {
    const builder = new FunctionGroupBuilder(this.connection, {}, { functionGroupName, description, packageName, transportRequest });
    await builder.create();
    this.crudState.createResult = builder.getState().createResult;
    return this;
  }

  async lockFunctionGroup(functionGroupName: string): Promise<this> {
    const builder = new FunctionGroupBuilder(this.connection, {}, { functionGroupName, description: '' });
    await builder.lock();
    this.crudState.lockHandle = builder.getState().lockHandle;
    return this;
  }

  async unlockFunctionGroup(functionGroupName: string, lockHandle?: string): Promise<this> {
    const builder = new FunctionGroupBuilder(this.connection, {}, { functionGroupName, description: '' });
    (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    await builder.unlock();
    this.crudState.unlockResult = builder.getState().unlockResult;
    this.crudState.lockHandle = undefined;
    return this;
  }

  async activateFunctionGroup(functionGroupName: string): Promise<this> {
    const builder = new FunctionGroupBuilder(this.connection, {}, { functionGroupName, description: '' });
    await builder.activate();
    this.crudState.activateResult = builder.getState().activateResult;
    return this;
  }

  async checkFunctionGroup(functionGroupName: string): Promise<this> {
    const builder = new FunctionGroupBuilder(this.connection, {}, { functionGroupName, description: '' });
    await builder.check();
    this.crudState.checkResult = builder.getState().checkResult;
    return this;
  }

  async validateFunctionGroup(functionGroupName: string): Promise<this> {
    const builder = new FunctionGroupBuilder(this.connection, {}, { functionGroupName, description: '' });
    await builder.validate();
    this.crudState.validationResult = builder.getState().validationResult;
    return this;
  }

  async deleteFunctionGroup(functionGroupName: string, transportRequest?: string): Promise<this> {
    const builder = new FunctionGroupBuilder(this.connection, {}, { functionGroupName, description: '', transportRequest });
    await builder.delete();
    this.crudState.deleteResult = builder.getState().deleteResult;
    return this;
  }


  // ==================== DataElement operations ====================
  
  async createDataElement(dataElementName: string, description: string, packageName: string, transportRequest?: string): Promise<this> {
    const builder = new DataElementBuilder(this.connection, {}, { dataElementName, description, packageName, transportRequest });
    await builder.create();
    this.crudState.createResult = builder.getState().createResult;
    return this;
  }

  async lockDataElement(dataElementName: string): Promise<this> {
    const builder = new DataElementBuilder(this.connection, {}, { dataElementName, description: '' });
    await builder.lock();
    this.crudState.lockHandle = builder.getState().lockHandle;
    return this;
  }

  async unlockDataElement(dataElementName: string, lockHandle?: string): Promise<this> {
    const builder = new DataElementBuilder(this.connection, {}, { dataElementName, description: '' });
    (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    await builder.unlock();
    this.crudState.unlockResult = builder.getState().unlockResult;
    this.crudState.lockHandle = undefined;
    return this;
  }

  async updateDataElement(dataElementName: string, properties: any, lockHandle?: string): Promise<this> {
    const builder = new DataElementBuilder(this.connection, {}, { dataElementName, description: '', ...properties });
    (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    await builder.update();
    this.crudState.updateResult = builder.getState().updateResult;
    return this;
  }

  async activateDataElement(dataElementName: string): Promise<this> {
    const builder = new DataElementBuilder(this.connection, {}, { dataElementName, description: '' });
    await builder.activate();
    this.crudState.activateResult = builder.getState().activateResult;
    return this;
  }

  async checkDataElement(dataElementName: string): Promise<this> {
    const builder = new DataElementBuilder(this.connection, {}, { dataElementName, description: '' });
    await builder.check();
    this.crudState.checkResult = builder.getState().checkResult;
    return this;
  }

  async validateDataElement(dataElementName: string): Promise<this> {
    const builder = new DataElementBuilder(this.connection, {}, { dataElementName, description: '' });
    await builder.validate();
    this.crudState.validationResult = builder.getState().validationResult;
    return this;
  }

  async deleteDataElement(dataElementName: string, transportRequest?: string): Promise<this> {
    const builder = new DataElementBuilder(this.connection, {}, { dataElementName, description: '', transportRequest });
    await builder.delete();
    this.crudState.deleteResult = builder.getState().deleteResult;
    return this;
  }


  // ==================== Domain operations ====================
  
  async createDomain(domainName: string, description: string, packageName: string, transportRequest?: string): Promise<this> {
    const builder = new DomainBuilder(this.connection, {}, { domainName, description, packageName, transportRequest });
    await builder.create();
    this.crudState.createResult = builder.getState().createResult;
    return this;
  }

  async lockDomain(domainName: string): Promise<this> {
    const builder = new DomainBuilder(this.connection, {}, { domainName, description: '' });
    await builder.lock();
    this.crudState.lockHandle = builder.getState().lockHandle;
    return this;
  }

  async unlockDomain(domainName: string, lockHandle?: string): Promise<this> {
    const builder = new DomainBuilder(this.connection, {}, { domainName, description: '' });
    (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    await builder.unlock();
    this.crudState.unlockResult = builder.getState().unlockResult;
    this.crudState.lockHandle = undefined;
    return this;
  }

  async updateDomain(domainName: string, properties: any, lockHandle?: string): Promise<this> {
    const builder = new DomainBuilder(this.connection, {}, { domainName, description: '', ...properties });
    (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    await builder.update();
    this.crudState.updateResult = builder.getState().updateResult;
    return this;
  }

  async activateDomain(domainName: string): Promise<this> {
    const builder = new DomainBuilder(this.connection, {}, { domainName, description: '' });
    await builder.activate();
    this.crudState.activateResult = builder.getState().activateResult;
    return this;
  }

  async checkDomain(domainName: string): Promise<this> {
    const builder = new DomainBuilder(this.connection, {}, { domainName, description: '' });
    await builder.check();
    this.crudState.checkResult = builder.getState().checkResult;
    return this;
  }

  async validateDomain(domainName: string): Promise<this> {
    const builder = new DomainBuilder(this.connection, {}, { domainName, description: '' });
    await builder.validate();
    this.crudState.validationResult = builder.getState().validationResult;
    return this;
  }

  async deleteDomain(domainName: string, transportRequest?: string): Promise<this> {
    const builder = new DomainBuilder(this.connection, {}, { domainName, description: '', transportRequest });
    await builder.delete();
    this.crudState.deleteResult = builder.getState().deleteResult;
    return this;
  }


  // ==================== Structure operations ====================
  
  async createStructure(structureName: string, description: string, packageName: string, transportRequest?: string): Promise<this> {
    const builder = new StructureBuilder(this.connection, {}, { structureName, description, packageName, transportRequest });
    await builder.create();
    this.crudState.createResult = builder.getState().createResult;
    return this;
  }

  async lockStructure(structureName: string): Promise<this> {
    const builder = new StructureBuilder(this.connection, {}, { structureName, description: '' });
    await builder.lock();
    this.crudState.lockHandle = builder.getState().lockHandle;
    return this;
  }

  async unlockStructure(structureName: string, lockHandle?: string): Promise<this> {
    const builder = new StructureBuilder(this.connection, {}, { structureName, description: '' });
    (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    await builder.unlock();
    this.crudState.unlockResult = builder.getState().unlockResult;
    this.crudState.lockHandle = undefined;
    return this;
  }

  async updateStructure(structureName: string, ddlCode: string, lockHandle?: string): Promise<this> {
    const builder = new StructureBuilder(this.connection, {}, { structureName, description: '', ddlCode });
    (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    await builder.update();
    this.crudState.updateResult = builder.getState().updateResult;
    return this;
  }

  async activateStructure(structureName: string): Promise<this> {
    const builder = new StructureBuilder(this.connection, {}, { structureName, description: '' });
    await builder.activate();
    this.crudState.activateResult = builder.getState().activateResult;
    return this;
  }

  async checkStructure(structureName: string): Promise<this> {
    const builder = new StructureBuilder(this.connection, {}, { structureName, description: '' });
    await builder.check();
    this.crudState.checkResult = builder.getState().checkResult;
    return this;
  }

  async validateStructure(structureName: string): Promise<this> {
    const builder = new StructureBuilder(this.connection, {}, { structureName, description: '' });
    await builder.validate();
    this.crudState.validationResult = builder.getState().validationResult;
    return this;
  }

  async deleteStructure(structureName: string, transportRequest?: string): Promise<this> {
    const builder = new StructureBuilder(this.connection, {}, { structureName, description: '', transportRequest });
    await builder.delete();
    this.crudState.deleteResult = builder.getState().deleteResult;
    return this;
  }


  // ==================== Table operations ====================
  
  async createTable(tableName: string, packageName: string, transportRequest?: string): Promise<this> {
    const builder = new TableBuilder(this.connection, {}, { tableName, packageName, transportRequest });
    await builder.create();
    this.crudState.createResult = builder.getState().createResult;
    return this;
  }

  async lockTable(tableName: string): Promise<this> {
    const builder = new TableBuilder(this.connection, {}, { tableName });
    await builder.lock();
    this.crudState.lockHandle = builder.getState().lockHandle;
    return this;
  }

  async unlockTable(tableName: string, lockHandle?: string): Promise<this> {
    const builder = new TableBuilder(this.connection, {}, { tableName });
    (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    await builder.unlock();
    this.crudState.unlockResult = builder.getState().unlockResult;
    this.crudState.lockHandle = undefined;
    return this;
  }

  async updateTable(tableName: string, ddlCode: string, lockHandle?: string): Promise<this> {
    const builder = new TableBuilder(this.connection, {}, { tableName, ddlCode });
    (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    await builder.update();
    this.crudState.updateResult = builder.getState().updateResult;
    return this;
  }

  async activateTable(tableName: string): Promise<this> {
    const builder = new TableBuilder(this.connection, {}, { tableName });
    await builder.activate();
    this.crudState.activateResult = builder.getState().activateResult;
    return this;
  }

  async checkTable(tableName: string): Promise<this> {
    const builder = new TableBuilder(this.connection, {}, { tableName });
    await builder.check();
    this.crudState.checkResult = builder.getState().checkResult;
    return this;
  }

  async validateTable(tableName: string): Promise<this> {
    const builder = new TableBuilder(this.connection, {}, { tableName });
    await builder.validate();
    this.crudState.validationResult = builder.getState().validationResult;
    return this;
  }

  async deleteTable(tableName: string, transportRequest?: string): Promise<this> {
    const builder = new TableBuilder(this.connection, {}, { tableName, transportRequest });
    await builder.delete();
    this.crudState.deleteResult = builder.getState().deleteResult;
    return this;
  }


  // ==================== View operations ====================
  
  async createView(viewName: string, description: string, packageName: string, transportRequest?: string): Promise<this> {
    const builder = new ViewBuilder(this.connection, {}, { viewName, description, packageName, transportRequest });
    await builder.create();
    this.crudState.createResult = builder.getState().createResult;
    return this;
  }

  async lockView(viewName: string): Promise<this> {
    const builder = new ViewBuilder(this.connection, {}, { viewName, description: '' });
    await builder.lock();
    this.crudState.lockHandle = builder.getState().lockHandle;
    return this;
  }

  async unlockView(viewName: string, lockHandle?: string): Promise<this> {
    const builder = new ViewBuilder(this.connection, {}, { viewName, description: '' });
    (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    await builder.unlock();
    this.crudState.unlockResult = builder.getState().unlockResult;
    this.crudState.lockHandle = undefined;
    return this;
  }

  async updateView(viewName: string, ddlSource: string, lockHandle?: string): Promise<this> {
    const builder = new ViewBuilder(this.connection, {}, { viewName, description: '', ddlSource });
    (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    await builder.update();
    this.crudState.updateResult = builder.getState().updateResult;
    return this;
  }

  async activateView(viewName: string): Promise<this> {
    const builder = new ViewBuilder(this.connection, {}, { viewName, description: '' });
    await builder.activate();
    this.crudState.activateResult = builder.getState().activateResult;
    return this;
  }

  async checkView(viewName: string): Promise<this> {
    const builder = new ViewBuilder(this.connection, {}, { viewName, description: '' });
    await builder.check();
    this.crudState.checkResult = builder.getState().checkResult;
    return this;
  }

  async validateView(viewName: string): Promise<this> {
    const builder = new ViewBuilder(this.connection, {}, { viewName, description: '' });
    await builder.validate();
    this.crudState.validationResult = builder.getState().validationResult;
    return this;
  }

  async deleteView(viewName: string, transportRequest?: string): Promise<this> {
    const builder = new ViewBuilder(this.connection, {}, { viewName, description: '', transportRequest });
    await builder.delete();
    this.crudState.deleteResult = builder.getState().deleteResult;
    return this;
  }


  // ==================== Package operations ====================
  
  async createPackage(
    packageName: string,
    superPackage: string,
    description: string,
    transportOrOptions?:
      | string
      | {
          packageType?: string;
          softwareComponent?: string;
          transportLayer?: string;
          transportRequest?: string;
          applicationComponent?: string;
          responsible?: string;
        }
  ): Promise<this> {
    const options =
      typeof transportOrOptions === 'string' || transportOrOptions === undefined
        ? { transportRequest: transportOrOptions }
        : transportOrOptions;

    const builder = new PackageBuilder(this.connection, {}, {
      packageName,
      superPackage,
      description,
      packageType: options?.packageType,
      softwareComponent: options?.softwareComponent,
      transportLayer: options?.transportLayer,
      transportRequest: options?.transportRequest,
      applicationComponent: options?.applicationComponent,
      responsible: options?.responsible
    });
    await builder.create();
    this.crudState.createResult = builder.getState().createResult;
    return this;
  }

  async validatePackage(packageName: string, superPackage: string): Promise<this> {
    const builder = new PackageBuilder(this.connection, {}, { packageName, superPackage, description: '' });
    await builder.validate();
    this.crudState.validationResult = builder.getState().validationResult;
    return this;
  }

  async deletePackage(packageName: string, transportRequest?: string): Promise<this> {
    const builder = new PackageBuilder(this.connection, {}, { packageName, superPackage: '', description: '', transportRequest });
    await builder.delete();
    this.crudState.deleteResult = builder.getState().deleteResult;
    return this;
  }


  async lockPackage(packageName: string, superPackage: string): Promise<this> {
    const builder = new PackageBuilder(this.connection, {}, { packageName, superPackage, description: '' });
    await builder.lock();
    this.crudState.lockHandle = builder.getState().lockHandle;
    return this;
  }

  async unlockPackage(packageName: string, superPackage: string, lockHandle?: string): Promise<this> {
    const builder = new PackageBuilder(this.connection, {}, { packageName, superPackage, description: '' });
    (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    await builder.unlock();
    this.crudState.unlockResult = builder.getState().unlockResult;
    this.crudState.lockHandle = undefined;
    return this;
  }

  async updatePackage(packageName: string, superPackage: string, updatedDescription: string, lockHandle?: string): Promise<this> {
    const builder = new PackageBuilder(this.connection, {}, { packageName, superPackage, description: '', updatedDescription });
    (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    await builder.update();
    this.crudState.updateResult = builder.getState().updateResult;
    return this;
  }

  async checkPackage(packageName: string, superPackage: string): Promise<this> {
    const builder = new PackageBuilder(this.connection, {}, { packageName, superPackage, description: '' });
    await builder.check();
    // checkResult is void for Package
    return this;
  }

  // ==================== Transport operations ====================
  
  async createTransport(description: string, transportType?: 'workbench' | 'customizing'): Promise<this> {
    const builder = new TransportBuilder(this.connection, {}, { description, transportType });
    await builder.create();
    this.crudState.createResult = builder.getState().createResult;
    return this;
  }

  // ==================== BehaviorDefinition operations ====================
  
  async createBehaviorDefinition(
    name: string,
    description: string,
    packageName: string,
    transportRequest: string,
    rootEntity: string,
    implementationType: 'Managed' | 'Unmanaged' | 'Abstract' | 'Projection',
    options?: { masterSystem?: string; responsible?: string }
  ): Promise<this> {
    const builder = new BehaviorDefinitionBuilder(
      this.connection, 
      {}, 
      { name, description, packageName, transportRequest, rootEntity, implementationType, ...options }
    );
    await builder.create();
    this.crudState.createResult = builder.getState().createResult;
    return this;
  }

  async lockBehaviorDefinition(name: string): Promise<this> {
    const builder = new BehaviorDefinitionBuilder(this.connection, {}, { name, description: '', rootEntity: '' });
    await builder.lock();
    this.crudState.lockHandle = builder.getState().lockHandle;
    return this;
  }

  async unlockBehaviorDefinition(name: string, lockHandle?: string): Promise<this> {
    const builder = new BehaviorDefinitionBuilder(this.connection, {}, { name, description: '', rootEntity: '' });
    (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    await builder.unlock();
    this.crudState.unlockResult = builder.getState().unlockResult;
    this.crudState.lockHandle = undefined;
    return this;
  }

  async updateBehaviorDefinition(name: string, sourceCode: string, lockHandle?: string): Promise<this> {
    const builder = new BehaviorDefinitionBuilder(this.connection, {}, { name, description: '', rootEntity: '', sourceCode });
    (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    await builder.update();
    this.crudState.updateResult = builder.getState().updateResult;
    return this;
  }

  async activateBehaviorDefinition(name: string): Promise<this> {
    const builder = new BehaviorDefinitionBuilder(this.connection, {}, { name, description: '', rootEntity: '' });
    await builder.activate();
    this.crudState.activateResult = builder.getState().activateResult;
    return this;
  }

  async checkBehaviorDefinition(name: string, version: 'active' | 'inactive' = 'inactive'): Promise<this> {
    const builder = new BehaviorDefinitionBuilder(this.connection, {}, { name, description: '', rootEntity: '' });
    await builder.check(version);
    this.crudState.checkResult = builder.getState().checkResults?.[0];
    return this;
  }

  async validateBehaviorDefinition(rootEntity: string, implementationType: 'Managed' | 'Unmanaged' | 'Abstract' | 'Projection'): Promise<this> {
    const builder = new BehaviorDefinitionBuilder(this.connection, {}, { name: '', description: '', rootEntity, implementationType });
    await builder.validate();
    this.crudState.validationResult = builder.getState().validationResult;
    return this;
  }

  async deleteBehaviorDefinition(name: string, transportRequest?: string): Promise<this> {
    const builder = new BehaviorDefinitionBuilder(this.connection, {}, { name, description: '', rootEntity: '', transportRequest });
    await builder.checkDeletion();
    await builder.delete();
    this.crudState.deleteResult = builder.getState().deleteResult;
    return this;
  }

  // ==================== MetadataExtension operations ====================
  
  async createMetadataExtension(
    name: string,
    description: string,
    packageName: string,
    transportRequest?: string,
    options?: { masterLanguage?: string; masterSystem?: string; responsible?: string }
  ): Promise<this> {
    const builder = new MetadataExtensionBuilder(
      this.connection,
      {},
      { name, description, packageName, transportRequest, ...options }
    );
    await builder.create();
    this.crudState.createResult = builder.getState().createResult;
    return this;
  }

  async lockMetadataExtension(name: string): Promise<this> {
    const builder = new MetadataExtensionBuilder(this.connection, {}, { name, description: '' });
    await builder.lock();
    this.crudState.lockHandle = builder.getState().lockHandle;
    return this;
  }

  async unlockMetadataExtension(name: string, lockHandle?: string): Promise<this> {
    const builder = new MetadataExtensionBuilder(this.connection, {}, { name, description: '' });
    (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    await builder.unlock();
    this.crudState.unlockResult = builder.getState().unlockResult;
    this.crudState.lockHandle = undefined;
    return this;
  }

  async updateMetadataExtension(name: string, sourceCode: string, lockHandle?: string): Promise<this> {
    const builder = new MetadataExtensionBuilder(this.connection, {}, { name, description: '', sourceCode });
    (builder as any).lockHandle = lockHandle || this.crudState.lockHandle;
    await builder.update();
    this.crudState.updateResult = builder.getState().updateResult;
    return this;
  }

  async activateMetadataExtension(name: string): Promise<this> {
    const builder = new MetadataExtensionBuilder(this.connection, {}, { name, description: '' });
    await builder.activate();
    this.crudState.activateResult = builder.getState().activateResult;
    return this;
  }

  async checkMetadataExtension(name: string, version: 'active' | 'inactive' = 'inactive'): Promise<this> {
    const builder = new MetadataExtensionBuilder(this.connection, {}, { name, description: '' });
    await builder.check(version);
    this.crudState.checkResult = builder.getState().checkResult;
    return this;
  }

  async validateMetadataExtension(name: string, description: string, packageName: string): Promise<this> {
    const builder = new MetadataExtensionBuilder(this.connection, {}, { name, description, packageName });
    await builder.validate();
    this.crudState.validationResult = builder.getState().validationResult;
    return this;
  }

  async deleteMetadataExtension(name: string, transportRequest?: string): Promise<this> {
    const builder = new MetadataExtensionBuilder(this.connection, {}, { name, description: '', transportRequest });
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
}
