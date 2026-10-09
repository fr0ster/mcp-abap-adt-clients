/**
 * Whether a refused read says the object is not there — judged by SAP's text
 * first, by the status only when there is no text. The bodies are the answers
 * the cloud trial gave, trimmed.
 */
const { answerSaysAbsent } = require('../../helpers/test-helper');

const refusal = (status: number, data: string, message?: string) => ({
  origin: 'sap',
  message: message ?? `Request failed with status code ${status}`,
  response: { status, data },
});

const exception = (type: string, text: string) =>
  `<?xml version="1.0" encoding="utf-8"?><exc:exception xmlns:exc="http://www.sap.com/abapxml/types/communicationframework"><namespace id="com.sap.adt"/><type id="${type}"/><message lang="EN">${text}</message></exc:exception>`;

describe('answerSaysAbsent', () => {
  it('a function module’s metadata: 404 ExceptionResourceNotFound', () => {
    expect(
      answerSaysAbsent(
        refusal(
          404,
          exception(
            'ExceptionResourceNotFound',
            'Function module Z_MCPT_FM01 does not exist',
          ),
        ),
      ),
    ).toBe(true);
  });

  it('a function module’s source: 500 whose text says it does not exist', () => {
    const body = `${exception('FUNCTION', 'An exception was raised').replace(
      '</message>',
      '</message><properties><entry key="LONGTEXT">&lt;STRONG&gt;Function module Z_MCPT_FM01 does not exist&lt;/STRONG&gt;</entry></properties>',
    )}`;
    expect(answerSaysAbsent(refusal(500, body))).toBe(true);
  });

  it('a package: 404 whose text never says "does not exist"', () => {
    expect(
      answerSaysAbsent(
        refusal(
          404,
          exception(
            'ExceptionResourceNotFound',
            'Error while importing object ZMCP_TEST_PKG from the database',
          ),
        ),
      ),
    ).toBe(true);
  });

  it('a 404 with a text that names another cause is not absence', () => {
    expect(
      answerSaysAbsent(
        refusal(404, exception('ExceptionNotAuthorized', 'No authorization')),
      ),
    ).toBe(false);
  });

  it('a 500 with a text that names no absence is not absence', () => {
    expect(
      answerSaysAbsent(
        refusal(500, exception('ExceptionInternal', 'Dump in the server')),
      ),
    ).toBe(false);
  });

  it('without a text, only 404 is absence', () => {
    expect(answerSaysAbsent(refusal(404, ''))).toBe(true);
    expect(answerSaysAbsent(refusal(500, ''))).toBe(false);
    expect(answerSaysAbsent(refusal(403, ''))).toBe(false);
  });

  it('a strategy that already read SAP’s text is heard', () => {
    expect(
      answerSaysAbsent({
        origin: 'sap',
        message: 'Class ZCL_X does not exist',
        adtType: 'ExceptionResourceNotFound',
      }),
    ).toBe(true);
  });
});
