/**
 * A refused credential, as `@mcp-abap-adt/connection` raises it, through
 * `answering`.
 *
 * Two cases, because the connection raises `AuthRefusedError` for two things.
 * SAP refused the credential (a `401` the provider could not renew): SAP's
 * answer is the failure and comes back with its status. The provider refused
 * before SAP was asked (a login that ended, a token the identity provider will
 * not renew): there is no answer, and the refusal rejects as the same object,
 * so a caller walking many objects stops instead of asking the provider again
 * for each.
 *
 * The connection's own class is used, not a copy: what is recognised is the
 * shape it really has.
 */

import { AuthRefusedError, WireLogonError } from '@mcp-abap-adt/connection';
import type { IAdtError } from '@mcp-abap-adt/interfaces-adt';
import { ADT_NO_FAILURE } from '@mcp-abap-adt/interfaces-adt';
import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces-adt-connection';
import { answering, orThrow } from '../../../utils/adtResponse';
import { rawDocument } from '../../../utils/resultStrategy';

const unauthorized: IAdtWireResponse = {
  data: '',
  status: 401,
  statusText: 'Unauthorized',
  headers: {},
};

/** The wire's error for a refused request: what the transport throws on a 401. */
function wireError() {
  return Object.assign(new Error('Request failed with status code 401'), {
    response: unauthorized,
    request: { method: 'GET', url: '/sap/bc/adt/discovery' },
  });
}

/**
 * A refusal the connection raises. The constructor classifies what it is given
 * through auth-errors; an object it did not mint becomes the connection's own
 * `provider-threw` refusal, which still has the shape under test.
 */
function refused(cause?: unknown): AuthRefusedError {
  return new AuthRefusedError({} as never, 'request', cause);
}

describe('answering a refused credential', () => {
  it('rejects with the same object when SAP was never asked', async () => {
    const thrown = refused(new Error('the provider gave up'));

    await expect(
      answering(async () => {
        throw thrown;
      }, rawDocument),
    ).rejects.toBe(thrown);
  });

  it('rejects when the refusal carries no cause at all', async () => {
    const thrown = refused();

    await expect(
      answering(async () => {
        throw thrown;
      }, rawDocument),
    ).rejects.toBe(thrown);
  });

  it('asks neither analyse nor the reading when SAP was never asked', async () => {
    const analyse = jest.fn(() => ADT_NO_FAILURE);
    const read = jest.fn(rawDocument);
    const thrown = refused(new Error('the provider gave up'));

    await expect(
      answering(
        async () => {
          throw thrown;
        },
        read,
        analyse,
      ),
    ).rejects.toBe(thrown);
    expect(analyse).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
  });

  it('passes through orThrow as the same object', async () => {
    const thrown = refused(new Error('the provider gave up'));

    await expect(
      orThrow(
        answering(async () => {
          throw thrown;
        }, rawDocument),
      ),
    ).rejects.toBe(thrown);
  });

  it("answers SAP's 401 as a failure carrying that response", async () => {
    const cause = wireError();
    const thrown = refused(cause);

    const answer = await answering(async () => {
      throw thrown;
    }, rawDocument);

    expect(answer.ok).toBe(false);
    if (answer.ok) throw new Error('expected a failure');
    const error = answer.getError();
    expect(error.origin).toBe('connection');
    expect(error.response?.status).toBe(401);
    expect(error.response).toBe(unauthorized);
    expect(error.request).toBe(cause.request);
    expect(error.message).toBe(thrown.message);
  });

  it('does not let analyse clear a 401 SAP refused the credential with', async () => {
    const answer = await answering(
      async () => {
        throw refused(wireError());
      },
      rawDocument,
      () => ADT_NO_FAILURE,
    );

    expect(answer.ok).toBe(false);
    if (answer.ok) throw new Error('expected a failure');
    expect(answer.getError().response?.status).toBe(401);
  });

  it('hands analyse the failure with the status, so a strategy can word it', async () => {
    const seen: IAdtError[] = [];
    await answering(
      async () => {
        throw refused(wireError());
      },
      rawDocument,
      (verdict) => {
        if (verdict !== ADT_NO_FAILURE) seen.push(verdict);
        return verdict;
      },
    );

    expect(seen).toHaveLength(1);
    expect(seen[0]?.response?.status).toBe(401);
  });

  it('reads the logon cause the same way (a refused logon SAP answered)', async () => {
    // A wire's refused logon reaches the provider as its raw error; when the
    // provider cannot renew, that raw error is the refusal's cause.
    const thrown = new AuthRefusedError({} as never, 'logon', wireError());

    const answer = await answering(async () => {
      throw thrown;
    }, rawDocument);

    expect(answer.ok).toBe(false);
    if (answer.ok) throw new Error('expected a failure');
    expect(answer.getError().response?.status).toBe(401);
  });

  it("rejects when the provider's own throw carries an identity provider's 400", async () => {
    // A foreign provider may throw an error carrying its identity provider's
    // response: a 400 invalid_grant is not SAP answering.
    const cause = Object.assign(new Error('invalid_grant'), {
      response: { ...unauthorized, status: 400, statusText: 'Bad Request' },
      request: { method: 'POST', url: '/oauth/token' },
    });
    const thrown = refused(cause);

    await expect(
      answering(async () => {
        throw thrown;
      }, rawDocument),
    ).rejects.toBe(thrown);
  });

  it('answers a failure when the provider-thrown cause carries status 401', async () => {
    const cause = Object.assign(new Error('the provider gave up'), {
      response: unauthorized,
    });
    const thrown = refused(cause);

    const answer = await answering(async () => {
      throw thrown;
    }, rawDocument);

    expect(answer.ok).toBe(false);
    if (answer.ok) throw new Error('expected a failure');
    expect(answer.getError().response?.status).toBe(401);
  });

  it('looks one level down only: a cause wrapping the 401 is not SAP answering', async () => {
    const thrown = refused(new WireLogonError(wireError(), 401));

    await expect(
      answering(async () => {
        throw thrown;
      }, rawDocument),
    ).rejects.toBe(thrown);
  });
});

