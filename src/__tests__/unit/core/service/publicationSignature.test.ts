/**
 * What a consumer can and cannot write, checked by the compiler.
 *
 * A binding's `update` *is* its publication, and two of its inputs are not
 * optional in practice: without `serviceType` there is no endpoint to post to,
 * and `'unchanged'` is not a request — there is nothing that changes nothing.
 * Both used to compile against `Partial<IServiceBindingConfig>` and throw
 * before the wire, which is a demand made where the caller cannot see it.
 *
 * The `@ts-expect-error` lines below are the assertion: each one fails the
 * build if that call starts compiling again. There is no runtime half — the
 * point is what a consumer's editor tells them before they run anything.
 */
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import { AdtClient } from '../../../../clients/AdtClient';

const connection = {
  setSessionType: () => {},
  isConnected: () => true,
  makeAdtRequest: async () => ({
    data: '',
    status: 200,
    statusText: 'OK',
    headers: {},
  }),
} as unknown as IAbapConnection;

const logger = { info: () => {} } as unknown as ILogger;

/**
 * Never called — only compiled.
 *
 * The point of these three is what `tsc` says about them, and two of them throw
 * at runtime by design: a call that cannot name its endpoint is refused before
 * the wire. Running them would be asserting the throw, which is the weaker of
 * the two guarantees and the one a consumer only meets after shipping.
 */
async function _onlyTypeChecked(client: AdtClient): Promise<void> {
  const bindings = client.getServiceBinding();

  // The whole of it: the binding, the state, and the protocol that selects the
  // endpoint. ~133s on the systems measured, so the timeout is the caller's.
  void (await bindings.update(
    {
      bindingName: 'ZAC_SRVB01',
      desiredPublicationState: 'published',
      serviceType: 'odatav4',
    },
    { timeout: 300_000 },
  ));

  // @ts-expect-error serviceType selects the endpoint and is required
  void (await bindings.update({
    bindingName: 'ZAC_SRVB01',
    desiredPublicationState: 'published',
  }));

  void (await bindings.update({
    bindingName: 'ZAC_SRVB01',
    // @ts-expect-error 'unchanged' is not a request; do not call update at all
    desiredPublicationState: 'unchanged',
    serviceType: 'odatav4',
  }));

  // @ts-expect-error bindingName says which object; there is nothing to publish without it
  void (await bindings.update({
    desiredPublicationState: 'published',
    serviceType: 'odatav4',
  }));
}
void _onlyTypeChecked;

describe('the publication signature says what it needs', () => {
  it('offers the member, and the compiler holds the rest', () => {
    // The assertions of this file are the three `@ts-expect-error` lines above:
    // each fails the build if that call starts compiling. This one only proves
    // the file reached the member it is about.
    const bindings = new AdtClient(connection, logger).getServiceBinding();
    expect(typeof bindings.update).toBe('function');
  });
});
