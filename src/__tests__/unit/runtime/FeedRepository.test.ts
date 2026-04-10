import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { FeedRepository } from '../../../runtime/feeds/FeedRepository';

const MOCK_ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>entry1</id>
    <title>Test Entry</title>
    <updated>2026-04-10T10:00:00Z</updated>
    <link href="/sap/bc/adt/runtime/dumps/DUMP1"/>
    <content>Some content</content>
    <author><name>TESTUSER</name></author>
    <category term="dump"/>
  </entry>
</feed>`;

describe('FeedRepository', () => {
  function createConnectionMock() {
    return {
      makeAdtRequest: jest.fn().mockResolvedValue({ status: 200, data: '' }),
    } as unknown as IAbapConnection;
  }

  function createLogger() {
    return {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any;
  }

  it('list() delegates to /sap/bc/adt/feeds', async () => {
    const connection = createConnectionMock();
    const repo = new FeedRepository(connection, createLogger());

    await repo.list();

    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/feeds',
        method: 'GET',
      }),
    );
  });

  it('variants() delegates to /sap/bc/adt/feeds/variants', async () => {
    const connection = createConnectionMock();
    const repo = new FeedRepository(connection, createLogger());

    await repo.variants();

    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/feeds/variants',
        method: 'GET',
      }),
    );
  });

  it('byUrl() parses Atom XML into IFeedEntry array', async () => {
    const connection = createConnectionMock();
    (connection.makeAdtRequest as jest.Mock).mockResolvedValue({
      status: 200,
      data: MOCK_ATOM,
    });
    const repo = new FeedRepository(connection, createLogger());

    const entries = await repo.byUrl('/sap/bc/adt/runtime/dumps');

    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({
      id: 'entry1',
      title: 'Test Entry',
      updated: '2026-04-10T10:00:00Z',
      link: '/sap/bc/adt/runtime/dumps/DUMP1',
      content: 'Some content',
      author: 'TESTUSER',
      category: 'dump',
    });
  });

  it('byUrl() returns empty array when feed has no entries', async () => {
    const connection = createConnectionMock();
    (connection.makeAdtRequest as jest.Mock).mockResolvedValue({
      status: 200,
      data: '<feed xmlns="http://www.w3.org/2005/Atom"></feed>',
    });
    const repo = new FeedRepository(connection, createLogger());

    const entries = await repo.byUrl('/sap/bc/adt/runtime/dumps');

    expect(entries).toEqual([]);
  });

  it('dumps() fetches from /sap/bc/adt/runtime/dumps', async () => {
    const connection = createConnectionMock();
    (connection.makeAdtRequest as jest.Mock).mockResolvedValue({
      status: 200,
      data: MOCK_ATOM,
    });
    const repo = new FeedRepository(connection, createLogger());

    await repo.dumps();

    const call = (connection.makeAdtRequest as jest.Mock).mock.calls[0][0];
    expect(call.url).toBe('/sap/bc/adt/runtime/dumps');
  });

  it('byUrl() passes query options to fetchFeed', async () => {
    const connection = createConnectionMock();
    (connection.makeAdtRequest as jest.Mock).mockResolvedValue({
      status: 200,
      data: MOCK_ATOM,
    });
    const repo = new FeedRepository(connection, createLogger());

    await repo.byUrl('/sap/bc/adt/runtime/dumps', {
      maxResults: 5,
      user: 'ADMIN',
    });

    const call = (connection.makeAdtRequest as jest.Mock).mock.calls[0][0];
    expect(call.url).toMatch(/%24top=5|\$top=5/);
    expect(call.url).toMatch(/%24query|\$query/);
  });
});