describe('what is not a refused credential', () => {
  it('a WireLogonError is a failure, not a rejection', async () => {
    const answer = await answering(async () => {
      throw new WireLogonError(wireError(), 401);
    }, rawDocument);

    expect(answer.ok).toBe(false);
  });

  it('a plain network failure is a connection failure, not a rejection', async () => {
    const answer = await answering(async () => {
      throw Object.assign(new Error('connect ECONNREFUSED'), {
        code: 'ECONNREFUSED',
      });
    }, rawDocument);

    expect(answer.ok).toBe(false);
    if (answer.ok) throw new Error('expected a failure');
    expect(answer.getError().origin).toBe('connection');
  });

  it("a SAP 401 the transport threw is SAP's answer, as before", async () => {
    const answer = await answering(async () => {
      throw wireError();
    }, rawDocument);

    expect(answer.ok).toBe(false);
    if (answer.ok) throw new Error('expected a failure');
    expect(answer.getError().response?.status).toBe(401);
  });

  it('a refusal shape that also carries a response is a transport failure', async () => {
    const answer = await answering(async () => {
      throw Object.assign(refused(), { response: unauthorized });
    }, rawDocument);

    expect(answer.ok).toBe(false);
  });

  it.each([
    ['no refusal', { at: 'request' }],
    ['a refusal without kind', { at: 'request', refusal: { reason: 'r' } }],
    ['a refusal without reason', { at: 'request', refusal: { kind: 'k' } }],
    ['no moment', { refusal: { kind: 'k', reason: 'r' } }],
    ['a non-string kind', { at: 'request', refusal: { kind: 1, reason: 'r' } }],
  ])('a lookalike with %s is a failure', async (_, value) => {
    const answer = await answering(async () => {
      throw Object.assign(new Error('x'), value);
    }, rawDocument);

    expect(answer.ok).toBe(false);
  });

  it('never runs a getter to decide', async () => {
    const getter = jest.fn(() => ({ kind: 'k', reason: 'r' }));
    const value = Object.defineProperty(
      Object.assign(new Error('x'), { at: 'request' }),
      'refusal',
      { get: getter },
    );

    const answer = await answering(async () => {
      throw value;
    }, rawDocument);

    expect(answer.ok).toBe(false);
    expect(getter).not.toHaveBeenCalled();
  });

  it('a refusal inherited, not own, is not recognised', async () => {
    const value = Object.create({
      refusal: { kind: 'k', reason: 'r' },
      at: 'request',
    });

    const answer = await answering(async () => {
      throw value;
    }, rawDocument);

    expect(answer.ok).toBe(false);
  });
});
