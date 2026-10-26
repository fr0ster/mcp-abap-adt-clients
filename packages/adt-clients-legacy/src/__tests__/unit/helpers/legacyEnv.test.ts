import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { IAdtResponse } from '@mcp-abap-adt/interfaces-adt';
import {
  ABAP_DIR,
  abapNameValue,
  assertLegacySystem,
  assertOwnName,
  CredentialRefused,
  combineRuns,
  ddlNamesOf,
  deleteLeftDdls,
  ENV_CLASSES,
  ensureClass,
  ensureFixtures,
  envClasses,
  isCredentialRefusal,
  isOwnName,
  type LegacyEnvTarget,
  MANUAL_RUNNER,
  manualEnvClasses,
  manualStep,
  markedLines,
  packageOf,
  parseEnvRun,
  REQUEST_VARIABLE,
  renderPrepare,
  requestSource,
  requireOwnNames,
  responsibleOf,
  runnerOf,
  sameSource,
  settingsOf,
  setup,
  setupManual,
  stopOnCredentialRefusal,
  teardown,
  teardownManual,
  uninstall,
} from '../../helpers/legacyEnv';

// The stubs are no handler class `integrationHeadersOf` knows; the pair is not
// this test's subject.
jest.mock(
  '../../../../../adt-clients/src/__tests__/helpers/adtHeaders',
  () => ({
    ...jest.requireActual(
      '../../../../../adt-clients/src/__tests__/helpers/adtHeaders',
    ),
    integrationHeadersOf: () => ({ accept: 'x/test', contentType: 'x/test' }),
  }),
);

const ok = <T>(value: T): IAdtResponse<T> => ({
  ok: true,
  getResult: () => ({ value }),
});

/** An ABAP Unit answer carrying `lines` as alert titles, as 7.40 writes XML. */
function answerWith(lines: string[]): string {
  const escaped = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const alerts = lines
    .map(
      (l) =>
        `<alert kind="failedAssertion" severity="tolerable"><title>${escaped(l)}</title>` +
        `<details><detail text="${escaped(l)}"/></details></alert>`,
    )
    .join('');
  return `<?xml version="1.0"?><aunit:runResult><program><testClasses><testClass><testMethods><testMethod adtcore:name="RUN_PREPARE"><alerts>${alerts}</alerts></testMethod></testMethods></testClass></testClasses></program></aunit:runResult>`;
}

// Every case runs as TESTER unless it says otherwise (asUser).
const SESSION_USER_BEFORE = process.env.SAP_USERNAME;
beforeEach(() => {
  process.env.SAP_USERNAME = 'TESTER';
});
afterAll(() => {
  if (SESSION_USER_BEFORE === undefined) delete process.env.SAP_USERNAME;
  else process.env.SAP_USERNAME = SESSION_USER_BEFORE;
});

const RESULT =
  '@@RESULT {"ok":true,"action":"prepare","request":"","package":"ZLG7_TEST","packageExists":true,"errors":0,"lines":2}';

describe('legacy env: the ABAP Unit report', () => {
  it('reads every @@LOG line once, in order, and the @@RESULT', () => {
    const run = parseEnvRun(
      answerWith([
        '@@LOG {"n":2,"step":"package","object":"ZLG7_TEST","status":"OK","message":"exists"}',
        '@@LOG {"n":1,"step":"locks","object":"","status":"OK","message":"a \\u003c b \\u0026 \\"c\\""}',
        RESULT,
      ]),
    );
    expect(run.result).toMatchObject({ ok: true, action: 'prepare', lines: 2 });
    expect(run.log.map((l) => l.step)).toEqual(['locks', 'package']);
    expect(run.log[0]?.message).toBe('a < b & "c"');
  });

  it('fails naming the answer when no @@RESULT came back', () => {
    expect(() => parseEnvRun('<aunit:runResult/>')).toThrow(
      /carries no @@RESULT line — the runner did not run.*runResult/,
    );
  });

  it('fails when lines are missing (a truncated answer)', () => {
    expect(() => parseEnvRun(answerWith([RESULT]))).toThrow(
      'the answer carries 0 of 2 @@LOG lines',
    );
  });

  it('reads a raw " in element text and &quot; in an attribute alike', () => {
    const line =
      '@@LOG {"n":1,"step":"locks","object":"","status":"OK","message":"say \\"hi\\""}';
    const raw = `<alerts><alert><title>${line}</title></alert></alerts>`;
    const quoted = `<alerts><alert><details><detail text="${line.replace(/"/g, '&quot;')}"/></details></alert></alerts>`;
    const both = `<r>${raw}${quoted}</r>`;
    expect(markedLines(raw, '@@LOG ')).toEqual([line.slice(6)]);
    expect(markedLines(quoted, '@@LOG ')).toEqual([line.slice(6)]);
    // The same line in a title and a detail is one line.
    expect(markedLines(both, '@@LOG ')).toEqual([line.slice(6)]);
    const run = parseEnvRun(
      `<r>${raw}<title>@@RESULT {"ok":true,"action":"status","request":"","package":"ZLG7_TEST","packageExists":false,"errors":0,"lines":1}</title></r>`,
    );
    expect(run.log[0]?.message).toBe('say "hi"');
  });

  it('decodes numeric entities through the XML parser', () => {
    expect(markedLines('<t>@@LOG a&#65;&#x42;&amp;</t>', '@@LOG ')).toEqual([
      'aAB&',
    ]);
  });

  it('joins teardown and remove into one report, ok only when both are', () => {
    const one = parseEnvRun(
      answerWith([
        '@@LOG {"n":1,"step":"objects","object":"PROG ZLG7_X","status":"DELETED","message":""}',
        '@@LOG {"n":2,"step":"locks","object":"","status":"OK","message":""}',
        RESULT.replace('"prepare"', '"teardown"'),
      ]),
    );
    const two = parseEnvRun(
      answerWith([
        '@@LOG {"n":1,"step":"package","object":"ZLG7_TEST","status":"ERROR","message":"x"}',
        '@@RESULT {"ok":false,"action":"remove","request":"","package":"ZLG7_TEST","packageExists":true,"errors":1,"lines":1}',
      ]),
    );
    const run = combineRuns(one, two);
    expect(run.result).toMatchObject({
      action: 'teardown+remove',
      ok: false,
      errors: 1,
      lines: 3,
    });
    expect(run.log.map((l) => l.n)).toEqual([1, 2, 3]);
  });
});

describe('legacy env: a credential refusal stops the loop', () => {
  const failure = (status: number | undefined, message: string) =>
    ({
      ok: false,
      getError: () => ({
        origin: 'connection',
        message,
        ...(status !== undefined && { response: { status } }),
      }),
    }) as unknown as IAdtResponse<unknown>;

  it('stops on a 401 and on RFC_LOGON_FAILURE, not on another failure', () => {
    expect(() => stopOnCredentialRefusal(failure(401, 'no'), 'read X')).toThrow(
      CredentialRefused,
    );
    expect(() =>
      stopOnCredentialRefusal(
        failure(undefined, 'RFC_LOGON_FAILURE: x'),
        'read X',
      ),
    ).toThrow('the credential was refused');
    expect(() =>
      stopOnCredentialRefusal(failure(404, 'not found'), 'read X'),
    ).not.toThrow();
    expect(
      isCredentialRefusal(new Error('lock X failed: RFC_LOGON_FAILURE')),
    ).toBe(true);
    expect(isCredentialRefusal(new Error('lock X failed: 403'))).toBe(false);
  });

  it('deleteLeftDdls stops at the first refusal instead of trying the rest', async () => {
    const calls: string[] = [];
    const handler = {
      readMetadata: async () => {
        calls.push('readMetadata');
        return failure(401, 'Unauthorized');
      },
    };
    const target = {
      client: { getDdl: () => handler },
      executor: {},
    } as unknown as LegacyEnvTarget;
    const left = (name: string, n: number) => ({
      n,
      step: 'objects',
      object: `DDLS ${name}`,
      status: 'LEFT-FOR-ADT',
      message: '$TMP',
    });
    await expect(
      deleteLeftDdls(target, {
        result: {
          ok: true,
          action: 'teardown',
          request: '',
          package: 'ZLG7_TEST',
          packageExists: false,
          errors: 0,
          lines: 2,
        },
        log: [left('ZLG7_A', 1), left('ZLG7_B', 2)],
      }),
    ).rejects.toThrow(CredentialRefused);
    expect(calls).toEqual(['readMetadata']);
  });
});

