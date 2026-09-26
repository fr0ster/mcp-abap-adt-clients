/**
 * The system probes answer "the endpoint is not there" and raise everything
 * else.
 *
 * Until 23.0.0 each swallowed every failure into the same answer as an absent
 * endpoint — `false`, `null`, an empty set — so a modern system reached over a
 * broken connection got a legacy client from `createAdtClient`, and a failed
 * discovery read as a system that offers nothing.
 */
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import { fetchDiscoveryEndpoints } from '../../../utils/discoveryEndpoints';
import {
  getSystemInformation,
  isModernAdtSystem,
} from '../../../utils/systemInfo';

const failingWith = (status?: number): IAbapConnection =>
  ({
    makeAdtRequest: async () => {
      const error: any = new Error(status ? `HTTP ${status}` : 'ECONNRESET');
      if (status) error.response = { status, headers: {}, data: '' };
      throw error;
    },
  }) as unknown as IAbapConnection;

const answering = (headers: Record<string, string>, data = '') =>
  ({
    makeAdtRequest: async () => ({
      data,
      status: 200,
      statusText: 'OK',
      headers,
    }),
  }) as unknown as IAbapConnection;

describe('isModernAdtSystem', () => {
  it('an XML core/discovery is a modern system', async () => {
    await expect(
      isModernAdtSystem(
        answering({ 'content-type': 'application/atomsvc+xml' }),
      ),
    ).resolves.toBe(true);
  });

  it.each([404, 405, 501])('a %i is a legacy system', async (status) => {
    await expect(isModernAdtSystem(failingWith(status))).resolves.toBe(false);
  });

  it.each([
    401,
    500,
    undefined,
  ])('a %s failure is raised, not read as legacy', async (status) => {
    await expect(isModernAdtSystem(failingWith(status))).rejects.toThrow();
  });
});

describe('getSystemInformation', () => {
  it('a 404 (on-premise, no such endpoint) answers null', async () => {
    await expect(getSystemInformation(failingWith(404))).resolves.toBeNull();
  });

  it('a network failure is raised', async () => {
    await expect(getSystemInformation(failingWith())).rejects.toThrow(
      'ECONNRESET',
    );
  });
});

describe('fetchDiscoveryEndpoints', () => {
  it('reads the hrefs of an answering discovery', async () => {
    const endpoints = await fetchDiscoveryEndpoints(
      answering({}, '<app:collection href="/sap/bc/adt/oo/classes"/>'),
    );
    expect([...endpoints]).toEqual(['/sap/bc/adt/oo/classes']);
  });

  it('no discovery resource is an empty set; a 500 is raised', async () => {
    await expect(fetchDiscoveryEndpoints(failingWith(404))).resolves.toEqual(
      new Set(),
    );
    await expect(fetchDiscoveryEndpoints(failingWith(500))).rejects.toThrow();
  });
});
