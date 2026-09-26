/**
 * ATC (ABAP Test Cockpit) - Exports
 */

export { AdtAtc, atcDocuments, type IAtcResults } from './AdtAtc';
export { AtcLog, atcLogDocuments, type IAtcLogResults } from './AtcLog';
export {
  getCheckFailureLogs,
  getExecutionLog,
  type IGetCheckFailureLogsOptions,
} from './logs';