describe('legacy env: a 401 in the package check is a credential refusal', () => {
  it('teardown-style deletion stops: assertLocal rethrows by status', async () => {
    const calls: string[] = [];
    let reads = 0;
    const handler = {
      readMetadata: async () => {
        calls.push('readMetadata');
        reads += 1;
        // Present on the first read; the package check is refused.
        return reads === 1
          ? ok('<x><adtcore:packageRef adtcore:name="$TMP"/></x>')
          : ({
              ok: false,
              getError: () => ({
                origin: 'connection',
                message: 'Unauthorized',
                response: { status: 401 },
              }),
            } as unknown as IAdtResponse<unknown>);
      },
    };
    const target = {
      client: { getClass: () => handler, getLocalTestClass: () => handler },
      executor: {},
    } as unknown as LegacyEnvTarget;
    await expect(
      ensureClass(target, { name: 'ZCL_LG7_X', description: 'd', main: 'm' }),
    ).rejects.toThrow(CredentialRefused);
    expect(calls).toEqual(['readMetadata', 'readMetadata']);
  });
});

describe('legacy env: configured names of the live cases', () => {
  it('passes ZLG7 names and fails naming the case and every other name', () => {
    expect(() =>
      requireOwnNames('legacy_deletes', [
        ['class', 'ZCL_LG7_DEL'],
        ['DDL source', 'ZLG7_DEL_DDL'],
      ]),
    ).not.toThrow();
    expect(() =>
      requireOwnNames('legacy_transportable', [
        ['program', 'ZAC_PROG'],
        ['function module', 'Z_LG7_X'],
      ]),
    ).toThrow(
      'legacy_740/legacy_transportable: program ZAC_PROG not a ZLG7 name',
    );
  });
});

describe('legacy env: names and packages', () => {
  it('admits only ZLG7 names, per kind', () => {
    expect(isOwnName('class', 'ZCL_LG7_FX_UNIT')).toBe(true);
    expect(isOwnName('class', 'ZCL_LG7_')).toBe(false);
    expect(isOwnName('class', 'ZCL_OTHER')).toBe(false);
    expect(isOwnName('program', 'zlg7_fx_unit')).toBe(true);
    expect(isOwnName('function module', 'Z_LG7_FX_UNIT')).toBe(true);
    expect(isOwnName('function module', 'ZLG7_FX_UNIT')).toBe(false);
    expect(isOwnName('function include', 'LZLG7_FXT99')).toBe(true);
    expect(isOwnName('interface', 'ZIF_LG7_DEL')).toBe(true);
    expect(isOwnName('include', 'ZLG7_C_INCL')).toBe(true);
    expect(isOwnName('include', 'ZOTHER_INCL')).toBe(false);
    expect(isOwnName('message class', 'ZLG7_C_MSAG')).toBe(true);
    expect(isOwnName('message class', 'ZMSAG')).toBe(false);
    expect(() => assertOwnName('program', 'ZAC_PROG')).toThrow(
      'program ZAC_PROG is not a ZLG7 name',
    );
  });

  it('reads the package an object metadata document names', () => {
    expect(
      packageOf(
        '<class:abapClass adtcore:name="ZCL_LG7_X"><adtcore:packageRef adtcore:uri="/x" adtcore:type="DEVC/K" adtcore:name="$TMP"/></class:abapClass>',
      ),
    ).toBe('$TMP');
    expect(packageOf('<class:abapClass adtcore:name="ZCL_LG7_X"/>')).toBe(
      undefined,
    );
  });

  it('compares sources without line ends and trailing blanks', () => {
    expect(sameSource('A.  \r\nB.\r\n\r\n', 'A.\nB.')).toBe(true);
    expect(sameSource('A.', 'B.')).toBe(false);
  });

  it('reads a function module as 7.40 stores it as the same source (measured on 7.40 SP04)', () => {
    const file = readFileSync(
      join(ABAP_DIR, 'zlg7_fx.fugr.z_lg7_fx_unit.abap'),
      'utf8',
    );
    // 7.40 upper-cases the FUNCTION statement, adds three empty lines after
    // it and drops the final line end; the body is unchanged.
    const lines = file.split('\n');
    const stored = [lines[0]?.toUpperCase(), '', '', '', ...lines.slice(1)]
      .join('\n')
      .trimEnd();
    expect(stored.startsWith('FUNCTION Z_LG7_FX_UNIT.\n\n\n\n*')).toBe(true);
    expect(sameSource(stored, file)).toBe(true);
    expect(
      sameSource('function z_x.\nendfunction.', 'FUNCTION Z_X.\nENDFUNCTION.'),
    ).toBe(true);
  });

  it('still tells a body difference; a case-only difference outside literals is the same', () => {
    const file = 'FUNCTION z_x.\n  lv_value = 1.\nENDFUNCTION.\n';
    expect(
      sameSource(file, 'FUNCTION Z_X.\n  lv_value = 2.\nENDFUNCTION.'),
    ).toBe(false);
    expect(
      sameSource(file, 'FUNCTION Z_X.\n  lv_other = 1.\nENDFUNCTION.'),
    ).toBe(false);
    // Keywords and identifiers, outside literals.
    expect(
      sameSource(
        'METHOD x.\n  DATA lv_a TYPE i.\nENDMETHOD.',
        'method X.\n  data LV_A type I.\nendmethod.',
      ),
    ).toBe(true);
  });

  it('keeps the case of literal contents: text, string and template', () => {
    expect(sameSource('rv_json = `true`.', 'rv_json = `TRUE`.')).toBe(false);
    expect(sameSource("WRITE 'abc'.", "WRITE 'ABC'.")).toBe(false);
    expect(
      sameSource(
        'lv = |"packageExists":{ lv_x }|.',
        'lv = |"packageexists":{ lv_x }|.',
      ),
    ).toBe(false);
    expect(
      sameSource('lv = \'"packageExists":\'.', 'lv = \'"packageexists":\'.'),
    ).toBe(false);
    // An embedded expression is code; a doubled quote stays in the literal.
    expect(sameSource('lv = |a{ lv_x }b|.', 'LV = |a{ LV_X }b|.')).toBe(true);
    expect(sameSource("lv = 'it''s'.", "LV = 'it''s'.")).toBe(true);
    expect(sameSource("lv = 'it''s'.", "LV = 'IT''s'.")).toBe(false);
    expect(sameSource('lv = |a\\|b|.', 'LV = |a\\|b|.')).toBe(true);
  });

  it('folds comments freely; a quote in a comment opens no literal', () => {
    expect(
      sameSource(
        "lv = 1. \" it's a `note`\nlv = 'x'.",
        "LV = 1. \" IT'S A `NOTE`\nLV = 'x'.",
      ),
    ).toBe(true);
    expect(
      sameSource("* it's |a note|\nlv = 'x'.", "* IT'S |A NOTE|\nLV = 'x'."),
    ).toBe(true);
    expect(sameSource("* c\nlv = 'x'.", "* C\nLV = 'X'.")).toBe(false);
  });
});

describe('legacy env: settings into ABAP', () => {
  it('admits A-Z, 0-9, _ and / only, within the length', () => {
    expect(abapNameValue('software_component', ' home ', 30)).toBe('HOME');
    expect(() => abapNameValue('transport_layer', 'ZE19X', 4)).toThrow(
      'legacy_env.transport_layer must be 1-4 characters',
    );
    expect(() => abapNameValue('transport_layer', "Z'1", 4)).toThrow(
      'must be 1-4 characters',
    );
    expect(() =>
      abapNameValue('software_component', '<SOFTWARE_COMPONENT>', 30),
    ).toThrow('a placeholder is still in place?');
    expect(() => abapNameValue('software_component', '', 30)).toThrow(
      'legacy_env.software_component is required',
    );
  });

  it('reads the legacy_env section, or says it is missing', () => {
    expect(
      settingsOf({
        legacy_env: { software_component: 'HOME', transport_layer: 'zabc' },
      }),
    ).toEqual({ softwareComponent: 'HOME', transportLayer: 'ZABC' });
    expect(() => settingsOf({})).toThrow('no legacy_env section');
  });

  it('fills the prepare runner and leaves no placeholder', () => {
    const filled = renderPrepare(
      "x = '{{SOFTWARE_COMPONENT}}' y = '{{TRANSPORT_LAYER}}'",
      { softwareComponent: 'HOME', transportLayer: 'ZABC' },
    );
    expect(filled).toBe("x = 'HOME' y = 'ZABC'");
    expect(() =>
      renderPrepare('{{OTHER}}', {
        softwareComponent: 'HOME',
        transportLayer: 'ZABC',
      }),
    ).toThrow('unknown placeholder');
  });

  it('installs the env class before its runners, the prepare one filled', () => {
    const classes = envClasses(['prepare', 'teardown'], {
      softwareComponent: 'HOME',
      transportLayer: 'ZABC',
    });
    expect(classes.map((c) => c.name)).toEqual([
      'ZCL_LG7_ENV',
      'ZCL_LG7_ENV_PREPARE',
      'ZCL_LG7_ENV_TEARDOWN',
    ]);
    expect(envClasses(['remove']).map((c) => c.name)).toEqual([
      'ZCL_LG7_ENV',
      'ZCL_LG7_ENV_REMOVE',
    ]);
    expect(classes[1]?.testClasses).toContain("iv_software_component = 'HOME'");
    expect(classes[1]?.testClasses).not.toContain('{{');
    expect(() => envClasses(['prepare'])).toThrow('prepare needs');
  });
});

