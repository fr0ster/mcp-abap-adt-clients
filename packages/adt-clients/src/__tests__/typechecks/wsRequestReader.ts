/**
 * C2 of #304: `AdtClientsWS.request` answers `unknown` without a reader, and
 * the reader's return type with one. The caller-chosen `TResponse` of before
 * was a cast in the library and is refused.
 *
 * Type-level only, compiled by `npm run test:check`; nothing here runs.
 */
import type { AdtClientsWS } from '../../clients/AdtClientsWS';

declare const ws: AdtClientsWS;

export async function wsAnswers(): Promise<void> {
  const plain = await ws.request('op', { x: 1 });
  // @ts-expect-error -- without a reader the answer is unknown
  const notTyped: string = plain;
  const read = (payload: unknown): number =>
    typeof payload === 'number' ? payload : 0;
  const typed: number = await ws.request('op', { x: 1 }, { read });
  // @ts-expect-error -- the reader's type is the answer's, nothing wider
  const wrong: string = await ws.request('op', undefined, { read });
  // @ts-expect-error -- no caller-chosen answer type without a reader
  void ws.request<{ x: number }, { ok: boolean }>('op', { x: 1 });
  // A pre-declared options value with a deadline and a reader is the
  // reader's overload (#333 review: the reader's overload comes first).
  const options = { timeoutMs: 5000, read };
  const declared: number = await ws.request('op', undefined, options);
  void [notTyped, typed, wrong, declared];
}
