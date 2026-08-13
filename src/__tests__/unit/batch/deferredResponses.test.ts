/**
 * The recorder says out loud that its responses arrive late.
 *
 * Without this, a handler holding an IAbapConnection cannot tell a batch
 * recorder from a live connection, and code that awaits a response to build the
 * next request deadlocks instead of failing.
 */
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { hasDeferredResponses } from '@mcp-abap-adt/interfaces';
import { BatchRecordingConnection } from '../../../batch/BatchRecordingConnection';

const stubConnection = {
  connect: async () => {},
  getBaseUrl: async () => 'https://example',
  getSessionId: () => null,
  setSessionType: () => {},
  makeAdtRequest: async () => ({
    data: '',
    status: 200,
    statusText: 'OK',
    headers: {},
  }),
} as unknown as IAbapConnection;

describe('a batch recorder declares its deferral', () => {
  it('is recognised by the capability guard', () => {
    const recorder = new BatchRecordingConnection(stubConnection);

    expect(hasDeferredResponses(recorder)).toBe(true);
  });

  it('leaves an ordinary connection unmarked', () => {
    expect(hasDeferredResponses(stubConnection)).toBe(false);
  });
});
