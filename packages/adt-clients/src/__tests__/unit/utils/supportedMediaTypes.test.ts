/**
 * `extractSupportedContentType`, the 415 parser: a pure function over the
 * error. SAP's 415 (measured on an on-premise system) is its exception
 * document, `content-type: application/xml`, whose message reads
 * "Unsupported Media Type. Supported Media Types: …" — sometimes a bare
 * "Unsupported Media Type" — and only that list is read.
 */
import { extractSupportedContentType } from '../../../index';

/** SAP's exception document around `message`, as a 415 carries it. */
function sapException(message: string): string {
  return (
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<exc:exception xmlns:exc="http://www.sap.com/abapxml/types/communicationframework">' +
    '<namespace id="com.sap.adt"/><type id="ExceptionUnsupportedMediaType"/>' +
    `<message lang="EN">${message}</message>` +
    '<localizedMessage lang="EN">' +
    message +
    '</localizedMessage></exc:exception>'
  );
}

function unsupported(data: unknown, headers: Record<string, string> = {}) {
  return {
    response: {
      status: 415,
      headers: { 'content-type': 'application/xml', ...headers },
      data,
    },
  };
}

describe('supported media types', () => {
  describe('extractSupportedContentType', () => {
    it('reads the type SAP lists in its 415 document', () => {
      const error = unsupported(
        sapException(
          'Unsupported Media Type. Supported Media Types: application/vnd.sap.adt.checkobjects+xml',
        ),
      );
      expect(extractSupportedContentType(error)).toEqual([
        'application/vnd.sap.adt.checkobjects+xml',
      ]);
    });

    it('reads every type of a list', () => {
      const error = unsupported(
        sapException(
          'Unsupported Media Type. Supported Media Types: application/vnd.sap.adt.checkobjects+xml, application/vnd.sap.adt.checkrun.v1+xml',
        ),
      );
      expect(extractSupportedContentType(error)).toEqual([
        'application/vnd.sap.adt.checkobjects+xml',
        'application/vnd.sap.adt.checkrun.v1+xml',
      ]);
    });

    it("never answers the 415's own content-type or the namespace URI", () => {
      const result = extractSupportedContentType(
        unsupported(
          sapException(
            'Unsupported Media Type. Supported Media Types: application/vnd.sap.adt.checkobjects+xml',
          ),
        ),
      );
      expect(result).not.toContain('application/xml');
      expect(result).not.toContain('www.sap.com/abapxml');
      expect(result).not.toContain('types/communicationframework');
    });

    it('answers nothing for a bare "Unsupported Media Type"', () => {
      expect(
        extractSupportedContentType(
          unsupported(sapException('Unsupported Media Type')),
        ),
      ).toEqual([]);
    });

    it('reads no header', () => {
      const error = unsupported('', {
        'x-sap-adt-supported-content-type':
          'application/vnd.sap.adt.deletion.check.request.v1+xml',
      });
      expect(extractSupportedContentType(error)).toEqual([]);
    });

    it('answers nothing for a status other than 415', () => {
      const error = {
        response: {
          status: 500,
          headers: {},
          data: 'Supported Media Types: application/vnd.sap.adt.checkobjects+xml',
        },
      };
      expect(extractSupportedContentType(error)).toEqual([]);
    });
  });
});
