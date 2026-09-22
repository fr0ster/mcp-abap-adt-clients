/**
 * A domain created with a data type comes back having one.
 *
 * **Why this is an assertion and not a comment.** For several releases
 * `AdtDomain.create` accepted `datatype` and `length`, forwarded them to the
 * builder, and the builder read neither. A caller who asked for `CHAR(10)` got
 * an object whose document said `<doma:datatype/>` and `<doma:length>000000`,
 * and SAP then refused to activate it — `DO(251) Data type ' ' does not
 * exist`. Nothing failed anywhere: the create answered 201, the fields were
 * declared on the contract, and the lie only surfaced when somebody tried to
 * activate the result by hand.
 *
 * So the guard is not "the create returns ok". It is that the document the
 * server keeps says what the caller asked for. A unit test cannot make that
 * claim — only the server knows what it stored — which is why this is here.
 *
 * The domain is created by this file and deleted by it. Package and transport
 * come from `test-config.yaml`, never from a literal.
 *
 * Enable debug logs: DEBUG_ADT_TESTS=true npm test -- integration/core/domain/createCarriesTheType
 */

import type {
  IAbapConnection,
  ILogger,
  ISessionLifecycleAware,
} from '@mcp-abap-adt/interfaces';
import type { AdtClient } from '../../../../clients/AdtClient';
import { expectResult } from '../../../helpers/contract';
import {
  createTestAdtClient,
  createTestConnection,
  releaseTestConnection,
  skipUnlessConfigured,
} from '../../../helpers/sessionConfig';
import { createTestsLogger } from '../../../helpers/testLogger';
import { logTestSkip, logTestStep } from '../../../helpers/testProgressLogger';

const {
  getTimeout,
  resolvePackageName,
  resolveTransportRequest,
} = require('../../../helpers/test-helper');

const testsLogger: ILogger = createTestsLogger();

/** Its own name, so no suite and no probe can be standing on it. */
const DOMAIN = 'ZAC_TYPED_DOMA';
const DATATYPE = 'NUMC';
const LENGTH = 7;

describe('Domain - the create carries the type it was given', () => {
  let connection: IAbapConnection & ISessionLifecycleAware;
  let client: AdtClient;
  let hasConfig = false;
  let packageName = '';
  let transportRequest = '';

  beforeAll(async () => {
    try {
      connection = await createTestConnection(testsLogger);
      const { client: resolved } = await createTestAdtClient(
        connection,
        testsLogger,
      );
      client = resolved;
      packageName = resolvePackageName(undefined) ?? '';
      transportRequest = resolveTransportRequest(undefined) ?? '';
      hasConfig = packageName !== '';
    } catch (error) {
      hasConfig = skipUnlessConfigured(error, testsLogger);
    }
  }, 120000);

  afterAll(async () => {
    // Deleted whatever happened above, but only ever this name.
    if (hasConfig && client) {
      try {
        await client
          .getDomain()
          .delete({ domainName: DOMAIN, transportRequest });
      } catch {
        // The assertion is the test; a failed clean-up is not its verdict.
      }
    }
    if (connection) await releaseTestConnection(connection);
  });

  it(
    'stores the datatype and length the caller asked for',
    async () => {
      const label = 'Domain - create carries the type';
      if (!hasConfig) {
        logTestSkip(testsLogger, label, 'No SAP configuration');
        return;
      }

      // A leftover would make the create refuse and the read pass on somebody
      // else's object, so the name is cleared first — and only this name.
      logTestStep(`clearing ${DOMAIN} if a previous run left it`, testsLogger);
      try {
        await client
          .getDomain()
          .delete({ domainName: DOMAIN, transportRequest });
      } catch {
        // Nothing there is the normal case.
      }

      logTestStep(
        `creating ${DOMAIN} as ${DATATYPE}(${LENGTH}) in ${packageName}`,
        testsLogger,
      );
      const created = await client.getDomain().create({
        domainName: DOMAIN,
        packageName,
        description: 'Does the create carry the type',
        transportRequest,
        datatype: DATATYPE,
        length: LENGTH,
      });
      expectResult(created, `create ${DOMAIN}`);

      logTestStep('reading the document the server kept', testsLogger);
      const document = String(
        expectResult(
          await client.getDomain().readMetadata({ domainName: DOMAIN }),
          `read ${DOMAIN}`,
        ) ?? '',
      );

      // The whole point: what the server stored, in its own document.
      expect(document).toContain(`<doma:datatype>${DATATYPE}</doma:datatype>`);
      expect(document).toContain(
        `<doma:length>${String(LENGTH).padStart(6, '0')}</doma:length>`,
      );
      expect(document).not.toContain('<doma:datatype/>');
    },
    getTimeout('test'),
  );
});