/**
 * A client whose class handler answers `metadata` and records every call. The
 * class source and its test include each keep an active and an inactive
 * version: a write changes the inactive one, an activation copies it, unless
 * `activates` is false (an activation that does not take).
 */
function stubTarget(
  metadata: string,
  options: {
    active?: string;
    inactive?: string;
    activates?: boolean;
  } = {},
) {
  const calls: string[] = [];
  const slot = () => ({
    active: options.active ?? 'old source',
    inactive: options.inactive ?? options.active ?? 'old source',
  });
  const slots = { main: slot(), tests: slot() };
  const handlerOf = (which: 'main' | 'tests') => ({
    readMetadata: async () => {
      calls.push('readMetadata');
      return ok(metadata);
    },
    read: async (_c: object, version?: 'active' | 'inactive') => {
      calls.push(version === 'active' ? 'read active' : 'read');
      return ok(slots[which][version === 'active' ? 'active' : 'inactive']);
    },
    create: async () => {
      calls.push('create');
      return ok('');
    },
    lock: async () => {
      calls.push('lock');
      return ok('H');
    },
    unlock: async () => {
      calls.push('unlock');
      return ok(undefined);
    },
    update: async (_c: object, o: { source?: string }) => {
      calls.push('update');
      slots[which].inactive = o.source ?? '';
      return ok('');
    },
    activate: async () => {
      calls.push('activate');
      if (options.activates !== false) {
        slots.main.active = slots.main.inactive;
        slots.tests.active = slots.tests.inactive;
      }
      return ok('');
    },
    delete: async () => {
      calls.push('delete');
      return ok('');
    },
  });
  const handler = handlerOf('main');
  const tests = handlerOf('tests');
  const client = {
    getClass: () => handler,
    getLocalTestClass: () => tests,
    getDdl: () => handler,
  };
  const target = { client, executor: {} } as unknown as LegacyEnvTarget;
  return { target, calls };
}

const IN = (pkg: string) =>
  `<x adtcore:name="N"><adtcore:packageRef adtcore:name="${pkg}"/></x>`;

/** A `$TMP` object whose metadata names `owner` as the person responsible. */
const OWNED = (owner: string) =>
  `<x adtcore:name="N" adtcore:responsible="${owner}"><adtcore:packageRef adtcore:name="$TMP"/></x>`;

/** A `$TMP` object of the session user the suite runs as. */
const MINE = OWNED('TESTER');

/** Run `body` with `SAP_USERNAME` set to `user`, restored afterwards. */
async function asUser<T>(user: string, body: () => Promise<T>): Promise<T> {
  const before = process.env.SAP_USERNAME;
  process.env.SAP_USERNAME = user;
  try {
    return await body();
  } finally {
    if (before === undefined) delete process.env.SAP_USERNAME;
    else process.env.SAP_USERNAME = before;
  }
}

describe("legacy env: an object not known to be the session user's is never touched", () => {
  /** Metadata of `pkg` naming `owner` as responsible, or no one. */
  const META = (pkg: string, owner?: string) =>
    `<x adtcore:name="N"${owner === undefined ? '' : ` adtcore:responsible="${owner}"`}><adtcore:packageRef adtcore:name="${pkg}"/></x>`;
  const left = (where: string, request: string) => ({
    result: {
      ok: true,
      action: 'teardown',
      request,
      package: 'ZLG7_TEST',
      packageExists: true,
      errors: 0,
      lines: 1,
    },
    log: [
      {
        n: 1,
        step: 'objects',
        object: 'DDLS ZLG7_DDL',
        status: 'LEFT-FOR-ADT',
        message: where,
      },
    ],
  });

  it('uninstall refuses a class whose metadata names no one responsible, and deletes nothing', async () => {
    const t = stubTarget(META('$TMP'));
    await asUser('TESTER', async () => {
      await expect(uninstall(t.target)).rejects.toThrow(
        "names no person responsible, so it is not known to be the session user's; not touched",
      );
    });
    expect(t.calls).not.toContain('lock');
    expect(t.calls).not.toContain('delete');
  });

  it('writes no class whose metadata names no one responsible', async () => {
    const { target, calls } = stubTarget(META('$TMP'));
    await asUser('TESTER', async () => {
      await expect(
        ensureClass(target, { name: 'ZCL_LG7_X', description: 'd', main: 'm' }),
      ).rejects.toThrow('names no person responsible');
    });
    expect(calls).toEqual(['readMetadata', 'readMetadata']);
  });

  it('refuses when neither the session user nor the person responsible is known', async () => {
    const { target, calls } = stubTarget(META('$TMP'));
    const problems = await asUser('', () =>
      deleteLeftDdls(target, left('$TMP', '')),
    );
    expect(problems).toEqual([
      'DDL source ZLG7_DDL: the session user is not known; not touched',
    ]);
    expect(calls).toEqual(['readMetadata']);
  });

  it('deletes no DDL source whose metadata names no one responsible, $TMP or ZLG7_TEST', async () => {
    for (const where of ['$TMP', 'ZLG7_TEST']) {
      const { target, calls } = stubTarget(META(where));
      const problems = await asUser('TESTER', () =>
        deleteLeftDdls(target, left(where, 'K900001')),
      );
      expect(problems).toEqual([
        "DDL source ZLG7_DDL: names no person responsible, so it is not known to be the session user's; not touched",
      ]);
      expect(calls).toEqual(['readMetadata']);
    }
  });

  it('deletes no ZLG7_TEST DDL source of another user', async () => {
    const { target, calls } = stubTarget(META('ZLG7_TEST', 'SOMEONE'));
    const problems = await asUser('TESTER', () =>
      deleteLeftDdls(target, left('ZLG7_TEST', 'K900001')),
    );
    expect(problems).toEqual([
      'DDL source ZLG7_DDL: is in ZLG7_TEST, but another user is responsible for it; not touched',
    ]);
    expect(calls).toEqual(['readMetadata']);
  });

  it('deletes a ZLG7_TEST DDL source of the session user on the request', async () => {
    const { target, calls } = stubTarget(META('ZLG7_TEST', 'TESTER'));
    const problems = await asUser('TESTER', () =>
      deleteLeftDdls(target, left('ZLG7_TEST', 'K900001')),
    );
    expect(problems).toEqual([]);
    expect(calls).toEqual(['readMetadata', 'lock', 'delete', 'unlock']);
  });
});

