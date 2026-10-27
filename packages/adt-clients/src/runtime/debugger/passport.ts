/**
 * The `SAP-PASSPORT` a run carries so that a terminal-mode listener catches it.
 *
 * A terminal-mode listener catches a request by the terminal id and IDE id the
 * request carries in its DSR passport, as two system variable items: (2, 1) the
 * terminal id, (2, 2) the IDE id. A run URL has no parameter for them. This is
 * the passport the ADT client builds for its own runs: version 3, system type 10,
 * a random root context id and transaction id, the two items, nothing else.
 *
 * Measured on premise (2026-10-12, BASIS 816): a class run carrying it is caught
 * by the terminal-mode listener with those ids and by no other; without it no
 * terminal-mode listener catches the run; a passport whose root context id and
 * transaction id are zero is caught all the same. The output was compared byte
 * for byte with SAP's own passport library on the same fields.
 */

import { randomBytes } from 'node:crypto';
import type { IDebuggeeIds } from '@mcp-abap-adt/interfaces-adt';

/** 288 bytes: the passport with every per-request field zero. */
const TEMPLATE = [
  '2A54482A03012000000000000000000000000000000000000000000000000000',
  '0000000000000000000000000000000000000000000000000000000000000000',
  '0000000000000000000000000000000000000000000000000000000000000000',
  '0000000000000000000000000000000000000000000000000000000000000000',
  '0000000000000000000000000000000000000000000000000000000000000000',
  '000000000000000000000000000000000000000000000000000A000000000000',
  '0000000000000000000000000000000000000000000000000000000000000001',
  '00E22A54482A01003A0100010002000200010300170000000000000000000000',
  '000000000000020002030017000000000000000000000000000000002A54482A',
].join('');

/** Byte offsets of the per-request fields. */
const TRANS_ID = 149; // 32 ASCII hex characters
const ROOT_CONTEXT_ID = 186; // 16 bytes
const TERMINAL_ID = 245; // 16 bytes, system variable item (2, 1)
const IDE_ID = 268; // 16 bytes, system variable item (2, 2)

/** Fixed per-request fields, for a reproducible passport; random when omitted. */
export interface IDebuggeePassportFields {
  /** 16 bytes as 32 hex characters. */
  rootContextId?: string;
  /** 32 hex characters, written as text. */
  transId?: string;
}

/**
 * The `SAP-PASSPORT` header value (upper-case hex) carrying the debuggee's ids.
 * Each id is 32 hex characters, as {@link IDebuggeeIds} states.
 */
export function debuggeePassport(
  ids: IDebuggeeIds,
  fields: IDebuggeePassportFields = {},
): string {
  const passport = Buffer.from(TEMPLATE, 'hex');
  const hex = () => randomBytes(16).toString('hex').toUpperCase();
  Buffer.from(fields.transId ?? hex(), 'ascii').copy(passport, TRANS_ID);
  Buffer.from(fields.rootContextId ?? hex(), 'hex').copy(
    passport,
    ROOT_CONTEXT_ID,
  );
  Buffer.from(ids.terminalId, 'hex').copy(passport, TERMINAL_ID);
  Buffer.from(ids.ideId, 'hex').copy(passport, IDE_ID);
  return passport.toString('hex').toUpperCase();
}
