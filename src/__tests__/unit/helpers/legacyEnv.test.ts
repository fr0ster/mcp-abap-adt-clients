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
  deleteLeftDdls,
  ensureClass,
  envClasses,
  isCredentialRefusal,
  isOwnName,
  type LegacyEnvTarget,
  markedLines,
  packageOf,
  parseEnvRun,
  renderPrepare,
  requireOwnNames,
  sameSource,
  settingsOf,
  stopOnCredentialRefusal,
} from '../../helpers/legacyEnv';

// The stubs are no handler class `integrationHeadersOf` knows; the pair is not
// this test's subject.
jest.mock('../../helpers/adtHeaders', () => ({
  integrationHeadersOf: () => ({ accept: 'x/test', contentType: 'x/test' }),
}));

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

/** A client whose class handler answers `metadata` and records every call. */
function stubTarget(metadata: string) {
  const calls: string[] = [];
  const handler = {
    readMetadata: async () => {
      calls.push('readMetadata');
      return ok(metadata);
    },
    read: async () => {
      calls.push('read');
      return ok('old source');
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
    update: async () => {
      calls.push('update');
      return ok('');
    },
    activate: async () => {
      calls.push('activate');
      return ok('');
    },
    delete: async () => {
      calls.push('delete');
      return ok('');
    },
  };
  const client = {
    getClass: () => handler,
    getLocalTestClass: () => handler,
    getDdl: () => handler,
  };
  const target = { client, executor: {} } as unknown as LegacyEnvTarget;
  return { target, calls };
}

const IN = (pkg: string) =>
  `<x adtcore:name="N"><adtcore:packageRef adtcore:name="${pkg}"/></x>`;

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
    const { target, calls } = stubTarget(IN('$TMP'));
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
      'read',
      'read',
      'lock',
      'update',
      'update',
      'unlock',
      'activate',
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

    const own = stubTarget(IN('$TMP'));
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
    expect(deleteOne).toContain('in_scope_package( lv_devclass ) = abap_false');
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
    // Real JSON escapes, so < > & cannot end or bend the line in XML.
    expect(env).toContain(
      'REPLACE ALL OCCURRENCES OF `<` IN rv_json WITH `\\u003c`.',
    );
    expect(env).toContain(
      'REPLACE ALL OCCURRENCES OF `>` IN rv_json WITH `\\u003e`.',
    );
    expect(env).toContain(
      'REPLACE ALL OCCURRENCES OF `&` IN rv_json WITH `\\u0026`.',
    );
    expect(env).toContain(
      'REPLACE ALL OCCURRENCES OF `\\` IN rv_json WITH `\\\\`.',
    );
    expect(env).toContain(
      'REPLACE ALL OCCURRENCES OF `"` IN rv_json WITH `\\"`.',
    );
    // Never a release of a request.
    expect(env).not.toMatch(/TR_RELEASE|RELEASE_REQUEST/i);
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

  it('remove the package and the requests only in the second teardown phase', () => {
    const env = read('zcl_lg7_env.clas.abap');
    const first = methodOf(env, 'teardown');
    const second = methodOf(env, 'remove');
    expect(first).not.toMatch(/delete_package|delete_requests/);
    expect(second).toContain('delete_package( ).');
    expect(second).toContain('delete_requests( ).');
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
