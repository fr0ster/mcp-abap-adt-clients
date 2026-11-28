/**
 * The definition reads of application log objects (APLO), application job
 * catalogs (SAJC) and templates (SAJT), on the system the run names
 * (fr0ster/mcp-abap-adt#404). Every name comes from the system: the first
 * quick-search hit of each type, a namespaced one where the search returns
 * one, and absent names generated here and checked absent first.
 *
 * Each positive case asserts the eligibility condition of its read, not a
 * status alone: the object document is read as a `blue:blueSource` naming the
 * object and its type, the source as a JSON definition.
 *
 * Run: MCP_ENV_PATH=… MCP_TEST_OVERLAY=… npm test -- integration/runtime/applicationDefinitions
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  analyseException,
  bluesMetadata,
  type ISearchResult,
  jsonDocument,
  utilSearchHits,
} from '@mcp-abap-adt/adt-strategies';
import type { IAdtResponse } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  ISessionLifecycleAware,
} from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import * as dotenv from 'dotenv';
import type { AdtClient } from '../../../../clients/AdtClient';
import { utilDocuments } from '../../../../core/shared/utilResultSet';
import { applicationLogDocuments } from '../../../../runtime/applicationLog/ApplicationLog';
import { gate } from '../../../helpers/caseGate';
import { expectResult } from '../../../helpers/contract';
import {
  createTestAdtClient,
  createTestConnection,
  releaseTestConnection,
  skipUnlessConfigured,
} from '../../../helpers/sessionConfig';
import { createTestsLogger } from '../../../helpers/testLogger';
import { logTestStep } from '../../../helpers/testProgressLogger';

const { getTimeout } = require('../../../helpers/test-helper');

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const logger: ILogger = createTestsLogger();
const SECTION = 'runtime_application_definitions';
const CASE = 'adt_application_definitions';

const READINGS = { object: bluesMetadata, source: jsonDocument };

type Kind = 'APLO' | 'SAJC' | 'SAJT';
const CODE: Readonly<Record<Kind, string>> = {
  APLO: 'APLO/TYP',
  SAJC: 'SAJC',
  SAJT: 'SAJT',
};

/** A name of `length` characters that is not a hit of the type's quick search. */
async function absentName(
  client: AdtClient,
  kind: Kind,
  length: number,
): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    let name = 'ZZ';
    while (name.length < length) {
      name += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.charAt(
        Math.floor(Math.random() * 26),
      );
    }
    const hits = await searchHits(client, kind, name);
    if (!hits.some((hit) => hit.name.toUpperCase() === name)) return name;
  }
  throw new Error(`no absent ${kind} name of ${length} characters found`);
}

async function searchHits(
  client: AdtClient,
  kind: Kind,
  query: string,
): Promise<ISearchResult[]> {
  const answer = await client
    .getUtils({ ...utilDocuments, search: utilSearchHits })
    .search(
      { query, objectType: kind, maxResults: 50 },
      { analyse: analyseException },
    );
  return expectResult(
    answer,
    `quick search ${kind} ${query}`,
  ) as ISearchResult[];
}

function reads(client: AdtClient, kind: Kind) {
  if (kind === 'APLO') {
    const log = client.getApplicationLog({
      ...applicationLogDocuments,
      ...READINGS,
    });
    return {
      object: (name: string) =>
        log.getObject(name, { analyse: analyseException }),
      source: (name: string) =>
        log.getSource(name, { analyse: analyseException }),
    };
  }
  const job =
    kind === 'SAJC'
      ? client.getApplicationJobCatalog(READINGS)
      : client.getApplicationJobTemplate(READINGS);
  return {
    object: (name: string) =>
      job.getObject(name, { analyse: analyseException }),
    source: (name: string) =>
      job.getSource(name, { analyse: analyseException }),
  };
}

function statusOf(answer: IAdtResponse<unknown>): number | undefined {
  return answer.ok ? 200 : answer.getError().response?.status;
}

describe('Application definitions (APLO, SAJC, SAJT)', () => {
  let connection: IAbapConnection & ISessionLifecycleAware;
  let client: AdtClient;

  beforeAll(async () => {
    try {
      connection = await createTestConnection(logger);
      const resolved = await createTestAdtClient(connection, logger);
      client = resolved.client;
    } catch (error) {
      skipUnlessConfigured(error, logger);
    }
  });

  afterAll(async () => {
    if (connection) await releaseTestConnection(connection);
  });

  describe.each(['APLO', 'SAJC', 'SAJT'] as const)('%s', (kind) => {
    gate(SECTION, CASE)(
      'the first hit: its object document names it, its source is a JSON definition',
      async () => {
        const hits = await searchHits(client, kind, '*');
        expect(hits.length).toBeGreaterThan(0);
        const names = [hits[0]?.name];
        const namespaced = hits.find((hit) => hit.name.startsWith('/'));
        if (namespaced) names.push(namespaced.name);
        for (const name of names) {
          if (name === undefined) continue;
          logTestStep(`read ${kind} ${name}`, logger);
          const object = expectResult(
            await reads(client, kind).object(name),
            `${kind} ${name} object`,
          );
          expect(object?.name?.toUpperCase()).toBe(name.toUpperCase());
          expect(object?.type).toBe(CODE[kind]);
          const source = expectResult(
            await reads(client, kind).source(name),
            `${kind} ${name} source`,
          );
          expect(source).toEqual(
            expect.objectContaining({
              formatVersion: expect.any(String),
              header: expect.any(Object),
            }),
          );
        }
      },
      getTimeout('test'),
    );

    gate(SECTION, CASE)(
      'an absent name of 7 characters answers 404 for both reads',
      async () => {
        const name = await absentName(client, kind, 7);
        expect(statusOf(await reads(client, kind).object(name))).toBe(404);
        expect(statusOf(await reads(client, kind).source(name))).toBe(404);
      },
      getTimeout('test'),
    );
  });

  gate(SECTION, CASE)(
    'an APLO name of 21 characters: SAP answers it as it is (500 on both kinds)',
    async () => {
      const name = await absentName(client, 'APLO', 21);
      const object = statusOf(await reads(client, 'APLO').object(name));
      const source = statusOf(await reads(client, 'APLO').source(name));
      logger.info?.(`APLO 21 characters: object ${object}, source ${source}`);
      // Measured on ABAP cloud and on premise (2026-11-28): 500 for both reads.
      expect(object).toBe(500);
      expect(source).toBe(500);
    },
    getTimeout('test'),
  );
});
