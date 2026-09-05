/**
 * `AdtInclude` behaviour, without SAP.
 *
 * Every case here exists because review found the defect it pins. A handler
 * that declares `IAdtOperationOptions` and then ignores it is the same class of
 * defect this release was written to remove — a type promising what the code
 * does not do — and it went in unnoticed because nothing exercised it.
 */

import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import { AdtInclude } from '../../../core/include';
import { expectFailure, expectResult } from '../../helpers/contract';

const LOCK_XML = `<?xml version="1.0" encoding="utf-8"?><asx:abap xmlns:asx="http://www.sap.com/abapxml"><asx:values><DATA><LOCK_HANDLE>LH1</LOCK_HANDLE></DATA></asx:values></asx:abap>`;

function createConnection() {
  const calls: Array<{ url: string; method: string; data?: unknown }> = [];
  const connection = {
    makeAdtRequest: jest.fn(async (request: any) => {
      calls.push({
        url: request.url,
        method: request.method,
        data: request.data,
      });
      if (String(request.url).includes('_action=LOCK')) {
        return { status: 200, data: LOCK_XML, headers: {} };
      }
      return { status: 200, data: '', headers: {} };
    }),
    setSessionType: jest.fn(),
  } as unknown as IAbapConnection;
  return { connection, calls };
}

const logger = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
} as unknown as ILogger;

const BASE = {
  includeName: 'ZMY_INC',
  packageName: '$TMP',
  description: 'guard',
};

