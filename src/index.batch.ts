/**
 * ADT Clients — batch barrel
 * Covers: all batch/** modules (AdtClientBatch, AdtRuntimeClientBatch, BatchRecordingConnection).
 */

export { AdtClientBatch } from './batch/AdtClientBatch';
export { AdtRuntimeClientBatch } from './batch/AdtRuntimeClientBatch';
export { BatchRecordingConnection } from './batch/BatchRecordingConnection';
export type {
  IBatchPayload,
  IBatchRequestPart,
  IBatchResponsePart,
} from './batch/types';