describe('legacy env: a $TMP object of another user is never touched', () => {
  it('reads the person responsible from the root element only', () => {
    expect(responsibleOf(OWNED('TESTER'))).toBe('TESTER');
    expect(responsibleOf(IN('$TMP'))).toBeUndefined();
    expect(
      responsibleOf(
        '<x adtcore:name="N"><y adtcore:responsible="NESTED"/></x>',
      ),
    ).toBeUndefined();
    expect(
      responsibleOf('<?xml version="1.0"?><x adtcore:responsible="T"/>'),
    ).toBe('T');
  });

  it('refuses a $TMP class another user is responsible for, and writes nothing', async () => {
    const { target, calls } = stubTarget(OWNED('SOMEONE'));
    await asUser('tester', async () => {
      await expect(
        ensureClass(target, { name: 'ZCL_LG7_X', description: 'd', main: 'm' }),
      ).rejects.toThrow(
        'is in $TMP, but another user is responsible for it; not touched',
      );
    });
    expect(calls).toEqual(['readMetadata', 'readMetadata']);
  });

  it('refuses when the session user is not known and the metadata names one', async () => {
    const { target, calls } = stubTarget(OWNED('SOMEONE'));
    await asUser('', async () => {
      await expect(
        ensureClass(target, { name: 'ZCL_LG7_X', description: 'd', main: 'm' }),
      ).rejects.toThrow('the session user is not known; not touched');
    });
    expect(calls).toEqual(['readMetadata', 'readMetadata']);
  });

  it('goes on with a $TMP class the session user is responsible for', async () => {
    const { target, calls } = stubTarget(OWNED('TESTER'));
    await asUser('tester', async () => {
      await ensureClass(target, {
        name: 'ZCL_LG7_X',
        description: 'd',
        main: 'old source',
      });
    });
    expect(calls).toEqual(['readMetadata', 'readMetadata', 'read active']);
  });

  it('leaves a $TMP DDL source of another user', async () => {
    const run = {
      result: {
        ok: true,
        action: 'prepare',
        request: '',
        package: 'ZLG7_TEST',
        packageExists: true,
        errors: 0,
        lines: 1,
      },
      log: [
        {
          n: 1,
          step: 'objects',
          object: 'DDLS ZLG7_DDL',
          status: 'LEFT-FOR-ADT',
          message: '$TMP',
        },
      ],
    };
    const { target, calls } = stubTarget(OWNED('SOMEONE'));
    const problems = await asUser('tester', () => deleteLeftDdls(target, run));
    expect(problems).toEqual([
      'DDL source ZLG7_DDL: is in $TMP, but another user is responsible for it; not touched',
    ]);
    expect(calls).toEqual(['readMetadata']);
  });
});

describe('legacy env: never writes what is not its own', () => {
  it('refuses a name without the prefix before any request', async () => {
    const { target, calls } = stubTarget(IN('$TMP'));
    await expect(
      ensureClass(target, { name: 'ZCL_OTHER', description: 'd', main: 'm' }),
    ).rejects.toThrow('class ZCL_OTHER is not a ZLG7 name');
    expect(calls).toEqual([]);
  });

  it('refuses an existing ZLG7 class outside $TMP and writes nothing', async () => {
    const { target, calls } = stubTarget(IN('ZSOMEONE'));
    await expect(
      ensureClass(target, { name: 'ZCL_LG7_X', description: 'd', main: 'm' }),
    ).rejects.toThrow('is in package ZSOMEONE, not $TMP; not touched');
    expect(calls).toEqual(['readMetadata', 'readMetadata']);
  });

  it('writes a differing $TMP class under one lock and activates it', async () => {
    const { target, calls } = stubTarget(MINE);
    expect(
      await ensureClass(target, {
        name: 'ZCL_LG7_X',
        description: 'd',
        main: 'new',
        testClasses: 'tests',
      }),
    ).toBe(true);
    expect(calls).toEqual([
      'readMetadata',
      'readMetadata',
      'read active',
      'read',
      'read',
      'lock',
      'update',
      'update',
      'unlock',
      'activate',
      'read active',
      'read active',
    ]);
  });

  it('deletes a left DDL source only when it is ZLG7 and in $TMP', async () => {
    const run = (object: string, message: string) => ({
      result: {
        ok: true,
        action: 'prepare',
        request: '',
        package: 'ZLG7_TEST',
        packageExists: true,
        errors: 0,
        lines: 1,
      },
      log: [{ n: 1, step: 'objects', object, status: 'LEFT-FOR-ADT', message }],
    });
    const outside = stubTarget(IN('ZSOMEONE'));
    expect(
      await deleteLeftDdls(outside.target, run('DDLS ZLG7_DDL', '$TMP')),
    ).toEqual(['DDL source ZLG7_DDL: in package ZSOMEONE; not touched']);
    expect(outside.calls).toEqual(['readMetadata']);

    const foreign = stubTarget(IN('$TMP'));
    expect(
      await deleteLeftDdls(foreign.target, run('DDLS ZOTHER', '$TMP')),
    ).toEqual(['DDLS ZOTHER: not a ZLG7 DDL source; not touched']);
    expect(foreign.calls).toEqual([]);

    const own = stubTarget(MINE);
    expect(
      await deleteLeftDdls(own.target, run('DDLS ZLG7_DDL', '$TMP')),
    ).toEqual([]);
    expect(own.calls).toEqual(['readMetadata', 'lock', 'delete', 'unlock']);
  });
});

/** The body of one method of the env class. */
function methodOf(env: string, name: string): string {
  const start = env.indexOf(`  METHOD ${name}.`);
  return env.slice(start, env.indexOf('ENDMETHOD.', start));
}

