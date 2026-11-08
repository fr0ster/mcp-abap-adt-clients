/**
 * The test configuration's boundary (connection 20): the wire first, then
 * each wire's keys. HTTP requires its URL and takes no RFC address key; RFC
 * takes no URL and states one complete address, its client and its logon
 * language. Every refusal names keys, never a value.
 */
let mockEnvironment: () => unknown;

jest.mock('../../helpers/test-helper', () => ({
  ...jest.requireActual('../../helpers/test-helper'),
  getEnvironmentConfig: () => mockEnvironment(),
}));

import { sapIsConfigured, statedTarget } from '../../helpers/sapConfigured';
import { getConfig, targetOf } from '../../helpers/sessionConfig';

const KEYS = [
  'SAP_URL',
  'SAP_AUTH_TYPE',
  'SAP_USERNAME',
  'SAP_PASSWORD',
  'SAP_JWT_TOKEN',
  'SAP_CLIENT',
  'SAP_LANGUAGE',
  'SAP_ASHOST',
  'SAP_SYSNR',
  'SAP_MSHOST',
  'SAP_MSSERV',
  'SAP_SYSID',
  'SAP_GROUP',
  'SAP_SAPROUTER',
];

/** A value no refusal may quote. */
const SENTINEL = 'Sentinel-7f3a';

