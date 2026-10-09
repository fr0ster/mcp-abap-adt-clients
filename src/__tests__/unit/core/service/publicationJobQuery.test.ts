/**
 * What the publication job carries, per protocol.
 *
 * **Measured on a trial, 2026-09-29**, one binding per protocol with a known
 * publication state and a single job each — the only difference being the query
 * string:
 *
 * ```
 * odatav2, no query string : "Local un-publish of service ␠ with version 0000
 *                             failed — Service ZMCP_PRV_SB version ␠ does not exist."
 * odatav2, with it         : 200, SEVERITY OK,
 *                           "service ZMCP_PRV_SB with version 0001 un-published locally"
 * odatav4, no query string : 200, SEVERITY OK
 * ```
 *
 * The blanks in the V2 refusal are the server saying it had nothing to resolve.
 * A capture of Eclipse showed no query string and the job answered `SEVERITY OK`,
 * which is where this package dropped the two fields — a measurement from one
 * system that does not hold for V2.
 *
 * V4 is asserted to carry NO query string, because that is how it was measured
 * working and sending it there was never measured at all.
 */
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import { AdtClient } from '../../../../clients/AdtClient';

interface Issued {
  url: string;
  params?: Record<string, unknown>;
}

const issued: Issued[] = [];

const connection = {
  setSessionType: () => {},
  isConnected: () => true,
  makeAdtRequest: async (options: Issued) => {
    issued.push({ url: options.url, params: options.params });
    return {
      data: '<?xml version="1.0"?><asx:abap xmlns:asx="http://www.sap.com/abapxml"><asx:values><DATA><SEVERITY>OK</SEVERITY></DATA></asx:values></asx:abap>',
      status: 200,
      statusText: 'OK',
      headers: {},
    };
  },
} as unknown as IAbapConnection;

const logger = { info: () => {}, debug: () => {} } as unknown as ILogger;
const binding = () => new AdtClient(connection, logger).getServiceBinding();

describe('the publication job', () => {
  beforeEach(() => {
    issued.length = 0;
  });

  it('names the service in the query string for OData V2', async () => {
    await binding().update({
      bindingName: 'ZSB_X',
      desiredPublicationState: 'published',
      serviceType: 'odatav2',
      serviceName: 'ZSB_X_SRV',
      serviceVersion: '0001',
    });

    expect(issued).toHaveLength(1);
    expect(issued[0].url).toContain('/businessservices/odatav2/publishjobs');
    expect(issued[0].params).toEqual({
      servicename: 'ZSB_X_SRV',
      serviceversion: '0001',
    });
  });

  it('carries the same query string on the V2 unpublish job', async () => {
    await binding().update({
      bindingName: 'ZSB_X',
      desiredPublicationState: 'unpublished',
      serviceType: 'odatav2',
      serviceName: 'zsb_x_srv',
      serviceVersion: '0002',
    });

    expect(issued[0].url).toContain('/businessservices/odatav2/unpublishjobs');
    // Upper-cased on the wire, as the name is in the repository.
    expect(issued[0].params).toEqual({
      servicename: 'ZSB_X_SRV',
      serviceversion: '0002',
    });
  });

  it('sends no query string for OData V4', async () => {
    await binding().update({
      bindingName: 'ZSB_X',
      desiredPublicationState: 'published',
      serviceType: 'odatav4',
    });

    expect(issued).toHaveLength(1);
    expect(issued[0].url).toContain('/businessservices/odatav4/publishjobs');
    expect(issued[0].params).toBeUndefined();
  });

  it('refuses a V2 publication that cannot name its service, before the wire', async () => {
    // Thrown, not answered — the same way this member already refuses
    // `desiredPublicationState: 'unchanged'`. A call that cannot be made is a
    // caller error, and the type says so first; this is the runtime half for a
    // consumer who reached it through `as never` or plain JavaScript.
    await expect(
      binding().update({
        bindingName: 'ZSB_X',
        desiredPublicationState: 'published',
        serviceType: 'odatav2',
      } as never),
    ).rejects.toThrow(/needs serviceName and serviceVersion/);

    // Refused here, not by the server answering that an unnamed service is absent.
    expect(issued).toHaveLength(0);
  });
});