describe('legacy env: the ABAP sources', () => {
  const files = readdirSync(ABAP_DIR).filter((f) => f.endsWith('.abap'));
  const read = (f: string) => readFileSync(join(ABAP_DIR, f), 'utf8');
  /** The code without its full-line comments (`*` or `"` first), which name what is not used. */
  const code = (f: string) =>
    read(f)
      .split('\n')
      .filter(
        (l) => !l.trimStart().startsWith('*') && !l.trimStart().startsWith('"'),
      )
      .join('\n');

  it('are all named with the ZLG7 prefix', () => {
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) expect(f.toLowerCase()).toMatch(/^z(cl_lg7_|lg7)/);
  });

  // What SAP_BASIS 7.40 SP04 does not compile: the strict Open SQL host
  // escapes (SP05), xsdbool and FOR / REDUCE (SP08), +=, IS INSTANCE OF
  // (7.50), and the classes it does not have.
  it.each([
    [/\s@[A-Za-z(]/, 'an Open SQL @ host escape'],
    [/\bxsdbool\b/i, 'xsdbool'],
    [/\bREDUCE\b|\bFOR\s+\w+\s+IN\b/i, 'REDUCE / FOR'],
    [/\+=|-=/, '+= / -='],
    [/IS INSTANCE OF/i, 'IS INSTANCE OF'],
    [
      /if_oo_adt_classrun|xco_|cl_wb_object_operator|\/ui2\/cl_json/i,
      'a class 7.40 SP04 lacks',
    ],
  ])('use no %s (%s)', (pattern) => {
    for (const f of files) expect(`${f}: ${code(f)}`).not.toMatch(pattern);
  });

  it('guard every delete with the name and the package, and never the env classes', () => {
    const env = read('zcl_lg7_env.clas.abap');
    const deleteOne = env.slice(
      env.indexOf('METHOD delete_one.'),
      env.indexOf('ENDMETHOD.', env.indexOf('METHOD delete_one.')),
    );
    // The package and, for $TMP, the author are read again right before the
    // delete: a $TMP object of another user is never touched.
    expect(deleteOne).toContain('SELECT SINGLE devclass author FROM tadir');
    expect(deleteOne).toContain(
      'in_scope( iv_devclass = lv_devclass iv_author = lv_author ) = abap_false',
    );
    expect(deleteOne).toContain(
      'is_own_name( is_object-obj_name ) = abap_false',
    );
    expect(deleteOne).toContain(
      'is_env_name( is_object-obj_name ) = abap_true',
    );
    expect(env).toContain("c_package        TYPE devclass VALUE 'ZLG7_TEST'");
    expect(env).toContain(
      "c_request_marker TYPE as4text VALUE 'ZLG7 LEGACY-TEST'",
    );
    // Real JSON escapes, so < > & cannot end or bend the line in XML, and
    // every control character below U+0020 is \u00XX (RFC 8259 §7).
    const json = methodOf(env, 'json_string');
    expect(json).toContain('WHEN `<`.');
    expect(json).toContain('`\\u003c`');
    expect(json).toContain('WHEN `>`.');
    expect(json).toContain('`\\u003e`');
    expect(json).toContain('WHEN `&`.');
    expect(json).toContain('`\\u0026`');
    expect(json).toContain('WHEN `\\`.');
    expect(json).toContain('`\\\\`');
    expect(json).toContain('WHEN `"`.');
    expect(json).toContain('`\\"`');
    expect(json).toContain('IF lv_code < 32.');
    expect(json).toContain('`\\u00`');
    expect(json).not.toContain('REPLACE ALL OCCURRENCES');
    // Never a release of a request.
    expect(env).not.toMatch(/TR_RELEASE|RELEASE_REQUEST/i);
  });

  it('take an object, in ZLG7_TEST and $TMP alike, only when its author is the current user', () => {
    const env = code('zcl_lg7_env.clas.abap');
    const scope = methodOf(env, 'tadir_in_scope');
    expect(scope).toContain(
      'AND ( devclass = c_package OR devclass = c_local_package )\n        AND author = sy-uname',
    );
    // The author binds both packages: no branch admits ZLG7_TEST alone.
    expect(scope).not.toContain('devclass = c_package OR (');
    const predicate = methodOf(env, 'in_scope');
    expect(predicate).toContain(
      'IF iv_author = sy-uname\n        AND ( iv_devclass = c_package OR iv_devclass = c_local_package ).',
    );
    expect(predicate).not.toContain('iv_devclass = c_package\n        OR');
    // The lock, inactive-version and delete steps ask the same question.
    const owner = methodOf(env, 'scope_package_of');
    expect(owner).toContain('SELECT SINGLE devclass author FROM tadir');
    expect(owner).toContain(
      'in_scope( iv_devclass = lv_devclass iv_author = lv_author ) = abap_true',
    );
    expect(env).not.toContain('in_scope_package');
    // A flagged TADIR entry is dropped only when it is the current user's.
    expect(methodOf(env, 'purge_deleted_entries')).toContain(
      "WHERE pgmid = 'R3TR' AND delflag = 'X' AND author = sy-uname",
    );
  });

  it('read a transportable object deleted on the request as no leftover, and leave its TADIR row', () => {
    const env = code('zcl_lg7_env.clas.abap');
    // Existence by the object's own table, read dynamically: a table this
    // release lacks reads as present, so the object is handled as before.
    const exists = methodOf(env, 'object_exists');
    for (const [type, table] of [
      ['PROG', 'TRDIR'],
      ['CLAS', 'SEOCLASS'],
      ['INTF', 'SEOCLASS'],
      ['FUGR', 'TLIBG'],
      ['DDLS', 'DDDDLSRC'],
      ['MSAG', 'T100A'],
    ])
      expect(`${type}: ${exists}`).toContain(`'${type}'`);
    for (const table of ['TRDIR', 'SEOCLASS', 'TLIBG', 'DDDDLSRC', 'T100A'])
      expect(exists).toContain(`lv_table = '${table}'.`);
    expect(exists).toContain(
      'SELECT COUNT(*) FROM (lv_table) INTO lv_count WHERE (lv_where).',
    );
    expect(exists).toContain('CATCH cx_sy_dynamic_osql_error');
    expect(exists).toContain('rv_yes = abap_true.');
    // Only in ZLG7_TEST: the request owns that row. $TMP is as before.
    const scope = methodOf(env, 'objects_in_scope');
    expect(scope).toContain('lt_found = tadir_in_scope( iv_keep_fixtures ).');
    expect(scope).toContain(
      'IF ls_found-devclass = c_package\n          AND object_exists( iv_object = ls_found-object iv_obj_name = ls_found-obj_name ) = abap_false.',
    );
    const recorded = methodOf(env, 'recorded_deletions');
    expect(recorded).toContain(
      'IF ls_found-devclass = c_package\n          AND object_exists( iv_object = ls_found-object iv_obj_name = ls_found-obj_name ) = abap_false.',
    );
    const deletes = methodOf(env, 'delete_objects');
    const logged = deletes.indexOf(
      'iv_message = `deleted, recorded in the request`',
    );
    expect(logged).toBeGreaterThan(-1);
    expect(deletes.lastIndexOf('iv_status = `OK`', logged)).toBeGreaterThan(-1);
    expect(logged).toBeLessThan(deletes.indexOf('DO 3 TIMES.'));
    expect(recorded + deletes).not.toContain('TR_TADIR_INTERFACE');
  });

  it('adopt or delete package ZLG7_TEST only when the current user owns it', () => {
    const env = code('zcl_lg7_env.clas.abap');
    const owned = methodOf(env, 'package_owner_problem');
    expect(owned).toContain(
      'SELECT SINGLE as4user FROM tdevc INTO lv_responsible WHERE devclass = c_package.',
    );
    expect(owned).toContain(
      "SELECT SINGLE author FROM tadir INTO lv_author\n      WHERE pgmid = 'R3TR' AND object = 'DEVC' AND obj_name = c_package.",
    );
    expect(owned).toContain(
      'IF lv_responsible <> sy-uname OR lv_author <> sy-uname.',
    );
    for (const name of ['ensure_package', 'delete_package']) {
      const body = methodOf(env, name);
      const check = body.indexOf('lv_problem = package_owner_problem( ).');
      expect(`${name}: ${check}`).not.toBe(`${name}: -1`);
      // Refused with an error step before anything is changed.
      const refuse = body.indexOf(
        'iv_status = `ERROR` iv_message = lv_problem',
        check,
      );
      expect(refuse).toBeGreaterThan(check);
      expect(body.indexOf('RETURN.', refuse)).toBeLessThan(
        body.indexOf('CALL METHOD'),
      );
    }
    // Adopting an existing package is the owned branch only.
    const ensure = methodOf(env, 'ensure_package');
    expect(ensure.indexOf('package_owner_problem')).toBeLessThan(
      ensure.indexOf('`exists`'),
    );
  });

  it('match locks exactly against the scope list, never a substring', () => {
    const locks = methodOf(code('zcl_lg7_env.clas.abap'), 'release_locks');
    expect(locks).toContain('objects_in_scope( abap_false )');
    expect(locks).toContain(
      'LOOP AT lt_scope INTO ls_scope WHERE name = lv_word.',
    );
    expect(locks).not.toMatch(/FIND\b|\bCS\b|\bCP\b/);
  });

  it('skip a whole request holding a task of another user', () => {
    const requests = methodOf(code('zcl_lg7_env.clas.abap'), 'delete_requests');
    const skip = requests.indexOf(
      'a task of another user is in it; request not touched',
    );
    const next = requests.indexOf('CONTINUE.', skip);
    expect(requests).toContain('IF ls_task-as4user <> sy-uname.');
    expect(skip).toBeGreaterThan(-1);
    // The skip comes before the first unlock and delete, and leaves the loop.
    expect(next).toBeGreaterThan(skip);
    expect(next).toBeLessThan(
      requests.indexOf("CALL FUNCTION 'TRINT_UNLOCK_REQUEST'"),
    );
    expect(next).toBeLessThan(
      requests.indexOf("CALL FUNCTION 'TR_DELETE_COMM'"),
    );
  });

  it('release a lock only with the lock object of the name it matched', () => {
    const code740 = code('zcl_lg7_env.clas.abap');
    const fits = methodOf(code740, 'lock_object_fits');
    expect(fits).toContain("rv_yes = boolc( iv_gname = 'SEOCLASS' ).");
    expect(fits).toContain("rv_yes = boolc( iv_gname = 'TRDIR' ).");
    expect(fits).toContain("rv_yes = boolc( iv_gname = 'TFDIR' ).");
    expect(fits).toContain("rv_yes = boolc( iv_gname = 'E070' ).");
    expect(fits).toContain('WHEN OTHERS.\n        rv_yes = abap_false.');
    const locks = methodOf(code740, 'release_locks');
    // Every hit passes through the type check; a name of the wrong object is left.
    expect(
      locks.split('\n').filter((l) => l.trim() === 'lv_hit = abap_true.'),
    ).toHaveLength(2);
    expect(locks.split('lock_object_fits(').length - 1).toBe(2);
    expect(locks).toContain('iv_status = `LEFT`');
  });

  it('check every function module call for its exceptions', () => {
    const env = read('zcl_lg7_env.clas.abap');
    const calls = env.split("CALL FUNCTION '").slice(1);
    expect(calls.length).toBeGreaterThan(5);
    for (const call of calls) {
      const name = call.slice(0, call.indexOf("'"));
      const body = call.slice(0, call.indexOf('.\n'));
      if (name === 'ENQUE_DELETE') continue; // answers subrc as a parameter
      expect(`${name}: ${body}`).toContain('OTHERS');
    }
  });

  it('report a request as deleted only when it was: a foreign task or a failed delete leaves it out', () => {
    const env = code('zcl_lg7_env.clas.abap');
    expect(env).toContain(
      'METHODS delete_requests RETURNING VALUE(rt_deleted) TYPE tt_trkorr.',
    );
    const requests = methodOf(env, 'delete_requests');
    // The foreign-task skip leaves the loop before anything is recorded.
    const skip = requests.indexOf('a task of another user is in it');
    expect(requests.indexOf('CONTINUE.', skip)).toBeLessThan(
      requests.indexOf('APPEND lv_request TO rt_deleted.'),
    );
    // Recorded only when every TR_DELETE_COMM of the request succeeded.
    expect(requests).toContain('lv_all_deleted = abap_false.');
    expect(requests.split('lv_all_deleted = abap_false.').length - 1).toBe(2); // the failed call and the dynamic-call error
    expect(requests).toContain(
      'IF lv_all_deleted = abap_true.\n        APPEND lv_request TO rt_deleted.',
    );
    // A survivor is reported by requests_removed as an error.
    const removed = methodOf(env, 'requests_removed');
    expect(removed).toContain('lt_deleted = delete_requests( ).');
    expect(removed).toContain(
      'iv_status = `ERROR`\n               iv_message = `a marked request was not deleted; TADIR entries and the package kept`',
    );
    expect(removed).toContain('rv_ok = abap_false.');
  });

  it('purge a flagged TADIR entry only when no surviving request holds it', () => {
    const env = code('zcl_lg7_env.clas.abap');
    const purge = methodOf(env, 'purge_deleted_entries');
    const held = purge.indexOf(
      'FROM e071 INNER JOIN e070 ON e070~trkorr = e071~trkorr',
    );
    expect(held).toBeGreaterThan(-1);
    expect(purge).toContain('WHERE e071~obj_name = ls_flagged-obj_name.');
    const keep = purge.indexOf('iv_status = `KEPT`');
    expect(keep).toBeGreaterThan(held);
    expect(purge.indexOf('CONTINUE.', keep)).toBeLessThan(
      purge.indexOf("CALL FUNCTION 'TR_TADIR_INTERFACE'"),
    );
  });

  it('remove in stages: requests, guarded purge, package on a fresh marked request, that request, its entry', () => {
    const remove = methodOf(code('zcl_lg7_env.clas.abap'), 'remove');
    const steps = [
      'IF requests_removed( ) = abap_false.',
      'IF purge_deleted_entries( ) = abap_false.',
      'IF package_exists( ) = abap_false.',
      'ensure_request( ).',
      'IF mv_request IS INITIAL.',
      'IF delete_package( ) = abap_false.',
      'IF requests_removed( ) = abap_false.',
      'purge_deleted_entries( ).',
    ];
    let from = 0;
    for (const step of steps) {
      const at = remove.indexOf(step, from);
      expect(`${step} at ${at}`).not.toBe(`${step} at -1`);
      from = at + step.length;
    }
    // Every guard but the last ends REMOVE before the next destructive step.
    const guards = remove.split('IF ').slice(1);
    for (const guard of guards.slice(0, 6))
      expect(guard.slice(0, guard.indexOf('ENDIF.'))).toContain('RETURN.');
    // The package step finds its own request; delete_package creates none.
    expect(
      methodOf(code('zcl_lg7_env.clas.abap'), 'delete_package'),
    ).not.toContain('ensure_request');
    // An object gone, its deletion no longer held, is purged like a flagged one.
    expect(
      methodOf(code('zcl_lg7_env.clas.abap'), 'purge_deleted_entries'),
    ).toContain('lt_gone = recorded_deletions( abap_false ).');
  });

  it('attempt no package deletion while any TADIR entry is left in it', () => {
    const pkg = methodOf(code('zcl_lg7_env.clas.abap'), 'delete_package');
    expect(pkg).toContain(
      "SELECT COUNT(*) FROM tadir INTO lv_count\n      WHERE devclass = c_package AND object <> 'DEVC'.",
    );
    expect(pkg).not.toContain('delflag');
    expect(pkg.indexOf('TADIR entr')).toBeLessThan(pkg.indexOf('CALL METHOD'));
  });

  it('remove the package and the requests only in the second teardown phase', () => {
    const env = read('zcl_lg7_env.clas.abap');
    const first = methodOf(env, 'teardown');
    const second = methodOf(env, 'remove');
    expect(first).not.toMatch(
      /delete_package|delete_requests|requests_removed/,
    );
    expect(second).toContain('delete_package( )');
    expect(second).toContain('requests_removed( )');
  });
});

