/**
 * The readings this library ships.
 *
 * `IResultStrategy<T>` is `(answer: IAdtWireResponse) => T` and comes from
 * `@mcp-abap-adt/interfaces`; this package never declares a second spelling of
 * it. What it does declare is the implementations — and, since 31.0.0, the
 * shapes they build, because a contract carries what is needed to use it or
 * replace it and what a reading makes of a document is neither.
 *
 * A reading is chosen once, when an implementation is constructed, and every
 * call through it answers that shape. That fits how these consumers work: a
 * backup tool wants documents whole for everything it touches, a script wants
 * two fields from every read, an MCP server picks by what its model is about to
 * do. None changes its mind between `create` and `read` of the same object.
 */
import type { IResultStrategy } from '@mcp-abap-adt/interfaces';

/**
 * The body as it arrived.
 *
 * Not parsed, not trimmed. Decision 5 in `@mcp-abap-adt/interfaces` leaves the
 * document to whoever wants a shape out of it, and this library does not know
 * which fields a caller needs.
 *
 * **It is the default only where the member answered a document before.** Each
 * shipped set defaults to what its own member already answered, so a consumer
 * who names no strategy is not moved by this migration. Where the document is
 * not the default it is one named, exported strategy away.
 */
export const rawDocument: IResultStrategy<string> = (answer) =>
  typeof answer.data === 'string' ? answer.data : String(answer.data ?? '');

/**
 * For members ADT answers with nothing worth reading — an unlock, a write.
 *
 * `void` rather than `undefined`: a caller has nothing to read, and the answer
 * still says whether it happened.
 */
export const nothing: IResultStrategy<void> = () => undefined;
