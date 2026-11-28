/**
 * The ABAP keyword documentation on the system the run names
 * (fr0ster/mcp-abap-adt#404). Each eligible form asserts its own condition
 * from the goal's "Availability", not a status alone:
 *
 * - query: a keyword with hits answers a page whose title is neither the
 *   start page's nor "Not found", whose text names the keyword, with topic
 *   links;
 * - topic: the first topic link, followed exactly as it carries it, answers a
 *   page with text whose version choices name the topic asked for.
 *
 * Beside them: the no-hit page, link fidelity (the page with the link's
 * `version`, with none and with the other kind's value differ), the measured
 * statuses of the `version` values, `406` for another Accept, and the position
 * form's measurement (eligible nowhere yet).
 *
 * Run: MCP_ENV_PATH=… MCP_TEST_OVERLAY=… npm test -- integration/runtime/keywordDocumentation
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  analyseException,
  docuPage,
  type IDocuPage,
  type IDocuTopicLink,
  type ISearchResult,
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
import { AdtRuntimeClient } from '../../../../clients/AdtRuntimeClient';
import { utilDocuments } from '../../../../core/shared/utilResultSet';
import { configuredCase, gate } from '../../../helpers/caseGate';
import { expectResult } from '../../../helpers/contract';
import {
  createTestAdtClient,
  createTestConnection,
  getTargetSystem,
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
const SECTION = 'runtime_keyword_documentation';
const CASE = 'adt_keyword_documentation';
const START_PAGE = 'ABAP - Keyword Documentation | ABAP Keyword Documentation';
const NOT_FOUND = 'Not found | ABAP Keyword Documentation';
const READINGS = { query: docuPage, topic: docuPage, position: docuPage };

function pageOf(answer: IAdtResponse<IDocuPage | undefined>, what: string) {
  const page = expectResult(answer, what);
  if (page === undefined) throw new Error(`${what}: not a documentation page`);
  return page;
}

function statusOf(answer: IAdtResponse<unknown>): number | undefined {
  return answer.ok ? 200 : answer.getError().response?.status;
}

describe('ABAP keyword documentation', () => {
  let connection: IAbapConnection & ISessionLifecycleAware;
  let client: AdtClient;
  let runtime: AdtRuntimeClient;
  let keyword = 'SELECT';
  let link: IDocuTopicLink | undefined;

  const docs = () => runtime.getKeywordDocumentation(READINGS);
  const judged = { analyse: analyseException };

  beforeAll(async () => {
    try {
      connection = await createTestConnection(logger);
      client = (await createTestAdtClient(connection, logger)).client;
      runtime = new AdtRuntimeClient(connection, logger);
      keyword = configuredCase(SECTION, CASE)?.params?.keyword ?? keyword;
    } catch (error) {
      skipUnlessConfigured(error, logger);
    }
  });

  afterAll(async () => {
    if (connection) await releaseTestConnection(connection);
  });

  gate(SECTION, CASE)(
    'query: a keyword with hits answers its page, naming the keyword, with topic links',
    async () => {
      const page = pageOf(
        await docs().query({ query: keyword }, judged),
        'query',
      );
      expect(page.title).not.toBe(START_PAGE);
      expect(page.title).not.toBe(NOT_FOUND);
      expect(page.text.toUpperCase()).toContain(keyword.toUpperCase());
      const topics = page.links.filter(
        (candidate): candidate is IDocuTopicLink => candidate.kind === 'topic',
      );
      expect(topics.length).toBeGreaterThan(0);
      link = topics[0];
    },
    getTimeout('test'),
  );

  gate(SECTION, CASE)(
    'a query with no hit answers 200 with the "Not found" page',
    async () => {
      const page = pageOf(
        await docs().query({ query: `ZZNOHIT${Date.now()}` }, judged),
        'no-hit query',
      );
      expect(page.title).toBe(NOT_FOUND);
    },
    getTimeout('test'),
  );

  gate(SECTION, CASE)(
    "topic: the first link, followed as it is, answers the topic's own page",
    async () => {
      if (link === undefined)
        throw new Error('the query case found no topic link');
      const page = pageOf(
        await docs().topic(
          {
            object: link.object,
            ...(link.version === null ? {} : { version: link.version }),
            ...(link.language === null ? {} : { language: link.language }),
          },
          judged,
        ),
        `topic ${link.object}`,
      );
      expect(page.title).not.toBe(START_PAGE);
      expect(page.title).not.toBe(NOT_FOUND);
      expect(page.text.length).toBeGreaterThan(0);
      expect(page.versions.length).toBeGreaterThan(0);
      for (const choice of page.versions) {
        expect(choice.object.toUpperCase()).toBe(link.object.toUpperCase());
      }
      // Whether the title equals the link's label is unverified: recorded.
      logger.info?.(
        `topic ${link.object}: title "${page.title}", label "${link.label}"`,
      );
    },
    getTimeout('test'),
  );

  gate(SECTION, CASE)(
    "link fidelity: the link's version, none and the other kind's value give three pages",
    async () => {
      if (link === undefined)
        throw new Error('the query case found no topic link');
      const object = link.object;
      const linked = link.version ?? '';
      const other = linked === '5' ? 'X' : '5';
      const text = async (version: string | undefined) =>
        pageOf(
          await docs().topic(
            version === undefined ? { object } : { object, version },
            judged,
          ),
          `topic ${object} version ${version}`,
        ).text;
      const [withLink, without, withOther] = [
        await text(linked),
        await text(undefined),
        await text(other),
      ];
      expect(withLink).not.toBe(without);
      expect(withLink).not.toBe(withOther);
      expect(without).not.toBe(withOther);
    },
    getTimeout('test'),
  );

  gate(SECTION, CASE)(
    'the version values answer as measured: 500 for 1 and 6, 200 for 2, 3, 4, 5 and X',
    async () => {
      if (link === undefined)
        throw new Error('the query case found no topic link');
      const expected: Readonly<Record<string, number>> = {
        '1': 500,
        '2': 200,
        '3': 200,
        '4': 200,
        '5': 200,
        '6': 500,
        X: 200,
      };
      for (const [version, status] of Object.entries(expected)) {
        logTestStep(`version ${version}`, logger);
        const answer = await docs().topic(
          { object: link.object, version },
          judged,
        );
        expect(statusOf(answer)).toBe(status);
      }
    },
    getTimeout('test'),
  );

  gate(SECTION, CASE)(
    'another Accept answers 406',
    async () => {
      const answer = await docs().query(
        { query: keyword },
        { ...judged, accept: 'application/xml' },
      );
      expect(statusOf(answer)).toBe(406);
    },
    getTimeout('test'),
  );

  gate(SECTION, CASE)(
    'position: a measurement on a DATA statement — eligible nowhere while it answers the start page',
    async () => {
      const hits = expectResult(
        await client
          .getUtils({ ...utilDocuments, search: utilSearchHits })
          .search(
            { query: 'CL_ABAP*', objectType: 'CLAS', maxResults: 50 },
            judged,
          ),
        'class search',
      ) as ISearchResult[];
      let found: { uri: string; line: number; column: number } | undefined;
      for (const hit of hits) {
        const answer = await client
          .getClass()
          .read({ className: hit.name }, 'active', judged);
        if (!answer.ok) continue;
        const lines = String(answer.getResult().value).split('\n');
        const at = lines.findIndex((line) =>
          line.trimStart().toUpperCase().startsWith('DATA '),
        );
        if (at < 0) continue;
        const line = lines[at] ?? '';
        found = {
          uri: `/sap/bc/adt/oo/classes/${hit.name.toLowerCase()}/source/main`,
          line: at + 1,
          column: line.length - line.trimStart().length,
        };
        break;
      }
      if (found === undefined) {
        logger.info?.(
          'position: no class hit has a DATA statement; nothing measured',
        );
        return;
      }
      for (const column of [found.column + 1, found.column]) {
        const answer = await docs().position(
          { uri: `${found.uri}#start=${found.line},${column}` },
          judged,
        );
        expect(statusOf(answer)).toBe(200);
        const title = answer.ok ? answer.getResult().value?.title : undefined;
        logger.info?.(
          `position ${found.uri} ${found.line},${column} on ${getTargetSystem()}: "${title}"`,
        );
      }
    },
    getTimeout('test'),
  );
});
