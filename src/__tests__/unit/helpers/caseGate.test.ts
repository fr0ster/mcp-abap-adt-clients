import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  configurationDefect,
  gateAll,
  gateOn,
  MISSING_TEST_CONFIG,
  missingCaseMessage,
  gate as registrationGate,
  gateStandardObject as registrationGateStandardObject,
} from '../../helpers/caseGate';

const gate: typeof registrationGate = (handler, name, loader) =>
  registrationGate(handler, name, loader, {
    loadEnv: () => {},
    sapConfigured: () => true,
    templateInUse: () => false,
  });

const gateStandardObject = (
  type: string,
  parsed: unknown,
  standardObject: (type: string, cloud: boolean, legacy: boolean) => unknown,
) =>
  registrationGateStandardObject(type, () => parsed, {
    loadEnv: () => {},
    sapConfigured: () => true,
    templateInUse: () => false,
    standardObject,
  });

function config(system = 'onprem', enabled = true, availableIn = ['onprem']) {
  return {
    environment: { system },
    enhancement: {
      test_cases: [{ name: 'enhoxhh', enabled, available_in: availableIn }],
    },
  };
}

describe('case registration gate', () => {
  it('registers an enabled, available case normally', () => {
    expect(gate('enhancement', 'enhoxhh', () => config())).toBe(it);
  });

  it('skips a disabled case', () => {
    expect(gate('enhancement', 'enhoxhh', () => config('onprem', false))).toBe(
      it.skip,
    );
  });

  it('skips a case unavailable on the configured system', () => {
    expect(gate('enhancement', 'enhoxhh', () => config('cloud'))).toBe(it.skip);
  });

  it('uses cloud from config for cloud-only cases', () => {
    expect(
      gate('enhancement', 'enhoxhh', () => config('cloud', true, ['cloud'])),
    ).toBe(it);
  });

  it('uses the legacy flag for onprem systems', () => {
    const parsed = config('onprem', true, ['legacy']);
    expect(
      gate('enhancement', 'enhoxhh', () => ({
        ...parsed,
        environment: { ...parsed.environment, is_legacy: true },
      })),
    ).toBe(it);
    expect(gate('enhancement', 'enhoxhh', () => parsed)).toBe(it.skip);
  });

  it.each([undefined, {}, { environment: {} }, config('invalid')])(
    'registers normally when config or system is missing or invalid: %p',
    (parsed) => {
      expect(gate('enhancement', 'enhoxhh', () => parsed)).toBe(
        configurationDefect,
      );
    },
  );

  it('registers normally when loading config fails', () => {
    expect(
      gate('enhancement', 'enhoxhh', () => {
        throw new Error('Unreadable config');
      }),
    ).toBe(configurationDefect);
  });

  it('registers a missing case in an otherwise configured system normally', () => {
    expect(gate('enhancement', 'missing', () => config())).toBe(
      configurationDefect,
    );
  });

  it('registers normally when the handler section is absent', () => {
    expect(gate('missing', 'enhoxhh', () => config())).toBe(
      configurationDefect,
    );
  });

  it('skips a case with enabled omitted', () => {
    const parsed = config();
    const { enabled: _enabled, ...testCase } = parsed.enhancement.test_cases[0];
    expect(
      gate('enhancement', 'enhoxhh', () => ({
        ...parsed,
        enhancement: { test_cases: [testCase] },
      })),
    ).toBe(it.skip);
  });

  it('skips a case with a non-boolean enabled value', () => {
    const parsed = config();
    expect(
      gate('enhancement', 'enhoxhh', () => ({
        ...parsed,
        enhancement: {
          test_cases: [
            { ...parsed.enhancement.test_cases[0], enabled: 'true' },
          ],
        },
      })),
    ).toBe(it.skip);
  });

  it('skips an onprem-only case on a legacy system', () => {
    const parsed = config();
    expect(
      gate('enhancement', 'enhoxhh', () => ({
        ...parsed,
        environment: { ...parsed.environment, is_legacy: true },
      })),
    ).toBe(it.skip);
  });

  it('allows cases with available_in omitted', () => {
    const parsed = config('cloud');
    const { available_in: _availableIn, ...testCase } =
      parsed.enhancement.test_cases[0];
    expect(
      gate('enhancement', 'enhoxhh', () => ({
        ...parsed,
        enhancement: { test_cases: [testCase] },
      })),
    ).toBe(it);
  });

  it.each(['onprem', null, {}, true])(
    'allows cases with non-array available_in: %p',
    (availableIn) => {
      const parsed = config('cloud');
      expect(
        gate('enhancement', 'enhoxhh', () => ({
          ...parsed,
          enhancement: {
            test_cases: [
              {
                ...parsed.enhancement.test_cases[0],
                available_in: availableIn,
              },
            ],
          },
        })),
      ).toBe(it);
    },
  );

  it('allows cases with no availability restriction', () => {
    expect(
      gate('enhancement', 'enhoxhh', () => config('cloud', true, [])),
    ).toBe(it);
  });
});

