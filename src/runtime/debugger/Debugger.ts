import type {
  IAbapConnection,
  IAbapDebugger,
  IAmdpDebugger,
  IDebugger,
  ILogger,
  IMemorySnapshots,
} from '@mcp-abap-adt/interfaces';
import { MemorySnapshots } from '../memory/MemorySnapshots';
import { AbapDebugger } from './AbapDebugger';
import { AmdpDebugger } from './AmdpDebugger';

export class Debugger implements IDebugger {
  readonly kind = 'debugger' as const;

  private _abap?: AbapDebugger;
  private _amdp?: AmdpDebugger;
  private _memorySnapshots?: MemorySnapshots;

  constructor(
    private readonly connection: IAbapConnection,
    private readonly logger: ILogger,
  ) {}

  getAbap(): IAbapDebugger {
    if (!this._abap) {
      this._abap = new AbapDebugger(this.connection, this.logger);
    }
    return this._abap;
  }

  getAmdp(): IAmdpDebugger {
    if (!this._amdp) {
      this._amdp = new AmdpDebugger(this.connection, this.logger);
    }
    return this._amdp;
  }

  getMemorySnapshots(): IMemorySnapshots {
    if (!this._memorySnapshots) {
      this._memorySnapshots = new MemorySnapshots(this.connection, this.logger);
    }
    return this._memorySnapshots;
  }
}