describe('AdtInclude', () => {
  describe('the create document', () => {
    it('escapes every user value, so a quote or an ampersand cannot break it', async () => {
      const { connection, calls } = createConnection();
      await new AdtInclude(connection, logger).create({
        ...BASE,
        description: 'R&D "quoted" <tagged>',
      });

      const body = String(
        calls.find((c) => c.url === '/sap/bc/adt/programs/includes')?.data,
      );
      expect(body).toContain('R&amp;D');
      expect(body).toContain('&quot;quoted&quot;');
      expect(body).toContain('&lt;tagged&gt;');
      // The raw forms must not survive into an attribute value.
      expect(body).not.toContain('R&D');
      expect(body).not.toContain('"quoted"');
    });

    it('is an include document, not a program one', async () => {
      const { connection, calls } = createConnection();
      await new AdtInclude(connection, logger).create(BASE);

      const body = String(calls[0]?.data);
      expect(body).toContain('include:abapInclude');
      expect(body).toContain('adtcore:type="PROG/I"');
      // The attributes an include does not have.
      expect(body).not.toContain('program:abapProgram');
      expect(body).not.toContain('programType');
    });
  });

  describe('IAdtOperationOptions', () => {
    it('does NOT activate on create unless asked — the contract default is false', async () => {
      const { connection, calls } = createConnection();
      await new AdtInclude(connection, logger).create({
        ...BASE,
        sourceCode: '" code',
      });

      expect(calls.some((c) => c.url.includes('/activation'))).toBe(false);
    });

    it('activates on create when activateOnCreate says so', async () => {
      const { connection, calls } = createConnection();
      await new AdtInclude(connection, logger).create(
        { ...BASE, sourceCode: '" code' },
        { activateOnCreate: true },
      );

      expect(calls.some((c) => c.url.includes('/activation'))).toBe(true);
    });

    it('takes the source from options, which win over the config', async () => {
      const { connection, calls } = createConnection();
      await new AdtInclude(connection, logger).create(
        { ...BASE, sourceCode: '" from config' },
        { sourceCode: '" from options' },
      );

      const put = calls.find((c) => c.method === 'PUT');
      expect(put?.data).toBe('" from options');
    });

    it('accepts a source given only in options, with none in the config', async () => {
      const { connection, calls } = createConnection();
      await new AdtInclude(connection, logger).update(
        { includeName: 'ZMY_INC' },
        { sourceCode: '" only in options' },
      );

      const put = calls.find((c) => c.method === 'PUT');
      expect(put?.data).toBe('" only in options');
    });

    it('does not activate on update unless activateOnUpdate says so', async () => {
      const { connection, calls } = createConnection();
      await new AdtInclude(connection, logger).update({
        includeName: 'ZMY_INC',
        sourceCode: '" code',
      });

      expect(calls.some((c) => c.url.includes('/activation'))).toBe(false);
    });

    it('uses a caller-held lock and neither locks nor unlocks around it', async () => {
      const { connection, calls } = createConnection();
      expectResult(
        await new AdtInclude(connection, logger).update(
          { includeName: 'ZMY_INC' },
          { sourceCode: '" code', lockHandle: 'CALLER_HANDLE' },
        ),
        'update with a caller-held lock',
      );

      expect(calls.some((c) => c.url.includes('_action=LOCK'))).toBe(false);
      // Releasing a lock the caller owns is how its next request starts failing.
      expect(calls.some((c) => c.url.includes('_action=UNLOCK'))).toBe(false);
      // The handle the caller passed is the one the write carries — which is
      // the whole claim, and the requests are where it is visible.
      expect(calls.find((c) => c.method === 'PUT')?.url).toContain(
        'lockHandle=CALLER_HANDLE',
      );
    });
  });

  describe('an empty source is a value, not an absence', () => {
    it('clears an include to empty instead of refusing the edit', async () => {
      const { connection, calls } = createConnection();
      await new AdtInclude(connection, logger).update({
        includeName: 'ZMY_INC',
        sourceCode: '',
      });

      const put = calls.find((c) => c.method === 'PUT');
      expect(put).toBeDefined();
      expect(put?.data).toBe('');
    });

    it('writes an empty source on create too', async () => {
      const { connection, calls } = createConnection();
      await new AdtInclude(connection, logger).create({
        ...BASE,
        sourceCode: '',
      });

      expect(calls.some((c) => c.method === 'PUT')).toBe(true);
    });

    it('still refuses an update with no source at all', async () => {
      const { connection } = createConnection();
      await expect(
        new AdtInclude(connection, logger).update({ includeName: 'ZMY_INC' }),
      ).rejects.toThrow(/sourceCode is required/);
    });
  });

  describe('deleteOnFailure', () => {
    /** Metadata POST succeeds; the source write does not. */
    function createWithFailingUpload() {
      const { connection, calls } = createConnection();
      (connection.makeAdtRequest as jest.Mock).mockImplementation(
        async (request: any) => {
          calls.push({
            url: request.url,
            method: request.method,
            data: request.data,
          });
          if (request.method === 'PUT') {
            throw new Error('source rejected');
          }
          if (String(request.url).includes('_action=LOCK')) {
            return { status: 200, data: LOCK_XML, headers: {} };
          }
          return { status: 200, data: '', headers: {} };
        },
      );
      return { connection, calls };
    }

    it('removes the half-made include when asked', async () => {
      const { connection, calls } = createWithFailingUpload();
      const failure = expectFailure(
        await new AdtInclude(connection, logger).create(
          { ...BASE, sourceCode: '" code' },
          { deleteOnFailure: true },
        ),
        'create whose source write is rejected',
      );

      expect(calls.some((c) => c.method === 'DELETE')).toBe(true);
      // The failure that caused the rollback is what comes back. The rollback
      // is cleanup; it does not become the answer, and it does not hide the
      // reason the include is not there.
      expect(failure.message).toContain('source rejected');
    });

    it('rolls back without being asked — the default is on', async () => {
      // It used to be off, and this test asserted that. The reason it changed:
      // a create that fails after the object exists leaves a name taken, and
      // the caller asked for a created-and-written include rather than for
      // whatever this left. The object removed is one this call made moments
      // earlier, so there is nothing of the caller's to lose.
      const { connection, calls } = createWithFailingUpload();
      await new AdtInclude(connection, logger).create({
        ...BASE,
        sourceCode: '" code',
      });

      expect(calls.some((c) => c.method === 'DELETE')).toBe(true);
    });

    it('leaves it in place when told not to', async () => {
      const { connection, calls } = createWithFailingUpload();
      await new AdtInclude(connection, logger).create(
        { ...BASE, sourceCode: '" code' },
        { deleteOnFailure: false },
      );

      expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
    });

    it('does not roll back a create that succeeded', async () => {
      const { connection, calls } = createConnection();
      await new AdtInclude(connection, logger).create(
        { ...BASE, sourceCode: '" code' },
        { deleteOnFailure: true },
      );

      expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
    });
  });

  describe('errors say which operation failed', () => {
    it('names activation, not lock cleanup, when activation fails', async () => {
      const { connection } = createConnection();
      (connection.makeAdtRequest as jest.Mock).mockImplementation(
        async (request: any) => {
          if (String(request.url).includes('/activation')) {
            throw new Error('activation refused');
          }
          if (String(request.url).includes('_action=LOCK')) {
            return { status: 200, data: LOCK_XML, headers: {} };
          }
          return { status: 200, data: '', headers: {} };
        },
      );

      const failure = expectFailure(
        await new AdtInclude(connection, logger).update(
          { includeName: 'ZMY_INC', sourceCode: '" code' },
          { activateOnUpdate: true },
        ),
        'update whose activation is refused',
      );

      // Reported as 'releaseLock' once, which sent the reader looking at lock
      // cleanup for a failure that happened in activation. The unlock still
      // runs — it is scope cleanup — but it is not what the caller is told.
      expect(failure.message).toContain('activation refused');
    });
  });

  describe('the endpoints are the include ones', () => {
    it('addresses /programs/includes, never /programs/programs', async () => {
      const { connection, calls } = createConnection();
      const include = new AdtInclude(connection, logger);
      await include.create({ ...BASE, sourceCode: '" code' });
      await include.readMetadata({ includeName: 'ZMY_INC' });
      await include.delete({ includeName: 'ZMY_INC' });

      expect(calls.length).toBeGreaterThan(0);
      for (const call of calls) {
        expect(call.url).not.toContain('/programs/programs');
      }
      expect(
        calls.some((c) => c.url.startsWith('/sap/bc/adt/programs/includes')),
      ).toBe(true);
    });

    it('validates at the include endpoint with the three measured params', async () => {
      const { connection, calls } = createConnection();
      await new AdtInclude(connection, logger).validate(BASE);

      const validation = calls.find((c) =>
        c.url.includes('/includes/validation'),
      );
      expect(validation).toBeDefined();
      expect(validation?.url).toContain('objname=ZMY_INC');
      expect(validation?.url).toContain('objtype=PROG%2FI');
      expect(validation?.url).toContain('packagename=%24TMP');
    });
  });
});