describe('SAP configuration at registration', () => {
  const originalUrl = process.env.SAP_URL;
  afterEach(() => {
    if (originalUrl === undefined) delete process.env.SAP_URL;
    else process.env.SAP_URL = originalUrl;
  });

  it.each([
    [undefined, it.skip],
    ['   ', it.skip],
    ['sap.example.com', it],
    ['https://x', it],
  ])('registers SAP_URL %p correctly', (url, expected) => {
    if (url === undefined) delete process.env.SAP_URL;
    else process.env.SAP_URL = url;
    expect(
      registrationGate('enhancement', 'enhoxhh', () => config(), {
        loadEnv: () => {},
        templateInUse: () => false,
      }),
    ).toBe(expected);
  });

  it('skips without SAP before reading even broken configuration', () => {
    delete process.env.SAP_URL;
    expect(
      registrationGate(
        'enhancement',
        'enhoxhh',
        () => {
          throw new Error('Configuration must not be read without SAP');
        },
        { loadEnv: () => {} },
      ),
    ).toBe(it.skip);
  });

  it('loads the environment before deciding whether SAP is configured', () => {
    delete process.env.SAP_URL;
    expect(
      registrationGate('enhancement', 'enhoxhh', () => config(), {
        loadEnv: () => {
          process.env.SAP_URL = 'https://sap.invalid';
        },
        templateInUse: () => false,
      }),
    ).toBe(it);
  });

  it('registers a template case as a failure even when disabled', () => {
    expect(
      registrationGate(
        'enhancement',
        'enhoxhh',
        () => config('onprem', false),
        {
          loadEnv: () => {},
          sapConfigured: () => true,
          templateInUse: () => true,
        },
      ),
    ).toBe(configurationDefect);
  });
});

