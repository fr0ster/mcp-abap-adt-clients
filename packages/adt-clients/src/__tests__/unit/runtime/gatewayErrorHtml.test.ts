import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import {
  FeedRepository,
  feedDocuments,
} from '../../../runtime/feeds/FeedRepository';
import {
  GatewayErrorLog,
  gatewayErrorLogDocuments,
} from '../../../runtime/gatewayErrorLog/GatewayErrorLog';
import {
  SystemMessages,
  systemMessagesDocuments,
} from '../../../runtime/systemMessages/SystemMessages';

/**
 * 47.0.0, grounded in SAP's code (read on premise and on the cloud):
 * - an error's own document is HTML, its type negotiated against `text/html`
 *   alone (`/IWBEP/CL_ERROR_LOG_VIEWER->get`, onprem l. 89-93, cloud
 *   l. 93-97), so both members that read it ask for `text/html`;
 * - `/runtime/systemmessages/{id}` is no route (`CL_STSK_ADT_RES_APP->
 *   register_resources`, l. 31-48, registers the collection alone), so
 *   `SystemMessages` has no member that asks for one.
 */
function connection(): IAbapConnection & { makeAdtRequest: jest.Mock } {
  return {
    makeAdtRequest: jest.fn().mockResolvedValue({ status: 200, data: '' }),
  } as unknown as IAbapConnection & { makeAdtRequest: jest.Mock };
}
const logger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

describe('the gateway error document is asked for as HTML', () => {
  it('GatewayErrorLog.getById sends Accept: text/html', async () => {
    const c = connection();
    await new GatewayErrorLog(c, {
      logger,
      results: gatewayErrorLogDocuments,
    }).getById('Frontend Error', 'BA98DDFC64FB1FE1B9D15494303F12B9');
    expect(c.makeAdtRequest.mock.calls[0]?.[0]?.headers).toEqual({
      Accept: 'text/html',
    });
  });

  it('FeedRepository.gatewayErrorDetail sends Accept: text/html', async () => {
    const c = connection();
    await new FeedRepository(c, {
      logger,
      results: feedDocuments,
    }).gatewayErrorDetail('/sap/bc/adt/gw/errorlog/Backend%20Error/BA98');
    expect(c.makeAdtRequest.mock.calls[0]?.[0]).toMatchObject({
      url: '/sap/bc/adt/gw/errorlog/Backend%20Error/BA98',
      headers: { Accept: 'text/html' },
    });
  });
});

describe('SystemMessages asks for no message by id', () => {
  it('has no getById, and its result set no message slot', () => {
    const messages = new SystemMessages(connection(), {
      logger,
      results: systemMessagesDocuments,
    });
    expect('getById' in messages).toBe(false);
    expect(Object.keys(systemMessagesDocuments)).toEqual(['list']);
  });
});
