/**
 * A consumer's own reading reaches the caller, with its own type.
 *
 * **This is the assertion that three separate defects slipped past.** A result
 * set used to be a generic with one positional parameter per strategy —
 * `IFeatureToggleResults<unknown × 11>` — and every constraint naming it had to
 * repeat all eleven. Adding a strategy meant adding a parameter, and every
 * constraint that still listed the old count silently left the new one at its
 * default. TypeScript says nothing: omitting a defaulted parameter is legal, so
 * the member compiled, answered correctly at runtime, and refused the
 * consumer's own reading — the one thing result strategies exist for.
 *
 * The positional parameters are gone: `ReturnType<R['created']>` derives the
 * type from the strategy that was passed, so the set is a plain record of
 * strategies and there is no count to get wrong. This file holds the property
 * that made them unnecessary, on the three types with the most slots.
 *
 * **Structurally different types per member on purpose.** Every shipped reading
 * answers `string`, so a test using strings would pass with the wrong strategy
 * wired and with the parameter erased. Objects and numbers cannot be confused
 * by either the runtime or the compiler.
 */
import type {
  IAbapConnection,
  IAdtWireResponse,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import { AdtClient } from '../../../clients/AdtClient';
import { classDocuments } from '../../../core/class/types';
import { featureToggleDocuments } from '../../../core/featureToggle/types';
import { functionIncludeDocuments } from '../../../core/functionInclude/types';

const logger = {
  log: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
} as unknown as ILogger;

function connection() {
  const calls: string[] = [];
  const conn = {
    setSessionType: jest.fn(),
    isConnected: () => true,
    makeAdtRequest: jest.fn(async (req: { url: string }) => {
      calls.push(req.url);
      return {
        // The deletion service is asked whether the object may go; the shipped
        // `deletionRefusal` reads that answer, and a bare `<doc/>` is a refusal.
        data: req.url.includes('/deletion/check')
          ? '<del:checkResponse><del:object del:isDeletable="true"/></del:checkResponse>'
          : '<doc/>',
        status: 200,
        statusText: 'OK',
        headers: {},
      } as IAdtWireResponse;
    }),
  } as unknown as IAbapConnection;
  return { calls, conn };
}

describe('an injected reading reaches the caller as its own type', () => {
  it('a class: every member answers what its own strategy returns', async () => {
    const { conn } = connection();
    const cls = new AdtClient(conn, logger).getClass({
      ...classDocuments,
      source: () => ({ kind: 'source' }) as const,
      metadata: () => 1,
      deletionCheck: () => ({ deletable: true }),
    });

    const source = await cls.read({ className: 'ZCL_X' });
    const metadata = await cls.readMetadata({ className: 'ZCL_X' });
    const deletable = await cls.checkDeletion({ className: 'ZCL_X' });

    if (!source.ok || !metadata.ok || !deletable.ok) {
      throw new Error('expected results');
    }
    // Typed bindings, not `expect`s: an assertion on the value passes even when
    // the type has collapsed to `unknown` or to the default `string`.
    const a: { kind: 'source' } = source.getResult().value;
    const b: number = metadata.getResult().value;
    const c: { deletable: boolean } = deletable.getResult().value;

    expect([a, b, c]).toEqual([{ kind: 'source' }, 1, { deletable: true }]);
  });

  it('a feature toggle: eleven slots, and the two writes stay apart', async () => {
    const { conn } = connection();
    const toggle = new AdtClient(conn, logger).getFeatureToggle({
      ...featureToggleDocuments,
      updated: () => ({ wrote: 'source' }) as const,
      metadataUpdated: () => ({ wrote: 'document' }) as const,
    });

    const wroteSource = await toggle.update({
      featureToggleName: 'ZFT',
      source: { rollout: { defaultEnabledFor: 'none' } },
    } as never);
    const wroteDocument = await toggle.updateMetadata({
      featureToggleName: 'ZFT',
    });

    if (!wroteSource.ok || !wroteDocument.ok)
      throw new Error('expected results');
    const a: { wrote: 'source' } = wroteSource.getResult().value;
    const b: { wrote: 'document' } = wroteDocument.getResult().value;

    expect([a, b]).toEqual([{ wrote: 'source' }, { wrote: 'document' }]);
  });

  it('a function include: the source write and the document write differ', async () => {
    const { conn } = connection();
    const include = new AdtClient(conn, logger).getFunctionInclude({
      ...functionIncludeDocuments,
      updated: () => 'the source write',
      metadataUpdated: () => 42,
    });

    const source = await include.update({
      functionGroupName: 'ZFG',
      includeName: 'LZFGF01',
      sourceCode: '* code',
    });
    const document = await include.updateMetadata({
      functionGroupName: 'ZFG',
      includeName: 'LZFGF01',
      description: 'x',
    });

    if (!source.ok || !document.ok) throw new Error('expected results');
    const a: string = source.getResult().value;
    const b: number = document.getResult().value;

    expect([a, b]).toEqual(['the source write', 42]);
  });
});
