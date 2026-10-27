/**
 * A factory called without a result set answers its class over the shipped
 * default (`typeof xDocuments`), with every slot exactly as narrow as the
 * default makes it. Before 38.0.0 the no-argument overload answered a
 * composition over the same default; these assertions held there and hold now.
 *
 * One object per kind of slot: a string slot (`rawDocument`), a `void` slot
 * (`nothing`), the generic message-class set, and a consumer's own set.
 *
 * Never imported at runtime; `npm run test:check` is the test.
 */

import type {
  IAdtError,
  IAdtResponse,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces-adt';
import type { AdtClient } from '../../../clients/AdtClient';
import type { classDocuments } from '../../../core/class/types';

type Assert<T extends true> = T;
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;

/** What a member answers, at the default error type. */
type Answer<M> = M extends (
  ...args: never[]
) => Promise<IAdtResponse<infer V, IAdtError>>
  ? V
  : never;

// What a call answers, not `ReturnType<AdtClient['getClass']>`: `ReturnType`
// instantiates `R` at its constraint (`IClassResults`, every slot `unknown`),
// before 38.0.0 as now; a call without an argument takes the default.
declare const client: AdtClient;
const cls = client.getClass();
const program = client.getProgram();
const message = client.getMessageClassMessage();
type Class = typeof cls;
type Program = typeof program;
type Message = typeof message;

// A string slot: the document as it arrived.
export type _ClassReadIsString = Assert<Equal<Answer<Class['read']>, string>>;
export type _ProgramReadIsString = Assert<
  Equal<Answer<Program['read']>, string>
>;
export type _ClassActivateIsString = Assert<
  Equal<Answer<Class['activate']>, string>
>;

// A `void` slot: `nothing`.
export type _ClassUpdateIsVoid = Assert<Equal<Answer<Class['update']>, void>>;

// The generic message-class set: its defaults are `string`.
export type _MessageReadIsString = Assert<
  Equal<Answer<Message['read']>, string>
>;
export type _MessageCreateIsString = Assert<
  Equal<Answer<Message['create']>, string>
>;
export type _MessageDeleteIsString = Assert<
  Equal<Answer<Message['delete']>, string>
>;

// A consumer's own set is inferred from the argument, as before.
type Own = Omit<typeof classDocuments, 'source'> & {
  readonly source: IResultStrategy<number>;
};
declare const own: Own;
const ownClass = client.getClass(own);
type OwnClass = typeof ownClass;
export type _OwnSourceIsNumber = Assert<
  Equal<Answer<OwnClass['read']>, number>
>;
export type _OwnUpdateStaysVoid = Assert<
  Equal<Answer<OwnClass['update']>, void>
>;
