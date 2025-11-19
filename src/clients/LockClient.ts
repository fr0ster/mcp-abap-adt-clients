import { AbapConnection } from '@mcp-abap-adt/connection';
import { generateSessionId } from '../utils/sessionUtils';
import { lockClass } from '../core/class/lock';
import { unlockClass } from '../core/class/unlock';
import { lockProgram } from '../core/program/lock';
import { unlockProgram } from '../core/program/unlock';
import { lockInterface } from '../core/interface/lock';
import { unlockInterface } from '../core/interface/unlock';
import { lockFunctionGroup } from '../core/functionGroup/lock';
import { unlockFunctionGroup } from '../core/functionGroup/unlock';
import { lockFunctionModule } from '../core/functionModule/lock';
import { unlockFunctionModule } from '../core/functionModule/unlock';
import { lockStructure } from '../core/structure/lock';
import { unlockStructure } from '../core/structure/unlock';
import { acquireTableLockHandle } from '../core/table/lock';
import { unlockTable } from '../core/table/unlock';
import { lockDomain } from '../core/domain/lock';
import { unlockDomain } from '../core/domain/unlock';
import { lockDataElement } from '../core/dataElement/lock';
import { unlockDataElement } from '../core/dataElement/unlock';
import { lockDDLS } from '../core/view/lock';
import { unlockDDLS } from '../core/view/unlock';
import { lockPackage } from '../core/package/lock';
import { unlockPackage } from '../core/package/unlock';

export type LockableObjectType =
  | 'class'
  | 'program'
  | 'interface'
  | 'function_group'
  | 'function_module'
  | 'table'
  | 'structure'
  | 'view'
  | 'domain'
  | 'data_element'
  | 'package';

export interface LockRequest {
  objectType: LockableObjectType;
  objectName: string;
  sessionId?: string;
}

export interface LockResult {
  objectType: LockableObjectType;
  objectName: string;
  lockHandle: string;
  sessionId: string;
  transportRequest?: string;
}

export interface UnlockRequest {
  objectType: LockableObjectType;
  objectName: string;
  lockHandle: string;
  sessionId: string;
}

export class LockClient {
  constructor(private connection: AbapConnection) {}

  async lock(request: LockRequest): Promise<LockResult> {
    const sessionId = request.sessionId || generateSessionId();
    const objectType = request.objectType.toLowerCase() as LockableObjectType;
    const objectName = request.objectName.toUpperCase();

    switch (objectType) {
      case 'class': {
        const lockHandle = await lockClass(this.connection, objectName, sessionId);
        return { objectType, objectName, lockHandle, sessionId };
      }
      case 'program': {
        const lockHandle = await lockProgram(this.connection, objectName, sessionId);
        return { objectType, objectName, lockHandle, sessionId };
      }
      case 'interface': {
        const { lockHandle, corrNr } = await lockInterface(this.connection, objectName, sessionId);
        return { objectType, objectName, lockHandle, sessionId, transportRequest: corrNr };
      }
      case 'function_group': {
        const lockHandle = await lockFunctionGroup(this.connection, objectName, sessionId);
        return { objectType, objectName, lockHandle, sessionId };
      }
      case 'function_module': {
        const { group, module } = this.splitFunctionModuleName(objectName);
        const lockHandle = await lockFunctionModule(this.connection, group, module, sessionId);
        return { objectType, objectName, lockHandle, sessionId };
      }
      case 'table': {
        const lockHandle = await acquireTableLockHandle(this.connection, objectName, sessionId);
        return { objectType, objectName, lockHandle, sessionId };
      }
      case 'structure': {
        const lockHandle = await lockStructure(this.connection, objectName, sessionId);
        return { objectType, objectName, lockHandle, sessionId };
      }
      case 'view': {
        const lockHandle = await lockDDLS(this.connection, objectName, sessionId);
        return { objectType, objectName, lockHandle, sessionId };
      }
      case 'domain': {
        const lockHandle = await lockDomain(this.connection, objectName, sessionId);
        return { objectType, objectName, lockHandle, sessionId };
      }
      case 'data_element': {
        const lockHandle = await lockDataElement(this.connection, objectName, sessionId);
        return { objectType, objectName, lockHandle, sessionId };
      }
      case 'package': {
        const lockHandle = await lockPackage(this.connection, objectName, sessionId);
        return { objectType, objectName, lockHandle, sessionId };
      }
      default:
        throw new Error(`Unsupported object type for lock: ${objectType}`);
    }
  }

  async unlock(request: UnlockRequest): Promise<void> {
    const objectType = request.objectType.toLowerCase() as LockableObjectType;
    const objectName = request.objectName.toUpperCase();

    switch (objectType) {
      case 'class':
        await unlockClass(this.connection, objectName, request.lockHandle, request.sessionId);
        return;
      case 'program':
        await unlockProgram(this.connection, objectName, request.lockHandle, request.sessionId);
        return;
      case 'interface':
        await unlockInterface(this.connection, objectName, request.lockHandle, request.sessionId);
        return;
      case 'function_group':
        await unlockFunctionGroup(this.connection, objectName, request.lockHandle, request.sessionId);
        return;
      case 'function_module': {
        const { group, module } = this.splitFunctionModuleName(objectName);
        await unlockFunctionModule(this.connection, group, module, request.lockHandle, request.sessionId);
        return;
      }
      case 'table':
        await unlockTable(this.connection, objectName, request.lockHandle, request.sessionId);
        return;
      case 'structure':
        await unlockStructure(this.connection, objectName, request.lockHandle, request.sessionId);
        return;
      case 'view':
        await unlockDDLS(this.connection, objectName, request.lockHandle, request.sessionId);
        return;
      case 'domain':
        await unlockDomain(this.connection, objectName, request.lockHandle, request.sessionId);
        return;
      case 'data_element':
        await unlockDataElement(this.connection, objectName, request.lockHandle, request.sessionId);
        return;
      case 'package':
        await unlockPackage(this.connection, objectName, request.lockHandle, request.sessionId);
        return;
      default:
        throw new Error(`Unsupported object type for unlock: ${objectType}`);
    }
  }

  private splitFunctionModuleName(value: string): { group: string; module: string } {
    const separator = value.includes('|') ? '|' : '/';
    const [group, module] = value.split(separator);
    if (!group || !module) {
      throw new Error('Function module name must include function group (e.g., ZFGROUP|Z_FM_NAME)');
    }
    return {
      group,
      module
    };
  }
}

