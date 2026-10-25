/**
 * What the run-integrity logger says is said whatever `AUTH_LOG_LEVEL` is.
 *
 * Its lines are facts about the run — a check that was not made, say — so a
 * run with logging turned down to `warn` or `error` must still carry them.
 */

import { createRunIntegrityLogger } from '../../helpers/testLogger';

describe('createRunIntegrityLogger', () => {
  const saved = process.env.AUTH_LOG_LEVEL;
  let written: string[];
  let write: jest.SpyInstance;

  beforeEach(() => {
    written = [];
    write = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation((chunk: string | Uint8Array) => {
        written.push(String(chunk));
        return true;
      });
  });

  afterEach(() => {
    write.mockRestore();
    if (saved === undefined) delete process.env.AUTH_LOG_LEVEL;
    else process.env.AUTH_LOG_LEVEL = saved;
  });

  it.each(['error', 'warn', 'info'])(
    'says an info line with AUTH_LOG_LEVEL=%s',
    (level) => {
      process.env.AUTH_LOG_LEVEL = level;
      createRunIntegrityLogger().info?.('validate not sent — check is off');

      expect(written.join('')).toContain('validate not sent — check is off');
    },
  );

  it('keeps debug lines off', () => {
    process.env.AUTH_LOG_LEVEL = 'debug';
    createRunIntegrityLogger().debug?.('trace only');

    expect(written.join('')).not.toContain('trace only');
  });
});
