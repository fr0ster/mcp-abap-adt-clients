import type {
  IAbapConnection,
  IAdtResponse,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import type { IAdtClientOptions } from '../clients/AdtClient';
import { AdtClient } from '../clients/AdtClient';
import { BatchRecordingConnection } from './BatchRecordingConnection';
import { buildBatchPayload } from './buildBatchPayload';
import { parseBatchResponse } from './parseBatchResponse';

export class AdtClientBatch {
  private recorder: BatchRecordingConnection;
  private innerClient: AdtClient;
  private realConnection: IAbapConnection;

  constructor(
    connection: IAbapConnection,
    logger?: ILogger,
    options?: IAdtClientOptions,
  ) {
    this.realConnection = connection;
    this.recorder = new BatchRecordingConnection(connection);
    this.innerClient = new AdtClient(this.recorder, logger, options);
  }

  // Mirror all AdtClient factory methods
  getClass() {
    return this.innerClient.getClass();
  }
  getProgram() {
    return this.innerClient.getProgram();
  }
  getInterface() {
    return this.innerClient.getInterface();
  }
  getDomain() {
    return this.innerClient.getDomain();
  }
  getDataElement() {
    return this.innerClient.getDataElement();
  }
  getStructure() {
    return this.innerClient.getStructure();
  }
  getTable() {
    return this.innerClient.getTable();
  }
  getTableType() {
    return this.innerClient.getTableType();
  }
  getView() {
    return this.innerClient.getView();
  }
  getFunctionGroup() {
    return this.innerClient.getFunctionGroup();
  }
  getFunctionModule() {
    return this.innerClient.getFunctionModule();
  }
  getPackage() {
    return this.innerClient.getPackage();
  }
  getServiceDefinition() {
    return this.innerClient.getServiceDefinition();
  }
  getServiceBinding() {
    return this.innerClient.getServiceBinding();
  }
  getService() {
    return this.innerClient.getService();
  }
  getBehaviorDefinition() {
    return this.innerClient.getBehaviorDefinition();
  }
  getBehaviorImplementation() {
    return this.innerClient.getBehaviorImplementation();
  }
  getMetadataExtension() {
    return this.innerClient.getMetadataExtension();
  }
  getEnhancement() {
    return this.innerClient.getEnhancement();
  }
  getUnitTest() {
    return this.innerClient.getUnitTest();
  }
  getCdsUnitTest() {
    return this.innerClient.getCdsUnitTest();
  }
  getRequest() {
    return this.innerClient.getRequest();
  }
  getUtils() {
    return this.innerClient.getUtils();
  }
  getLocalTestClass() {
    return this.innerClient.getLocalTestClass();
  }
  getLocalTypes() {
    return this.innerClient.getLocalTypes();
  }
  getLocalDefinitions() {
    return this.innerClient.getLocalDefinitions();
  }
  getLocalMacros() {
    return this.innerClient.getLocalMacros();
  }

  async batchExecute(): Promise<IAdtResponse[]> {
    const parts = this.recorder.getRecordedParts();
    if (parts.length === 0) {
      return [];
    }

    const payload = buildBatchPayload(parts);

    const response = await this.realConnection.makeAdtRequest({
      url: '/sap/bc/adt/debugger/batch',
      method: 'POST',
      timeout: 30000,
      data: payload.body,
      headers: {
        'Content-Type': `multipart/mixed; boundary=${payload.boundary}`,
        Accept: 'multipart/mixed',
      },
    });

    const contentType = String(response.headers?.['content-type'] ?? '');
    const parsed = parseBatchResponse(String(response.data), contentType);

    this.recorder.resolveAll(parsed);

    return parsed.map((p) => ({
      data: p.data,
      status: p.status,
      statusText: p.statusText,
      headers: p.headers,
    }));
  }

  reset(): void {
    this.recorder.reset();
  }

  getRecorder(): BatchRecordingConnection {
    return this.recorder;
  }
}
