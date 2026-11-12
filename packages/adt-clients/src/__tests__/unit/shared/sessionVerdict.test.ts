/**
 * An answer carries what the connection said about the SAP session
 * (interfaces-adt 27.3.0): `IAdtError.sessionError`, the connection's session
 * code a connection failure was thrown with, and `sessionLost` on a failure
 * and on a result, the mark of a request answered with the session replaced
 * (interfaces-adt-connection 4.2.0). A consumer reads them by field, never
 * from the message.
 *
 * The thrown value comes from below the ADT conversation — outside the type
 * system — so `code` and `sessionLost` are read as own data properties (a
 * getter is never run, an inherited field is no field) and compared with the
 * closed list each belongs to. The classifier never throws on what was thrown.
 *
 * The shapes are connection 23.0.0's: a session error is an `Error` with an
 * own `code` (`sessionError`); a marked refusal is SAP's refusal with an own,
 * read-only `sessionLost`, or — when the refusal is frozen — an object made by
 * `Object.create(refusal, { sessionLost })`, whose every other field is
 * inherited (`markedLost`); a marked success is the response with an own
 * `sessionLost`. Unit-only: no live run here provokes a session replacement.
 */

import { analyseDebuggerFreed } from '@mcp-abap-adt/adt-strategies';
import {
  ADT_NO_FAILURE,
  type IAdtError,
  type IAnalyse,
  type IResultStrategy,
} from '@mcp-abap-adt/interfaces-adt';
import {
  ADT_SESSION_ERROR,
  type IAbapConnection,
  type IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import {
  AbapDebugger,
  abapDebuggerDocuments,
} from '../../../runtime/debugger/AbapDebugger';
import { AdtSAPError } from '../../../utils/adtErrors';
import { answering } from '../../../utils/adtResponse';
import { noopLogger } from '../../../utils/noopLogger';
import {
  nothing,
  rawDocument,
  wireItself,
} from '../../../utils/resultStrategy';

const REPLACED = ADT_SESSION_ERROR.SESSION_REPLACED;

/** The failure `answering` makes of what the request threw. */
async function failureOf(thrown: unknown, analyse?: IAnalyse) {
  const answer = await answering(
    async () => {
      throw thrown;
    },
    rawDocument,
    analyse,
  );
  if (answer.ok) throw new Error('expected a failure');
  return answer.getError();
}

/** A session error as the connection throws it: an own `code`. */
function sessionError(code: unknown, message = 'the session failed'): Error {
  return Object.assign(new Error(message), { code });
}

/** SAP's refusal of a request, as the wire throws it. */
function refusal(status = 400): Error & {
  response: IAdtWireResponse;
  code: string;
  request: { method: string; url: string };
} {
  return Object.assign(new Error(`Request failed with status code ${status}`), {
    code: 'ERR_BAD_REQUEST',
    response: {
      data: '<exc:exception/>',
      status,
      statusText: 'Bad Request',
      headers: {},
    },
    request: { method: 'GET', url: '/sap/bc/adt/oo/classes/zcl_x' },
  });
}

const MARK: PropertyDescriptor = {
  value: REPLACED,
  enumerable: true,
  configurable: true,
  writable: false,
};

/** Marked in place, as `markedLost` marks an extensible refusal. */
function markedInPlace(): ReturnType<typeof refusal> {
  const error = refusal();
  Object.defineProperty(error, 'sessionLost', MARK);
  return error;
}

/** Marked from above, as `markedLost` answers a frozen refusal. */
function markedLayered(): ReturnType<typeof refusal> {
  return Object.create(Object.freeze(refusal()), { sessionLost: MARK });
}

describe('a connection failure carries the session code', () => {
  it.each(Object.values(ADT_SESSION_ERROR))('carries %s', async (code) => {
    const failure = await failureOf(sessionError(code));

    expect(failure.origin).toBe('connection');
    expect(failure.sessionError).toBe(code);
    expect('connectionCause' in failure).toBe(false);
    expect(failure.message).toBe('the session failed');
  });

  it.each([
    'ADT_SOMETHING_ELSE',
    'adt_not_connected',
    ' ADT_NOT_CONNECTED',
    'ECONNREFUSED',
    '',
    42,
  ])('carries none for a code off the list: %j', async (code) => {
    const failure = await failureOf(sessionError(code));

    expect(failure.origin).toBe('connection');
    expect('sessionError' in failure).toBe(false);
  });

  it('carries none for an inherited code', async () => {
    const thrown = Object.create(
      sessionError(ADT_SESSION_ERROR.NOT_CONNECTED),
    );

    const failure = await failureOf(thrown);

    expect('sessionError' in failure).toBe(false);
  });

  it('carries none for a code behind a getter, and runs no getter', async () => {
    const getter = jest.fn(() => ADT_SESSION_ERROR.NOT_CONNECTED);
    const thrown = new Error('the session failed');
    Object.defineProperty(thrown, 'code', { get: getter });

    const failure = await failureOf(thrown);

    expect('sessionError' in failure).toBe(false);
    expect(getter).not.toHaveBeenCalled();
  });

  it('carries none when inspecting code throws', async () => {
    const thrown = new Proxy(new Error('the session failed'), {
      getOwnPropertyDescriptor(target, key) {
        if (key === 'code') throw new Error('trap');
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    });

    const failure = await failureOf(thrown);

    expect(failure.origin).toBe('connection');
    expect('sessionError' in failure).toBe(false);
  });
});

describe('a refusal carries the sessionLost mark', () => {
  it('marked in place', async () => {
    const thrown = markedInPlace();

    const failure = await failureOf(thrown);

    expect(failure.sessionLost).toBe(REPLACED);
    expect(failure.response).toBe(thrown.response);
    expect(failure.message).toBe('Request failed with status code 400');
    expect(failure.request).toEqual(thrown.request);
    expect('sessionError' in failure).toBe(false);
  });

  it('marked from above a frozen refusal', async () => {
    const thrown = markedLayered();

    const failure = await failureOf(thrown);

    expect(failure.sessionLost).toBe(REPLACED);
    expect(failure.response?.status).toBe(400);
    expect(failure.message).toBe('Request failed with status code 400');
    expect(failure.request).toEqual({
      method: 'GET',
      url: '/sap/bc/adt/oo/classes/zcl_x',
    });
  });

  it('none for an unmarked refusal', async () => {
    const failure = await failureOf(refusal());

    expect('sessionLost' in failure).toBe(false);
  });

  it.each([
    ['another session code', ADT_SESSION_ERROR.NOT_CONNECTED],
    ['a word', 'lost'],
    ['a flag', true],
  ])('none for a mark of %s', async (_, value) => {
    const thrown = Object.assign(refusal(), { sessionLost: value });

    const failure = await failureOf(thrown);

    expect('sessionLost' in failure).toBe(false);
  });

  it('none for an inherited mark only', async () => {
    const thrown = Object.create(markedInPlace());

    const failure = await failureOf(thrown);

    expect('sessionLost' in failure).toBe(false);
  });

  it('none for a mark behind a getter, and runs no getter', async () => {
    const getter = jest.fn(() => REPLACED);
    const thrown = refusal();
    Object.defineProperty(thrown, 'sessionLost', { get: getter });

    const failure = await failureOf(thrown);

    expect('sessionLost' in failure).toBe(false);
    expect(getter).not.toHaveBeenCalled();
  });

  it('none when inspecting sessionLost throws, and classifies the rest', async () => {
    const thrown = new Proxy(markedInPlace(), {
      getOwnPropertyDescriptor(target, key) {
        if (key === 'sessionLost') throw new Error('trap');
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    });

    const failure = await failureOf(thrown);

    expect(failure.origin).toBe('connection');
    expect('sessionLost' in failure).toBe(false);
    expect(failure.response?.status).toBe(400);
    expect(failure.message).toBe('Request failed with status code 400');
  });
});

describe('EPIPE is a connection cause', () => {
  it('a write to a reset socket names EPIPE', async () => {
    const failure = await failureOf(sessionError('EPIPE', 'write EPIPE'));

    expect(failure.connectionCause).toBe('EPIPE');
    expect('sessionError' in failure).toBe(false);
  });
});

describe('the debugger stop on a spent connection', () => {
  /** A debugger whose connection has no usable session. */
  function spentDebugger() {
    const connection: IAbapConnection = {
      connect: async () => undefined,
      getBaseUrl: async () => undefined,
      getSessionId: () => null,
      setSessionType: () => undefined,
      makeAdtRequest: async () => {
        throw sessionError(
          ADT_SESSION_ERROR.NOT_CONNECTED,
          'The session this request was admitted to is gone; nothing was sent',
        );
      },
    };
    return new AbapDebugger(connection, {
      logger: noopLogger,
      results: abapDebuggerDocuments,
    });
  }

  it.each([
    ['no analyser', undefined],
    ['analyseDebuggerFreed', analyseDebuggerFreed],
  ])('terminateDebugger through %s answers ADT_NOT_CONNECTED', async (_, analyse) => {
    const answer = await spentDebugger().terminateDebugger(
      analyse === undefined ? undefined : { analyse },
    );

    expect(answer.ok).toBe(false);
    if (answer.ok) throw new Error('expected a failure');
    expect(answer.getError().sessionError).toBe(
      ADT_SESSION_ERROR.NOT_CONNECTED,
    );
  });

  it('a consumer clearing the verdict cannot make a success of no answer', async () => {
    const clearsEverything: IAnalyse = () => ADT_NO_FAILURE;
    const answer = await spentDebugger().terminateDebugger({
      analyse: clearsEverything,
    });

    expect(answer.ok).toBe(false);
    if (answer.ok) throw new Error('expected a failure');
    expect(answer.getError().sessionError).toBe(
      ADT_SESSION_ERROR.NOT_CONNECTED,
    );
  });
});

/** A 2xx answer, marked as connection 23.0.0 marks a stateless success. */
function markedWire(data = '<document/>'): IAdtWireResponse {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    sessionLost: REPLACED,
  };
}

describe('a refusal read from a 2xx document carries the answer\'s mark', () => {
  it('AdtSAPError on a marked answer', async () => {
    const failure = await failureOf(
      new AdtSAPError(
        'the object is locked',
        '<exc:exception/>',
        undefined,
        undefined,
        markedWire(),
      ),
    );

    expect(failure.origin).toBe('refusal');
    expect(failure.sessionLost).toBe(REPLACED);
  });

  it('AdtSAPError on an unmarked answer', async () => {
    const { sessionLost: _, ...unmarked } = markedWire();
    const failure = await failureOf(
      new AdtSAPError(
        'the object is locked',
        '<exc:exception/>',
        undefined,
        undefined,
        unmarked,
      ),
    );

    expect('sessionLost' in failure).toBe(false);
  });

  it('a marked 401 thrown as itself takes the connection branch', async () => {
    const thrown = Object.assign(refusal(401), { sessionLost: REPLACED });

    const failure = await failureOf(thrown);

    expect(failure.origin).toBe('connection');
    expect(failure.response?.status).toBe(401);
    expect(failure.sessionLost).toBe(REPLACED);
  });
});

describe('a success carries the mark of the answer it was read from', () => {
  async function successOf<T>(
    wire: IAdtWireResponse,
    read: IResultStrategy<T>,
  ) {
    const answer = await answering(async () => wire, read);
    if (!answer.ok) throw new Error('expected a success');
    return answer.getResult();
  }

  it('whatever the reading: rawDocument', async () => {
    expect((await successOf(markedWire(), rawDocument)).sessionLost).toBe(
      REPLACED,
    );
  });

  it('whatever the reading: nothing', async () => {
    expect((await successOf(markedWire(), nothing)).sessionLost).toBe(
      REPLACED,
    );
  });

  it('whatever the reading: wireItself', async () => {
    expect((await successOf(markedWire(), wireItself)).sessionLost).toBe(
      REPLACED,
    );
  });

  it('an unmarked answer leaves no key on the result', async () => {
    const { sessionLost: _, ...unmarked } = markedWire();
    const result = await successOf(unmarked, rawDocument);

    expect(result).toEqual({ value: '<document/>' });
    expect('sessionLost' in result).toBe(false);
  });

  it('a cleared verdict on a marked refusal: the success carries its mark', async () => {
    const clearsEverything: IAnalyse = () => ADT_NO_FAILURE;
    const answer = await answering(
      async () => {
        throw markedInPlace();
      },
      rawDocument,
      clearsEverything,
    );

    expect(answer.ok).toBe(true);
    if (!answer.ok) throw new Error('expected a success');
    expect(answer.getResult().value).toBe('<exc:exception/>');
    expect(answer.getResult().sessionLost).toBe(REPLACED);
  });

  it('a cleared verdict on a layered refusal: the success carries its mark', async () => {
    const clearsEverything: IAnalyse = () => ADT_NO_FAILURE;
    const answer = await answering(
      async () => {
        throw markedLayered();
      },
      rawDocument,
      clearsEverything,
    );

    if (!answer.ok) throw new Error('expected a success');
    expect(answer.getResult().sessionLost).toBe(REPLACED);
  });
});

describe('a verdict a consumer\'s strategy answers is answered as it came', () => {
  class ConsumerFailure implements IAdtError {
    readonly origin = 'refusal' as const;
    readonly message = 'the consumer says no';
    describe(): string {
      return this.message;
    }
  }

  it('the same object, its prototype intact, on a marked answer', async () => {
    const own = new ConsumerFailure();
    const replaces: IAnalyse<ConsumerFailure> = () => own;

    const answer = await answering(async () => markedWire(), rawDocument, replaces);

    expect(answer.ok).toBe(false);
    if (answer.ok) throw new Error('expected a failure');
    expect(answer.getError()).toBe(own);
    expect(Object.getPrototypeOf(answer.getError())).toBe(
      ConsumerFailure.prototype,
    );
    expect(answer.getError().describe()).toBe('the consumer says no');
  });
});
