import {
  extractSupportedAccept,
  extractSupportedContentType,
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
