import {
  clearAcceptCache,
  extractSupportedAccept,
  extractSupportedContentType,
  makeAdtRequestWithAcceptNegotiation,
} from '../../../utils/acceptNegotiation';

describe('acceptNegotiation', () => {
  describe('extractSupportedContentType', () => {
    it('should extract Content-Type from response body text', () => {
      const error = {
        response: {
          status: 415,
          headers: {},
          data: 'Unsupported Media Type. Supported Media Types: application/vnd.sap.adt.checkobjects+xml',
        },
      };
      const result = extractSupportedContentType(error);
      expect(result).toContain('application/vnd.sap.adt.checkobjects+xml');
    });

    it('should extract Content-Type from content-type related headers', () => {
      const error = {
        response: {
          status: 415,
          headers: {
            'x-sap-adt-supported-content-type':
              'application/vnd.sap.adt.deletion.check.request.v1+xml',
          },
          data: '',
        },
      };
      const result = extractSupportedContentType(error);
      expect(result).toContain(
        'application/vnd.sap.adt.deletion.check.request.v1+xml',
      );
    });

    it('should return empty array for non-415 errors', () => {
      const error = {
        response: {
          status: 500,
          headers: {},
          data: '',
        },
      };
      const result = extractSupportedContentType(error);
      expect(result).toEqual([]);
    });

    it('should extract multiple types from body', () => {
      const error = {
        response: {
          status: 415,
          headers: {},
          data: 'Supported: application/vnd.sap.adt.checkobjects+xml, application/vnd.sap.adt.checkrun.v1+xml',
        },
      };
      const result = extractSupportedContentType(error);
      expect(result.length).toBeGreaterThanOrEqual(2);
    });
  });
});

describe('makeAdtRequestWithAcceptNegotiation - 415 retry', () => {
  it('should retry with corrected Content-Type on 415', async () => {
    let callCount = 0;
    const mockConnection = {
      makeAdtRequest: async (request: any) => {
        callCount++;
        if (callCount === 1) {
          const error: any = new Error('415');
          error.response = {
            status: 415,
            headers: {},
            data: 'Supported Media Types: application/vnd.sap.adt.checkobjects.v2+xml',
          };
          throw error;
        }
        expect(request.headers['Content-Type']).toBe(
          'application/vnd.sap.adt.checkobjects.v2+xml',
        );
        return { data: 'ok', status: 200, headers: {} };
      },
    };

    const result = await makeAdtRequestWithAcceptNegotiation(
      mockConnection as any,
      {
        url: '/sap/bc/adt/checkruns',
        method: 'POST',
        timeout: 0,
        headers: {
          'Content-Type': 'application/vnd.sap.adt.checkobjects+xml',
        },
      },
      { enableAcceptCorrection: true },
    );

    expect(result.data).toBe('ok');
    expect(callCount).toBe(2);
  });

  it('should use cached Content-Type on subsequent requests', async () => {
    let callCount = 0;
    const mockConnection = {
      makeAdtRequest: async (_request: any) => {
        callCount++;
        if (callCount === 1) {
          const error: any = new Error('415');
          error.response = {
            status: 415,
            headers: {},
            data: 'Supported Media Types: application/vnd.sap.adt.checkobjects.v2+xml',
          };
          throw error;
        }
        return { data: 'ok', status: 200, headers: {} };
      },
    };

    // First call: triggers 415 + retry
    await makeAdtRequestWithAcceptNegotiation(
      mockConnection as any,
      {
        url: '/sap/bc/adt/checkruns',
        method: 'POST',
        timeout: 0,
        headers: {
          'Content-Type': 'application/vnd.sap.adt.checkobjects+xml',
        },
      },
      { enableAcceptCorrection: true },
    );

    // Second call: should use cached Content-Type directly (no 415)
    callCount = 0;
    mockConnection.makeAdtRequest = async (request: any) => {
      callCount++;
      expect(request.headers['Content-Type']).toBe(
        'application/vnd.sap.adt.checkobjects.v2+xml',
      );
      return { data: 'ok', status: 200, headers: {} };
    };

    await makeAdtRequestWithAcceptNegotiation(
      mockConnection as any,
      {
        url: '/sap/bc/adt/checkruns',
        method: 'POST',
        timeout: 0,
        headers: {
          'Content-Type': 'application/vnd.sap.adt.checkobjects+xml',
        },
      },
      { enableAcceptCorrection: true },
    );

    expect(callCount).toBe(1);
  });

  it('should not retry 415 when enableAcceptCorrection is false', async () => {
    const mockConnection = {
      makeAdtRequest: async () => {
        const error: any = new Error('415');
        error.response = {
          status: 415,
          headers: {},
          data: 'Supported Media Types: application/vnd.sap.adt.checkobjects.v2+xml',
        };
        throw error;
      },
    };

    await expect(
      makeAdtRequestWithAcceptNegotiation(
        mockConnection as any,
        {
          url: '/sap/bc/adt/checkruns',
          method: 'POST',
          timeout: 0,
          headers: {
            'Content-Type': 'application/vnd.sap.adt.checkobjects+xml',
          },
        },
        { enableAcceptCorrection: false },
      ),
    ).rejects.toThrow();
  });
});

