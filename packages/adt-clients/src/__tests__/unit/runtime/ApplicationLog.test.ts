import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import {
  ApplicationLog,
  applicationLogDocuments,
} from '../../../runtime/applicationLog/ApplicationLog';

describe('ApplicationLog', () => {
  function createConnectionMock() {
    return {
      makeAdtRequest: jest.fn().mockResolvedValue({ status: 200, data: '' }),
    } as unknown as IAbapConnection;
  }

  function createLogger() {
    return {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as any;
  }

  it('getObject() delegates to /sap/bc/adt/applicationlog/objects/Z_MY_LOG', async () => {
    const connection = createConnectionMock();
    const appLog = new ApplicationLog(connection, {
      logger: createLogger(),
      results: applicationLogDocuments,
    });

    await appLog.getObject('Z_MY_LOG');

    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/applicationlog/objects/Z_MY_LOG',
        method: 'GET',
      }),
    );
  });

  // Until 36.0.1 both reads sent `application/xml`, refused `406` (SADT_RESOURCE
  // 037). Measured on an on-premise system (2026-10-19): the properties answer
  // `200` to blues.v1+xml, the source `200` to application/json and `406` to
  // blues.v1+xml.
  it('getObject() sends exactly Accept application/vnd.sap.adt.blues.v1+xml', async () => {
    const connection = createConnectionMock();
    const appLog = new ApplicationLog(connection, {
      logger: createLogger(),
      results: applicationLogDocuments,
    });

    await appLog.getObject('Z_MY_LOG');

    const sent = (connection.makeAdtRequest as jest.Mock).mock.calls[0][0];
    expect(sent.headers).toEqual({
      Accept: 'application/vnd.sap.adt.blues.v1+xml',
      'X-sap-adt-relation':
        'http://www.sap.com/wbobj/applicationlogobjects/aplotyp/properties',
    });
  });

  it('getSource() sends exactly Accept application/json', async () => {
    const connection = createConnectionMock();
    const appLog = new ApplicationLog(connection, {
      logger: createLogger(),
      results: applicationLogDocuments,
    });

    await appLog.getSource('Z_MY_LOG');

    const sent = (connection.makeAdtRequest as jest.Mock).mock.calls[0][0];
    expect(sent.headers).toEqual({
      Accept: 'application/json',
      'X-sap-adt-relation':
        'http://www.sap.com/wbobj/applicationlogobjects/aplotyp/source',
    });
  });

  it('getSource() delegates to /sap/bc/adt/applicationlog/objects/Z_MY_LOG/source/main', async () => {
    const connection = createConnectionMock();
    const appLog = new ApplicationLog(connection, {
      logger: createLogger(),
      results: applicationLogDocuments,
    });

    await appLog.getSource('Z_MY_LOG');

    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/applicationlog/objects/Z_MY_LOG/source/main',
        method: 'GET',
      }),
    );
  });

  it('validateName() delegates to /sap/bc/adt/applicationlog/objects/validation', async () => {
    const connection = createConnectionMock();
    const appLog = new ApplicationLog(connection, {
      logger: createLogger(),
      results: applicationLogDocuments,
    });

    await appLog.validateName('Z_MY_LOG');

    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/applicationlog/objects/validation',
        method: 'GET',
      }),
    );
  });
});
