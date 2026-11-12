/**
 * A connection failure carries what the RFC SDK said (interfaces-adt 27.2.0,
 * `IAdtError.rfc`), so a consumer tells "the system closed the conversation"
 * (`RFC_CLOSED`) from any other failure without reading the message.
 *
 * The thrown value comes from below the ADT conversation — outside the type
 * system — so its `rfc` and each of the four fields are read as own data
 * properties (a getter is never run) and checked: `key` a string, `group` and
 * `code` integers, `codeString` one of `RFC_RCS`. Anything else is no `rfc`,
 * and the classifier never throws.
 *
 * Unit-only: the connection that throws such an error (22.0.0) is not yet
 * published, so the thrown shape here is the one measured on it — key and
 * codeString `RFC_CLOSED`, group 4, code 6.
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import { RFC_RCS } from '@mcp-abap-adt/interfaces-adt-connection';
import {
  AbapDebugger,
  abapDebuggerDocuments,
} from '../../../runtime/debugger/AbapDebugger';
import { AdtSAPError } from '../../../utils/adtErrors';
import { answering } from '../../../utils/adtResponse';
import { noopLogger } from '../../../utils/noopLogger';
import { rawDocument } from '../../../utils/resultStrategy';

/** The failure `answering` makes of what the request threw. */
async function failureOf(thrown: unknown) {
  const answer = await answering(async () => {
    throw thrown;
  }, rawDocument);
  if (answer.ok) throw new Error('expected a failure');
  return answer.getError();
}

/** The fields as measured on the connection when the system closed the call. */
function closedFields(): Record<string, unknown> {
  return { key: 'RFC_CLOSED', group: 4, code: 6, codeString: 'RFC_CLOSED' };
}

/** An Error carrying `rfc` as an own data property, as the connection throws. */
function rfcError(rfc: unknown, message = 'the RFC call failed'): Error {
  return Object.assign(new Error(message), { rfc });
}

const FIELDS = ['key', 'group', 'code', 'codeString'] as const;