const saved: Record<string, string | undefined> = {};
beforeEach(() => {
  for (const key of KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
});
afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

function state(values: Record<string, string>): void {
  for (const [key, value] of Object.entries(values)) process.env[key] = value;
}

/** The refusal `getConfig` throws, its words checked to quote no value. */
function refusal(): string {
  let message: string | undefined;
  try {
    getConfig();
  } catch (error) {
    message = error instanceof Error ? error.message : String(error);
  }
  if (message === undefined) throw new Error('getConfig did not refuse');
  expect(message).not.toContain(SENTINEL);
  return message;
}

/** The refusal's words end with `suffix`: the keys it names, and no more. */
function expectEnds(message: string, suffix: string): void {
  expect(message.slice(-suffix.length)).toBe(suffix);
}

describe('getConfig over RFC', () => {
  const logon = {
    SAP_AUTH_TYPE: 'basic',
    SAP_USERNAME: 'U',
    SAP_PASSWORD: 'P',
    SAP_CLIENT: '100',
    SAP_LANGUAGE: 'EN',
  };
  beforeEach(() => {
    mockEnvironment = () => ({ connection_type: 'rfc' });
  });

  it('reads the wire first: an application server without SAP_URL is an RFC config', () => {
    state({ ...logon, SAP_ASHOST: 'host', SAP_SYSNR: '00' });
    expect(getConfig()).toStrictEqual({
      connectionType: 'rfc',
      authType: 'basic',
      client: '100',
      language: 'EN',
      username: 'U',
      password: 'P',
      ashost: 'host',
      sysnr: '00',
    });
  });

  it('reads a message server with msserv, with sysid, and with both, as stated', () => {
    const common = {
      connectionType: 'rfc',
      authType: 'basic',
      client: '100',
      language: 'EN',
      username: 'U',
      password: 'P',
      mshost: 'ms',
      group: 'G',
    };
    state({ ...logon, SAP_MSHOST: 'ms', SAP_GROUP: 'G', SAP_MSSERV: '3600' });
    expect(getConfig()).toStrictEqual({ ...common, msserv: '3600' });
    delete process.env.SAP_MSSERV;
    state({ SAP_SYSID: 'SID' });
    expect(getConfig()).toStrictEqual({ ...common, sysid: 'SID' });
    state({ SAP_MSSERV: '3600' });
    expect(getConfig()).toStrictEqual({
      ...common,
      msserv: '3600',
      sysid: 'SID',
    });
  });

  it('carries SAP_SAPROUTER when stated', () => {
    state({
      ...logon,
      SAP_ASHOST: 'host',
      SAP_SYSNR: '00',
      SAP_SAPROUTER: '/H/router/S/3299',
    });
    expect(getConfig()).toMatchObject({ saprouter: '/H/router/S/3299' });
  });

  it('refuses SAP_URL, naming it', () => {
    state({
      ...logon,
      SAP_ASHOST: 'host',
      SAP_SYSNR: '00',
      SAP_URL: `https://${SENTINEL}`,
    });
    expect(refusal()).toContain(
      'is RFC (environment.connection_type "rfc") and states SAP_URL, which an RFC destination does not take',
    );
  });

  it.each([['SAP_MSHOST'], ['SAP_MSSERV'], ['SAP_SYSID'], ['SAP_GROUP']])(
    'refuses two addresses: SAP_ASHOST beside %s, naming both',
    (key) => {
      state({ ...logon, SAP_ASHOST: SENTINEL, [key]: SENTINEL });
      expect(refusal()).toContain(
        `states two addresses — an application server and a message server: SAP_ASHOST, ${key}`,
      );
    },
  );

  it('refuses two addresses: SAP_SYSNR beside SAP_MSHOST', () => {
    state({ ...logon, SAP_SYSNR: SENTINEL, SAP_MSHOST: SENTINEL });
    expect(refusal()).toContain(
      'states two addresses — an application server and a message server: SAP_SYSNR, SAP_MSHOST',
    );
  });

  it('refuses no address, naming both alternatives', () => {
    state(logon);
    expect(refusal()).toContain(
      'states no address: set SAP_ASHOST and SAP_SYSNR, or SAP_MSHOST with SAP_MSSERV or SAP_SYSID and SAP_GROUP',
    );
  });

  it.each([
    [{ SAP_ASHOST: SENTINEL }, 'SAP_SYSNR'],
    [{ SAP_SYSNR: SENTINEL }, 'SAP_ASHOST'],
    [{ SAP_MSHOST: SENTINEL, SAP_MSSERV: SENTINEL }, 'SAP_GROUP'],
    [{ SAP_MSHOST: SENTINEL, SAP_GROUP: SENTINEL }, 'SAP_MSSERV or SAP_SYSID'],
    [{ SAP_MSSERV: SENTINEL, SAP_GROUP: SENTINEL }, 'SAP_MSHOST'],
    [{ SAP_SYSID: SENTINEL }, 'SAP_MSHOST, SAP_GROUP'],
  ])('refuses an incomplete address %j: it lacks %s', (stated, missing) => {
    state({ ...logon, ...stated });
    expectEnds(refusal(), `and its address lacks: ${missing}`);
  });

  it.each([
    ['SAP_CLIENT', 'SAP_CLIENT'],
    ['SAP_LANGUAGE', 'SAP_LANGUAGE'],
  ])('refuses an RFC config without %s', (left, missing) => {
    state({ ...logon, SAP_ASHOST: SENTINEL, SAP_SYSNR: SENTINEL });
    delete process.env[left];
    expectEnds(refusal(), `connection_type "rfc") and lacks: ${missing}`);
  });
});

describe('getConfig over HTTP', () => {
  beforeEach(() => {
    mockEnvironment = () => ({});
    state({ SAP_AUTH_TYPE: 'basic', SAP_USERNAME: 'U', SAP_PASSWORD: 'P' });
  });

  it('requires SAP_URL', () => {
    expect(refusal()).toContain('Missing or invalid SAP_URL');
  });

  it('refuses a SAP_URL that is not http(s), naming the key and never the value', () => {
    state({ SAP_URL: `ftp://${SENTINEL}` });
    expect(refusal()).toBe(
      'Missing or invalid SAP_URL: state the http(s) URL of the system in .env',
    );
  });

  it('refuses an unknown SAP_AUTH_TYPE, naming the key and never the value', () => {
    state({ SAP_URL: 'https://system.example', SAP_AUTH_TYPE: SENTINEL });
    expect(refusal()).toBe(
      'SAP_AUTH_TYPE is not one of basic, jwt, xsuaa — fix it in .env',
    );
  });

  it('builds the HTTP config from SAP_URL, with no RFC key', () => {
    state({ SAP_URL: 'https://system.example', SAP_CLIENT: '100' });
    expect(getConfig()).toStrictEqual({
      url: 'https://system.example',
      authType: 'basic',
      client: '100',
      username: 'U',
      password: 'P',
    });
  });

  it.each([
    'SAP_ASHOST',
    'SAP_SYSNR',
    'SAP_MSHOST',
    'SAP_MSSERV',
    'SAP_SYSID',
    'SAP_GROUP',
    'SAP_SAPROUTER',
  ])('refuses %s, which HTTP does not take', (key) => {
    state({ SAP_URL: 'https://system.example', [key]: SENTINEL });
    expectEnds(
      refusal(),
      `is HTTP (environment.connection_type is not "rfc") and states RFC address keys, which HTTP does not take: ${key}`,
    );
  });
});

describe('whether a system is configured, and which', () => {
  it('nothing stated is no system', () => {
    expect(sapIsConfigured()).toBe(false);
    expect(statedTarget()).toBe('no system');
  });

  it('an http(s) SAP_URL is a system', () => {
    state({ SAP_URL: 'https://system.example # comment' });
    expect(sapIsConfigured()).toBe(true);
    expect(statedTarget()).toBe('https://system.example');
  });

  it.each([
    'SAP_ASHOST',
    'SAP_SYSNR',
    'SAP_MSHOST',
    'SAP_MSSERV',
    'SAP_SYSID',
    'SAP_GROUP',
  ])('an RFC address key (%s) without a URL is a system', (key) => {
    state({ [key]: 'value' });
    expect(sapIsConfigured()).toBe(true);
    expect(statedTarget()).toBe(`RFC ${key}=value`);
  });

  it('names the target of a typed config: the URL over HTTP, the address over RFC, never a credential', () => {
    expect(
      targetOf({
        url: 'https://system.example',
        authType: 'basic',
        password: SENTINEL,
      }),
    ).toBe('https://system.example');
    expect(
      targetOf({
        connectionType: 'rfc',
        authType: 'basic',
        client: '100',
        language: 'EN',
        ashost: 'host',
        sysnr: '00',
        password: SENTINEL,
      }),
    ).toBe('rfc ashost=host sysnr=00');
    expect(
      targetOf({
        connectionType: 'rfc',
        authType: 'basic',
        client: '100',
        language: 'EN',
        mshost: 'ms',
        sysid: 'SID',
        group: 'G',
        saprouter: '/H/r',
      }),
    ).toBe('rfc mshost=ms sysid=SID group=G saprouter=/H/r');
  });
});
