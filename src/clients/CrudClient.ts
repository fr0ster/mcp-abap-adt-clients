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
import { ClassBuilder } from '../core/class';
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

interface CrudClientState {
  createResult?: AxiosResponse;
  lockHandle?: string;
  unlockResult?: AxiosResponse;
  updateResult?: AxiosResponse;
  activateResult?: AxiosResponse;
  checkResult?: AxiosResponse;
  validationResult?: any;
  readResult?: AxiosResponse;
}

export class CrudClient extends ReadOnlyClient {
  private state: CrudClientState = {};
  
  constructor(connection: AbapConnection) {
    super(connection);
  }

  // State getters
  getCreateResult(): AxiosResponse | undefined { return this.state.createResult; }
  getLockHandle(): string | undefined { return this.state.lockHandle; }
  getUnlockResult(): AxiosResponse | undefined { return this.state.unlockResult; }
  getUpdateResult(): AxiosResponse | undefined { return this.state.updateResult; }
  getActivateResult(): AxiosResponse | undefined { return this.state.activateResult; }
  getCheckResult(): AxiosResponse | undefined { return this.state.checkResult; }
  getValidationResult(): any | undefined { return this.state.validationResult; }
  getReadResult(): AxiosResponse | undefined { return this.state.readResult; }

  // ==================== Program operations ====================
  
  async createProgram(programName: string, description: string, packageName: string, transportRequest?: string): Promise<this> {
    const builder = new ProgramBuilder(this.connection, {}, { programName, description, packageName, transportRequest });
    await builder.create();
    this.state.createResult = builder.getState().createResult;
    return this;
  }

  async lockProgram(programName: string): Promise<this> {
    const builder = new ProgramBuilder(this.connection, {}, { programName, description: '' });
    await builder.lock();
    this.state.lockHandle = builder.getState().lockHandle;
    return this;
  }

  async unlockProgram(programName: string, lockHandle?: string): Promise<this> {
    const builder = new ProgramBuilder(this.connection, {}, { programName, description: '' });
    (builder as any).lockHandle = lockHandle || this.state.lockHandle;
    await builder.unlock();
    this.state.unlockResult = builder.getState().unlockResult;
    this.state.lockHandle = undefined;
    return this;
  }

  async updateProgram(programName: string, sourceCode: string, lockHandle?: string): Promise<this> {
    const builder = new ProgramBuilder(this.connection, {}, { programName, description: '', sourceCode });
    (builder as any).lockHandle = lockHandle || this.state.lockHandle;
    await builder.update();
    this.state.updateResult = builder.getState().updateResult;
    return this;
  }

  async activateProgram(programName: string): Promise<this> {
    const builder = new ProgramBuilder(this.connection, {}, { programName, description: '' });
    await builder.activate();
    this.state.activateResult = builder.getState().activateResult;
    return this;
  }

  async checkProgram(programName: string): Promise<this> {
    const builder = new ProgramBuilder(this.connection, {}, { programName, description: '' });
    await builder.check();
    this.state.checkResult = builder.getState().checkResult;
    return this;
  }

  async validateProgram(programName: string): Promise<this> {
    const builder = new ProgramBuilder(this.connection, {}, { programName, description: '' });
    await builder.validate();
    this.state.validationResult = builder.getState().validationResult;
    return this;
  }

  // ==================== Class operations ====================
  
  async createClass(className: string, description: string, packageName: string, transportRequest?: string): Promise<this> {
    const builder = new ClassBuilder(this.connection, {}, { className, description, packageName, transportRequest });
    await builder.create();
    this.state.createResult = builder.getState().createResult;
    return this;
  }

  async lockClass(className: string): Promise<this> {
    const builder = new ClassBuilder(this.connection, {}, { className, description: '' });
    await builder.lock();
    this.state.lockHandle = builder.getState().lockHandle;
    return this;
  }

  async unlockClass(className: string, lockHandle?: string): Promise<this> {
    const builder = new ClassBuilder(this.connection, {}, { className, description: '' });
    (builder as any).lockHandle = lockHandle || this.state.lockHandle;
    await builder.unlock();
    this.state.unlockResult = builder.getState().unlockResult;
    this.state.lockHandle = undefined;
    return this;
  }

  async updateClass(className: string, sourceCode: string, lockHandle?: string): Promise<this> {
    const builder = new ClassBuilder(this.connection, {}, { className, description: '' });
    (builder as any).lockHandle = lockHandle || this.state.lockHandle;
    builder.setCode(sourceCode);
    await builder.update();
    this.state.updateResult = builder.getState().updateResult;
    return this;
  }

  async activateClass(className: string): Promise<this> {
    const builder = new ClassBuilder(this.connection, {}, { className, description: '' });
    await builder.activate();
    this.state.activateResult = builder.getState().activateResult;
    return this;
  }

  async checkClass(className: string): Promise<this> {
    const builder = new ClassBuilder(this.connection, {}, { className, description: '' });
    await builder.check();
    this.state.checkResult = builder.getState().checkResult;
    return this;
  }

  async validateClass(className: string): Promise<this> {
    const builder = new ClassBuilder(this.connection, {}, { className, description: '' });
    await builder.validate();
    this.state.validationResult = builder.getState().validationResult;
    return this;
  }

  // ==================== Interface operations ====================
  
  async createInterface(interfaceName: string, description: string, packageName: string, transportRequest?: string): Promise<this> {
    const builder = new InterfaceBuilder(this.connection, {}, { interfaceName, description, packageName, transportRequest });
    await builder.create();
    this.state.createResult = builder.getState().createResult;
    return this;
  }

  async lockInterface(interfaceName: string): Promise<this> {
    const builder = new InterfaceBuilder(this.connection, {}, { interfaceName, description: '' });
    await builder.lock();
    this.state.lockHandle = builder.getState().lockHandle;
    return this;
  }

  async unlockInterface(interfaceName: string, lockHandle?: string): Promise<this> {
    const builder = new InterfaceBuilder(this.connection, {}, { interfaceName, description: '' });
    (builder as any).lockHandle = lockHandle || this.state.lockHandle;
    await builder.unlock();
    this.state.unlockResult = builder.getState().unlockResult;
    this.state.lockHandle = undefined;
    return this;
  }

  async updateInterface(interfaceName: string, sourceCode: string, lockHandle?: string): Promise<this> {
    const builder = new InterfaceBuilder(this.connection, {}, { interfaceName, description: '', sourceCode });
    (builder as any).lockHandle = lockHandle || this.state.lockHandle;
    await builder.update();
    this.state.updateResult = builder.getState().updateResult;
    return this;
  }

  async activateInterface(interfaceName: string): Promise<this> {
    const builder = new InterfaceBuilder(this.connection, {}, { interfaceName, description: '' });
    await builder.activate();
    this.state.activateResult = builder.getState().activateResult;
    return this;
  }

  async checkInterface(interfaceName: string): Promise<this> {
    const builder = new InterfaceBuilder(this.connection, {}, { interfaceName, description: '' });
    await builder.check();
    this.state.checkResult = builder.getState().checkResult;
    return this;
  }

  async validateInterface(interfaceName: string): Promise<this> {
    const builder = new InterfaceBuilder(this.connection, {}, { interfaceName, description: '' });
    await builder.validate();
    this.state.validationResult = builder.getState().validationResult;
    return this;
  }
}
