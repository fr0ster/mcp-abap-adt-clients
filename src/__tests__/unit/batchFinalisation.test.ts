import { finaliseBatch } from '../helpers/batchFinalisation';
import { assertBatchStatuses } from '../helpers/batchStatuses';

test('finalisation preserves the primary failure and always disconnects', async () => {
  const primary = new Error('primary');
  const cleanup = new Error('cleanup');
  const write = new Error('write');
  const log = new Error('log');
  const disconnect = jest.fn(async () => {
    throw new Error('disconnect');
  });
  const error = jest.fn();
  await expect(
    finaliseBatch(
      [primary],
      [
        () => {
          throw cleanup;
        },
        () => {
          throw write;
        },
        () => {
          throw log;
        },
        disconnect,
      ],
      { error } as any,
    ),
  ).rejects.toBe(primary);
  expect(disconnect).toHaveBeenCalledTimes(1);
  expect(error.mock.calls.map(([message]) => message)).toEqual([
    'Batch cleanup/finalisation failed: Error: cleanup',
    'Batch cleanup/finalisation failed: Error: write',
    'Batch cleanup/finalisation failed: Error: log',
    'Batch cleanup/finalisation failed: Error: disconnect',
  ]);
});

test('a logger failure cannot replace the primary failure', async () => {
  const primary = new Error('primary');
  await expect(
    finaliseBatch([primary, new Error('cleanup')], [], {
      error: () => {
        throw new Error('logger');
      },
    } as any),
  ).rejects.toBe(primary);
});

test('a finalisation failure fails an otherwise successful run', async () => {
  const failure = new Error('write');
  await expect(
    finaliseBatch(
      [],
      [
        () => {
          throw failure;
        },
      ],
      {} as any,
    ),
  ).rejects.toBe(failure);
});

test.each([
  200, 404, 500,
])('debugger verdict checks inner status %s', (status) => {
  const response = {
    status: 202,
    statusText: 'Accepted',
    headers: { 'content-type': 'multipart/mixed; boundary=b' },
    data: `--b\r\nContent-Type: application/http\r\n\r\nHTTP/1.1 ${status} Result\r\nContent-Type: text/plain\r\n\r\nbody\r\n--b--\r\n`,
  };
  if (status === 200)
    expect(() =>
      assertBatchStatuses(response, '/tmp/exchange.txt'),
    ).not.toThrow();
  else
    expect(() => assertBatchStatuses(response, '/tmp/exchange.txt')).toThrow(
      `expected 200, received ${status}; exchange: /tmp/exchange.txt`,
    );
});