describe('legacy env: the admin runs refuse a modern system', () => {
  const connection = {} as Parameters<typeof assertLegacySystem>[0];

  it('refuses before anything is installed when the system is modern', async () => {
    await expect(
      assertLegacySystem(connection, async () => true),
    ).rejects.toThrow(/not a legacy .*system.*nothing was installed/i);
  });

  it('lets a legacy system through', async () => {
    await expect(
      assertLegacySystem(connection, async () => false),
    ).resolves.toBeUndefined();
  });

  it('asks the connection it was given', async () => {
    const asked: unknown[] = [];
    await assertLegacySystem(connection, async (c: unknown) => {
      asked.push(c);
      return false;
    });
    expect(asked).toEqual([connection]);
  });
});

describe('legacy env: the runner the configuration states', () => {
  it('reads abap_unit or manual, and refuses a missing or other value', () => {
    expect(runnerOf({ legacy_env: { runner: 'abap_unit' } })).toBe('abap_unit');
    expect(runnerOf({ legacy_env: { runner: 'manual' } })).toBe('manual');
    expect(() => runnerOf({ legacy_env: {} })).toThrow(
      'legacy_env.runner is required',
    );
    expect(() => runnerOf({ legacy_env: { runner: 'sm37' } })).toThrow(
      'legacy_env.runner must be abap_unit or manual, not "sm37"',
    );
    expect(() => runnerOf({})).toThrow('no legacy_env section');
  });

  it('the base states abap_unit', () => {
    const template = readFileSync(
      join(__dirname, '../../helpers/test-config.legacy.yaml'),
      'utf8',
    );
    const section = template.slice(template.indexOf('\nlegacy_env:'));
    expect(section.slice(0, section.indexOf('\nlegacy_740:'))).toContain(
      '  runner: "abap_unit"',
    );
  });

  it('names the DDL sources the live cases configure, once each', () => {
    expect(
      ddlNamesOf({
        legacy_740: {
          test_cases: [
            { params: { ddl_name: 'zlg7_del_ddl' } },
            { params: { class_name: 'ZCL_LG7_X' } },
            { params: { ddl_name: 'ZLG7_DEL_DDL' } },
            {},
          ],
        },
      }),
    ).toEqual(['ZLG7_DEL_DDL']);
    expect(ddlNamesOf({})).toEqual([]);
  });
});

describe('legacy env: the request of a live check', () => {
  it('comes from the status run with abap_unit, which refuses the variable', () => {
    expect(requestSource('abap_unit', {})).toEqual({ from: 'status' });
    expect(() =>
      requestSource('abap_unit', { [REQUEST_VARIABLE]: 'E77K900001' }),
    ).toThrow(
      `${REQUEST_VARIABLE} is read only with legacy_env.runner: manual`,
    );
  });

  it('comes from the owner with manual, else the check skips naming the SE24 step', () => {
    expect(
      requestSource('manual', { [REQUEST_VARIABLE]: ' e77k900001 ' }),
    ).toEqual({ from: 'owner', request: 'E77K900001' });
    const none = requestSource('manual', {});
    expect(none.from).toBe('none');
    expect(none.from === 'none' && none.skip).toContain(
      `run ${MANUAL_RUNNER}=>PREPARE (or STATUS) in SE24 and set ${REQUEST_VARIABLE}`,
    );
    expect(requestSource('manual', { [REQUEST_VARIABLE]: ' ' }).from).toBe(
      'none',
    );
    expect(() =>
      requestSource('manual', { [REQUEST_VARIABLE]: "E77K'1" }),
    ).toThrow('must be a request number');
  });
});