/**
 * What one connection learns stays on it. The caches were process globals
 * keyed by method and URL: a corrected Accept learned on one system was sent
 * to every other.
 */
describe('negotiation state is per connection', () => {
  const answering406Then = (supported: string) => {
    const seen: string[] = [];
    let first = true;
    const connection = {
      makeAdtRequest: async (request: any) => {
        seen.push(request.headers?.Accept);
        if (first) {
          first = false;
          const error: any = new Error('406');
          error.response = { status: 406, headers: {}, data: supported };
          throw error;
        }
        return { data: 'ok', status: 200, headers: {} };
      },
    } as any;
    return { connection, seen };
  };

  it('a correction learned on one connection is not sent on another', async () => {
    const a = answering406Then('application/vnd.sap.adt.a.v2+xml');
    await makeAdtRequestWithAcceptNegotiation(
      a.connection,
      {
        url: '/sap/bc/adt/x',
        method: 'GET',
        timeout: 1000,
        headers: { Accept: 'application/xml' },
      },
      { enableAcceptCorrection: true },
    );
    expect(a.seen).toEqual([
      'application/xml',
      'application/vnd.sap.adt.a.v2+xml',
    ]);

    const b = { seen: [] as string[] };
    const other = {
      makeAdtRequest: async (request: any) => {
        b.seen.push(request.headers?.Accept);
        return { data: 'ok', status: 200, headers: {} };
      },
    } as any;
    await makeAdtRequestWithAcceptNegotiation(
      other,
      {
        url: '/sap/bc/adt/x',
        method: 'GET',
        timeout: 1000,
        headers: { Accept: 'application/xml' },
      },
      { enableAcceptCorrection: true },
    );
    expect(b.seen).toEqual(['application/xml']);
  });

  it('clearing one connection forgets only what it learned', async () => {
    const a = answering406Then('application/vnd.sap.adt.a.v2+xml');
    await makeAdtRequestWithAcceptNegotiation(
      a.connection,
      {
        url: '/sap/bc/adt/y',
        method: 'GET',
        timeout: 1000,
        headers: { Accept: 'application/xml' },
      },
      { enableAcceptCorrection: true },
    );
    clearAcceptCache(a.connection);
    a.seen.length = 0;
    await makeAdtRequestWithAcceptNegotiation(
      a.connection,
      {
        url: '/sap/bc/adt/y',
        method: 'GET',
        timeout: 1000,
        headers: { Accept: 'application/xml' },
      },
      { enableAcceptCorrection: true },
    );
    expect(a.seen[0]).toBe('application/xml');
  });
});
