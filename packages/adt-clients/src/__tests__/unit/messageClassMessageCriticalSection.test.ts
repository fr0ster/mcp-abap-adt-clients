/**
 * Every write of a message (`create`, `update`, `delete`) runs its
 * LOCK … PUT … UNLOCK window inside the connection's critical section: opened
 * once after the class is read and before the first lock, closed once after
 * the last unlock — and closed when the PUT fails too, after the unwinding
 * unlocks. The write's answer is the PUT's.
 */

import type { IAbapRequestOptions } from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtMessageClassMessage } from '../../core/messageClass/AdtMessageClassMessage';
import { messageDocuments } from '../../core/messageClass/types';
import { noopLogger } from '../../utils/noopLogger';
import { headersOf } from '../helpers/adtHeaders';
import { expectResult } from '../helpers/contract';
import { CriticalSectionConnection } from '../helpers/recordingConnection';

const CLASS_XML = `<?xml version="1.0"?><mc:messageClass xmlns:mc="http://www.sap.com/adt/MessageClass" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:name="ZT" adtcore:type="MSAG/N"><adtcore:packageRef adtcore:name="ZP"/><mc:messages mc:msgno="001" mc:msgtext="T1"/></mc:messageClass>`;
const LOCK = (h: string) =>
  `<asx:abap xmlns:asx="http://www.sap.com/abapxml"><asx:values><DATA><LOCK_HANDLE>${h}</LOCK_HANDLE></DATA></asx:values></asx:abap>`;

function bodyFor(options: IAbapRequestOptions): string {
  const url = String(options.url);
  if (url.includes('_action=LOCK_MSG')) return LOCK('MH');
  if (url.includes('_action=LOCK')) return LOCK('CH');
  if (options.method === 'GET') return CLASS_XML;
  if (options.method === 'PUT') return 'WRITTEN';
  return '';
}

/** The events of a write, each request reduced to its method and action. */
function steps(events: readonly string[]): string[] {
  return events.map((event) => {
    if (event === 'begin' || event === 'end') return event;
    const [method, url = ''] = event.split(' ');
    const action = new URL(url, 'http://h').searchParams.get('_action');
    return action ? `${method} ${action}` : `${method}`;
  });
}

function handler(connection: CriticalSectionConnection) {
  return new AdtMessageClassMessage(connection, {
    logger: noopLogger,
    results: messageDocuments,
  });
}

describe('AdtMessageClassMessage: the critical section around a write', () => {
  it('opens after the read, before the first lock, and closes after the last unlock', async () => {
    const connection = new CriticalSectionConnection(bodyFor);
    const m = handler(connection);

    const answer = await m.update(
      { className: 'ZT', msgno: '001', msgtext: 'NEW' },
      { headers: headersOf(m, 'update') },
    );

    expect(steps(connection.events)).toEqual([
      'GET',
      'begin',
      'POST LOCK_MSG',
      'POST LOCK',
      'PUT',
      'POST UNLOCK',
      'POST UNLOCK_ALL',
      'end',
    ]);
    expect(expectResult(answer, 'update 001')).toBe('WRITTEN');
  });

  it('closes once when the PUT fails, after the unlocks', async () => {
    const connection = new CriticalSectionConnection((options) => {
      if (options.method === 'PUT') throw new Error('the PUT failed');
      return bodyFor(options);
    });
    const m = handler(connection);

    const answer = await m.update(
      { className: 'ZT', msgno: '001', msgtext: 'NEW' },
      { headers: headersOf(m, 'update') },
    );

    expect(answer.ok).toBe(false);
    // The PUT went out and was refused; the chain then unwinds in reverse
    // order of registration — the class lock, the message locks — and the
    // section closes last, once.
    expect(steps(connection.events)).toEqual([
      'GET',
      'begin',
      'POST LOCK_MSG',
      'POST LOCK',
      'PUT',
      'POST UNLOCK',
      'POST UNLOCK_ALL',
      'end',
    ]);
  });

  it('delete runs in it as well', async () => {
    const connection = new CriticalSectionConnection(bodyFor);
    const m = handler(connection);

    await m.delete(
      { className: 'ZT', msgno: '001' },
      { headers: headersOf(m, 'delete') },
    );

    const events = steps(connection.events);
    expect(events[1]).toBe('begin');
    expect(events.at(-1)).toBe('end');
    expect(events.filter((e) => e === 'begin' || e === 'end')).toEqual([
      'begin',
      'end',
    ]);
  });
});
