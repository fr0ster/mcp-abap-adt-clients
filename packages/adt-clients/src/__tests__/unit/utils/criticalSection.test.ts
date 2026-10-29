/**
 * `beginCriticalSection` opens the connection's critical section and hands
 * back the function that closes it — once. An unbalanced count would extend
 * the connector's raised timeout over every later request on the connection,
 * silently; a missing end on a failed write would do the same. The write path
 * that uses it is `messageClassMessageCriticalSection.test.ts`.
 */

import { beginCriticalSection } from '../../../utils/criticalSection';
import {
  CriticalSectionConnection,
  RecordingConnection,
} from '../../helpers/recordingConnection';

describe('beginCriticalSection', () => {
  it('opens before the request and closes after it, passing the answer through', async () => {
    const connection = new CriticalSectionConnection(() => 'BODY');

    const end = beginCriticalSection(connection);
    let answer: Awaited<ReturnType<typeof connection.makeAdtRequest>>;
    try {
      answer = await connection.makeAdtRequest({
        url: '/sap/bc/adt/x',
        method: 'PUT',
        timeout: 0,
      });
    } finally {
      end();
    }

    expect(connection.events).toEqual(['begin', 'PUT /sap/bc/adt/x', 'end']);
    expect(answer.data).toBe('BODY');
  });

  it('closes when the body throws', async () => {
    const connection = new CriticalSectionConnection();
    const failure = new Error('the write failed');

    const run = async () => {
      const end = beginCriticalSection(connection);
      try {
        await connection.makeAdtRequest({
          url: '/sap/bc/adt/x',
          method: 'PUT',
          timeout: 0,
        });
        throw failure;
      } finally {
        end();
      }
    };

    await expect(run()).rejects.toBe(failure);
    expect(connection.events).toEqual(['begin', 'PUT /sap/bc/adt/x', 'end']);
  });

  it('closes once however often its closer is called', () => {
    const connection = new CriticalSectionConnection();

    const end = beginCriticalSection(connection);
    end();
    end();

    expect(connection.events).toEqual(['begin', 'end']);
  });

  it('does nothing on a connection without a critical section, and the request still goes', async () => {
    const connection = new RecordingConnection();

    const end = beginCriticalSection(connection);
    await connection.makeAdtRequest({
      url: '/sap/bc/adt/x',
      method: 'GET',
      timeout: 0,
    });
    end();

    expect(connection.sent.map((r) => r.url)).toEqual(['/sap/bc/adt/x']);
  });
});
