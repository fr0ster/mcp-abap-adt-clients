import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { updateDataElement } from '../../../core/dataElement/update';
import { updateDomain } from '../../../core/domain/update';
import { updatePackage } from '../../../core/package/update';
import { updateTableType } from '../../../core/tabletype/update';
import { updateTransport } from '../../../core/transport/update';

/**
 * An update is the write.
 *
 * These five used to GET the current document, patch the config's named fields
 * into it, and PUT the result — two requests in one member, and a merge whose
 * rules nobody outside could change. The caller reads, edits and passes the
 * document now.
 */
const recording = () => {
  const methods: string[] = [];
  const bodies: unknown[] = [];
  const connection: Partial<IAbapConnection> = {
    makeAdtRequest: async (request: { method?: string; data?: unknown }) => {
      methods.push(request.method ?? 'GET');
      bodies.push(request.data);
      return {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: '',
      } as IAdtWireResponse;
    },
  };
  return { connection: connection as IAbapConnection, methods, bodies };
};

const DOCUMENT =
  '<dom:domain xmlns:dom="http://www.sap.com/dictionary/domain"/>';

describe('the five DDIC-shaped updates', () => {
  it('updateDomain sends the write and nothing else', async () => {
    const { connection, methods, bodies } = recording();
    await updateDomain(
      connection,
      { domain_name: 'ZOK_DOM' } as never,
      DOCUMENT,
    );
    expect(methods).toEqual(['PUT']);
    expect(bodies[0]).toBe(DOCUMENT);
  });

  it('updatePackage sends the write and nothing else', async () => {
    const { connection, methods, bodies } = recording();
    await updatePackage(
      connection,
      { package_name: 'ZOK_PKG' } as never,
      DOCUMENT,
      'LOCK',
    );
    expect(methods).toEqual(['PUT']);
    expect(bodies[0]).toBe(DOCUMENT);
  });

  it('updateDataElement sends the write and nothing else', async () => {
    const { connection, methods, bodies } = recording();
    await updateDataElement(
      connection,
      { data_element_name: 'ZOK_DTEL' } as never,
      DOCUMENT,
    );
    expect(methods).toEqual(['PUT']);
    expect(bodies[0]).toBe(DOCUMENT);
  });

  it('updateTableType sends the write and nothing else', async () => {
    const { connection, methods, bodies } = recording();
    await updateTableType(
      connection,
      { tabletype_name: 'ZOK_TT' } as never,
      DOCUMENT,
    );
    expect(methods).toEqual(['PUT']);
    expect(bodies[0]).toBe(DOCUMENT);
  });

  it('updateTransport sends the write and nothing else', async () => {
    const { connection, methods, bodies } = recording();
    await updateTransport(connection, 'ZOKK900001', DOCUMENT);
    expect(methods).toEqual(['PUT']);
    expect(bodies[0]).toBe(DOCUMENT);
  });
});