describe('legacy env: the class the owner runs by hand', () => {
  const run = readFileSync(join(ABAP_DIR, 'zcl_lg7_env_run.clas.abap'), 'utf8');

  it('is installed after the env class, a plain class with no test include', () => {
    const classes = manualEnvClasses();
    expect(classes.map((c) => c.name)).toEqual(['ZCL_LG7_ENV', MANUAL_RUNNER]);
    expect(classes[1]?.testClasses).toBeUndefined();
    expect(classes[1]?.main).toBe(run);
  });

  it('runs each action on a new ZCL_LG7_ENV and returns its report', () => {
    expect(run).toContain(
      'CLASS zcl_lg7_env_run DEFINITION PUBLIC FINAL CREATE PRIVATE.',
    );
    const code = run
      .split('\n')
      .filter((l) => !l.trimStart().startsWith('"'))
      .join('\n');
    expect(code).not.toMatch(/FOR TESTING|RISK LEVEL|cl_abap_unit_assert/i);
    for (const action of ['prepare', 'status', 'teardown', 'remove']) {
      const start = run.indexOf(`  METHOD ${action}.`);
      const body = run.slice(start, run.indexOf('ENDMETHOD.', start));
      expect(`${action}: ${start > -1}`).toBe(`${action}: true`);
      expect(body).toContain('CREATE OBJECT lo_env');
      expect(body).toContain(`lo_env->${action}( ).`);
      expect(body).toContain('rt_lines = lo_env->report_lines( ).');
    }
    expect(run).toContain('iv_software_component TYPE dlvunit');
    expect(run).toContain('iv_transport_layer    TYPE devlayer');
  });

  it('is plain ASCII, so a non-unicode system stores it as written', () => {
    expect([...run].filter((c) => c.charCodeAt(0) > 127)).toEqual([]);
  });

  it('is one of the env classes, which the env class never deletes', () => {
    expect(ENV_CLASSES).toContain(MANUAL_RUNNER);
    expect(ENV_CLASSES[ENV_CLASSES.length - 1]).toBe('ZCL_LG7_ENV');
    expect(MANUAL_RUNNER.startsWith('ZCL_LG7_ENV')).toBe(true);
  });

  it('says what to run in SE24, with the prepare values', () => {
    const step = manualStep('prepare', {
      softwareComponent: 'HOME',
      transportLayer: 'ZABC',
    });
    expect(step).toContain(
      'logged on as the SAP_USERNAME (client SAP_CLIENT) of the session file MCP_ENV_PATH names (~/.config/mcp-abap-adt/sessions/<destination>.env)',
    );
    expect(step).toContain(`SE24: ${MANUAL_RUNNER} -> Test (F8) -> PREPARE`);
    expect(step).toContain(
      'IV_SOFTWARE_COMPONENT = HOME and IV_TRANSPORT_LAYER = ZABC',
    );
    expect(manualStep('remove')).toContain('-> REMOVE -> Execute (F8);');
    expect(manualStep('remove')).not.toContain(".env's");
  });
});

/**
 * A target whose every handler records `<call> <name>`, and whose ABAP Unit
 * runner records the runner it was asked to run.
 */
function recordingTarget(options: {
  ddl: string;
  /** Metadata per object name; the session user's `$TMP` object by default. */
  metadata?: Record<string, string>;
  /** Sources per name (`<class>#tests` for a test include); see `sourceOf`. */
  sources?: Record<string, { active: string; inactive?: string }>;
  /** The report lines a runner answers; an ok, empty report by default. */
  answers?: Record<string, string[]>;
}) {
  const calls: string[] = [];
  const runs: string[] = [];
  const nameOf = (c: Record<string, string>) =>
    c.ddlName ??
    c.className ??
    c.includeName ??
    c.functionModuleName ??
    c.programName ??
    c.functionGroupName;
  // A function include starts absent (an empty source); everything else
  // present with an old source, active and inactive alike.
  const sources = new Map<string, { active: string; inactive: string }>();
  const sourceOf = (key: string) => {
    let found = sources.get(key);
    if (!found) {
      const given = options.sources?.[key];
      const start = key.startsWith('LZLG7') ? '' : 'old source';
      found = {
        active: given?.active ?? start,
        inactive: given?.inactive ?? given?.active ?? start,
      };
      sources.set(key, found);
    }
    return found;
  };
  const handlerOf = (suffix: string) => ({
    readMetadata: async (c: Record<string, string>) => {
      calls.push(`readMetadata ${nameOf(c)}`);
      const name = nameOf(c) ?? '';
      return ok(options.metadata?.[name] ?? (c.ddlName ? options.ddl : MINE));
    },
    read: async (c: Record<string, string>, version?: string) => {
      calls.push(`read ${nameOf(c)}`);
      const found = sourceOf(`${nameOf(c)}${suffix}`);
      return ok(version === 'active' ? found.active : found.inactive);
    },
    create: async (c: Record<string, string>) => {
      calls.push(`create ${nameOf(c)}`);
      return ok('');
    },
    lock: async (c: Record<string, string>) => {
      calls.push(`lock ${nameOf(c)}`);
      return ok('H');
    },
    unlock: async (c: Record<string, string>) => {
      calls.push(`unlock ${nameOf(c)}`);
      return ok(undefined);
    },
    update: async (c: Record<string, string>, o: { source?: string }) => {
      calls.push(`update ${nameOf(c)}`);
      sourceOf(`${nameOf(c)}${suffix}`).inactive = o.source ?? '';
      return ok('');
    },
    activate: async (c: Record<string, string>) => {
      calls.push(`activate ${nameOf(c)}`);
      for (const key of [`${nameOf(c)}`, `${nameOf(c)}#tests`]) {
        const found = sourceOf(key);
        found.active = found.inactive;
      }
      return ok('');
    },
    delete: async (c: Record<string, string>) => {
      calls.push(`delete ${nameOf(c)}`);
      return ok('');
    },
  });
  const handler = handlerOf('');
  const tests = handlerOf('#tests');
  const client = {
    getClass: () => handler,
    getLocalTestClass: () => tests,
    getDdl: () => handler,
    getProgram: () => handler,
    getFunctionGroup: () => handler,
    getFunctionModule: () => handler,
    getFunctionInclude: () => handler,
  };
  const executor = {
    getClassTestRunner: () => ({
      runSync: async (runner: string) => {
        runs.push(runner);
        const given = options.answers?.[runner];
        if (given) return ok(answerWith(given));
        return ok(
          answerWith([
            '@@RESULT {"ok":true,"action":"prepare","request":"","package":"ZLG7_TEST","packageExists":true,"errors":0,"lines":0}',
          ]),
        );
      },
    }),
  };
  const target = { client, executor } as unknown as LegacyEnvTarget;
  /** Each object written, once, in the order of its first write. */
  const written = () => [
    ...new Set(
      calls.filter((c) => c.startsWith('update ')).map((c) => c.slice(7)),
    ),
  ];
  return { target, calls, runs, written };
}

const SETTINGS = { softwareComponent: 'HOME', transportLayer: 'ZABC' };

describe('legacy env: the manual runner', () => {
  it('setup installs the env class and ZCL_LG7_ENV_RUN, runs no runner, and says PREPARE is next', async () => {
    const t = recordingTarget({ ddl: MINE });
    const handOff = await setupManual(t.target, SETTINGS, ['ZLG7_DEL_DDL']);
    expect(t.runs).toEqual([]);
    const written = t.written();
    expect(written.slice(0, 2)).toEqual(['ZCL_LG7_ENV', MANUAL_RUNNER]);
    expect(written.filter((n) => n.startsWith('ZCL_LG7_ENV_'))).toEqual([
      MANUAL_RUNNER,
    ]);
    // The DDL leftover, then the fixtures.
    expect(t.calls).toContain('delete ZLG7_DEL_DDL');
    expect(written).toContain('ZCL_LG7_FX_UNIT');
    expect(t.calls.indexOf('delete ZLG7_DEL_DDL')).toBeLessThan(
      t.calls.indexOf('update ZCL_LG7_FX_UNIT'),
    );
    expect(handOff.handOff).toBe(true);
    expect(handOff.next[0]).toBe(manualStep('prepare', SETTINGS));
    expect(handOff.next[1]).toContain(REQUEST_VARIABLE);
    expect(handOff.done).toContain('DDL sources deleted: ZLG7_DEL_DDL');
  });

  it('setup deletes no DDL source that is not there, and none outside $TMP', async () => {
    const absent = recordingTarget({ ddl: '' });
    const handOff = await setupManual(absent.target, SETTINGS, [
      'ZLG7_DEL_DDL',
    ]);
    expect(absent.calls).not.toContain('delete ZLG7_DEL_DDL');
    expect(handOff.done).toContain('DDL sources deleted: none');

    const outside = recordingTarget({ ddl: IN('ZSOMEONE') });
    await expect(
      setupManual(outside.target, SETTINGS, ['ZLG7_DEL_DDL']),
    ).rejects.toThrow(
      'DDL source ZLG7_DEL_DDL: in package ZSOMEONE; not touched',
    );
    expect(outside.calls).not.toContain('delete ZLG7_DEL_DDL');
    expect(outside.written()).not.toContain('ZCL_LG7_FX_UNIT');

    const foreign = recordingTarget({ ddl: MINE });
    await expect(
      setupManual(foreign.target, SETTINGS, ['ZOTHER_DDL']),
    ).rejects.toThrow('DDL source ZOTHER_DDL: not a ZLG7 DDL source');
    expect(foreign.calls).not.toContain('readMetadata ZOTHER_DDL');
  });

  it('teardown deletes the DDL sources only, and says REMOVE and uninstall are next', async () => {
    const t = recordingTarget({ ddl: MINE });
    const handOff = await teardownManual(t.target, ['ZLG7_DEL_DDL']);
    expect(t.runs).toEqual([]);
    expect(t.calls).toEqual([
      'readMetadata ZLG7_DEL_DDL',
      'readMetadata ZLG7_DEL_DDL',
      'lock ZLG7_DEL_DDL',
      'delete ZLG7_DEL_DDL',
      'unlock ZLG7_DEL_DDL',
    ]);
    expect(handOff.next).toEqual([
      manualStep('remove'),
      'then npm run legacy:uninstall',
    ]);
  });

  it('uninstall deletes every env class, ZCL_LG7_ENV_RUN before ZCL_LG7_ENV', async () => {
    const t = recordingTarget({ ddl: '' });
    const handOff = await uninstall(t.target);
    const deleted = t.calls
      .filter((c) => c.startsWith('delete '))
      .map((c) => c.slice(7));
    expect(deleted).toEqual([...ENV_CLASSES]);
    expect(t.runs).toEqual([]);
    expect(handOff.next).toEqual([]);
  });

  it('uninstall refuses a class another user is responsible for, and deletes nothing', async () => {
    const t = stubTarget(OWNED('SOMEONE'));
    await asUser('TESTER', async () => {
      await expect(uninstall(t.target)).rejects.toThrow(
        'is in $TMP, but another user is responsible for it; not touched',
      );
    });
    expect(t.calls).not.toContain('lock');
    expect(t.calls).not.toContain('delete');
  });
});

