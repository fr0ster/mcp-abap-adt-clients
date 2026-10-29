/**
 * An `exc:exception` inside an HTTP 200 is a refusal wherever a test expects
 * success: a BaseTester read, a feed whose parser would read it as `[]`, and
 * a validation step. Each handler below honours the `analyse` it is passed,
 * as the library's members do, so the test proves the call asks for one.
 */
let mockConfig: unknown;

jest.mock('../../helpers/test-helper', () => ({
  ...jest.requireActual('../../helpers/test-helper'),
  loadTestConfig: () => mockConfig,
  getEnvironmentConfig: () =>
    (mockConfig as { environment: unknown }).environment,
  getSessionConfig: () =>
    (mockConfig as { session_config: unknown }).session_config,
  ensurePackageConfig: () => ({ success: true }),
}));
jest.mock('../../helpers/adtHeaders', () => ({
  integrationHeadersOf: () => ({
    accept: 'text/plain',
    contentType: 'text/plain',
  }),
}));

import {
  feedDescriptors,
  feedEntries,
  feedVariants,
} from '@mcp-abap-adt/adt-strategies';
import { ADT_NO_FAILURE } from '@mcp-abap-adt/interfaces-adt';
import { FeedRepository } from '../../../runtime/feeds/FeedRepository';
import { BaseTester } from '../../helpers/BaseTester';

const { analyseException } = require('@mcp-abap-adt/adt-strategies');

const EXCEPTION =
  '<?xml version="1.0" encoding="utf-8"?><exc:exception xmlns:exc="http://www.sap.com/abapxml/types/communicationframework"><namespace id="com.sap.adt"/><type id="ExceptionResourceNoAccess"/><message lang="EN">No authorization for this object</message></exc:exception>';
const wire = { status: 200, statusText: 'OK', headers: {}, data: EXCEPTION };

const ok = (value: unknown = '') => ({
  ok: true,
  getResult: () => ({ value }),
});

/** A member that answers `value` on a 200 and honours its `analyse`. */
function honouring(value: unknown) {
  return jest.fn(async (...args: unknown[]) => {
    const options = args.find(
      (a) => a !== null && typeof a === 'object' && 'analyse' in a,
    ) as { analyse?: (v: unknown, w: unknown) => unknown } | undefined;
    const verdict = options?.analyse
      ? options.analyse(ADT_NO_FAILURE, wire)
      : ADT_NO_FAILURE;
    if (verdict === ADT_NO_FAILURE) return ok(value);
    return { ok: false, getError: () => verdict };
  });
}

function handlerWith(overrides: Record<string, jest.Mock>) {
  const answer = (value?: unknown) => jest.fn(async () => ok(value));
  return {
    validate: answer(''),
    create: answer(),
    read: answer('source'),
    readMetadata: answer('<doc/>'),
    lock: answer('HANDLE'),
    update: answer(),
    unlock: answer(),
    activate: answer(),
    delete: answer(),
    ...overrides,
  };
}

function testerOver(handler: ReturnType<typeof handlerWith>) {
  const tester = new BaseTester<{ thingName: string }>(
    handler as never,
    'Thing',
    'create_thing',
    'adt_thing',
  );
  tester.setup({
    connection: {} as never,
    client: {} as never,
    hasConfig: true,
    isCloudSystem: false,
    buildConfig: () => ({ thingName: 'ZTHING' }) as never,
  });
  return tester;
}

const config = { thingName: 'ZTHING' };

beforeEach(() => {
  mockConfig = {
    environment: {
      system: 'onprem',
      operation_delays: { default: 1 },
      verify_lock_released: false,
    },
    session_config: { cleanup_session_after_test: false },
  };
});

describe('a BaseTester read', () => {
  it('fails on an exception document inside a 200', async () => {
    const handler = handlerWith({ read: honouring(EXCEPTION) });
    await expect(testerOver(handler).readTest(config)).rejects.toThrow(
      /No authorization for this object/,
    );
  });

  it('fails on an exception document answered to readMetadata', async () => {
    const handler = handlerWith({ readMetadata: honouring(EXCEPTION) });
    await expect(testerOver(handler).readTest(config)).rejects.toThrow(
      /No authorization for this object/,
    );
  });
});

describe('a validation step', () => {
  it('fails on an exception document, and creates nothing', async () => {
    const handler = handlerWith({ validate: honouring(EXCEPTION) });
    await expect(
      testerOver(handler).flowTest(config, {}, { updateConfig: config }),
    ).rejects.toThrow(/validate failed \[refusal\]: No authorization/);
    expect(handler.create).not.toHaveBeenCalled();
  });

  it('fails on an exception document even from a member that ignores analyse', async () => {
    const handler = handlerWith({
      validate: jest.fn(async () => ok(EXCEPTION)),
    });
    await expect(
      testerOver(handler).flowTest(config, {}, { updateConfig: config }),
    ).rejects.toThrow(
      'Validation failed with errors: No authorization for this object',
    );
    expect(handler.create).not.toHaveBeenCalled();
  });
});

describe('a feed call', () => {
  const connection = {
    connect: async () => {},
    getBaseUrl: async () => 'https://example',
    getSessionId: () => null,
    setSessionType: () => {},
    makeAdtRequest: async () => wire,
  };
  const logger = { debug() {}, info() {}, warn() {}, error() {} };
  const feeds = new FeedRepository(connection as never, {
    logger,
    results: {
      feeds: feedDescriptors,
      variants: feedVariants,
      entries: feedEntries,
    } as never,
  });

  it('reads an exception document as [] when nothing judges it', async () => {
    const answer = await feeds.list();
    expect(answer.ok).toBe(true);
  });

  it('fails on it with analyseException, before the parser sees it', async () => {
    for (const answer of [
      await feeds.list({ analyse: analyseException }),
      await feeds.variants('dumps', { analyse: analyseException }),
      await feeds.dumps({ analyse: analyseException }),
    ]) {
      expect(answer.ok).toBe(false);
      if (!answer.ok) {
        expect(answer.getError().message).toMatch(/No authorization/);
      }
    }
  });
});