describe('a connection failure carries the RFC SDK fields', () => {
  it('copies the four fields of a well-formed rfc', async () => {
    const failure = await failureOf(rfcError(closedFields()));

    expect(failure.origin).toBe('connection');
    expect(failure.message).toBe('the RFC call failed');
    expect(failure.rfc).toEqual({
      key: 'RFC_CLOSED',
      group: 4,
      code: 6,
      codeString: 'RFC_CLOSED',
    });
  });

  it.each(RFC_RCS)('takes every listed return code: %s', async (name) => {
    const failure = await failureOf(
      rfcError({ key: 'K', group: 1, code: 0, codeString: name }),
    );

    expect(failure.rfc?.codeString).toBe(name);
  });

  it('copies a fresh object of exactly the four fields', async () => {
    const own: Record<string, unknown> = {
      ...closedFields(),
      message: 'the SDK words',
      extra: 1,
    };
    const failure = await failureOf(rfcError(own));

    expect(failure.rfc).not.toBe(own);
    expect(failure.rfc).toEqual(closedFields());
    expect(Object.keys(failure.rfc ?? {}).sort()).toEqual(
      ['code', 'codeString', 'group', 'key'].sort(),
    );
    own.key = 'changed later';
    expect(failure.rfc?.key).toBe('RFC_CLOSED');
  });

  it('keeps every other field, connectionCause included', async () => {
    const request = { method: 'POST', url: '/sap/bc/adt/debugger' };
    const thrown = Object.assign(rfcError(closedFields()), {
      code: 'ECONNRESET',
      request,
    });

    const failure = await failureOf(thrown);

    expect(failure).toEqual({
      origin: 'connection',
      message: 'the RFC call failed',
      response: undefined,
      request,
      connectionCause: 'ECONNRESET',
      rfc: closedFields(),
    });
  });

  it('carries no rfc for an HTTP failure', async () => {
    const thrown = Object.assign(new Error('Request failed with 500'), {
      response: { data: '', status: 500, statusText: 'x', headers: {} },
    });

    const failure = await failureOf(thrown);

    expect(failure.origin).toBe('connection');
    expect('rfc' in failure).toBe(false);
  });

  it('carries no rfc when nothing carries one', async () => {
    const failure = await failureOf(new Error('the socket failed'));

    expect('rfc' in failure).toBe(false);
  });

  it.each([
    ['a string', 'the RFC call failed'],
    ['undefined', undefined],
    ['null', null],
  ])('carries no rfc when the thrown value is %s', async (_, thrown) => {
    const failure = await failureOf(thrown);

    expect(failure.origin).toBe('connection');
    expect('rfc' in failure).toBe(false);
  });

  it('carries no rfc for a refusal, whatever the error carries', async () => {
    const refusal = Object.assign(
      new AdtSAPError('SAP refused', '<exc/>', undefined, undefined, {
        data: '<exc/>',
        status: 403,
        statusText: 'Forbidden',
        headers: {},
      }),
      { rfc: closedFields() },
    );

    const failure = await failureOf(refusal);

    expect(failure.origin).toBe('refusal');
    expect('rfc' in failure).toBe(false);
  });

  it('carries no rfc for the credential SAP refused with a 401', async () => {
    const unauthorized = {
      data: '',
      status: 401,
      statusText: 'Unauthorized',
      headers: {},
    };
    const thrown = Object.assign(new Error('the credential was refused'), {
      rfc: closedFields(),
      refusal: { kind: 'credential-refused', reason: 'refused' },
      at: 'request',
      cause: Object.assign(new Error('Request failed with status code 401'), {
        rfc: closedFields(),
        response: unauthorized,
      }),
    });

    const failure = await failureOf(thrown);

    expect(failure.origin).toBe('connection');
    expect(failure.response).toBe(unauthorized);
    expect('rfc' in failure).toBe(false);
  });

  describe('a malformed rfc is no rfc, and nothing throws', () => {
    async function expectNoRfc(thrown: unknown) {
      const failure = await failureOf(thrown);
      expect(failure.origin).toBe('connection');
      expect('rfc' in failure).toBe(false);
    }

    it.each(FIELDS)('%s missing', async (field) => {
      const rfc = closedFields();
      delete rfc[field];
      await expectNoRfc(rfcError(rfc));
    });

    it.each([
      ['key a number', 'key', 1],
      ['key null', 'key', null],
      ['group a string', 'group', '4'],
      ['group a bigint', 'group', 4n],
      ['group not an integer', 'group', 4.5],
      ['group NaN', 'group', Number.NaN],
      ['group Infinity', 'group', Number.POSITIVE_INFINITY],
      ['code a string', 'code', '6'],
      ['code not an integer', 'code', 6.1],
      ['code NaN', 'code', Number.NaN],
      ['codeString off the list', 'codeString', 'RFC_GONE'],
      ['codeString in other case', 'codeString', 'rfc_closed'],
      ['codeString padded', 'codeString', ' RFC_CLOSED'],
      ['codeString a number', 'codeString', 6],
      ['codeString a boxed string', 'codeString', Object('RFC_CLOSED')],
    ])('%s', async (_, field, value) => {
      await expectNoRfc(rfcError({ ...closedFields(), [field]: value }));
    });

    it.each([
      ['a string', 'RFC_CLOSED'],
      ['a number', 6],
      ['null', null],
      ['an array', ['RFC_CLOSED', 4, 6, 'RFC_CLOSED']],
    ])('rfc that is %s', async (_, rfc) => {
      await expectNoRfc(rfcError(rfc));
    });

    it.each(FIELDS)(
      '%s inherited while the other three are own',
      async (field) => {
        const fields = closedFields();
        const inherited = { [field]: fields[field] };
        delete fields[field];
        const rfc = Object.assign(Object.create(inherited), fields);
        await expectNoRfc(rfcError(rfc));
      },
    );

    it('rfc inherited, not own', async () => {
      const thrown = Object.create(
        Object.assign(new Error('x'), { rfc: closedFields() }),
      );
      await expectNoRfc(thrown);
    });

    it.each(FIELDS)('never runs a getter for %s', async (field) => {
      let read = 0;
      const rfc = closedFields();
      delete rfc[field];
      Object.defineProperty(rfc, field, {
        enumerable: true,
        get() {
          read += 1;
          throw new Error('a getter must not run');
        },
      });

      await expectNoRfc(rfcError(rfc));
      expect(read).toBe(0);
    });

    it('never runs a getter for rfc itself', async () => {
      let read = 0;
      const thrown = new Error('x');
      Object.defineProperty(thrown, 'rfc', {
        get() {
          read += 1;
          return closedFields();
        },
      });

      await expectNoRfc(thrown);
      expect(read).toBe(0);
    });

    it('a thrown value whose trap throws for rfc', async () => {
      const thrown = new Proxy(new Error('x'), {
        getOwnPropertyDescriptor(target, key) {
          if (key === 'rfc') throw new Error('a trap that refuses');
          return Reflect.getOwnPropertyDescriptor(target, key);
        },
      });

      const failure = await failureOf(thrown);

      expect(failure.message).toBe('x');
      expect('rfc' in failure).toBe(false);
    });

    it.each(FIELDS)('an rfc whose trap throws for %s', async (field) => {
      const rfc = new Proxy(closedFields(), {
        getOwnPropertyDescriptor(target, key) {
          if (key === field) throw new Error('a trap that refuses');
          return Reflect.getOwnPropertyDescriptor(target, key);
        },
      });

      await expectNoRfc(rfcError(rfc));
    });
  });
});

describe('a member answers the RFC fields of the call that failed', () => {
  it('terminateDebugger: the system closed the conversation', async () => {
    const connection: IAbapConnection = {
      connect: async () => undefined,
      getBaseUrl: async () => undefined,
      getSessionId: () => null,
      setSessionType: () => undefined,
      makeAdtRequest: async () => {
        throw rfcError(closedFields(), 'RFC_CLOSED: connection closed');
      },
    };
    const debugger_ = new AbapDebugger(connection, {
      logger: noopLogger,
      results: abapDebuggerDocuments,
    });

    const answer = await debugger_.terminateDebugger();

    expect(answer.ok).toBe(false);
    if (answer.ok) throw new Error('expected a failure');
    expect(answer.getError().origin).toBe('connection');
    expect(answer.getError().rfc?.codeString).toBe('RFC_CLOSED');
    expect(answer.getError().rfc).toEqual(closedFields());
  });
});