describe('legacy env: an interrupted write is activated on the next run', () => {
  it('skips a class only when its active source is the one wanted', async () => {
    // A previous run wrote the source and failed before the activation.
    const { target, calls } = stubTarget(MINE, {
      active: 'old',
      inactive: 'new',
    });
    expect(
      await ensureClass(target, {
        name: 'ZCL_LG7_X',
        description: 'd',
        main: 'new',
      }),
    ).toBe(true);
    expect(calls).toEqual([
      'readMetadata',
      'readMetadata',
      'read active',
      'read',
      'activate',
      'read active',
    ]);
  });

  it('fails when the activation did not take', async () => {
    const { target, calls } = stubTarget(MINE, { activates: false });
    await expect(
      ensureClass(target, { name: 'ZCL_LG7_X', description: 'd', main: 'new' }),
    ).rejects.toThrow(
      'class ZCL_LG7_X: the active source is not the one written; the activation did not take',
    );
    expect(calls).toContain('activate');
  });

  it('activates a written but inactive fixture source without writing it again', async () => {
    const program = readFileSync(
      join(ABAP_DIR, 'zlg7_fx_unit.prog.abap'),
      'utf8',
    );
    const t = recordingTarget({
      ddl: '',
      sources: { ZLG7_FX_UNIT: { active: 'old', inactive: program } },
    });
    await ensureFixtures(t.target);
    expect(t.calls).not.toContain('update ZLG7_FX_UNIT');
    expect(t.calls).toContain('activate ZLG7_FX_UNIT');
  });
});

describe("legacy env: an existing fixture member is replaced only when it is the session user's", () => {
  const NO_ONE = '<fmodule:abapFunctionModule adtcore:name="Z_LG7_FX_UNIT"/>';
  const module = readFileSync(
    join(ABAP_DIR, 'zlg7_fx.fugr.z_lg7_fx_unit.abap'),
    'utf8',
  );
  const untouched = (calls: string[], name: string) => {
    for (const call of ['lock', 'update', 'activate'])
      expect(calls).not.toContain(`${call} ${name}`);
  };

  it('refuses to replace a function module whose metadata names no one (as 7.40 sends it)', async () => {
    const t = recordingTarget({ ddl: '', metadata: { Z_LG7_FX_UNIT: NO_ONE } });
    await expect(ensureFixtures(t.target)).rejects.toThrow(
      "function module Z_LG7_FX_UNIT names no person responsible, so it is not known to be the session user's; its source differs and is not replaced",
    );
    untouched(t.calls, 'Z_LG7_FX_UNIT');
  });

  it('refuses a function module another user is responsible for, reading no source', async () => {
    const t = recordingTarget({
      ddl: '',
      metadata: { Z_LG7_FX_UNIT: OWNED('SOMEONE') },
    });
    await expect(ensureFixtures(t.target)).rejects.toThrow(
      'function module Z_LG7_FX_UNIT is in $TMP, but another user is responsible for it; not touched',
    );
    untouched(t.calls, 'Z_LG7_FX_UNIT');
    expect(t.calls).not.toContain('read Z_LG7_FX_UNIT');
  });

  it('leaves an unverifiable function module alone when its active source is the fixture', async () => {
    const t = recordingTarget({
      ddl: '',
      metadata: { Z_LG7_FX_UNIT: NO_ONE },
      sources: { Z_LG7_FX_UNIT: { active: module } },
    });
    await ensureFixtures(t.target);
    untouched(t.calls, 'Z_LG7_FX_UNIT');
  });

  it('writes a function module the session user is responsible for', async () => {
    const t = recordingTarget({ ddl: '' });
    await ensureFixtures(t.target);
    expect(t.calls).toContain('update Z_LG7_FX_UNIT');
  });

  it('refuses to replace an existing test include, whose owner cannot be read', async () => {
    const t = recordingTarget({
      ddl: '',
      sources: { LZLG7_FXT99: { active: "someone else's tests" } },
    });
    await expect(ensureFixtures(t.target)).rejects.toThrow(
      'function include LZLG7_FXT99 exists and its owner cannot be read from its metadata on this release; its source differs and is not replaced',
    );
    untouched(t.calls, 'LZLG7_FXT99');
    expect(t.calls).not.toContain('create LZLG7_FXT99');
  });

  it('refuses a program another user is responsible for', async () => {
    const t = recordingTarget({
      ddl: '',
      metadata: { ZLG7_FX_UNIT: OWNED('SOMEONE') },
    });
    await expect(ensureFixtures(t.target)).rejects.toThrow(
      'program ZLG7_FX_UNIT is in $TMP, but another user is responsible for it; not touched',
    );
    untouched(t.calls, 'ZLG7_FX_UNIT');
  });
});

describe('legacy env: teardown keeps the env classes when REMOVE failed', () => {
  const removeFailed = [
    '@@LOG {"n":1,"step":"requests","object":"K900001","status":"ERROR","message":"a task of another user is in it; request not touched"}',
    '@@RESULT {"ok":false,"action":"remove","request":"","package":"ZLG7_TEST","packageExists":true,"errors":1,"lines":1}',
  ];
  const envDeletes = (calls: string[]) =>
    calls.filter((c) => c.startsWith('delete ZCL_LG7_ENV'));

  it('deletes no env class and says why, so REMOVE can run again', async () => {
    const t = recordingTarget({
      ddl: MINE,
      answers: { ZCL_LG7_ENV_REMOVE: removeFailed },
    });
    await expect(teardown(t.target)).rejects.toThrow(
      'env classes kept: REMOVE reported an error; fix it and run npm run legacy:teardown again',
    );
    expect(t.runs).toEqual(['ZCL_LG7_ENV_TEARDOWN', 'ZCL_LG7_ENV_REMOVE']);
    expect(envDeletes(t.calls)).toEqual([]);
  });

  it('deletes the env classes after a clean REMOVE', async () => {
    const t = recordingTarget({ ddl: MINE });
    await teardown(t.target);
    expect(envDeletes(t.calls).length).toBeGreaterThan(0);
  });
});

describe('legacy env: the abap_unit runner is unchanged', () => {
  it('setup installs the runners, runs PREPARE through ABAP Unit, and leaves ZCL_LG7_ENV_RUN alone', async () => {
    const t = recordingTarget({ ddl: MINE });
    const run = await setup(t.target, SETTINGS);
    expect(run.result.ok).toBe(true);
    expect(t.runs).toEqual(['ZCL_LG7_ENV_PREPARE']);
    expect(t.written().filter((n) => n.startsWith('ZCL_LG7_ENV'))).toEqual([
      'ZCL_LG7_ENV',
      'ZCL_LG7_ENV_PREPARE',
      'ZCL_LG7_ENV_STATUS',
      'ZCL_LG7_ENV_TEARDOWN',
      'ZCL_LG7_ENV_REMOVE',
    ]);
    expect(t.calls.some((c) => c.endsWith(` ${MANUAL_RUNNER}`))).toBe(false);
  });
});
