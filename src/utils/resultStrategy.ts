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
import type {
  IAdtWireResponse,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces';

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
 *
 * **A JSON body is re-serialised, not stringified.** The transport parses
 * `application/json` on the way in, so `answer.data` is an object by the time a
 * reading sees it — and `String(object)` is `"[object Object]"`, which is what
 * the DSFI source read answered for as long as this said `String()`. The
 * document is what a caller asked for, so it is rebuilt rather than described.
 */
export const rawDocument: IResultStrategy<string> = (answer) => {
  const body = answer.data;
  if (typeof body === 'string') return body;
  if (body === undefined || body === null) return '';
  if (typeof body === 'object') {
    try {
      return JSON.stringify(body);
    } catch {
      // Circular, or something that will not serialise. `String` at least says
      // what kind of thing it was, which is more than nothing.
      return String(body);
    }
  }
  return String(body);
};

/**
 * For members ADT answers with nothing worth reading — an unlock, a write.
 *
 * `void` rather than `undefined`: a caller has nothing to read, and the answer
 * still says whether it happened.
 */
export const nothing: IResultStrategy<void> = () => undefined;

/**
 * The answer itself, unread.
 *
 * For a member whose caller does its own reading — the low-level per-type
 * request functions hand the wire on to the handler, which applies the
 * consumer's strategy to it. Status and headers survive, which `rawDocument`
 * drops, and that is the whole reason it is separate: a reading that keeps
 * everything is not the same as a reading that keeps the body.
 */
export const wireItself: IResultStrategy<IAdtWireResponse> = (answer) => answer;
