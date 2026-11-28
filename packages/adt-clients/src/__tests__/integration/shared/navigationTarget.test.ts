/**
 * Integration test for AdtUtils.getNavigationTarget: where an outline's name
 * fragment leads, against a real system, read only.
 *
 * The case names an object SAP delivers (`navigation_target` in the test
 * config). Its outline (getObjectOutline) names each form, module, local
 * class, type and local method by a fragment `#type=…;name=…`; the test
 * navigates the first element of each kind it carries, one request each, and
 * then all of them in one `/communication/batch` envelope.
 *
 * Measured (2026-11-28): every fragment answers `200` with an
 * `adtcore:objectReference` whose uri is the element's include and
 * `#start=line,column`; a local method's definition link is refused on ABAP
 * cloud (`400`, EU/061) and is the same href, answering the same start, as its
 * implementation link on premise.
 *
 * Enable debug logs: DEBUG_ADT_TESTS=true npm test -- integration/shared/navigationTarget
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  type IOutlineElement,
  readObjectOutline,
} from '@mcp-abap-adt/adt-strategies';
import type { AdtReadVersion } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  ISessionLifecycleAware,
} from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import * as dotenv from 'dotenv';
import { AdtBatchConnection } from '../../../batch/AdtBatchConnection';
import { AdtUtils } from '../../../core/shared/AdtUtils';
import type { AdtOutlineCode } from '../../../core/shared/objectStructure';
import { utilDocuments } from '../../../core/shared/utilResultSet';
import { configuredCase, gate } from '../../helpers/caseGate';
import {
  createTestConnection,
  getTargetSystem,
  releaseTestConnection,
  skipUnlessConfigured,
} from '../../helpers/sessionConfig';
import { createTestsLogger } from '../../helpers/testLogger';
import { logTestStep } from '../../helpers/testProgressLogger';

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const testsLogger: ILogger = createTestsLogger();

const OUTLINE_ACCEPT = 'application/vnd.sap.adt.objectstructure.v2+xml';
const VERSION: AdtReadVersion = 'active';

/** The kinds navigated, by the suffix of their `adtcore:type`. */
const KINDS = ['PU', 'PM', 'PL', 'PT', 'PLM'] as const;
type Kind = (typeof KINDS)[number];

interface INavigated {
  kind: Kind;
  rel: string;
  href: string;
}

function kindOf(element: IOutlineElement): Kind | undefined {
  const type = element.type ?? element.unknownType ?? '';
  const suffix = type.slice(type.indexOf('/') + 1);
  return KINDS.find((kind) => kind === suffix);
}

function flatten(element: IOutlineElement): IOutlineElement[] {
  return [element, ...element.children.flatMap(flatten)];
}

/** The link of `rel` of the first element of each kind that has one. */
function firstLinks(root: IOutlineElement, rel: string): INavigated[] {
  const found: INavigated[] = [];
  for (const element of flatten(root)) {
    const kind = kindOf(element);
    if (kind === undefined || found.some((item) => item.kind === kind))
      continue;
    const link = element.links.find((item) => item.rel === rel);
    if (link?.fragment?.startsWith('type=')) {
      found.push({ kind, rel, href: link.href });
    }
  }
  return found;
}

/** `<include>#start=l,c` of an objectReference answer, or undefined. */
function referenceOf(document: string): string | undefined {
  const marker = 'adtcore:uri="';
  const at = document.indexOf(marker);
  if (at < 0) return undefined;
  const start = at + marker.length;
  return document.slice(start, document.indexOf('"', start));
}

function includeOf(uri: string): string {
  const hash = uri.indexOf('#');
  return hash < 0 ? uri : uri.slice(0, hash);
}

describe('Shared - getNavigationTarget', () => {
  let connection: (IAbapConnection & ISessionLifecycleAware) | undefined;
  let utils: AdtUtils | undefined;

  beforeAll(async () => {
    try {
      connection = await createTestConnection(testsLogger);
      utils = new AdtUtils(connection, {
        logger: testsLogger,
        results: utilDocuments,
      });
    } catch (error) {
      skipUnlessConfigured(error, testsLogger);
    }
  });

  afterAll(async () => {
    if (connection) await releaseTestConnection(connection);
  });

  for (const caseName of [
    'navigate_outline_elements_cloud',
    'navigate_outline_elements_onprem',
  ]) {
    gate('navigation_target', caseName)(
      `${caseName}: each element's fragment leads to its start, alone and in one envelope`,
      async () => {
        if (!connection || !utils) throw new Error('no connection');
        const testCase = configuredCase('navigation_target', caseName);
        const objectType: AdtOutlineCode = testCase.params.object_type;
        const objectName: string = testCase.params.object_name;

        logTestStep(
          `getObjectOutline(${objectType}, ${objectName})`,
          testsLogger,
        );
        const outline = await utils.getObjectOutline(objectType, objectName, {
          version: VERSION,
          accept: OUTLINE_ACCEPT,
        });
        if (!outline.ok) throw new Error(outline.getError().message);
        const root = readObjectOutline(outline.getResult().value).root;
        if (root === undefined) throw new Error('the answer is no outline');

        const definitions = firstLinks(root, 'definitionIdentifier');
        const implementations = firstLinks(root, 'implementationIdentifier');
        const kinds = definitions.map((item) => item.kind);
        testsLogger.info?.(`kinds found: ${kinds.join(', ')}`);
        expect(kinds).toContain('PU');

        // Each element's start, one request each: the same include, a start.
        const alone = definitions
          .filter((item) => item.kind !== 'PLM')
          .concat(implementations.filter((item) => item.kind === 'PLM'));
        const answers: string[] = [];
        for (const item of alone) {
          logTestStep(`navigate ${item.kind} ${item.rel}`, testsLogger);
          const answer = await utils.getNavigationTarget(item.href);
          if (!answer.ok) throw new Error(answer.getError().message);
          const reference = referenceOf(answer.getResult().value);
          expect(reference).toContain('#start=');
          expect(includeOf(reference ?? '')).toBe(includeOf(item.href));
          answers.push(answer.getResult().value);
        }

        // A local method's definition link, as each system answers it.
        const definition = definitions.find((item) => item.kind === 'PLM');
        const implementation = implementations.find(
          (item) => item.kind === 'PLM',
        );
        if (definition && implementation) {
          const answer = await utils.getNavigationTarget(definition.href);
          if (getTargetSystem() === 'cloud') {
            expect(answer.ok).toBe(false);
            expect(answer.ok ? 0 : answer.getError().response?.status).toBe(
              400,
            );
          } else {
            expect(definition.href).toBe(implementation.href);
            if (!answer.ok) throw new Error(answer.getError().message);
            const alone = await utils.getNavigationTarget(implementation.href);
            expect(referenceOf(answer.getResult().value)).toBe(
              alone.ok ? referenceOf(alone.getResult().value) : 'refused',
            );
          }
        } else {
          testsLogger.info?.(
            'no local method in this outline: its links not navigated',
          );
        }

        // The same navigations in one envelope: each part as alone.
        const batch = new AdtBatchConnection(connection, {
          endpoint: 'communication',
          logger: testsLogger,
        });
        const batched = new AdtUtils(batch, {
          logger: testsLogger,
          results: utilDocuments,
        });
        const pending = alone.map((item) =>
          batched.getNavigationTarget(item.href),
        );
        await batch.execute();
        const parts = await Promise.all(pending);
        expect(
          parts.map((part) =>
            part.ok ? referenceOf(part.getResult().value) : 'refused',
          ),
        ).toEqual(answers.map(referenceOf));
      },
      120000,
    );
  }
});
