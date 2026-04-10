/**
 * AdtRuntimeClientExperimental
 *
 * Experimental runtime APIs that are still in progress and may change.
 * Current scope:
 * - AMDP debugger APIs (via amdpDebugger() factory)
 */

export type { IStartAmdpDebuggerOptions } from '../runtime/debugger/amdp';
export type {
  IGetAmdpCellSubstringOptions,
  IGetAmdpDataPreviewOptions,
} from '../runtime/debugger/amdpDataPreview';

import { AmdpDebugger } from '../runtime/debugger/AmdpDebugger';
import { AdtRuntimeClient } from './AdtRuntimeClient';

/**
 * @experimental
 * AMDP runtime APIs are in progress and not finalized yet.
 */
export class AdtRuntimeClientExperimental extends AdtRuntimeClient {
  private _amdpDebugger?: AmdpDebugger;

  amdpDebugger(): AmdpDebugger {
    if (!this._amdpDebugger) {
      this._amdpDebugger = new AmdpDebugger(this.connection, this.logger);
    }
    return this._amdpDebugger;
  }
}
