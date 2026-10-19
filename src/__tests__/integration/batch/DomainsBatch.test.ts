import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  analyseActivation,
  utilActivationRunId,
} from '@mcp-abap-adt/adt-strategies';
import type { IAdtResponse } from '@mcp-abap-adt/interfaces-adt';
import { AdtBatchConnection } from '../../../batch';
import { AdtClient } from '../../../clients/AdtClient';
import { utilDocuments } from '../../../core/shared/utilResultSet';
import { escapeXmlAttr } from '../../../utils/xml';
import { integrationHeadersOf } from '../../helpers/adtHeaders';
import { finaliseBatch } from '../../helpers/batchFinalisation';
import { configuredCase, gate } from '../../helpers/caseGate';
import { createTestConnection } from '../../helpers/sessionConfig';
import { TestConfigResolver } from '../../helpers/TestConfigResolver';
import { createTestsLogger } from '../../helpers/testLogger';

function value<T>(answer: IAdtResponse<T>): T {
  if (!answer.ok) throw new Error(answer.getError().message);
  return answer.getResult().value;
}

gate('batch', 'domains')(
  'domains: separate create, lock, update and unlock envelopes, activation, read and delete',
  async () => {
    const testCase = configuredCase('batch', 'domains');
    if (!testCase)
      throw new Error('case batch/domains not in test-config.yaml');
    const resolver = new TestConfigResolver({ testCase });
    const count = Number(resolver.getParam('count', 100));
    const prefix = String(resolver.getParam('name_prefix', 'ZAC_BD_'));
    if (
      !Number.isInteger(count) ||
      count < 1 ||
      count > 9999 ||
      !/^[ZY][A-Z0-9_]*$/.test(prefix) ||
      prefix.length > 26
    )
      throw new Error(
        'batch requires count 1..9999 and a Z/Y name_prefix of at most 26 characters',
      );
    const logger = createTestsLogger();
    const connection = await createTestConnection(logger);
    // Every envelope and its whole answer go to a file: the verdict of a part
    // is in its body, and a run's log is not where that can be read back.
    const envelopes = mkdtempSync(join(tmpdir(), 'adt-domains-envelopes-'));
    let envelopeNo = 0;
    // Wrap the request method on the connection itself: a proxy object would
    // take setSessionType() on itself and send every envelope stateless.
    const send = connection.makeAdtRequest.bind(connection);
    connection.makeAdtRequest = (async (request: any) => {
      if (request.url === '/sap/bc/adt/communication/batch') {
        const mode = (connection as any).getSessionMode();
        const methods = [
          ...String(request.data).matchAll(
            /^(GET|POST|PUT|DELETE|PATCH) (\S+) HTTP\/1\.1/gm,
          ),
        ];
        expect(methods.length).toBeGreaterThan(0);
        for (const [, , url] of methods) {
          const action = new URL(url, 'https://example.test').searchParams.get(
            '_action',
          );
          expect(mode).toBe(
            action === 'LOCK' || action === 'UNLOCK' ? 'stateful' : 'stateless',
          );
        }
      }
      const no = ++envelopeNo;
      const head = `${request.method} ${request.url} session=${(connection as any).getSessionMode?.() ?? '?'}`;
      const answer: any = await send(request).catch((e: any) => {
        writeFileSync(
          join(envelopes, `${no}.txt`),
          `${head}\n${request.data ?? ''}\n--- failed ${e?.response?.status}\n${e?.response?.data ?? e?.message}`,
        );
        throw e;
      });
      writeFileSync(
        join(envelopes, `${no}.txt`),
        `${head}\n${request.data ?? ''}\n--- ${answer.status}\n${answer.data}`,
      );
      return answer;
    }) as typeof connection.makeAdtRequest;
    logger.info?.(`Domain batch envelopes: ${envelopes}`);
    const batch = new AdtBatchConnection(connection, {
      endpoint: 'communication',
      logger,
    });
    const client = new AdtClient(batch, logger);
    const domain = client.getDomain();
    const configs = Array.from({ length: count }, (_, i) => ({
      domainName: `${prefix}${String(i + 1).padStart(4, '0')}`,
      packageName: resolver.getPackageName(),
      transportRequest: resolver.getTransportRequest(),
      description: 'Batch domain CHAR 1',
    }));
    const timings: Record<string, number> = {};
    const file = join(
      mkdtempSync(join(tmpdir(), 'adt-domains-batch-')),
      'timings.json',
    );
    async function execute(label: string): Promise<void> {
      const start = Date.now();
      try {
        await batch.execute();
      } finally {
        timings[label] = Date.now() - start;
      }
    }
    async function remove(label: string, mustDelete: boolean): Promise<void> {
      const pending = configs.map((config) =>
        domain.delete(config, {
          headers: integrationHeadersOf(domain, 'delete'),
        }),
      );
      await execute(label);
      // A partial run may not have created every domain.
      for (const answer of await Promise.all(pending)) {
        if (!answer.ok && answer.getError().response?.status !== 404)
          value(answer);
        // Leftovers may not exist: SAP answers isDeleted="false" with a W
        // "Release transport … to remove the object directory entry" for a
        // name already deleted. Only the final cleanup must have deleted.
        if (answer.ok && mustDelete)
          expect(String(value(answer))).not.toMatch(
            /\b(?:\w+:)?isDeleted\s*=\s*["']false["']/,
          );
      }
    }
    const failures: unknown[] = [];
    try {
      await remove('delete_leftovers_ms', false);
      const created = configs.map((config) =>
        domain.create(config, {
          headers: integrationHeadersOf(domain, 'create'),
        }),
      );
      const locked = configs.map((config) => domain.lock(config));
      await execute('create_lock_ms');
      const handles = await Promise.all(
        created.map(async (create, i) => {
          value(await create);
          const handle = value(await locked[i]);
          expect(handle).not.toBe('');
          return handle;
        }),
      );
      const writes = configs.map((config, i) => {
        const source = `<?xml version="1.0" encoding="UTF-8"?><doma:domain xmlns:doma="http://www.sap.com/dictionary/domain" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:name="${escapeXmlAttr(config.domainName)}" adtcore:type="DOMA/DD" adtcore:description="Batch domain CHAR 1" adtcore:language="EN" adtcore:masterLanguage="EN"><adtcore:packageRef adtcore:name="${escapeXmlAttr(config.packageName)}"/><doma:content><doma:typeInformation><doma:datatype>CHAR</doma:datatype><doma:length>000001</doma:length><doma:decimals>000000</doma:decimals></doma:typeInformation><doma:outputInformation><doma:length>000001</doma:length><doma:style>00</doma:style><doma:conversionExit/><doma:signExists>false</doma:signExists><doma:lowercase>false</doma:lowercase><doma:ampmFormat>false</doma:ampmFormat></doma:outputInformation><doma:valueInformation><doma:valueTableRef/><doma:appendExists>false</doma:appendExists><doma:fixValues/></doma:valueInformation></doma:content></doma:domain>`;
        return domain.updateMetadata(config, {
          headers: integrationHeadersOf(domain, 'updateMetadata'),
          source,
          lockHandle: handles[i],
        });
      });
      const unlocked = configs.map((config, i) =>
        domain.unlock(config, handles[i]),
      );
      await execute('update_unlock_ms');
      for (const answer of await Promise.all([...writes, ...unlocked]))
        value<unknown>(answer);
      // The default returns the empty POST body; this strategy reads Location.
      const utils = new AdtClient(connection, logger).getUtils({
        ...utilDocuments,
        activation: utilActivationRunId,
      });
      const start = Date.now();
      const runId = value(
        await utils.activateObjectsGroup(
          configs.map((config) => ({ type: 'DOMA', name: config.domainName })),
          false,
          {
            headers: integrationHeadersOf(utils, 'activateObjectsGroup'),
            analyse: analyseActivation,
          },
        ),
      );
      expect(runId).not.toBe('');
      const deadline = start + 300_000;
      for (;;) {
        const run = String(value(await utils.getActivationRun(runId)));
        const status = /\b(?:\w+:)?status\s*=\s*["']([^"']*)["']/.exec(
          run,
        )?.[1];
        if (Date.now() >= deadline)
          throw new Error(`Activation run ${runId} timed out: ${run}`);
        if (status === 'finished') break;
        if (status === 'error' || status === 'failed')
          throw new Error(`Activation run ${runId} failed: ${run}`);
        await new Promise((resolve) =>
          setTimeout(resolve, Math.min(1000, deadline - Date.now())),
        );
      }
      timings.activation_ms = Date.now() - start;
      const activation = String(
        value(
          await utils.getActivationResults(runId, {
            analyse: analyseActivation,
          }),
        ),
      );
      expect(activation).toMatch(
        /<chkl:properties\b[^>]*\bactivationExecuted\s*=\s*["']true["']/,
      );
      expect(activation).not.toMatch(/type\s*=\s*["']E["']/);
      const reads = configs.map((config) => domain.readMetadata(config));
      await execute('read_active_ms');
      for (const answer of await Promise.all(reads)) {
        const source = String(value(answer));
        expect(source).toMatch(/(?:\w+:)?version="active"/);
        expect(source).toContain('<doma:datatype>CHAR</doma:datatype>');
      }
    } catch (error) {
      failures.push(error);
    }
    // Cleanup runs whatever happened above; the test's own failure is the one
    // reported, and a cleanup failure is reported beside it, never instead.
    await finaliseBatch(
      failures,
      [
        async () => {
          await remove('delete_ms', true);
          const missing = configs.map((config) => domain.readMetadata(config));
          await execute('read_deleted_ms');
          for (const answer of await Promise.all(missing)) {
            expect(answer.ok).toBe(false);
            if (!answer.ok)
              expect(answer.getError().response?.status).toBe(404);
          }
        },
        () => writeFileSync(file, JSON.stringify({ count, timings }, null, 2)),
        () => logger.info?.(`Domain batch timings: ${file}`),
        () => connection.disconnect(),
      ],
      logger,
    );
  },
  900_000,
);