describe('real environment loader and config provenance', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let directory: string;

  beforeEach(() => {
    originalEnv = { ...process.env };
    directory = mkdtempSync(join(tmpdir(), 'case-gate-'));
    delete process.env.SAP_URL;
    process.env.MCP_ENV_PATH = join(directory, '.env');
  });

  afterEach(() => {
    process.env = originalEnv;
    rmSync(directory, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  it('chooses MCP_ENV_PATH over the repository .env', () => {
    writeFileSync(
      process.env.MCP_ENV_PATH!,
      'SAP_URL=https://chosen.invalid\n',
    );
    jest.isolateModules(() => {
      const { gate } = require('../../helpers/caseGate');
      expect(
        gate('enhancement', 'enhoxhh', () => config(), {
          templateInUse: () => false,
        }),
      ).toBe(it);
      expect(process.env.SAP_URL).toBe('https://chosen.invalid');
    });
  });

  it('does not fall back to the repository .env for a nonexistent MCP_ENV_PATH', () => {
    jest.isolateModules(() => {
      const { gate } = require('../../helpers/caseGate');
      expect(gate('enhancement', 'enhoxhh', () => config())).toBe(it.skip);
      expect(process.env.SAP_URL).toBeUndefined();
    });
  });

  it('preserves an already-set SAP_URL using dotenv precedence', () => {
    writeFileSync(process.env.MCP_ENV_PATH!, 'SAP_URL=https://file.invalid\n');
    process.env.SAP_URL = 'sap.example.com';
    jest.isolateModules(() => {
      const { gate } = require('../../helpers/caseGate');
      expect(
        gate('enhancement', 'enhoxhh', () => config(), {
          templateInUse: () => false,
        }),
      ).toBe(it);
      expect(process.env.SAP_URL).toBe('sap.example.com');
    });
  });

  it('detects template provenance when the custom config is absent', () => {
    writeFileSync(
      process.env.MCP_ENV_PATH!,
      'SAP_URL=https://chosen.invalid\n',
    );
    writeFileSync(
      join(directory, 'test-config.yaml.template'),
      'environment:\n  system: onprem\nenhancement:\n  test_cases:\n    - name: enhoxhh\n      enabled: false\n',
    );
    const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.isolateModules(() => {
      const helper = require('../../helpers/test-helper');
      const {
        gate,
        configurationDefect: isolatedDefect,
      } = require('../../helpers/caseGate');
      expect(
        gate('enhancement', 'enhoxhh', () => helper.loadTestConfig(directory)),
      ).toBe(isolatedDefect);
      expect(helper.isTestConfigTemplate()).toBe(true);
    });
    expect(warning.mock.calls).toEqual([
      [
        '⚠️ test-config.yaml not found. Using test-config.yaml.template; its values are placeholders (e.g. default_package <DEV_PACKAGE>).',
      ],
      [
        '   Copy the template to test-config.yaml and fill in your SAP system details.',
      ],
    ]);
  });
});

describe('enhancement configuration failure messages', () => {
  it('reports template use with the exact setup failure text', () => {
    expect(MISSING_TEST_CONFIG).toBe(
      'test-config.yaml missing — copy the template and fill it in',
    );
  });

  it('reports an absent case with the exact failure text', () => {
    expect(missingCaseMessage('enhancement', 'enhoxhh')).toBe(
      'case enhancement/enhoxhh not in test-config.yaml',
    );
  });
});

describe('standard object registration gate', () => {
  it('registers when the system holds a standard object of the type', () => {
    expect(
      gateStandardObject('class', config(), () => ({ name: 'CL_ABAP_CHAR' })),
    ).toBe(it);
  });

  it('skips when the system holds none of the type', () => {
    expect(gateStandardObject('class', config(), () => null)).toBe(it.skip);
  });

  it('asks about the configured system, cloud and legacy included', () => {
    const asked: unknown[][] = [];
    const record = (...args: unknown[]) => {
      asked.push(args);
      return null;
    };
    gateStandardObject('table', config('cloud'), record);
    const legacy = config();
    gateStandardObject(
      'table',
      { ...legacy, environment: { ...legacy.environment, is_legacy: true } },
      record,
    );
    expect(asked).toEqual([
      ['table', true, false],
      ['table', false, true],
    ]);
  });

  it.each([undefined, {}, config('invalid')])(
    'registers normally when config or system is missing or invalid: %p',
    (parsed) => {
      expect(gateStandardObject('class', parsed, () => null)).toBe(
        configurationDefect,
      );
    },
  );

  it('skips without SAP before reading even broken configuration', () => {
    expect(
      registrationGateStandardObject(
        'class',
        () => {
          throw new Error('Configuration must not be read without SAP');
        },
        { loadEnv: () => {}, sapConfigured: () => false },
      ),
    ).toBe(it.skip);
  });
});

describe('gates combined', () => {
  it('registers only when every gate registers', () => {
    expect(gateAll(it, it)).toBe(it);
    expect(gateAll(it, it.skip)).toBe(it.skip);
    expect(gateAll(it.skip, it)).toBe(it.skip);
    expect(gateAll(it.skip, it.skip)).toBe(it.skip);
  });
});

describe('applicability gate', () => {
  const on = (applies: Parameters<typeof gateOn>[0], parsed: unknown) =>
    gateOn(applies, () => parsed, {
      loadEnv: () => {},
      sapConfigured: () => true,
      templateInUse: () => false,
    });

  it('registers where the predicate holds and skips where it does not', () => {
    expect(on(() => true, config())).toBe(it);
    expect(on(() => false, config())).toBe(it.skip);
  });

  it('hands the predicate the configured system', () => {
    const seen: unknown[] = [];
    on((system) => !!seen.push(system), config('cloud'));
    expect(seen).toEqual([{ isCloud: true, isLegacy: false }]);
  });

  it('registers normally when the predicate cannot decide', () => {
    expect(
      on(() => {
        throw new Error('Unreadable configuration');
      }, config()),
    ).toBe(configurationDefect);
  });

  it('skips without SAP before asking the predicate', () => {
    expect(
      gateOn(
        () => {
          throw new Error('Must not be asked without SAP');
        },
        () => config(),
        { loadEnv: () => {}, sapConfigured: () => false },
      ),
    ).toBe(it.skip);
  });
});

describe('a configuration defect wins over every applicability predicate', () => {
  const quiet = {
    loadEnv: () => {},
    sapConfigured: () => true,
    templateInUse: () => false,
  };

  it('keeps a missing case a failing test when another gate says skip', () => {
    const absent = gate('enhancement', 'missing', () => config());
    expect(absent).toBe(configurationDefect);
    const falsePredicate = gateOn(
      () => false,
      () => config(),
      quiet,
    );
    expect(falsePredicate).toBe(it.skip);
    expect(gateAll(absent, falsePredicate)).toBe(configurationDefect);
    expect(gateAll(falsePredicate, absent)).toBe(configurationDefect);
    expect(gateAll(absent, it.skip)).toBe(configurationDefect);
  });

  it('keeps a defect from a broken configuration over a skip', () => {
    const broken = gate(
      'enhancement',
      'enhoxhh',
      () => {
        throw new Error('Unreadable config');
      },
      quiet,
    );
    expect(gateAll(broken, it.skip)).toBe(configurationDefect);
  });

  it('still skips an existing case that the predicate rules out', () => {
    expect(
      gateAll(
        gate('enhancement', 'enhoxhh', () => config(), quiet),
        it.skip,
      ),
    ).toBe(it.skip);
  });

  it('runs the defect as a real test, under the name it was given', () => {
    const seen: string[] = [];
    const real = global.it;
    (global as { it: unknown }).it = Object.assign(
      (name: string) => seen.push(name),
      real,
    );
    try {
      configurationDefect('the case');
    } finally {
      (global as { it: unknown }).it = real;
    }
    expect(seen).toEqual(['the case']);
  });
});
