/**
 * The factory selects the reading — once, for the whole implementation.
 *
 * Decision 22: the shape is injected where the implementation is built, never
 * chosen at the call. So this asserts both halves of that: the default answers
 * documents, and a consumer's own set of strategies comes back as *their* type,
 * typed rather than cast.
 */
import type {
  IAbapConnection,
  IAdtResponse,
  IAdtWireResponse,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import { AdtClient } from '../../../clients/AdtClient';
import { classDocuments } from '../../../core/class/types';

const logger = {
  log: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
} as unknown as ILogger;

const connection = {
  setSessionType: jest.fn(),
  isConnected: () => true,
  makeAdtRequest: jest.fn(async () => ({
    data: '<abapClass adtcore:name="ZCL_X"/>',
    status: 200,
    statusText: 'OK',
    headers: {},
  })),
} as unknown as IAbapConnection;

describe('AdtClient.getClass', () => {
  it('defaults to documents', async () => {
    const answer = await new AdtClient(connection, logger)
      .getClass()
      .read({ className: 'ZCL_X' });

    expect(answer.ok).toBe(true);
    if (!answer.ok) throw new Error('expected a result');
    expect(answer.getResult().value).toContain('ZCL_X');
  });

  it('gives a consumer their own shape when they supply one', async () => {
    const names = {
      ...classDocuments,
      source: (wire: IAdtWireResponse) => ({
        name: /adtcore:name="([^"]+)"/.exec(String(wire.data))?.[1] ?? '',
      }),
    };

    const answer = await new AdtClient(connection, logger)
      .getClass(names)
      .read({ className: 'ZCL_X' });

    expect(answer.ok).toBe(true);
    if (!answer.ok) throw new Error('expected a result');
    // Their type, not ours — and typed, not cast.
    expect(answer.getResult().value.name).toBe('ZCL_X');
  });

  it('reads an include through the same set', async () => {
    // One set covers every implementation built from it: the includes take
    // IClassResults too, because they read the same class's documents.
    const answer = await new AdtClient(connection, logger)
      .getLocalTypes()
      .read({ className: 'ZCL_X' });

    expect(answer.ok).toBe(true);
    if (!answer.ok) throw new Error('expected a result');
    expect(answer.getResult().value).toContain('ZCL_X');
  });
});

// Compile-only: if this stops compiling, the factory and the implementation
// disagree about R, which no runtime assertion can catch.
const named = {
  ...classDocuments,
  source: (wire: IAdtWireResponse) => ({ name: String(wire.data) }),
};
const _readsTheirShape: (
  c: ReturnType<typeof AdtClient.prototype.getClass<typeof named>>,
) => Promise<IAdtResponse<{ name: string }>> = (c) =>
  c.read({ className: 'X' });
void _readsTheirShape;
