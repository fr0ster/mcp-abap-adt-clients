/**
 * A feature toggle's `validate` asks for the one type its endpoint answers.
 *
 * `POST /sap/bc/adt/sfw/featuretoggles/validation` answers
 * `application/vnd.sap.as+xml` and nothing else: the toggle's own
 * `application/vnd.sap.adt.blues.v1+xml`, sent until 36.0.1, is refused `406`
 * "Accepted content types: application/vnd.sap.as+xml" (measured on an
 * on-premise system, 2026-10-19). `validate` takes no `options.headers`
 * (`IAdtValidatable`), so the type is the member's.
 */
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtFeatureToggle } from '../../../core/featureToggle/AdtFeatureToggle';

it('validate sends exactly Accept application/vnd.sap.as+xml', async () => {
  const request = jest.fn().mockResolvedValue({
    status: 200,
    data: '<asx:abap><asx:values><DATA><CHECK_RESULT>X</CHECK_RESULT></DATA></asx:values></asx:abap>',
    headers: {},
  });
  const toggle = new AdtFeatureToggle({
    makeAdtRequest: request,
  } as unknown as IAbapConnection);

  await toggle.validate({
    featureToggleName: 'zft_probe',
    packageName: '$tmp',
    description: 'Probe',
  });

  expect(request).toHaveBeenCalledTimes(1);
  const sent = request.mock.calls[0][0];
  expect(sent.method).toBe('POST');
  expect(sent.url).toBe('/sap/bc/adt/sfw/featuretoggles/validation');
  expect(sent.params).toEqual({
    objname: 'ZFT_PROBE',
    packagename: '$TMP',
    description: 'Probe',
  });
  expect(sent.headers).toEqual({ Accept: 'application/vnd.sap.as+xml' });
});
